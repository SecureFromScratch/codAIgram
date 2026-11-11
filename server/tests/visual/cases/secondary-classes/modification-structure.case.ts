import { test } from 'node:test';
import { getSecondaryClassFixture } from '../../support/secondary-class-support.ts';
import { verifySecondaryClassStructure } from '../../support/secondary-class-verifications.ts';
export const TEST_CASE_METADATA = { title: 'Modification has correct isolated-class structure, bounds, highlighting, and badge', prompt: { availability: 'available', text: 'Repeat DSL and graph behavior coverage for the Modification class in isolation.' } };
export function registerModificationStructureCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifySecondaryClassStructure(getSecondaryClassFixture('Modification')); }); }
