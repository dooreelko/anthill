import * as maxim from '../anthill/main';
import { HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export class DockerTopic<T extends Object> implements Partial<maxim.ITopic<T>> {
    get apiName() { return `topic-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit & { parent: maxim.ITopic<T> & maxim.Extendo<maxim.ITopic<T>> }) {
        init.parent.extend(this);

        const server: maxim.ApiServerProps = {
            name: this.apiName,
            listener: {
                host: 'localhost',
                ...this.init,
                apis: [
                    {
                        api: this.subscribe,
                        spec: {
                            path: '/v1/subscribe',
                            method: 'POST'
                        }
                    },
                    {
                        api: this.publish,
                        spec: {
                            path: '/v1/publish',
                            method: 'POST'
                        }
                    },
                ]
            }
        };

        new maxim.ApiServer(server, () => run(server));
    }

    private _subscribe = (input: maxim.Api<T, void> | maxim.Func<T, void>) => {
        this.init.parent.theSubs.push(input);
    };

    subscribe = new HttpApi({
        target: new maxim.Func<maxim.Api<T, void> | maxim.Func<T, void>, void>({
            code: this._subscribe
        })
    });

    private _publish = (elem: T) => {
        console.log('Got new message!', elem);
        this.init.parent.theSubs.map(sub => sub.exec(elem));
    }

    publish = new HttpApi({
        target: new maxim.Func<T, void>({
            code: this._publish
        })
    });
};