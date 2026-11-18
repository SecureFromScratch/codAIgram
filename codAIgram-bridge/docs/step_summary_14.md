# Step 14 Summary - Explicit Null Origin Coverage

## Change

Added an integration assertion that sends the literal Origin value `null`, expects HTTP 401 before WebSocket upgrade, and then uses the same token with the configured trusted Origin to complete the WebSocket connection.

## Files Changed

- `src/test/suite/extension.test.ts` adds the explicit null Origin case to the existing Origin validation test.
- `docs/step_summary_14.md` records the test result.

## RED and GREEN

The implementation already rejects the literal `null` Origin. Therefore, the added assertion did not produce a functional RED against current production code, and no production changes were needed. This is recorded as a coverage gap closed, not as a successful RED-to-GREEN implementation cycle.

Command: `$env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test`

Executed as `yarivhp\yariv` so Chromium could use the approved CurrentUser Root development CA. The runner selected cached VS Code 1.146.0. The authentication and browser scenario passed 15 tests. The concurrency scenario passed 2 tests. The full command exited 0 and port cleanup verification passed.

## Deviations

No behavior changed. Origin validation remains exact allowlist matching, and rejection leaves the one-time token available for the subsequent approved-Origin connection.
