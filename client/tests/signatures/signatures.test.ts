import { describe } from 'vitest';
import { registerEmptyMembersCase } from './cases/empty-members.case';
import { registerParameterTooltipCase } from './cases/parameter-tooltip.case';

describe('method projection', () => {
  registerParameterTooltipCase();
  registerEmptyMembersCase();
});
