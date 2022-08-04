export type PartialThingOrFunc<T> = Partial<T>;

export type Extendo<T> = {
    extend(whatWith: Partial<T>): void;
}

/**
 * A pseudo-abstract class that can be at runtime bound to additional
 * implementations of the what it claims to be.
 */
export class Gradual<T> {
    implementations: Partial<T>[] = [];

    constructor(...impls: PartialThingOrFunc<T>[]) {
        if (impls) {
            this.implementations = impls;
        }

        return new Proxy(this, {
            get(target: Gradual<T>, p: string | symbol, receiver: any): any {
                // console.error('getting', p, 'from', target);
                const impl = target.implementations.find(el => Object.hasOwn(el, p)) || target;
                // console.error('got', impl);
                if (!impl) {
                    throw new Error(`Implementation for '${String(p)}' has not been provided yet.`);
                }

                return (impl as any)[p];
            }
        });
    }

    /**
     * Add a partial implementation. The new one will take priority over existing.
     * @param whatWith additional partial implementation
     */
    extend(whatWith: Partial<T>): void {
        this.implementations = [
            whatWith,
            ...this.implementations,
        ];
    }
};

export const Graduate = <T>(...arg: Partial<T>[]) => new Proxy<{}>({}, {
    construct: () => {
        return new Gradual<T>(...arg);
    }
}) as (new () => T & Extendo<T>);
