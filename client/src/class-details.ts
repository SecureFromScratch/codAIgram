export interface ClassDetails {
  name: string;
  methods: string[];
  relations: {
    kind: 'OWNS';
    name: string;
    target: string;
    // UNTRUST-ALLOW-BOOLEAN: The existing HTTP class-details contract encodes relation multiplicity as a boolean; this client boundary must accept the server's established response shape without changing it.
    many: boolean }[];
  // UNTRUST-ALLOW-BOOLEAN: The existing HTTP class-details contract encodes partial status as a boolean; this client boundary must accept the server's established response shape without changing it.
  isPartial: boolean;
}

export async function loadClassDetails(signal: AbortSignal): Promise<ClassDetails[]> {
  const response: Response = await fetch('/api/classesDetails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classNames: ['ClassDiagram', 'Class'] }),
    signal });
  if (!response.ok) throw new Error('Could not load class details.');
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isClassDetails)) throw new Error('Invalid class details response.');
  return data;
}

function isClassDetails(value: unknown): value is ClassDetails {
  // UNTRUST-ALLOW-NULLISH: JSON from the HTTP boundary may contain null; this guard excludes it before checking properties and admitting a value into the application.
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'isPartial' in value && typeof value.isPartial === 'boolean' && 'methods' in value && Array.isArray(value.methods) && value.methods.every((method: unknown) => typeof method === 'string') && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isRelation);
}

function isRelation(value: unknown): value is ClassDetails['relations'][number] {
  // UNTRUST-ALLOW-NULLISH: JSON from the HTTP boundary may contain null; this guard excludes it before checking properties and admitting a value into the application.
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'OWNS' && 'name' in value && typeof value.name === 'string' && 'target' in value && typeof value.target === 'string' && 'many' in value && typeof value.many === 'boolean';
}

export function classDetailsToText(details: ClassDetails): string {
  return [details.name, ...details.methods.map((method: string) => `  ${method}`), ...details.relations.map((relation: ClassDetails['relations'][number]) => `${relation.kind} ${relation.name}: ${relation.target}${relation.many ? '[]' : ''}`)].join('\n');
}
