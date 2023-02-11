# NPM dependency copier

```
dep-copy <src_dir> <dst_dir>. 
Recursively copy only production parts of node_modules
```

This tool recursively walks productive dependencies of a module found in
`src_dir` and places them flatly under `node_modules` under `dst_dir`.

Node's module resolution mechanics is used to find the dependency, so if it's in
a parent folder somewhere, it's still discovered.

## Known limitations

Package versions are ignored, and each package is discovered only once. This
means that if you have the same package somewhere in dependencies multiple times
with different versions, only the first found will be copied.
