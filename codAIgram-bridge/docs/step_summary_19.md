# Step 19 Summary - Linux HTTPS Fixture

## Change

Linux test runs no longer create or trust the HTTPS fixture certificate. The HTTPS browser case is registered as a pending Mocha test on Linux and a prominent banner explains the omission. Other cases and the HTTP DNS-rebinding fixture remain enabled. Linux browser discovery accepts `CODAIGRAM_BRIDGE_CHROMIUM_PATH` and standard Chromium paths; Windows retains its existing certificate and browser setup.

## Files changed

- `tests/httpsSupport.ts` and `tests/suite/httpsSupport.case.ts`, `httpsSupport.test.ts`: platform policy and test.
- `tests/runTest.ts`: conditional HTTPS fixture lifecycle, warning, and Linux browser lookup.
- `tests/suite/extension16.case.ts` and `tests/suite/index.ts`: skip the HTTPS case on Linux and register the new policy case.
- `docs/startup.md` and `docs/step_summary_19.md`: prerequisites, behavior and evidence.

## RED

An isolated TypeScript compilation and programmatic Mocha TDD run of the new test against the initial always-enabled policy produced 0 passing and 1 failing: Linux returned true instead of false. This was a functional assertion failure.

## Validation

- `npm run compile:typescript`: passed.
- Programmatic Mocha TDD run of the compiled platform, connection status, and listener cases: 3 passing.
- `npm run test:integration`: printed the Linux warning and passed the former certificate setup failure, then failed before the host started because sandbox policy denied binding the HTTP fixture to 127.0.0.1 (EPERM). An escalated retry bound localhost successfully and then stopped because no Linux Chromium executable was found. Full integration GREEN not demonstrated.
- `npm run check:gates`: 319 remaining diagnostics, with UBG023 and UBG035 at zero. Other gates still prevent `npm test` from reaching integration.
- `npm run verify`: no such project script (previously confirmed).

## Limitations

The full VS Code 1.146.0 host run requires a Linux VS Code download/cache, desktop display, Chromium, and permission to bind localhost. Windows integration was not rerun. The existing broader startup guide resides outside this project at `../docs/startup.md`; orchestration forbids modifying files outside this project without approval, so this step adds the project-local guide instead.
