import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects unknown declarations and malformed parameters',
  prompt: {
    availability: 'available',
    text: 'Report invalid method syntax but allow typed generic parameter types in the diagram DSL.'
  }
};

export function registerRejectUnknownCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('Diagram\n  calculate(value)')).toMatchObject({ ok: false });
    expect(parseDiagram('Diagram\n  calculate(value:)')).toMatchObject({ ok: false });
    expect(parseDiagram('Diagram\n  arbitrary text')).toMatchObject({ ok: false });
    expect(parseDiagram('Diagram\n  f(value: Map<string, number>)')).toMatchObject({ ok: true });
  });
}
