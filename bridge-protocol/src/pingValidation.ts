import { compileValidator } from "@untrust/mandate-core";
import type { CompiledValidator, InferOutput } from "@untrust/mandate-core";
import type { Archetype, DisclosurePolicy, TypeDefinition } from "@untrust/vv";
import { defineTypes, defineUncheckedCustomArchetype, disclosures, identity, issue, noAdditionalValidation, object, regexString } from "@untrust/vv";
import { err, ok, Result, ResultAsync } from "neverthrow";

type NumberDefinitionT = TypeDefinition<Archetype<number>, DisclosurePolicy<number, number>>;
type StringDefinitionT = TypeDefinition<Archetype<string>, DisclosurePolicy<string, string>>;
const VERSION_DEFINITION: NumberDefinitionT = {
  archetype: defineUncheckedCustomArchetype<number>({
    kind: "bridge.request-version",
    validate: (input) => input === 1 ? { success: true, value: 1 } : {
      success: false,
      issues: [issue("ping.version", "Invalid request version.")]
    }
  }),
  disclosure: disclosures.public<number>()
};
const TYPE_DEFINITION: StringDefinitionT = {
  archetype: regexString({
    bounds: { minimum: 1, maximum: 128 },
    pattern: /^[\s\S]+$/u,
    normalize: identity,
    validateAdditional: noAdditionalValidation
  }),
  disclosure: disclosures.redacted<string>()
};
const CANCEL_TYPE_DEFINITION: StringDefinitionT = {
  archetype: defineUncheckedCustomArchetype<string>({
    kind: "bridge.cancel-type",
    validate: (input) => input === "cancel" ? { success: true, value: "cancel" } : {
      success: false,
      issues: [issue("request.type", "Invalid cancellation type.")]
    }
  }),
  disclosure: disclosures.redacted<string>()
};
const ID_DEFINITION: StringDefinitionT = {
  archetype: regexString({
    bounds: { minimum: 1, maximum: 4096 },
    pattern: /^[\s\S]+$/u,
    normalize: identity,
    validateAdditional: noAdditionalValidation
  }),
  disclosure: disclosures.redacted<string>()
};
function requestValues() {
    return defineTypes({
      Version: VERSION_DEFINITION,
      Type: TYPE_DEFINITION,
      Id: ID_DEFINITION
    });
}

const REQUEST_VALUES: ReturnType<typeof requestValues> = requestValues();
function cancellationValues() {
    return defineTypes({
      Version: VERSION_DEFINITION,
      Type: CANCEL_TYPE_DEFINITION,
      Id: ID_DEFINITION
    });
}
const CANCELLATION_VALUES: ReturnType<typeof cancellationValues> = cancellationValues();
function requestSchema() {
    return object({
      version: REQUEST_VALUES.Version,
      type: REQUEST_VALUES.Type,
      id: REQUEST_VALUES.Id
    }, { unknownProperties: "reject" });
}

type RequestSchemaT = ReturnType<typeof requestSchema>;
const validator: CompiledValidator<InferOutput<RequestSchemaT>> = compileValidator(requestSchema(), { source: "body" });
function cancellationSchema() {
    return object({
      version: CANCELLATION_VALUES.Version,
      type: CANCELLATION_VALUES.Type,
      id: CANCELLATION_VALUES.Id,
      targetId: CANCELLATION_VALUES.Id
    }, { unknownProperties: "reject" });
}
type CancellationSchemaT = ReturnType<typeof cancellationSchema>;
const cancellationValidator: CompiledValidator<InferOutput<CancellationSchemaT>> = compileValidator(cancellationSchema(), { source: "body" });
const parseJson: (text: string) => Result<unknown, string> = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, () => "Invalid JSON");

export interface ValidatedRequest {
    readonly type: string;
    readonly id: string;
    readonly targetId?: string;
    readonly prompt?: string;
}

export async function validateRequest(text: string): Promise<Result<ValidatedRequest, string>> {
    const parsed: Result<unknown, string> = parseJson(text);
    if (parsed.isErr()) return err("Invalid JSON");
    if (parsed.value && typeof parsed.value === "object" && "type" in parsed.value && parsed.value.type === "cancel") {
        const cancellation: Result<InferOutput<CancellationSchemaT>, string> = await ResultAsync.fromPromise(Promise.resolve(cancellationValidator.validate(parsed.value)), () => "Invalid cancellation");
        if (cancellation.isErr()) return err("Invalid cancellation");
        return ok({
          type: "cancel",
          id: cancellation.value.id.exposeUnchecked(),
          targetId: cancellation.value.targetId.exposeUnchecked()
        });
    }
    const validation: Result<InferOutput<RequestSchemaT>, string> = await ResultAsync.fromPromise(Promise.resolve(validator.validate(parsed.value)), () => "Invalid request");
    if (validation.isErr()) return err("Invalid request");
    return ok({
      type: validation.value.type.exposeUnchecked(),
      id: validation.value.id.exposeUnchecked()
    });
}
