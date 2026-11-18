import { describe } from 'vitest';
import { registerModelOptionalAttributeCase } from './cases/model-optional-attribute.case';
import { registerModelSwappingCase } from './cases/model-swapping.case';
import { registerModelUpdateScopeCase } from './cases/model-update-scope.case';

describe('object model lifecycle', () => {
  registerModelSwappingCase();
  registerModelUpdateScopeCase();
  registerModelOptionalAttributeCase();
});
