import { JsonMap } from './json-map.js';

export interface ClassDetails {
  name: string;
  usage?: 'ex';
  sourceFile?: string;
  modifiedAt?: string;
  methods: ClassMember[];
  relations: {
    kind: 'OWNS' | 'REF' | 'UNK';
    name: string;
    member?: string;
    target: string;
    // UNTRUST-ALLOW-BOOLEAN: The existing class-details contract encodes relation multiplicity as a boolean; its established wire shape must be retained.
    many: boolean }[];
  state?: 'partial' | 'deleted';
}

export interface ClassMember {
  name: string;
  overloads: ArgsListT[];
}

export interface FieldType {
  arg: string;
  t: CompositeTypeT;
  mutability?: 'm' | 'x' | 'r';
}

export type ArgsListT = FieldType[];
export type EnumValuesT = string[];
export type TypeNameT = string;
export type NamedTupleT = JsonMap<string, CompositeTypeT>;
export type CompositeTypeT = TypeNameT | EnumValuesT | NamedTupleT;

export function isClassDetails(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: JSON and persisted boundaries may contain null, which must be excluded before checking the fixed fields of a candidate class-details value.
  return typeof value === 'object' && value !== null && !('isPartial' in value) && (!('state' in value) || value.state === 'partial' || value.state === 'deleted') && (!('usage' in value) || value.usage === 'ex' || value.usage === undefined) && (!('sourceFile' in value) || value.sourceFile === undefined || typeof value.sourceFile === 'string') && (!('modifiedAt' in value) || value.modifiedAt === undefined || typeof value.modifiedAt === 'string') && 'name' in value && typeof value.name === 'string' && 'methods' in value && Array.isArray(value.methods) && value.methods.every(isClassMember) && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isClassRelation);
}

export function isClassMember(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A class-member value arrives from JSON or persistence and may be null, so reject it before inspecting its required name and overload fields.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'overloads' in value && Array.isArray(value.overloads) && value.overloads.every(isClassOverload);
}
