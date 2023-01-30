# Arinoto changelog

## 2023-01-30 [fix]  Vis binaries using bin-dir

That was a neat idea, but seems like wile npm and yarn respect
`directories.bin` when run directly, lerna’s on-the-fly modification of
package.json somehow breaks it.
[More information](<spec/vis-bin/design.md>)

## 2023-01-04 [feature]  Cluster together things of same class in diagrams

The idea is to have APIs (and maybe more) grouped visually together in
the diagram. Also nice to have them on the left side of the diagram.
[More information](<spec/cluster-vis/design.md>)

## 2022-11-12 [feature]  Inline markdown editor.

[More information](<spec/remarkeded/design.md>)

## 2022-10-31 [feature]  Ticketing within repo

Design specifications and ticketing integrated in the project’s
repository.
[More information](<spec/000 ticketing/design.md>)

### Modules changed:
 - @arinoto/vis 1.3.1->1.3.2
