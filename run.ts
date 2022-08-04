import { runtimeRegistry } from "./src/anthill/runtime";
import { build } from "./src/main";

build();

if (process.argv.length < 2) {
    console.error(`Missing script to run argument (and params) in ${JSON.stringify(process.argv)}`);
    process.exit(1);
}

const runtimeToRun = process.argv[2];

const runtime = runtimeRegistry.get(runtimeToRun);
if (!runtime) {
    console.error(`Runtime registry has no entry for ${runtimeToRun} from ${JSON.stringify(process.argv)}`);
    process.exit(1);
}

runtime();