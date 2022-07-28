

/** DESIGN */

import {
    Lazy, DockerStates, Queue, KeyValueStore,
    Autoscaler, Topic, ContainerStateEvent, ContainerRuntime,
    Func, Api, TaskUid, QueuePoller, ApiServer
} from "./idw2c";

export type Task = {
    // id of the task in the store
    id?: string;
    // uid of the task in the container runtime
    uid?: string;
    image: string;
    cmd: string[];
    state: 'queued' | DockerStates;
};

export type TaskSubmissionRequest = {
    image: string;
    cmd: string[];
};

export const taskQueue = new Lazy<Queue<Task>>();

export const taskStore = new Lazy<KeyValueStore<string, Task>>();

export const scaler = new Lazy<Autoscaler>();

export const containerStateTopic = new Lazy<Topic<ContainerStateEvent>>();

export const taskStateTopic = new Lazy<Topic<Task>>();

export const containerRuntime = new Lazy<ContainerRuntime>();

export const submitTaskFunction = new Func<TaskSubmissionRequest, Task>({
    code: async (request: TaskSubmissionRequest) => {
        const task = await taskStore.instance.put.exec({
            state: 'queued',
            ...request
        });

        taskQueue.instance.put.exec(task);

        return task;
    }
});

export const apiRunTask = new Api<TaskSubmissionRequest, Task>({
    target: submitTaskFunction
});

export const runTaskFunction = new Func<Task>({
    code: async t => {
        let uid: TaskUid;
        try {
            uid = await containerRuntime.instance.run.exec(t);
        } catch (e) {
            throw new Error(`Container runtime refused new task with ${e}`);
        }

        taskStore.instance.put.exec({
            ...t,
            uid,
            state: 'queued'
        })
    }
});

export const taskQueuePoller = new QueuePoller<Task>({
    queue: taskQueue,
    poller: runTaskFunction
});

export const listTasksFunction = new Func<unknown, Task[]>({
    code: () => taskStore.instance.list.exec()
});

export const apiListTasks = new Api<unknown, Task[]>({
    target: listTasksFunction
});

export const getTaskFunction = new Func<string, Task | undefined>({
    code: (id) => taskStore.instance.get.exec(id)
});

export const apiGetTask = new Api<string, Task | undefined>({
    target: getTaskFunction
});

export const taskStateFunction = new Func<ContainerStateEvent, void>({
    code: async e => {
        const task = await taskStore
            .instance
            .get.exec({ uid: e.uid });

        // not all images will be managed by us
        if (!task) {
            return;
        }

        taskStore
            .instance
            .put.exec({
                ...task,
                state: e.status
            });

        taskStateTopic.instance.publish.exec(task);
    }
});
