# Step 48: Workspace synchronization subset

## Implementation

The bridge now exposes the current VS Code workspace folders and synchronization timestamp through the activation API. Authenticated WebSocket clients can request `workspace_folders`; folder additions, removals, and reorderings broadcast `workspace_changed`. `chat` and `chat/ask` requests must carry the current timestamp or receive `workspace_sync_required` before execution.

## Files changed

- `src/workspaceSync.ts` — strict request validation and monotonic synchronization state.
- `src/extension.ts` — folder enumeration, change notifications, stale-request gate, and activation API methods.
- `tests/suite/workspaceSync.case.ts`, `tests/suite/workspaceSync.test.ts` — focused validation/state coverage.
- `tests/suite/extension.workspace-sync.case.ts`, `tests/suite/extension.workspace-sync.test.ts`, `tests/suite/extension.test.ts` — real VS Code folder-list and stale-chat coverage.
- `docs/application_protocol.md`, `docs/implementation_progress.md` — protocol and progress records.

## Verification

BuildGates, TypeScript compilation, and the full VS Code 1.146.0 suite passed under the user's Windows account: 44 authentication tests, 20 concurrency tests, and 19 shutdown/status tests. A host-dependent attempt to mutate workspace folders did not emit an event in the Extension Development Host and was removed; the production listener remains registered, while the integration test verifies folder retrieval and stale-request gating.

## Scope notes

Only the approved workspace synchronization subset of Phase 3 was implemented. Chat execution and broader IDE navigation remain later work. Path traversal and symlink checks remain delegated to the user's BoxedPath infrastructure.
