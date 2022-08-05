import * as maxim from '../anthill/main';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export class DockerQueue<T extends Object> extends maxim.Selfed<maxim.IQueue<T>> implements maxim.IQueue<T> {
    private theQueue = [] as T[];

    get apiName() { return `queue-${this.init.name}`; }

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
                        api: this.poll,
                        spec: {
                            path: '/v1/poll',
                            method: 'GET'
                        }
                    },
                ]
            }
        };

        new maxim.ApiServer(server, () => run(server));
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