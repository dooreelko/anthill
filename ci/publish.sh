#!/bin/bash

set -exuo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

"$SCRIPT_DIR/publish-check.sh"

npx lerna publish --no-bail from-package

# for pkg in $(list-packages-needing-publish | cut -d ' ' -f1); do
#     echo npx lerna --scope "$pkg" exec --no-bail -- npm publish
# done