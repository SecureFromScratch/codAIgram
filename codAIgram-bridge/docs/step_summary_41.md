# Step 41 - Codex child shutdown (in progress)

Added a standalone shutdown helper and registered focused tests. The helper sends the default termination signal, waits for exit, shares concurrent requests, and reports failure when the signal cannot be sent. It does not yet own the process or integrate with extension shutdown; it has no timeout or forced-termination policy.

RED: the initial stub compiled with TypeScript and the focused Mocha suite reported 1 passing and 1 failing because shutdown resolved before exit. GREEN: the focused suite reported 2 passing; TypeScript and the existing BuildGates CLI invoked directly both passed.

The full Windows VS Code 1.146.0 integration run reached 36 passing, 1 failing. Both shutdown tests passed, but the existing working-directory authorization test failed with EPERM creating a symbolic link. The regular npm compile also failed before the gate because the local BuildGates dependency link cannot be accessed from Windows; direct TypeScript compilation succeeded, but the validator bundler reported access denied. These environment issues prevent a full GREEN and this step remains in progress.

Files: src/codexStop.ts, tests/suite/codexStop.case.ts, tests/suite/codexStopFailure.case.ts, tests/suite/codexStop.test.ts, tests/suite/index.ts, and this record.
