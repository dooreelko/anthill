#!/bin/bash 

if [ -z "${1:-}" ]; then
    echo "$(basename "$0") 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease' | 'from-git' "
    exit 1
fi

BUMP="$1"

set -euxo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/git-helpers.sh"

TO_BUMP=$(list-packages-needing-version-bump)

for mod in $TO_BUMP; do 
    npx lerna --scope "$mod" exec -- npm version "$BUMP"
done