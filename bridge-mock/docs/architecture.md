# CodAIgram Bridge Mock

The mock is a sibling package of `codAIgram-bridge`. It reads one JSON configuration file at startup and serves the host-independent WebSocket protocol over a loopback port. The optional `port` config value defaults to `0` (a dynamically allocated port); a fixed port lets tests restart the mock with another config while clients keep using the same bridge URL. Workspace folders, the synchronization timestamp, and the authentication token are never generated or mutated in memory.

Configuration fields:

```json
{
  "authtoken": "test-token",
  "workspaceFolders": [{ "name": "project", "uri": "file:///project", "index": 0 }],
  "workspaceLastModified": 1730000000000,
  "promptResponses": [{ "prompt": "...", "response": "..." }],
  "trustedOrigins": ["https://codai.example"]
}
```

`trustedOrigins` is optional and defaults to the integration-test origin. The mock validates Host, Origin, and the configured token, returns the configured workspace folders, enforces synchronization timestamps, and implements ping, cancellation, active-editor wait timeout, duplicate-ID closure, HTTP 404/405 behavior, and the versioned welcome message.

Prompt-response pairs are matched by exact prompt text. A matching request returns `chat_response`; an unrecognized prompt returns an error with `code: "prompt_not_found"` and `status: 500`. The real extension forwards prompts to Codex instead of consulting this fixture map.

Run with:

```text
npm run compile
npm start -- path/to/config.json
```
