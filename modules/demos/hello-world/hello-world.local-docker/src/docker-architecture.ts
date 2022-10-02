import * as arch from '@arinoto/hello-world.architecture';

import { ApiServer, ApiServerProps, ApiServerListener } from '@arinoto/core';
import { run } from '@arinoto/local-docker';

export type DockerListener = ApiServerListener & {
    host: string;
    port: number;
};

export const mainApi = {
    apiName: 'hello-world',
    init: {
        name: 'main',
        port: 8080,
        host: '127.0.0.10'
    }
};

export const mainServer: ApiServerProps<DockerListener> = {
    name: mainApi.apiName,
    listener: {
        host: mainApi.init.host,
        port: mainApi.init.port,
        apis: [
            {
                api: arch.helloApi,
                spec: {
                    method: 'GET',
                    path: '/v1/hello'
                }
            }
        ]
    }
};

export const apiServer = new ApiServer(mainServer, () => run(mainServer));
