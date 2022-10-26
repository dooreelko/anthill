#!/bin/bash

set -exuo pipefail

npm install

npx lerna bootstrap --force-local
npx lerna link
