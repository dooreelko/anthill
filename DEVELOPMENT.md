# Working with this repository

## Tools required

This repository is heavily automated in bash. Apart from it, you need:
- `git`
- `node`
- `jq`
- `pandoc` for changelog-from-markdown generation

## Bootstrapping after clone

(assuming you have the tools above).

```sh
npx yarn && npx lerna bootstrap && npx lerna link
``` 

or just

```sh 
./ci/bootstrap.sh
```