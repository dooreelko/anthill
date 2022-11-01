#!/bin/bash

set -exuo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

"$SCRIPT_DIR/publish-check.sh"

npm run tsc
npx lerna publish from-package --no-git-reset --yes
