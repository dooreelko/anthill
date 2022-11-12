#!/usr/bin/env node

import yargs from 'yargs';
import chalk from 'chalk';
import * as fs from 'fs';
import { Node, selectAll } from 'unist-util-select';
import { Root } from 'remark-parse/lib';
import { remark } from 'remark';

const work = async () => {
    const { file, selector, verbose } = await yargs(process.argv.slice(2))
        .usage(`$0 replace a node in markdown with contents from STDIN`)
        .options({
            selector: {
                type: 'string',
                demandOption: true,
                describe: "A CSS-like path selector to the node to replace",
            },
            file: {
                type: 'string',
                demandOption: true,
                describe: "A path of the markdown file",
            },
            verbose: {
                type: 'boolean',
                default: false,
                demandOption: false,
                describe: "Print input document's structure.",
            }
        })
        .strict()
        .argv;

    if (!fs.existsSync(file)) {
        console.error(chalk.red(`File ${file} doesn't exist.`));
        process.exit(1)
    }

    const processor = remark();

    const editor = (options: { selector: string, replacement: string }) => (root: Root) => {

        const nodes = selectAll(selector, root);

        if (verbose) {
            console.error(JSON.stringify(root, null, 2));
        }

        if (!nodes.length) {
            throw new Error(`Nothing matches ${selector}.`);
        }

        if (nodes.length > 1) {
            throw new Error(`Multiple nodes found for query ${selector}.`);
        }

        const node = nodes[0] as Node & { value?: string };

        node.value = replacement;
    };

    const replacement = fs.readFileSync('/dev/stdin', 'utf-8');

    const input = fs.readFileSync(file, 'utf-8');

    const md = await processor
        .use(editor, { selector, replacement })
        .process(input);

    fs.writeFileSync(file, String(md), 'utf-8');
};

await work()
    .catch(console.error);