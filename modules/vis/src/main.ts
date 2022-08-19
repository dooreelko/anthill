import { CallExpression, Identifier, NewExpression, Node, Program, Project, ReferencedSymbol, SyntaxKind, ts, VariableDeclaration } from "ts-morph";
import { graphviz } from '@hpcc-js/wasm';
import roughUp from "rougher";


const project = new Project();
// project.addSourceFilesAtPaths(process.argv.slice(2));

project.addSourceFilesFromTsConfig(process.argv[2]);

const checker = project.getTypeChecker();

const collectChildren: (n: Node) => Node[] = (n: Node) => {
    return [n, ...n.getChildren().flatMap(collectChildren)]
}

const getParentTypes: (n: ts.Node) => string[] = (n: ts.Node) => {
    // const ttype = checker.getTypeAtLocation(n);

    const ttype = checker.compilerObject.getTypeAtLocation(n);

    if (!ttype.symbol) {
        // TODO: we need to find parent classes. for some reason, classes from local-docker are not recognised
        return ['<NOSYMBOL>']
    }

    const parents = (ttype.symbol.valueDeclaration as ts.ClassDeclaration)
        ?.heritageClauses
        ?.flatMap(cl => cl.types);

    const uberparents = parents?.flatMap(getParentTypes);

    return [
        ...(parents || []).map(tt => tt.expression.getText()),
        ...(uberparents || [])
    ]
}

const news = project.getSourceFiles()
    // .filter(f => f.getBaseName() === 'architecture.ts')
    .flatMap(f => collectChildren(f))
    .filter(n => n.isKind(ts.SyntaxKind.NewExpression))
    .map(n => {
        const ttype = checker.getTypeAtLocation(n);
        const newedName = ttype.compilerType.symbol
            ? ttype.compilerType.symbol.escapedName
            : n.compilerNode.getText();

        console.error(newedName, getParentTypes(n.compilerNode));

        return n;
    })
    .filter(n => getParentTypes(n.compilerNode).includes('Archetype'))
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
    // const parentVar = [...getParentVarDeclaration(n), undefined][0];
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
    // TODO: filter out everything but maxim.Archetype
    .filter(([, kind]) => kind !== 'Error');

console.error(newDeclarations);

const nodeUid = (node: [string, string, string[]]) => `${node[0]} | ${node[1]}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

const archDot = newDeclarations.map(d => `${nodeUid(d)} [label="${isInlineId(d[0]) ? d[1] : d[0]}"];`)
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
        scale=50;


        subgraph cluster_0 {
            color=lightgrey;
            node [style=filled,color=white];
            edge [style=invis] 
            FOO -> FOO1 -> FOO2 -> FOO3 -> FOO4 -> FOO5 -> FOO6 -> FOO7 -> FOO8
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
    fillStyle: 'solid'
};

graphviz
    .layout(lay2, 'svg', 'dot', {})
    .then(svg => console.log(roughUp(svg, options)))
    .catch(console.error)


export * from './draw';