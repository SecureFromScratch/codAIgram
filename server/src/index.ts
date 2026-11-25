import { createApp } from './app.js';
import { createLocalFirestore, FirestoreClassRepository } from './firestore-repository.js';
import { logServerReady, logServerStartupFailure } from './server_utils.js';

const APP: ReturnType<typeof createApp> = createApp(new FirestoreClassRepository(createLocalFirestore()));
const SERVER: ReturnType<typeof APP.listen> = APP.listen(3001, '127.0.0.1');
SERVER.once('listening', () => logServerReady('127.0.0.1', 3001));
SERVER.once('error', (error: Error) => {
  logServerStartupFailure(error);
  process.exitCode = 1;
});
