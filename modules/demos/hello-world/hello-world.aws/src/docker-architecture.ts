import * as arch from '@anthill/hello-world.architecture';

import { ApiServer, ApiServerProps } from '@anthill/core';
import { run } from '@anthill/local-docker';

export const mainApi = {
    apiName: 'hello-world',
    init: {
        name: 'main',
        port: 8080,
        host: '127.0.0.10'
    }
};

export const mainServer: ApiServerProps = {
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
