import { logAndThrow, loggedFetch } from './client_utils.js';
import type { Result } from 'neverthrow';
import { isClassDetails, isClassMember, parseClassDetails, type ArgsListT, type ClassDetails, type ClassMember, type CompositeTypeT, type FieldType } from '@codaigram/shared/class-types';
import { Model } from './workspace-model';
import type { Diagram, Relation } from './model';
export type { ClassDetails } from '@codaigram/shared/class-types';

export type MemberChangeStatusT = 'changed' | 'deleted';
export type MemberChangeT = {
  name: string;
  status: MemberChangeStatusT;
  member?: ClassMember;
};
export type ClassMemberChangesT = ReadonlyMap<string, readonly MemberChangeT[]>;
export type ClassInventoryT = {
  classes: ClassDetails[];
  memberChanges: ClassMemberChangesT;
};

export async function loadClassDetails(signal: AbortSignal, projectName: string): Promise<ClassInventoryT> {
  const response: Response = await loggedFetch(`/api/${encodeURIComponent(projectName)}/getClasses`, { signal });
  if (!response.ok) logAndThrow(new Error('Could not load class details.'));
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('classes' in data) || !Array.isArray(data.classes) || !data.classes.every(isClassDetails)) logAndThrow(new Error('Invalid class details response.'));
  return {
    classes: data.classes.map((item: unknown) => parseClassDetails(item, logAndThrow)),
    memberChanges: memberChanges(data),
  };
}

type JsonObjectT = {
  lastChange?: unknown;
  classes?: unknown;
  name?: unknown;
  changes?: unknown;
  kind?: unknown;
  before?: unknown;
  after?: unknown;
};

function isRecord(value: unknown): value is JsonObjectT {
  // UNTRUST-ALLOW-NULLISH: HTTP JSON can contain null at every object position, so this boundary helper rejects null before later code reads named fields from an untrusted value.
  return typeof value === 'object' && value !== null;
}

function memberChanges(data: object): ClassMemberChangesT {
  const result: Map<string, MemberChangeT[]> = new Map();
  if (!('lastChange' in data) || !isRecord(data.lastChange) || !('classes' in data.lastChange) || !Array.isArray(data.lastChange.classes)) return result;
  data.lastChange.classes.forEach((classChange: unknown) => {
    if (!isRecord(classChange) || typeof classChange.name !== 'string' || !Array.isArray(classChange.changes)) return;
    const changes: MemberChangeT[] = [];
    classChange.changes.forEach((change: unknown) => {
      if (!isRecord(change) || change.kind !== 'member' || !('before' in change) || !('after' in change)) return;
      const before: unknown = change.before;
      const after: unknown = change.after;
      if (after === 'absent' && isClassMember(before)) {
        const member: ClassMember = before as ClassMember;
        changes.push({
          name: member.name,
          status: 'deleted',
          member: parseMember(member),
        });
      } else if (after !== 'absent' && isClassMember(after)) {
        const member: ClassMember = after as ClassMember;
        changes.push({ name: member.name, status: 'changed' });
      }
    });
    if (changes.length > 0) result.set(classChange.name, changes);
  });
  return result;
}

function parseMember(value: ClassMember): ClassMember {
  const parsed: ClassDetails = parseClassDetails({ name: 'Member', methods: [value], relations: [] }, logAndThrow);
  return parsed.methods[0]!;
}

export function classDetailsToText(details: ClassDetails): string {
  return Model.decompile(details);
}

export function classDetailsToDiagram(details: ClassDetails, changes: readonly MemberChangeT[] = []): Diagram {
  const targets: Relation[] = details.relations.map((relation: ClassDetails['relations'][number]) => ({
    kind: relation.kind,
    name: relation.name,
    target: relation.target,
    multiplicity: relation.many ? 'many' : 'one' }));
  const deleted: ClassMember[] = [];
  changes.forEach((change: MemberChangeT) => {
    if (change.status === 'deleted' && change.member) deleted.push(change.member);
  });
  const members: string[] = details.methods.flatMap((member: ClassMember) => memberToDslLines(member, details.state === 'delegate'));
  deleted.forEach((member: ClassMember) => members.push(...memberToDslLines(member)));
  const memberStatuses: ('normal' | 'changed' | 'deleted')[] = [
    ...details.methods.flatMap((member) => memberToDslLines(member).map(() => changes.some((change) => change.status === 'changed' && change.name === member.name) ? 'changed' as const : 'normal' as const)),
    ...deleted.flatMap((member) => memberToDslLines(member).map(() => 'deleted' as const)),
  ];
  const result: Diagram = { title: details.name, members, targets };
  if (changes.length > 0) result.memberStatuses = memberStatuses;
  if (details.state) result.state = details.state;
  if (details.state === 'union' && details.aliasType !== undefined) result.unionPanels = unionPanels(details.aliasType);
  return result;
}

export function classDetailsToDiagramSet(details: readonly ClassDetails[], changes: ClassMemberChangesT = new Map()): Diagram | undefined {
  const graphDetails: ClassDetails[] = details.filter((item: ClassDetails) => item.state !== 'alias');
  const first: ClassDetails | undefined = graphDetails.at(0);
  // UNTRUST-ALLOW-NULLISH: An empty class inventory has no diagram to project, and the existing caller explicitly handles the absence before opening the editor.
  if (!first) return undefined;
  // UNTRUST-ALLOW-NULLISH: A class without a latest member delta has no highlights, so the optional map lookup intentionally uses the converter's empty-list default.
  const initial: Diagram = classDetailsToDiagram(first, changes.get(first.name));
  const remaining: Diagram[] = graphDetails.slice(1).map((item: ClassDetails) => classDetailsToDiagram(item, changes.get(item.name)));
  if (remaining.length === 0) return initial;
  const result: Diagram = {
    title: initial.title,
    members: initial.members,
    targets: initial.targets,
    classes: remaining,
  };
  if (initial.state) result.state = initial.state;
  if (initial.unionPanels) result.unionPanels = initial.unionPanels;
  return result;
}

function unionPanels(type: CompositeTypeT): { type: string; aliasExpansion?: string }[] {
  const alternatives: string[] = Array.isArray(type) ? type.map((value: string) => `'${value}'`) : typeof type === 'string' ? splitUnion(type) : [];
  return alternatives.map((alternative: string) => {
    const result: { type: string; aliasExpansion?: string } = { type: alternative };
    const alias: Result<ClassDetails, Error> = Model.current.tryGetModel(alternative);
    if (alias.isOk() && alias.value.state === 'alias' && alias.value.aliasType !== undefined) result.aliasExpansion = `         (\u{1F3AD}${typeToDsl(alias.value.aliasType)})`;
    return result;
  });
}

function splitUnion(value: string): string[] {
  const alternatives: string[] = [];
  let start: number = 0;
  let genericDepth: number = 0;
  let parenDepth: number = 0;
  let bracketDepth: number = 0;
  let braceDepth: number = 0;
  for (let index: number = 0; index < value.length; index += 1) {
    const character: string = value.charAt(index);
    if (character === '<') genericDepth += 1;
    else if (character === '>' && value.charAt(index - 1) !== '=') genericDepth = Math.max(0, genericDepth - 1);
    else if (character === '(') parenDepth += 1;
    else if (character === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (character === '[') bracketDepth += 1;
    else if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (character === '{') braceDepth += 1;
    else if (character === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (character === '|' && genericDepth === 0 && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      alternatives.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  alternatives.push(value.slice(start).trim());
  return alternatives.filter((item: string) => item.length > 0);
}

function memberToDslLines(member: ClassMember, isDelegate: boolean = false): readonly string[] {
  return member.overloads.map((overload: ArgsListT) => {
    const marker: FieldType | undefined = overload.at(0);
    if (marker?.arg === '+RO' || marker?.arg === '+RW' || marker?.arg === '+GET' || marker?.arg === '+SET' || marker?.arg === '+PROP') return `  ${member.name}: ${typeToDsl(marker.t)}`;
    const returnType: FieldType | undefined = marker?.arg === '+RET' ? marker : undefined;
    const parameters: ArgsListT = returnType ? overload.slice(1) : overload;
    const callable: string = `  ${member.name ? `${member.name}` : isDelegate ? '@delegate' : ''}(${parameters.map((field: FieldType) => `${field.arg}: ${typeToDsl(field.t)}`).join(', ')})`;
    return returnType ? `${callable} => ${typeToDsl(returnType.t)}` : callable;
  });
}

function typeToDsl(type: CompositeTypeT): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
  return `{ ${Array.from(type.entries(), ([name, value]: [string, CompositeTypeT]) => `${name}: ${typeToDsl(value)}`).join(', ')} }`;
}
