import { randomUUID } from 'crypto';
import * as maxim from '@anthill/core';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export class DockerKeyValueStore<TKey extends string, T extends { id?: TKey } = { id?: TKey }>
    extends maxim.Selfed<maxim.IKeyValueStore<TKey, T>>
    implements maxim.IKeyValueStore<TKey, T>, maxim.Archetype {
    private theStore = new Map<TKey, T>();
    private theStoreHistory = new Map<TKey, (T & { when: Date })[]>();

    get apiName() { return `kv-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit) {
        super();

        const server: maxim.ApiServerProps = {
            name: this.apiName,
            listener: {
                host: 'localhost',
                ...this.init,
                apis: [
                    {
                        api: this.put,
                        spec: {
                            path: '/v1/put',
                            method: 'POST'
                        }
                    },
                    {
                        api: this.find,
                        spec: {
                            path: '/v1/find',
                            method: 'POST'
                        }
                    },
                    {
                        api: this.list,
                        spec: {
                            path: '/v1/list',
                            method: 'GET'
                        }
                    },
                    {
                        api: this.delete,
                        spec: {
                            path: '/v1/task',
                            method: 'DELETE'
                        }
                    },
                    {
                        api: this.get,
                        spec: {
                            path: '/v1/task/{id}',
                            method: 'GET'
                        }
                    },
                    {
                        api: this.history,
                        spec: {
                            path: '/v1/task/{id}/history',
                            method: 'GET'
                        }
                    },
                ]
            }
        };

        new maxim.ApiServer(server, () => run(server));
    }
    kind = 'Docker KV store';

    _list = () => [...this.theStore.values()];


    _get = (key: { id: TKey }) => this.theStore.get(key.id);

    _history = (key: { id: TKey }) => {
        const sorted = [...(this.theStoreHistory
            .get(key.id) || [])];

        return sorted.sort((a, b) => a.when.getTime() - b.when.getTime());
    }

    _find = (criteria: TKey | Partial<T>) => {
        console.log('finding', criteria);
        if (typeof criteria === 'string') {
            console.log('eez a string', criteria);
            return this.theStore.get(criteria);
        }

        const unwrappedFilter = Object.entries(criteria) as [string, T][];

        const found = [...this.theStore.values()]
            .find((el: Record<string, any>) => unwrappedFilter.every(([k, v]) => !!el[k] && el[k] === v));

        console.log('for', unwrappedFilter, 'found', found, 'in', this.theStore);
        return found;
    }

    _delete = (id: TKey) => this.theStore.delete(id);

    _put = (elem: T) => {
        const id = elem.id || randomUUID() as TKey;
        const newOne = {
            ...elem,
            id
        };

        this.theStore.set(id, newOne);

        if (!this.theStoreHistory.has(id)) {
            this.theStoreHistory.set(id, []);
        }

        this.theStoreHistory.get(id)?.push({
            ...newOne,
            when: new Date()
        });

        return newOne;
    };

    list = new HttpApi<void, T[]>({
        target: new maxim.Func<void, T[]>({
            code: this._list
        })
    });

    get = new HttpApi({
        target: new maxim.Func<{ id: TKey }, T | undefined>({
            code: this._get
        })
    });

    find = new HttpApi({
        target: new maxim.Func<Partial<T>, T | undefined>({
            code: this._find
        })
    });

    put = new HttpApi({
        target: new maxim.Func<T, T>({
            code: this._put
        })
    });

    delete = new HttpApi({
        target: new maxim.Func<TKey, boolean>({
            code: this._delete
        })
    });

    history = new HttpApi({
        target: new maxim.Func<{ id: TKey }, maxim.KeyValueEntryHistory<T> | undefined>({
            code: this._history
        })
    });
};