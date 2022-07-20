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

export class Api<TIn, TOut> {
    constructor(private init: {
        target: Func<TIn, TOut> | Queue<TIn>;
    }) { }

    run(arg: TIn): TOut {
        const target = this.init.target;
        if (target instanceof Func) {
            return target.init.code(arg);
        }

        throw new Error('Unsupported Api target');
    }
};

export abstract class Queue<T extends Object> {
    constructor(private init?: {
    }) { };

    abstract put: (elem: T) => void;
    abstract poll(maxItems?: number): T[];
};

export class QueuePoller<T> {
    constructor(private init: {
        queue: Lazy<Queue<T>>;
        poller: Func<T, void>;
    }) { };
};

export abstract class Topic<T> {
    constructor(private init: {
    }) { }

    abstract subscribe: (addr: string | Func<T, unknown>) => void;
    abstract publish: (what: T) => void;
};

export abstract class KeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> {
    constructor(private init: {
    }) { };

    abstract list: () => T[];
    abstract get: (criteria: TKey | Partial<T>) => T | undefined;
    abstract delete: (id: TKey) => void;
    abstract put: (elem: T) => T;
};

export class Func<TIn = undefined, TOut = void>  {
    constructor(public init: {
        code: (input: TIn) => TOut
    }) { };
};

export type ApiContext = {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'OPTIONS' | 'DELETE'
};

type ApiServerListener = {
    port: number;
    apis: {
        api: Api<any, any>;
        spec: ApiContext;
    }[];
};

type ApiServerProps = {
    name: string;
    listener: ApiServerListener;
};

export class ApiServer {
    static registry: Record<string, ApiServerListener> = {};

    constructor(public props: ApiServerProps) {
        ApiServer.registry[props.name] = props.listener;
    }
};


export abstract class Autoscaler {
    constructor(private init: {}) { }

    abstract get nodeCount(): number;
    abstract set nodeCount(newCount: number);

    abstract get idleNodeCount(): number;
};

export type DockerStates = 'created' | 'restarting' | 'running' | 'paused' | 'exited' | 'dead';

export type ContainerStateEvent = {
    uid: string;
    status: DockerStates;
    exitCode: number;
};

export type TaskUid = string;

export abstract class ContainerRuntime {
    constructor(private init: {
        autoscaler: Autoscaler;
        stateChangeTopic: Topic<ContainerStateEvent>;
    }) { };

    abstract run: (command: string) => TaskUid;
};
