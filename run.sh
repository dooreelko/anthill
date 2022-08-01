#!/bin/bash

set -exo pipefail

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform destroy -auto-approve || true)

npm run build
node .

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform apply -auto-approve )

curl localhost:8080/v1/tasks -vvv &

docker ps --format '{{ json .}}' \
    | jq -r .Names \
    | xargs -I{} bash -c 'echo {}; docker logs {}'