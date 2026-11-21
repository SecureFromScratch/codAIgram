# Step 39 Summary - Codex Launch Specification

## Change

The pure launch-spec builder accepts a discovered native executable and a supplied canonical working directory. It rejects command-script launchers and relative or NUL-containing executable and working-directory paths. It returns the executable path, cwd and a fixed argument array selecting `app-server --listen stdio://` and TOML overrides for `sandbox_mode="read-only"` and `approval_policy="on-request"`. No process is started, and there is no less-restricted configuration option in this builder.

The [Codex CLI source](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs) defines the app-server stdio transport. The [Codex configuration documentation](https://developers.openai.com/codex/config-advanced/) describes `-c` overrides and TOML values; the [configuration reference](https://developers.openai.com/codex/config-reference/) documents the relevant policy keys.

## Files changed

- `src/codexLaunchSpec.ts`: pure fixed launch specification and typed errors.
- `tests/suite/codexLaunchSpec.case.ts`, `tests/suite/codexLaunchSpec.test.ts`, `tests/suite/index.ts`: exact argv, cwd, policy and rejection coverage.
- `docs/revised_implementation_roadmap.md`: launch behavior and runtime-policy limitations.
- `docs/implementation_progress.md`, `docs/step_summary_39.md`: progress and this record.

## RED

The test-only scaffold passed `npm run compile`. `node ./node_modules/mocha/bin/mocha --ui tdd test-dist/tests/suite/codexLaunchSpec.test.js` exited 1 with **0 passing, 1 failing** because the stub rejected the native executable instead of constructing the specification. This was a functional RED.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling.
- The focused Mocha command passed with **1 passing**.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across real VS Code 1.146.0 scenarios. Authentication reported **33 passing, 1 pending**; shutdown reported **10 passing**. The HTTPS case remains pending on Linux.
- `npm run verify` was not run because the package has no verify script.

## Limitations

The function expects the caller to supply the previously discovered executable and canonical workspace directory; it performs no filesystem checks or process launch. The CLI overrides set startup configuration but do not by themselves establish effective policy for later RPC requests or managed restrictions. Safe Windows command-script execution and runtime policy enforcement remain separate work.
