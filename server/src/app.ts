import express from '@untrust/mandate-express';
import { RequestValidationError } from '@untrust/mandate-core';
import { array, classifications, defineTypes, defineUncheckedCustomArchetype, disclosures, issue, noAdditionalValidation, object, regexString, type InferValue, type ValidationResult } from '@untrust/vv';
import type { ClassDetails, ClassRepository } from './memory-repository.js';

type PublicClassificationFactoryT = typeof classifications.public;
type PublicStringDisclosureFactoryT = typeof disclosures.public<string>;
type PublicBooleanDisclosureFactoryT = typeof disclosures.public<boolean>;
type PublicClassificationT = ReturnType<PublicClassificationFactoryT>;
type PublicStringDisclosureT = ReturnType<PublicStringDisclosureFactoryT>;
type PublicBooleanDisclosureT = ReturnType<PublicBooleanDisclosureFactoryT>;
type RegexStringArchetypeT = ReturnType<typeof regexString>;
type ClassMethodDefinitionT = {
  archetype: RegexStringArchetypeT;
  classification: PublicClassificationT;
  disclosure: PublicStringDisclosureT;
};
type RelationNameDefinitionT = ClassMethodDefinitionT;
type RelationKindDefinitionT = ClassMethodDefinitionT;
type ClassNameDefinitionT = ClassMethodDefinitionT;

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
    bounds: { minimum: 4, maximum: 4 },
    pattern: /^OWNS$/,
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
  RelationName: RelationNameDefinitionT;
  RelationKind: RelationKindDefinitionT;
  Multiplicity: BooleanValueDefinitionT;
  PartialStatus: BooleanValueDefinitionT;
}>> = defineTypes({
  Method: methodDefinition,
  RelationName: relationNameDefinition,
  RelationKind: relationKindDefinition,
  Multiplicity: multiplicityDefinition,
  PartialStatus: partialStatusDefinition
});
type MethodT = typeof VALUES.Method;
type RelationKindT = typeof VALUES.RelationKind;
type RelationNameT = typeof VALUES.RelationName;
type MultiplicityT = typeof VALUES.Multiplicity;
type PartialStatusT = typeof VALUES.PartialStatus;
const CLASS_DETAILS: ReturnType<typeof object<{
  name: ClassNameT;
  methods: ReturnType<typeof array<MethodT>>;
  relations: ReturnType<typeof array<ReturnType<typeof object<{
    kind: RelationKindT;
    name: RelationNameT;
    target: ClassNameT;
    many: MultiplicityT }>>>>;
  isPartial: PartialStatusT }>> = object({
    name: CLASS_NAME.ClassName,
    methods: array(VALUES.Method, { minimum: 0, maximum: 100 }),
    relations: array(object({
      kind: VALUES.RelationKind,
      name: VALUES.RelationName,
      target: CLASS_NAME.ClassName,
      many: VALUES.Multiplicity }), { minimum: 0, maximum: 100 }),
    isPartial: VALUES.PartialStatus });

class DuplicateClassError extends Error {}

export function createApp(repository: ClassRepository): ReturnType<typeof express> {
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
  app.post('/api/updateClasses', { body: array(CLASS_DETAILS, { minimum: 1, maximum: 100 }) }, async (request, response) => {
    const details: ClassDetails[] = request.body.map((item) => ({
      name: item.name.exposeUnchecked(),
      methods: item.methods.map((method) => method.exposeUnchecked()),
      relations: item.relations.map((relation) => ({
        kind: 'OWNS',
        name: relation.name.exposeUnchecked(),
        target: relation.target.exposeUnchecked(),
        many: relation.many.exposeUnchecked() })),
      isPartial: item.isPartial.exposeUnchecked() }));
    if (new Set(details.map((item: ClassDetails) => item.name)).size !== details.length) throw new DuplicateClassError();
    await repository.updateClasses(details);
    response.json({ updated: details.length });
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
