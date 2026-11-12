import { describe } from 'node:test';
import { registerScannerLogCase } from './cases/scanner-log.case.ts';
import { registerScannerHttpLogCase } from './cases/scanner-http-log.case.ts';

describe('scanner log', () => {
  registerScannerLogCase();
  registerScannerHttpLogCase();
});
