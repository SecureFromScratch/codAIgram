# Step 46 Summary - Extension-Owned Codex Runtime

The extension now owns a lazy `CodexRuntime`. The activation API exposes `startCodex` and `stopCodex`; starting resolves the current launch directory, discovers a native executable, spawns and initializes Codex, and installs process health monitoring. Deactivation intentionally stops the owned child and clears the runtime. Ordinary activation remains lazy and does not launch Codex automatically.

Verification: BuildGates, TypeScript, complete compile, and the full cached VS Code 1.146.0 integration suite passed under the user's normal Windows account. The main suite reported 42 passing tests and the concurrency/shutdown suite reported 18 passing tests. The symlink portion remains deferred to BoxedPath due Windows EPERM.

Phase 4 remaining audit item: the runtime currently clears state after unexpected termination; automatic restart/recovery policy and browser protocol forwarding to Codex are separate decisions for the next phase. Thread persistence and lifecycle ownership are now implemented.
