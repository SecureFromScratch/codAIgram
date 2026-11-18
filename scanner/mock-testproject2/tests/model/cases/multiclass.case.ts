import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'accepts multiple classes, typed properties, inline enums, type-only arguments and partial classes',
  prompt: {
    availability: 'available',
    old: 'Add a DSL test allowing multiple classes separated by an empty line, partial classes, typed properties, and inline enums.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise." },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed." },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)" },
    ],
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
