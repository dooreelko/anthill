import { ApiServer, ApiServerProps } from '@anthill/core';
import * as arch from '@anthill/hello-world.architecture';

/** CONCRETE SOLUTION IMPLEMENTATION */

const mainApi = {
    apiName: 'hello-world',
    init: {
        port: 8080,
        host: '127.0.0.10'
    }
};

export const mainServer: ApiServerProps = {
    name: mainApi.apiName,
    listener: {
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

export const apiServer = new ApiServer(mainServer);
