#!/bin/bash

set -exuo pipefail

npx lerna bootstrap
npx lerna link

npm run tsc
npx lerna run test