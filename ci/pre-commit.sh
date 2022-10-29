#!/bin/bash

set -euo pipefail

export PS4='$(printf '=%.0s' {0..${SHLVL}}) ${BASH_SOURCE}:${LINENO} '

KIND=$(git rev-parse --abbrev-ref HEAD | cut -d '/' -f1)
STORY=$(git rev-parse --abbrev-ref HEAD | cut -d '/' -f2)

KIND_KINDS='feature|fix'

if [[ ! "$KIND" =~ $KIND_KINDS ]]; then 
    echo "'$KIND' is an unsupported kind. We expect branch to be ($KIND_KINDS)/story/[task]"
    exit 1
fi 

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SPEC_DIR="$ROOT_DIR/spec"

shopt -u nullglob

for f in "$SPEC_DIR/"????"$STORY"; do
    if [ -d "$f" ]; then
        echo "'$f' is a good spec"
        exit 0
    fi
done

if [ -d "$SPEC_DIR/$STORY" ]; then
    echo "'$SPEC_DIR/$STORY' is a good spec"
    exit 0
fi

echo "'$STORY' is not a story under $SPEC_DIR"
exit 1
