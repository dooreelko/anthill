import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { build as buildLocal } from './local-docker-run';

export const build = () => {
    class DorcStack extends TerraformStack {
        constructor(scope: Construct, name: string) {
            super(scope, name);
        };
    }

    const app = new App();
    const stack = new DorcStack(app, "dorc-implmementation");

    buildLocal(stack);

    return app;
}