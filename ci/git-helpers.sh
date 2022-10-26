#!/bin/bash

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"

function list-changed-files() {
    ( 
        cd "$ROOT_DIR" && \
        git log --name-only --pretty=oneline 'main..HEAD' | grep -E 'modules/|src' | sort | uniq 
    )
}

function list-changed-modules() {
    local CHANGED
    CHANGED=$(list-changed-files)
    
    npx lerna list --json |\
        jq -r '.[].location' |\
        xargs realpath --relative-to "$ROOT_DIR" |\
        xargs -I{} bash -c "echo '$CHANGED' | grep --silent {} && echo {}" |\
        xargs -I{} jq -r '.name' "$ROOT_DIR/{}/package.json"
}