import { FieldValue, Firestore, Timestamp, type DocumentReference, type DocumentSnapshot } from '@google-cloud/firestore';
import { isClassDetails, parseClassDetails } from '@codaigram/shared/class-types';
import { logAndThrow, warnLegacyPartialField } from './server_utils.js';
import { StorageError } from './storage-error.js';
import { ERROR_CODES } from './error-codes.js';
import type { ArgsListT, ClassDetails, ClassMember, CompositeTypeT } from '@codaigram/shared/class-types';
import type { ClassRepository, TestDetails, TestHistory, TestIdentifier, TestInventoryRepository, TestRecord } from './memory-repository.js';
import type { DatabaseClassChange, DatabaseClassDelta } from './memory-repository.js';
import { testRecordHistory, updateTestRecord } from './test-history.js';
import { InvalidClassRevisionError, rebuildClassHistory, reviseClass } from './class-revision.js';
import { createNonCryptoGuid } from './non-crypto-guid.js';
import { legacyClassBaseline, LEGACY_ORIGIN } from './legacy-class-baseline.js';
import { parseStoredClassRevision, parseStoredClassRevisionEnvelope, parseStoredClassSnapshot } from './class-storage-schema.js';
import type { ClassHistory, ClassOrigin, ClassRevision, ClassUpdate, CurrentClass, RevisionResult } from './class-revision.js';

export function createLocalFirestore(): Firestore {
  const host: string = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const projectId: string = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? '';
  if (!/^(localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.test(host) || Number(host.split(':').at(1)) > 65535 || !projectId.trim()) {
    logAndThrow(new Error('Local Firestore requires FIRESTORE_EMULATOR_HOST on localhost and GOOGLE_CLOUD_PROJECT.'));
  }
  return new Firestore({ projectId });
}

type StoredMemberT = {
  name: string;
  overloads: { args: ArgsListT; }[];
};
type StoredClassT = Omit<ClassDetails, 'methods'> & {
  methods: StoredMemberT[];
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  // UNTRUST-ALLOW-BOOLEAN: Firestore may still contain legacy documents with this boolean field; the reader translates it to the new optional state without rewriting or discarding existing data.
  isPartial?: boolean;
};
type LegacyStoredMemberT = StoredMemberT & { rettype?: CompositeTypeT };
type LegacyStoredClassT = Omit<ClassDetails, 'methods'> & {
  methods: LegacyStoredMemberT[];
  isPartial?: boolean;
};

// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
function classDetailsForStorage(value: ClassDetails): FirebaseFirestore.DocumentData {
  const stored: StoredClassT = {
    name: value.name,
    relations: value.relations,
    methods: value.methods.map((member: ClassMember) => {
      const result: StoredMemberT = {
        name: member.name,
        overloads: member.overloads.map((args: ArgsListT) => ({ args })),
      };
      return result;
    }) };
  if (value.aliasType !== undefined) stored.aliasType = value.aliasType;
  if (value.state) stored.state = value.state;
  const data: FirebaseFirestore.DocumentData = JSON.parse(JSON.stringify(stored)) as FirebaseFirestore.DocumentData;
  return data;
}
// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT

// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
function classDetailsFromStorage(value: unknown, documentId: string): ClassDetails {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are external data and may contain null; reject it before inspecting the stored method collection and validating each stored overload in the document.
  if (typeof value !== 'object' || value === null) return logAndThrow(new Error('Stored class details are invalid.'));
  if ('isPartial' in value) warnLegacyPartialField('classes', documentId);
  if (!('methods' in value) || !Array.isArray(value.methods)) return logAndThrow(new Error('Stored class details are invalid.'));
  const stored: LegacyStoredClassT = value as LegacyStoredClassT;
  const candidate: unknown = {
    name: stored.name,
    usage: stored.usage,
    sourceFile: stored.sourceFile,
    modifiedAt: stored.modifiedAt,
    aliasType: stored.aliasType,
    relations: stored.relations,
    // REMOVE THIS BACKWARD COMPATIBILITY CODE IF NO PROBLEMS FOUND BY 2020/11/23
    // UNTRUST-ALLOW-NULLISH: Missing state represents a complete class and JSON normalization below removes this temporary undefined before the public class DTO is validated.
    state: 'state' in value ? value.state : stored.isPartial === true ? 'partial' : undefined,
    methods: stored.methods.map((member: LegacyStoredMemberT) => {
      const result: ClassMember = {
        name: member.name,
        overloads: Array.isArray(member.overloads) ? member.overloads.map((overload: { args: ArgsListT; }) => overload?.args) : member.overloads as unknown as ArgsListT[],
      };
      if (Object.hasOwn(member, 'rettype')) result.overloads = result.overloads.map((args: ArgsListT) => [{ arg: '+RET', t: member.rettype! }, ...args]);
      return result;
    }) };
  const normalized: unknown = JSON.parse(JSON.stringify(candidate)) as unknown;
  if (!isClassDetails(normalized)) return logAndThrow(new Error('Stored class details are invalid.'));
  return parseClassDetails(normalized, logAndThrow);
}
// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT

function isTestDetails(value: unknown): value is TestDetails {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are untrusted persisted data; exclude null before inspecting any properties and returning a domain DTO.
  return typeof value === 'object' && value !== null && 'group' in value && typeof value.group === 'string' && 'name' in value && typeof value.name === 'string' && 'description' in value && typeof value.description === 'string' && 'prompt' in value && typeof value.prompt === 'string';
}

function storedTestRecord(value: unknown): TestRecord {
  if (!isTestDetails(value)) return logAndThrow(new Error('Stored test details are invalid.'));
  if ('lastChangedAt' in value && typeof value.lastChangedAt === 'string' && 'prompts' in value && Array.isArray(value.prompts) && 'descriptions' in value && Array.isArray(value.descriptions)) return value as TestRecord;
  // UNTRUST-ALLOW-NULLISH: Existing Firestore documents predate history storage and have no prior record; this explicitly creates their initial history at the persistence boundary.
  return updateTestRecord(value, undefined);
}

export class FirestoreClassRepository implements ClassRepository, TestInventoryRepository {
  readonly #database: Firestore;
  readonly #collection: string;
  constructor(database: Firestore, collection: string = 'classes') { this.#database = database; this.#collection = collection; }
  #projectReference(projectName: string): DocumentReference {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectName)) return logAndThrow(new Error('Invalid project name.'));
    return this.#database.collection('projects').doc(projectName);
  }
  #collectionForProject(projectName: string, name: string): FirebaseFirestore.CollectionReference {
    return this.#projectReference(projectName).collection(name);
  }
  async getProjects(): Promise<string[]> {
    const projectDocuments: DocumentReference[] = await this.#database.collection('projects').listDocuments();
    return projectDocuments
      .map((document: DocumentReference) => document.id)
      .filter((projectName: string) => /^[A-Za-z0-9_-]{1,100}$/.test(projectName))
      .sort((left: string, right: string) => left.localeCompare(right));
  }
  async createProject(projectName: string): Promise<void> {
    await this.#projectReference(projectName).set({ name: projectName }, { merge: true });
  }
  async getDetails(projectName: string, names: readonly string[]): Promise<ClassDetails[]> {
    const snapshots: DocumentSnapshot[] = await Promise.all(names.map((name: string) => this.#collectionForProject(projectName, this.#collection).doc(name).get()));
    const currentSnapshots: DocumentSnapshot[] = await Promise.all(names.map((name: string) => this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(name).get()));
    const result: ClassDetails[] = [];
    snapshots.forEach((snapshot, index: number) => {
      const current: DocumentSnapshot = currentSnapshots[index]!;
      if (current.exists) {
        const data: FirebaseFirestore.DocumentData | undefined = current.data();
        if (!data) logAndThrow(new Error('Stored class snapshot is invalid.'));
        if (typeof data.renamedTo === 'string') return;
        const value: CurrentClass = parseStoredClassSnapshot(data.value, current.id);
        if (value.name !== names.at(index)) logAndThrow(new Error('Stored class snapshot is invalid.'));
        result.push(parseClassDetails(JSON.parse(JSON.stringify({
          name: value.name,
          usage: value.usage,
          sourceFile: value.sourceFile,
          modifiedAt: value.modifiedAt,
          aliasType: value.aliasType,
          methods: value.methods.map((member) => {
            const result: ClassMember = {
              name: member.name,
              overloads: member.overloads.map((overload) => overload.args),
            };
            return result;
          }),
          relations: value.relations.map((relation) => ({
            kind: relation.kind,
            name: relation.name,
            target: relation.target,
            many: relation.many,
          })),
          state: value.state,
        })) as unknown, logAndThrow));
        return;
      }
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      if (!snapshot.exists) return;
      const data: unknown = snapshot.data();
      const details: ClassDetails = classDetailsFromStorage(data, snapshot.id);
      if (details.name !== names.at(index)) logAndThrow(new Error('Stored class details are invalid.'));
      result.push(details);
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
    });
    return result;
  }
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  async getClasses(projectName: string): Promise<ClassDetails[]> {
    const snapshots: FirebaseFirestore.QueryDocumentSnapshot[] = (await this.#collectionForProject(projectName, this.#collection).orderBy('name').get()).docs;
    const aliases: FirebaseFirestore.QuerySnapshot = await this.#collectionForProject(projectName, `${this.#collection}_snapshots`).where('renamedTo', '!=', '').get();
    const renamedNames: Set<string> = new Set(aliases.docs.map((document: FirebaseFirestore.QueryDocumentSnapshot) => document.id));
    return snapshots.filter((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => !renamedNames.has(snapshot.id)).map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data: unknown = snapshot.data();
      return classDetailsFromStorage(data, snapshot.id);
    });
  }
  async updateClasses(projectName: string, classes: readonly ClassDetails[]): Promise<void> {
    const batch: ReturnType<Firestore['batch']> = this.#database.batch();
    batch.set(this.#projectReference(projectName), { name: projectName }, { merge: true });
    classes.forEach((item: ClassDetails) => { batch.set(this.#collectionForProject(projectName, this.#collection).doc(item.name), classDetailsForStorage(item)); });
    await batch.commit();
  }
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  async updateClassSnapshots(projectName: string, classes: readonly ClassUpdate[], origin: ClassOrigin): Promise<void> {
    const unique: Set<string> = new Set<string>();
    classes.forEach((item: ClassUpdate) => {
      if (unique.has(item.name)) logAndThrow(new Error('Duplicate class name.'));
      unique.add(item.name);
    });
    const involved: Set<string> = new Set<string>();
    classes.forEach((item: ClassUpdate) => {
      const names: string[] = item.renameOf ? [item.name, item.renameOf] : [item.name];
      names.forEach((name: string) => {
        if (involved.has(name)) logAndThrow(new InvalidClassRevisionError('Overlapping class updates.'));
        involved.add(name);
      });
    });
    await this.#database.runTransaction(async (transaction) => {
      const when: string = new Date().toISOString();
      const lastChangeReference: DocumentReference = this.#collectionForProject(projectName, `${this.#collection}_metadata`).doc('last_class_change');
      await transaction.get(lastChangeReference);
      const references: DocumentReference[] = classes.map((item: ClassUpdate) => this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(item.name));
      const snapshots: DocumentSnapshot[] = await transaction.getAll(...references);
      const sourceReferences: DocumentReference[] = classes.map((item: ClassUpdate) => this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(item.renameOf ?? item.name));
      const sourceSnapshots: DocumentSnapshot[] = await transaction.getAll(...sourceReferences);
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      const legacyReferences: DocumentReference[] = classes.map((item: ClassUpdate) => this.#collectionForProject(projectName, this.#collection).doc(item.name));
      const legacySnapshots: DocumentSnapshot[] = await transaction.getAll(...legacyReferences);
      const sourceLegacyReferences: DocumentReference[] = classes.map((item: ClassUpdate) => this.#collectionForProject(projectName, this.#collection).doc(item.renameOf ?? item.name));
      const sourceLegacySnapshots: DocumentSnapshot[] = await transaction.getAll(...sourceLegacyReferences);
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      const baselines: Map<number, RevisionResult> = new Map<number, RevisionResult>();
      const staged: RevisionResult[] = classes.map((item: ClassUpdate, index: number) => {
        const data: FirebaseFirestore.DocumentData | undefined = sourceSnapshots[index]!.data();
        if (item.renameOf && ((!data && !sourceLegacySnapshots[index]!.exists) || data?.renamedTo || snapshots[index]!.exists || legacySnapshots[index]!.exists)) logAndThrow(new InvalidClassRevisionError('Invalid class rename.'));
        if (!item.renameOf && data?.renamedTo) logAndThrow(new InvalidClassRevisionError('Class name is reserved by a previous rename.'));
        let previous: CurrentClass | undefined = data ? parseStoredClassSnapshot(data.value, sourceSnapshots[index]!.id) : sourceSnapshots[index]!.exists ? logAndThrow(new Error('Stored class snapshot is invalid.')) : data;
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        if (!previous && sourceLegacySnapshots[index]!.exists && (item.renameOf || item.state === 'deleted')) {
          const baseline: RevisionResult = legacyClassBaseline(classDetailsFromStorage(sourceLegacySnapshots[index]!.data(), sourceLegacySnapshots[index]!.id));
          previous = baseline.current;
          baselines.set(index, baseline);
        }
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        if (item.state === 'deleted' && !previous) logAndThrow(new InvalidClassRevisionError('Cannot delete an unknown class.'));
        if (previous && previous.name !== (item.renameOf ?? item.name)) logAndThrow(new Error('Stored class snapshot is invalid.'));
        const result: RevisionResult = reviseClass(item, previous, origin, when);
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        const legacyData: FirebaseFirestore.DocumentData | undefined = sourceLegacySnapshots[index]!.data();
        const legacyGuid: unknown = legacyData?.nonCryptoGuid;
        // UNTRUST-ALLOW-NULLISH: Older class documents and missing legacy documents may lack this identifier; in that case the transaction allocates one for the new snapshot instead.
        if (legacyGuid !== undefined) {
          if (typeof legacyGuid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(legacyGuid)) return logAndThrow(new Error('Stored legacy class identifier is invalid.'));
          if (result.current.nonCryptoGuid && result.current.nonCryptoGuid !== legacyGuid) return logAndThrow(new Error('Stored class identifiers conflict.'));
          result.current.nonCryptoGuid = legacyGuid;
        }
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        return result;
      });
      const newGuids: string[] = [];
      staged.forEach((result: RevisionResult) => {
        if (result.current.nonCryptoGuid) return;
        const nonCryptoGuid: string = createNonCryptoGuid();
        if (newGuids.includes(nonCryptoGuid)) logAndThrow(new Error('Class identifier collision.'));
        result.current.nonCryptoGuid = nonCryptoGuid;
        newGuids.push(nonCryptoGuid);
      });
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      baselines.forEach((baseline: RevisionResult, index: number) => {
        const nonCryptoGuid: string | undefined = staged[index]?.current.nonCryptoGuid;
        if (nonCryptoGuid) baseline.current.nonCryptoGuid = nonCryptoGuid;
      });
      // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
      const guidReferences: DocumentReference[] = newGuids.map((guid: string) => this.#collectionForProject(projectName, `${this.#collection}_class_guids`).doc(guid));
      if (guidReferences.length > 0) {
        const existingGuids: DocumentSnapshot[] = await transaction.getAll(...guidReferences);
        if (existingGuids.some((snapshot: DocumentSnapshot) => snapshot.exists)) logAndThrow(new Error('Class identifier collision.'));
        guidReferences.forEach((reference: DocumentReference) => transaction.create(reference, { allocated: true }));
      }
      if (staged.some((result: RevisionResult, index: number) => result.changes.length > 0 || !sourceSnapshots[index]!.exists)) {
        const revisionReference: DocumentReference = this.#collectionForProject(projectName, `${this.#collection}_revision_ids`).doc();
        transaction.set(revisionReference, { version: origin.version, when });
        const deltas: DatabaseClassDelta[] = staged.flatMap((result: RevisionResult, index: number) => {
          const existed: boolean = sourceSnapshots[index]!.exists || baselines.has(index);
          const item: ClassUpdate = classes[index]!;
          if (existed && result.changes.length === 0) return [];
          const delta: DatabaseClassDelta = {
            name: result.current.name,
            status: item.state === 'deleted' ? 'deleted' : existed ? 'modified' : 'added',
            changes: result.changes,
          };
          if (item.renameOf) delta.renameOf = item.renameOf;
          return [delta];
        });
        const cleanClasses: FirebaseFirestore.DocumentData[] = JSON.parse(JSON.stringify(deltas)) as FirebaseFirestore.DocumentData[];
        transaction.set(lastChangeReference, {
          origin,
          changedAt: FieldValue.serverTimestamp(),
          classes: cleanClasses,
        });
      }
      staged.forEach((result: RevisionResult, index: number) => {
        const data: FirebaseFirestore.DocumentData | undefined = sourceSnapshots[index]!.data();
        if (data && (!Number.isSafeInteger(data.revisionCount) || data.revisionCount < 1)) logAndThrow(new Error('Stored class snapshot is invalid.'));
        let ordinal: number = data ? data.revisionCount as number : 0;
        const baseline: RevisionResult | undefined = baselines.get(index);
        const historyName: string = data?.historyName ?? sourceSnapshots[index]!.id;
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(historyName)) logAndThrow(new Error('Stored class history location is invalid.'));
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        if (baseline) {
          const baselineRevision: ClassRevision = {
            origin: LEGACY_ORIGIN,
            when: 'unknown',
            changes: baseline.changes,
          };
          if (baseline.current.nonCryptoGuid) baselineRevision.nonCryptoGuid = baseline.current.nonCryptoGuid;
          const cleanBaseline: FirebaseFirestore.DocumentData = JSON.parse(JSON.stringify(baselineRevision)) as FirebaseFirestore.DocumentData;
          ordinal += 1;
          transaction.set(this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(historyName).collection('revisions').doc(String(ordinal).padStart(12, '0')), { ordinal, value: cleanBaseline });
        }
        // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
        if (result.changes.length === 0 && data) {
          // Preserve refreshed file metadata in the current snapshot without adding a semantic revision.
          const cleanCurrent: FirebaseFirestore.DocumentData = JSON.parse(JSON.stringify(result.current)) as FirebaseFirestore.DocumentData;
          transaction.update(references[index]!, { value: cleanCurrent });
          return;
        }
        const revision: ClassRevision = { origin, when, changes: result.changes };
        if (result.current.nonCryptoGuid) revision.nonCryptoGuid = result.current.nonCryptoGuid;
        const cleanCurrent: FirebaseFirestore.DocumentData = JSON.parse(JSON.stringify(result.current)) as FirebaseFirestore.DocumentData;
        const cleanRevision: FirebaseFirestore.DocumentData = JSON.parse(JSON.stringify(revision)) as FirebaseFirestore.DocumentData;
        transaction.set(references[index]!, {
          value: cleanCurrent,
          revisionCount: ordinal + 1,
          historyName,
        });
        if (classes[index]!.renameOf) transaction.set(sourceReferences[index]!, { renamedTo: result.current.name });
        transaction.set(this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(historyName).collection('revisions').doc(String(ordinal + 1).padStart(12, '0')), { ordinal: ordinal + 1, value: cleanRevision });
      });
      transaction.set(this.#projectReference(projectName), { name: projectName }, { merge: true });
    });
  }
  async getLastClassChange(projectName: string): Promise<DatabaseClassChange | undefined> {
    const snapshot: DocumentSnapshot = await this.#collectionForProject(projectName, `${this.#collection}_metadata`).doc('last_class_change').get();
    // UNTRUST-ALLOW-NULLISH: A new or preexisting database may have no global change record; the optional return lets the API omit metadata until a tracked class update occurs.
    if (!snapshot.exists) return undefined;
    const data: FirebaseFirestore.DocumentData | undefined = snapshot.data();
    if (!data || !data.origin || !['scan', 'ai', 'user'].includes(data.origin.kind) || typeof data.origin.name !== 'string' || typeof data.origin.version !== 'string' || !(data.changedAt instanceof Timestamp)) return logAndThrow(new Error('Stored last class change is invalid.'));
    const result: DatabaseClassChange = {
      origin: {
        kind: data.origin.kind,
        name: data.origin.name,
        version: data.origin.version,
      },
      changedAt: data.changedAt.toDate().toISOString(),
    };
    if ('classes' in data) {
      if (!Array.isArray(data.classes)) return logAndThrow(new Error('Stored last class change is invalid.'));
      result.classes = data.classes.map((item: unknown) => {
        if (!item || typeof item !== 'object' || !('name' in item) || typeof item.name !== 'string' || !('status' in item) || item.status !== 'added' && item.status !== 'modified' && item.status !== 'deleted' || !('changes' in item) || 'renameOf' in item && (typeof item.renameOf !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(item.renameOf))) return logAndThrow(new Error('Stored last class change is invalid.'));
        const revision: ClassRevision = parseStoredClassRevision({
          origin: result.origin,
          when: result.changedAt,
          changes: item.changes,
        }, `last_class_change/${item.name}`);
        const delta: DatabaseClassDelta = {
          name: item.name,
          status: item.status,
          changes: revision.changes,
        };
        if ('renameOf' in item && typeof item.renameOf === 'string') delta.renameOf = item.renameOf;
        return delta;
      });
    }
    return result;
  }
  async getRevisionIds(projectName: string, howFarBack: number): Promise<string[]> {
    const snapshot: FirebaseFirestore.QuerySnapshot = await this.#collectionForProject(projectName, `${this.#collection}_revision_ids`).orderBy('when', 'desc').limit(howFarBack + 1).get();
    return snapshot.docs.map((document: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data: FirebaseFirestore.DocumentData = document.data();
      if (typeof data.version !== 'string') return logAndThrow(new Error('Stored revision identifier is invalid.'));
      return data.version;
    });
  }
  async getClassSnapshots(projectName: string): Promise<CurrentClass[]> {
    const snapshot: FirebaseFirestore.QuerySnapshot = await this.#collectionForProject(projectName, `${this.#collection}_snapshots`).get();
    return snapshot.docs.filter((document: FirebaseFirestore.QueryDocumentSnapshot) => typeof document.data().renamedTo !== 'string').map((document: FirebaseFirestore.QueryDocumentSnapshot) => {
      const value: CurrentClass = parseStoredClassSnapshot(document.data().value, document.id);
      if (value.name !== document.id) logAndThrow(new Error('Stored class snapshot is invalid.'));
      return value;
    }).sort((left: CurrentClass, right: CurrentClass) => left.name.localeCompare(right.name));
  }
  async getClassHistory(projectName: string, names: readonly string[]): Promise<ClassHistory[]> {
    const result: ClassHistory[] = [];
    for (let index: number = 0; index < names.length; index += 1) {
      const name: string = names[index]!;
      const reference: DocumentReference = this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(name);
      const read: { found: false } | { found: true; value: ClassHistory } = await this.#database.runTransaction(async (transaction) => {
        const current: DocumentSnapshot = await transaction.get(reference);
        if (!current.exists) return { found: false as const };
        const data: FirebaseFirestore.DocumentData | undefined = current.data();
        if (data && typeof data.renamedTo === 'string') return { found: false as const };
        if (!data || !Number.isSafeInteger(data.revisionCount) || data.revisionCount < 1) return logAndThrow(new Error('Stored class snapshot is invalid.'));
        const historyName: string = data.historyName ?? name;
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(historyName)) return logAndThrow(new Error('Stored class history location is invalid.'));
        const revisions: FirebaseFirestore.QuerySnapshot = await transaction.get(this.#collectionForProject(projectName, `${this.#collection}_snapshots`).doc(historyName).collection('revisions').orderBy('ordinal'));
        if (revisions.size !== data.revisionCount) return logAndThrow(new StorageError(ERROR_CODES.CLASS_HISTORY_INCOMPLETE, 'Stored class history is incomplete.'));
        const value: CurrentClass = parseStoredClassSnapshot(data.value, current.id);
        if (value.name !== name) return logAndThrow(new Error('Stored class snapshot is invalid.'));
        const history: ClassRevision[] = revisions.docs.map((item: FirebaseFirestore.QueryDocumentSnapshot, ordinal: number) => {
          const revision: { ordinal: number; value: ClassRevision } = parseStoredClassRevisionEnvelope(item.data(), `${name}/revisions/${item.id}`);
          if (revision.ordinal !== ordinal + 1) return logAndThrow(new Error('Stored class history is invalid.'));
          if (value.nonCryptoGuid && revision.value.nonCryptoGuid && value.nonCryptoGuid !== revision.value.nonCryptoGuid) return logAndThrow(new Error('Stored class history identifier is invalid.'));
          return revision.value;
        });
        return {
          found: true as const,
          value: rebuildClassHistory(value, history),
        };
      });
      if (read.found) result.push(read.value);
    }
    return result;
  }
  async getTests(projectName: string): Promise<TestRecord[]> {
    const snapshots: FirebaseFirestore.QueryDocumentSnapshot[] = (await this.#collectionForProject(projectName, 'tests').orderBy('createdAt').get()).docs;
    return snapshots.map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data: unknown = snapshot.data();
      return storedTestRecord(data);
    });
  }
  async getHistory(projectName: string, identifiers: readonly TestIdentifier[]): Promise<TestHistory[]> {
    const snapshots: DocumentSnapshot[] = await Promise.all(identifiers.map((item: TestIdentifier) => this.#collectionForProject(projectName, 'tests').doc(`${item.group}.${item.name}`).get()));
    const result: TestHistory[] = [];
    snapshots.forEach((snapshot: DocumentSnapshot) => { if (snapshot.exists) result.push(testRecordHistory(storedTestRecord(snapshot.data()))); });
    return result;
  }
  async updateTests(projectName: string, tests: readonly TestDetails[]): Promise<void> {
    await this.#database.runTransaction(async (transaction) => {
      const documents: DocumentReference[] = tests.map((item: TestDetails) => this.#collectionForProject(projectName, 'tests').doc(`${item.group}.${item.name}`));
      const snapshots: DocumentSnapshot[] = await transaction.getAll(...documents);
      tests.forEach((item: TestDetails, index: number) => {
        const snapshot: DocumentSnapshot = snapshots[index]!;
        // UNTRUST-ALLOW-NULLISH: A missing document is an expected first insertion; the absence is checked before reading prior history or writing its replacement.
        const previous: TestRecord | undefined = snapshot.exists ? storedTestRecord(snapshot.data()) : undefined;
        const record: TestRecord = updateTestRecord(item, previous);
        if (!previous || previous.description !== item.description || previous.prompt !== item.prompt || previous.prompts.length !== record.prompts.length) {
          const data: FirebaseFirestore.DocumentData = {
            group: record.group,
            name: record.name,
            description: record.description,
            prompt: record.prompt,
            lastChangedAt: record.lastChangedAt,
            prompts: record.prompts,
            descriptions: record.descriptions,
          };
          if (!snapshot.exists) data.createdAt = FieldValue.serverTimestamp();
          transaction.set(documents[index]!, data, { merge: true });
        }
      });
      transaction.set(this.#projectReference(projectName), { name: projectName }, { merge: true });
    });
  }
}
