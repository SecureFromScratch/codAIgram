import { describe } from 'node:test';
import { registerInitialInventoryCase } from './cases/initial-inventory.case.ts';
import { registerUpdateInventoryCase } from './cases/update-inventory.case.ts';

describe('test inventory API', (): void => {
  registerInitialInventoryCase();
  registerUpdateInventoryCase();
});
