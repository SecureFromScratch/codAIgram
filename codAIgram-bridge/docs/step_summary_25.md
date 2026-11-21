# Step 25 Summary - Versioned Welcome

## Change

An authenticated WebSocket connection now receives a JSON text message with exactly `{ "version": 1, "type": "welcome" }` as its first application message. Authentication, single-use token handling, and connection lifecycle remain unchanged. This step adds no RPC framework or other protocol operations.

## Files changed

- `src/extension.ts`: send the versioned JSON welcome.
- `tests/suite/extension.concurrent-token-connections.case.ts`, `extension.consume-token-after-failed-auth.case.ts`, `extension.reject-invalid-host.case.ts`, `extension.renew-token-after-disconnect.case.ts`, `extension.trusted-origin-required.case.ts`, `extension.reject-dns-rebinding.case.ts`, and `extension.https-localhost-websocket.case.ts`: parse and check the welcome in direct and browser tests.
- `tests/runTest.ts`: the independent shutdown client recognizes the same message before reporting an open connection.
- `docs/connection_security_design.md`: document the current welcome and the existing Linux HTTPS limitation.
- `docs/step_summary_25.md`: this record.

## RED

After changing tests and before changing production, `npm run compile` passed the gates and TypeScript. `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1: the authentication scenario had 10 passing, 1 pending, and 6 failing. Two tests directly reported `SyntaxError: Unexpected token 'H', "Hello" is not valid JSON`; later failures followed a test leaving a single-use session active after the assertion failure. The production greeting was still `Hello` during this run. The RED was rerun to capture full diagnostic detail; results were the same.

## GREEN

- `npm run compile`: passed; BuildGates reported no diagnostics and TypeScript compiled.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: passed with exit code 0 using cached VS Code 1.146.0. Authentication reported 16 passing and 1 pending; concurrency and shutdown scenarios passed, with shutdown reporting 4 passing. The Linux HTTPS browser case is the existing intentional skip.
- `npm run verify`: unavailable because this package has no verify script.

## Deviations

The existing HTTPS browser case could not run on Linux because certificate trust setup is unsupported; its assertion was updated and will run on the supported Windows path. The full Linux suite passed with that one case pending. No changes were made to progress documentation.
