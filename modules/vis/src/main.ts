#!/usr/bin/env node

import * as rx from 'rxjs';
import { graphviz } from '@hpcc-js/wasm';
import roughUp, { Options } from '@arinoto/rougher';
import { code2graph } from './code2graph';
import { cmdArgs } from './cmdline';

cmdArgs('vis').then((args) => {
    code2graph(args).pipe(rx.toArray())
        .subscribe(nodes => {

            // sort by class name so that Api will go first, etc
            const combinedNodes = nodes.sort((a, b) => (a.class || '').localeCompare(b.class));

            const kinds = combinedNodes
                .map(d => d.class)
                .filter(el => !!el);

            console.error(combinedNodes);

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

            const isInlineId = (id: string) => id.startsWith('<i>');

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

                const lay2 = `digraph G {
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
}`;

                console.error(lay2);

                const options = {
                    stroke: '#ffffff',
                    roughness: 0.5,
                    hachureGap: 3,
                    fill: '#ffffff',
                    fillStyle: 'hachure',

                    customOptions: (path: string[], element: SVGElement, options: Options) => {

                        // console.error('yo', path, element.parentElement?.querySelector('title')?.innerHTML);
                        if (path.length === 3) {
                            return {
                                ...options,
                                fillStyle: 'solid'
                            };
                        }

                        return undefined;
                    }
                };

                graphviz
                    .layout(lay2, 'svg', 'dot', {})
                    .then(svg => console.log(roughUp(svg, options)))
                    .catch(console.error);
            });
        });
}).catch(console.error);
