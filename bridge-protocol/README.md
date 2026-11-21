# CodAIgram Bridge Protocol

This sibling package contains the host-independent CodAIgram Bridge protocol logic shared by the VS Code extension, the browser client, and mock hosts. It includes request validation, workspace synchronization, pending editor-wait state, and a `BridgeClient` API for retrieving workspace folders and sending AI prompts. `BridgeClient` accepts a socket factory so each host can supply its own WebSocket implementation. This package does not import `vscode`.

Build it with:

```text
npm run compile
```

The VS Code extension consumes the compiled package through `@codaigram/bridge-protocol`. Browser clients should use its `./client` entry point rather than implementing protocol messages themselves.
