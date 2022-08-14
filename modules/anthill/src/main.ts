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

export type QueueUid<TUid> = { queueUid: TUid };

export interface IQueue<T extends Object, TUid = string> {
    put: Api<T, void>;
    poll: Api<number | undefined, (T & QueueUid<TUid>)[]>;
    markDone: Api<TUid | TUid[], void>;
};

export const Queue = <T, TUid = string>() => Graduate<IQueue<T, TUid>>();

export interface IQueuePoller<T, TUid = string> {
    queue: IQueue<T, TUid>;
    poller: Func<T, void>;

    tick: () => void;
};

export const QueuePoller = <T>() => Graduate<IQueuePoller<T>>();

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

export type KeyValueEntryHistory<T> = (T & { when: Date })[];

export interface IKeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> {
    list: Api<void, T[]>;
    get: Api<{ id: TKey }, T | undefined>;
    find: Api<Partial<T>, T | undefined>;
    delete: Api<TKey, boolean>;
    put: Api<T, T>;
    history: Api<{ id: TKey }, KeyValueEntryHistory<T> | undefined>;
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
        runtimeRegistry().set(props.name, runner)
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

export type ContainerStateEvent<TLabels extends string> = {
    uid: string;
    status: DockerStates;
    message?: string;
    exitCode: number;
    labels?: Partial<Record<TLabels, string>>;
};

export type DockerTaskUid = string;

export type DockerRun<TLabels extends string> = {
    labels: Partial<Record<TLabels, string>>,
    image: string;
    cmd: string[];
};

export interface IContainerRuntime<TLabels extends string> {
    autoscaler: IAutoscaler;
    stateChangeTopic: ITopic<ContainerStateEvent<TLabels>>;

    run: Api<DockerRun<TLabels>, { uid: DockerTaskUid } | { error: any }>;
    logs: Api<{ uid: DockerTaskUid }, string[]>;
};

export const ContainerRuntime = <TLabels extends string>() => Graduate<IContainerRuntime<TLabels>>();

export * from './gradual';
export * from './runtime';