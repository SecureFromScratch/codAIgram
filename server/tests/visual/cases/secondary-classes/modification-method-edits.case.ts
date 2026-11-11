import { test } from 'node:test';
import { getSecondaryClassFixture } from '../../support/secondary-class-support.ts';
import { verifySecondaryClassMethodEdits } from '../../support/secondary-class-verifications.ts';
export const TEST_CASE_METADATA = { title: 'Modification method add, rename, delete, and undo update only Modification', prompt: { availability: 'available', text: 'Repeat method editing and undo coverage for Modification.' } };
export function registerModificationMethodEditsCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifySecondaryClassMethodEdits(getSecondaryClassFixture('Modification')); }); }
