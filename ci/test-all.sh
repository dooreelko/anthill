#!/bin/bash

set -exuo pipefail

npm run tsc
npx lerna run test