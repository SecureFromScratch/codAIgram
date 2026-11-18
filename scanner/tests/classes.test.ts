import { describe } from 'node:test';
import { registerUploadsMockProjectClassesCase } from './cases/uploads-mock-project-classes.case.ts';
import { registerExceptionUsageCase } from './cases/exception-usage.case.ts';

describe('scanner class upload', () => {
  registerUploadsMockProjectClassesCase();
  registerExceptionUsageCase();
});
