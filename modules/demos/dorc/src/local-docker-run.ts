import * as arch from './architecture';
import { TerraformStack, TerraformOutput } from "cdktf";
import { Container, DockerProvider, Image } from "@cdktf/provider-docker";
import { ApiServer, ContainerStateEvent } from '@arinoto/core';
import {
    apiServerBuildContext,
    DockerQueue,
    DockerKeyValueStore,
    DockerTopic,
    DockerRuntime, DummyAutoscaler,
    run,
    DockerApiServerProps
} from '@arinoto/local-docker';

import { taskQueuePoller } from './architecture';

/** CONCRETE SOLUTION IMPLEMENTATION */

export const build = (stack: TerraformStack) => {
    new DockerProvider(stack, "docker", {});

    const taskQueue = arch.taskQueue.extend(new DockerQueue<arch.Task>({
        name: 'task-queue',
        port: 8000,
        host: '127.0.0.1',
        itemTimeout: 10,
        coProcessInit: () => {
            setInterval(taskQueuePoller.tick, 1000);
        }
    }));

    taskQueuePoller.extend({
        tick: async () => {
            console.log('tick');

            // TODO: get rid of undefined
            const toRun = await arch.taskQueue.poll.localExec(undefined);

            console.log('got some tasks?', toRun);

            const runs = (toRun || []).map(task => ({
                ran: taskQueuePoller.poller.exec(task),
                task
            }))
                .map(async ({ ran, task }) => {
                    try {
                        await ran;
                        arch.taskQueue.markDone.localExec(task.queueUid);
                    } catch (e) {
                        console.log(`Task ${JSON.stringify(task)} run failed`, e);
                    }
                });

            await Promise.all(runs);
        }
    })

    const taskStore = arch.taskStore.extend(new DockerKeyValueStore<string, arch.Task>({
        name: 'task-store',
        port: 8001,
        host: '127.0.0.1'
    }));

    const containerTopic = arch.containerStateTopic.extend(new DockerTopic<ContainerStateEvent<arch.DockerLabels>>({
        name: 'container-topic',
        port: 8002,
        host: '127.0.0.1'
    }));

    const taskTopic = arch.taskStateTopic.extend(new DockerTopic<arch.Task>({
        name: 'task-topic',
        port: 8003,
        host: '127.0.0.1'
    }));

    arch.scaler.extend(new DummyAutoscaler());

    const dockerist = new DockerRuntime({
        name: 'docker-run',
        port: 8004,
        host: '127.0.0.1'
    });

    arch.containerRuntime.extend(dockerist);
    arch.containerRuntime.autoscaler = new DummyAutoscaler();

    const mainApi = {
        apiName: 'dorc',
        init: {
            name: 'main',
            port: 8080,
            host: '127.0.0.10'
        }
    };

    const mainServer: DockerApiServerProps = {
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
                {
                    api: arch.apiGetTaskHistory,
                    spec: {
                        method: 'GET',
                        path: '/v1/task/{id}/history'
                    }
                },
                {
                    api: arch.apiGetTaskLogs,
                    spec: {
                        method: 'GET',
                        path: '/v1/task/{id}/logs'
                    }
                },
            ]
        }
    };

    const apiServer = new ApiServer(mainServer, () => run(mainServer));

    const imageCtx = apiServerBuildContext(__dirname, 'api-server.Dockerfile');

    const server = new Image(stack, 'dorc-api-server', {
        name: 'dorc-api-server',
        buildAttribute: imageCtx
    });


    [taskQueue, taskStore, containerTopic, taskTopic, dockerist, mainApi]
        .map(el => {
            const name = `dorc-${el.init.name}`;

            const cont = new Container(stack, name, {
                dependsOn: [server],
                name,
                image: server.latest,
                attach: false,
                networkMode: 'host',
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
                    el.apiName
                ]
            });

            new TerraformOutput(stack, `${el.init.name}-id`, {
                value: cont.id
            });
        });
}