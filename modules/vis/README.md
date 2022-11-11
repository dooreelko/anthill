# Vis

## Generate solution diagrams from code.
In essence, the tools detect variables and new expressions of certain types and translate that in a relationship graph. E.g. given

```typescript 
interface IArchMarker {}

class Foo implements IArchMarker {}
class Bar implements IArchMarker {
    constructor(private rel: Foo) {}
}

const fooNode = new Foo();
const barNode = new Bar(fooNode);

```
after executing 
`vis --acceptTypes IArchMarker`

will produce something akin to
```
┌───────────────────┐          ┌──────────────────┐
│                   │          │                  │
│   barNode: Bar    ├──────────►   fooNode: Foo   │
│                   │          │                  │
└───────────────────┘          └──────────────────┘
```

There are two tools available:

## Vis

The all-in-one tool to generate an SVG from a codebase.

```
<? @exec {shell} node ./bin/vis --help ?> 
```

## Code2graph

Prints a JSON of the graph to the stdout.
Here's an example from `@arnoto/hello-world.architecture`, using 

```typescript
export const helloFunc = new Func<void, { message: string }>({
    code: () => ({ message: 'hello world' })
});

export const helloApi = new Api<void, { message: string }>({
    target: helloFunc
});
```


```json
❯ ./node_modules/.bin/code2graph
[
  {
    "name": "helloFunc",
    "class": "Func",
    "refs": [
      "helloApi"
    ]
  },
  {
    "name": "helloApi",
    "class": "Api",
    "refs": []
  }
]
```

```
<? @exec ./bin/code2graph --help ?> 
```

## On ts project references
By default, typescript will use d.ts files for cross-project references.
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