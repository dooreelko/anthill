#!/bin/bash

set -exo pipefail

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform destroy -auto-approve || true)

npm run build
node .

(cd cdktf.out/stacks/dorc-implmementation/ && terraform init && terraform apply -auto-approve )