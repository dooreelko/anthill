#!/usr/bin/env node

import { NewExpression, Project, SyntaxKind, ts } from 'ts-morph';
import * as rx from 'rxjs';
import { graphviz } from '@hpcc-js/wasm';
import roughUp from 'rougher';
import { collectChildren, first, getParentTypes, getParentVarDeclaration, getRootCallDeclaration, getRootVarDeclaration, nodeTypeName } from './gnomes';

if (process.argv.length < 3) {
    console.error(`@anthill/vis. Generate solution diagrams from code.

Usage
    ./node_modules/.bin/vis tsconfig.json [include-only-these-files] 
`);

    process.exit(1);
}

const fileFilters = new Set(process.argv.slice(3));

const project = new Project();
project.addSourceFilesFromTsConfig(process.argv[2]);

const checker = project.getTypeChecker();

const news = project.getSourceFiles()
    .filter(f => fileFilters.size ? fileFilters.has(f.getBaseName()) : true)
    .flatMap(f => collectChildren(f))
    .filter(n => n.isKind(ts.SyntaxKind.NewExpression))
    .filter(n => {
        const parentTypes = getParentTypes(n.compilerNode, checker);

        const shallPass = parentTypes.includes('Archetype') ||
            !!parentTypes.find(el => el.includes('TerraformResource')) ||
            parentTypes.includes('<NOSYMBOL>');

        console.error(nodeTypeName(n, checker), shallPass, [...new Set(getParentTypes(n.compilerNode, checker))]);

        return shallPass;
    })
    .map(el => {
        const ttype = checker.getTypeAtLocation(el);

        // const newedName = ttype.compilerType.symbol
        //     ? ttype.compilerType.symbol.escapedName
        //     : el.compilerNode.getText();

        const newedName = nodeTypeName(el, checker);

        const parents = getParentTypes(el.compilerNode, checker);

        console.error(
            newedName,
            parents,
            ttype.isClassOrInterface(),
            ttype.isObject(),
            checker.compilerObject.typeToString(ttype.compilerType, el.compilerNode)
        );

        return el;
    }) as NewExpression[];

const inlineId = (constructedClass: string) => `<i>${constructedClass}_${Math.ceil(Math.random() * 10000)}`;
const isInlineId = (id: string) => id.startsWith('<i>');

const toHuman = (name: string) => [...name]
    .map(c => c.toUpperCase() === c ? ` ${c}` : c)
    .join('')
    .toLowerCase();

const newDeclarations = news.map(n => {
    const parentVar = getParentVarDeclaration(n);

    const inlineHostVar = parentVar ? [] : getRootVarDeclaration(n);

    const refs = [
        ...(parentVar?.findReferencesAsNodes()
            .flatMap(r => getRootVarDeclaration(r)) ?? [])
            .filter(el => !!el),
        ...inlineHostVar
    ];

    const calls = parentVar?.findReferencesAsNodes()
        .flatMap(r => getRootCallDeclaration(r) ?? [])
        .filter(el => !!el)
        .flatMap(c => c.getChildrenOfKind(SyntaxKind.Identifier))
        .map(c => c.getText())
        .filter(el => !!el) as string[] ?? [];

    const calls2 = parentVar?.findReferencesAsNodes()
        .flatMap(r => getRootCallDeclaration(r) ?? [])
        .filter(el => !!el)
        .flatMap(c => ({
            who: c.getParent()?.getChildrenOfKind(SyntaxKind.Identifier),
            how: c.getChildrenOfKind(SyntaxKind.Identifier)
        }))
        .map(({ who, how }) => ({
            who: first(who)?.getSymbol()?.getName(),
            how: how.map(h => h.getText())
        })) ?? [];

    console.error(calls);

    const constructedClass = nodeTypeName(n, checker);
    // .getChildrenOfKind(ts.SyntaxKind.Identifier)
    // .map(c => c.getText())[0];

    return {
        name: parentVar?.getName() ?? inlineId(constructedClass),
        class: constructedClass,
        refs: [
            ...new Set([
                ...(refs ?? []).map(r => r.getName()),
                ...calls
            ])
        ],
        rels: {
            refs: (refs ?? []).map(r => r.getName()),
            calls,
            calls2
        }
    };
})
    // sort by class name so that Api will go first, etc
    .sort((a, b) => (a.class || '').localeCompare(b.class));

const nodeUid = (node: { name: string; class: string; refs: string[] }) =>
    `${node.name} | ${node.class}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

console.error(JSON.stringify(newDeclarations, null, 2));

const kinds = newDeclarations
    .map(d => d.class)
    .filter(el => !!el);

const palette = [
    '#3bfdea', '#62ffd1', '#88ffb5', '#aeff9b', '#d4fd83', '#f9f871', '#00ddf8',
    '#00b9f4', '#6093d9', '#816cad', '#c2fcf3', '#96b1ac', '#81fd3b', '#00de79',
    '#e29c57', '#00ffff', '#7f8c8d', '#16a085', '#864a77', '#8b0075'];

const legend = [...new Set(kinds)]
    .map((kind, idx) => [kind, `${palette[idx % palette.length]}`] as [string, string]);

const colorMap = new Map(legend);

const legendDef = legend
    .map(([kind, color]) => `"${kind}" [ style=filled; fillcolor="${color}" ]`)
    .join('\n');

rx.from(legend).pipe(
    rx.map(([kind]) => kind),
    rx.bufferCount(7),
    rx.map(ten => ten.join('->')),
    rx.reduce((sofar, curr) => `${sofar}\n${curr}`)
).subscribe(legendRel => {
    const archDot = newDeclarations
        .map(d => `${nodeUid(d)} [label="${toHuman(isInlineId(d.name) ? d.class : d.name)}"; style=filled fillcolor="${colorMap.get(d.class) ?? ''}" ]`)
        .join('\n');

    const nameMap = new Map(newDeclarations.map(d => [d.name, d]));

    const archRels = newDeclarations
        .filter(d => d.refs.length)
        .flatMap(d => d.refs
            .filter(from => nameMap.has(from))
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .map(from => `${nodeUid(nameMap.get(from)!)} -> ${nodeUid(d)}`)
        ).join('\n');

    const lay2 = `
    digraph G {
        node [shape=rect];
        edge [color=black];
        splines=ortho;
        rankdir=LR;
        rank=same;
        bgcolor="white";

        subgraph cluster_legend {
            color=white
            edge [style=invis] 

            ${legendDef}
            ${legendRel}

            label = "legend";
            rankdir=LR
            rank=same
        }

        subgraph cluster_arch {
            color=white
            ${archDot}
            
            ${archRels}
        }

    }
    `;

    console.error(lay2);

    const options = {
        stroke: '#ffffff',
        hachureGap: 0.5,
        fill: '#ffffff',
        fillStyle: 'hachure'
    };

    graphviz
        .layout(lay2, 'svg', 'dot', {})
        .then(svg => console.log(roughUp(svg, options)))
        .catch(console.error);
});
