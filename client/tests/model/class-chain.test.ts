import { expect, it } from 'vitest';
import { Model } from '../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';

const MOCK_PROJECT_CLASSES: readonly ClassDetails[] = [
  {
    name: 'Task',
    methods: [],
    relations: [
      { kind: 'REF', name: 'contract', target: 'TaskContract', many: false },
      { kind: 'OWNS', name: 'children', target: 'ChildTask', many: true },
      { kind: 'REF', name: 'assignees', target: 'AssigneeContract', many: true },
    ],
  },
  {
    name: 'TaskContract',
    methods: [],
    relations: [{ kind: 'REF', name: 'task', target: 'Task', many: false }],
  },
  { name: 'ChildTask', methods: [], relations: [] },
  { name: 'AssigneeContract', methods: [], relations: [] },
  { name: 'Unrelated', methods: [], relations: [] },
];

it('gets the connected mock-project class chain when starting at an incoming-only class', () => {
  const model: Model = new Model();
  model.current.initClasses(MOCK_PROJECT_CLASSES);

  const chain: readonly ClassDetails[] = model.current.getClassChain('AssigneeContract');

  expect(chain.map((details: ClassDetails) => details.name)).toEqual([
    'AssigneeContract',
    'Task',
    'TaskContract',
    'ChildTask',
  ]);
});
