import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'parses single, many, unnamed, and incomplete ownership',
  prompt: {
    availability: 'available',
    old: 'Test OWNS changes for singular and many arity, missing relation names, and incomplete referenced types.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "in server api test - expand classesDetails/updateClasses test to test for the following connection type between classes:\nOWNS\nREF\nUNK\nalso expand these tests to code editor in classes editing page. and the supported dsl." },
    ],
  }
};

export function registerOwnershipCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('Diagram\nOWNS item: Item')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{ name: 'item', target: 'Item', multiplicity: 'one' }] } });
    expect(parseDiagram('Diagram\nOWNS Item[]')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{ name: '', target: 'Item', multiplicity: 'many' }] } });
    expect(parseDiagram('Diagram\nOWNS item:')).toMatchObject({
      ok: false,
      diagram: {
        targets: [{ name: 'item', target: '?', multiplicity: 'one' }] } });
    expect(parseDiagram('Diagram\nitem: Item[]')).toMatchObject({
      ok: false,
      partialRetention: 'retain',
      diagram: { targets: [] } });
  });
}
