# Application protocol

After a successful authenticated WebSocket upgrade, the extension sends one JSON text welcome message:

```json
{"version":1,"type":"welcome"}
```

The welcome is followed by a session message containing a reconnect credential for this authenticated client:

```json
{"version":1,"type":"session","sessionId":"..."}
```

The pairing nonce remains a one-time credential on the existing `/<nonce>` route. After the original socket has
closed, the client may reconnect with the session credential on the separate `/session/<sessionId>` route. A session
credential is valid only during the current extension activation and is unavailable while its original socket remains
connected. Existing nonce regeneration after disconnect remains in effect and represents a new connection, not a
session reconnect.

A client may send a JSON text ping request with exactly three properties:

```json
{"version":1,"type":"ping","id":"client-request-id"}
```

`id` is a client-supplied, non-empty string of at most 4096 UTF-16 code units. The extension replies with a JSON text message containing the same identifier:

```json
{"version":1,"type":"pong","id":"client-request-id"}
```

A well-formed version 1 request has exactly the properties `version`, `type`, and `id`. The request `type` is a non-empty string of at most 128 UTF-16 code units. When its type is unsupported, the extension returns a correlated error:

```json
{"version":1,"type":"error","id":"client-request-id","code":"unsupported_request"}
```

The error contains the validated ID and a fixed code; it does not echo the request type. Mandate and VV validate the parsed envelope, including version, type and ID bounds, and reject additional properties. Invalid JSON, invalid envelopes, and binary messages are ignored without a response; the connection stays open. IDs are echoed, not logged.

For each connection, text requests are validated and dispatched in WebSocket message arrival order. Invalid messages do not stop later requests. Dispatching a wait registers it and does not block later requests while awaiting an editor change. Editor notifications and timeout events can occur independently between request dispatches.

Inbound WebSocket messages are limited to 65,536 bytes, measured across all fragments of a message. Messages at the limit are allowed; larger messages are rejected by the WebSocket server with close code 1009 before application parsing. This limit applies to text and binary messages. This step does not define general RPC.

While an authenticated client is connected, VS Code active-editor changes produce an unsolicited JSON text event:

```json
{"version":1,"type":"active_editor_changed","hasActiveEditor":true}
```

`hasActiveEditor` is a boolean indicating whether VS Code has an active text editor after the change. The event contains no path, filename, document content, or request ID. No initial editor state is sent on connection; the listener is disposed on disconnect or extension shutdown.

A client may wait for the next active-editor change:

```json
{"version":1,"type":"wait_for_active_editor_change","id":"request-id"}
```

After validation, the request stays pending until the next change, when the extension sends the unsolicited event followed by one correlated response for each pending ID:

```json
{"version":1,"type":"active_editor_change","id":"request-id","hasActiveEditor":true}
```

Up to 32 distinct wait IDs may be pending per connection. Clients must use unique IDs for all in-flight requests. When a validated request reuses an ID belonging to a pending wait, the server closes the connection with WebSocket code 1008 without sending a correlated duplicate error, and discards pending work and timers. Clients must treat connection closure as failure of all outstanding requests. A new wait beyond the limit receives `too_many_pending_requests` in the existing error envelope. Other requests with distinct IDs, including pings, continue while waits are pending. Each pending wait has a fixed server timeout of 30 seconds, starting when it is registered. If it expires first, the bridge releases the ID and sends `{ "version": 1, "type": "error", "id": "request-id", "code": "request_timeout" }`. Editor change, cancellation, disconnect, and shutdown cancel the associated timer. The first processed terminal action wins; the ID may be reused afterward. Pending waits are discarded on disconnect or shutdown. The response includes no path, filename, or document content.

To cancel one pending wait, send exactly:

```json
{"version":1,"type":"cancel","id":"cancel-id","targetId":"wait-id"}
```

Both IDs follow the existing ID rules and the cancellation has its own request ID. If its target is pending on the same connection, it is removed atomically and the bridge sends these two terminal messages, in order:

```json
{"version":1,"type":"cancelled","id":"cancel-id","targetId":"wait-id"}
{"version":1,"type":"error","id":"wait-id","code":"request_cancelled"}
```

If the target is absent or already completed, only the cancellation request receives `request_not_pending` in the standard error envelope. A cancellation request ID matching a pending wait, including its own target, causes the 1008 close described above. The first processed editor change or cancellation completes a target exactly once; later cancellation cannot affect it. Pending waits are scoped to a connection and discarded on disconnect. Invalid cancellation envelopes, including missing or invalid target IDs and extra fields, are ignored. Reusing a completed cancellation request ID does not replay an earlier acknowledgement.

## Workspace synchronization

The extension activation API exposes `getWorkspaceFolders()` and `getWorkspaceSyncTimestamp()` for extension-host consumers. Each workspace-folder record includes `configuredAgents`: `codex` when `AGENTS.md` exists, `claude` when `CLAUDE.md` exists, and `grok` when `AGENT.md` exists. Authenticated browser clients use the WebSocket protocol below.

A client requests the current VS Code workspace folders with `{"version":1,"type":"workspace_folders","id":"folders"}`. The response includes a monotonic `syncTimestamp` and each folder's display name, URI, zero-based index, and `configuredAgents` list. When VS Code adds, removes, or reorders folders, every authenticated client receives `{"version":1,"type":"workspace_changed","syncTimestamp":...}`.

Clients retain the latest timestamp and include it as `syncTimestamp` on workspace-sensitive requests. A `chat` or `chat/ask` request with a missing or stale timestamp is rejected before execution with `{"version":1,"type":"error","id":"chat","code":"workspace_sync_required","syncTimestamp":...,"required":["workspace_folders"]}`. The client performs each operation named in `required`, updates its timestamp, and retries the original request.

Authenticated clients can request scanner-compatible inventories from the bridge with `{"version":1,"type":"scan/tests","id":"scan-1","workFolders":["C:\\workspace"]}` or `type:"scan/classes"`. The extension traverses the supplied folders through the shared scanner traversal and returns `scan_tests_response` or `scan_classes_response` with a `result` payload.

Clients can retrieve a type definition's source text with `{"version":1,"type":"code/get","id":"code-1","projectName":"mock-project","workFolders":["C:\\workspace"],"filepath":"src/model.ts","typeName":"Widget"}`. The bridge returns `code_response` with the extracted `code`; a single match is a string, while multiple matching files across the supplied folders return an array of snippets in work-folder order. Errors such as `unknown_project` or `type_not_found` identify unavailable projects or declarations. Client-side validation rejects empty project names, empty folder lists, empty file paths, and relative traversal segments.

## Initial source-code interrogation

A synchronized chat request carries a prompt, an explicit `cwd`, and the other selected folders in `workFolders`. The browser omits `cwd` from `workFolders`; the bridge adds it when constructing Codex's complete work-folder list. When no additional folders are selected, Codex receives `[cwd]`:

```json
{"version":1,"type":"chat","id":"chat-1","syncTimestamp":1700000000000,"prompt":"What files are in this workspace?","cwd":"C:\\workspace","workFolders":[]}
```

When additional folders are selected, `workFolders` contains each selected folder except `cwd`; Codex uses `cwd` as its working directory and `[cwd, ...workFolders]` as its available work folders.

The bridge forwards the prompt to its read-only Codex App Server and returns the completed response:

```json
{"version":1,"type":"chat_response","id":"chat-1","response":"..."}
```

The bridge may emit streamed text before the completed response:

```json
{"version":1,"type":"chat_delta","id":"chat-1","delta":"partial text"}
```

Codex tool/progress notifications are forwarded as `chat_event` messages with the correlated request ID. A client may cancel a pending chat using the existing cancellation envelope; the bridge sends `cancelled` and `request_cancelled` after interrupting the active Codex turn. The bridge keeps the Codex thread for subsequent prompts during the same activation, providing basic multi-turn continuity. A missing prompt is not executable and receives `unsupported_request`; a stale timestamp is rejected before any Codex request. Structured diagram context and source-navigation actions remain deferred until their schemas are defined.
