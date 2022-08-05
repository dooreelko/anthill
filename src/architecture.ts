

/** DESIGN */

import {
    DockerStates, Queue, KeyValueStore,
    Autoscaler, ContainerStateEvent, ContainerRuntime,
    Func, Api, TaskUid, QueuePoller, Topic
} from "./anthill/main";

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

// Specialized gradual constructor types
const ContainerStateEventTopic = Topic<ContainerStateEvent>();

const TaskTopic = Topic<Task>();

const TaskQueue = Queue<Task>();

const TaskKeyValueStore = KeyValueStore<string, Task>();

const DorcAutoscaler = Autoscaler();

const DorcContainerRuntime = ContainerRuntime();

// Architectural entities

export const taskQueue = new TaskQueue();

export const taskStore = new TaskKeyValueStore();

export const scaler = new DorcAutoscaler();

export const containerStateTopic = new ContainerStateEventTopic();

export const taskStateTopic = new TaskTopic();

export const containerRuntime = new DorcContainerRuntime();
console.log(containerRuntime, containerRuntime.stateChangeTopic);
containerRuntime.stateChangeTopic = containerStateTopic;

export const submitTaskFunction = new Func<TaskSubmissionRequest, Task>({
    code: async (request: TaskSubmissionRequest) => {
        const task = await taskStore.put.exec({
            state: 'queued',
            ...request
        });

        taskQueue.put.exec(task);

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
            uid = await containerRuntime.run.exec(t);
        } catch (e) {
            throw new Error(`Container runtime refused new task with ${e}`);
        }

        taskStore.put.exec({
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
    code: () => taskStore.list.exec()
});

export const apiListTasks = new Api<unknown, Task[]>({
    target: listTasksFunction
});

export const getTaskFunction = new Func<string, Task | undefined>({
    code: (id) => taskStore.get.exec(id)
});

export const apiGetTask = new Api<string, Task | undefined>({
    target: getTaskFunction
});

export const taskStateFunction = new Func<ContainerStateEvent, void>({
    code: async e => {
        const task = await taskStore
            .get.exec({ uid: e.uid });

        // not all images will be managed by us
        if (!task) {
            console.error('event', e, 'is not ours');
            return;
        }

        taskStore
            .put.exec({
                ...task,
                state: e.status
            });

        taskStateTopic.publish.exec(task);
    }
});

containerStateTopic.subscribe.localExec(taskStateFunction);
