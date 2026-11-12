import type { ClassDetails, ClassRepository, TestDetails, TestInventoryRepository } from './memory-repository.js';
import { parseClassDetails } from '@codaigram/shared/class-types';
import { logAndThrow } from './utils.js';

function cloneClassDetails(value: ClassDetails): ClassDetails {
  return parseClassDetails(JSON.parse(JSON.stringify(value)) as unknown, logAndThrow);
}

export const INITIAL_CLASSES: readonly ClassDetails[] = [
  {
    name: 'ClassDiagram',
    methods: [
      {
        name: 'addClass',
        overloads: [[
          { arg: 'name', t: 'string' },
          { arg: 'publicMethods', t: 'string[]' }
        ]]
      },
      {
        name: 'addPartialClass',
        overloads: [[{ arg: 'name', t: 'string' }]]
      },
      {
        name: 'connectClasses',
        overloads: [[
          { arg: 'from', t: 'string' },
          { arg: 'to', t: 'string' },
          { arg: 'connectionType', t: 'ConnectionType' },
          { arg: 'arity', t: 'integer' }
        ]]
      },
      { name: 'recalcLayout', overloads: [[]] }
    ],
    relations: [{
      kind: 'OWNS',
      name: 'classes',
      target: 'Class',
      many: true }],
    isPartial: false },
  {
    name: 'Class',
    methods: [],
    relations: [],
    isPartial: true }
];

export class MemoryClassRepository implements ClassRepository, TestInventoryRepository {
  readonly #classes: Map<string, ClassDetails> = new Map(INITIAL_CLASSES.map((item: ClassDetails) => [item.name, cloneClassDetails(item)]));
  readonly #tests: Map<string, TestDetails> = new Map<string, TestDetails>();
  async getDetails(names: readonly string[]): Promise<ClassDetails[]> {
    const result: ClassDetails[] = [];
    names.forEach((name: string) => {
      // UNTRUST-ALLOW-NULLISH: A class can be absent from the fixture; the explicit check omits unknown names while preserving the requested order.
      const value: ClassDetails | undefined = this.#classes.get(name);
      if (value) result.push(cloneClassDetails(value));
    });
    return result;
  }
  async getClasses(): Promise<ClassDetails[]> {
    return Array.from(this.#classes.values(), (item: ClassDetails) => cloneClassDetails(item)).sort((left: ClassDetails, right: ClassDetails) => left.name.localeCompare(right.name));
  }
  async updateClasses(classes: readonly ClassDetails[]): Promise<void> {
    classes.forEach((item: ClassDetails) => { this.#classes.set(item.name, cloneClassDetails(item)); });
  }
  async getTests(): Promise<TestDetails[]> {
    return Array.from(this.#tests.values(), (item: TestDetails) => structuredClone(item));
  }
  async updateTests(tests: readonly TestDetails[]): Promise<void> {
    tests.forEach((item: TestDetails) => { this.#tests.set(`${item.group}.${item.name}`, structuredClone(item)); });
  }
}
