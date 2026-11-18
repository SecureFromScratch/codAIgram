# Connection security and browser compatibility design

## Architecture

JavaScript from the CodAIgram HTTPS website runs in the user's browser. The browser connects to the VS Code extension's loopback WebSocket listener at ws://localhost:<port>, with the one-time token in the URL path. The public website server does not connect to the extension.

The extension binds to 127.0.0.1 on an OS-assigned port. It serves HTTP and WebSocket without TLS, WSS, or custom encryption.

## Host validation

Validate the HTTP Host header during the WebSocket handshake, before completing the upgrade. Accept exactly localhost:<actual-port> and 127.0.0.1:<actual-port>. Reject missing headers, other names, and incorrect ports.

Host represents the hostname in the WebSocket URL, not the resolved IP address. For example, a URL using evil.com sends that hostname even if DNS resolves it to loopback. Reject it to protect against DNS rebinding. Integration tests must cover accepted and rejected headers.

## Origin validation

The Origin header identifies the page initiating the WebSocket connection. Accept only explicitly configured CodAIgram website origins. A separately configured test origin may be used for local testing. Compare scheme, hostname, and port exactly. Wildcards are not permitted. Reject missing, null, malformed, and unapproved origins before completing the upgrade.

Origin validation restricts initiating websites; it does not authenticate them. The one-time token remains mandatory. Test Origin validation independently from Host validation and token authentication.

## HTTPS browser compatibility

Verify JavaScript loaded from an HTTPS page can authenticate to ws://localhost:<port> and exchange messages with the extension. Use a minimal local HTTPS page on a separate port or a publicly hosted staging page. Allowlist its exact origin in the test configuration. The local HTTPS server is test infrastructure only.

Use a trusted development certificate for a local page. Exercise one headless Chromium browser. Do not disable certificate checks or other browser security protections. Report browser incompatibility instead of bypassing browser protections.

The integration scenario creates a leaf certificate signed by a project-local development CA, installs that CA in the current test user's Root store when needed, and keeps Chromium certificate validation enabled. It verifies that HTTPS JavaScript connects to `ws://localhost:<port>` and receives `Hello`. A separate HTTP test page uses a Chromium process-local DNS mapping to send a fictitious hostname to loopback. The test observes the browser's Host value, verifies rejection, then confirms the same token works through localhost. Direct tests separately verify exact Host and Origin behavior. No system hosts file is changed.

The browser test uses an explicitly allowlisted local origin. It does not prove operation from a publicly hosted CodAIgram page or cover every browser's Local Network Access prompt behavior.

## Verification and progression

Treat Host protection, Origin protection, and browser compatibility as separate requirements. Implement and test each independently using RED then GREEN. Keep integration tests in a real VS Code Extension Development Host using the project-local VS Code 1.146.0 managed by @vscode/test-electron.

