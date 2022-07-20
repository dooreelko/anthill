import * as maxim from '../../idw2c';

export class DockerQueue<T extends Object> extends maxim.Queue<T> {
    private theQueue = [] as T[];

    get apiName() { return `queue-${this.name}`; }

    constructor(private readonly name: string, port: number) {
        super();

        const putApi = new maxim.Api({
            target: new maxim.Func<T, void>({
                code: this.put
            })
        });

        const pollApi = new maxim.Api({
            target: new maxim.Func<undefined, T[]>({
                code: this.poll
            })
        });

        new maxim.ApiServer({
            name: this.apiName,
            listener: {
                port: port,
                apis: [
                    {
                        api: putApi,
                        spec: {
                            path: '/v1/put',
                            method: 'POST'
                        }
                    },
                    {
                        api: pollApi,
                        spec: {
                            path: '/v1/poll',
                            method: 'GET'
                        }
                    },
                ]
            }
        });
    }

    put = (elem: T) => {
        this.theQueue.push(elem);
    };

    poll = () => {
        return this.theQueue.length ? [this.theQueue.pop()!] : [];
    }
};