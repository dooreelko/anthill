import { App, TerraformStack } from 'cdktf';
import { build as buildLocal } from './local-docker-build';
import { build as buildAws } from './aws-build';

export const build = () => {
    class DorcStack extends TerraformStack {
    }

    const app = new App();
    const stack = new DorcStack(app, 'anthill-hello-world');

    if (process.env.ANTHILL_TARGET === 'aws') {
        buildAws(stack);
    } else {
        buildLocal(stack);
    }

    console.error('Solution built. Ready to rumble.');

    return app;
};

if (require.main === module) {
    build().synth();

    console.log('exiting as this is only synth');
    process.exit(0);
}