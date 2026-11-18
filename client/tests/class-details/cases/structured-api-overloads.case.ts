import { expect, it } from 'vitest';
import { parseClassDetails, type ClassDetails } from '@codaigram/shared/class-types';
import { classDetailsToText } from '../../../src/class-details';
import { logAndThrow } from '../../../src/client_utils';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'projects provenance-bearing API overload objects into the editor',
  prompt: {
    availability: 'available',
    old: 'Keep the editor compatible with structured class overloads and provenance.',
    history: [
      { when: '2026/11/15 09:35', text: 'getClassesHistory returns structures similar to getClasses, but includes the history of each "method", relationship, overload (note that this means an overload is no longer simply an array - it has to become an interface/structure)' },
    ],
  },
};

export function registerStructuredApiOverloadsCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const actor: { kind: string; name: string; version: string } = { kind: 'scan', name: 'scanner', version: 'v1' };
    const response: unknown = {
      name: 'Notebook',
      methods: [{
        name: 'find',
        origin: actor,
        overloads: [{ args: [{ arg: 'key', t: 'string' }], origin: actor }],
      }],
      relations: [],
      
    };
    const details: ClassDetails = parseClassDetails(response, logAndThrow);
    expect(classDetailsToText(details)).toBe('Notebook\n  find(key: string)');
  });
}
