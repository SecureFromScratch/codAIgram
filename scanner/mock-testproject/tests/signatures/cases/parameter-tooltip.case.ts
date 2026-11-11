import { expect, it } from 'vitest';
import { formatMember } from '../../../src/signatures';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'shows parameter names and records their types and character ranges',
  prompt: {
    availability: 'available',
    text: 'In a class diagram, show only method and parameter names while the tooltip shows parameter types.'
  }
};

export function registerParameterTooltipCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(formatMember('addClass(name: string, publicMethods: string[])')).toEqual({
      text: 'addClass',
      tooltip: 'addClass(name, publicMethods)\n-name: string\n-publicMethods: string[]',
      parameters: [{ name: 'name', type: 'string' }, { name: 'publicMethods', type: 'string[]' }] });
  });
}
