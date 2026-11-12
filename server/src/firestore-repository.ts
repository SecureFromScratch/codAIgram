import { FieldValue, Firestore, type DocumentReference, type DocumentSnapshot } from '@google-cloud/firestore';
import { isClassDetails, parseClassDetails } from '@codaigram/shared/class-types';
import { logAndThrow } from './utils.js';
import type { ArgsListT, ClassDetails, ClassMember } from '@codaigram/shared/class-types';
import type { ClassRepository, TestDetails, TestInventoryRepository } from './memory-repository.js';

export function createLocalFirestore(): Firestore {
  const host: string = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const projectId: string = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? '';
  if (!/^(localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.test(host) || Number(host.split(':').at(1)) > 65535 || !projectId.trim()) {
    logAndThrow(new Error('Local Firestore requires FIRESTORE_EMULATOR_HOST on localhost and GOOGLE_CLOUD_PROJECT.'));
  }
  return new Firestore({ projectId });
}

type StoredMemberT = { name: string; overloads: { args: ArgsListT; }[]; };
type StoredClassT = Omit<ClassDetails, 'methods'> & { methods: StoredMemberT[]; };

function classDetailsForStorage(value: ClassDetails): FirebaseFirestore.DocumentData {
  const stored: StoredClassT = {
    name: value.name,
    relations: value.relations,
    isPartial: value.isPartial,
    methods: value.methods.map((member: ClassMember) => ({
      name: member.name,
      overloads: member.overloads.map((args: ArgsListT) => ({ args })) })) };
  return JSON.parse(JSON.stringify(stored)) as FirebaseFirestore.DocumentData;
}

function classDetailsFromStorage(value: unknown): ClassDetails {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are external data and may contain null; reject it before inspecting the stored method collection and validating each stored overload in the document.
  if (typeof value !== 'object' || value === null || !('methods' in value) || !Array.isArray(value.methods)) return logAndThrow(new Error('Stored class details are invalid.'));
  const stored: StoredClassT = value as StoredClassT;
  const candidate: unknown = {
    name: stored.name,
    relations: stored.relations,
    isPartial: stored.isPartial,
    methods: stored.methods.map((member: StoredMemberT) => ({
      name: member.name,
      overloads: Array.isArray(member.overloads) ? member.overloads.map((overload: { args: ArgsListT; }) => overload?.args) : member.overloads })) };
  if (!isClassDetails(candidate)) return logAndThrow(new Error('Stored class details are invalid.'));
  return parseClassDetails(candidate, logAndThrow);
}

function isTestDetails(value: unknown): value is TestDetails {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are untrusted persisted data; exclude null before inspecting any properties and returning a domain DTO.
  return typeof value === 'object' && value !== null && 'group' in value && typeof value.group === 'string' && 'name' in value && typeof value.name === 'string' && 'description' in value && typeof value.description === 'string' && 'prompt' in value && typeof value.prompt === 'string';
}

export class FirestoreClassRepository implements ClassRepository, TestInventoryRepository {
  readonly #database: Firestore;
  readonly #collection: string;
  constructor(database: Firestore, collection: string = 'classes') { this.#database = database; this.#collection = collection; }
  async getDetails(names: readonly string[]): Promise<ClassDetails[]> {
    const snapshots: DocumentSnapshot[] = await Promise.all(names.map((name: string) => this.#database.collection(this.#collection).doc(name).get()));
    const result: ClassDetails[] = [];
    snapshots.forEach((snapshot, index: number) => {
      if (!snapshot.exists) return;
      const data: unknown = snapshot.data();
      const details: ClassDetails = classDetailsFromStorage(data);
      if (details.name !== names.at(index)) logAndThrow(new Error('Stored class details are invalid.'));
      result.push(details);
    });
    return result;
  }
  async getClasses(): Promise<ClassDetails[]> {
    const snapshots: FirebaseFirestore.QueryDocumentSnapshot[] = (await this.#database.collection(this.#collection).orderBy('name').get()).docs;
    return snapshots.map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data: unknown = snapshot.data();
      return classDetailsFromStorage(data);
    });
  }
  async updateClasses(classes: readonly ClassDetails[]): Promise<void> {
    const batch: ReturnType<Firestore['batch']> = this.#database.batch();
    classes.forEach((item: ClassDetails) => { batch.set(this.#database.collection(this.#collection).doc(item.name), classDetailsForStorage(item)); });
    await batch.commit();
  }
  async getTests(): Promise<TestDetails[]> {
    const snapshots: FirebaseFirestore.QueryDocumentSnapshot[] = (await this.#database.collection('tests').orderBy('createdAt').get()).docs;
    return snapshots.map((snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data: unknown = snapshot.data();
      if (!isTestDetails(data)) return logAndThrow(new Error('Stored test details are invalid.'));
      return data;
    });
  }
  async updateTests(tests: readonly TestDetails[]): Promise<void> {
    const batch: ReturnType<Firestore['batch']> = this.#database.batch();
    tests.forEach((item: TestDetails) => {
      const document: DocumentReference = this.#database.collection('tests').doc(`${item.group}.${item.name}`);
      batch.set(document, {
        group: item.group,
        name: item.name,
        description: item.description,
        prompt: item.prompt,
        createdAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
}
