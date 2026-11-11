import { createLocalFirestore } from '../server/dist/firestore-repository.js';
import { INITIAL_CLASSES } from '../server/dist/memory-class-repository.js';

const database = createLocalFirestore();
try {
  for (const item of INITIAL_CLASSES) {
    try {
      await database.collection('classes').doc(item.name).create(item);
      process.stdout.write(`Created ${item.name}\n`);
    } catch (error) {
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
      process.stdout.write(`Preserved existing ${item.name}\n`);
    }
  }
} finally {
  await database.terminate();
}
