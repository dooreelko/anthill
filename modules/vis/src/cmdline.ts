import yargs from 'yargs';

const toRegexes = (vals: string[]) => vals.map(v => new RegExp(v));

export type RuntimeConfig = {
    acceptTypes: RegExp[];
    includeFiles: RegExp[];
    excludeFiles: RegExp[];
    tsConfigPath: string;

    verbose: boolean;

    log: {
        verbose: (...what: unknown[]) => void;
        error: (...what: unknown[]) => void;
    }
};

export type VisRuntimeConfig = RuntimeConfig & {
    clusterAllTypes: boolean;
    clusterNone: boolean;
    clusterTypes: RegExp[];
};

export const commonOptions: Record<string, yargs.Options> = {
    acceptTypes: {
        type: 'string',
        array: true,
        default: ['Archetype', '.*TerraformResource.*'],
        describe: "List of regexes of base classes/types to include.",
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
        describe: 'List of regexes of files to exclude.',
        coerce: toRegexes
    },
    verbose: {
        boolean: true,
        default: false,
        describe: 'Print debugging info onto stderr'
    },
    tsConfigPath: {
        type: 'string',
        default: './tsconfig.json',
        describe: 'Path of the tsconfig.json'
    }
};

export const visOptions: Record<string, yargs.Options> = {
    clusterAllTypes: {
        type: 'boolean',
        array: false,
        default: false,
        describe: "When specified will visually cluster all nodes of the same type",
    },
    clusterTypes: {
        type: 'string',
        array: true,
        default: ['Api'],
        describe: "List of regexes of base classes/types to cluster together. Defaults to `Api`",
        coerce: toRegexes
    },
    clusterNone: {
        type: 'boolean',
        array: false,
        default: false,
        describe: "Don't cluster together any types. When present, wins over any other clustering options.",
    },
};

export const argv = async <T extends Record<string, yargs.Options>>(desc: string, customOpts: T) => yargs(process.argv.slice(2))
    .parserConfiguration({ 'unknown-options-as-args': true })
    .usage(`${desc}`)
    .options({
        ...commonOptions,
        ...customOpts
    })
    .argv;

export const cmdArgs = async <T extends RuntimeConfig>(name: string, customOpts: Record<string, yargs.Options> = {}) => {
    const args = await argv(name, customOpts);

    const tsConfigPath = ([...args._, ''][0]) ?? args.tsConfigPath;
    const excludeFiles = args.excludeFiles;

    return {
        ...args,
        tsConfigPath,
        excludeFiles,

        log: {
            verbose: (...what: unknown[]) => {
                if (args.verbose) {
                    console.error(...what);
                }
            },
            error: console.error
        }

    } as unknown as T;
};