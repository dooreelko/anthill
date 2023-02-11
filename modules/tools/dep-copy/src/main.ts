#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import copy from 'cpy';

if (process.argv.length < 4) {
    console.error(`dep-copy <src_dir> <dst_dir>. 
Recursively copy only production parts of node_modules`);
    process.exit(1);
}

const from = process.argv[2];
const into = process.argv[3];

type PkgJsonWithDeps = {
    name: string;
    dependencies?: Record<string, string>
};
type ToCopy = { source: string[], dest: string };

const rqr = createRequire(import.meta.url);

const founds = {} as Record<string, boolean>;

const findPackageDir = (pkg: string, startDir: string = '.') => {
    founds[pkg] = true;
    const main = path.dirname(rqr.resolve(pkg, { paths: [startDir] }));
    // console.error('found', pkg, main);

    if (main === '.') { // it's a built-in, ignore
        return '';
    }

    const findModuleRoot: (currentPath: string) => string = (currentPath: string) => {
        if (currentPath === path.sep) {
            throw new Error(`Could not find package.json going up from ${path.join(...main)}`);
        }

        const pkgJsonPath = path.join(currentPath, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {

            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as PkgJsonWithDeps;

            if (pkgJson.name !== pkg) {
                throw new Error(`Starting from ${startDir} found package.json under ${currentPath} but instead of ${pkg} it's ${pkgJson.name}`);
            }

            // console.error('\t', pkg, 'is in', currentPath);
            return currentPath;
        }

        // console.error(pkg, 'is NOT in', currentPath);

        return findModuleRoot(path.dirname(currentPath))
    }

    return findModuleRoot(main);
}

const processDir: (dir: string) => { pkg: string, location: string }[] = (dir: string) => {
    if (dir === 'DEADMEET') {
        throw new Error('failed filtering built-in package location');
    }

    // console.error(`checking ${dir}`);
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        // console.error(`No package.json in ${pkgPath}`);
        return [];
    }

    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as PkgJsonWithDeps;

    return Object
        .keys(pkgJson.dependencies ?? [])
        .filter(pkg => !founds[pkg])
        .filter(pkg => !pkg.startsWith('@types/'))
        .map(pkg => ({ pkg, location: findPackageDir(pkg, dir) }))
        .filter(pkg => pkg.location)
        // .map(pkg => {

        //     console.error(pkg);
        //     return pkg;
        // })
        .flatMap(pkg => [
            pkg,
            ...processDir(pkg.location ?? 'DEADMEET')
        ])
}

await Promise.all(processDir(path.resolve(from))
    .map(pkg => ({
        ...pkg,
        source: [
            path.join(pkg.location, '**'),
            '!**/.git/**',
            '!**/node_modules'
        ],
        dest: path.join(into, 'node_modules', pkg.pkg)
    }))
    .map(tocopy => {
        console.error(tocopy.pkg, tocopy.location);

        return tocopy;
    })
    .map(tocopy =>
        copy(tocopy.source, tocopy.dest, {
            ignoreJunk: true
        })
    )
);
