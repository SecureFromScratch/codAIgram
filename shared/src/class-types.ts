import { JsonMap } from './json-map.js';

export interface ClassDetails {
  name: string;
  usage?: 'ex'|'dto';
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
  state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
  aliasType?: CompositeTypeT;
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
  return typeof value === 'object' && value !== null && !('isPartial' in value) && (!('state' in value) || value.state === 'partial' || value.state === 'deleted' || value.state === 'delegate' || value.state === 'union' || value.state === 'alias') && (!('aliasType' in value) || value.aliasType === undefined || isCompositeType(value.aliasType)) && (!('usage' in value) || value.usage === 'ex' || value.usage === 'dto' || value.usage === undefined) && (!('sourceFile' in value) || value.sourceFile === undefined || typeof value.sourceFile === 'string') && (!('modifiedAt' in value) || value.modifiedAt === undefined || typeof value.modifiedAt === 'string') && 'name' in value && typeof value.name === 'string' && 'methods' in value && Array.isArray(value.methods) && value.methods.every(isClassMember) && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isClassRelation) && ('state' in value && value.state === 'delegate' ? isDelegateMemberList(value.methods) && value.relations.length === 0 : value.methods.every((member: ClassMember) => member.name !== '' || member.overloads.length > 0 && member.overloads.every(isCallableOverload)));
}

function isDelegateMemberList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const members: ClassMember[] = value.filter(isClassMember);
  const member: ClassMember | undefined = members.at(0);
  // UNTRUST-ALLOW-NULLISH: Array.at returns no member when the input is empty; after the exact one-item length check, reject that impossible malformed input before validating the delegate signature.
  if (!member) return false;
  // UNTRUST-ALLOW-NULLISH: A delegate signature must carry its return type; the explicit undefined check rejects malformed JSON where the optional field was present without a value.
  return member.name === '' && member.overloads.length > 0 && member.overloads.every(isCallableOverload);
}

function isCallableOverload(value: ArgsListT): boolean {
  return value.every((field: FieldType, index: number) => field.arg !== '+RET' || index === 0);
}

export function isClassMember(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A class-member value arrives from JSON or persistence and may be null, so reject it before inspecting its required name and overload fields.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'overloads' in value && Array.isArray(value.overloads) && value.overloads.every(isClassOverload);
}

function isClassOverload(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(isFieldType) && hasFirstReturnMarker(value);
  // UNTRUST-ALLOW-NULLISH: Overloads arrive as untrusted JSON; reject null before checking the structured overload's argument array.
  return typeof value === 'object' && !!value && 'args' in value && Array.isArray(value.args) && value.args.every(isFieldType) && hasFirstReturnMarker(value.args);
}

function hasFirstReturnMarker(value: readonly unknown[]): boolean {
  return value.every((field: unknown, index: number) => typeof field !== 'object' || field === null || !('arg' in field) || field.arg !== '+RET' || index === 0);
}

export function isFieldType(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A field descriptor at an untrusted boundary may be null, so reject it before safely validating its argument name and composable type.
  return typeof value === 'object' && value !== null && 'arg' in value && typeof value.arg === 'string' && 't' in value && isCompositeType(value.t) && (!('mutability' in value) || value.mutability === 'm' || value.mutability === 'x' || value.mutability === 'r');
}

export function isCompositeType(value: unknown): boolean {
  if (Array.isArray(value)) return value.every((item: unknown) => typeof item === 'string');
  // UNTRUST-ALLOW-NULLISH: A recursive composite value may be null in untrusted JSON or stored data, so it must be excluded before recursing through object children.
  return typeof value === 'string' || typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(isCompositeType);
}

export function isClassRelation(value: unknown): boolean {
  // UNTRUST-ALLOW-NULLISH: A relation from an untrusted JSON or persisted document may be null, so reject it before validating its closed kind and required fields.
  return typeof value === 'object' && value !== null && 'kind' in value && (value.kind === 'OWNS' || value.kind === 'REF' || value.kind === 'UNK') && 'name' in value && typeof value.name === 'string' && (!('member' in value) || typeof value.member === 'string') && 'target' in value && typeof value.target === 'string' && 'many' in value && typeof value.many === 'boolean';
}

export function parseClassDetails(value: unknown, onInvalidInput: (error: Error) => never): ClassDetails {
  if (!isClassDetails(value)) return onInvalidInput(new Error('Invalid class details.'));
  const details: ClassDetails = value as ClassDetails;
  const result: ClassDetails = {
    name: details.name,
    relations: details.relations,
    methods: details.methods.map((member: ClassMember) => ({
      name: member.name,
      overloads: (member.overloads as (ArgsListT | { args: ArgsListT })[]).map((overload) => (Array.isArray(overload) ? overload : overload.args).map((field: FieldType) => {
        const result: FieldType = {
          arg: field.arg,
          t: parseCompositeType(field.t, onInvalidInput),
        };
        if (field.mutability) result.mutability = field.mutability;
        return result;
      })),
    })) };
  if (details.usage) result.usage = details.usage;
  if (details.state) result.state = details.state;
  if (details.aliasType !== undefined) result.aliasType = parseCompositeType(details.aliasType, onInvalidInput);
  if (details.sourceFile) result.sourceFile = details.sourceFile;
  if (details.modifiedAt) result.modifiedAt = details.modifiedAt;
  return result;
}

function parseCompositeType(value: unknown, onInvalidInput: (error: Error) => never): CompositeTypeT {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')) return value as string[];
  return JsonMap.fromJson<string, CompositeTypeT>(value, (name: string) => name, (child: unknown) => parseCompositeType(child, onInvalidInput), onInvalidInput);
}
