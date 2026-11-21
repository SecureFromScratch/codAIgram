# Step 37 Summary - Launch Directory Composition

## Change

The launch-directory resolver reads the current VS Code workspace through the existing resolver and validates the selected root as both authorized root and candidate with the existing canonical directory helper. It returns the canonical absolute directory or propagates the original typed error. This step does not start a process.

## Files changed

- `src/launchDirectory.ts`: compose workspace selection with directory validation.
- `tests/suite/launchDirectory.case.ts`, `tests/suite/launchDirectory.test.ts`, `tests/suite/index.ts`: active workspace and typed error coverage.
- `tests/runTest.ts`, `tests/suite/workspaceRoot.case.ts`: open the shutdown host on a real temporary single-folder workspace while retaining empty-window coverage elsewhere.
- `docs/startup.md`: describe the integration fixture change.
- `docs/revised_implementation_roadmap.md`: document composition and limits.
- `docs/implementation_progress.md`, `docs/step_summary_37.md`: progress and this record.

## RED

The test-only scaffold passed `npm run compile` after correcting a UBG018 annotation finding. `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1 with **30 passing, 1 pending, 1 failing**: the composition scaffold returned `no_workspace` instead of propagating `ambiguous_workspace`. This was a functional RED.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across all real VS Code 1.146.0 scenarios. The shutdown scenario, launched on an actual temporary single-folder workspace, reported **8 passing** including canonical launch-directory resolution. The Linux HTTPS case remained pending; earlier scenario counts were truncated in the captured output.
- `npm run verify` was not run because the package has no verify script.

## Limitations

No-workspace uses the actual empty host; multiple and virtual workspaces use the existing deterministic folder-list seam, and a nonexistent single folder verifies propagation of `invalid_workspace_root`. The selected path is checked at a point in time and remains subject to filesystem replacement before use. This does not start Codex or replace sandbox enforcement.
