# Step 33 Summary - Duplicate Pending Request IDs

## Change

A validated request whose ID belongs to a pending editor wait now clears pending waits and their timers, then closes the WebSocket with code 1008. It sends no duplicate-ID error. This also applies when a cancellation uses its own target's pending ID. The protocol requires unique in-flight IDs and requires clients to treat a connection close as failure of all outstanding requests.

## Files changed

- `src/extension.ts`: clear pending work and close on duplicate pending ID.
- `tests/suite/extension.duplicate-request-id.case.ts`, `tests/suite/extension.test.ts`: real-host coverage for duplicate ping and cancellation, absence of messages before closure, reconnection and absence of the old wait.
- `tests/suite/extension.concurrent-editor-waits.case.ts`, `tests/suite/extension.cancel-editor-wait.case.ts`: remove expectations for the former ambiguous error while retaining other behavior checks.
- `docs/application_protocol.md`: document the duplicate-ID and connection-failure contract.
- `docs/step_summary_33.md`: this record.

## RED

Test-only `npm run compile` passed after correcting initial BuildGates formatting and annotation findings. Against unchanged production, `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1: **26 passing, 1 pending, 1 failing**. The duplicate-ID test timed out waiting for closure because the old implementation sent an error and kept the socket open. This was a functional RED.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across the real VS Code 1.146.0 authentication, concurrency and shutdown scenarios. Authentication reported **27 passing, 1 pending**; shutdown reported **5 passing**. The HTTPS case remains pending on Linux.
- `npm run verify`: failed because this package has no `verify` script.

## Limitations

The reconnect assertion checks that the old target is absent; timer disposal is also exercised by the existing focused registry cleanup test. General ordering of asynchronously validated requests is outside this step. No progress documentation was modified.
