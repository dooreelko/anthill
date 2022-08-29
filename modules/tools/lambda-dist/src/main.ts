#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import copy from 'cpy';

if (process.argv.length < 3) {
    console.error(`lambda-dist <dst_dir>. 
Recursively copy only production parts of node_modules`);
    process.exit(1);
}

const from = process.argv[2];


const processDir = async () => {
    const packageGlob = path.join(from, '**');
    const nodeModsGlob = path.join(from, 'node_modules', '**');

    copy(nodeModsGlob, path.join(from, 'lambda', 'layer', 'nodejs', 'node_modules'));

    copy([
        packageGlob,
        `!${nodeModsGlob}`
    ], path.join(from, 'lambda', 'function'));
};

await processDir()
    .catch(console.error);