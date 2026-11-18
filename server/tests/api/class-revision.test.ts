import { describe } from 'node:test';
import { registerRevisionUsageCase } from './cases/revision-usage.case.js';
import { registerRevisionIdempotenceCase } from './cases/revision-idempotence.case.js';
import { registerRevisionDeletionsCase } from './cases/revision-deletions.case.js';
import { registerRevisionInvalidReferenceCase } from './cases/revision-invalid-reference.case.js';
import { registerRevisionOverloadCollisionCase } from './cases/revision-overload-collision.case.js';
import { registerRevisionReconstructionCase } from './cases/revision-reconstruction.case.js';
import { registerRevisionMemoryPersistenceCase } from './cases/revision-memory-persistence.case.js';
import { registerRevisionStorageValidationCase } from './cases/revision-storage-validation.case.js';
import { registerRevisionCompositeIdempotenceCase } from './cases/revision-composite-idempotence.case.js';

describe('class revision calculation', () => {
  registerRevisionIdempotenceCase();
  registerRevisionDeletionsCase();
  registerRevisionInvalidReferenceCase();
  registerRevisionOverloadCollisionCase();
  registerRevisionReconstructionCase();
  registerRevisionMemoryPersistenceCase();
  registerRevisionStorageValidationCase();
  registerRevisionCompositeIdempotenceCase();
  registerRevisionUsageCase();
});
