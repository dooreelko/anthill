import { randomUUID } from "crypto";
import { Graduate } from "./gradual";
import { runtimeRegistry } from "./runtime";

/**
 * Marker interface for anthill entities
 */
export interface Archetype {
}

export class Api<TIn, TOut, QueueT extends TIn & Object = TIn & Object> implements Archetype {
    public readonly uid: string;

    constructor(public readonly init: {
        target: Func<TIn, TOut> | IQueue<QueueT>;
    }) {
        this.uid = randomUUID();
    }

    public kind = 'API';

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

export interface IQueue<T extends Object, TUid = string> extends Archetype {
    put: Api<T, void>;
    poll: Api<number | undefined, (T & QueueUid<TUid>)[]>;
    markDone: Api<TUid | TUid[], void>;
};

export const Queue = <T extends Object, TUid = string>() => Graduate<IQueue<T, TUid>>({
});

export interface IQueuePoller<T extends Object, TUid = string> extends Archetype {
    queue: IQueue<T, TUid>;
    poller: Func<T, void>;

    tick: () => void;
};

export const QueuePoller = <T extends Object>() => Graduate<IQueuePoller<T>>();

export interface ITopic<T> extends Archetype {
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

export interface IKeyValueStore<TKey = string, T extends { id?: TKey } = { id?: TKey }> extends Archetype {
    list: Api<void, T[]>;
    get: Api<{ id: TKey }, T | undefined>;
    find: Api<Partial<T>, T | undefined>;
    delete: Api<TKey, boolean>;
    put: Api<T, T>;
    history: Api<{ id: TKey }, KeyValueEntryHistory<T> | undefined>;
};

export const KeyValueStore = <TKey = string, TVal extends { id?: TKey } = { id?: TKey }>() => Graduate<IKeyValueStore<TKey, TVal>>();

export class Func<TIn = undefined, TOut = void> implements Archetype {
    constructor(public init: {
        code: (input: TIn) => TOut | Promise<TOut>
    }) { };

    public kind = 'Function';

    exec = (input: TIn) => this.init.code(input);
};

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'OPTIONS' | 'DELETE';

export type ApiContext = {
    path: string;
    method: HttpMethod;
};

// TODO: this is leaky - a lot of assumptions about HTTP
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

export class ApiServer implements Archetype {
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

    constructor(public props: ApiServerProps, runner?: () => void) {
        runtimeRegistry().set(props.name, runner ?? (() => { }))
        ApiServer.registry.set(props.name, props);
        props.listener.apis
            .map(def => ({ id: def.api.uid, apiName: props.name }))
            .map(({ id, apiName }) => ApiServer.endpointRegistry.set(id, apiName));
    }
};


export interface IAutoscaler extends Archetype {
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

export interface IContainerRuntime<TLabels extends string> extends Archetype {
    autoscaler: IAutoscaler;
    stateChangeTopic: ITopic<ContainerStateEvent<TLabels>>;

    run: Api<DockerRun<TLabels>, { uid: DockerTaskUid } | { error: any }>;
    logs: Api<{ uid: DockerTaskUid }, string[]>;
};

export const ContainerRuntime = <TLabels extends string>() => Graduate<IContainerRuntime<TLabels>>();

export * from './gradual';
export * from './runtime';
export * from './tools';
