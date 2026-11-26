export type AppStorageKeyT = "editorPercent" | "selectedProject" | "vscodeBridgeWorkspaceUris" | "vscodeBridgeSession";
export type AppStorageReadT = { state: "missing"; } | { state: "present"; value: string; };
type BrowserStorageReadT = ReturnType<Storage["getItem"]>;

const STORAGE_NAMESPACE: string = "codaigram.";

export function readAppStorageValue(key: AppStorageKeyT): AppStorageReadT {
  const storageKey: string = `${STORAGE_NAMESPACE}${key}`;
  const storedValue: BrowserStorageReadT = window.localStorage.getItem(storageKey);
  if (typeof storedValue !== "string") return { state: "missing" };
  return { state: "present", value: storedValue };
}

export function writeAppStorageValue(key: AppStorageKeyT, value: string): void {
  const storageKey: string = `${STORAGE_NAMESPACE}${key}`;
  window.localStorage.setItem(storageKey, value);
}

export function removeAppStorageValue(key: AppStorageKeyT): void {
  const storageKey: string = `${STORAGE_NAMESPACE}${key}`;
  window.localStorage.removeItem(storageKey);
}
