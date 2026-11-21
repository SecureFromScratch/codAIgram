# CodAIgram Bridge startup and tests

Run commands from the `codAIgram-bridge` directory. Install dependencies with `npm install`; `@untrust/buildgates`, `@untrust/vv`, and `@untrust/mandate-core` are local sibling dependencies. Build the VV and Mandate packages first so their `dist` files exist. The build also requires esbuild and its platform-specific binary.

Run `npm test` to run BuildGates, compile TypeScript, bundle the small Mandate/VV ping validation adapter for the CommonJS extension host, and launch the VS Code 1.146.0 integration hosts. `npm run compile` performs the gate check, TypeScript compilation, and adapter bundle. `npm run compile:typescript` compiles TypeScript and builds the adapter bundle. `npm run bundle:validator` rebuilds the adapter alone. `npm run watch` starts a TypeScript watch after an initial adapter build; rerun `npm run bundle:validator` after changing the adapter or its dependencies because the TypeScript watcher does not rebuild that bundle.

A desktop display or Xvfb is required, along with a Chromium browser. On Linux the runner checks `/usr/bin/chromium`, `/usr/bin/chromium-browser`, and `/usr/bin/google-chrome`; set `CODAIGRAM_BRIDGE_CHROMIUM_PATH` to use another executable.

On Linux the HTTPS certificate integration case is skipped with a prominent warning because certificate trust setup is not supported there. Other integration cases still run and require a Linux VS Code 1.146.0 installation managed by `@vscode/test-electron`. On Windows the HTTPS fixture uses the user's certificate trust store and the HTTPS case runs as before.

After compiling, `npm run test:integration` runs the integration runner directly. There is no `npm run verify` script in this project.

The runner opens a temporary single-folder workspace inside the project for the shutdown scenario; its other scenarios use an empty workspace. It removes the temporary workspace after the host exits.
