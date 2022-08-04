import Koa = require('koa');
import logger = require('koa-logger');
import koaBody = require('koa-body');
import { ApiServerProps } from '../../../anthill/main';

export const apiInventory = {};

export const apiServerPath = __filename;

export const run = (server: ApiServerProps) => {
    const app = new Koa();

    app.use(koaBody({
        text: false,
        includeUnparsed: false
    }));

    app.use((ctx: Koa.Context, next: Koa.Next) => logger((str) => console.log(server.name, str, ctx.request.body || '[nobody]', ' ==>', ctx.response.body || '[nobody]'))(ctx, next));

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

            // console.log('matched to ', apiDef.api, 'will use body of', ctx);
            console.log('matched to ', apiDef.api);

            try {
                ctx.body = await apiDef.api.localExec({
                    ...pathMatcher,
                    ...ctx.request.body
                });
                ctx.type = 'application/json';
            } catch (e) {
                console.error('Error calling local api', e);
                ctx.response.status = 500;
                ctx.body = JSON.stringify(e);
            }

            console.error('response for ', apiDef.spec.path, 'is', ctx.body);
        }
    })).map(({ apiDef, middleware }) => {
        console.log('registering', name, JSON.stringify(apiDef));
        app.use(middleware);
    });

    app.on('error', err => {
        console.error('Server error', err)
    });

    app.listen(Number(process.env.SERVER_PORT) || listener.port);
    console.log('Server', server.name, listener.host, listener.port);
};
