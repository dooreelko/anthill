import { runtimeRegistry } from "@anthill/core";
import { runApiServer } from "@anthill/local-docker";
import { build } from "./main";

build();

runApiServer(runtimeRegistry());
