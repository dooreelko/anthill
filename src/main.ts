import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { build as buildLocal } from './local-run';
import { DockerProvider } from "@cdktf/provider-docker";

export const build = () => {
    class DorcStack extends TerraformStack {
        constructor(scope: Construct, name: string) {
            super(scope, name);

            new DockerProvider(this, "docker", {});
        };
    }

    const app = new App();
    const stack = new DorcStack(app, "dorc-implmementation");

    buildLocal(stack);

    return app;
}