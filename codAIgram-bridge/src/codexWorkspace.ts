export interface CodexWorkspaceConfiguration {
  readonly cwd: string;
  readonly workFolders: readonly string[];
}

export function normalizeCodexWorkspaceConfiguration(cwd: string, workFolders: readonly string[]): CodexWorkspaceConfiguration {
  const additionalFolders: readonly string[] = workFolders.filter((folder: string) => folder !== cwd);
  return { cwd, workFolders: [cwd, ...additionalFolders] };
}
