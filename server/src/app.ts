import express from '@untrust/mandate-express';
import { RequestValidationError } from '@untrust/mandate-core';
import { array, classifications, defineTypes, defineUncheckedCustomArchetype, disclosures, issue, noAdditionalValidation, object, regexString, type InferValue, type ValidationResult } from '@untrust/vv';
import { JsonMap } from '@codaigram/shared/json-map';
import type { ClassDetails, CompositeTypeT, FieldType } from '@codaigram/shared/class-types';
import type { ClassRepository, TestDetails, TestInventoryRepository } from './memory-repository.js';
import { logAndThrow } from './utils.js';

type PublicClassificationFactoryT = typeof classifications.public;
type PublicStringDisclosureFactoryT = typeof disclosures.public<string>;
type PublicBooleanDisclosureFactoryT = typeof disclosures.public<boolean>;
type PublicFieldTypeDisclosureFactoryT = typeof disclosures.public<FieldType>;
type PublicClassificationT = ReturnType<PublicClassificationFactoryT>;
type PublicStringDisclosureT = ReturnType<PublicStringDisclosureFactoryT>;
type PublicBooleanDisclosureT = ReturnType<PublicBooleanDisclosureFactoryT>;
type PublicFieldTypeDisclosureT = ReturnType<PublicFieldTypeDisclosureFactoryT>;
type RegexStringArchetypeT = ReturnType<typeof regexString>;
type ClassMethodDefinitionT = {
  archetype: RegexStringArchetypeT;
  classification: PublicClassificationT;
  disclosure: PublicStringDisclosureT;
};
type RelationNameDefinitionT = ClassMethodDefinitionT;
type RelationKindDefinitionT = ClassMethodDefinitionT;
type ClassNameDefinitionT = ClassMethodDefinitionT;
type TestDefinitionT = ClassMethodDefinitionT;
type FieldTypeDefinitionT = {
  archetype: ReturnType<typeof defineUncheckedCustomArchetype<FieldType>>;
  classification: PublicClassificationT;
  disclosure: PublicFieldTypeDisclosureT;
};

const classNameDefinition: ClassNameDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value.trim(),
    bounds: { minimum: 1, maximum: 100 },
    pattern: /^[A-Za-z_][A-Za-z0-9_]*$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>()
};
const CLASS_NAME: ReturnType<typeof defineTypes<{ ClassName: ClassNameDefinitionT }>> = defineTypes({ ClassName: classNameDefinition });
type ClassNameT = typeof CLASS_NAME.ClassName;
const testGroupDefinition: TestDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value.trim(),
    bounds: { minimum: 1, maximum: 100 },
    pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>() };
const testNameDefinition: TestDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value.trim(),
    bounds: { minimum: 1, maximum: 100 },
    pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>() };
const testDescriptionDefinition: TestDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value.trim(),
    bounds: { minimum: 1, maximum: 1000 },
    pattern: /^[\x20-\x7e]+$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>() };
const testPromptDefinition: TestDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value.trim(),
    bounds: { minimum: 1, maximum: 10000 },
    pattern: /^[\x20-\x7e\r\n\t]+$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>() };
const TEST_VALUES: ReturnType<typeof defineTypes<{
  TestGroup: TestDefinitionT;
  TestName: TestDefinitionT;
  TestDescription: TestDefinitionT;
  TestPrompt: TestDefinitionT;
}>> = defineTypes({
  TestGroup: testGroupDefinition,
  TestName: testNameDefinition,
  TestDescription: testDescriptionDefinition,
  TestPrompt: testPromptDefinition
});
type TestGroupT = typeof TEST_VALUES.TestGroup;
type TestNameT = typeof TEST_VALUES.TestName;
type TestDescriptionT = typeof TEST_VALUES.TestDescription;
type TestPromptT = typeof TEST_VALUES.TestPrompt;
const TEST_DETAILS: ReturnType<typeof object<{
  group: TestGroupT;
  name: TestNameT;
  description: TestDescriptionT;
  prompt: TestPromptT;
}>> = object({
  group: TEST_VALUES.TestGroup,
  name: TEST_VALUES.TestName,
  description: TEST_VALUES.TestDescription,
  prompt: TEST_VALUES.TestPrompt });

// VV currently has no built-in boolean archetype; this checks the primitive exactly, without coercion.
const BOOLEAN: ReturnType<typeof defineUncheckedCustomArchetype<boolean>> = defineUncheckedCustomArchetype<boolean>({
  kind: 'codaigram.boolean',
  validate: (input: unknown) => typeof input === 'boolean' ? { success: true, value: input } : {
    success: false,
    issues: [issue('boolean.invalid', 'Expected a boolean.')] } });
type BooleanValueDefinitionT = {
  archetype: typeof BOOLEAN;
  classification: PublicClassificationT;
  disclosure: PublicBooleanDisclosureT;
};
const methodDefinition: ClassMethodDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value,
    bounds: { minimum: 1, maximum: 1000 },
    pattern: /^[\x20-\x7e]+$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>()
};
function validateCompositeType(input: unknown, depth: number): ValidationResult<CompositeTypeT> {
  if (Array.isArray(input)) {
    if (input.length <= 100 && input.every((value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 1000 && /^[\x20-\x7e]+$/.test(value))) {
      return { success: true, value: input as string[] };
    }
    return {
      success: false,
      issues: [issue('field-type.invalid', 'Expected a bounded list of enum values.')] };
  }
  if (typeof input === 'string') {
    if (input.length <= 1000 && /^[\x20-\x7e]+$/.test(input)) {
      return { success: true, value: input };
    }
    return {
      success: false,
      issues: [issue('field-type.invalid', 'Expected a printable type string.')] };
  }
  // UNTRUST-ALLOW-NULLISH: An untrusted JSON composite can be null, so reject it before treating its named entries as recursively composable values.
  if (typeof input !== 'object' || input === null || Array.isArray(input) || depth >= 20) {
    return {
      success: false,
      issues: [issue('field-type.invalid', 'Expected a bounded composite type.')] };
  }
  const entries: [string, unknown][] = Object.entries(input);
  if (entries.length > 100) {
    return {
      success: false,
      issues: [issue('field-type.invalid', 'Expected at most 100 named composite fields.')] };
  }
  const composite: JsonMap<string, CompositeTypeT> = new JsonMap<string, CompositeTypeT>();
  for (let index: number = 0; index < entries.length; index += 1) {
    const entry: [string, unknown] = entries[index]!;
    const name: string = entry[0];
    const item: unknown = entry[1];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return {
        success: false,
        issues: [issue('field-type.invalid', 'Expected a named composite field.')] };
    }
    const result: ValidationResult<CompositeTypeT> = validateCompositeType(item, depth + 1);
    if (!result.success) return result;
    composite.set(name, result.value);
  }
  return { success: true, value: composite };
}

function validateFieldType(input: unknown, depth: number = 0): ValidationResult<FieldType> {
  // UNTRUST-ALLOW-NULLISH: An untrusted JSON field description can be null at the HTTP boundary, so reject that absent value before safely inspecting its required arg and type properties.
  if (typeof input !== 'object' || input === null || Array.isArray(input) || !('arg' in input) || !('t' in input) || typeof input.arg !== 'string' || input.arg.length === 0 || input.arg.length > 100 || !/^(?:\+[A-Z]+|[A-Za-z_][A-Za-z0-9_]*)$/.test(input.arg)) {
    return {
      success: false,
      issues: [issue('field-type.invalid', 'Expected a field with arg and t.')] };
  }
  const compositeResult: ValidationResult<CompositeTypeT> = validateCompositeType(input.t, depth);
  if (!compositeResult.success) return compositeResult;
  return {
    success: true,
    value: { arg: input.arg, t: compositeResult.value } };
}

type FieldTypeValidatorT = (input: unknown) => ValidationResult<FieldType>;
const fieldTypeValidator: FieldTypeValidatorT = (input) => validateFieldType(input);
const FIELD_TYPE: ReturnType<typeof defineUncheckedCustomArchetype<FieldType>> = defineUncheckedCustomArchetype<FieldType>({
  kind: 'codaigram.field-type',
  validate: fieldTypeValidator });
const fieldTypeDefinition: FieldTypeDefinitionT = {
  archetype: FIELD_TYPE,
  classification: classifications.public(),
  disclosure: disclosures.public<FieldType>()
};
const relationNameDefinition: RelationNameDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value,
    bounds: { minimum: 0, maximum: 100 },
    pattern: /^(?:[A-Za-z_][A-Za-z0-9_]*)?$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>()
};
const relationKindDefinition: RelationKindDefinitionT = {
  archetype: regexString({
    normalize: (value: string) => value,
    bounds: { minimum: 3, maximum: 4 },
    pattern: /^(?:OWNS|REF|UNK)$/,
    validateAdditional: noAdditionalValidation }),
  classification: classifications.public(),
  disclosure: disclosures.public<string>()
};
const multiplicityDefinition: BooleanValueDefinitionT = {
  archetype: BOOLEAN,
  classification: classifications.public(),
  disclosure: disclosures.public<boolean>()
};
const partialStatusDefinition: BooleanValueDefinitionT = {
  archetype: BOOLEAN,
  classification: classifications.public(),
  disclosure: disclosures.public<boolean>()
};
const VALUES: ReturnType<typeof defineTypes<{
  Method: ClassMethodDefinitionT;
  FieldType: FieldTypeDefinitionT;
  RelationName: RelationNameDefinitionT;
  RelationKind: RelationKindDefinitionT;
  Multiplicity: BooleanValueDefinitionT;
  PartialStatus: BooleanValueDefinitionT;
}>> = defineTypes({
  Method: methodDefinition,
  FieldType: fieldTypeDefinition,
  RelationName: relationNameDefinition,
  RelationKind: relationKindDefinition,
  Multiplicity: multiplicityDefinition,
  PartialStatus: partialStatusDefinition
});
type MethodT = typeof VALUES.Method;
type FieldTypeT = typeof VALUES.FieldType;
type RelationKindT = typeof VALUES.RelationKind;
type RelationNameT = typeof VALUES.RelationName;
type MultiplicityT = typeof VALUES.Multiplicity;
type PartialStatusT = typeof VALUES.PartialStatus;
const CLASS_MEMBER: ReturnType<typeof object<{
  name: MethodT;
  overloads: ReturnType<typeof array<ReturnType<typeof array<FieldTypeT>>>>;
}>> = object({
  name: VALUES.Method,
  overloads: array(array(VALUES.FieldType, { minimum: 0, maximum: 100 }), { minimum: 0, maximum: 100 })
});
const CLASS_DETAILS: ReturnType<typeof object<{
  name: ClassNameT;
  methods: ReturnType<typeof array<typeof CLASS_MEMBER>>;
  relations: ReturnType<typeof array<ReturnType<typeof object<{
    kind: RelationKindT;
    name: RelationNameT;
    target: ClassNameT;
    many: MultiplicityT }>>>>;
  isPartial: PartialStatusT }>> = object({
    name: CLASS_NAME.ClassName,
    methods: array(CLASS_MEMBER, { minimum: 0, maximum: 100 }),
    relations: array(object({
      kind: VALUES.RelationKind,
      name: VALUES.RelationName,
      target: CLASS_NAME.ClassName,
      many: VALUES.Multiplicity }), { minimum: 0, maximum: 100 }),
    isPartial: VALUES.PartialStatus });

class DuplicateClassError extends Error {}

export function createApp(repository: ClassRepository & TestInventoryRepository): ReturnType<typeof express> {
  const app: ReturnType<typeof express> = express();
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', {}, (_request, response) => { response.json({ status: 'ok' }); });
  app.post('/api/classesDetails', {
    body: object({
      classNames: array(CLASS_NAME.ClassName, { minimum: 1, maximum: 100 }) }) }, async (request, response) => {
    const names: string[] = request.body.classNames.map((className: InferValue<ClassNameT>) => className.exposeUnchecked());
    const details: ClassDetails[] = await repository.getDetails(names);
    response.json(details);
  });
  app.get('/api/getClasses', {}, async (_request, response) => {
    response.json(await repository.getClasses());
  });
  app.post('/api/updateClasses', { body: array(CLASS_DETAILS, { minimum: 1, maximum: 100 }) }, async (request, response) => {
    const details: ClassDetails[] = request.body.map((item) => ({
      name: item.name.exposeUnchecked(),
      methods: item.methods.map((method) => ({
        name: method.name.exposeUnchecked(),
        overloads: method.overloads.map((overload) => overload.map((field) => field.exposeUnchecked())) })),
      relations: item.relations.map((relation) => ({
        kind: relation.kind.exposeUnchecked() === 'OWNS' ? 'OWNS' : relation.kind.exposeUnchecked() === 'REF' ? 'REF' : 'UNK',
        name: relation.name.exposeUnchecked(),
        target: relation.target.exposeUnchecked(),
        many: relation.many.exposeUnchecked() })),
      isPartial: item.isPartial.exposeUnchecked() }));
    if (new Set(details.map((item: ClassDetails) => item.name)).size !== details.length) logAndThrow(new DuplicateClassError());
    await repository.updateClasses(details);
    response.json({ updated: details.length });
  });
  app.get('/api/getTests', {}, async (_request, response) => {
    response.json(await repository.getTests());
  });
  app.post('/api/updateTests', {
    body: array(TEST_DETAILS, { minimum: 1, maximum: 10000 }) }, async (request, response) => {
    const tests: TestDetails[] = request.body.map((item) => ({
      group: item.group.exposeUnchecked(),
      name: item.name.exposeUnchecked(),
      description: item.description.exposeUnchecked(),
      prompt: item.prompt.exposeUnchecked() }));
    if (new Set(tests.map((item: TestDetails) => `${item.group}.${item.name}`)).size !== tests.length) logAndThrow(new DuplicateClassError());
    await repository.updateTests(tests);
    response.json({ updated: tests.length });
  });
  app.use(express.trustedMiddleware((error: unknown, _request: unknown, response: Parameters<Parameters<ReturnType<typeof express>['get']>[2]>[1], _next: (error: unknown) => void) => {
    if (error instanceof Error && 'status' in error && error.status === 413) {
      response.status(413).json({ error: 'Request is too large.' });
    } else if (error instanceof RequestValidationError || error instanceof DuplicateClassError || (error instanceof SyntaxError && 'status' in error && error.status === 400)) {
      response.status(400).json({ error: 'Invalid request.' });
    } else {
      response.status(500).json({ error: 'Request could not be completed.' });
    }
  }));
  return app;
}
