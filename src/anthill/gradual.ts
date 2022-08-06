/**
 * THIS IS WHERE THE DIRTY LAUNDRY IS. LOOK AWAY.
 */

export type PartialThingOrFunc<T> = Partial<T>;

export type Extendo<T> = {
    extend<Sub extends Partial<T>>(whatWith: Sub): Sub;
}

export class Selfed<T> {
    protected _self?: T;

    set self(newVal: T) {
        this._self = newVal;
    }

    get self(): T {
        if (!this._self) {
            throw new Error('This class has no self yet');
        }

        return this._self;
    }
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

        return new Proxy({
            implementations: impls,
            extend(whatWith: Partial<T> & { self: T }): T {
                this.implementations = [
                    whatWith,
                    ...this.implementations,
                ];

                whatWith.self = this as unknown as T;

                return this as unknown as T;
            }
        }, {
            get(target: Gradual<T>, p: string, receiver: any): any {
                // console.error('getting', p, 'from', target, target.implementations);
                const extraImpl = target.implementations.find(el => new Set(Object.keys(el)).has(p) || !!(el as any)[p]);

                const ownKeys = new Set(Object.keys(target));
                const ownImpl = ownKeys.has(p) ? target : undefined;

                if (!extraImpl && !ownImpl) {
                    throw new Error(`Implementation for '${String(p)}' has not been provided yet. Neither in the self (${JSON.stringify(ownKeys)})`);
                }

                const impl = extraImpl || ownImpl;

                // console.error('got', extraImpl, (impl as any)[p]);
                return (impl as any)[p];
            }
        });
    }

    /**
     * Add a partial implementation. The new one will take priority over existing.
     * @param whatWith additional partial implementation
     */
    extend(whatWith: Partial<T> & { self: T }): T {
        return this as unknown as T;
    }
};

export const Graduate = <T>(...archArgs: Partial<T>[]) => new Proxy<{}>(Gradual, {
    construct: (_, constructArgs) => {
        return new Gradual<T>(...[...archArgs, ...constructArgs]);
    }
}) as (new (...constructArgs: Partial<T>[]) => T & Extendo<T>);
