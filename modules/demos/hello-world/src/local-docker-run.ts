import * as arch from './architecture';
import { TerraformStack, TerraformOutput } from "cdktf";
import { Container, DockerProvider, Image } from "@cdktf/provider-docker";

import { ApiServer, ApiServerProps } from '@anthill/core';
import { apiServerBuildContext, run } from '@anthill/local-docker';

/** CONCRETE SOLUTION IMPLEMENTATION */

export const build = (stack: TerraformStack) => {
    new DockerProvider(stack, "docker", {});

    const mainApi = {
        apiName: 'hello-world',
        init: {
            name: 'main',
            port: 8080,
            host: '127.0.0.10'
        }
    };

    const mainServer: ApiServerProps = {
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

    new ApiServer(mainServer, () => run(mainServer));

    const imageCtx = apiServerBuildContext(__dirname, 'api-server.Dockerfile');

    const dockerImage = new Image(stack, 'hello-world-api-server', {
        name: 'hello-world-api-server',
        buildAttribute: imageCtx
    });

    const name = `hello-world-${mainApi.init.name}`;

    const dockerContainer = new Container(stack, name, {
        dependsOn: [dockerImage],
        name,
        image: dockerImage.latest,
        attach: false,
        networkMode: 'host',
        ports: [{
            external: mainApi.init.port,
            internal: mainApi.init.port
        }],
        command: [
            mainApi.apiName
        ]
    });

    new TerraformOutput(stack, `${mainApi.init.name}-id`, {
        value: dockerContainer.id
    });
}