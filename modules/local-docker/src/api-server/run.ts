export const runApiServer = (runtimeRegistry: Map<string, () => void>) => {
    console.log('looking for runtime', process.argv);

    if (process.argv.length < 2) {
        console.error(`Missing script to run argument (and params) in ${JSON.stringify(process.argv)}`);
        process.exit(1);
    }

    const runtimeToRun = process.argv[2];

    const runtime = runtimeRegistry.get(runtimeToRun);
    if (!runtime) {
        console.error(`Runtime registry has no entry for ${runtimeToRun} from ${JSON.stringify(process.argv)}`, runtimeRegistry);
        process.exit(1);
    }

    console.log('found runtime', runtime, 'for', runtimeToRun);

    runtime();
}