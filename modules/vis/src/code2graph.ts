#!/usr/bin/env node

import { existsSync } from 'fs';
import { createHash } from 'crypto';
import * as path from 'path';
import { Project, ts, VariableDeclaration, Node } from 'ts-morph';
import * as _ from 'lodash';
import * as rx from 'rxjs';
import { findUp, first, getParentTypes, nodeTypeName, uniq, WalkChoice } from './gnomes';
import { argv, cmdArgs, ParseConfig } from './cmdline';

export type GraphNode = {
    name: string;
    class: string;
    refs: string[];
};

export const code2graph = (opts: ParseConfig) => {
    const log = {
        verbose: (...args: unknown[]) => {
            if (opts.verbose) {
                console.error(args);
            }
        }
    }

    log.verbose(opts);

    const { tsConfigPath, includeFiles, excludeFiles, acceptTypes } = opts;

    if (!existsSync(tsConfigPath)) {
        throw new Error(`Cannot find tsc config at ${tsConfigPath}`);
    }

    const project = new Project({
        tsConfigFilePath: tsConfigPath
    });

    const checker = project.getTypeChecker();
    const lang = project.getLanguageService();

    const acceptedTypesForGraph = (parentTypes: string[]) => parentTypes
        .some(t => acceptTypes.some(r => r.test(t)));

    const sources = project.getSourceFiles()
        .filter(f => {
            const keep = includeFiles.length ? includeFiles.some(r => r.test(f.getBaseName())) : true;
            const skip = excludeFiles.some(r => r.test(f.getBaseName()));

            // so that we don't include core maxims
            return keep && !skip;
        });

    const vars = rx.from(sources)
        .pipe(
            rx.mergeMap(f => f.getDescendantsOfKind(ts.SyntaxKind.VariableDeclaration)),
            rx.map(v => ({
                self: v,
                name: v.getStructure().name,
                varTypes: [...new Set([
                    ...v.getChildrenOfKind(ts.SyntaxKind.NewExpression),
                    ...v.getChildrenOfKind(ts.SyntaxKind.TypeReference)
                ])]
            })),
            rx.map(v => ({
                ...v,
                types: v.varTypes.flatMap(c => nodeTypeName(c, checker)),
                parentTypes: uniq(v.varTypes.flatMap(c => getParentTypes(c.compilerNode, checker)))
            })),
            // rx.tap(n => log.verbose('a', n)),
            rx.filter(v => acceptedTypesForGraph(v.parentTypes)),
            // rx.tap(n => log.verbose('b.refs', n, n.self.findReferences(), n.self.findReferencesAsNodes())),
            rx.map(v => ({
                ...v,
                class: v.types[0],
                refs: v.self.findReferencesAsNodes().map(ref => ref.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration))
            })),
            rx.map(v => ({
                ...v,
                refs: v.refs
                    .map(ref => ref?.getStructure().name)
                    .filter(ref => !!ref) as string[]
            })),
            rx.map(n => ({
                name: n.name,
                class: n.class,
                refs: n.refs
            })),
            // rx.tap(n => log.verbose('c', n))
        ) as rx.Observable<GraphNode>;

    const inlineId = (constructedClass: string, txt?: string) =>
        txt && txt.length ? `<i>${constructedClass}_${createHash('md5').update(txt).digest('hex')}`
            : `<i>${constructedClass}_${Math.ceil(Math.random() * 10000)}`;

    const inlinesInCalls = rx.from(sources)
        .pipe(
            rx.mergeMap(f => f.getDescendantsOfKind(ts.SyntaxKind.NewExpression)),
            rx.tap(n => log.verbose(0, n.getText(), 1, n.getParent().getText())),
            // we don't need those assigned to vars
            rx.filter(n => !n.getParentIfKind(ts.SyntaxKind.VariableDeclaration)),
            rx.map(n => ({
                node: n,
                parentTypes: uniq(getParentTypes(n.compilerNode, checker)),
            })),
            rx.filter(n => acceptedTypesForGraph(n.parentTypes)),
            rx.map(n => {


                const callVar = first(findUp(n.node, curr => {
                    switch (curr.getKind()) {
                        case ts.SyntaxKind.Block:
                            return WalkChoice.Abort;
                        case ts.SyntaxKind.CallExpression:
                        case ts.SyntaxKind.BinaryExpression:
                            return WalkChoice.Return;
                        default:
                            return WalkChoice.Next;
                    }
                })
                    ?.getFirstDescendantByKind(ts.SyntaxKind.PropertyAccessExpression)
                    ?.getDescendantsOfKind(ts.SyntaxKind.Identifier)
                    .map(kid => kid.getSymbol()?.getValueDeclaration())
                    .filter(kid => kid?.isKind(ts.SyntaxKind.VariableDeclaration))) as VariableDeclaration;

                const hostVar = callVar ?? n.node.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration);

                log.verbose(1.5, n.node.getText(), callVar?.getSymbol(), hostVar?.getSymbol());

                if (hostVar) {
                    const hostTypes = getParentTypes(hostVar.compilerNode, checker);

                    if (acceptedTypesForGraph(hostTypes)) {
                        return {
                            ...n,
                            hostVar
                        }
                    }
                }
                console.error(`Warning. Failed getting proper architectural host for inline ${n.node.getText()}. Will treat that as a no-ref inline var.`);

                /**
                 * If somebody decides to have a free hanging 
                 * 
                 * ```
                 * class Foo implements Archetype {}
                 * 
                 * new Foo();
                 * ```
                 * 
                 * It's up to them to have it in the arch but nameless
                 * 
                 */
                return {
                    ...n,
                    hostVar: undefined
                };
            }),
            rx.tap(n => log.verbose(2, n.node.getText(), 3, n.node.getParent().getText())),
            rx.map(n => ({
                refs: [n.hostVar?.getStructure().name ?? ''].filter(v => !!v),
                class: nodeTypeName(n.node, checker),
                parentTypes: uniq(getParentTypes(n.node.compilerNode, checker)),
                txt: n.node.getText()
            })),
            rx.map(n => ({
                ...n,
                name: inlineId(n.class, n.txt)
            })),
            rx.tap(n => log.verbose(3.5, n.txt, n.class, n.parentTypes)),
            rx.filter(n => acceptedTypesForGraph(n.parentTypes)),
            rx.tap(n => log.verbose(4, n.txt, n.class, n.parentTypes)),
            rx.map(n => ({
                name: n.name,
                class: n.class,
                refs: n.refs
            })),
            rx.tap(n => log.verbose(5, n.name)),
        ) as rx.Observable<GraphNode>;

    return rx.merge(vars, inlinesInCalls);
};

if (require.main === module) {
    cmdArgs('code2graph').then((args) => {

        code2graph(args)
            .pipe(rx.toArray())
            .subscribe(graph => console.log(JSON.stringify(graph, null, 2)));
    });
};
