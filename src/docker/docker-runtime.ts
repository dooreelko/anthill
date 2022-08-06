import Docker = require('dockerode');
import JSONStream = require('pixl-json-stream');
import { EventEmitter } from 'stream';
import * as maxim from '../anthill/main';
import { DockerRun } from '../anthill/main';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export class DummyAutoscaler implements maxim.IAutoscaler {
    get nodeCount(): number {
        return 1;
    }
    set nodeCount(newCount: number) {

    }
    get idleNodeCount(): number {
        return 1;
    }
};


export type DockerEvent = {
    status: 'start' | 'create' | 'attach' | 'resize' | 'die',
    id: string,
    from: string,
    Type: 'container',
    Action: 'start' | 'create' | 'attach' | 'resize' | 'die',
    Actor: {
        ID: string,
        Attributes: Record<string, string>
    },
    scope: 'local',
    time: number,
    timeNano: number
};

export class DockerRuntime extends maxim.Selfed<maxim.IContainerRuntime> implements Partial<maxim.IContainerRuntime> {
    private docker = new Docker();

    get apiName() { return `docker-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit) {
        super();

        const server: maxim.ApiServerProps = {
            name: this.apiName,
            listener: {
                host: 'localhost',
                ...this.init,
                apis: [
                    {
                        api: this.run,
                        spec: {
                            path: '/v1/run',
                            method: 'POST'
                        }
                    }
                ]
            }
        };

        new maxim.ApiServer(server, () => {
            this.startListening();
            run(server);
        });
    }

    private containerUid = (cont: { id: string }) => `${this.init.host}|${cont.id}`;

    private startListening = () => {
        console.error('This is docker runtime. Listening on engine events.');

        this.docker.getEvents({
            filters: {
                type: ['container']
            }
        }).then(stream => {
            const jsons: EventEmitter = new JSONStream(stream);

            jsons.on('json', async (j: DockerEvent) => {
                // console.log('Docker event', j);

                const container = this.docker.getContainer(j.id);
                // console.log('Container', container, container.inspect);

                const state = await container.inspect();

                this.self.stateChangeTopic!.publish.exec({
                    uid: this.containerUid(container),
                    exitCode: Number(j.Actor.Attributes['exitCode']) || -1,
                    status: state.State.Status as maxim.DockerStates
                })
            });
        }).catch(err => {
            console.error('Failed connecting to the docker events. Aborting.', err);
            process.exit(1);
        });
    };

    private _run = async (input: DockerRun) => {
        return this.docker.run(input.image, input.cmd, process.stdout)
            .then(async ([, cont]) => {
                const uid = this.containerUid(cont);

                await this.self.stateChangeTopic!.publish.exec({
                    uid,
                    exitCode: -1,
                    status: 'running'
                });

                return { uid };
            }).catch(e => {
                console.error('Failed submitting container', e);

                return { error: e }
            });
    };

    run = new HttpApi({
        target: new maxim.Func<DockerRun, { uid: maxim.TaskUid } | { error: any }>({
            code: this._run
        })
    });

};