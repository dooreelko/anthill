import { ApiContext } from '@arinoto/core';

export const splitStageAndPath = (path: string) => {
    const parts = path.split('/').filter(p => !!p);

    if (parts.length < 2) {
        throw new Error(`${path} must be in form of /<stage>/<path>/[parts] but is not`);
    }

    return { stage: parts[0], path: `/${parts.slice(1).join('/')}` };
};

export const buildRouteKey = ({ method, path }: ApiContext) => `${method} ${splitStageAndPath(path).path}`;
