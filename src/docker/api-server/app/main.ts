import Koa = require('koa');
import logger = require('koa-logger');
import koaBody = require('koa-body');
import { ApiServerProps } from '../../../anthill/main';
import { networkIpamConfigToTerraform } from '@cdktf/provider-docker';

export const apiInventory = {};

export const apiServerPath = __filename;

export const run = (server: ApiServerProps) => {
    const app = new Koa();

    app.use((ctx: Koa.Context, next: Koa.Next) => {
        console.log('rq', ctx);
        return next();
    });
    app.use(logger((str, args) => console.log(server.name, str, args)));
    app.use(koaBody({
        text: false,
        includeUnparsed: true
    }));

    const { listener, name } = server;

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

            console.log('matched to ', apiDef.api, 'will use body of', ctx);

            ctx.type = 'application/json';
            ctx.body = await apiDef.api.localExec({
                ...pathMatcher,
                ...ctx.request.body
            });

            console.error('response for ', apiDef.spec.path, 'is', ctx.body);
        }
    })).map(({ apiDef, middleware }) => {
        console.log('registering', name, JSON.stringify(apiDef));
        app.use(middleware);
    });

    app.on('error', err => {
        console.error('server error', err)
    });

    app.listen(Number(process.env.SERVER_PORT) || listener.port);
};
