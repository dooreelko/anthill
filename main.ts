export class Lazy<T> {
    private _instance?: T;

    constructor(private init?: (inst: T) => void) { }

    get instance(): T {
        if (!this._instance) {
            throw new Error(`Lazy instance hasn't been set yet`);
        }
        return this._instance;
    };

    set instance(val: T) {
        this._instance = val;
        this.init && this.init(this._instance);
    };
}

export type ApiContext = {};

export type Api<TIn = unknown, TOut = unknown> = {
    target: Func<TIn, TOut> | Queue<TIn>;
};

export type Queue<T = unknown> = {
    put: (elem: T) => void;
    poll: () => T;
};

export type QueuePoller<T> = {
    queue: Lazy<Queue<T>>;
    poller: Func<T>;
};

export type Topic<T> = {
    subscribe: (addr: string | Func<T, unknown>) => void;
    publish: (what: T) => void;
};

export type KeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> = {
    list: () => T[];
    get: (id: TKey) => T;
    delete: (id: TKey) => void;
    put: (elem: T) => T;
};

export type Func<TIn = unknown, TOut = unknown> = {
    code: (input: TIn) => TOut
};

export type Autoscaler = {
    get nodeCount(): number;
    set nodeCount(newCount: number);

    get idleNodeCount(): number;
};

export type DockerStates = 'created' | 'restarting' | 'running' | 'paused' | 'exited' | 'dead';

export type ContainerStateEvent = {
    uid: string;
    status: DockerStates;
    exitCode: number;
};

export type TaskUid = string;

export type ContainerRuntime = {
    autoscaler: Autoscaler;
    stateChangeTopic: Topic<ContainerStateEvent>;
    run: (command: string) => TaskUid;
};

/** DESIGN */

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

const taskQueue = new Lazy<Queue<Task>>();

const taskStore = new Lazy<KeyValueStore<string, Task>>();

const scaler = new Lazy<Autoscaler>();

const containerStateTopic = new Lazy<Topic<ContainerStateEvent>>();

const taskStateTopic = new Lazy<Topic<Task>>();

const containerRuntime = new Lazy<ContainerRuntime>(
    (instance: ContainerRuntime) => {
        instance.autoscaler = scaler.instance;
        instance.stateChangeTopic = containerStateTopic.instance;
    });

const submitTaskFunction: Func<TaskSubmissionRequest, Task> = {
    code: (request: TaskSubmissionRequest) => {
        const task = taskStore.instance.put({
            state: 'queued',
            command: request.command
        });

        taskQueue.instance.put(task);

        return task;
    }
};

const apiRunTask: Api<TaskSubmissionRequest, Task> = {
    target: submitTaskFunction
};

const runTaskFunction: Func<Task> = {
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
};

const taskQueuePoller: QueuePoller<Task> = {
    queue: taskQueue,
    poller: runTaskFunction
};

const listTasksFunction: Func<unknown, Task[]> = {
    code: () => taskStore.instance.list()
};

const apiListTasks: Api<unknown, Task[]> = {
    target: listTasksFunction
};

const getTaskFunction: Func<string, Task> = {
    code: (id) => taskStore.instance.get(id)
};

const apiGetTask: Api<string, Task> = {
    target: getTaskFunction
};

const taskStateFunction: Func<ContainerStateEvent, void> = {
    code: (e) => {
        const task = taskStore
            .instance
            .list()
            .find(t => t.uid === e.uid);

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
};

/** IMPL */

export type AwsLoadBalancer = {
    listener: {
        port: number;
        apis: {
            api: Api;
            spec: ApiContext;
        }[];
    }
};

const loadBalancer: AwsLoadBalancer = {
    listener: {
        port: 443,
        apis: [
            {
                api: apiRunTask,
                spec: {
                    method: 'POST',
                    path: 'v1/tasks/run'
                },
            },
            {
                api: apiListTasks,
                spec: {
                    method: 'GET',
                    path: 'v1/tasks'
                },
            }
        ]
    }
};

