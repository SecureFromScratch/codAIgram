# Step 49: Initial source-code interrogation

The bridge protocol now accepts a strict `prompt` field on `chat` and `chat/ask` requests. The extension starts its managed read-only Codex App Server on demand, creates or reuses a thread, sends `turn/start` over JSONL, streams agent-message deltas and tool events, supports interrupt cancellation, and returns a correlated `chat_response`. Synchronization checks still run before any Codex request.

The JSONL client has correlated request IDs, notification dispatch, process-close/write/parse errors, and turn timeout handling. A synchronized chat without a prompt remains unsupported. The bridge mock now matches exact configured prompt-response pairs and returns `prompt_not_found` with status 500 for unknown prompts.

Verification: BuildGates, TypeScript compilation, the focused JSONL transport test, and the full cached VS Code 1.146.0 suite passed (45 authentication, 20 concurrency, and 20 shutdown/status tests). The suite does not launch a real Codex binary; Codex process behavior remains covered by injected lifecycle tests.
