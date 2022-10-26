#!/bin/bash 

set -euxo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/git-helpers.sh"

CHANGED=$(list-changed-modules)

HAS_TO_BUMP=0
TO_BUMP=''

for mod in $CHANGED; do 
    REMOTE=$(npm info "$mod" --json | jq -r ._id)
    LOCAL=$(npx lerna exec --scope "$mod" -- jq -r "'.name + \"@\" + .version'" package.json)
    
    if [ "$REMOTE" = "$LOCAL" ]; then
        TO_BUMP="$TO_BUMP
        $mod"
        HAS_TO_BUMP=$(( HAS_TO_BUMP + 1 ))
    fi 
done

if [ $HAS_TO_BUMP -gt 0 ]; then
    set +x
    printf "%s packages need version bump:\n%s" "$HAS_TO_BUMP" "$TO_BUMP" 
    exit 1
fi
# REMOTE=$(list-changed-modules | xargs -I{} bash -c 'npm info {} --json | jq -r ._id' | sort)

# LOCAL=$(list-changed-modules | xargs -I{} npx lerna exec --scope {} -- jq -r "'.name + \"@\" + .version'" package.json | sort)

# diff -u <(echo "$REMOTE") <(echo "$LOCAL") 