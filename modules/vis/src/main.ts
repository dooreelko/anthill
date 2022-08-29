#!/usr/bin/env node

import { CallExpression, NewExpression, Node, Project, SyntaxKind, ts, VariableDeclaration } from 'ts-morph';
import * as rx from 'rxjs';
import { graphviz } from '@hpcc-js/wasm';
import roughUp from 'rougher';

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

const collectChildren: (n: Node) => Node[] = (n: Node) => {
    return [n, ...n.getChildren().flatMap(collectChildren)];
};

const squeezeType = (ttype: ts.Type) => {
    const decs = (ttype.symbol.declarations ?? []) as ts.ClassLikeDeclarationBase[];
    const valueDec = (ttype.symbol.valueDeclaration as ts.ClassLikeDeclarationBase);

    const parents = [...decs, valueDec]
        .filter(el => !!el)
        .flatMap(dec => dec.heritageClauses
            ?.flatMap(cl => cl.types))
        .filter(el => !!el) as ts.ExpressionWithTypeArguments[];

    const uberparents = parents?.flatMap(getParentTypes);

    const referredTypes = (parents ?? [])
        .flatMap(tt => tt.typeArguments?.map(getParentTypes) ?? [])
        .flatMap(el => el);

    return [
        ...(parents ?? []).map(tt => tt.expression.getText()),
        ...referredTypes,
        ...(uberparents ?? [])
    ];
};

// TODO: doesn't work
const getVarType = (n: ts.Node) => {
    if (n.kind !== ts.SyntaxKind.VariableDeclaration) {
        return '<NOTVAR>';
    }

    const vartype = checker.compilerObject.getTypeAtLocation(n);

    const maybeTypes = (vartype as any).types as ts.Type[] | undefined;
    if (maybeTypes) {
        return maybeTypes.flatMap(squeezeType)[0];
    }

    return '<NOSYMBOL>';
};

const getParentTypes: (n: ts.Node) => string[] = (n: ts.Node) => {
    const ttype = checker.compilerObject.getTypeAtLocation(n);

    if (!ttype.symbol) {
        /**
         * the awkward `new func()()` doesn't have a type, but we
         * can try to extract one from the variable declaration
         */
        if (n.parent.kind !== ts.SyntaxKind.VariableDeclaration) {
            return ['<NOSYMBOL>'];
        }

        return [getVarType(n.parent)];
        // const vartype = checker.compilerObject.getTypeAtLocation(n.parent);

        // const maybeTypes = (vartype as any).types as ts.Type[] | undefined;
        // if (maybeTypes) {
        //     return maybeTypes.flatMap(squeezeType);
        // }

        // return ['<NOSYMBOL>'];
    }

    const typeArgs = (n as any).typeArguments as ts.NodeArray<ts.TypeNode> | undefined;
    const genericArgs = (typeArgs ?? []).flatMap(getParentTypes);

    return [
        ...squeezeType(ttype),
        ...genericArgs
    ];
};

const nodeTypeName = (n: Node) => {
    const ttype = checker.getTypeAtLocation(n);

    if (ttype.compilerType.symbol) {
        return ttype.compilerType.symbol.escapedName as string;
    }

    const subsym = checker.compilerObject.getSymbolAtLocation(n.compilerNode);

    if (subsym) {
        return subsym.escapedName as string;
    }

    if (n.compilerNode.parent.kind === ts.SyntaxKind.VariableDeclaration) {
        return getVarType(n.compilerNode.parent);
    }

    console.error('falling back for', n.compilerNode.getText());
    return n.compilerNode.getText();
};

const news = project.getSourceFiles()
    .filter(f => fileFilters.size ? fileFilters.has(f.getBaseName()) : true)
    .flatMap(f => collectChildren(f))
    .filter(n => n.isKind(ts.SyntaxKind.NewExpression))
    .filter(n => {
        const parentTypes = getParentTypes(n.compilerNode);

        const shallPass = parentTypes.includes('Archetype') ||
            !!parentTypes.find(el => el.includes('TerraformResource')) ||
            parentTypes.includes('<NOSYMBOL>');

        console.error(nodeTypeName(n), shallPass, [...new Set(getParentTypes(n.compilerNode))]);

        return shallPass;
    })
    .map(el => {
        const ttype = checker.getTypeAtLocation(el);

        // const newedName = ttype.compilerType.symbol
        //     ? ttype.compilerType.symbol.escapedName
        //     : el.compilerNode.getText();

        const newedName = nodeTypeName(el);

        const parents = getParentTypes(el.compilerNode);

        console.error(
            newedName,
            parents,
            ttype.isClassOrInterface(),
            ttype.isObject(),
            checker.compilerObject.typeToString(ttype.compilerType, el.compilerNode)
        );

        return el;
    }) as NewExpression[];

const getRootVarDeclaration = (n: Node) => n
    .getAncestors()
    .filter(ans => ans.isKind(ts.SyntaxKind.VariableDeclaration)) as VariableDeclaration[];

const getRootCallDeclaration = (n: Node) => n
    .getAncestors()
    .filter(ans => ans.isKind(ts.SyntaxKind.CallExpression)) as CallExpression[];

const getParentVarDeclaration = (n: Node) => n
    .getParentIfKind(ts.SyntaxKind.VariableDeclaration);

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

    console.error(calls);

    const constructedClass = nodeTypeName(n);
    // .getChildrenOfKind(ts.SyntaxKind.Identifier)
    // .map(c => c.getText())[0];

    return [
        parentVar?.getName() ?? inlineId(constructedClass),
        constructedClass,
        [
            ...(refs ?? []).map(r => r.getName()),
            ...calls
        ]
    ] as [string, string, string[]];
})
    // sort by class name so that Api will go first, etc
    .sort((a, b) => (a[1] || '').localeCompare(b[1]));

const nodeUid = (node: [string, string, string[]]) => `${node[0]} | ${node[1]}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

console.error(newDeclarations);

const kinds = newDeclarations
    .map(d => d[1])
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
        .map(d => `${nodeUid(d)} [label="${toHuman(isInlineId(d[0]) ? d[1] : d[0])}"; style=filled fillcolor="${colorMap.get(d[1]) ?? ''}" ]`)
        .join('\n');

    const nameMap = new Map(newDeclarations.map(d => [d[0], d]));

    const archRels = newDeclarations
        .filter(d => d[2].length)
        .flatMap(d => d[2]
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
