import path = require('path');

import { TerraformStack } from "cdktf";
import { Image } from "@cdktf/provider-docker";
import { findBuildContextRoot } from "../tools";
import { apiServerPath } from './app/main';

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
