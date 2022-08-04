import { randomUUID } from "crypto";
import { runtimeRegistry } from "./runtime";

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

export class Buildup<T extends object> implements ProxyHandler<T> {
    private instanceSofar: Partial<T> = {};
    constructor(initialParts?: Partial<T>) {
        this.instanceSofar = { ...initialParts };
    }

    apply?(target: T, thisArg: any, argArray: any[]): any {

    }

}

export class Api<TIn, TOut> {
    public readonly uid: string;

    constructor(public readonly init: {
        target: Func<TIn, TOut> | Queue<TIn>;
    }) {
        this.uid = randomUUID();
    }

    exec(arg: TIn): TOut | Promise<TOut> {
        throw new Error('Remote Api execution not implemented, apparently.');
    }

    localExec(arg: TIn): TOut | Promise<TOut> {
        const target = this.init.target;
        if (target instanceof Func) {
            return target.init.code(arg);
        }

        throw new Error('Unsupported Api target');
    }
};

export interface Queue<T extends Object> {
    put: Api<T, void>;
    poll: Api<number | undefined, T[]>;
};

export class QueuePoller<T> {
    constructor(private init: {
        queue: Lazy<Queue<T>>;
        poller: Func<T, void>;
    }) { };
};

export const notImplementedApi = <T>() => new Api<T, void>({
    target: new Func({
        code: (dest: T) => { throw new Error('This API has no implementation yet.') }
    })
});

export interface ITopic<T> {
    readonly theSubs: (Api<T, void> | Func<T, void>)[];

    subscribe: Api<Api<T, void> | Func<T, void>, void>;

    publish: Api<T, void>;
}

export class ArchTopic<T> {
    public readonly theSubs: (Api<T, void> | Func<T, void>)[] = [];

    subscribe = new Api<Api<T, void> | Func<T, void>, void>({
        target: new Func({
            code: (dest: Api<T, void> | Func<T, void>) => { this.theSubs.push(dest) }
        })
    });
}

export class ProxyTopic<T> implements ITopic<T> {
    private implementations: Partial<ITopic<T>>[] = [];

    constructor(init?: Partial<ITopic<T>>) {
        if (init) {
            this.implementations.push(init);
        }

        return new Proxy(this, {
            get(target: ProxyTopic<T>, p: string | symbol, receiver: any): any {
                // console.error('getting', p, 'from', target);
                const impl = target.implementations.find(el => Object.hasOwn(el, p)) || target;
                // console.error('got', impl);
                if (!impl) {
                    throw new Error(`Implementation for '${String(p)}' has not been provided yet.`);
                }

                return (impl as any)[p];
            }
        });
    }

    extend(whatWith: Partial<ITopic<T>>): void {
        this.implementations = [
            whatWith,
            ...this.implementations,
        ];
    }

    readonly theSubs: (Api<T, void> | Func<T, void>)[] = [];

    subscribe = notImplementedApi<Api<T, void> | Func<T, void>>();

    publish = notImplementedApi<T>();
};

export interface KeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> {
    list: Api<void, T[]>;
    get: Api<TKey | Partial<T>, T | undefined>;
    delete: Api<TKey, boolean>;
    put: Api<T, T>;
};

export class Func<TIn = undefined, TOut = void>  {
    constructor(public init: {
        code: (input: TIn) => TOut | Promise<TOut>
    }) { };

    exec = (input: TIn) => this.init.code(input);
};

export type ApiContext = {
    path: string;
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'OPTIONS' | 'DELETE'
};

export type ApiServerListener = {
    host: string;
    port: number;
    apis: {
        api: Api<any, any>;
        spec: ApiContext;
    }[];
};

export type ApiServerProps = {
    name: string;
    listener: ApiServerListener;
};

export class ApiServer {
    static registry = new Map<string, ApiServerProps>;
    static endpointRegistry = new Map<string, string>;

    static getListenerByApiName = (uid: string) => {
        const entry = this.endpointRegistry.get(uid);
        if (!entry) {
            throw new Error(`No individual api registered for uid ${uid}.`);
        }

        if (!this.registry.has(entry)) {
            throw new Error(`No api registered for ${entry} from uid ${uid} api.`);
        }

        const props = this.registry.get(entry);

        if (!props) {
            throw new Error(`Failed finding listener for ${uid}`);
        }

        return props.listener;
    }

    constructor(public props: ApiServerProps, runner: () => void) {
        runtimeRegistry.set(props.name, runner)
        ApiServer.registry.set(props.name, props);
        props.listener.apis
            .map(def => ({ id: def.api.uid, apiName: props.name }))
            .map(({ id, apiName }) => ApiServer.endpointRegistry.set(id, apiName));
    }
};


export abstract class Autoscaler {
    constructor(private init?: {}) { }

    abstract get nodeCount(): number;
    abstract set nodeCount(newCount: number);

    abstract get idleNodeCount(): number;
};

export type DockerStates = 'created' | 'restarting' | 'running' | 'paused' | 'exited' | 'dead';

export type ContainerStateEvent = {
    uid: string;
    status: DockerStates;
    message?: string;
    exitCode: number;
};

export type TaskUid = string;

export type ContainerRuntimeInit = {
    autoscaler: Autoscaler;
    stateChangeTopic: ITopic<ContainerStateEvent>;
};

export type DockerRun = {
    image: string;
    cmd: string[];
};

export abstract class ContainerRuntime {
    constructor(public init: ContainerRuntimeInit) { };

    abstract run: Api<DockerRun, TaskUid>;
};
