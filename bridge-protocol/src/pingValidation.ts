import { ALLOWDUPS, type DisclosurePolicy, PUBLIC, PublicDisclosure, RedactedDisclosure, ValidatedNumber, ValidatedString, vv } from "@untrust/vv/zod";
import { compileValidator } from "@untrust/mandate-core";
import { err, ok, Result, ResultAsync } from "neverthrow";

class NumberDisclosure implements DisclosurePolicy<number, number> {
  toPublicValue(value: number): number { return value; }
  toPublicRepresentation(value: number): string { return String(value); }
}
const PUBLIC_NUMBER: NumberDisclosure = new NumberDisclosure();
const REDACTED: RedactedDisclosure = new RedactedDisclosure();
// Typical values: 1
class ProtocolVersion extends ValidatedNumber<NumberDisclosure> {
  public constructor(value: number) { super(value, 1, 1, PUBLIC_NUMBER); }
  protected normalizeOrUndefine(value: number) { return Number.isSafeInteger(value) ? value : undefined; }
  protected validityDescription() { return "Must be a supported protocol version."; }
}
// Typical values: "chat", "chat/ask", "scan/classes", "code/get"
class MessageType extends ValidatedString<RedactedDisclosure> {
  public constructor(value: string) { super(value, 1, 128, REDACTED); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must not be empty."; }
}
// Typical values: "cancel"
class CancellationType extends ValidatedString<RedactedDisclosure> {
  public constructor(value: string) { super(value, 6, 6, REDACTED); }
  protected normalizeOrUndefine(value: string) { return value === "cancel" ? value : undefined; }
  protected validityDescription() { return "Must be a supported cancellation message type."; }
}
// Typical values: "request-1", "0e3d5b84-7e6b-4da8-8f62-385fd2bc9e1d"
class RequestId extends ValidatedString<RedactedDisclosure> {
  public constructor(value: string) { super(value, 1, 4096, REDACTED); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must not be empty."; }
}
// Typical values: "Explain this class", "Summarize the selected method."
class ChatPrompt extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 65_536, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must not be empty."; }
}
// Typical values: "C:/work/project", "workspace/project"
class WorkspacePath extends ValidatedString<RedactedDisclosure> {
  public constructor(value: string) { super(value, 1, 4096, REDACTED); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must not be empty."; }
}
// Typical values: 0, 1732640000000
class UnixTimestampMilliseconds extends ValidatedNumber<NumberDisclosure> {
  public constructor(value: number) { super(value, 0, Number.MAX_SAFE_INTEGER, PUBLIC_NUMBER); }
  protected normalizeOrUndefine(value: number) { return Number.isSafeInteger(value) ? value : undefined; }
  protected validityDescription() { return "Must be a nonnegative safe integer."; }
}
// Typical values: "codaigram", "customer workspace"
class ProjectName extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 4096, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must not be empty."; }
}
// Typical values: "src/app.ts", "Customer", "getName"
class Text extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 0, 4096, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[\s\S]*$/u.test(value) ? value : undefined; }
  protected validityDescription() { return "Must be valid text."; }
}

const vv_ProtocolVersion = vv.number(ProtocolVersion);
const vv_UnixTimestampMilliseconds = vv.number(UnixTimestampMilliseconds);
const RequestMessage = vv.object({ version: vv_ProtocolVersion, type: MessageType, id: RequestId });
const ChatPromptMessage = vv.object({
  version: vv_ProtocolVersion,
  type: MessageType,
  id: RequestId,
  prompt: ChatPrompt,
  cwd: WorkspacePath,
  workFolders: vv.array(WorkspacePath, { min: 0, max: 256 }, ALLOWDUPS),
  syncTimestamp: vv_UnixTimestampMilliseconds,
  projectName: ProjectName,
  relatedFile: Text,
  relatedClass: Text,
  relatedMember: Text
});
const CancellationMessage = vv.object({ version: vv_ProtocolVersion, type: CancellationType, id: RequestId, targetId: RequestId });
const requestValidator = compileValidator(RequestMessage, { source: "body" });
const chatPromptValidator = compileValidator(ChatPromptMessage, { source: "body" });
const cancellationValidator = compileValidator(CancellationMessage, { source: "body" });
const parseJson: (text: string) => Result<unknown, string> = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, () => "Invalid JSON");

export interface ValidatedRequest {
  readonly type: string;
  readonly id: string;
  readonly targetId?: string;
  readonly prompt?: string;
}

export async function validateChatPromptRequest(value: unknown): Promise<Result<void, string>> {
  const validation = await ResultAsync.fromPromise(Promise.resolve(chatPromptValidator.validate(value)), () => "Invalid chat prompt");
  return validation.isErr() ? err("Invalid chat prompt") : ok(undefined);
}

export async function validateRequest(text: string): Promise<Result<ValidatedRequest, string>> {
  const parsed: Result<unknown, string> = parseJson(text);
  if (parsed.isErr()) return err("Invalid JSON");
  const isCancellation = parsed.value !== null && typeof parsed.value === "object" && "type" in parsed.value && parsed.value.type === "cancel";
  if (isCancellation) {
    const cancellation = await ResultAsync.fromPromise(Promise.resolve(cancellationValidator.validate(parsed.value)), () => "Invalid cancellation");
    if (cancellation.isErr()) return err("Invalid cancellation");
    return ok({ type: cancellation.value.type.exposeUnchecked(), id: cancellation.value.id.exposeUnchecked(), targetId: cancellation.value.targetId.exposeUnchecked() });
  }
  const validation = await ResultAsync.fromPromise(Promise.resolve(requestValidator.validate(parsed.value)), () => "Invalid request");
  if (validation.isErr()) return err("Invalid request");
  return ok({ type: validation.value.type.exposeUnchecked(), id: validation.value.id.exposeUnchecked() });
}
