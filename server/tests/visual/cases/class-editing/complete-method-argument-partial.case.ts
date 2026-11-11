import { test } from 'node:test';
import { verifyReferencedHiddenPartial } from '../../support/referenced-partial-class-verification.ts';
export const TEST_CASE_METADATA = { title: 'completes a hidden partial class referenced by a method argument', prompt: { availability: 'available', text: 'A hidden partial class referenced by a method argument can be completed.' } };
export function registerCompleteMethodArgumentPartialCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { await verifyReferencedHiddenPartial('  accept(value: ArgumentType)', 'ArgumentType'); }); }
