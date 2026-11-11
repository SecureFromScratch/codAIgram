# Local startup and setup

This guide runs codAIgram locally with the Firestore Native-mode emulator. It does not deploy to App Engine or create a cloud database. Run commands from the codAIgram project directory unless noted otherwise.

## Prerequisites

- Node.js 22 or later and npm.
- Firebase CLI (`firebase`) and Java 21, used by the Firestore emulator. The CLI downloads the emulator on first use.
- The sibling `ts/vv_ts`, `ts/mandate`, `ts/BuildGates_ts`, and `ts/BuildGates_react` projects, with their packages built so their `dist` files exist. `npm run bootstrap` packages those local support libraries; it does not build them.
- For browser tests, install Playwright's Chromium once with `npx playwright install chromium`.

From a new checkout or after changing dependencies:

```sh
npm install
npm run bootstrap
npm run verify
```

Ordinary `npm install` can remove the locally staged VV and Mandate packages; run `npm run bootstrap` again afterwards. The build runs TypeScript, the TypeScript and React build gates, a second TypeScript build, and the client bundle. `verify` also runs unit, API, and browser tests.

## Start the emulator

In a dedicated terminal, from the project directory:

```sh
firebase emulators:start --only firestore --project demo-codaigram
```

Leave this terminal running. `firebase.json` configures Firestore on `127.0.0.1:8080` and disables the emulator UI. The `demo-` project ID is for local emulation. If you choose another project ID or port, use the same values in the server terminal and update `firebase.json` if changing the port.

## Seed and start the server

In a second terminal, set the environment variables in that terminal. Environment changes in one terminal do not automatically appear in other existing terminals.

PowerShell:

```powershell
$env:GOOGLE_CLOUD_PROJECT = 'demo-codaigram'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
npm run seed:local
npm run start:server
```

Bash:

```bash
export GOOGLE_CLOUD_PROJECT='demo-codaigram'
export FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
npm run seed:local
npm run start:server
```

The seed creates `classes/ClassDiagram` and `classes/Class` only when they are missing; it never overwrites existing documents. Emulator data is temporary by default, so seed again after restarting the emulator. The seed and server require a local emulator address (`localhost` or `127.0.0.1` with a port) and a project ID; they will not connect to a live database. The server listens on `127.0.0.1:3001`.

## Start the client

In a third terminal:

```sh
npm run dev:client
```

Open the URL Vite prints, normally `http://127.0.0.1:5173/`. Vite proxies `/api` to the local server. On startup, the client requests both class documents and places `ClassDiagram` details in the editor. The editor's subsequent changes are local and are not written back to Firestore.

Stop each process with Ctrl+C in its terminal. Do not stop an emulator or server that belongs to another process or project.

## Tests and troubleshooting

- `npm run verify` runs the build and ordinary tests. Its HTTP and browser tests use a deterministic in-memory repository and do not need an emulator.
- With the emulator running and the two environment variables set, `npm run test:firestore` tests the actual Firestore repository through the HTTP route. It creates a uniquely named test collection and deletes its own documents afterward. Run a build first if server source has changed.
- If the client reports it cannot load class details, check that the emulator and server are running, that the project IDs match, and that `npm run seed:local` succeeded.
- If a port is already in use, stop the process you own or configure another port. For Firestore, update both `firebase.json` and `FIRESTORE_EMULATOR_HOST` together; the client expects the server on port 3001 via the Vite proxy.
- If a local support package is missing after an npm install, rerun `npm run bootstrap`.

Cloud credentials, production hosting, authentication, and persistent user documents are not configured by this local-only setup. Document any future startup or emulator setup changes here.
