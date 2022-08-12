
import {
    DockerStates, Queue, KeyValueStore,
    Autoscaler, ContainerStateEvent, ContainerRuntime,
    Func, Api, TaskUid, QueuePoller, Topic, EntryHistory
} from "@anthill/core";

/** SOLUTION DESIGN */

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

export type DockerLabels = 'dorcUid';

// Specialized gradual constructor types
const ContainerStateEventTopic = Topic<ContainerStateEvent<DockerLabels>>();

const TaskTopic = Topic<Task>();

const TaskQueue = Queue<Task>();

const TaskQueuePoller = QueuePoller<Task>();

const TaskKeyValueStore = KeyValueStore<string, Task>();

const DorcAutoscaler = Autoscaler();

const DorcContainerRuntime = ContainerRuntime<DockerLabels>();

// Architectural entities

export const taskQueue = new TaskQueue();

export const taskStore = new TaskKeyValueStore();

export const scaler = new DorcAutoscaler();

export const containerStateTopic = new ContainerStateEventTopic();

export const taskStateTopic = new TaskTopic();

export const containerRuntime = new DorcContainerRuntime({
    stateChangeTopic: containerStateTopic,
    autoscaler: scaler
});

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
            const response = await containerRuntime.run.exec({
                labels: {
                    dorcUid: t.id || '<NOIDYET>',
                },
                ...t
            });

            if ('error' in response) {
                throw response.error;
            }

            uid = response.uid;
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

export const taskQueuePoller = new TaskQueuePoller({
    queue: taskQueue,
    poller: runTaskFunction
});

export const listTasksFunction = new Func<unknown, Task[]>({
    code: () => taskStore.list.exec()
});

export const apiListTasks = new Api<unknown, Task[]>({
    target: listTasksFunction
});

export const getTaskFunction = new Func<{ id: string }, Task | undefined>({
    code: (id) => taskStore.get.exec(id)
});

export const apiGetTask = new Api<{ id: string }, Task | undefined>({
    target: getTaskFunction
});

export const apiGetTaskHistory = new Api<{ id: string }, EntryHistory<Task> | undefined>({
    target: new Func<{ id: string }, EntryHistory<Task> | undefined>({
        code: (id) => taskStore.history.exec(id)
    })
});

export const apiGetTaskLogs = new Api<{ id: string }, string[]>({
    target: new Func<{ id: string }, string[]>({
        code: async (id) => {
            const task = await taskStore.get.exec(id);

            const uid = task?.uid;
            if (uid) {
                return containerRuntime.logs.exec({ uid });
            }

            const history = await taskStore.history.exec(id);

            const uidFromHistory = history?.find(el => !!el.uid)?.uid;
            if (uidFromHistory) {
                return containerRuntime.logs.exec({ uid: uidFromHistory });
            }

            throw new Error(`Failed finding task's uid from ${JSON.stringify(id)}, ${JSON.stringify(task)}, ${JSON.stringify(history)}`);
        }
    })
});

export const taskStateFunction = new Func<ContainerStateEvent<DockerLabels>, void>({
    code: async e => {
        const announce = async (newTask: Task) => {
            console.log('will save and announce', newTask);

            const proms = await Promise.allSettled([
                taskStore.put.exec(newTask),
                taskStateTopic.publish.exec(newTask)
            ]);

            console.log('saved and announced', newTask, proms);
        };

        try {

            console.log('finding', e);
            const task = await taskStore
                .find.exec({ uid: e.uid });

            console.log('got task', task);

            // not all images will be managed by us or a race condition
            if (!task) {
                /**
                 * This could be our event but fired before the docker runner
                 * was notified about container - run finished after container:die
                 * was fired
                 */
                const maybeDorcUid = e.labels?.dorcUid;

                if (!maybeDorcUid) {
                    console.error('event', e, 'is not ours');
                    return;
                }

                console.log('looking for zombie', maybeDorcUid);
                const task = await taskStore
                    .get.exec({ id: maybeDorcUid });

                console.log('got task', task);

                if (!task) {
                    console.error('event', e, 'IS ours but not in the store O_O');
                    return;
                }
                await announce({
                    ...task,
                    state: e.status
                });
            } else {
                await announce({
                    ...task,
                    state: e.status
                });
            }
        } catch (e) {
            console.error('failed updating task', e);
        }

    }
});

containerStateTopic.subscribe.localExec(taskStateFunction);
