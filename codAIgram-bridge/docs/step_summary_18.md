# Step 18 Summary - UBG035 Inline Imports

## Change

Replaced the dynamic and inline type imports of Node's built-in HTTP module in `tests/runTest.ts` with one top-level namespace import. The fixture still uses `http.createServer` and `http.Server`; no gate was disabled.

## Files changed

- `tests/runTest.ts`
- `docs/step_summary_18.md`

## RED and baseline

The prior gate run reported two UBG035 diagnostics for these imports. This was a static gate failure, not a functional RED. The change preserves the existing fixture behavior; no new functional test or functional RED is claimed.

## Validation

- `npm run compile:typescript`: passed.
- `npm run check:gates`: zero UBG035 diagnostics; 316 other diagnostics remain. The gate command still fails overall.
- `npm run test:integration`: failed before VS Code or tests started, when the Linux run attempted `certutil.exe -user -addstore Root` with the fixture CA path. No full-suite GREEN is claimed.
- `npm run verify`: unavailable because this package has no verify script.

## Deviation

The requested full GREEN cannot be demonstrated while the other build gates remain and the Windows-specific certificate setup fails in this environment. Node's built-in HTTP module now loads when the test runner starts rather than upon fixture creation; it has no project-specific initialization.
