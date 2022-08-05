import { randomUUID } from "crypto";
import { Graduate } from "./gradual";
import { runtimeRegistry } from "./runtime";

export class Api<TIn, TOut> {
    public readonly uid: string;

    constructor(public readonly init: {
        target: Func<TIn, TOut> | IQueue<TIn>;
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

export interface IQueue<T extends Object> {
    put: Api<T, void>;
    poll: Api<number | undefined, T[]>;
};

export const Queue = <T>() => Graduate<IQueue<T>>();

export class QueuePoller<T> {
    constructor(private init: {
        queue: IQueue<T>;
        poller: Func<T, void>;
    }) { };
};

export interface ITopic<T> {
    readonly theSubs: (Api<T, void> | Func<T, void>)[];

    subscribe: Api<Api<T, void> | Func<T, void>, void>;

    publish: Api<T, void>;
}

export class ArchTopic<T> implements Partial<ITopic<T>> {
    theSubs = [] as (Api<T, void> | Func<T, void>)[];

    subscribe = new Api<Api<T, void> | Func<T, void>, void>({
        target: new Func({
            code: (dest: Api<T, void> | Func<T, void>) => { this.theSubs.push(dest) }
        })
    })
}

export const Topic = <T>() => Graduate<ITopic<T>>(new ArchTopic<T>());

export interface IKeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> {
    list: Api<void, T[]>;
    get: Api<TKey | Partial<T>, T | undefined>;
    delete: Api<TKey, boolean>;
    put: Api<T, T>;
};

export const KeyValueStore = <TKey, TVal>() => Graduate<IKeyValueStore<TKey, TVal>>();

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


export interface IAutoscaler {
    get nodeCount(): number;
    set nodeCount(newCount: number);

    get idleNodeCount(): number;
};

export const Autoscaler = () => Graduate<IAutoscaler>();

export type DockerStates = 'created' | 'restarting' | 'running' | 'paused' | 'exited' | 'dead';

export type ContainerStateEvent = {
    uid: string;
    status: DockerStates;
    message?: string;
    exitCode: number;
};

export type TaskUid = string;

export type ContainerRuntimeInit = {
    autoscaler: IAutoscaler;
    stateChangeTopic: ITopic<ContainerStateEvent>;
};

export type DockerRun = {
    image: string;
    cmd: string[];
};

export interface IContainerRuntime {
    autoscaler: IAutoscaler;
    stateChangeTopic: ITopic<ContainerStateEvent>;

    run: Api<DockerRun, TaskUid>;
};

export class ArchContainerRuntime implements Partial<IContainerRuntime> {
    stateChangeTopic?: ITopic<ContainerStateEvent>;
    scaler?: IAutoscaler;
}

export const ContainerRuntime = () => Graduate<IContainerRuntime>(new ArchContainerRuntime());

export * from './gradual';