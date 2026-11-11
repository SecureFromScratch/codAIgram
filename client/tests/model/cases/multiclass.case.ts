import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'accepts multiple classes, typed properties, inline enums, type-only arguments and partial classes',
  prompt: {
    availability: 'available',
    text: 'Add a DSL test allowing multiple classes separated by an empty line, partial classes, typed properties, and inline enums.'
  }
};

export function registerMulticlassCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const text: string = 'Diagram\nOWNS items: Class[]\n\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nPartial';
    expect(parseDiagram(text)).toMatchObject({
      ok: true,
      diagram: {
        classes: [{
          title: 'Class',
          members: ['isPartial : bool', 'modifications: ModificationRecord[]', 'addModification(ModificationRecord)'] }, {
            title: 'ModificationRecord',
            members: ['by: [AI, Human, Scan]', 'at: datetime'] }, { title: 'Partial', members: [] }] } });
  });
}
