import { describe, expect, it } from 'vitest';
import { Model } from '../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';

const CLASS_A: ClassDetails = {
  name: 'A',
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
};

describe('object workspace model', () => {
  it('initializes and replaces its inventory, notifying removal subscribers', () => {
    const model: Model = new Model();
    const events: string[] = [];
    model.current.subscribe([], (change) => events.push(`${change.classId}:${change.attribute}`));
    model.current.initClasses([CLASS_A]);
    model.current.initClasses([]);
    expect(model.current.current.size).toBe(0);
    expect(events).toContain('A:removed');
  });

  it('tracks attribute changes and returns to the original state', () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_A]);
    model.current.updateClasses([{ ...CLASS_A, sourceFile: 'a.ts' }]);
    expect(model.current.changes.get('A')?.get('sourceFile')).toEqual([undefined, 'a.ts']);
    model.current.updateClasses([CLASS_A]);
    expect(model.current.changes.get('A')?.has('sourceFile')).toBe(false);
  });

  it('parses class text to structured details and returns parse errors', () => {
    expect(Model.parse('Thing\n  run(value: string)')).toEqual({
      name: 'Thing',
      methods: [{ name: 'run', overloads: [[{ arg: 'value', t: 'string' }]] }],
      relations: [],
    });
    expect(Model.parse('not a valid class')).toBeInstanceOf(Error);
  });
});
