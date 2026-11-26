import type { ClassDetails } from '../class-types.js';

export type ScannedClassT = ClassDetails & {
  readonly declaration: 'CLASS' | 'INTERFACE' | 'TYPE_ALIAS';
};

export type ScannedUnknownRelationT = {
  readonly kind: 'UNK';
  readonly name: string;
  readonly member?: string;
  readonly target: string;
  // UNTRUST-ALLOW-BOOLEAN: This preserves the existing public class-details wire contract; callers expect boolean multiplicity, so changing it would break compatibility across scanned and stored class data.
  readonly many: boolean;
}

export type StoredScannedClassT = {
  name: string;
  sourceFile?: string;
  state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
}
