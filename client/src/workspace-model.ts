import { isClassDetails, parseClassDetails, type ArgsListT, type ClassDetails, type ClassMember, type CompositeTypeT, type FieldType } from '@codaigram/shared/class-types';
import { err, ok, type Result } from 'neverthrow';
import { parseDiagram, type Diagram, type ParseResultT } from './model';

export type ModelChangeT = {
  classId: string;
  attribute: keyof ClassDetails | 'removed';
  before: unknown;
  after: unknown;
};

type ModelListenerT = {
  classes: ReadonlySet<string>;
  callback: (change: ModelChangeT) => void;
};

function sameValue(left: unknown, right: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: An omitted optional field is represented internally as undefined; compare that absence explicitly before JSON serialization loses it.
  if (left === undefined || right === undefined) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

function attributesOf(details: ClassDetails): ReadonlyMap<keyof ClassDetails, unknown> {
  return new Map(Object.entries(details) as [keyof ClassDetails, unknown][]);
}

function throwInvalidClassDetails(error: Error): never {
  // UNTRUST-ALLOW-UNLOGGED-THROW: This pure model API returns validation errors to its caller; logging belongs at the application boundary where the error is handled.
  throw error;
}

export class ClassWorkspaceModel {
  readonly #classes: Map<string, ClassDetails> = new Map();
  readonly #changes: Map<string, Map<keyof ClassDetails, unknown[]>> = new Map();
  readonly #listeners: Set<ModelListenerT> = new Set();

  get current(): ReadonlyMap<string, ClassDetails> { return this.#classes; }
  get changes(): ReadonlyMap<string, ReadonlyMap<keyof ClassDetails, readonly unknown[]>> { return this.#changes; }

  getClassNames(): readonly string[] {
    return Array.from(this.#classes.keys());
  }

  tryGetModel(className: string): Result<ClassDetails, Error> {
    const details: ClassDetails | undefined = this.#classes.get(className);
    if (!details) return err(new Error('Class model not found.'));
    return ok(details);
  }

  initClasses(classes: readonly ClassDetails[]): void {
    const previous: Set<string> = new Set(this.#classes.keys());
    classes.forEach((item: ClassDetails) => {
      const classId: string = item.name;
      previous.delete(classId);
      this.updateClasses([item]);
    });
    previous.forEach((classId: string) => {
      const before: ClassDetails | undefined = this.#classes.get(classId);
      this.#classes.delete(classId);
      this.#changes.delete(classId);
      // UNTRUST-ALLOW-NULLISH: Removed classes have no current value after deletion, and subscribers need that absence to distinguish removal from an empty class snapshot.
      this.#emit({ classId, attribute: 'removed', before, after: undefined });
    });
  }

  updateClasses(classes: readonly ClassDetails[]): void {
    classes.forEach((candidate: ClassDetails) => {
      const next: ClassDetails = parseClassDetails(candidate, throwInvalidClassDetails);
      const classId: string = next.name;
      const previous: ClassDetails | undefined = this.#classes.get(classId);
      if (!previous) {
        this.#classes.set(classId, next);
        const initialAttributes: ReadonlyMap<keyof ClassDetails, unknown> = attributesOf(next);
        initialAttributes.forEach((value: unknown, attribute: keyof ClassDetails) => {
          // UNTRUST-ALLOW-NULLISH: A new class has no value before insertion; undefined marks the beginning of its attribute history and allows subscribers to distinguish an addition from a modification.
          this.#record(classId, attribute, undefined, value);
        });
        return;
      }
      const previousAttributes: ReadonlyMap<keyof ClassDetails, unknown> = attributesOf(previous);
      const nextAttributes: ReadonlyMap<keyof ClassDetails, unknown> = attributesOf(next);
      const attributes: Set<keyof ClassDetails> = new Set([...previousAttributes.keys(), ...nextAttributes.keys()]);
      attributes.forEach((attribute: keyof ClassDetails) => {
        // UNTRUST-ALLOW-NULLISH: A missing optional class attribute maps to undefined; retaining this value is necessary to record an attribute deletion.
        const before: unknown = previousAttributes.get(attribute);
        // UNTRUST-ALLOW-NULLISH: A missing optional class attribute maps to undefined; retaining this value is necessary to record an attribute deletion.
        const after: unknown = nextAttributes.get(attribute);
        if (sameValue(before, after)) return;
        this.#record(classId, attribute, before, after);
      });
      this.#classes.set(classId, next);
    });
  }

  markDeleted(className: string): void {
    const details: ClassDetails | undefined = this.#classes.get(className);
    if (!details || details.state === 'deleted') return;
    this.updateClasses([{ ...details, state: 'deleted' }]);
  }

  subscribe(classNames: readonly string[], callback: (change: ModelChangeT) => void): () => void {
    const listener: ModelListenerT = { classes: new Set(classNames), callback };
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  registerForChanges(callback: (change: ModelChangeT) => void): () => void {
    return this.subscribe([], callback);
  }

  static parse(classDesc: string): ClassDetails | Error {
    const parsed: ParseResultT = parseDiagram(classDesc);
    if (!parsed.ok) return new Error(parsed.message);
    const diagram: Diagram = parsed.diagram;
    if (diagram.classes?.length) return new Error('Parse one class definition at a time.');
    const methods: ClassDetails['methods'] = diagram.members.map((member: string) => {
        // UNTRUST-ALLOW-NULLISH: This regex is only a method parse probe; null means interpret the row as a property, and later validation rejects malformed content.
        const method: RegExpMatchArray | null = member.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
        if (method) return {
          name: method[1] ?? '',
          overloads: [[...(method[2] ?? '').split(',').filter(Boolean).map((part: string) => {
            // UNTRUST-ALLOW-NULLISH: This regex is an argument parse probe; null yields empty fields that schema validation rejects before the model accepts the class.
            const field: RegExpMatchArray | null = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
            return { arg: field?.[1] ?? '', t: field?.[2] ?? '' };
          })]],
        };
        // UNTRUST-ALLOW-NULLISH: This regex is a property parse probe; null falls back to invalid source content and schema validation rejects that content.
        const property: RegExpMatchArray | null = member.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
        const propertyType: string = property?.[2] ?? 'unknown';
        const propertyName: string = property?.[1] ?? member.trim();
        return {
          name: propertyName,
          overloads: [[{ arg: '+RO', t: propertyType }]],
        };
      });
    const relations: ClassDetails['relations'] = diagram.targets.map((relation) => ({
      kind: relation.kind,
      name: relation.name,
      target: relation.target,
      many: relation.multiplicity === 'many',
    }));
    const value: ClassDetails = methods.length === 0 && relations.length === 0
      ? { name: diagram.title, methods, relations, state: 'partial' }
      : { name: diagram.title, methods, relations };
    return isClassDetails(value) ? value : new Error('Parsed class is invalid.');
  }

  #record(classId: string, attribute: keyof ClassDetails, before: unknown, after: unknown): void {
    let byAttribute: Map<keyof ClassDetails, unknown[]> | undefined = this.#changes.get(classId);
    if (!byAttribute) { byAttribute = new Map(); this.#changes.set(classId, byAttribute); }
    let history: unknown[] | undefined = byAttribute.get(attribute);
    if (!history) { history = [before]; byAttribute.set(attribute, history); }
    history.push(after);
    // UNTRUST-ALLOW-NULLISH: History index zero may be undefined when an attribute did not exist before the first update; that baseline is required for detecting a full revert.
    if (history.length > 1 && sameValue(history[0], after)) {
      byAttribute.delete(attribute);
      if (byAttribute.size === 0) this.#changes.delete(classId);
    }
    this.#emit({ classId, attribute, before, after });
  }

  #emit(change: ModelChangeT): void {
    this.#listeners.forEach((listener: ModelListenerT) => {
      if (listener.classes.size === 0 || listener.classes.has(change.classId)) listener.callback(change);
    });
  }
}

export class Model {
  static #active: ClassWorkspaceModel = new ClassWorkspaceModel();
  #current: ClassWorkspaceModel = new ClassWorkspaceModel();
  static get current(): ClassWorkspaceModel { return Model.#active; }
  static set current(value: ClassWorkspaceModel) { Model.#active = value; }
  get current(): ClassWorkspaceModel { return this.#current; }
  set current(value: ClassWorkspaceModel) { this.#current = value; }
  static parse(classDesc: string): ClassDetails | Error { return ClassWorkspaceModel.parse(classDesc); }

  static decompile(model: ClassDetails): string {
    const members: string[] = model.methods.flatMap(Model.#memberToDslLines);
    const relations: string[] = model.relations.map((relation: ClassDetails['relations'][number]) => `${relation.kind} ${relation.name}: ${relation.target}${relation.many ? '[]' : ''}`);
    return [model.name, ...members, ...relations].join('\n');
  }

  static #memberToDslLines(member: ClassMember): readonly string[] {
    const field: FieldType | undefined = member.overloads.at(0)?.at(0);
    if (field?.arg.startsWith('+')) return [`  ${member.name}: ${Model.#typeToDsl(field.t)}`];
    return member.overloads.map((overload: ArgsListT) => `  ${member.name}(${overload.map((argument: FieldType) => `${argument.arg}: ${Model.#typeToDsl(argument.t)}`).join(', ')})`);
  }

  static #typeToDsl(type: CompositeTypeT): string {
    if (typeof type === 'string') return type;
    if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
    return `{ ${Array.from(type.entries(), ([name, value]: [string, CompositeTypeT]) => `${name}: ${Model.#typeToDsl(value)}`).join(', ')} }`;
  }
}
