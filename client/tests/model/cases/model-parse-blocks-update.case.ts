import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { Result } from 'neverthrow';
import { logAndThrow } from '../../../src/client_utils';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_TEXTS: readonly string[] = [
  'Root\n  add(value: string)\nOWNS children: Child[]',
  'Child\n  name: string',
];

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'parses each valid editor class block and updates them together',
  prompt: {
    availability: 'available',
    old: 'Check that valid multi-class DSL text is parsed into ClassDetails and applied to the current model.',
    history: [],
  },
};

export function registerModelParseBlocksUpdateCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    const parsedClasses: ClassDetails[] = CLASS_TEXTS.map((text: string) => {
      const parsed: ClassDetails | Error = Model.parse(text);
      if (parsed instanceof Error) logAndThrow(parsed);
      return parsed;
    });

    model.current.updateClasses(parsedClasses);

    expect(Array.from(model.current.current.keys())).toEqual(['Root', 'Child']);
    const root: Result<ClassDetails, Error> = model.current.tryGetModel('Root');
    const child: Result<ClassDetails, Error> = model.current.tryGetModel('Child');
    expect(root.isOk()).toBe(true);
    expect(child.isOk()).toBe(true);
    if (root.isOk()) expect(root.value.relations[0]?.target).toBe('Child');
    if (child.isOk()) expect(child.value.methods[0]?.name).toBe('name');
  });
}
