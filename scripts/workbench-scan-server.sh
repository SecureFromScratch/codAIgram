#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"
printf 'Building the scanner and its referenced packages...\n'
npx tsc -b scanner --pretty false

readonly SCAN_FOLDERS="codAIgram-bridge,scan_shared,bridge-protocol"
printf 'Scanning class and interface declarations in:\n'
printf '  %s\n' 'codAIgram-bridge' 'scan_shared' 'bridge-protocol'
exec node scanner/dist/index.js codaigram-bridge "$SCAN_FOLDERS" --types class --server-url http://127.0.0.1:3001 "$@"
