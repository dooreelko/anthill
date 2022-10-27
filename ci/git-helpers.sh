#!/bin/bash

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"

function list-changed-files() {
    ( 
        cd "$ROOT_DIR" && \
        git log --name-only --pretty=oneline 'main..HEAD' | grep -E 'modules/|src' | sort | uniq 
    )
}

function list-changed-modules() {
    local CHANGEDS
    CHANGEDS=$(list-changed-files)
    
    npx lerna list --json |\
        jq -r '.[].location' |\
        xargs realpath --relative-to "$ROOT_DIR" |\
        xargs -I{} bash -c "echo '$CHANGEDS' | grep --silent {} && echo {} || true" |\
        xargs -I{} jq -r '.name' "$ROOT_DIR/{}/package.json"
}

function list-packages-needing-version-bump() {
    CHANGED=$(list-changed-modules)

    TO_BUMP=''

    for mod in $CHANGED; do 
        REMOTE=$(npm info "$mod" --json | jq -r ._id)
        LOCAL=$(npx lerna exec --loglevel silent --scope "$mod" -- jq -r "'.name + \"@\" + .version'" package.json)
        
        if [ "$REMOTE" = "$LOCAL" ]; then
            TO_BUMP="$TO_BUMP
            $mod"
        fi 
    done

    echo "$TO_BUMP"
}