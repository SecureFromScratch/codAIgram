import { err, ok, Result } from "neverthrow";
import { validateRequest } from "./pingValidation";
import type { ValidatedRequest } from "./pingValidation";

export interface WorkspaceFolderInfo {
  readonly name: string;
  readonly uri: string;
  readonly index: number;
}

export interface WorkspaceSyncRequest extends ValidatedRequest {
  readonly syncTimestamp?: number;
}

interface RawSyncRequest {
  readonly version: unknown;
  readonly type: unknown;
  readonly id: unknown;
  readonly targetId?: unknown;
  readonly syncTimestamp?: unknown;
  readonly prompt?: unknown;
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
  const allowed: readonly string[] = raw.type === "cancel" ? ["version", "type", "id", "targetId", "syncTimestamp"] : isChat ? ["version", "type", "id", "syncTimestamp", "prompt"] : ["version", "type", "id", "syncTimestamp"];
  if (keys.some((key) => !allowed.includes(key))) return err("Invalid request");
  if ("prompt" in raw && (typeof raw.prompt !== "string" || raw.prompt.length === 0 || raw.prompt.length > 65_536)) return err("Invalid prompt");
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
  if (!Number.isSafeInteger(raw.syncTimestamp)) {
    return prompt === undefined ? ok(validated.value) : ok({ type: validated.value.type, id: validated.value.id, prompt });
  }
  const timestamp: number = raw.syncTimestamp as number;
  if ("targetId" in validated.value) {
    return ok({
      type: validated.value.type,
      id: validated.value.id,
      targetId: validated.value.targetId,
      syncTimestamp: timestamp,
      ...(prompt === undefined ? {} : { prompt })
    });
  }
  return ok({
    type: validated.value.type,
    id: validated.value.id,
      syncTimestamp: timestamp,
      ...(prompt === undefined ? {} : { prompt })
  });
}
