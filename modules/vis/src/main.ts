#!/usr/bin/env node

import { CallExpression, NewExpression, Node, Project, SyntaxKind, ts, VariableDeclaration } from "ts-morph";
import * as rx from 'rxjs';
import { graphviz } from '@hpcc-js/wasm';
import roughUp from "rougher";

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
    return [n, ...n.getChildren().flatMap(collectChildren)]
}

const squeezeType = (ttype: ts.Type) => {
    const decs = (ttype.symbol.declarations || []) as ts.ClassLikeDeclarationBase[];
    const valueDec = (ttype.symbol.valueDeclaration as ts.ClassLikeDeclarationBase);

    const parents = [...decs, valueDec]
        .filter(el => !!el)
        .flatMap(dec => dec.heritageClauses
            ?.flatMap(cl => cl.types))
        .filter(el => !!el) as ts.ExpressionWithTypeArguments[];

    const uberparents = parents?.flatMap(getParentTypes);

    const referredTypes = (parents || [])
        .flatMap(tt => tt.typeArguments?.map(getParentTypes) || [])
        .flatMap(el => el);

    return [
        ...(parents || []).map(tt => tt.expression.getText()),
        ...referredTypes,
        ...(uberparents || [])
    ];
}

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

        const vartype = checker.compilerObject.getTypeAtLocation(n.parent);

        const maybeTypes = (vartype as any).types as ts.Type[] | undefined;
        if (maybeTypes) {
            return maybeTypes.flatMap(squeezeType);
        }

        return ['<NOSYMBOL>'];
    }

    const typeArgs = (n as any).typeArguments as ts.NodeArray<ts.TypeNode> | undefined;
    const genericArgs = (typeArgs || []).flatMap(getParentTypes);

    return [
        ...squeezeType(ttype),
        ...genericArgs
    ]
}

const nodeTypeName = (n: NewExpression) => {
    const ttype = checker.getTypeAtLocation(n);
    const tsubtype = checker.compilerObject.getTypeAtLocation(n.compilerNode.expression);

    if (ttype.compilerType.symbol) {
        return ttype.compilerType.symbol.escapedName;
    }

    const subsym = checker.compilerObject.getSymbolAtLocation(n.compilerNode);

    if (subsym) {
        return subsym.escapedName;
    }

    return n.compilerNode.getText();
};

const news = project.getSourceFiles()
    .filter(f => fileFilters.size ? fileFilters.has(f.getBaseName()) : true)
    .flatMap(f => collectChildren(f))
    .filter(n => n.isKind(ts.SyntaxKind.NewExpression))
    .filter(n => {
        const shallPass = getParentTypes(n.compilerNode).includes('Archetype') ||
            getParentTypes(n.compilerNode).includes('<NOSYMBOL>');

        console.error(nodeTypeName(n as NewExpression), shallPass, [...new Set(getParentTypes(n.compilerNode))]);

        return shallPass;
    }
    )
    .map(el => {

        const ttype = checker.getTypeAtLocation(el);

        const newedName = ttype.compilerType.symbol
            ? ttype.compilerType.symbol.escapedName
            : el.compilerNode.getText();

        const parents = getParentTypes(el.compilerNode);

        console.error(
            newedName,
            parents,
            ttype.isClassOrInterface(),
            ttype.isObject(),
            checker.compilerObject.typeToString(ttype.compilerType, el.compilerNode),
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

const isinlinePropertyAssignmenet = (n: Node) => n
    .getParentIfKind(ts.SyntaxKind.PropertyAssignment);

const inlineId = (constructedClass: string) => `<i>${constructedClass}_${Math.ceil(Math.random() * 10000)}`;
const isInlineId = (id: string) => id.startsWith('<i>');

const newDeclarations = news.map(n => {
    const parentVar = getParentVarDeclaration(n);

    const inlineHostVar = parentVar ? [] : getRootVarDeclaration(n);

    const refs = [...(parentVar?.findReferencesAsNodes()
        .flatMap(r => getRootVarDeclaration(r)) || [])
        .filter(el => !!el) as VariableDeclaration[],
    ...inlineHostVar];

    const calls = (parentVar?.findReferencesAsNodes()
        .flatMap(r => getRootCallDeclaration(r)) || [])
        .filter(el => !!el)
        .flatMap(c => c.getChildrenOfKind(SyntaxKind.Identifier))
        .map(c => c.getText());

    const constructedClass = n.getChildrenOfKind(ts.SyntaxKind.Identifier).map(c => c.getText())[0];

    return [
        parentVar?.getName() || inlineId(constructedClass),
        constructedClass,
        [...(refs || []).map(r => r.getName()), ...calls]
    ] as [string, string, string[]]
})
    // sort by class name so that Api will go first, etc
    .sort((a, b) => (a[1] || '').localeCompare(b[1]));

console.error(newDeclarations);

const nodeUid = (node: [string, string, string[]]) => `${node[0]} | ${node[1]}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

const kinds = newDeclarations.map(d => d[1]);

const palette = ['#1abc9c', '#2ecc71', '#27ae60', '#3498db', '#2980b9', '#9b59b6', '#c1f909', '#34495e', '#0057e5', '#f1c40f', '#f39c12', '#e67e22', '#d35400', '#e74c3c', '#01bf70', '#ecf0f1', '#bdc3c7', '#95a5a6', '#7f8c8d', '#16a085'];

const legend = [...new Set(kinds)]
    .map((kind, idx) => [kind, `${palette[idx % palette.length]}`]) as [string, string][];

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

    const archDot = newDeclarations.map(d => `${nodeUid(d)} [label="${isInlineId(d[0]) ? d[1] : d[0]}"; style=filled fillcolor="${colorMap.get(d[1])}" ]`)
        .join('\n');

    const nameMap = new Map(newDeclarations.map(d => [d[0], d]));

    const archRels = newDeclarations
        .filter(d => d[2].length)
        .flatMap(d => d[2]
            .filter(from => nameMap.has(from))
            .map(from => `${nodeUid(nameMap.get(from)!)} -> ${nodeUid(d)}`)
        ).join('\n');


    const lay2 = `
    digraph G {
        node [shape=rect];
        splines=ortho;
        rankdir=LR;
        rank=same;
        bgcolor="#00000000";

        subgraph cluster_legend {
            edge [style=invis] 

            ${legendDef}
            ${legendRel}

            label = "legend";
            rankdir=LR
            rank=same
        }

        subgraph cluster_arch {
            ${archDot}
            
            ${archRels}
        }

    }
    `;

    console.error(lay2);

    const options = {
        hachureGap: 1,
        fill: '#ffffff',
        fillStyle: 'hachure'
    };

    graphviz
        .layout(lay2, 'svg', 'dot', {})
        .then(svg => console.log(roughUp(svg, options)))
        .catch(console.error)

});
