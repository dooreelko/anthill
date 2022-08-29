import { ApiServer, HttpMethod } from '@anthill/core';
import './aws-architecture';
import { buildRouteKey } from './aws/tools';

const runtimeToRun = process.env.ANTHILL_RUNTIME;

if (!runtimeToRun) {
    throw new Error('process.env.ANTHILL_RUNTIME is empty - cannot run.');
}

const server = ApiServer.registry.get(runtimeToRun);

if (!server) {
    throw new Error(`Api server registry has no entry for ${runtimeToRun} from ${process.env.ANTHILL_RUNTIME ?? ''} ${JSON.stringify(ApiServer.registry)}`);
}

console.log('found Api server', server, 'for', runtimeToRun);

export type LambdaInputPayload = {
    routeKey: string;
    rawPath: string;
    cookies: string[];
    headers: Record<string, string>;
    queryStringParameters: Record<string, string>;
    pathParameters: Record<string, string>;
    stageVariables: Record<string, string>;
    body: unknown;
    requestContext: {
        http: {
            method: HttpMethod;
            path: string;
        };
    };
};

export const handler = async (input: LambdaInputPayload) => {
    console.error(input);

    const { routeKey } = input;

    const apiDef = server.listener.apis.find(({ spec }) => routeKey === buildRouteKey(spec));

    if (!apiDef) {
        throw new Error(`No api found for ${routeKey} in ${JSON.stringify(server)}`);
    }

    return apiDef?.api.localExec(input.body);
};
