#!/bin/bash

set -euo pipefail

export PS4='$(printf '=%.0s' {0..${SHLVL}}) ${BASH_SOURCE}:${LINENO} '

STORY=$(git rev-parse --abbrev-ref HEAD | cut -d '/' -f2)
TASK=$(git rev-parse --abbrev-ref HEAD | cut -d '/' -f3)

PREPEND="[$STORY|${TASK:--}]"

COMMIT_FILE="$1"

if ! grep --silent --fixed-strings "$PREPEND" "$COMMIT_FILE" ; then
    sed -i "s/^/$PREPEND /" "$COMMIT_FILE"
fi