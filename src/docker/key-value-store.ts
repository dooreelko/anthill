import { randomUUID } from 'crypto';
import * as maxim from '../idw2c';
import { HttpApi } from './api-server/api-server';
import { DockerServerInit } from './tools';

export class DockerKeyValueStore<TKey extends string, T extends { id?: TKey } = { id?: TKey }> implements maxim.KeyValueStore<TKey, T> {
    private theStore = new Map<TKey, T>();

    get apiName() { return `kv-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit) {
        new maxim.ApiServer({
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
                        api: this.get,
                        spec: {
                            path: '/v1/get',
                            method: 'GET'
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
                            path: '/v1/delete',
                            method: 'DELETE'
                        }
                    },
                ]
            }
        });
    }

    _list = () => Object.values(this.theStore) as T[];

    _get = (criteria: TKey | Partial<T>) => {
        if (typeof criteria === 'string') {
            return this.theStore.get(criteria);
        }

        const unwrappedFilter = Object.entries(criteria) as [string, T][];

        return [...this.theStore.values()]
            .find((el: Record<string, any>) => unwrappedFilter.every(([k, v]) => el[k] && el[k] === v));
    }

    _delete = (id: TKey) => this.theStore.delete(id);

    _put = (elem: T) => {
        const id = elem.id || randomUUID() as TKey;
        const newOne = {
            ...elem,
            id
        };

        this.theStore.set(id, newOne);

        return newOne;
    };

    list = new HttpApi({
        target: new maxim.Func<void, T[]>({
            code: this._list
        })
    });

    get = new HttpApi({
        target: new maxim.Func<TKey | Partial<T>, T | undefined>({
            code: this._get
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
};