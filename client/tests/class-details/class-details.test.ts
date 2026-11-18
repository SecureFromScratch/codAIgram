import { describe } from 'vitest';
import { registerDirectProjectionCase } from './cases/direct-projection.case';
import { registerStructuredMembersCase } from './cases/structured-members.case';
import { registerStructuredApiOverloadsCase } from './cases/structured-api-overloads.case';

describe('class details conversion', () => {
  registerDirectProjectionCase();
  registerStructuredMembersCase();
  registerStructuredApiOverloadsCase();
});
