import { describe } from 'vitest';
import { registerInitialDiagramCase } from './cases/initial-diagram.case';
import { registerMulticlassCase } from './cases/multiclass.case';
import { registerOwnershipCase } from './cases/ownership.case';
import { registerRejectIncompleteCase } from './cases/reject-incomplete.case';
import { registerRejectMethodCase } from './cases/reject-method.case';
import { registerRejectSeparatorCase } from './cases/reject-separator.case';
import { registerRejectUnknownCase } from './cases/reject-unknown.case';
import { registerSemanticUpdateCase } from './cases/semantic-update.case';
import { registerValidMultilineCase } from './cases/valid-multiline.case';

describe('diagram projection', () => {
  registerMulticlassCase();
  registerInitialDiagramCase();
  registerSemanticUpdateCase();
  registerValidMultilineCase();
  registerRejectSeparatorCase();
  registerRejectMethodCase();
  registerRejectIncompleteCase();
  registerRejectUnknownCase();
  registerOwnershipCase();
});
