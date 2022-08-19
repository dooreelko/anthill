import * as maxim from '@anthill/core';
import { graphviz } from '@hpcc-js/wasm';
// import { Config } from "roughjs/core";
import roughUp from "rougher";

/**
 * This helper function produces an SVG of the architecure
 */
export const draw = (arch: maxim.Archetype[]) => {
    const lay = `
    digraph G {
        node [shape=rect];

        subgraph cluster_0 {
            style=filled;
            color=lightgrey;
            node [style=filled,color=white];
            a0 -> a1 -> a2 -> a3;
            label = "Hello";
        }

        subgraph cluster_1 {
            node [style=filled];
            b0 -> b1 -> b2 -> b3;
            label = "World";
            color=blue
        }

        start -> a0;
        start -> b0;
        a1 -> b3;
        b2 -> a3;
        a3 -> a0;
        a3 -> end;
        b3 -> end;

        start [shape=Mdiamond];
        end [shape=Msquare];
    }
`;

    // const options = {
    //     fillStyle: 'solid'
    // };

    // const nodeUid = (arc: maxim.Archetype) => `${arc.kind} | ${arc.name}`.replaceAll(/[^0-9a-zA-Z]/g, '_');

    // const namesKV = arch.map(a => [`${nodeUid(a)}`, a] as [string, maxim.Archetype]);

    // console.error(namesKV);

    // const nameMap = new Map<string, maxim.Archetype>(
    //     namesKV
    // );

    // const archDot = arch
    //     .map(a => `${nodeUid(a)} [label="${a.name}"];`)
    //     .join('\n')

    // const archRels = arch.map(a => a.relations
    //     .map(r => `${nodeUid(r.who)} -> ${nodeUid(r.whom)};`)
    //     .join('\n')

    // ).join('\n')

    // const lay2 = `
    // digraph G {
    //     node [shape=rect];
    //     splines=ortho;
    //     rankdir=LR;
    //     scale=50;

    //     ${archDot}

    //     ${archRels}
    // }
    // `;

    // console.error(lay2);

    // graphviz
    //     .layout(lay2, 'svg', 'dot', {})
    //     .then(svg => console.log(roughUp(svg, options)))
    //     .catch(console.error)
};
