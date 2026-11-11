import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'parses single, many, unnamed, and incomplete ownership',
  prompt: {
    availability: 'available',
    text: 'Test OWNS changes for singular and many arity, missing relation names, and incomplete referenced types.'
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
