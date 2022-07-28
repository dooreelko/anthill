import path = require('path');
import fetch from 'node-fetch';
import { TerraformStack } from "cdktf";
import { Image } from "@cdktf/provider-docker";
import { findBuildContextRoot } from "../tools";
import { apiServerPath } from './app/main';
import * as maxim from '../../idw2c';

export class HttpApi<TIn, TOut> extends maxim.Api<TIn, TOut> {
    exec(arg: TIn): Promise<TOut> {
        const listener = maxim.ApiServer.getListenerByApiName(this.uid);
        const thisDef = listener?.apis.find(def => def.api.uid === this.uid);

        if (!thisDef) {
            throw new Error(`Failed finding self-api for ${this.uid} in ${JSON.stringify(listener)}`);
        }

        return fetch(new URL(thisDef.spec.path, `http://${listener.host}:${listener.port}`).href, {
            body: JSON.stringify(arg)
        })
            .then(r => r.json())
            .then(r => r as TOut);
    }
}

export const build = (stack: TerraformStack, name: string) => {
    const contextRoot = findBuildContextRoot();

    console.error('*** build root', contextRoot);

    const server = new Image(stack, `api-server-${name}`, {
        name: `dorc-api-server-${name}`,
        buildAttribute: {
            path: contextRoot,
            dockerfile: path.relative(contextRoot, path.join(__dirname, 'api-server.Dockerfile'))
        }
    });

    return {
        server,
        serverPath: path
            .relative(contextRoot, apiServerPath)
            .replace(path.extname(apiServerPath), '')
    };
};
