import { expect, it } from 'vitest';
import { formatMember } from '../../../src/signatures';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'keeps empty methods and unrecognized members intact',
  prompt: {
    availability: 'available',
    text: 'Display method names in class boxes while preserving non-method DSL lines without changing their text.'
  }
};

export function registerEmptyMembersCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(formatMember('recalcLayout()')).toEqual({
      text: 'recalcLayout',
      tooltip: 'recalcLayout()',
      parameters: [] });
    expect(formatMember('OWNS classes: Class[]')).toEqual({
      text: 'OWNS classes: Class[]',
      tooltip: 'OWNS classes: Class[]' });
    expect(formatMember('foo(x: Map<string, number>)')).toEqual({
      text: 'foo',
      tooltip: 'foo(x)\n-x: Map<string, number>',
      parameters: [{ name: 'x', type: 'Map<string, number>' }] });
  });
}
