#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"
export GOOGLE_CLOUD_PROJECT='demo-codaigram'
export FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'

npx tsc -b server
exec npm run start:server
