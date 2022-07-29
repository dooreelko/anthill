import { whenLazyInitialised } from "./src/architecture";
import { build } from "./src/main";

build();
whenLazyInitialised();

if (process.argv.length < 3) {
    console.error(`Missing script to run argument (and params) in ${JSON.stringify(process.argv)}`);
    process.exit(1);
}

const scriptToRun = process.argv[2];
const scriptArgs = process.argv.slice(3);

const runner = require(`./${scriptToRun}`).run as (...args: string[]) => void;

runner(...scriptArgs);
