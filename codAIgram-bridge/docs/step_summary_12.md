# Step 12 Summary - Trusted Origin Allowlist

## Implementation

Added the `codaigramBridge.trustedOrigins` VS Code setting. It defaults to an empty list. WebSocket upgrades now require an exact configured HTTP or HTTPS Origin. Missing, malformed, non-HTTP(S), and untrusted origins are rejected before token reservation.

## Files Changed

- `package.json` declares the trusted origin setting.
- `src/extension.ts` validates the Origin before token handling.
- `src/test/runTest.ts` seeds the isolated test profile with the trusted origin.
- `src/test/suite/extension.test.ts` covers missing, malformed, untrusted and trusted Origin behavior while retaining Host validation.
- `docs/step_summary_12.md` records this work.

## RED

Command: `$env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test`

The cached VS Code 1.146.0 host ran. The new Origin test failed functionally because a missing Origin completed the WebSocket upgrade. The suite reported 12 passing and one failing in the auth scenario. An earlier setup attempt failed because the new setting was not registered yet. After declaring the setting, a second attempt timed out when trying to mutate global configuration in the extension host. The test setup was changed to seed the isolated profile's settings file.

## GREEN

Command: `$env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test`

The runner selected cached VS Code 1.146.0. Auth scenario passed 13 tests, including Origin and Host checks. Concurrency scenario passed 2 tests. The run exited 0 and port cleanup verification completed.

## Deviations

The test harness seeds the trusted Origin in the isolated test profile because writing global settings through the test host timed out. The production default remains an empty allowlist.
