import { createApp } from './app.js';
import { createLocalFirestore, FirestoreClassRepository } from './firestore-repository.js';

const APP: ReturnType<typeof createApp> = createApp(new FirestoreClassRepository(createLocalFirestore()));
APP.listen(3001, '127.0.0.1');
