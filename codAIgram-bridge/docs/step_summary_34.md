# Step 34 Summary - Ordered Request Dispatch

## Change

Each authenticated connection now chains text-message validation and dispatch in arrival order. Invalid JSON or envelopes do not prevent later messages from being processed; binary messages remain ignored. A failed validation or dispatch promise is logged and the chain continues. Registering an editor wait does not block later requests while the wait remains pending. Independent editor and timeout events can occur between request dispatches.

## Files changed

- `src/extension.ts`: per-connection promise chain for validation and dispatch.
- `tests/suite/extension.request-order.case.ts`, `tests/suite/extension.test.ts`: real-host coverage for malformed and binary frames followed immediately by a wait, its cancellation and a ping.
- `docs/application_protocol.md`: document request ordering and independent events.
- `docs/implementation_progress.md`: record completion.
- `docs/step_summary_34.md`: this record.

## RED

Test-only `npm run compile` passed. Against unchanged production, `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1 with **27 passing, 1 pending, 1 failing**. The later ping response arrived before the earlier cancellation acknowledgment and target error. The wait was registered successfully in that run; the observed functional failure was dispatch/response overtaking, not a cancellation overtaking its wait.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling. An initial UBG029 diagnostic on the rejection-handler syntax was corrected before the successful build.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across real VS Code 1.146.0 authentication, concurrency and shutdown scenarios. Authentication reported **28 passing, 1 pending**; shutdown reported **5 passing**. The HTTPS case remains pending on Linux.
- `npm run verify` was not run: inspection of `package.json` found no verify script.

## Limitations

The test verifies continuation after malformed and binary messages; it does not inject an unexpected validator or dispatch rejection. The chain has no explicit queue length or backpressure limit, so a client sending messages faster than validation can process them may accumulate queued work. Broader resource limits are outside this step.
