#!/bin/bash

set -exuo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

"$SCRIPT_DIR/publish-check.sh"

echo npx lerna exec --no-private --no-bail -- npm publish