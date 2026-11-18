import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'accepts a standalone partial class without members or relationships',
  prompt: {
    availability: 'available',
    old: 'Check that a standalone class name parses without members or relationships.',
    history: [],
  },
};

export function registerPartialClassCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('Widget')).toMatchObject({
      ok: true,
      diagram: {
        title: 'Widget',
        members: [],
        targets: [],
      },
    });
  });
}
