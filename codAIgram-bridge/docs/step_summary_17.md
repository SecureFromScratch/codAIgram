# Step 17 Summary - UBG023 Case Modules

## Change

Split all 18 existing tests into separate `*.case.ts` modules, each with a registration function and unavailable prompt provenance metadata. The three lifecycle suites continue to register the cases in their original order; extension test helpers live in `tests/suite/extension.helpers.ts`, and API access is deferred until the test runs after setup. Node-side WebSocket connections use the `ws` client so their trusted Origin header is sent; browser-evaluated WebSocket calls retain the browser API.

## Files changed

- `tests/suite/connectionStatus.test.ts`, `listenerStartup.test.ts`, and `extension.test.ts`: register cases in their existing suites.
- `tests/suite/connectionStatus.case.ts`, `listenerStartup.case.ts`, and `extension01.case.ts` through `extension16.case.ts`: one existing case each.
- `tests/suite/extension.helpers.ts`: shared extension test helpers.
- `docs/step_summary_17.md`: this record.

The lead separately repaired pre-existing syntax corruption in `tests/suite/extension.test.ts` and a source WebSocket type issue before the extension split.

## RED and baseline

The initial `npm run compile` failed with 18 UBG023 diagnostics among 313 BuildGates findings. Before the lead's repairs, `npm run compile:typescript` reported 15 syntax errors in the existing extension suite. These are gate and compilation failures, not a functional RED. This step moves existing tests without specifying new behavior, so no functional RED was claimed.

## Validation

- `npm run compile:typescript`: passed after the split.
- Programmatic Mocha TDD run of the compiled connection-status and listener suites: 2 passing.
- `npm run check:gates`: UBG023 count 0; 322 other findings remain across UBG001, UBG006, UBG014, UBG017, UBG018, UBG029, UBG030, UBG033, UBG034, and UBG035. The 18 metadata declarations add type-annotation findings under UBG014; no other gate was disabled.
- `npm run test:integration`: failed before launching VS Code because `certutil.exe -user -addstore Root` failed in this Linux environment. No integration cases ran; full GREEN has not been established.
- `npm run verify`: unavailable because `package.json` does not define a verify script.

## Deviations and limitations

The full suite remains blocked by the other build gates and the Windows-specific integration fixture. The installed project-local VS Code 1.146.0 is a Windows archive, and this Linux run could not complete certificate setup. No functional RED or full-suite GREEN is claimed.
