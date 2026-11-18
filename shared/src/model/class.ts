import type { ClassDetails } from '../class-types.js';

export type ScannedClass = ClassDetails & {
  readonly declaration: 'CLASS' | 'INTERFACE';
};

export type ScannedUnknownRelation = {
  readonly kind: 'UNK';
  readonly name: string;
  readonly target: string;
  // UNTRUST-ALLOW-BOOLEAN: This preserves the existing class-details wire contract.
  readonly many: boolean;
};

export type StoredScannedClass = {
  name: string;
  sourceFile?: string;
  state?: 'partial' | 'deleted';
};
