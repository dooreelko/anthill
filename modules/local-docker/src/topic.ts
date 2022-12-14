import * as maxim from '@arinoto/core';
import { DockerApiServerProps, HttpApi } from './api-server/api-server';
import { run } from './api-server/app/main';
import { DockerServerInit } from './tools';

export type Execable<T> = maxim.Api<T, void> | maxim.Func<T, void>;

export class DockerTopic<T extends Object> extends maxim.Selfed<maxim.ITopic<T>> implements Partial<maxim.ITopic<T>> {
    get apiName() { return `topic-${this.init.name}`; }

    constructor(public readonly init: DockerServerInit) {
        super();

        const server: DockerApiServerProps = {
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

    private _subscribe = (input: Execable<T>) => {
        this.self.theSubs.push(input);
    };

    subscribe = new HttpApi({
        target: new maxim.Func<Execable<T>, void>({
            code: this._subscribe
        })
    });

    private _publishOne = async (elem: T, sub: Execable<T>) => {
        try {
            await sub.exec(elem);
        } catch (e) {
            // TODO: remove sub from the list at some point?
            console.error('Sub', sub, 'is sus', e);
            return e;
        }
    }

    private _publish = (elem: T) => {
        console.log('Got new message!', elem, 'Will publish to', this.self.theSubs.length);
        Promise.all(this.self.theSubs.map(sub => this._publishOne(elem, sub)));
    }

    publish = new HttpApi({
        target: new maxim.Func<T, void>({
            code: this._publish
        })
    });
};