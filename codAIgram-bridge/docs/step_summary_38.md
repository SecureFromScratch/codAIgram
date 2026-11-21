# Step 38 Summary - Codex Executable Discovery

## Change

The discovery helper searches absolute extension-host PATH entries in order without invoking a shell or launching a process. POSIX candidates must be regular files for which `fs.access(X_OK)` succeeds. On Windows, supported `.EXE`, `.COM`, `.CMD`, and `.BAT` extensions are considered in PATHEXT order; command scripts are identified separately from native launchers. An empty or relative-only PATH yields `invalid_path`; a valid search without a usable candidate yields `not_found`.

## Files changed

- `src/codexDiscovery.ts`: typed discovery, platform/PATH/probe seam, and filesystem probing.
- `tests/suite/codexDiscovery.case.ts`, `tests/suite/codexDiscovery.test.ts`, `tests/suite/index.ts`: real filesystem and injected Windows/path-order tests.
- `docs/revised_implementation_roadmap.md`: discovery behavior and scope.
- `docs/implementation_progress.md`, `docs/step_summary_38.md`: progress and this record.

## RED

The test-only scaffold passed `npm run compile` after correcting object formatting findings. `node ./node_modules/mocha/bin/mocha --ui tdd test-dist/tests/suite/codexDiscovery.test.js` exited 1 with **0 passing, 1 failing** because discovery returned `not_found` for the executable fixture. This was a functional RED.

## Initial GREEN failure and diagnosis

The first focused implementation run failed because the fixture created with mode 0644 was reported executable and chosen as the first PATH match. The lead's diagnosis found that the project is on DrvFs without metadata: Node reports the file with executable bits and `X_OK` succeeds. The test now checks ordering with an injected probe, checks actual files and directories separately, and asserts non-executability only when the filesystem reports no execute bits. Production continues to use `fs.access(X_OK)`.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling after correcting UBG034 annotations.
- The focused Mocha command passed with **1 passing**.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across the real VS Code 1.146.0 scenarios; the shutdown host reported **9 passing**. The Linux HTTPS case remained pending; earlier scenario output was truncated.
- `npm run verify` was not run because the package has no verify script.

## Limitations

Windows path and command-script classification use an injected probe on Linux; execution on Windows itself remains untested. Discovery does not verify executable provenance, guard against later replacement, start a process, or define safe invocation of command scripts. Search observes extension-host PATH and permissions as reported by its filesystem.
