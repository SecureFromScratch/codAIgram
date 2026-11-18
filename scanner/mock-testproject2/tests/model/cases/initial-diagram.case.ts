import { expect, it } from 'vitest';
import { INITIAL_TEXT, parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'models the initial class, members, and one-to-many relationship',
  prompt: {
    availability: 'available',
    old: 'Create the initial ClassDiagram model with methods and an OWNS one-to-many relation to Class.',
    history: [
      { when: '2026/11/15 09:35', text: 'in mock-testproject2 - add prompt metadata to one of the tests, change the description of another test, replace a third test with a newlly imagined test.' },
    ],
  }
};

export function registerInitialDiagramCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const result: ReturnType<typeof parseDiagram> = parseDiagram(INITIAL_TEXT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram.title).toBe('ClassDiagram');
      expect(result.diagram.members).toHaveLength(4);
      expect(result.diagram.targets).toEqual([{ name: 'classes', target: 'Class', multiplicity: 'many' }]);
    }
  });
}
