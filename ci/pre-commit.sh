#!/bin/bash

set -euo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"
SPEC_DIR="$ROOT_DIR/spec"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

KIND=$(feature-kind)

KIND_KINDS='feature|fix'

if [[ ! "$KIND" =~ $KIND_KINDS ]]; then 
    echo "'$KIND' is an unsupported kind. We expect branch to be ($KIND_KINDS)/story/[task]"
    exit 1
fi 

STORY=$(feature-story)

if [ -z "$(feature-dir "$STORY")" ]; then
    echo "'$STORY' is not a story under $SPEC_DIR"
    exit 1
fi 
