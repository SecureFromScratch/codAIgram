import { describe } from 'node:test';
import { registerPersistAndReadCase } from './cases/persist-and-read.case.ts';
import { registerRequestedOrderCase } from './cases/requested-order.case.ts';

describe('Firestore class repository', (): void => {
  registerPersistAndReadCase();
  registerRequestedOrderCase();
});
