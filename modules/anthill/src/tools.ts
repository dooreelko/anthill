import * as fs from 'fs';
import * as path from 'path';

export const findBuildContextRoot = (startPath: string) => {
    const pathParts = startPath.split(path.sep);

    for (let i = pathParts.length; i >= 0; i--) {
        const currentPath = path.join(path.sep, ...pathParts.slice(0, i));
        if (fs.existsSync(path.join(currentPath, 'package.json'))) {
            return currentPath;
        }
    }

    throw new Error(`Failed detecting docker build root, because could not find package.json while iterating from ${startPath} and up.`);
};