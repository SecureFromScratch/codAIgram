import { expect, it } from 'vitest';
import { INITIAL_TEXT, parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'models the initial class, members, and one-to-many relationship',
  prompt: {
    availability: 'available',
    text: 'Create the initial ClassDiagram model with methods and an OWNS one-to-many relation to Class.'
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
