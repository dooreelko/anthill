import { ApiServer, ApiServerProps } from '@anthill/core';
import * as arch from '@anthill/hello-world.architecture';

/** CONCRETE SOLUTION IMPLEMENTATION */

export const mainServer: ApiServerProps = {
    name: 'hello-world',
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
