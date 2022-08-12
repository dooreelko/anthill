// export type AwsLoadBalancer = {
//     listener: {
//         port: number;
//         apis: {
//             api: Api;
//             spec: ApiContext;
//         }[];
//     }
// };

// const loadBalancer: AwsLoadBalancer = {
//     listener: {
//         port: 443,
//         apis: [
//             {
//                 api: apiRunTask,
//                 spec: {
//                     method: 'POST',
//                     path: 'v1/tasks/run'
//                 },
//             },
//             {
//                 api: apiListTasks,
//                 spec: {
//                     method: 'GET',
//                     path: 'v1/tasks'
//                 },
//             }
//         ]
//     }
// };

