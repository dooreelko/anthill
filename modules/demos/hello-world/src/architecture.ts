
import {
    Func, Api
} from "@anthill/core";

// Architectural entities

export const helloFunc = new Func<void, { message: string }>({
    code: () => ({ message: 'hello world' })
});

export const helloApi = new Api<void, { message: string }>({
    target: helloFunc
});
