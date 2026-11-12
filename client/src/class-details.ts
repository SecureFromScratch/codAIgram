import { logAndThrow, loggedFetch } from './utils.js';
import { isClassDetails, parseClassDetails, type ArgsListT, type ClassDetails, type ClassMember, type CompositeTypeT, type FieldType } from '@codaigram/shared/class-types';
export type { ClassDetails } from '@codaigram/shared/class-types';

export async function loadClassDetails(signal: AbortSignal): Promise<ClassDetails[]> {
  const response: Response = await loggedFetch('/api/getClasses', { signal });
  if (!response.ok) logAndThrow(new Error('Could not load class details.'));
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isClassDetails)) logAndThrow(new Error('Invalid class details response.'));
  return data.map((item: unknown) => parseClassDetails(item, logAndThrow));
}


export function classDetailsToText(details: ClassDetails): string {
  return [details.name, ...details.methods.flatMap(memberToDslLines), ...details.relations.map((relation: ClassDetails['relations'][number]) => `${relation.kind} ${relation.name}: ${relation.target}${relation.many ? '[]' : ''}`)].join('\n');
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
