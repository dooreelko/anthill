#!/bin/bash

set -exuo pipefail

npx yarn install

npx lerna bootstrap --force-local
npx lerna link
