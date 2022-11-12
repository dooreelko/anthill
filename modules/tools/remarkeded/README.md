# Inline editor for Markdown.

## Usage

```text generated
main.js replace a node in markdown with contents from STDIN

Options:
  --help      Show help                                                [boolean]
  --version   Show version number                                      [boolean]
  --selector  A CSS-like path selector to the node to replace[string] [required]
  --file      A path of the markdown file                    [string] [required]
  --verbose   Print input document's structure.       [boolean] [default: false]

```

## For example

Given this markdown

````markdown
# Hello 

## One
Lorem ipsum

## Two
```sh
cat 1.txt
```

## Three
world
````

To replace the `echo "Foo bar"` with something different, you can call it as

```sh
echo 'cat 2.txt' | remarkeded --selector 'code[lang=sh]' --file readme.md
```

## References

List of nodes: https://github.com/syntax-tree/mdast#nodes

List of supported selectors: https://github.com/syntax-tree/unist-util-select#support
