import { TerraformStack, TerraformOutput } from 'cdktf';
import { Container, DockerProvider, Image } from '@cdktf/provider-docker';

import { apiServerBuildContext } from '@arinoto/local-docker';

import { mainApi } from './docker-architecture';

/** CONCRETE SOLUTION IMPLEMENTATION */

export const build = (stack: TerraformStack) => {
    new DockerProvider(stack, 'docker', {});

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
};