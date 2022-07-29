import * as arch from './architecture';
import { TerraformStack, TerraformOutput } from "cdktf";
import { Container, DockerProvider, Network } from "@cdktf/provider-docker";

import { build as buildApiServer } from './docker/api-server/api-server';
import { DockerQueue } from './docker/queue';
import { DockerKeyValueStore } from './docker/key-value-store';
import { ApiServer, Autoscaler, ContainerStateEvent } from './idw2c';
import { DockerTopic } from './docker/topic';
import { DockerRuntime } from './docker/docker-runtime';

export class DummyAutoscaler extends Autoscaler {
    get nodeCount(): number {
        return 1;
    }
    set nodeCount(newCount: number) {

    }
    get idleNodeCount(): number {
        return 1;
    }
};

export const build = (stack: TerraformStack) => {
    new DockerProvider(stack, "docker", {});

    const taskQueue = new DockerQueue<arch.Task>({
        name: 'task-queue',
        port: 8000,
        host: '172.20.0.1'
    });
    arch.taskQueue.instance = taskQueue;

    const taskStore = new DockerKeyValueStore<string, arch.Task>({
        name: 'task-store',
        port: 8001,
        host: '172.20.0.2'
    });
    arch.taskStore.instance = taskStore;

    const containerTopic = new DockerTopic<ContainerStateEvent>({
        name: 'container-topic',
        port: 8002,
        host: '172.20.0.3'
    });
    arch.containerStateTopic.instance = containerTopic;

    const taskTopic = new DockerTopic<arch.Task>({
        name: 'task-topic',
        port: 8003,
        host: '172.20.0.4'
    });
    arch.taskStateTopic.instance = taskTopic;

    arch.scaler.instance = new DummyAutoscaler();

    const dockerist = new DockerRuntime({
        name: 'docker-run',
        port: 8004,
        host: '172.20.0.5',
        autoscaler: new DummyAutoscaler(),
        stateChangeTopic: containerTopic
    });
    arch.containerRuntime.instance = dockerist;

    const mainApi = {
        apiName: 'dorc',
        init: {
            name: 'dorc',
            port: 8080,
            host: '172.20.0.10'
        }
    };

    const mainServer = new ApiServer({
        name: mainApi.apiName,
        listener: {
            host: mainApi.init.host,
            port: mainApi.init.port,
            apis: [
                {
                    api: arch.apiRunTask,
                    spec: {
                        method: 'POST',
                        path: '/v1/task'
                    }
                },
                {
                    api: arch.apiListTasks,
                    spec: {
                        method: 'GET',
                        path: '/v1/tasks'
                    }
                },
                {
                    api: arch.apiGetTask,
                    spec: {
                        method: 'GET',
                        path: '/v1/task/{id}'
                    }
                },
            ]
        }
    });

    [taskQueue, taskStore, containerTopic, taskTopic, dockerist, mainApi]
        .map(el => {
            const { server, serverPath } = buildApiServer(stack, el.init.name);

            const cont = new Container(stack, el.init.name, {
                dependsOn: [server],
                name: el.init.name,
                image: server.latest,
                attach: false,
                ports: [{
                    external: el.init.port,
                    internal: el.init.port
                }],
                mounts: [
                    {
                        source: '/var/run/docker.sock',
                        target: '/var/run/docker.sock',
                        type: 'bind'
                    }
                ],
                command: [
                    serverPath,
                    el.apiName
                ]
            });

            new TerraformOutput(stack, `${el.init.name}-id`, {
                value: cont.id
            });
        });
}