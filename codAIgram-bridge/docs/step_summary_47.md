# Step 47 Summary - Explicit Codex Restart Recovery

Added `restartCodex` to the activation API and `CodexRuntime.restart`. Recovery stops any existing process, clears intentional health listeners, and starts a fresh process through launch-directory resolution, executable discovery, spawn, and JSONL initialization. This is explicit bounded recovery and avoids uncontrolled automatic restart loops.

Verification: BuildGates, TypeScript, complete compile, and the full cached VS Code 1.146.0 integration suite passed under the user's normal Windows account. The suite completed with 42 passing tests in the main scenario and 18 passing tests in the concurrency/shutdown scenario. The Windows symlink section remains deferred to BoxedPath as requested.
