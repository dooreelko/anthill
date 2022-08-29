import path = require('path');
import fetch from 'node-fetch';
import * as maxim from '@anthill/core';
import { enrichPath } from './app/main';

export const methodWithBody = (method: maxim.ApiContext['method']) =>
    method !== 'GET'
    && method !== 'HEAD'
    && method !== 'OPTIONS';

export const stringifyOnDemand = (arg: unknown) => typeof arg === 'string' ? arg : JSON.stringify(arg);

export class HttpApi<TIn, TOut> extends maxim.Api<TIn, TOut> {
    exec(arg: TIn): Promise<TOut> {
        const listener = maxim.ApiServer.getListenerByApiName(this.uid);
        const thisDef = listener?.apis.find(def => def.api.uid === this.uid);

        if (!thisDef) {
            throw new Error(`Failed finding self-api for ${this.uid} in ${JSON.stringify(listener)}`);
        }

        const fetchInit = {
            method: thisDef.spec.method,
            ...(
                !methodWithBody(thisDef.spec.method) ? {} : {
                    body: stringifyOnDemand(arg),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            )
        };

        const inputObject = (typeof arg === 'object' ? arg : {}) as Record<string, unknown>;
        const enrichedPath = enrichPath(thisDef.spec.path, inputObject);

        console.log('Enriched', thisDef.spec.path, 'using', arg, 'into', enrichedPath);
        console.log('Calling api', (listener as any).name || listener, enrichedPath, fetchInit.body);

        return fetch(new URL(enrichedPath, `http://${listener.host}:${listener.port}`).href, fetchInit)
            .then(r => r.status !== 204 && r.json())
            .then(r => r as TOut)
            .then(r => {
                console.error('Success calling API', enrichedPath, r);

                return r;
            })
            .catch(e => {
                console.error('Error calling API', enrichedPath, e);
                throw e;
            });
    }
}

/**
 * Docker build context (during synth) should be project's root 
 * it could be also dist but then dockerfiles will need to be copied there
 * 
 * @param startPath path to start from and go up searching for package.json
 * @param dockerFile path to the dockerfile, relative to startPath
 * @returns 
 */
export const apiServerBuildContext = (startPath: string, dockerFile: string) => {
    const contextRoot = maxim.findBuildContextRoot(startPath);

    console.error('*** build root', contextRoot);
    return {
        path: contextRoot,
        dockerfile: path.relative(contextRoot, path.join(startPath, dockerFile))
    };
}
