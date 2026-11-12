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

Root `npm install` also links the `@codaigram/shared` workspace package used by
the scanner, server, and client. Build the TypeScript solution before starting
those programs so that `shared/dist` contains the package's JavaScript files.

## Persistent interactive workbench

The **workbench** is the manual client/server exploration mode. It persists Firestore emulator data in `.workbench/firestore/`, a Git-ignored directory. It never seeds example classes: a new workbench starts with an empty database. Stop the emulator with Ctrl+C so it exports its latest data.

Run each command in a separate Bash terminal, in this order:

```sh
./scripts/workbench-firestore.sh
./scripts/workbench-server.sh
./scripts/workbench-client.sh
```

The workbench emulator uses `127.0.0.1:8080`; the workbench server uses `127.0.0.1:3001`; Vite prints the client URL, normally `http://127.0.0.1:5173/`. The server launcher performs an initial compile, then keeps TypeScript and Node watchers running: a server-source save recompiles `server/dist` and automatically restarts the server. The Classes page retrieves the complete class inventory and opens the first returned class in the editor while projecting every returned class in the graph.

After the server is running, scan the server and shared class code with this fourth Bash command:

```sh
./scripts/workbench-scan-server.sh
```

The command uses `codaigram-server server,shared --types class` and uploads class
details to the same persistent local emulator. Re-running the scanner replaces
the details of each class found; it does not remove classes absent from a scan.

To discard all workbench data, stop the emulator and delete `.workbench/firestore/` yourself. No test or normal development command uses that directory.

## Temporary emulator and seeded sample data

For a temporary emulator session with the sample classes, run the emulator in one terminal:

```sh
firebase emulators:start --only firestore --project demo-codaigram
```

Then set variables and seed/start the server in another terminal. Environment changes in one terminal do not automatically appear in other existing terminals.

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

The seed creates `classes/ClassDiagram` and `classes/Class` only when they are missing; it never overwrites existing documents. This emulator data is temporary by default, so seed again after restarting the emulator. The seed and server require a local emulator address (`localhost` or `127.0.0.1` with a port) and a project ID; they will not connect to a live database. The server listens on `127.0.0.1:3001`.

## Start the client outside the workbench

In a third terminal:

```sh
npm run dev:client
```

Open the URL Vite prints, normally `http://127.0.0.1:5173/`. Vite proxies `/api` to the local server. On startup, the client requests both class documents and places `ClassDiagram` details in the editor. The editor's subsequent changes are local and are not written back to Firestore.

Stop each process with Ctrl+C in its terminal. Do not stop an emulator or server that belongs to another process or project.

## Tests and troubleshooting

- `npm run verify` runs the build and ordinary tests. Its HTTP and browser tests use a deterministic in-memory repository and do not need an emulator or persist workbench data.
- `npm run test:visual` captures browser console messages and uncaught browser errors in `logs/visual-tests.log`, replacing that file at the start of each run. The log may contain application data; keep it private.
- `npm run test:firestore` starts an isolated Firestore emulator on `127.0.0.1:18080`, distinct from the workbench emulator on `8080`, then tests the actual Firestore repository through the HTTP route. It creates uniquely named test collections and terminates the test emulator afterward. Run a build first if server source has changed.

- Automated API and visual-test servers bind an OS-assigned port rather than the workbench server port `3001`. Visual tests run Vite on strict test-only port `41731`, not the workbench client port `5173`. The Firestore test emulator uses `18080` with auxiliary test-only hub, logging, and WebSocket ports `14400`, `14500`, and `19151`.
- If the client reports it cannot load class details, check that the emulator and server are running, that the project IDs match, and that `GET /api/getClasses` returns a non-empty, valid class inventory. Seeding is optional; the page does not require a class named `ClassDiagram`.
- If a port is already in use, stop the process you own or configure another port. For Firestore, update both `firebase.json` and `FIRESTORE_EMULATOR_HOST` together; the client expects the server on port 3001 via the Vite proxy.
- If a local support package is missing after an npm install, rerun `npm run bootstrap`.

Cloud credentials, production hosting, authentication, and persistent user documents are not configured by this local-only setup. The workbench's emulator export is local developer state only. Document any future startup or emulator setup changes here.
