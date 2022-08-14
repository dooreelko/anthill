#!/bin/bash

set -exo pipefail

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform destroy -auto-approve || true)

docker container ls --all --format '{{ json . }}' \
    | jq -sr '.[] | select(.Image | contains("dorc")) | .ID' \
    | xargs docker container rm || true

