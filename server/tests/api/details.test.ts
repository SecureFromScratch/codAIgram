import { describe } from 'node:test';
import { registerClassDetailsCase } from './cases/class-details.case.ts';
import { registerInvalidInputCase } from './cases/invalid-input.case.ts';
import { registerInvalidUpdateCase } from './cases/invalid-update.case.ts';
import { registerOversizeUpdateCase } from './cases/oversize-update.case.ts';
import { registerUpdateClassesCase } from './cases/update-classes.case.ts';

describe('class details API', (): void => {
  registerClassDetailsCase();
  registerUpdateClassesCase();
  registerInvalidUpdateCase();
  registerOversizeUpdateCase();
  registerInvalidInputCase();
});
