import { runtimeRegistry } from "@arinoto/core";
import { runApiServer } from "@arinoto/local-docker";
import { build } from "./main";

build();

runApiServer(runtimeRegistry());
