import * as Koa from 'koa';
import * as logger from 'koa-logger';
import * as koaBody from 'koa-body';
import { ApiServer } from '../../../idw2c';

export const apiInventory = {};

export const apiServerPath = __filename;

export const run = (apiName: string) => {
    const app = new Koa();

    app.use(logger());
    app.use(koaBody());

    const apis = ApiServer.registry[apiName];
    if (!apis) {
        throw new Error(`No APIs found for ${apiName} in ${JSON.stringify(ApiServer.registry)}`);
    }

    apis.apis.map(api => ({
        api,
        middleware: async (ctx: Koa.Context, next: Koa.Next) => {
            console.log(JSON.stringify(ctx));
            console.log(JSON.stringify(api));
            if (ctx.path !== api.spec.path) {
                return await next();
            }

            if (ctx.request.method !== api.spec.method) {
                return await next();
            }

            ctx.type = 'application/json';
            ctx.body = api.api.run(ctx.request.body);
        }
    })).map(({ api, middleware }) => {
        console.log('registering', apiName, JSON.stringify(api));
        app.use(middleware);

    });

    app.on('error', err => {
        console.error('server error', err)
    });

    app.listen(Number(process.env.SERVER_PORT) || apis.port);
};
