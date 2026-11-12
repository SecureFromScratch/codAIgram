import { expect, it } from 'vitest';
import { classDetailsToText, type ClassDetails } from '../../../src/class-details';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'converts structured methods, public fields, and accessors to DSL lines',
  prompt: {
    availability: 'available',
    text: 'Represent method arguments and member kinds as FieldType values, including their composable types, and render fields without parentheses.'
  }
};

const DETAILS: ClassDetails = {
  name: 'Task',
  methods: [
    {
      name: 'assign',
      overloads: [[
        { arg: 'assignee', t: 'User' },
        { arg: 'urgent', t: 'boolean' }
      ]]
    },
    {
      name: 'identifier',
      overloads: [[{ arg: '+RO', t: 'TaskId' }]]
    },
    {
      name: 'status',
      overloads: [[{ arg: '+RW', t: 'Status' }]] },
    {
      name: 'count',
      overloads: [[{ arg: '+PROP', t: 'number' }]]
    }
  ],
  relations: [],
  isPartial: false
};

export function registerStructuredMembersCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const text: string = classDetailsToText(DETAILS);
    expect(text).toBe('Task\n  assign(assignee: User, urgent: boolean)\n  identifier: TaskId\n  status: Status\n  count: number');
    expect(text).not.toContain('identifier(');
    expect(text).not.toContain('status(');
    expect(text).not.toContain('count(');
  });
}
