import * as rx from 'rxjs';
import { Engine, graphviz } from '@hpcc-js/wasm';
import roughUp, { Options } from '@arinoto/rougher';
import { code2graph } from './code2graph';
import { cmdArgs, RuntimeConfig, visOptions, VisRuntimeConfig } from './cmdline';

const palette = [
    '#3bfdea', '#62ffd1', '#88ffb5', '#aeff9b', '#d4fd83', '#f9f871', '#00ddf8',
    '#00b9f4', '#6093d9', '#816cad', '#c2fcf3', '#96b1ac', '#81fd3b', '#00de79',
    '#e29c57', '#00ffff', '#7f8c8d', '#16a085', '#864a77', '#8b0075'];

const roughUpOptions = {
    stroke: '#ffffff',
    roughness: 0.5,
    hachureGap: 3,
    fill: '#ffffff',
    fillStyle: 'hachure',

    customOptions: (path: string[], element: SVGElement, options: Options) => {

        if (path.length === 3) {
            return {
                ...options,
                fillStyle: 'solid'
            };
        }

        return undefined;
    }
};

const printed = (str: string) => str.replaceAll(/[^0-9a-zA-Z]/g, '_');

const nodeUid = (node: { name: string; class: string }) =>
    printed(`${node.name} | ${node.class}`);

const toHuman = (name: string) => [...name]
    .map(c => c.toUpperCase() === c ? ` ${c}` : c)
    .join('')
    .toLowerCase();

const isInlineId = (id: string) => id.startsWith('<i>');

const clusterAllFunc = (cls: string) => cls;
const clusterNoneFunc = (_: string) => 'other';
const clusterSomeFunc = (classes: RegExp[]) => (cls: string) => {

    const matchingIdx = classes.findIndex(rgx => rgx.test(cls));

    // we'll use index for sorting clusters
    return matchingIdx !== -1 ? `${matchingIdx}_${printed(String(classes[matchingIdx]))}` : 'other';
}

export const vis = (runtime: VisRuntimeConfig) => code2graph(runtime).pipe(
    rx.toArray(),
    rx.map(nodes => {

        // sort by class name so that Api will go first, etc
        const combinedNodes = nodes.sort((a, b) => (a.class || '').localeCompare(b.class));

        const kinds = combinedNodes
            .map(d => d.class)
            .filter(el => !!el);

        runtime.log.verbose(combinedNodes);

        const clusterFunc = runtime.clusterNone ? clusterNoneFunc
            : runtime.clusterAllTypes
                ? clusterAllFunc
                : clusterSomeFunc(runtime.clusterTypes)

        const archDotRx = rx.from(combinedNodes).pipe(
            rx.map(d => ({ class: d.class, dot: `${nodeUid(d)} [label = "${toHuman(isInlineId(d.name) ? d.class : d.name)}"; style = filled fillcolor = "${colorMap.get(d.class) ?? ''}" ]` })),
            rx.groupBy(d => clusterFunc(d.class)),
            rx.flatMap(grp => grp.pipe(
                rx.reduce((sofar, curr) => `\t\t${sofar} \n${curr.dot} `, ''),
                rx.map(grouped => ({
                    key: grp.key,
                    sub: `subgraph cluster_${grp.key} {
                            ORD_${grp.key} [style = invis]
                            ${grouped}} `
                }))
            )),
            rx.toArray(),
            rx.map(arr => arr.sort((a, b) => a.key.localeCompare(b.key))),
            rx.map(arr => ({
                clusters: arr.reduce((sofar, curr) => `${sofar} \n${curr.sub} `, ''),
                order: arr
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map(el => `ORD_${el.key}`)
                    .reduce((sofar, curr) => `${sofar} -> ${curr} `)
            }))
        );

        const nameMap = new Map(combinedNodes.map(d => [d.name, d]));

        const archRels = combinedNodes
            .filter(d => d.refs.length)
            .flatMap(d => d.refs
                .filter(from => nameMap.has(from))
                .map(from => `\t\t${nodeUid(nameMap.get(from)!)} -> ${nodeUid(d)} #[constraint=false] `)
            ).join('\n');


        const legend = [...new Set(kinds)]
            .map((kind, idx) => [kind, `${palette[idx % palette.length]} `] as [string, string]);

        const colorMap = new Map(legend);

        const legendDef = legend
            .map(([kind, color]) => `\t"${kind}"[style = filled; fillcolor = "${color}" ]`)
            .join('\n');

        const legendDotRx = rx.from(legend).pipe(
            rx.map(([kind]) => kind),
            rx.bufferCount(7),
            rx.map(batch => batch.join('->')),
            rx.reduce((sofar, curr) => `${sofar} \n\t\t${curr} `)
        );

        return { legendDef, legendDotRx, archDotRx, archRels };
    }),

    rx.flatMap(({ legendDef, legendDotRx, archDotRx, archRels }) =>
        rx.combineLatest([legendDotRx, archDotRx]).pipe(
            rx.map(([legendDot, archDot]) => `
                    digraph G {
                        node[shape = rect];
                        edge[color = black];
                        splines = ortho;
                        rankdir = LR;
                        rank = same;
                        bgcolor = "white";
                        ordering = in;

                        subgraph cluster_legend {
                            color = white
                            edge[style = invis] 

                            ${legendDef}
                            ${legendDot}

                            label = "legend";
                            rankdir = LR
                            rank = same
                        }

                        subgraph cluster_arch {
                            color = white;
                            
                            ${archDot.clusters}
                            
                            ${archRels}

                            edge[style = invis]
                            ${archDot.order}
        }}`))),
    rx.flatMap(laid => graphviz.layout(laid, 'dot', 'nop' as unknown as Engine, {})),
    rx.tap(laid => runtime.log.verbose(laid)),
    rx.map(layPretty => graphviz
        .layout(layPretty, 'svg', 'dot', {})
        .then(svg => roughUp(svg, roughUpOptions))
    )
);

export const visCmd = () => cmdArgs<VisRuntimeConfig>('vis - Generate solution diagrams from code', visOptions)
    .then((args) =>
        rx.firstValueFrom(vis(args)))
    .then(console.log)
    .catch(console.error);