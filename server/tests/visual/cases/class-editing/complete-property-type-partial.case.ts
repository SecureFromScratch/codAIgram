import { test } from 'node:test';
import { verifyReferencedHiddenPartial } from '../../support/referenced-partial-class-verification.ts';
export const TEST_CASE_METADATA = { title: 'completes a hidden partial class referenced by a property type', prompt: { availability: 'available', text: 'A hidden partial class referenced by a property type can be completed.' } };
export function registerCompletePropertyTypePartialCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifyReferencedHiddenPartial('  field: PropertyType', 'PropertyType'); }); }
