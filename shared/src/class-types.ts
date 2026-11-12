import { JsonMap } from './json-map.js';

export interface ClassDetails {
  name: string;
  methods: ClassMember[];
  relations: {
    kind: 'OWNS' | 'REF' | 'UNK';
    name: string;
    target: string;
    // UNTRUST-ALLOW-BOOLEAN: The existing class-details contract encodes relation multiplicity as a boolean; its established wire shape must be retained.
    many: boolean }[];
  // UNTRUST-ALLOW-BOOLEAN: The existing HTTP and Firestore class-details contract encodes partial status as a boolean; changing that established wire shape would break existing clients and stored documents.
  isPartial: boolean;
}

export interface ClassMember {
  name: string;
  overloads: ArgsListT[];
}

export interface FieldType {
  arg: string;
  t: CompositeTypeT;
}

export type ArgsListT = FieldType[];
export type EnumValuesT = string[];
export type TypeNameT = string;
export type NamedTupleT = JsonMap<string, CompositeTypeT>;
export type CompositeTypeT = TypeNameT | EnumValuesT | NamedTupleT;

export function isClassDetails(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: JSON and persisted boundaries may contain null, which must be excluded before checking the fixed fields of a candidate class-details value.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'isPartial' in value && typeof value.isPartial === 'boolean' && 'methods' in value && Array.isArray(value.methods) && value.methods.every(isClassMember) && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isClassRelation);
}

export function isClassMember(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A class-member value arrives from JSON or persistence and may be null, so reject it before inspecting its required name and overload fields.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'overloads' in value && Array.isArray(value.overloads) && value.overloads.every((overload: unknown) => Array.isArray(overload) && overload.every(isFieldType));
}

export function isFieldType(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A field descriptor at an untrusted boundary may be null, so reject it before safely validating its argument name and composable type.
  return typeof value === 'object' && value !== null && 'arg' in value && typeof value.arg === 'string' && 't' in value && isCompositeType(value.t);
}

export function isCompositeType(value: unknown): boolean {
  if (Array.isArray(value)) return value.every((item: unknown) => typeof item === 'string');
  // UNTRUST-ALLOW-NULLISH: A recursive composite value may be null in untrusted JSON or stored data, so it must be excluded before recursing through object children.
  return typeof value === 'string' || typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(isCompositeType);
}

export function isClassRelation(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A relation from an untrusted JSON or persisted document may be null, so reject it before validating its closed kind and required fields.
  return typeof value === 'object' && value !== null && 'kind' in value && (value.kind === 'OWNS' || value.kind === 'REF' || value.kind === 'UNK') && 'name' in value && typeof value.name === 'string' && 'target' in value && typeof value.target === 'string' && 'many' in value && typeof value.many === 'boolean';
}

export function parseClassDetails(value: unknown, onInvalidInput: (error: Error) => never): ClassDetails {
  if (!isClassDetails(value)) return onInvalidInput(new Error('Invalid class details.'));
  const details: ClassDetails = value as ClassDetails;
  return {
    name: details.name,
    relations: details.relations,
    isPartial: details.isPartial,
    methods: details.methods.map((member: ClassMember) => ({
      name: member.name,
      overloads: member.overloads.map((args: ArgsListT) => args.map((field: FieldType) => ({
        arg: field.arg,
        t: parseCompositeType(field.t, onInvalidInput) })))
    })) };
}

function parseCompositeType(value: unknown, onInvalidInput: (error: Error) => never): CompositeTypeT {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')) return value as string[];
  return JsonMap.fromJson<string, CompositeTypeT>(value, (name: string) => name, (child: unknown) => parseCompositeType(child, onInvalidInput), onInvalidInput);
}
