import type { ClassDetails, ClassRepository } from './memory-repository.js';

export const INITIAL_CLASSES: readonly ClassDetails[] = [
  {
    name: 'ClassDiagram',
    methods: ['addClass(name: string, publicMethods: string[])', 'addPartialClass(name: string)', 'connectClasses(from: string, to: string, connectionType: ConnectionType, arity: integer)', 'recalcLayout()'],
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

export class MemoryClassRepository implements ClassRepository {
  readonly #classes: Map<string, ClassDetails> = new Map(INITIAL_CLASSES.map((item: ClassDetails): [string, ClassDetails] => [item.name, structuredClone(item)]));
  async getDetails(names: readonly string[]): Promise<ClassDetails[]> {
    const result: ClassDetails[] = [];
    names.forEach((name: string): void => {
      // UNTRUST-ALLOW-NULLISH: A class can be absent from the fixture; the explicit check omits unknown names while preserving the requested order.
      const value: ClassDetails | undefined = this.#classes.get(name);
      if (value) result.push(structuredClone(value));
    });
    return result;
  }
  async updateClasses(classes: readonly ClassDetails[]): Promise<void> {
    classes.forEach((item: ClassDetails): void => { this.#classes.set(item.name, structuredClone(item)); });
  }
}
