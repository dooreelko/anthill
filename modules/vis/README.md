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
Usage: vis -includeFiles regex1 regex2 -acceptTypes regex1 regex2 [-path]
[path/to/tsconfig.json]

Options:
      --help          Show help                                        [boolean]
      --version       Show version number                              [boolean]
      --acceptTypes   List of regexes of base classes/types to include. Defaults
                      to accept 'Archetype' and '.*TerraformResource.*'.
                        [array] [default: ["Archetype",".*TerraformResource.*"]]
      --includeFiles  List of regexes of files to include. Defaults to accept
                      any.                                 [array] [default: []]
      --excludeFiles  List of regexes of files to exclude. Defaults to
                      `maxim.*.ts`.            [array] [default: ["maxim.*.ts"]]
      --verbose       Print debugging info onto stderr[boolean] [default: false]
  -*, --tsConfigPath  Path of the tsconfig.json
                                           [string] [default: "./tsconfig.json"]     
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
Usage: code2graph -includeFiles regex1 regex2 -acceptTypes regex1 regex2 [-path] [path/to/tsconfig.json]

Options:
      --help          Show help                                        [boolean]
      --version       Show version number                              [boolean]
      --acceptTypes   List of regexes of base classes/types to include. Defaults
                      to accept 'Archetype' and '.*TerraformResource.*'.
                        [array] [default: ["Archetype",".*TerraformResource.*"]]
      --includeFiles  List of regexes of files to include. Defaults to accept
                      any.                                 [array] [default: []]
      --excludeFiles  List of regexes of files to exclude. Defaults to
                      `maxim.*.ts`.            [array] [default: ["maxim.*.ts"]]
      --verbose       Print debugging info onto stderr[boolean] [default: false]
  -*, --tsConfigPath  Path of the tsconfig.json
                                           [string] [default: "./tsconfig.json"]
```

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