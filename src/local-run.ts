import * as arch from './architecture';
import { TerraformStack, TerraformOutput } from "cdktf";
import { Container } from "@cdktf/provider-docker";

import { build as buildApiServer } from './docker/api-server/api-server';
import { DockerQueue } from './docker/queue';
import { DockerKeyValueStore } from './docker/key-value-store';


export const build = (stack: TerraformStack) => {
    const taskQueue = new DockerQueue<arch.Task>('task-queue', 8000);
    arch.taskQueue.instance = taskQueue;

    const taskStore = new DockerKeyValueStore<string, arch.Task>('task-store', 8001);
    arch.taskStore.instance = taskStore;

    [taskQueue, taskStore]
        .map(el => {
            const { server, serverPath } = buildApiServer(stack, el.name);

            new Container(stack, 'taskQueue', {
                dependsOn: [server],
                name: el.name,
                image: server.latest,
                attach: false,
                ports: [{
                    external: el.port,
                    internal: el.port
                }],
                command: [
                    serverPath,
                    el.apiName
                ]
            });
        });

    // {

    //     const { server, serverPath } = buildApiServer(stack, taskQueue.name);

    //     new Container(stack, 'taskQueue', {
    //         dependsOn: [server],
    //         name: taskQueue.name,
    //         image: server.latest,
    //         attach: false,
    //         ports: [{
    //             external: taskQueue.port,
    //             internal: taskQueue.port
    //         }],
    //         command: [
    //             serverPath,
    //             taskQueue.apiName
    //         ]
    //     });
    // }

    // {

    //     const { server, serverPath } = buildApiServer(stack, taskStore.name);

    //     new Container(stack, 'taskStore', {
    //         dependsOn: [server],
    //         name: taskStore.name,
    //         image: server.latest,
    //         attach: false,
    //         ports: [{
    //             external: taskStore.port,
    //             internal: taskStore.port
    //         }],
    //         command: [
    //             serverPath,
    //             taskStore.apiName
    //         ]
    //     });
    // }


}