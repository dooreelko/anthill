#!/bin/bash

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
PS4='$(printf '=%.0s' {0..${SHLVL}}) ${BASH_SOURCE}:${LINENO} '

if [ -n "${DEBUG:-}" ]; then
    set -x
fi

ENDCOLOR="\e[0m";
GREEN="\e[32m"
RED="\e[31m"

function log() {
    >&2 echo -e "${GREEN}${1}${ENDCOLOR}" 
}

function err() {
    >&2 echo -e "${RED}${1}${ENDCOLOR}" 
}

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

function list-packages-needing-publish() {
    PKGS=$(npx lerna list --no-private --json | jq -r '.[].name')

    for pkg in $PKGS; do
        REMOTE=$(npm info "$pkg" --json | jq -r '.version')
        LOCAL=$(npx lerna list --scope "$pkg" --json | jq -r '.[] | .version')

        if [ "$REMOTE" != "$LOCAL" ]; then
            echo "$pkg"
        fi
    done
}

function feature-kind() {
    git rev-parse --abbrev-ref HEAD | cut -d '/' -f1
}

function feature-story() {
    git rev-parse --abbrev-ref HEAD | cut -d '/' -f2
}

function feature-task() {
    git rev-parse --abbrev-ref HEAD | cut -d '/' -f3
}

function feature-dir() {    
    ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
    SPEC_DIR="$ROOT_DIR/spec"

    shopt -u nullglob

    STORY=${1:-$(feature-story)}

    for f in "$SPEC_DIR/"????"$STORY"; do
        if [ -d "$f" ]; then
            echo "$f"
            return 
        fi
    done

    if [ -d "$SPEC_DIR/$STORY" ]; then
        echo "$SPEC_DIR/$STORY"
        return
    fi
}