import { enrichPath } from '../src/docker/api-server/app/main';

test('test path enrichment', () => {
    expect(enrichPath('/v1/{foo}/{bar}', {
        foo: 42,
        bar: 'hello'
    })).toBe('/v1/42/hello');
});