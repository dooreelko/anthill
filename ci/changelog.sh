#!/bin/bash

set -euo pipefail

ROOT_DIR="$(npx lerna list --json --all --scope @arinoto/root | jq -r .[].location)"
SCRIPT_DIR="$ROOT_DIR/ci"
SPEC_DIR="$ROOT_DIR/spec"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/helpers.sh"

log "updating changelog..."

STORY=$(feature-story)
export STORY

STORY_KIND=$(feature-kind)
export STORY_KIND

STORY_DIR="$(feature-dir "$STORY")"

if [ -z "$STORY_DIR" ]; then
    echo "'$STORY' is not a story under $SPEC_DIR"
    exit 1
fi 

STORY_DOC="$STORY_DIR/design.md"

if [ ! -f "$STORY_DOC" ]; then
    echo "$STORY_DOC file does not exist."
    exit 1
fi

STORY_DOC_REL=$(realpath --relative-to "$ROOT_DIR" "$STORY_DOC")
export STORY_DOC_REL

NOW=$(date +%Y-%m-%d)

MD=$(pandoc "$STORY_DOC" -t json \
    | jq -r '{
        blocks: [
            .blocks[0], 
            (.blocks[1] | select(.t == "Para"))
        ], 
        "pandoc-api-version": .["pandoc-api-version"], 
        meta: .meta}' \
    | pandoc -f json -t gfm)
    
HEAD=$(echo "$MD" | head -n 1 | sed "s/^#/$NOW [$STORY_KIND] /")
export HEAD

TAIL=$(echo "$MD" | tail -n +2)
export TAIL

NEW_CL=$(jq '[.[] | select(.story != env.STORY)] | . as $rest | [
{
    story: env.STORY,
    title: env.HEAD,
    desc: env.TAIL,
    doc: env.STORY_DOC_REL
}] + .' "$ROOT_DIR/changelog.json")

function report-packages-needing-publish() {
    PKGS=$(npx lerna list --no-private --json | jq -r '.[].name')

    for pkg in $PKGS; do
        REMOTE=$(npm info "$pkg" --json | jq -r '.version')
        LOCAL=$(npx lerna list --scope "$pkg" --json | jq -r '.[] | .version')

        if [ "$REMOTE" != "$LOCAL" ]; then
            printf " - %s %s->%s\n" "$pkg" "$REMOTE" "$LOCAL"
        fi
    done
}

TO_PUBLISH=$(report-packages-needing-publish)

(
    echo "# Arinoto changelog"
    echo
    echo "$NEW_CL" \
        | tee "$ROOT_DIR/changelog.json" \
        | jq -r '.[] | "## " + .title + "\n" + .desc + "\n[More information](<" + .doc + ">)\n"'

    if [ -n "$TO_PUBLISH" ]; then
        echo "### Modules changed:"
        echo "$TO_PUBLISH"
    fi
) > "$ROOT_DIR/CHANGELOG.md"

if ! git diff --exit-code "$ROOT_DIR/CHANGELOG.md"; then 
    git add "$ROOT_DIR/CHANGELOG.md" "$ROOT_DIR/changelog.json"
    git commit --amend --reuse-message=HEAD --no-verify
fi