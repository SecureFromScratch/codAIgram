# Step 28 Summary - Inbound Message Size Limit

## Change

Configured the WebSocket server's `maxPayload` to 65,536 bytes. The library enforces the limit across fragments before delivering a message for application parsing and closes oversized connections with WebSocket status 1009. Messages at the limit remain accepted. Authentication and the application protocol are unchanged.

## Files changed

- `src/extension.ts`: set the `ws` server's inbound payload limit.
- `tests/suite/extension.message-size-boundary.case.ts`: send an exactly 65,536-byte UTF-8 JSON ping and check its pong.
- `tests/suite/extension.oversized-fragments.case.ts`: send a 65,537-byte message in two fragments and check close status 1009.
- `tests/suite/extension.test.ts`: register both cases.
- `docs/application_protocol.md`: document byte limit, fragments, and close behavior.
- `docs/step_summary_28.md`: this record.

## RED

With tests added and production unchanged, `npm run compile` passed BuildGates and TypeScript. `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1 using project-local VS Code 1.146.0: **20 passing, 1 pending, 1 failing** in authentication. The exact-limit ping passed; the fragmented 65,537-byte case timed out waiting for the expected close. The RED was rerun to capture the complete result, with the same outcome. The pending test was the pre-existing Linux HTTPS skip.

## GREEN

- `npm run compile`: passed all BuildGates, TypeScript compilation and adapter bundling.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across authentication, concurrency and shutdown scenarios using VS Code 1.146.0. Both new boundary cases were registered in the successful authentication scenario; concurrency and shutdown each reported 4 passing. The Linux HTTPS case remains intentionally pending. The authentication count was not captured because verbose host output was truncated.
- `npm run verify`: unavailable because this project has no verify script.

## Limitations

The oversized test covers fragmented text frames; the `ws` option applies to both text and binary messages. The Linux HTTPS browser case remains pending. Progress documentation was not modified.
