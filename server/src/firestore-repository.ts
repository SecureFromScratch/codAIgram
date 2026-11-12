import { Firestore, type DocumentSnapshot } from '@google-cloud/firestore';
import type { ClassDetails, ClassRepository } from './memory-repository.js';

export function createLocalFirestore(): Firestore {
  const host: string = process.env.FIRESTORE_EMULATOR_HOST ?? '';
  const projectId: string = process.env.GOOGLE_CLOUD_PROJECT ?? '';
  if (!/^(localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.test(host) || Number(host.split(':').at(1)) > 65535 || !projectId.trim()) {
    throw new Error('Local Firestore requires FIRESTORE_EMULATOR_HOST on localhost and GOOGLE_CLOUD_PROJECT.');
  }
  return new Firestore({ projectId });
}

function isRelation(value: unknown): value is ClassDetails['relations'][number] {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are untrusted persisted data; exclude null before inspecting any properties and returning a domain DTO.
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'OWNS' && 'name' in value && typeof value.name === 'string' && 'target' in value && typeof value.target === 'string' && 'many' in value && typeof value.many === 'boolean';
}

function isClassDetails(value: unknown): value is ClassDetails {
  // UNTRUST-ALLOW-NULLISH: Firestore documents are untrusted persisted data; exclude null before inspecting any properties and returning a domain DTO.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'isPartial' in value && typeof value.isPartial === 'boolean' && 'methods' in value && Array.isArray(value.methods) && value.methods.every((item: unknown) => typeof item === 'string') && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isRelation);
}

export class FirestoreClassRepository implements ClassRepository {
  readonly #database: Firestore;
  readonly #collection: string;
  constructor(database: Firestore, collection: string = 'classes') { this.#database = database; this.#collection = collection; }
  async getDetails(names: readonly string[]): Promise<ClassDetails[]> {
    const snapshots: DocumentSnapshot[] = await Promise.all(names.map((name: string) => this.#database.collection(this.#collection).doc(name).get()));
    const result: ClassDetails[] = [];
    snapshots.forEach((snapshot, index: number) => {
      if (!snapshot.exists) return;
      const data: unknown = snapshot.data();
      if (!isClassDetails(data) || data.name !== names.at(index)) throw new Error('Stored class details are invalid.');
      result.push(data);
    });
    return result;
  }
  async updateClasses(classes: readonly ClassDetails[]): Promise<void> {
    const batch: ReturnType<Firestore['batch']> = this.#database.batch();
    classes.forEach((item: ClassDetails) => { batch.set(this.#database.collection(this.#collection).doc(item.name), item); });
    await batch.commit();
  }
}
