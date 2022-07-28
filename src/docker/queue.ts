import * as maxim from '../idw2c';
import { HttpApi } from './api-server/api-server';
import { DockerServerInit } from './tools';

export class DockerQueue<T extends Object> implements maxim.Queue<T> {
    private theQueue = [] as T[];

    get apiName() { return `queue-${this.init.name}`; }

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
                        api: this.poll,
                        spec: {
                            path: '/v1/poll',
                            method: 'GET'
                        }
                    },
                ]
            }
        });
    }

    private _put = (elem: T) => {
        this.theQueue.push(elem);
    };

    private _poll = () => {
        return this.theQueue.length ? [this.theQueue.pop()!] : [];
    };

    put = new HttpApi({
        target: new maxim.Func<T, void>({
            code: this._put
        })
    });

    poll = new HttpApi({
        target: new maxim.Func<number | undefined, T[]>({
            code: this._poll
        })
    });
};