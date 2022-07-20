import { randomUUID } from 'crypto';
import * as maxim from '../idw2c';

export class DockerKeyValueStore<TKey extends string, T extends { id?: TKey } = { id?: TKey }> extends maxim.KeyValueStore<TKey, T> {
    private theStore = new Map<TKey, T>();

    get apiName() { return `kv-${this.name}`; }

    constructor(public readonly name: string, public readonly port: number) {
        super({});

        const listApi = new maxim.Api({
            target: new maxim.Func<void, T[]>({
                code: this.list
            })
        });
        const getApi = new maxim.Api({
            target: new maxim.Func<TKey | Partial<T>, T | undefined>({
                code: this.get
            })
        });
        const putApi = new maxim.Api({
            target: new maxim.Func<T, T>({
                code: this.put
            })
        });
        const deleteApi = new maxim.Api({
            target: new maxim.Func<TKey, void>({
                code: this.delete
            })
        });

        new maxim.ApiServer({
            name: this.apiName,
            listener: {
                port,
                apis: [
                    {
                        api: putApi,
                        spec: {
                            path: '/v1/put',
                            method: 'POST'
                        }
                    },
                    {
                        api: getApi,
                        spec: {
                            path: '/v1/get',
                            method: 'GET'
                        }
                    },
                    {
                        api: listApi,
                        spec: {
                            path: '/v1/list',
                            method: 'GET'
                        }
                    },
                    {
                        api: deleteApi,
                        spec: {
                            path: '/v1/delete',
                            method: 'DELETE'
                        }
                    },
                ]
            }
        });
    }

    list = () => Object.values(this.theStore) as T[];

    get = (criteria: TKey | Partial<T>) => {
        if (typeof criteria === 'string') {
            return this.theStore.get(criteria);
        }

        const unwrappedFilter = Object.entries(criteria) as [string, T][];

        return [...this.theStore.values()]
            .find((el: Record<string, any>) => unwrappedFilter.every(([k, v]) => el[k] && el[k] === v));
    }

    delete = (id: TKey) => this.theStore.delete(id);

    put = (elem: T) => {
        const id = elem.id || randomUUID() as TKey;
        const newOne = {
            ...elem,
            id
        };

        this.theStore.set(id, newOne);

        return newOne;
    };

};