import { test } from 'node:test';
import { getSecondaryClassFixture } from '../../support/secondary-class-support.ts';
import { verifySecondaryClassTooltipEdges } from '../../support/secondary-class-verifications.ts';
export const TEST_CASE_METADATA = { title: 'ModificationHistory method tooltip stays within the panel at top and bottom edges', prompt: { availability: 'available', text: 'Repeat tooltip edge visibility coverage for ModificationHistory.' } };
export function registerModificationHistoryTooltipEdgesCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifySecondaryClassTooltipEdges(getSecondaryClassFixture('ModificationHistory')); }); }
