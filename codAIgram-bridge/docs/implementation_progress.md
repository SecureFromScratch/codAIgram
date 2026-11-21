# CodAIgram Bridge implementation progress

Execution order follows [`revised_implementation_roadmap.md`](revised_implementation_roadmap.md), which retains the original phase identifiers. Phases 1 and 2 are complete; the approved workspace-synchronization subset of Phase 3 is complete; Phase 4 is complete for its approved scope.

Phase 4 has been approved for implementation.

## Phase 1: Connection Foundation

| Step | Status | Behavior |
| --- | --- | --- |
| 1 | Complete | Loopback HTTP listener and extension lifecycle |
| 2 | Complete | Persistent WebSocket and Hello greeting |
| 3 | Complete | OS-assigned loopback port |
| 4 | Complete | Single-use authentication and concurrent-handshake protection |
| 5 | Complete | Display pairing URL |
| 6 | Complete | Copy pairing URL command |
| 7 | Complete | Copy button in pairing input |
| 8 | Complete | Connected and disconnected status |
| 9 | Complete | Manual token regeneration |
| 10 | Complete | Automatic token renewal after disconnect |
| 11 | Complete | Strict Host validation before upgrade |
| 12 | Complete | Exact configured Origin allowlist |
| 13 | Complete | Trusted HTTPS browser connection and browser-local DNS rebinding test |

All integration tests use the cached VS Code 1.146.0 managed by `@vscode/test-electron`.

Step 13 GREEN ran as `yarivhp\yariv`, the account with the explicitly approved development CA in its CurrentUser Root store. Headless Chromium loaded the trusted local HTTPS page, connected to `ws://localhost:<port>` and received `Hello`. A process-local hostname mapping exercised a fictitious DNS-rebinding hostname. The browser sent that hostname in `Host`, the extension rejected it, and the same token then succeeded through localhost. The full suite passed with 15 authentication/browser tests and 2 concurrency tests, including clipboard copy tests. Port cleanup passed. See `step_summary_13.md`.

The public website server never connects directly to the extension. Publicly hosted staging verification was not run. The user approved local HTTPS testing and one headless Chromium browser. The system hosts file was not changed.

Step 14 complete: explicit literal Origin 'null' rejection is now covered, and the same token remains usable with an approved Origin. Existing production behavior already rejected 'null', so this closed a coverage gap without production edits. Full cached VS Code 1.146.0 suite passed as yarivhp\yariv: 15 auth/browser tests and 2 concurrency tests. See step_summary_14.md.
Step 15 complete: an active authenticated client received Hello, remained open through Extension Development Host shutdown, observed remote closure, and the allocated port was released. No production change was needed because existing shutdown behavior passed the new regression coverage. Full suite passed with cached VS Code 1.146.0: auth/browser 15, concurrency 2, shutdown/status 2. See step_summary_15.md.

Step 16 complete: listener startup rejects bind errors and invalid addresses with cleanup. RED: simulated asynchronous bind error resolved instead of rejecting. GREEN: cached VS Code 1.146.0 suite passed (16 auth/browser, 3 concurrency, 3 shutdown). See step_summary_16.md. Actual OS sleep/wake remains untested because it is disruptive to automate; ordinary disconnect/reconnect is covered.

Phase 1 completion audit: complete. All ten roadmap acceptance criteria have corresponding implementation and test evidence through Steps 1-16. Local trusted HTTPS and headless Chromium satisfy the approved representative browser scenario. Actual OS sleep/wake, a public staging site, and interactive permission prompts remain untested; sleep/wake was specified where practical. Next phase requires user approval.

## Phase 2: Application Messaging Protocol

Step 25 complete: authenticated connections receive the versioned JSON welcome `{"version":1,"type":"welcome"}`. Tests first failed against the former `Hello` greeting; BuildGates, TypeScript, and the Linux VS Code integration suite passed after the change, with the HTTPS case skipped on Linux. See `step_summary_25.md`.

Step 26 complete: authenticated clients can send strictly validated version 1 ping requests and receive pongs with matching identifiers. Mandate and VV validate the boundary through a bundled CommonJS adapter. Tests first failed because no pong was sent; BuildGates, TypeScript, and the Linux VS Code integration suite passed, with the existing HTTPS skip. See `step_summary_26.md`.

Step 27 complete: an unsupported but valid request receives a correlated `unsupported_request` error without reflecting its type. The test first failed waiting for the absent error; BuildGates, TypeScript, and Linux VS Code integration passed, with the existing HTTPS skip. See `step_summary_27.md`.

Step 28 complete: inbound WebSocket messages are limited to 65,536 bytes across fragments; oversized messages close with status 1009. A fragmented oversized test first failed, then BuildGates, TypeScript, and Linux VS Code integration passed, with the existing HTTPS skip. See `step_summary_28.md`.

Step 29 complete: an authenticated client receives unsolicited versioned editor-presence notifications on real active-editor changes, without file paths or contents. The real-editor test first timed out; BuildGates, TypeScript, and Linux VS Code integration passed, with the existing HTTPS skip. See `step_summary_29.md`.

Step 30 complete: clients can hold up to 32 concurrent editor-change waits, receive correlated replies, and use ping while waiting. Duplicate IDs and excess requests receive fixed errors; pending waits are cleared on disconnect. The real-host test first failed on unsupported waits; BuildGates, TypeScript, and Linux integration passed, with the existing HTTPS skip. See `step_summary_30.md`.

Step 31 complete: strictly validated cancellation messages acknowledge the cancel request and complete a pending wait with a correlated cancellation error. Tests cover both editor-change/cancel orderings and connection isolation. After correcting an independent-response ordering assumption, BuildGates, TypeScript, and Linux integration passed, with the existing HTTPS skip. See `step_summary_31.md`.

Step 32 complete: pending editor-change waits expire after 30 seconds with a correlated error; completion, cancellation, disconnect and shutdown dispose timers, including protection against stale callbacks. Both focused timer tests and an actual 30-second VS Code integration test passed after functional RED. BuildGates and TypeScript passed, with the existing Linux HTTPS skip. See `step_summary_32.md`.

Step 33 complete: reuse of an in-flight request ID closes the connection with code 1008 and clears pending work instead of sending an ambiguous error under the original ID. Real-host duplicate ping and cancellation tests passed after functional RED, as did BuildGates and the full Linux integration suite with the existing HTTPS skip. See `step_summary_33.md`.

Step 34 complete: authenticated text requests are validated and dispatched in arrival order, while editor waits remain asynchronous. A real-host test first showed a later ping overtaking cancellation responses; BuildGates and the full Linux integration suite passed after the change, with the existing HTTPS skip. See `step_summary_34.md`.

Phase 2 completion audit: complete. The extension accepts strictly validated version 1 requests, returns correlated ping, wait, cancellation, timeout, and fixed unsupported-request responses, emits unsolicited editor-presence events, and applies connection failure behavior for oversized messages and duplicate in-flight IDs. Real VS Code integration coverage confirms correlation, concurrent waits, cancellation, timeout, arrival-ordered dispatch, unsolicited notifications, and connection cleanup; BuildGates and TypeScript pass. The HTTPS/Chromium test is pending on Linux, as documented in the test setup. The current scope defines the browser-facing protocol; a production browser client and broader backpressure/resource hardening remain future work. See `docs/application_protocol.md` and Steps 25-34.

## Phase 4: Codex App Server Lifecycle

Step 35 complete: the workspace-root resolver returns a file-system path for one local workspace folder and typed errors for no folder, multiple folders, or a non-file URI. BuildGates and the full VS Code integration suite passed following an initial transient handshake failure in an unrelated test. Workspace authorization and process launch remain future steps. See `step_summary_35.md`.

Step 36 complete: a separate helper validates an absolute candidate directory against an already authorized workspace root using canonical filesystem paths, rejecting outside paths and symlink escapes. Real filesystem tests and the full VS Code suite passed after functional RED; validation is point-in-time and is not a substitute for process sandboxing. See `step_summary_36.md`.

Step 37 complete: launch-directory resolution composes current workspace selection with canonical directory validation and propagates typed errors. A real single-folder VS Code host and empty-window/error cases passed after functional RED, along with BuildGates and the full integration suite. No process is launched. See `step_summary_37.md`.

Step 38 complete: typed Codex executable discovery searches absolute PATH entries, checks file usability, and identifies Windows command scripts separately. Filesystem and injected platform tests passed after functional RED and correction of a DrvFs permission assumption; BuildGates and full VS Code integration passed. No process is launched. See `step_summary_38.md`.

Step 39 complete: a pure native-executable launch specification fixes stdio transport, read-only sandbox and on-request approval overrides, while rejecting command scripts and malformed paths. Focused tests and the full VS Code suite passed after functional RED. Runtime policy enforcement and process launch remain future work. See `step_summary_39.md`.

Step 40 complete: the startup helper uses the fixed launch specification to start the native executable with piped standard streams and an explicit working directory. It resolves on the `spawn` event and reports startup failures as typed errors. BuildGates, the focused test, and the full VS Code 1.146.0 suite passed after functional RED. Protocol readiness and managed process lifecycle remain future work. See `step_summary_40.md`.

Step 41 in progress: standalone child termination helper and focused tests pass after functional RED. Full Windows VS Code run has 36 passing and 1 failing because the existing workspace authorization test cannot create a symlink (EPERM). Path canonicalization and symlink escape coverage are deferred to the planned BoxedPath infrastructure at the user's direction. Builds run under the user's normal Windows account because the sandbox cannot traverse the hoisted tool installation. See `step_summary_41.md`.

Step 42 complete: the bridge sends a JSONL Codex `initialize` request, validates its response, and sends the `initialized` notification through an isolated stream helper. BuildGates, TypeScript, focused tests, and the full VS Code 1.146.0 suite passed with 38 tests under the user's account. Process integration, health, shutdown ownership, and thread mapping remain. See `step_summary_42.md`.

Step 43 complete: spawn now composes with JSONL initialization and cleans up failed startup; a thread manager starts/resumes Codex threads and records conversation mappings through an injected store. BuildGates, TypeScript, complete compile, focused tests, and full VS Code 1.146.0 runs passed (40 main, 16 concurrency). Extension activation wiring, health/recovery, and persistent mapping remain. See `step_summary_43.md`.

Step 44 complete: conversation-to-thread mappings can persist through a VS Code Memento using an array-backed store that satisfies the prototype-pollution BuildGates rules. BuildGates, TypeScript, complete compile, and the focused persistence test passed under the user's account. Lifecycle activation wiring and process health/recovery remain. See `step_summary_44.md`.

Step 45 complete: the process health monitor reports one unexpected Codex exit, suppresses intentional shutdown, and supports disposal. BuildGates, TypeScript, complete compile, and the focused health test passed under the user's account. Extension activation wiring and recovery behavior remain. See `step_summary_45.md`.

Step 46 complete: extension activation now owns a lazy Codex runtime with start/stop API methods, launch-directory resolution, executable discovery, protocol initialization, health monitoring, and intentional deactivation cleanup. BuildGates, TypeScript, complete compile, and full VS Code 1.146.0 runs passed (42 main, 18 concurrency). See `step_summary_46.md`.

Step 47 complete: explicit `restartCodex` recovery now stops and recreates the managed Codex process through the full validated startup path. BuildGates, TypeScript, complete compile, and full VS Code 1.146.0 runs passed (42 main, 18 concurrency). Path traversal remains delegated to BoxedPath. See `step_summary_47.md`.

Phase 4 completion audit: complete for the approved scope. The extension can discover and launch a native Codex App Server in the selected workspace, initialize its JSONL protocol, persist and resume conversation threads, monitor process health, stop it during deactivation, and explicitly restart it after unexpected termination. Path canonicalization and symlink escape enforcement are intentionally deferred to the user's BoxedPath infrastructure. Browser prompt forwarding remains Phase 5.

## Phase 3: Workspace synchronization subset

The approved Phase 3 subset is complete and integrated with the Phase 4 extension host. The activation API exposes `getWorkspaceFolders()` and `getWorkspaceSyncTimestamp()`. Authenticated WebSocket clients can request `workspace_folders`, receive unsolicited `workspace_changed` notifications when VS Code workspace folders change, and must provide the latest synchronization timestamp on `chat` or `chat/ask` requests. Stale requests receive `workspace_sync_required` with the required refresh operations before any chat execution. Broader IDE navigation and editor/project operations remain deferred.

## Phase 5: Initial source-code interrogation

Step 49 complete: synchronized `chat` and `chat/ask` requests now carry a strict prompt, the extension starts or uses its managed read-only Codex App Server, forwards the prompt over JSONL, streams deltas and tool events, supports turn interruption, retains a thread for multi-turn prompts, and returns a correlated `chat_response`. The sibling bridge mock supports exact configured prompt-response pairs and a 500-style `prompt_not_found` error for unknown prompts. Structured diagram context and extension-side source navigation remain deferred because their schemas and UI actions are not defined in the revised roadmap. See `step_summary_49.md`.
