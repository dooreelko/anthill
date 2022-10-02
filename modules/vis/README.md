# Vis

Generate solution diagrams from code.

## On ts project references
By default, typescript will use d.ts files for cross-project refereces.
If, on the other hand, the library's package.json specifies `types` field to
point to `src/main.ts`, then the actual initialisation is found and references
are detected correctly.

E.g. good:

```typescript
export const helloFunc = new Func<void, { message: string }>({
    code: () => ({ message: 'hello world' })
});

export const helloApi = new Api<void, { message: string }>({
    target: helloFunc
});

```

Not so good (the `target: helloFunc` is lost): 
```typescript
export declare const helloFunc: Func<void, {
    message: string;
}>;
export declare const helloApi: Api<void, {
    message: string;
}, void & Object>;

```