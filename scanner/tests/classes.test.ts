import { describe } from 'node:test';
import { registerUploadsMockProjectClassesCase } from './cases/uploads-mock-project-classes.case.ts';
import { registerExceptionUsageCase } from './cases/exception-usage.case.ts';
import { registerDelegateAliasCase } from './cases/delegate-alias.case.ts';
import { registerTypeAliasStatesCase } from './cases/type-alias-states.case.ts';

describe('scanner class upload', () => {
  registerUploadsMockProjectClassesCase();
  registerExceptionUsageCase();
  registerDelegateAliasCase();
  registerTypeAliasStatesCase();
});
