#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly STATE_DIRECTORY="$PROJECT_ROOT/.workbench/firestore"

mkdir -p "$STATE_DIRECTORY"
cd "$PROJECT_ROOT"

if [[ -f "$STATE_DIRECTORY/firebase-export-metadata.json" ]]; then
  exec firebase emulators:start --only firestore --project demo-codaigram --import "$STATE_DIRECTORY" --export-on-exit "$STATE_DIRECTORY"
fi

exec firebase emulators:start --only firestore --project demo-codaigram --export-on-exit "$STATE_DIRECTORY"
