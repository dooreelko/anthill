import Docker = require('dockerode');
import JSONStream = require('pixl-json-stream');
import { EventEmitter } from 'stream';
import * as maxim from '../anthill/main';
import { DockerRun } from '../anthill/main';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

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

export class DockerRuntime extends maxim.ContainerRuntime {
    private docker = new Docker();
    private listening = false;

    get apiName() { return `docker-${this.init.name}`; }

    constructor(public readonly init: maxim.ContainerRuntimeInit & DockerServerInit) {
        super(init);

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
            this.listening = true;
            const jsons: EventEmitter = new JSONStream(stream);
            jsons.on('json', async (j: DockerEvent) => {
                const container = this.docker.getContainer(j.id);
                const state = await container.inspect();

                this.init.stateChangeTopic.publish.exec({
                    uid: this.containerUid(container),
                    exitCode: Number(j.Actor.Attributes['exitCode']) || -1,
                    status: state.State.Status as maxim.DockerStates
                })
                console.log(j);
            });
        }).catch(err => {
            console.error('Failed connecting to the docker events. Aborting.', err);
            process.exit(1);
        });
    };

    private _run = async (input: DockerRun) => {
        if (!this.listening) {
            this.startListening();
        }

        return new Promise<maxim.TaskUid>((resolve, reject) => {
            this.docker.run(input.image, input.cmd, process.stdout, async (err, cont) => {
                const container = cont as Docker.Container;
                const exitCode = (await container.inspect()).State.ExitCode;

                await this.init.stateChangeTopic.publish.exec({
                    uid: this.containerUid(container),
                    exitCode,
                    message: String(err),
                    status: 'dead'
                });

                reject(err);
            }).on('container', async (cont: Docker.Container) => {
                await this.init.stateChangeTopic.publish.exec({
                    uid: this.containerUid(cont),
                    exitCode: 0,
                    status: 'running'
                });

                resolve(this.containerUid(cont));
            });
        });
    };

    run = new HttpApi({
        target: new maxim.Func<DockerRun, maxim.TaskUid>({
            code: this._run
        })
    });

};