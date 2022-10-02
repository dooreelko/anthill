import * as path from 'path';

import { TerraformOutput, TerraformStack, TerraformVariable } from 'cdktf';
import * as aws from '@cdktf/provider-aws';
import * as zip from '@cdktf/provider-archive';

import { findBuildContextRoot } from '@arinoto/core';
import { mainServer } from './aws-architecture';
import { buildRouteKey, splitStageAndPath } from './aws/tools';

/** CONCRETE SOLUTION IMPLEMENTATION */

const kebabize = (text: string) => text
    .replaceAll(/[^\w]/g, '-')
    .replaceAll('--', '-')
    .replaceAll('--', '-');

const nameit = (subj: string) => kebabize(`${mainServer.name}-${subj}`);

export const build = (stack: TerraformStack) => {
    const profile = new TerraformVariable(stack, 'profile', {
        type: 'string'
    });

    const region = new TerraformVariable(stack, 'region', {
        type: 'string',
        default: 'eu-west-1'
    });

    new aws.AwsProvider(stack, 'aws', {
        profile: profile.stringValue,
        region: region.stringValue
    });

    new zip.ArchiveProvider(stack, 'zipper');

    const distDir = path.join(findBuildContextRoot(__dirname), 'dist');

    const lambdaLayerArchive = new zip.DataArchiveFile(stack, 'lambda-layer-zip', {
        type: 'zip',
        outputPath: path.join(distDir, 'lambda-layer.zip'),
        sourceDir: path.join(distDir, 'lambda', 'layer')
    });

    const lambdaLayer = new aws.lambdafunction.LambdaLayerVersion(stack, 'lambda-layer', {
        layerName: mainServer.name,
        filename: lambdaLayerArchive.outputPath
    });

    const lambdaArchive = new zip.DataArchiveFile(stack, 'lambda-zip', {
        type: 'zip',
        outputPath: path.join(distDir, 'lambda-code.zip'),
        sourceDir: path.join(distDir, 'lambda', 'function')
    });

    const api = new aws.apigatewayv2.Apigatewayv2Api(stack, 'api', {
        name: mainServer.name,
        protocolType: 'HTTP'
    });

    const apiCallLambdaRole = new aws.iam.IamRole(stack, 'call-lamba-role', {
        name: nameit('api-gateway-run-lambda'),
        assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: {
                        Service: 'apigateway.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'
                }
            ]
        })
    });

    const functions = mainServer.listener.apis.map(apiDef => {
        const apiName = `${apiDef.spec.method}-${apiDef.spec.path}`;
        const apiNameKebab = nameit(apiName);
        const lambdaRole = new aws.iam.IamRole(stack, `lamba-role-${apiNameKebab}`, {
            name: nameit(apiName),
            assumeRolePolicy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }
                ]
            }),
            managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
        });

        const lambdaFunction = new aws.lambdafunction.LambdaFunction(stack, `function-${apiNameKebab}`, {
            layers: [
                lambdaLayer.arn
            ],
            functionName: apiNameKebab,
            role: lambdaRole.arn,
            filename: lambdaArchive.outputPath,
            runtime: 'nodejs16.x',
            handler: 'src/run-lambda.handler',
            environment: {
                variables: {
                    ANTHILL_RUNTIME: mainServer.name
                }
            },
            sourceCodeHash: lambdaArchive.outputMd5
        });

        const integration = new aws.apigatewayv2.Apigatewayv2Integration(stack, `call-${apiNameKebab}`, {
            apiId: api.id,
            integrationType: 'AWS_PROXY',
            credentialsArn: apiCallLambdaRole.arn,
            integrationUri: lambdaFunction.invokeArn,
            payloadFormatVersion: '2.0'
        });

        const { stage } = splitStageAndPath(apiDef.spec.path);
        const route = new aws.apigatewayv2.Apigatewayv2Route(stack, `route-${apiNameKebab}`, {
            apiId: api.id,
            routeKey: buildRouteKey(apiDef.spec),
            target: `integrations/${integration.id}`
        });

        return { func: lambdaFunction, route, stage };
    });

    const funcArns = functions.map(({ func }) => func.arn);

    apiCallLambdaRole.putInlinePolicy([{
        name: 'callLambda',
        policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: 'lambda:InvokeFunction',
                    Resource: funcArns
                }
            ]
        })
    }]);

    const stages = [...new Set(functions.map(({ stage }) => stage))];

    if (stages.length !== 1) {
        throw new Error(`Found multiple stages for the same API: ${JSON.stringify(stages)}, but only one is allowed.`);
    }

    const stage = new aws.apigatewayv2.Apigatewayv2Stage(stack, 'hello-stage', {
        apiId: api.id,
        name: stages[0],
        autoDeploy: true
    });

    new TerraformOutput(stack, mainServer.name, {
        value: stage.invokeUrl
    });
};
