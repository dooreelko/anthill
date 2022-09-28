#!/usr/bin/env node

import { existsSync } from 'fs';
import { Project, ts } from 'ts-morph';
import * as rx from 'rxjs';
import { graphviz } from '@hpcc-js/wasm';
import roughUp from 'rougher';
import { getParentTypes, nodeTypeName } from './gnomes';

const usage = () => {
    console.error(`@anthill/vis. Generate solution diagrams from code.
    
    Usage
    ./node_modules/.bin/vis tsconfig.json [include-only-these-files] 
    `);

    process.exit(1);
};

if (process.argv.length < 3) {
    usage();
}

const tsConfigPath = process.argv[2];

if (!existsSync(tsConfigPath)) {
    console.error(`Cannot find tsc config at ${tsConfigPath}`);
    usage();
}

const fileFilters = new Set(process.argv.slice(3));

const project = new Project({
    tsConfigFilePath: tsConfigPath
});

const checker = project.getTypeChecker();

const acceptedTypesForGraph = (parentTypes: Set<string>) => parentTypes.has('Archetype') ||
    !![...parentTypes].find(el => (el ?? '').includes('TerraformResource'));

const sources = project.getSourceFiles()
    .filter(f => {
        const keep = fileFilters.size ? fileFilters.has(f.getBaseName()) : true;

        // so that we don't include core maxims
        return keep && f.getBaseName() !== 'maxim.d.ts';
    });

const vars = sources
    .flatMap(f => f.getDescendantsOfKind(ts.SyntaxKind.VariableDeclaration))
    .map(v => ({
        self: v,
        name: v.getStructure().name
    }))
    .map(v => ({
        ...v,
        varTypes: [...new Set([
            ...v.self.getChildrenOfKind(ts.SyntaxKind.NewExpression),
            ...v.self.getChildrenOfKind(ts.SyntaxKind.TypeReference)
        ])]
    }))
    .map(v => ({
        ...v,
        types: v.varTypes.flatMap(c => nodeTypeName(c, checker)),
        parentTypes: new Set(v.varTypes.flatMap(c => getParentTypes(c.compilerNode, checker)))
    }))
    .map(v => ({
        ...v,
        class: v.types[0],
        refs: v.self.findReferencesAsNodes().map(ref => ref.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration))
    }))
    .map(v => ({
        ...v,
        refs: v.refs
            .map(ref => ref?.getStructure().name)
            .filter(ref => !!ref) as string[]
    }))
    .map(v => {
        if (!acceptedTypesForGraph(v.parentTypes)) {
            console.error(v.name, v.parentTypes, 'not an archetype');
            const tt = v.varTypes.flatMap(c => getParentTypes(c.compilerNode, checker));
        }

        return v;
    })
    .filter(v => acceptedTypesForGraph(v.parentTypes))
    // sort by class name so that Api will go first, etc
    .sort((a, b) => (a.class || '').localeCompare(b.class));

const inlineId = (constructedClass: string) => `<i>${constructedClass}_${Math.ceil(Math.random() * 10000)}`;

const isInlineId = (id: string) => id.startsWith('<i>');

const inlines = sources
    .flatMap(f => f.getDescendantsOfKind(ts.SyntaxKind.NewExpression))
    // we don't need those assigned to vars
    .filter(n => n.getParentIfKind(ts.SyntaxKind.PropertyAssignment))
    .map(n => ({
        node: n,
        hostVar: n.getFirstAncestorByKind(ts.SyntaxKind.VariableStatement)
    }))
    .map(n => ({
        // ...n,
        refs: [n.hostVar?.getStructure().declarations[0].name ?? ''],
        // v: n.getFirstAncestorByKind(ts.SyntaxKind.VariableDeclaration)?.getText(),
        class: nodeTypeName(n.node, checker),
        parentTypes: new Set(getParentTypes(n.node.compilerNode, checker)),
        txt: n.node.getText()
    }))
    .map(n => ({
        ...n,
        name: inlineId(n.class)
    }))
    .filter(n => acceptedTypesForGraph(n.parentTypes));

const combinedNodes = [...vars, ...inlines];

const kinds = combinedNodes
    .map(d => d.class)
    .filter(el => !!el);

console.error(combinedNodes);
// console.log(inlines);

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

const nodeUid = (node: { name: string; class: string }) =>
    `${node.name} | ${node.class}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

const toHuman = (name: string) => [...name]
    .map(c => c.toUpperCase() === c ? ` ${c}` : c)
    .join('')
    .toLowerCase();

rx.from(legend).pipe(
    rx.map(([kind]) => kind),
    rx.bufferCount(7),
    rx.map(ten => ten.join('->')),
    rx.reduce((sofar, curr) => `${sofar}\n${curr}`)
).subscribe(legendRel => {
    const archDot = combinedNodes
        .map(d => `${nodeUid(d)} [label="${toHuman(isInlineId(d.name) ? d.class : d.name)}"; style=filled fillcolor="${colorMap.get(d.class) ?? ''}" ]`)
        .join('\n');

    const nameMap = new Map(combinedNodes.map(d => [d.name, d]));

    const archRels = combinedNodes
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
