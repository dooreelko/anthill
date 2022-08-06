import { randomUUID } from 'crypto';
import * as maxim from '../anthill/main';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export type DockerQueueInit = {
    // number of seconds to keep the item hidden after being polled
    itemTimeout: number;

    // run something in the same process as the queue
    coProcessInit?: () => void
};

export class DockerQueue<T extends Object> extends maxim.Selfed<maxim.IQueue<T>> implements Partial<maxim.IQueue<T>> {
    private theQueue = [] as (T & maxim.QueueUid<string>)[];
    private theDones = new Set<string>();

    get apiName() { return `queue-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit & DockerQueueInit) {
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

        new maxim.ApiServer(server, () => {
            this.init.coProcessInit && this.init.coProcessInit();
            run(server)
        });
    }

    private _put = (elem: T) => {
        this.theQueue.push({
            queueUid: randomUUID(),
            ...elem
        });
    };

    private _poll = (num?: number) => {
        const inFlight = this.theQueue.splice(0, num || 1);
        setTimeout(() => {
            const notDones = inFlight.filter(el => !this.theDones.has(el.queueUid));

            this.theQueue.push(...notDones);
            console.log('These guys go back to the queue', notDones);

            inFlight
                .map(el => el.queueUid)
                .filter(uid => this.theDones.has(uid))
                .map(uid => this.theDones.delete(uid))

        }, this.init.itemTimeout);

        return inFlight;
    };

    private _markDone = (uid: string | string[]) => {
        (typeof uid === 'string' ? [uid] : uid).map(uid => this.theDones.add(uid));
        console.log('Dones now are', this.theDones);
    }

    put = new HttpApi({
        target: new maxim.Func<T, void>({
            code: this._put
        })
    });

    poll = new HttpApi({
        target: new maxim.Func<number | undefined, (T & maxim.QueueUid<string>)[]>({
            code: this._poll
        })
    });

    markDone = new HttpApi({
        target: new maxim.Func<string | string[], void>({
            code: this._markDone
        })
    });

};
