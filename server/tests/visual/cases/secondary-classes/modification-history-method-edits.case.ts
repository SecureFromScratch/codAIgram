import { test } from 'node:test';
import { getSecondaryClassFixture } from '../../support/secondary-class-support.ts';
import { verifySecondaryClassMethodEdits } from '../../support/secondary-class-verifications.ts';
export const TEST_CASE_METADATA = { title: 'ModificationHistory method add, rename, delete, and undo update only ModificationHistory', prompt: { availability: 'available', text: 'Repeat method editing and undo coverage for ModificationHistory.' } };
export function registerModificationHistoryMethodEditsCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifySecondaryClassMethodEdits(getSecondaryClassFixture('ModificationHistory')); }); }
