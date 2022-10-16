#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import copy from 'cpy';

/**
 * This thing is intended to detect and copy only prod dependencies of a module.
 * TODO: use the npm tree to find all modules
 * 
 * right now it only reliably skips top-level non-prod modules
 */

if (process.argv.length < 4) {
    console.error(`dep-copy <src_dir> <dst_dir>. 
Recursively copy only production parts of node_modules`);
    process.exit(1);
}

const from = process.argv[2];
const into = process.argv[3];

type PkgJsonWithDeps = { dependencies?: Record<string, string> };
type ToCopy = { source: string[], dest: string };

const processDir: (dir: string) => ToCopy[] = (dir: string) => {
    console.error(`checking ${dir}`);
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        // console.error(`No package.json in ${pkgPath}`);
        return [];
    }

    let selfs: ToCopy[] = [];

    if (from !== dir) {
        const fromGlob = path.join(dir, '**');
        const intoDest = path.join(into, dir);

        selfs = [{
            source: [
                fromGlob,
                '!**/.git/**'
            ],
            dest: intoDest
        }];
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PkgJsonWithDeps;

    if (!pkgJson.dependencies) {
        console.error(`no deps in ${pkgPath}`);
        return selfs;
    }

    return [
        ...selfs,
        ...Object
            .keys(pkgJson.dependencies)
            .map(pkg => path.join(dir, 'node_modules', pkg))
            .flatMap(processDir)
    ];
};

await Promise.all(
    processDir(from)
        .map(tocopy => {
            console.error(tocopy.source[0]);

            return tocopy;
        })
        .map(tocopy =>
            copy(tocopy.source, tocopy.dest, {
                ignoreJunk: true
            })
        )
)
    // .catch(console.error);