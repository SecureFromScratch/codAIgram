import { describe } from 'vitest';
import { registerModelInventoryCase } from './cases/model-inventory.case';
import { registerModelChangesCase } from './cases/model-changes.case';
import { registerModelParseCase } from './cases/model-parse.case';

describe('object workspace model', () => {
  registerModelInventoryCase();
  registerModelChangesCase();
  registerModelParseCase();
});
