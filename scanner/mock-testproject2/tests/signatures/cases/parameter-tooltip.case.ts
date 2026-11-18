import { expect, it } from 'vitest';
import { formatMember } from '../../../src/signatures';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'shows parameter names and records their types and character ranges',
  prompt: {
    availability: 'available',
    old: 'In a class diagram, show only method and parameter names while the tooltip shows parameter types.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "in the class diagram - method's text is NOT displayed as is. instead only the name of parameters is displayed and the type is displayed when hovering over the name (tooltip style)." },
      { when: "2026/11/15 09:35", text: "graph visual changes:\n1) classbox top bar (with the name) has to much bottom padding - should be a tighter bar vertically.\n2) the partial class \"Class\" classbox only contains its name - which is the right way, but the bg color/styl should be as for the name bar in a regular (with methods) classbox - it's a classbox with no methods textbox area.\n3) for each method line in the classbox method area - only put the method name. tooltip (when hovering) will contain show full method signature, but with param names and not types. instead types will be listed below, i.e.:\n  addClass(name, publicMethods)\n  -name: string\n  -publicMethods: string[]\n4) the OWNS line should not be listed in thevisual\n5) the name of the member variable for the OWNS classes: Class[] should be on the connector to Class\n6) since this is a OWNS relatiobnship the connector needs to start with a filled diamond (uml standard notation for ownership)" },
    ],
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
