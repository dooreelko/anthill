import path = require('path');
import fetch from 'node-fetch';
import { findBuildContextRoot } from "../tools";
import * as maxim from '../../anthill/main';

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
        console.log('Calling api', (listener as any).name || listener, thisDef.spec.path, fetchInit.body);

        return fetch(new URL(thisDef.spec.path, `http://${listener.host}:${listener.port}`).href, fetchInit)
            .then(r => r.status !== 204 && r.json())
            .then(r => r as TOut)
            .then(r => {
                console.error('Success calling API', thisDef.spec.path, r);

                return r;
            })
            .catch(e => {
                console.error('Error calling API', thisDef.spec.path, e);
                throw e;
            });
    }
}

export const apiServerBuildContext = () => {
    const contextRoot = findBuildContextRoot();

    console.error('*** build root', contextRoot);
    return {
        path: contextRoot,
        dockerfile: path.relative(contextRoot, path.join(__dirname, 'api-server.Dockerfile'))
    };
}

// export const build = (stack: TerraformStack, name: string) => {


//     return {
//         server,
//         serverPath: path
//             .relative(path.join(contextRoot, 'dist'), apiServerPath)
//             .replace(path.extname(apiServerPath), '')
//     };
// };
