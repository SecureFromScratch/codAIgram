# Step 26 Summary - Validated Ping/Pong

## Change

An authenticated client may send the JSON text request `{ "version": 1, "type": "ping", "id": "client-request-id" }`. The extension replies `{ "version": 1, "type": "pong", "id": "client-request-id" }`. The identifier must be a string containing 1–4096 UTF-16 code units. Mandate validates a VV-minted strict schema that requires the three properties, exact version and type, and rejects additional properties. Invalid JSON, invalid request shapes, and binary frames are ignored; valid subsequent requests continue to work. IDs are not logged. The connection welcome, authentication, and lifecycle remain in place.

The small validation adapter is bundled as CommonJS targeting Node 20, so the extension's existing CommonJS host can use ESM-only Mandate and VV without a project-wide module migration. The esbuild alias makes the adapter and Mandate share the same VV instance, which is required for VV schema branding. The adapter remains included in BuildGates and TypeScript checks. General RPC and message-size limits remain outside this step.

## Files changed

- `src/extension.ts`: listen for text ping requests and send correlated pongs.
- `src/pingValidation.ts`, `src/pingValidation.bundle.d.ts`: VV/Mandate validation and bundled-adapter declaration.
- `tests/suite/extension.browser-ping.case.ts`, `extension.reject-invalid-ping.case.ts`, `extension.test.ts`: register and exercise browser requests, correlation, invalid requests and connection continuity.
- `package.json`, `package-lock.json`: local Mandate/VV and esbuild dependencies; build the adapter as part of compilation.
- `docs/application_protocol.md`, `docs/startup.md`: protocol envelope and build prerequisites/commands.
- `docs/step_summary_26.md`: this record.

## RED

With production unchanged, `npm run compile` passed BuildGates and TypeScript. `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1 using project-local VS Code 1.146.0: the authentication scenario had **16 passing, 1 pending, 2 failing**. The real browser test timed out waiting for correlated pongs; the invalid-input test timed out waiting for the pong for its valid sentinel. The HTTPS browser test was pending under the existing Linux limitation. These were functional failures: no ping handler existed.

## GREEN

- `node_modules/.bin/esbuild --version`: `0.25.12`, confirming the platform binary runs despite the installation scripts warning.
- `npm run compile`: passed BuildGates, TypeScript, and the bundled adapter build.
- Bundled-adapter smoke check: a valid ping returned its identifier; malformed JSON and an additional property were rejected. This also confirmed Mandate accepted the schema's VV brand.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 using cached VS Code 1.146.0. Authentication reported **18 passing, 1 pending**, including the real Chromium ping test and the malformed/binary/invalid-shape test; concurrency and shutdown each reported **4 passing**.
- `npm run verify`: unavailable because this package has no verify script.

## Failures and limitations

The initial offline install of Mandate/VV/esbuild failed with `ENOTCACHED` for esbuild; a first escalated request was aborted. The lead subsequently installed the dependencies, after which the adapter and esbuild binary were verified. Initial adapter gate runs exposed UBG020 definition naming and UBG017 formatting diagnostics; named definitions and formatting fixed them before GREEN. The Linux HTTPS browser case remains intentionally pending; Windows and a Node 20 host were not directly tested in this run. `npm run watch` performs an initial adapter bundle, but adapter/dependency changes require rerunning `npm run bundle:validator`, as documented in startup instructions.
