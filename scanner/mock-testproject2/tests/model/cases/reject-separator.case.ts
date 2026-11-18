import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects missing separators, property colons and types, and duplicate class names',
  prompt: {
    availability: 'available',
    old: 'Validate the DSL: classes require a blank-line separator and properties require a colon and a type.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error" },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)" },
    ],
  }
};

export function registerRejectSeparatorCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    ['Diagram\n  f()\nClass\n  x: bool', 'Diagram\n  property bool', 'Diagram\n  property:', 'Diagram\n\nDiagram'].forEach((text: string) => { expect(parseDiagram(text)).toMatchObject({ ok: false }); });
  });
}
