import { err, ok, Result } from "neverthrow";
import { validateRequest } from "./pingValidation";
import type { ValidatedRequest } from "./pingValidation";

export interface WorkspaceFolderInfo {
  readonly name: string;
  readonly uri: string;
  readonly index: number;
  readonly configuredAgents: readonly string[];
}

export interface WorkspaceSyncRequest extends ValidatedRequest {
  readonly syncTimestamp?: number;
  readonly cwd?: string;
  readonly workFolders?: readonly string[];
  readonly scanType?: "tests" | "classes";
  readonly projectName?: string;
  readonly filepath?: string;
  readonly typeName?: string;
}

export interface ScanRequest extends WorkspaceSyncRequest {
  readonly scanType: "tests" | "classes";
  readonly workFolders: readonly string[];
}

export interface GetCodeRequest extends WorkspaceSyncRequest {
  readonly type: "code/get";
  readonly projectName: string;
  readonly workFolders: readonly string[];
  readonly filepath: string;
  readonly typeName: string;
}

export interface ChatPromptRequest extends WorkspaceSyncRequest {
  readonly type: "chat" | "chat/ask";
  readonly prompt: string;
  readonly cwd: string;
  readonly workFolders: readonly string[];
}

export function isChatPromptRequest(request: WorkspaceSyncRequest): request is ChatPromptRequest {
  return (request.type === "chat" || request.type === "chat/ask") &&
    typeof request.prompt === "string" &&
    typeof request.cwd === "string" &&
    Array.isArray(request.workFolders) &&
    request.workFolders.every((folder: string) => typeof folder === "string");
}

interface RawSyncRequest {
  readonly version: unknown;
  readonly type: unknown;
  readonly id: unknown;
  readonly targetId?: unknown;
  readonly syncTimestamp?: unknown;
  readonly prompt?: unknown;
  readonly cwd?: unknown;
  readonly workFolders?: unknown;
  readonly scanType?: unknown;
  readonly projectName?: unknown;
  readonly filepath?: unknown;
  readonly typeName?: unknown;
}

export class WorkspaceSyncState {
  private timestamp: number = Date.now();

  public currentTimestamp(): number {
    return this.timestamp;
  }

  public changed(): number {
    const now: number = Date.now();
    this.timestamp = now > this.timestamp ? now : this.timestamp + 1;
    return this.timestamp;
  }

}

export async function validateWorkspaceRequest(text: string): Promise<Result<WorkspaceSyncRequest, string>> {
  let raw: RawSyncRequest;
  try {
    raw = JSON.parse(text) as RawSyncRequest;
  } catch (error: unknown) {
    console.warn("Workspace request JSON parsing failed.", error);
    return err("Invalid JSON");
  }
  if (typeof raw !== "object" || !raw) return err("Invalid request");
  const keys: readonly string[] = Object.keys(raw as object);
  const isChat: boolean = raw.type === "chat" || raw.type === "chat/ask";
  const isScan: boolean = raw.type === "scan/tests" || raw.type === "scan/classes";
  const isCodeGet: boolean = raw.type === "code/get";
  const allowed: readonly string[] = raw.type === "cancel" ? ["version", "type", "id", "targetId", "syncTimestamp"] : isChat ? ["version", "type", "id", "syncTimestamp", "prompt", "cwd", "workFolders"] : isScan ? ["version", "type", "id", "workFolders"] : isCodeGet ? ["version", "type", "id", "projectName", "workFolders", "filepath", "typeName"] : ["version", "type", "id", "syncTimestamp"];
  if (keys.some((key) => !allowed.includes(key))) return err("Invalid request");
  if (isChat && (typeof raw.prompt !== "string" || raw.prompt.length === 0 || raw.prompt.length > 65_536)) return err("Invalid prompt");
  if (!isChat && "prompt" in raw && (typeof raw.prompt !== "string" || raw.prompt.length === 0 || raw.prompt.length > 65_536)) return err("Invalid prompt");
  if (isChat && (typeof raw.cwd !== "string" || raw.cwd.length === 0)) return err("Invalid cwd");
  if ("cwd" in raw && (typeof raw.cwd !== "string" || raw.cwd.length === 0)) return err("Invalid cwd");
  if (isChat && !Array.isArray(raw.workFolders)) return err("Invalid work folders");
  if ("workFolders" in raw && (!Array.isArray(raw.workFolders) || raw.workFolders.some((folder: unknown) => typeof folder !== "string" || folder.length === 0))) return err("Invalid work folders");
  if (isScan && (!Array.isArray(raw.workFolders) || raw.workFolders.length === 0)) return err("Invalid work folders");
  if (isCodeGet && (typeof raw.projectName !== "string" || raw.projectName.length === 0 || !Array.isArray(raw.workFolders) || raw.workFolders.length === 0 || raw.workFolders.some((folder: unknown) => typeof folder !== "string" || folder.length === 0) || typeof raw.filepath !== "string" || raw.filepath.length === 0 || typeof raw.typeName !== "string" || raw.typeName.length === 0)) return err("Invalid code request");
  if ("syncTimestamp" in raw && (typeof raw.syncTimestamp !== "number" || !Number.isSafeInteger(raw.syncTimestamp) || raw.syncTimestamp < 0)) return err("Invalid sync timestamp");
  const baseText: string = raw.type === "cancel"
    ? JSON.stringify({
      version: raw.version,
      type: raw.type,
      id: raw.id,
      targetId: raw.targetId
    })
    : JSON.stringify({ version: raw.version, type: raw.type, id: raw.id });
  const validated: Result<ValidatedRequest, string> = await validateRequest(baseText);
  if (validated.isErr()) return err(validated.error);
  const prompt: string | undefined = typeof raw.prompt === "string" ? raw.prompt : undefined;
  const cwd: string | undefined = typeof raw.cwd === "string" ? raw.cwd : undefined;
  const workFolders: readonly string[] | undefined = Array.isArray(raw.workFolders) ? raw.workFolders as readonly string[] : undefined;
  const scanType: "tests" | "classes" | undefined = raw.type === "scan/tests" ? "tests" : raw.type === "scan/classes" ? "classes" : undefined;
  const context: object = {
    ...(prompt === undefined ? {} : { prompt }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(workFolders === undefined ? {} : { workFolders }),
    ...(scanType === undefined ? {} : { scanType })
    ,...(isCodeGet ? { projectName: raw.projectName as string, workFolders: raw.workFolders as readonly string[], filepath: raw.filepath as string, typeName: raw.typeName as string } : {})
  };
  if (!Number.isSafeInteger(raw.syncTimestamp)) {
    return Object.keys(context).length === 0 ? ok(validated.value) : ok({ type: validated.value.type, id: validated.value.id, ...context });
  }
  const timestamp: number = raw.syncTimestamp as number;
  if ("targetId" in validated.value) {
    return ok({
      type: validated.value.type,
      id: validated.value.id,
      targetId: validated.value.targetId,
      syncTimestamp: timestamp,
      ...context
    });
  }
  return ok({
    type: validated.value.type,
    id: validated.value.id,
      syncTimestamp: timestamp,
      ...context
  });
}
