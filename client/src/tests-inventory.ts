import { logAndThrow, loggedFetch } from './utils.js';

export interface TestCaseDetails {
  group: string;
  name: string;
  description: string;
  prompt: string;
}

export async function loadTestsInventory(signal: AbortSignal): Promise<TestCaseDetails[]> {
  const response: Response = await loggedFetch('/api/getTests', { signal });
  if (!response.ok) logAndThrow(new Error('Could not load tests inventory.'));
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isTestCaseDetails)) logAndThrow(new Error('Invalid tests inventory response.'));
  return data;
}

function isTestCaseDetails(value: unknown): value is TestCaseDetails {
  // UNTRUST-ALLOW-NULLISH: JSON from the HTTP boundary may contain null; this guard excludes it before checking properties and admitting a value into the application.
  return typeof value === 'object' && value !== null && 'group' in value && typeof value.group === 'string' && 'name' in value && typeof value.name === 'string' && 'description' in value && typeof value.description === 'string' && 'prompt' in value && typeof value.prompt === 'string';
}
