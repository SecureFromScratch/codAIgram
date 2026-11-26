import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const DELEGATE: ClassDetails = {
  name: 'BridgeSocketFactory',
  state: 'delegate',
  methods: [{
    name: '',
    overloads: [
      [{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'string' }, { arg: 'origin', t: 'string' }],
      [{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'URL' }],
    ],
  }],
  relations: [],
};

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'preserves delegate signature through DSL decompile and parse',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a model test proving delegate state, the unnamed argument overload, and return type survive converting to DSL and parsing it back.' },
    ],
  },
};

export function registerDelegateRoundtripCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const parsed: ClassDetails | Error = Model.parse(Model.decompile(DELEGATE));
    expect(parsed).toEqual(DELEGATE);
  });
  it('roundtrips interface call signatures and same-name field/callable overloads', () => {
    const callable: ClassDetails = {
      name: 'CallableObject',
      methods: [
        { name: '', overloads: [[{ arg: '+RET', t: 'string' }, { arg: 'value', t: 'number' }], [{ arg: '+RET', t: 'number' }, { arg: 'value', t: 'string' }]] },
        { name: 'value', overloads: [[{ arg: '+RO', t: 'string' }], [{ arg: '+RET', t: 'number' }, { arg: 'input', t: 'string' }]] },
      ],
      relations: [],
    };
    expect(Model.parse(Model.decompile(callable))).toEqual(callable);
  });
}
