#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"
export GOOGLE_CLOUD_PROJECT='demo-codaigram'
export FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'

npx tsc -b server
npx tsc -b server --watch --preserveWatchOutput &
readonly TYPESCRIPT_WATCHER_PID="$!"

cleanup() {
  kill "$TYPESCRIPT_WATCHER_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM
node --watch server/dist/index.js
