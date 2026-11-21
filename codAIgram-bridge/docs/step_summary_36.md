# Step 36 Summary - Working Directory Validation

## Change

The separate working-directory helper takes an already authorized root and an explicit absolute candidate. It resolves both with `realpath`, requires each to be a directory, and accepts the canonical root or a descendant using a path-component-aware comparison. Invalid root, invalid candidate and outside-workspace outcomes have distinct typed `Result` errors. Symlinks are resolved before containment is checked. No process is launched and no sandbox settings are changed.

## Files changed

- `src/workingDirectory.ts`: canonical filesystem validation and typed results.
- `tests/suite/workingDirectory.case.ts`, `tests/suite/workingDirectory.test.ts`, `tests/suite/index.ts`: project-local real filesystem fixtures and test registration.
- `docs/revised_implementation_roadmap.md`: document the root trust assumption and filesystem race limitations.
- `docs/implementation_progress.md`: record the step.
- `docs/step_summary_36.md`: this record.

## RED

The test-only scaffold passed `npm run compile`. `node ./node_modules/mocha/bin/mocha --ui tdd test-dist/tests/suite/workingDirectory.test.js` exited 1 with **0 passing, 1 failing**, because the scaffold returned an error for the authorized root. This was a functional RED.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and validator bundling after correcting an initial UBG018 type annotation finding.
- The same focused Mocha command exited 0 with **1 passing**, exercising the root, descendant, internal symlink, sibling-prefix path, traversal, external symlink, file, missing path, relative candidate and non-directory root. Temporary files were created and cleaned inside the project.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across the real VS Code 1.146.0 scenarios. The authentication run reported **30 passing, 1 pending** and the shutdown run **7 passing**. The HTTPS case remains pending on Linux.
- `npm run verify` was not run: the package has no verify script.

## Limitations

The helper trusts its root argument to have already been authorized and does not itself select a workspace or start a process. `realpath` and `stat` are point-in-time checks: a filesystem actor can change a path after validation, so later process launch needs explicit race and sandbox considerations. Tests ran on Linux; creating symlinks may require different privileges on Windows.
