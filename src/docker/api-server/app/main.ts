import Koa = require('koa');
import logger = require('koa-logger');
import koaBody = require('koa-body');
import { ApiServer } from '../../../idw2c';

export const apiInventory = {};

export const apiServerPath = __filename;

export const run = (apiName: string) => {
    const app = new Koa();

    app.use(logger());
    app.use(koaBody());

    const listener = ApiServer.registry.get(apiName);
    if (!listener) {
        throw new Error(`No APIs found for ${apiName} in ${JSON.stringify(ApiServer.registry)}`);
    }

    const pathArg = new RegExp(/{(?<key>[0-9a-zA-Z]+)}/);
    const matchPath = (path: string, pathSpec: string) => {
        const specParts = pathSpec.split('/');
        const pathParts = path.split('/');

        if (specParts.length !== pathParts.length) {
            return;
        }

        const parsed = specParts.map((v, idx) => {
            const arg = pathArg.exec(v);
            if (arg) {
                return {
                    [arg.groups?.key || 'BADKEY']: pathParts[idx]
                };
            } else {
                return v === pathParts[idx];
            }
        });

        if (!parsed.every(v => !!v)) {
            return;
        }

        return parsed
            .filter(el => typeof el !== 'boolean')
            .map(el => el as Record<string, string>)
            .reduce((sofar, curr) => ({
                ...sofar,
                ...curr
            }), {});
    }

    listener.apis.map(apiDef => ({
        apiDef,
        middleware: async (ctx: Koa.Context, next: Koa.Next) => {
            const pathMatcher = matchPath(ctx.path, apiDef.spec.path);
            if (!pathMatcher) {
                return await next();
            }

            if (ctx.request.method !== apiDef.spec.method) {
                return await next();
            }

            ctx.type = 'application/json';
            ctx.body = await apiDef.api.exec({
                ...pathMatcher,
                ...ctx.request.body
            });
        }
    })).map(({ apiDef, middleware }) => {
        console.log('registering', apiName, JSON.stringify(apiDef));
        app.use(middleware);
    });

    app.on('error', err => {
        console.error('server error', err)
    });

    app.listen(Number(process.env.SERVER_PORT) || listener.port);
};
