import * as path from 'path';
import * as rx from 'rxjs';
import { code2graph } from '../src/code2graph';

beforeEach(() => {
    jest.spyOn(global.console, 'error').mockImplementation((...args) => {
        console.log(...args);
    });
});

test('archetype vars are discovered', (done) => {
    interface IVarMarker { };

    class Var implements IVarMarker { };

    const a = new Var();

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IVarMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {
                expect(graph).toStrictEqual([{
                    name: 'a',
                    class: 'Var',
                    refs: []
                }]);

                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('inline refs are discovered', (done) => {
    interface IInlineCallMarker { };

    class Sub implements IInlineCallMarker { }

    class Var implements IInlineCallMarker {
        constructor(private inliner: { inlined: Sub }) { }
    };

    const a = new Var({
        inlined: new Sub()
    });

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineCallMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {

                expect(graph).toStrictEqual([{
                    name: 'a',
                    class: 'Var',
                    refs: []
                }, {
                    name: '<i>Sub_c3cb6234631a1dc74fa3807ccb41b69c',
                    class: 'Sub',
                    refs: ['a']
                }]);

                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('inline var refs are discovered', (done) => {
    interface IInlineVarRefMarker { };

    class Sub implements IInlineVarRefMarker {
        hello() { }
    }

    class Var implements IInlineVarRefMarker {
        constructor(ref: Sub) {
            ref.hello();
        }
    };

    const sub = new Sub();

    const a = new Var(sub);

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineVarRefMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {

                // TODO: BUG: same nodes are detected several times. It ain't nice.
                expect(graph).toStrictEqual([
                    {
                        name: 'sub',
                        class: 'Sub',
                        refs: ['a']
                    },
                    {
                        name: 'a',
                        class: 'Var',
                        refs: []
                    }
                ]);

                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('inline indirect refs are discovered', (done) => {
    interface IInlineIndirCallMarker { };

    class Sub implements IInlineIndirCallMarker {
        hello() { }
    }

    class Var implements IInlineIndirCallMarker {
        constructor(init: () => void) {
            init();
        }
    };

    const sub = new Sub();

    const a = new Var(() => {
        sub.hello();
    });

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineIndirCallMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {

                expect(graph).toStrictEqual([{
                    name: 'sub',
                    class: 'Sub',
                    refs: ['a']
                }, {
                    name: 'a',
                    class: 'Var',
                    refs: []
                }]);

                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('inline news in constructors are discovered', (done) => {
    interface IInlineNewInConstructorMarker { };

    class Var implements IInlineNewInConstructorMarker {
        constructor(private inliner?: Var) { }
    };

    const a = new Var(new Var());

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineNewInConstructorMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {
                expect(graph).toStrictEqual([{
                    name: 'a',
                    class: 'Var',
                    refs: []
                }, {
                    name: '<i>Var_7a6795f196be57ea3806014b2c4f43f8',
                    class: 'Var',
                    refs: ['a']
                }]);
                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('inline news in calls are discovered', (done) => {
    interface IInlineNewInCallMarker { };

    class Var implements IInlineNewInCallMarker {
        foo(inliner?: Var) { }
    };

    const a = new Var();

    a.foo(new Var());

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineNewInCallMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {
                expect(graph).toStrictEqual([{
                    name: 'a',
                    class: 'Var',
                    refs: []
                }, {
                    name: '<i>Var_7a6795f196be57ea3806014b2c4f43f8',
                    class: 'Var',
                    refs: ['a']
                }]);
                done();
            }
            catch (e) {
                done(e);
            }
        });
});


interface IInlineNewInNamespaceCallMarker { };

class Var implements IInlineNewInNamespaceCallMarker {
    foo(inliner?: Var) { }
};

namespace bar {
    export const a = new Var();
}

test('inline news in namespaced ref calls are discovered', (done) => {
    bar.a.foo(new Var());

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/IInlineNewInNamespaceCallMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {
                expect(graph).toStrictEqual([{
                    name: 'a',
                    class: 'Var',
                    refs: []
                }, {
                    name: '<i>Var_7a6795f196be57ea3806014b2c4f43f8',
                    class: 'Var',
                    refs: ['a']
                }]);
                done();
            }
            catch (e) {
                done(e);
            }
        });
});

test('no-var news are discovered as inlines', (done) => {
    interface INoVarNewCallMarker { };

    class Var implements INoVarNewCallMarker {
    };

    new Var();

    code2graph({
        tsConfigPath: '../tsconfig.json',
        includeFiles: [new RegExp(path.basename(__filename))],
        excludeFiles: [],
        acceptTypes: [/INoVarNewCallMarker/],
        verbose: false,
        log: {
            verbose: () => { },
            error: () => { }
        }
    }).pipe(rx.toArray())
        .subscribe(graph => {
            try {
                expect(graph).toStrictEqual([{
                    name: '<i>Var_7a6795f196be57ea3806014b2c4f43f8',
                    class: 'Var',
                    refs: []
                }]);
                done();
            }
            catch (e) {
                done(e);
            }
        });
});
