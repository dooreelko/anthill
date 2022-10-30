#!/bin/bash 

set -euxo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

TO_BUMP=$(list-packages-needing-version-bump)
HAS_TO_BUMP=$(echo -n "$TO_BUMP" | wc -l)

if [ "$HAS_TO_BUMP" -gt 0 ]; then
    set +x
    printf "\n\n\n%s package(s) need version bump:\n%s" "$HAS_TO_BUMP" "$TO_BUMP" 
    exit 1
fi
