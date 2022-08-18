import { Identifier, NewExpression, Node, Project, ReferencedSymbol, ts, VariableDeclaration } from "ts-morph";
import { graphviz } from '@hpcc-js/wasm';
import roughUp from "rougher";


const project = new Project();
project.addSourceFilesAtPaths(process.argv.slice(2));

const collectChildren: (n: Node) => Node[] = (n: Node) => {
    return [n, ...n.getChildren().flatMap(collectChildren)]
}

const news = project.getSourceFiles()
    .flatMap(f => collectChildren(f))
    .filter(n => n.isKind(ts.SyntaxKind.NewExpression)) as NewExpression[];

const getParentVarDeclaration = (n: Node) => n
    .getAncestors()
    .filter(ans => ans.isKind(ts.SyntaxKind.VariableDeclaration)) as VariableDeclaration[];

const newDeclarations = news.map(n => {
    const parentVar = [...getParentVarDeclaration(n), undefined][0];

    const refs = parentVar?.findReferencesAsNodes()
        .flatMap(r => getParentVarDeclaration(r));

    return [
        parentVar?.getName() || '<inline>',
        n.getChildrenOfKind(ts.SyntaxKind.Identifier).map(c => c.getText())[0],
        (refs || []).map(r => r.getName()),
    ] as [string, string, string[]]
});

console.error(newDeclarations);

const nodeUid = (node: [string, string, string[]]) => `${node[0]} | ${node[1]}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

const archDot = newDeclarations.map(d => `${nodeUid(d)} [label="${d[0]}"];`)
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
        scale=50;

        ${archDot}
        
        ${archRels}
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