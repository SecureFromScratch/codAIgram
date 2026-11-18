# Step 16 Summary - Listener Startup Failure

## Implementation

Listener startup now rejects when the HTTP server emits a bind error or reports an invalid loopback listening address. Extension activation logs the failure, clears its listener/server references, disposes the status item and output channel, closes the WebSocket server, and rethrows the error. Successful startup still reports the allocated port.

## Files Changed

- `src/listenerStartup.ts` starts and validates the loopback listener.
- `src/extension.ts` awaits listener startup and cleans up before rejecting activation.
- `src/test/suite/listenerStartup.test.ts` verifies bind errors reject instead of resolving with port zero.
- `src/test/suite/index.ts` loads the startup test.
- `docs/step_summary_16.md` records the step.

## RED

Command: `$env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test`

The cached VS Code 1.146.0 host ran 15 auth/browser tests, then the new test failed because a simulated `EACCES` bind error resolved successfully instead of rejecting. An earlier version of the test used an already-listening Node server and did not exercise the asynchronous error event. The test was corrected to emit a bind error asynchronously.

## GREEN

Command: `$env:TEMP=(Resolve-Path .).Path; $env:TMP=$env:TEMP; npm.cmd test`

The complete suite passed under `yarivhp\\yariv` using cached VS Code 1.146.0. Auth/browser, concurrency, shutdown, status, and listener startup tests passed, including cleanup and allocated-port release.

## Deviations

No listener error is intentionally induced in the real extension host because dynamic port zero cannot be deterministically made unavailable. The listener-start helper is tested with an asynchronous server error, and existing real-host tests cover successful activation and port allocation.
