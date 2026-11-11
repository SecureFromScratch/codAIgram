import { test } from 'node:test';
import { getSecondaryClassFixture } from '../../support/secondary-class-support.ts';
import { verifySecondaryClassPropertyEdits } from '../../support/secondary-class-verifications.ts';
export const TEST_CASE_METADATA = { title: 'ModificationHistory property, invalid-syntax, and title edits update only ModificationHistory', prompt: { availability: 'available', text: 'Repeat property and class-title editing coverage for ModificationHistory.' } };
export function registerModificationHistoryPropertyEditsCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifySecondaryClassPropertyEdits(getSecondaryClassFixture('ModificationHistory')); }); }
