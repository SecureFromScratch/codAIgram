#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"
npx tsc -p scanner/tsconfig.json
exec node scanner/dist/index.js server codaigram-server --types test --server-url http://127.0.0.1:3001
