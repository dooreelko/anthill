

/** DESIGN */

import {
    Lazy, DockerStates, Queue, KeyValueStore,
    Autoscaler, Topic, ContainerStateEvent, ContainerRuntime,
    Func, Api, TaskUid, QueuePoller
} from "./idw2c";

export type Task = {
    // id of the task in the store
    id?: string;
    // uid of the task in the container runtime
    uid?: string;
    command: string;
    state: 'queued' | DockerStates;
};

export type TaskSubmissionRequest = {
    command: string;
};

export const taskQueue = new Lazy<Queue<Task>>();

export const taskStore = new Lazy<KeyValueStore<string, Task>>();

export const scaler = new Lazy<Autoscaler>();

export const containerStateTopic = new Lazy<Topic<ContainerStateEvent>>();

export const taskStateTopic = new Lazy<Topic<Task>>();

export const containerRuntime = new Lazy<ContainerRuntime>(
    // (instance: ContainerRuntime) => {
    //     instance.autoscaler = scaler.instance;
    //     instance.stateChangeTopic = containerStateTopic.instance;
    // }
);

export const submitTaskFunction = new Func<TaskSubmissionRequest, Task>({
    code: (request: TaskSubmissionRequest) => {
        const task = taskStore.instance.put({
            state: 'queued',
            command: request.command
        });

        taskQueue.instance.put(task);

        return task;
    }
});

export const apiRunTask = new Api<TaskSubmissionRequest, Task>({
    target: submitTaskFunction
});

export const runTaskFunction = new Func<Task>({
    code: t => {
        let uid: TaskUid;
        try {
            uid = containerRuntime.instance.run(t.command);
        } catch (e) {
            throw new Error(`Container runtime refused new task with ${e}`);
        }

        taskStore.instance.put({
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
    code: () => taskStore.instance.list()
});

export const apiListTasks = new Api<unknown, Task[]>({
    target: listTasksFunction
});

export const getTaskFunction = new Func<string, Task | undefined>({
    code: (id) => taskStore.instance.get(id)
});

export const apiGetTask = new Api<string, Task | undefined>({
    target: getTaskFunction
});

export const taskStateFunction = new Func<ContainerStateEvent, void>({
    code: (e) => {
        const task = taskStore
            .instance
            .get({ uid: e.uid });

        // not all images will be managed by us
        if (!task) {
            return;
        }

        taskStore
            .instance
            .put({
                ...task,
                state: e.status
            });

        taskStateTopic.instance.publish(task);
    }
});
