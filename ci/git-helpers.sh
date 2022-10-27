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