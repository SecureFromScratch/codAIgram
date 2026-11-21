import { logAndThrow, loggedFetch } from './client_utils.js';

export const DEFAULT_PROJECT_NAME: string = 'mock-project';
export const NEW_PROJECT_OPTION: string = '__new_project__';

export async function loadProjectNames(signal: AbortSignal): Promise<string[]> {
  const response: Response = await loggedFetch('/api/getProjects', { signal });
  if (!response.ok) logAndThrow(new Error('Could not load projects.'));
  const value: unknown = await response.json();
  if (!isProjectNames(value)) logAndThrow(new Error('Invalid projects response.'));
  return value;
}

export async function createProject(projectName: string): Promise<void> {
  const response: Response = await loggedFetch('/api/createProject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName }),
  });
  if (!response.ok) logAndThrow(new Error('Could not create project.'));
}

function isProjectNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(item));
}
