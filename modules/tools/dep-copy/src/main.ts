#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import copy from 'cpy';

if (process.argv.length < 4) {
    console.error(`dep-copy <src_dir> <dst_dir>. 
Recursively copy only production parts of node_modules`);
    process.exit(1);
}

const from = process.argv[2];
const into = process.argv[3];

type PkgJsonWithDeps = { dependencies?: Record<string, string> };

const processDir = async (dir: string) => {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        return;
    }

    if (from !== dir) {
        const fromGlob = path.join(dir, '**');
        const notGlob = path.join(dir, 'node_modules');
        const intoDest = path.join(into, dir);
        console.error(`will copy from ${fromGlob} but not ${notGlob} into ${intoDest}`);

        await copy([
            fromGlob,
            `!${notGlob}`
        ], intoDest, {
            ignoreJunk: true
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PkgJsonWithDeps;

    if (!pkgJson.dependencies) {
        return;
    }

    Object
        .keys(pkgJson.dependencies)
        .map(pkg => path.join(dir, 'node_modules', pkg))
        .map(processDir);
};

await processDir(from)
    .catch(console.error);