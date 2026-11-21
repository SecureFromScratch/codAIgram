# CodAIgram Bridge

CodAIgram Bridge is a VS Code extension that starts a loopback-only WebSocket
listener for CodAIgram. The operating system allocates its listening port; the
extension activation API reports the chosen port and temporary one-time token.
A client connecting to `ws://127.0.0.1:<allocated-port>/<token>` receives the
text message `Hello` and can keep the connection open. The token is consumed by
the first successful connection.

## Prerequisites

- Node.js 22 or later.
- VS Code and a desktop/Electron display environment. Headless Linux CI needs
  Xvfb (or an equivalent display server) to run the integration test.

## Install and build

```sh
npm install
npm run compile
```

To rebuild on changes, run `npm run watch`.

## Run in VS Code

Open this folder in VS Code and press **F5**. This starts an Extension
Development Host, where the extension activates after startup. Then run:

For a WebSocket manual check, obtain the allocated port and token from the
extension activation API, then use a Node.js environment with WebSocket support:

```js
const socket = new WebSocket("ws://127.0.0.1:<allocated-port>/<token>");
socket.addEventListener("message", event => console.log(event.data));
```

The first output is `Hello`. The **CodAIgram Bridge** Output channel reports
listener and client lifecycle events. Closing the Extension Development Host
releases the allocated port.

## Integration test

```sh
npm test
```

`npm test` compiles the extension, launches an isolated real VS Code Extension
Development Host using `@vscode/test-electron`, tests WebSocket connection and
HTTP fallback behavior, then verifies that the allocated port is released. A successful
Mocha run reports four passing tests and exits with code 0.

The test launcher deliberately passes `--disable-extensions` to the Electron host
and supplies a temporary user-data and extensions directory. This prevents installed
user extensions from changing the test environment. The bridge under development is
then loaded explicitly through `extensionDevelopmentPath`; the banner saying that
installed extensions are temporarily disabled is therefore expected and does not
mean that the bridge extension is disabled. Tests always use the cached VS Code
1.146.0 installation selected in `tests/runTest.ts`.

The OS allocates the port atomically with `listen(0, "127.0.0.1")`; no random
port selection, token persistence, or user-facing connection UI is implemented
in this step.
