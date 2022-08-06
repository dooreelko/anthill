#!/bin/bash

set -exo pipefail

SELF=$(dirname $0)

clear

"$SELF/unrun.sh"

npm run build
node .

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform apply -auto-approve )

sleep 5

curl localhost:8080/v1/task -vvv \
    --data '{"image": "ubuntu", "cmd": ["echo", "ok"]}' \
    --request POST --header "Content-Type: application/json" | jq

docker ps --format '{{ json .}}' \
    | jq -r .Names \
    | xargs -I{} bash -c 'echo === {} ===; docker logs {}'

curl localhost:8080/v1/tasks -vvv | jq .
