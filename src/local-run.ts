import * as arch from './architecture';
import { TerraformStack, TerraformOutput } from "cdktf";
import { Container } from "@cdktf/provider-docker";

import { build as buildApiServer } from './docker/api-server/api-server';
import { DockerQueue } from './docker/queue/main';


export const build = (stack: TerraformStack) => {
    const taskQueueName = 'task-queue';
    const taskQueue = new DockerQueue<arch.Task>(taskQueueName, 8000);
    arch.taskQueue.instance = taskQueue;

    const { server, serverPath } = buildApiServer(stack, taskQueueName);

    const taskQueueRun = new Container(stack, 'taskQueue', {
        dependsOn: [server],
        name: taskQueueName,
        image: server.latest,
        attach: false,
        ports: [{
            external: 8000,
            internal: 8000
        }],
        command: [
            serverPath,
            taskQueue.apiName
        ]
    });

    new TerraformOutput(stack, 'task-queue-log', {
        value: taskQueueRun.containerLogs
    });
}