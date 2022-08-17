import { draw } from '@anthill/vis';

import { build } from "./main";
import * as arch from "./architecture";

build();

draw([
    arch.apiListTasks,
    arch.apiRunTask,
    arch.apiGetTask,
    arch.apiGetTaskHistory,

    arch.listTasksFunction,
    arch.runTaskFunction,
    arch.getTaskFunction,
    arch.submitTaskFunction,

    // arch.taskStateFunction,

    arch.taskQueue,
    // arch.taskStore,
    arch.scaler,
    // arch.containerStateTopic,
    // arch.taskStateTopic,
    // arch.containerRuntime,
    // arch.taskQueuePoller,
]);