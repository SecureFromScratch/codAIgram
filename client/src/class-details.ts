import { logAndThrow, loggedFetch } from './client_utils.js';
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
  const members: string[] = [...details.methods, ...deleted].flatMap(memberToDslLines);
  const memberStatuses: ('normal' | 'changed' | 'deleted')[] = [
    ...details.methods.flatMap((member) => memberToDslLines(member).map(() => changes.some((change) => change.status === 'changed' && change.name === member.name) ? 'changed' as const : 'normal' as const)),
    ...deleted.flatMap((member) => memberToDslLines(member).map(() => 'deleted' as const)),
  ];
  return changes.length > 0 ? { title: details.name, members, memberStatuses, targets } : { title: details.name, members, targets };
}

export function classDetailsToDiagramSet(details: readonly ClassDetails[], changes: ClassMemberChangesT = new Map()): Diagram | undefined {
  const first: ClassDetails | undefined = details.at(0);
  // UNTRUST-ALLOW-NULLISH: An empty class inventory has no diagram to project, and the existing caller explicitly handles the absence before opening the editor.
  if (!first) return undefined;
  // UNTRUST-ALLOW-NULLISH: A class without a latest member delta has no highlights, so the optional map lookup intentionally uses the converter's empty-list default.
  const initial: Diagram = classDetailsToDiagram(first, changes.get(first.name));
  const remaining: Diagram[] = details.slice(1).map((item: ClassDetails) => classDetailsToDiagram(item, changes.get(item.name)));
  return remaining.length > 0 ? {
    title: initial.title,
    members: initial.members,
    targets: initial.targets,
    classes: remaining } : initial;
}

function memberToDslLines(member: ClassMember): readonly string[] {
  const field: FieldType | undefined = member.overloads.at(0)?.at(0);
  if (field?.arg.startsWith('+')) return [`  ${member.name}: ${typeToDsl(field.t)}`];
  return member.overloads.map((overload: ArgsListT) => `  ${member.name}(${overload.map((field: FieldType) => `${field.arg}: ${typeToDsl(field.t)}`).join(', ')})`);
}

function typeToDsl(type: CompositeTypeT): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
  return `{ ${Array.from(type.entries(), ([name, value]: [string, CompositeTypeT]) => `${name}: ${typeToDsl(value)}`).join(', ')} }`;
}
