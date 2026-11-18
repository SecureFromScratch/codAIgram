# CodAIgram Bridge startup and tests

Run commands from the `codAIgram-bridge` directory. Install dependencies with `npm install`; the `@untrust/buildgates` package is a local sibling dependency. Run `npm test` to run the build gates, compile TypeScript, and launch the VS Code 1.146.0 integration hosts. A desktop display or Xvfb is required, along with a Chromium browser. On Linux the runner checks `/usr/bin/chromium`, `/usr/bin/chromium-browser`, and `/usr/bin/google-chrome`; set `CODAIGRAM_BRIDGE_CHROMIUM_PATH` to use another executable.

On Linux the HTTPS certificate integration case is skipped with a prominent warning because certificate trust setup is not supported there. Other integration cases still run and require a Linux VS Code 1.146.0 installation managed by `@vscode/test-electron`. On Windows the HTTPS fixture uses the user's certificate trust store and the HTTPS case runs as before.

The build currently reports other BuildGates diagnostics, so `npm test` stops before TypeScript and integration tests. To check TypeScript independently run `npm run compile:typescript`; after compiling, `npm run test:integration` runs the integration runner directly. There is no `npm run verify` script in this project.
