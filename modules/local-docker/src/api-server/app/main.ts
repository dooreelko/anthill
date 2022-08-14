import Koa = require('koa');
import logger = require('koa-logger');
import koaBody = require('koa-body');
import { ApiServerProps } from '@anthill/core';

export const apiInventory = {};

export const apiServerPath = __filename;

const pathArg = new RegExp(/{(?<key>[0-9a-zA-Z]+)}/);

/**
 * For /v1/{arg1}/{arg2} convert
 * {
 *  arg1: 'foo',
 *  arg2: 'bar'
 * } into
 * /v1/foo/bar 
 * 
 * TODO: enrich query
 */
export const enrichPath = <TIn extends Record<string, any>>(pathSpec: string, vars: TIn) => {
    const pathParts = pathSpec.split('/');

    return pathParts.map(part => {
        const arg = pathArg.exec(part);
        if (arg) {
            return String(vars[arg.groups?.key || 'BADKEY'])
        } else {
            return part;
        }
    }).join('/');
};

/**
 * Convert /v1/foo/bar for /v1/{arg1}/{arg2} into
 * {
 *  arg1: 'foo',
 *  arg2: 'bar'
 * }
 */
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
                [arg.groups?.key || 'BADKEY']: decodeURIComponent(pathParts[idx])
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

export const run = (server: ApiServerProps) => {
    const app = new Koa();

    app.use(koaBody({
        text: false,
        includeUnparsed: false
    }));

    app.use((ctx: Koa.Context, next: Koa.Next) => logger((str) => console.log(server.name, str, ctx.request.body || '[nobody]', ' ==>', ctx.response.body || '[nobody]'))(ctx, next));

    const { listener, name } = server;

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

            const callBody = {
                ...pathMatcher,
                ...ctx.request.body
            };
            console.log('matched to ', apiDef.api, apiDef.spec.path, callBody);

            try {
                ctx.body = await apiDef.api.localExec(callBody);
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
