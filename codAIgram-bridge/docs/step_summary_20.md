# Step 20 Summary - UBG001 Nullish Findings

## Changes

Added the `neverthrow` runtime dependency and represented the extension's output, HTTP server, WebSocket server, and connection-status lifecycle slots with `Result` rather than assigning undefined. Connection URL commands and upgrade handling reject missing or non-TCP listener addresses before accessing the port; the Origin, Host, token, and single-client checks remain in place. The integration runner uses `Result` for the optional HTTPS fixture, and the test helpers omit absent Origin headers without passing explicit undefined. Void test doubles no longer explicitly return undefined. Node's nullable listener address is checked at its boundary. One exception comment remains where a test deliberately makes `Server.address()` return null to reproduce the Node API's unbound state.

## Files changed

- `package.json` and `package-lock.json`: add `neverthrow`.
- `src/extension.ts`, `src/listenerStartup.ts`: lifecycle and address checks.
- `tests/runTest.ts`, `tests/suite/extension.helpers.ts`, `extension.test.ts`, `connectionStatus.case.ts`, `listenerStartup.case.ts`, `extension04.case.ts`, `extension05.case.ts`, `extension07.case.ts`, `extension14.case.ts`: fixture and external boundary adjustments.
- `docs/step_summary_20.md`: this record.

## Baseline and RED

The initial gate inventory contained 44 UBG001 diagnostics. No new functional RED was observed: this is a refactor of existing behavior covered by existing tests. The initial gate failure is not a functional RED.

## Validation

- `npm run compile:typescript`: passed.
- `npm run check:gates`: UBG001 0; 273 diagnostics from other gates remain, so the overall gate check fails.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: passed with exit code 0: auth scenario 16 passing and 1 pending, concurrency 4 passing, shutdown 4 passing. The HTTPS case is intentionally pending on Linux.
- `npm run verify`: failed because this project has no verify script.

The offline `neverthrow` installation failed due to an empty npm cache; the sandboxed network install stalled and was interrupted, then an escalated install succeeded. No source or dependency outside the project was modified.
