import type { ClassDetails, ClassRepository, TestDetails, TestHistory, TestIdentifier, TestInventoryRepository, TestRecord } from './memory-repository.js';
import type { DatabaseClassChange, DatabaseClassDelta } from './memory-repository.js';
import { testRecordHistory, updateTestRecord } from './test-history.js';
import { parseClassDetails } from '@codaigram/shared/class-types';
import type { ClassMember } from '@codaigram/shared/class-types';
import { logAndThrow } from './server_utils.js';
import { cloneClassSnapshot, InvalidClassRevisionError, rebuildClassHistory, reviseClass } from './class-revision.js';
import { createNonCryptoGuid } from './non-crypto-guid.js';
import { legacyClassBaseline, LEGACY_ORIGIN } from './legacy-class-baseline.js';
import type { ClassHistory, ClassOrigin, ClassRevision, ClassUpdate, CurrentClass, RevisionResult } from './class-revision.js';

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
    },
  {
    name: 'Class',
    methods: [],
    relations: [],
    state: 'partial' }
];

export class MemoryClassRepository implements ClassRepository, TestInventoryRepository {
  readonly #initialClasses: readonly ClassDetails[];
  readonly #projectRepositories: Map<string, MemoryClassRepository> = new Map<string, MemoryClassRepository>();
  readonly #registeredProjectNames: Set<string> = new Set<string>();
  readonly #repositoryScope: 'root' | 'project';
  readonly #classes: Map<string, ClassDetails>;
  readonly #classSnapshots: Map<string, CurrentClass> = new Map<string, CurrentClass>();
  readonly #classRevisions: Map<string, ClassRevision[]> = new Map<string, ClassRevision[]>();
  readonly #revisionIds: string[] = [];
  readonly #classGuids: Set<string> = new Set<string>();
  readonly #renamedNames: Set<string> = new Set<string>();
  #lastClassChange: DatabaseClassChange | undefined;
  readonly #tests: Map<string, TestRecord> = new Map<string, TestRecord>();
  constructor(initialClasses: readonly ClassDetails[] = INITIAL_CLASSES, repositoryScope: 'root' | 'project' = 'root') {
    this.#initialClasses = initialClasses.map(cloneClassDetails);
    this.#repositoryScope = repositoryScope;
    this.#classes = new Map(this.#initialClasses.map((item: ClassDetails) => [item.name, cloneClassDetails(item)]));
  }
  private projectRepository(projectName: string, registerProject: boolean = false): MemoryClassRepository {
    if (this.#repositoryScope === 'project') return this;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectName)) return logAndThrow(new Error('Invalid project name.'));
    if (registerProject) this.#registeredProjectNames.add(projectName);
    let repository: MemoryClassRepository | undefined = this.#projectRepositories.get(projectName);
    if (!repository) {
      repository = new MemoryClassRepository(this.#initialClasses, 'project');
      this.#projectRepositories.set(projectName, repository);
    }
    return repository;
  }
  async getProjects(): Promise<string[]> {
    return Array.from(this.#registeredProjectNames).sort((left: string, right: string) => left.localeCompare(right));
  }
  async createProject(projectName: string): Promise<void> {
    if (this.#repositoryScope === 'project') return;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectName)) return logAndThrow(new Error('Invalid project name.'));
    if (this.#registeredProjectNames.has(projectName)) return;
    this.#registeredProjectNames.add(projectName);
    this.#projectRepositories.set(projectName, new MemoryClassRepository([], 'project'));
  }
  async getDetails(projectName: string, names: readonly string[]): Promise<ClassDetails[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getDetails('local', names);
    const result: ClassDetails[] = [];
    names.forEach((name: string) => {
      const snapshot: CurrentClass | undefined = this.#classSnapshots.get(name);
      if (snapshot) {
        result.push(parseClassDetails(JSON.parse(JSON.stringify({
          name: snapshot.name,
          usage: snapshot.usage,
          sourceFile: snapshot.sourceFile,
          modifiedAt: snapshot.modifiedAt,
          aliasType: snapshot.aliasType,
          methods: snapshot.methods.map((member) => {
            const result: ClassMember = {
              name: member.name,
              overloads: member.overloads.map((overload) => overload.args),
            };
            return result;
          }),
          relations: snapshot.relations.map((relation) => {
            const result: ClassDetails['relations'][number] = {
              kind: relation.kind,
              name: relation.name,
              target: relation.target,
              many: relation.many,
            };
            if (typeof relation.member === 'string') result.member = relation.member;
            return result;
          }),
          state: snapshot.state,
        })) as unknown, logAndThrow));
        return;
      }
      // UNTRUST-ALLOW-NULLISH: A class can be absent from the fixture or reserved after a rename; the explicit check omits both while preserving the requested order.
      const value: ClassDetails | undefined = this.#renamedNames.has(name) ? undefined : this.#classes.get(name);
      if (value) result.push(cloneClassDetails(value));
    });
    return result;
  }
  async getClasses(projectName: string): Promise<ClassDetails[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getClasses('local');
    return Array.from(this.#classes.values()).filter((item: ClassDetails) => !this.#renamedNames.has(item.name)).map((item: ClassDetails) => cloneClassDetails(item)).sort((left: ClassDetails, right: ClassDetails) => left.name.localeCompare(right.name));
  }
  async updateClasses(projectName: string, classes: readonly ClassDetails[]): Promise<void> {
    const repository: MemoryClassRepository = this.projectRepository(projectName, true);
    if (repository !== this) return repository.updateClasses('local', classes);
    classes.forEach((item: ClassDetails) => { this.#classes.set(item.name, cloneClassDetails(item)); });
  }
  async updateClassSnapshots(projectName: string, classes: readonly ClassUpdate[], origin: ClassOrigin): Promise<void> {
    const repository: MemoryClassRepository = this.projectRepository(projectName, true);
    if (repository !== this) return repository.updateClassSnapshots('local', classes, origin);
    const staged: Map<string, RevisionResult> = new Map<string, RevisionResult>();
    const oldNames: Map<string, string> = new Map<string, string>();
    const baselines: Map<string, RevisionResult> = new Map<string, RevisionResult>();
    const deltas: DatabaseClassDelta[] = [];
    const when: string = new Date().toISOString();
    const involved: Set<string> = new Set<string>();
    classes.forEach((item: ClassUpdate) => {
      const names: string[] = item.renameOf ? [item.name, item.renameOf] : [item.name];
      names.forEach((name: string) => {
        if (involved.has(name)) logAndThrow(new InvalidClassRevisionError('Overlapping class updates.'));
        involved.add(name);
      });
    });
    const hasNewClass: boolean = classes.some((item: ClassUpdate) => !this.#classSnapshots.has(item.renameOf ?? item.name));
    classes.forEach((item: ClassUpdate) => {
      if (staged.has(item.name)) logAndThrow(new Error('Duplicate class name.'));
      const sourceName: string = item.renameOf ?? item.name;
      let previous: CurrentClass | undefined = this.#classSnapshots.get(sourceName);
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      const legacy: ClassDetails | undefined = this.#classes.get(sourceName);
      if (!previous && legacy && (item.renameOf || item.state === 'deleted') && !this.#renamedNames.has(sourceName)) {
        const baseline: RevisionResult = legacyClassBaseline(legacy);
        previous = baseline.current;
        baselines.set(item.name, baseline);
      }
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      if (item.renameOf && (!previous || this.#classSnapshots.has(item.name) || this.#classes.has(item.name) || this.#renamedNames.has(item.name))) logAndThrow(new InvalidClassRevisionError('Invalid class rename.'));
      if (!item.renameOf && this.#renamedNames.has(item.name)) logAndThrow(new InvalidClassRevisionError('Class name is reserved by a previous rename.'));
      if (item.state === 'deleted' && !previous) logAndThrow(new InvalidClassRevisionError('Cannot delete an unknown class.'));
      const result: RevisionResult = reviseClass(item, previous, origin, when);
      if (item.renameOf) oldNames.set(item.name, item.renameOf);
      if (!result.current.nonCryptoGuid) {
        let nonCryptoGuid: string = createNonCryptoGuid();
        while (this.#classGuids.has(nonCryptoGuid)) nonCryptoGuid = createNonCryptoGuid();
        result.current.nonCryptoGuid = nonCryptoGuid;
        this.#classGuids.add(nonCryptoGuid);
      }
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      const baseline: RevisionResult | undefined = baselines.get(item.name);
      if (baseline && result.current.nonCryptoGuid) baseline.current.nonCryptoGuid = result.current.nonCryptoGuid;
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      staged.set(item.name, result);
      if (!previous || result.changes.length > 0) {
        const delta: DatabaseClassDelta = {
          name: item.name,
          status: item.state === 'deleted' ? 'deleted' : previous ? 'modified' : 'added',
          changes: result.changes,
        };
        if (item.renameOf) delta.renameOf = item.renameOf;
        deltas.push(delta);
      }
    });
    staged.forEach((result: RevisionResult, name: string) => {
      const oldName: string | undefined = oldNames.get(name);
      if (oldName) {
        const existing: ClassRevision[] | undefined = this.#classRevisions.get(oldName);
        if (existing) this.#classRevisions.set(name, existing);
        this.#classRevisions.delete(oldName);
        this.#classSnapshots.delete(oldName);
        this.#renamedNames.add(oldName);
      }
      this.#classSnapshots.set(name, cloneClassSnapshot(result.current));
      if (result.changes.length > 0 || !this.#classRevisions.has(name)) {
        const revisions: ClassRevision[] = this.#classRevisions.get(name) ?? [];
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        const baseline: RevisionResult | undefined = baselines.get(name);
        if (baseline) {
          const revision: ClassRevision = {
            origin: LEGACY_ORIGIN,
            when: 'unknown',
            changes: baseline.changes,
          };
          if (baseline.current.nonCryptoGuid) revision.nonCryptoGuid = baseline.current.nonCryptoGuid;
          revisions.push(revision);
        }
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        revisions.push(JSON.parse(JSON.stringify({
          nonCryptoGuid: result.current.nonCryptoGuid,
          origin,
          when,
          changes: result.changes,
        })) as ClassRevision);
        this.#classRevisions.set(name, revisions);
      }
    });
    if (hasNewClass || Array.from(staged.values()).some((result: RevisionResult) => result.changes.length > 0)) {
      this.#revisionIds.unshift(origin.version);
      this.#lastClassChange = {
        origin: {
          kind: origin.kind,
          name: origin.name,
          version: origin.version,
        },
        changedAt: when,
        classes: deltas,
      };
    }
  }
  async getLastClassChange(projectName: string): Promise<DatabaseClassChange | undefined> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getLastClassChange('local');
    // UNTRUST-ALLOW-NULLISH: A new repository has no recorded class update; the optional result lets the API omit lastChange until an actual change has occurred.
    return this.#lastClassChange ? structuredClone(this.#lastClassChange) : undefined;
  }
  async getRevisionIds(projectName: string, howFarBack: number): Promise<string[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getRevisionIds('local', howFarBack);
    return this.#revisionIds.slice(0, howFarBack + 1);
  }
  async getClassSnapshots(projectName: string): Promise<CurrentClass[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getClassSnapshots('local');
    return Array.from(this.#classSnapshots.values(), (item: CurrentClass) => cloneClassSnapshot(item)).sort((left: CurrentClass, right: CurrentClass) => left.name.localeCompare(right.name));
  }
  async getClassHistory(projectName: string, names: readonly string[]): Promise<ClassHistory[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getClassHistory('local', names);
    const result: ClassHistory[] = [];
    names.forEach((name: string) => {
      const current: CurrentClass | undefined = this.#classSnapshots.get(name);
      const revisions: ClassRevision[] | undefined = this.#classRevisions.get(name);
      if (current && revisions) result.push(rebuildClassHistory(current, revisions));
    });
    return JSON.parse(JSON.stringify(result)) as ClassHistory[];
  }
  async getTests(projectName: string): Promise<TestRecord[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getTests('local');
    return Array.from(this.#tests.values(), (item: TestRecord) => structuredClone(item));
  }
  async getHistory(projectName: string, identifiers: readonly TestIdentifier[]): Promise<TestHistory[]> {
    const repository: MemoryClassRepository = this.projectRepository(projectName);
    if (repository !== this) return repository.getHistory('local', identifiers);
    const result: TestHistory[] = [];
    identifiers.forEach((item: TestIdentifier) => {
      const record: TestRecord | undefined = this.#tests.get(`${item.group}.${item.name}`);
      if (record) result.push(testRecordHistory(record));
    });
    return result;
  }
  async updateTests(projectName: string, tests: readonly TestDetails[]): Promise<void> {
    const repository: MemoryClassRepository = this.projectRepository(projectName, true);
    if (repository !== this) return repository.updateTests('local', tests);
    tests.forEach((item: TestDetails) => {
      const key: string = `${item.group}.${item.name}`;
      this.#tests.set(key, updateTestRecord(item, this.#tests.get(key)));
    });
  }
}
