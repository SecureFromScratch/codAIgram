# Step 27 Summary - Correlated Unsupported Request Error

## Change

A well-formed version 1 request with an unsupported type now receives `{ "version": 1, "type": "error", "id": "...", "code": "unsupported_request" }`. The response contains only the validated request ID and fixed fields; it does not echo the untrusted type. A well-formed envelope has exactly `version`, `type`, and `id`; the type is a non-empty string of at most 128 UTF-16 code units, and the existing ID bounds remain in force. Mandate and VV validate the entire envelope. Invalid JSON, invalid envelopes, and binary messages continue to be ignored. Ping/pong behavior remains unchanged.

## Files changed

- `src/pingValidation.ts`, `src/pingValidation.bundle.d.ts`: validate a strict request envelope and return its validated type and ID.
- `src/extension.ts`: return a fixed correlated error for unsupported valid types.
- `tests/suite/extension.unsupported-request.case.ts`, `extension.reject-invalid-ping.case.ts`, `extension.test.ts`: exercise correlated errors, subsequent ping, lack of type reflection, and invalid envelope handling.
- `docs/application_protocol.md`: specify the envelope, bounds, and error code.
- `docs/step_summary_27.md`: this record.

## RED

The initial test-only `npm run compile` hit UBG017 formatting diagnostics in the new test; those were corrected and the build then passed. With production unchanged, `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1: **18 passing, 1 pending, 1 failing** in the authentication scenario. The new unsupported-request test timed out waiting for the error response; the ping and invalid-envelope tests passed. This was a functional RED, not a build or setup failure.

## GREEN

- `npm run compile`: passed all BuildGates, TypeScript compilation, and adapter bundling.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across the authentication, concurrency and shutdown scenarios using project-local VS Code 1.146.0. The Linux HTTPS case remained pending; the shutdown scenario reported 4 passing. The new case checks the fixed error object followed by a valid pong on the same connection.
- `npm run verify`: unavailable because this package has no verify script.

## Limitations

The existing HTTPS browser case is skipped on Linux. No general RPC framework or message-size limit was added. Progress documentation was not modified.
