# Step 40 Summary - Codex App Server Spawn

## Change

`spawnCodexAppServer` builds the fixed launch specification and uses Node's child process API with the supplied working directory, piped standard streams, and `shell: false`. It returns the child handle after the `spawn` event. Invalid launch inputs keep their specification errors, and a synchronous spawn exception or an `error` event before `spawn` returns `spawn_failed` through `Result`.

## Files changed

- `src/codexSpawn.ts` implements process startup and maps startup failures to typed errors.
- `tests/suite/codexSpawn.case.ts`, `tests/suite/codexSpawn.test.ts`, and `tests/suite/index.ts` check the launch options, successful event, synchronous and asynchronous failures, and rejection before spawning a command script. The tests use an injected spawner.
- `docs/revised_implementation_roadmap.md`, `docs/implementation_progress.md`, and this summary record startup behavior and verification.

## RED

Before the interruption, the worker reported that the test scaffold passed `npm run compile` and that `node ./node_modules/mocha/bin/mocha --ui tdd test-dist/tests/suite/codexSpawn.test.js` exited 1 with **0 passing, 1 failing**. The stub did not call the injected spawner. An earlier BuildGates failure in the scaffold was corrected before this functional RED.

## GREEN

- `npm run compile` passed BuildGates, TypeScript, and validator bundling.
- The focused Mocha command passed with **1 passing**.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 0 using cached VS Code 1.146.0. Authentication passed with **34 passing, 1 pending**, concurrency with **11 passing**, and shutdown with **11 passing**. The HTTPS certificate case was pending on Linux as expected.
- `npm run verify` reported that the package has no `verify` script. The compile and integration commands above are the documented checks.

## Limitations

The tests verify the spawn contract using an injected process. A successful spawn confirms process creation only. Extension activation, JSON-RPC initialization, readiness checks, process shutdown, and runtime policy enforcement remain separate lifecycle work.
