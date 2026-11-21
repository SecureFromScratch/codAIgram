import type * as vscode from "vscode";
import type { CodexThreadMappingStoreT } from "./codexThreads";

const STORAGE_KEY: string = "codaigramBridge.codexThreadMappings";
type StoredMappingT = readonly [string, string];

export function createCodexThreadMappingStore(state: vscode.Memento): CodexThreadMappingStoreT {
  const read: (conversationId: string) => string | undefined = (conversationId) => {
    const mappings: readonly StoredMappingT[] = state.get<readonly StoredMappingT[]>(STORAGE_KEY, []);
    let found: string | undefined;
    for (let index: number = 0; index < mappings.length; index += 1) {
      const current: StoredMappingT = mappings[index];
      if (current[0] === conversationId) found = current[1];
    }
    return found;
  };
  const write: (conversationId: string, threadId: string) => void = (conversationId, threadId) => {
    const mappings: StoredMappingT[] = state.get<readonly StoredMappingT[]>(STORAGE_KEY, []).filter((mapping) => mapping[0] !== conversationId);
    mappings.push([conversationId, threadId]);
    void state.update(STORAGE_KEY, mappings);
  };
  return { read, write };
}
