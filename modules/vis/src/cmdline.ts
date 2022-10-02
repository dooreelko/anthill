import yargs from 'yargs/yargs';

const toRegexes = (vals: string[]) => vals.map(v => new RegExp(v));

export type ParseConfig = {
    acceptTypes: RegExp[];
    includeFiles: RegExp[];
    excludeFiles: RegExp[];
    tsConfigPath: string;

    verbose: boolean;
};

export const argv = async (name: string) => yargs(process.argv.slice(2))
    .usage(`Usage: ${name} -includeFiles regex1 regex2 -acceptTypes regex1 regex2 [-path] [path/to/tsconfig.json]`)
    .options({
        acceptTypes: {
            type: 'string',
            array: true,
            default: ['Archetype', '.*TerraformResource.*'],
            describe: "List of regexes of base classes/types to include. Defaults to accept 'Archetype' and '.*TerraformResource.*'.",
            coerce: toRegexes
        },
        includeFiles: {
            type: 'string',
            array: true,
            default: [],
            describe: 'List of regexes of files to include. Defaults to accept any.',
            coerce: toRegexes
        },
        excludeFiles: {
            array: true,
            default: ['maxim.*.ts'],
            describe: 'List of regexes of files to exclude. Defaults to `maxim.*.ts`.',
            coerce: toRegexes
        },
        verbose: {
            boolean: true,
            default: false,
            describe: 'Print debugging info onto stderr'
        },
        '*': {
            alias: 'tsConfigPath',
            type: 'string',
            default: './tsconfig.json',
            describe: 'Path of the tsconfig.json'
        }
    }).argv;

export const cmdArgs = async (name: string) => {
    const args = await argv(name);

    const tsConfigPath = args['*'];
    const fileFilters = args.files;
    const excludeFiles = args.excludeFiles;
    const typeFilters = args.classes;

    return {
        ...args,
        tsConfigPath,
        fileFilters,
        typeFilters,
        excludeFiles
    };
};