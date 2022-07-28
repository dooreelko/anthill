import Docker = require('dockerode');
import JSONStream = require('pixl-json-stream');
import { EventEmitter } from 'stream';
import * as maxim from '../idw2c';
import { DockerRun } from '../idw2c';
import { HttpApi } from './api-server/api-server';
import { DockerServerInit } from './tools';

export class DockerRuntime extends maxim.ContainerRuntime {
    private docker = new Docker();

    get apiName() { return `docker-${this.init.name}`; }

    constructor(public readonly init: maxim.ContainerRuntimeInit & DockerServerInit) {
        super(init);

        new maxim.ApiServer({
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
        });

        this.docker.getEvents({
            filters: {
                type: ['container']
            }
        }).then(stream => {
            const jsons: EventEmitter = new JSONStream(stream);
            jsons.on('json', j => console.log(j));
        }).catch(err => {
            console.error('Failed connecting to the docker events. Aborting.', err);
            process.exit(1);
        });
    }

    private containerUid = (cont: Docker.Container) => `${this.init.host}|${cont.id}`;

    private _run = async (input: DockerRun) => {
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