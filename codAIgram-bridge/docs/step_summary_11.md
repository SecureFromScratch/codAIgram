# Step 11 Summary - Strict WebSocket Host Validation

## Implementation

WebSocket upgrades now require a Host header exactly matching localhost:<allocated-port> or 127.0.0.1:<allocated-port>. Missing Host, wrong ports, external names, and DNS-rebinding-style suffixes are rejected before the token state is reserved. Both allowed forms retain token-authenticated behavior.

## Files Changed

- src/extension.ts validates Host before parsing or reserving the token.
- src/test/suite/extension.test.ts covers missing Host, wrong port, other hosts, rebinding suffixes, preservation of the token after rejection, and accepted localhost Host.
- docs/step_summary_11.md records this step.

## RED

Command: $env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test

Cached VS Code 1.146.0 launched. The new test failed functionally because an invalid Host completed a WebSocket upgrade. Eleven other auth tests passed. The initial missing-Host simulation supplied Node's default Host header, so the test helper was corrected to use setHost:false for that case.

## GREEN

Command: $env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test

Cached VS Code 1.146.0 was selected in both scenarios. Auth scenario: 12 passing. Concurrency scenario: 2 passing. Exit code 0 and port cleanup verification completed.

## Deviations

Invalid Host requests use the existing 401 rejection path. The test helper explicitly disables Node's automatic Host header to test a genuinely missing header.
