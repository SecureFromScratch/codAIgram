import * as fs from "node:fs";
import type { WorkspaceFolderInfo } from "@codaigram/bridge-protocol";

export interface PromptResponsePair {
  readonly prompt: string;
  readonly response: string;
}

export interface MockConfig {
  readonly port?: number;
  readonly authtoken: string;
  readonly workspaceFolders: readonly WorkspaceFolderInfo[];
  readonly workspaceLastModified: number;
  readonly promptResponses: readonly PromptResponsePair[];
  readonly trustedOrigins?: readonly string[];
}

interface RawConfig {
  readonly port?: unknown;
  readonly authtoken?: unknown;
  readonly workspaceFolders?: unknown;
  readonly workspaceLastModified?: unknown;
  readonly promptResponses?: unknown;
  readonly trustedOrigins?: unknown;
}

export function readConfig(configPath: string): MockConfig {
  const parsed: unknown = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("Mock config must be a JSON object.");
  const raw: RawConfig = parsed as RawConfig;
  if (raw.port !== undefined && (typeof raw.port !== "number" || !Number.isSafeInteger(raw.port) || raw.port < 0 || raw.port > 65535)) throw new Error("Mock config port must be an integer between 0 and 65535.");
  if (typeof raw.authtoken !== "string" || raw.authtoken.length === 0) throw new Error("Mock config authtoken must be a non-empty string.");
  if (!Array.isArray(raw.workspaceFolders)) throw new Error("Mock config workspaceFolders must be an array.");
  if (typeof raw.workspaceLastModified !== "number" || !Number.isSafeInteger(raw.workspaceLastModified) || raw.workspaceLastModified < 0) throw new Error("Mock config workspaceLastModified must be a non-negative safe integer.");
  if (!Array.isArray(raw.promptResponses)) throw new Error("Mock config promptResponses must be an array.");
  const workspaceFolders: WorkspaceFolderInfo[] = raw.workspaceFolders.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object") throw new Error("Each workspace folder must be an object.");
    const folder: { readonly name?: unknown; readonly uri?: unknown; readonly index?: unknown } = item as { readonly name?: unknown; readonly uri?: unknown; readonly index?: unknown };
    if (typeof folder.name !== "string" || typeof folder.uri !== "string") throw new Error("Each workspace folder needs name and uri strings.");
    if (folder.index !== undefined && (typeof folder.index !== "number" || !Number.isSafeInteger(folder.index) || folder.index < 0)) throw new Error("Workspace folder index must be a non-negative safe integer.");
    return { name: folder.name, uri: folder.uri, index: folder.index === undefined ? index : folder.index };
  });
  const promptResponses: PromptResponsePair[] = raw.promptResponses.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Each prompt response must be an object.");
    const pair: { readonly prompt?: unknown; readonly response?: unknown } = item as { readonly prompt?: unknown; readonly response?: unknown };
    if (typeof pair.prompt !== "string" || typeof pair.response !== "string") throw new Error("Each prompt response needs prompt and response strings.");
    return { prompt: pair.prompt, response: pair.response };
  });
  if (raw.trustedOrigins !== undefined && (!Array.isArray(raw.trustedOrigins) || raw.trustedOrigins.some((origin: unknown) => typeof origin !== "string"))) throw new Error("trustedOrigins must be an array of strings.");
  return {
    ...(raw.port === undefined ? {} : { port: raw.port as number }),
    authtoken: raw.authtoken,
    workspaceFolders,
    workspaceLastModified: raw.workspaceLastModified,
    promptResponses,
    ...(raw.trustedOrigins === undefined ? {} : { trustedOrigins: raw.trustedOrigins as string[] })
  };
}
