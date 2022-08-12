#!/bin/bash

set -exo pipefail

SELF=$(dirname $0)

clear

"$SELF/unrun.sh"

rm -rf dist
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

sleep 5

TASKS=$(curl localhost:8080/v1/tasks -vvv | jq .)
FIRST=$(echo "$TASKS" | jq -r '.[0].id')

curl "localhost:8080/v1/task/$FIRST" -vvv | jq .
curl "localhost:8080/v1/task/$FIRST/history" -vvv | jq .

curl "localhost:8080/v1/task/$FIRST/logs" -vvv | jq .

