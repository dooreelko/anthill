#!/bin/bash

set -euo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

STORY=$(feature-story)
TASK=$(feature-task)

PREPEND="[$STORY|${TASK:--}]"

COMMIT_FILE="$1"

if ! grep --silent --fixed-strings "$PREPEND" "$COMMIT_FILE" ; then
    sed -i "s/^/$PREPEND /" "$COMMIT_FILE"
fi