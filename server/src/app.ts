import express from '@untrust/mandate-express';
import { RequestValidationError } from '@untrust/mandate-core';
import { ALLOWDUPS, UNIQUE, CodingIdentifier, PUBLIC, PublicDisclosure, JsonMap as VVJsonMap, ValidatedRegex, ValidatedString, ZodAdapter, vv, vv_CodingIdentifier } from '@untrust/vv/zod';
import { z } from 'zod';
import { PrintableAscii } from '@untrust/vv';
import { JsonMap } from '@codaigram/shared/json-map';
import { type ClassDetails, type CompositeTypeT, type FieldType } from '@codaigram/shared/class-types';
import type { ClassRepository, TestDetails, TestIdentifier, TestInventoryRepository, TestRecord } from './memory-repository.js';
import type { DatabaseClassChange } from './memory-repository.js';
import type { ClassHistory, ClassOrigin, ClassUpdate, CurrentClass } from './class-revision.js';
import { InvalidClassRevisionError } from './class-revision.js';
import { logAndThrow, logUnhandledRequestError, logValueShape } from './server_utils.js';

class ProjectName extends ValidatedRegex<PublicDisclosure> {
  public constructor(raw: string) { super(raw, 1, 200, PUBLIC); }

  protected regexp() { return /^[A-Za-z0-9][A-Za-z0-9_-]*$/; }
  protected validityDescription() { return 'Must start with an alphanumeric character, followed by letters, digits, underscores, or dashes.'; }
}

class ShortDescription extends PrintableAscii<PublicDisclosure> {
  public constructor(value: string) { super(value, PUBLIC); }
  public min() : number { return 1; }
  public max() : number { return 1000; }
}
const TestDescription = ShortDescription;
type TestDescription = ShortDescription;

class TestGroup extends ValidatedRegex<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 100, PUBLIC); }
  protected regexp() { return /^[A-Za-z][A-Za-z0-9_-]*$/; }
  protected validityDescription() { return 'Must start with a letter and contain only letters, digits, underscores, and dashes.'; }
}
const TestName = CodingIdentifier;
type TestName = CodingIdentifier;
const ClassName = CodingIdentifier;
type ClassName = CodingIdentifier;
const RelationName = CodingIdentifier;
type RelationName = CodingIdentifier;
const vv_RelationName = vv.union([RelationName, vv.enum([''])]);
class TestPrompt extends ValidatedRegex<PublicDisclosure> {
  public constructor(value: string) { super(value, 0, 10000, PUBLIC); }
  protected regexp() { return /^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/u; }
  protected validityDescription() { return 'Must not contain unsupported control characters.'; }
}
class Timestamp extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 16, 24, PUBLIC); }
  protected normalizeOrUndefine(value: string) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
    const legacy = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(value);
    const parts = iso ?? legacy;
    if (!parts) return undefined;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] = parts;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText ?? 0);
    const milliseconds = Number(millisecondText ?? 0);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, milliseconds);
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      && date.getUTCHours() === hour
      && date.getUTCMinutes() === minute
      && date.getUTCSeconds() === second
      && date.getUTCMilliseconds() === milliseconds
      ? value
      : undefined;
  }
  protected validityDescription() { return 'Must match YYYY-MM-DDTHH:mm:ss[.sss]Z or YYYY/MM/DD HH:mm and contain a valid date and time.'; }
}
// Typical values: "api-test", "scanner-os-user", "assistant"
class ActorName extends ValidatedRegex<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 100, PUBLIC); }
  protected regexp() { return /^[A-Za-z][A-Za-z0-9_-]*$/; }
  protected validityDescription() { return 'Must start with a letter and contain only letters, digits, underscores, and dashes.'; }
}
class VersionTag extends PrintableAscii<PublicDisclosure> {
  public constructor(value: string) { super(value, PUBLIC); }
  public min(): number { return 1; }
  public max(): number { return 100; }
}
// Typical values: "", "+RW: string", "options: { name: string }"
class OverloadSignature extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 0, 256000, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[\x20-\x7e]*$/.test(value) ? value : undefined; }
  protected validityDescription() { return 'Must contain printable ASCII characters.'; }
}
// Typical values: "read", "display name", "with-dash"
class MemberName extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 1000, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[\x20-\x7e]*$/.test(value) ? value : undefined; }
  protected validityDescription() { return 'Must contain printable ASCII characters.'; }
}
// Typical values: ""
class EmptyMemberName extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 0, 0, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return value === '' ? value : undefined; }
  protected validityDescription() { return 'Must be empty.'; }
}
class SourceFilePath extends ValidatedString<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 1024, PUBLIC); }
  protected normalizeOrUndefine(value: string) { return /^[^\x00-\x1f\x7f]+$/u.test(value) ? value : undefined; }
  protected validityDescription() { return 'Must not contain control characters.'; }
}
const vv_ProjectName = vv.object({ projectName: ProjectName });
const vv_TestValues = vv.object({
  group: TestGroup,
  name: TestName,
  description: TestDescription,
  prompt: TestPrompt
});

const vv_TestIdentifier = vv.object({
  group: TestGroup,
  name: TestName
});
const vv_TestIdentifierList = vv.array(vv_TestIdentifier, { min: 1, max: 100 }, ALLOWDUPS);

const vv_TestPromptChange = vv.object({ when: Timestamp, text: TestPrompt }).strict();
const vv_TestDescriptionChange = vv.object({ when: Timestamp, text: TestDescription }).strict();
const vv_TestHistory = vv.object({
  group: TestGroup,
  name: TestName,
  prompts: vv.array(vv_TestPromptChange, { min: 0, max: 10000 }, ALLOWDUPS),
  descriptions: vv.array(vv_TestDescriptionChange, { min: 0, max: 10000 }, ALLOWDUPS),
});
const vv_TestSummary = vv.object({
  group: TestGroup,
  name: TestName,
  description: TestDescription,
  lastChangedAt: Timestamp,
});

const vv_TestUpdate = vv.object({
  group: TestGroup,
  name: TestName,
  description: TestDescription,
  prompt: vv.val(TestPrompt).optional(),
  prompts: vv.array(vv_TestPromptChange, { min: 0, max: 100 }, ALLOWDUPS).optional(),
}).strict();
const vv_TestUpdateBatch = vv.array(vv_TestUpdate, { min: 1, max: 10000 }, ALLOWDUPS);

class TypeExpression extends PrintableAscii<PublicDisclosure> {
  public constructor(value: string) { super(value, PUBLIC); }
  public min() : number { return 1; }
  public max() : number { return 1000; }
};
// Typical values: "chat/ask", "hello world", "options"
class StringLiteral extends PrintableAscii<PublicDisclosure> {
  public constructor(value: string) { super(value, PUBLIC); }
  public min() : number { return 1; }
  public max() : number { return 1000; }
}
// Typical values: "options", "value", "+GET", "+RET"
const vv_FieldArgument = vv.union([
  vv.enum(['+RO', '+RW', '+GET', '+SET', '+PROP', '+RET']),
  CodingIdentifier,
]);
type CompositeTypeValue = TypeExpression | StringLiteral[] | VVJsonMap<CodingIdentifier, CompositeTypeValue>;
const vv_CompositeType: z.ZodType<CompositeTypeValue> = vv.lazy(() => {
  const enumValues: z.ZodType<StringLiteral[]> = vv.array(StringLiteral, { min: 0, max: 100 }, ALLOWDUPS);
  const namedTuple = vv.recordMap(CodingIdentifier, vv_CompositeType, { min: 0, max: 100 });
  return vv.union([TypeExpression, enumValues, namedTuple]) as z.ZodType<CompositeTypeValue>;
});
const vv_FieldValueShape = { t: vv_CompositeType, mutability: vv.enum(['m', 'x', 'r']).optional() };

const vv_RelationKindDefinition = vv.enum(['OWNS', 'REF', 'UNK']);

const vv_ClassOrigin = vv.object({
  kind: vv.enum(['scan', 'ai', 'user']),
  name: ActorName,
  version: VersionTag,
}).strict();
const vv_FieldType = vv.object({
  arg: vv_FieldArgument,
  ...vv_FieldValueShape,
}).strict();
const vv_CallableFieldType = vv.object({
  arg: vv.union([vv.enum(['+RET']), CodingIdentifier]),
  ...vv_FieldValueShape,
}).strict();
const vv_Overload = vv.object({
  args: vv.array(vv_FieldType, { min: 0, max: 100 }, ALLOWDUPS),
  modifies: vv.val(OverloadSignature).optional(),
}).strict().refine((value) => value.args.every((field, index) => field.arg !== '+RET' || index === 0));
const vv_CallableOverload = vv.object({
  args: vv.array(vv_CallableFieldType, { min: 0, max: 100 }, ALLOWDUPS),
  modifies: vv.val(OverloadSignature).optional(),
}).strict().refine((value) => value.args.every((field, index) => field.arg !== '+RET' || index === 0));
const vv_ClassMember = vv.union([
  vv.object({ name: MemberName, overloads: vv.array(vv_Overload, { min: 0, max: 100 }, ALLOWDUPS), modifies: vv.val(MemberName).optional() }).strict(),
  vv.object({ name: EmptyMemberName, overloads: vv.array(vv_CallableOverload, { min: 1, max: 100 }, ALLOWDUPS), modifies: vv.val(MemberName).optional() }).strict(),
]);
const vv_ClassRelation = vv.object({
  kind: vv_RelationKindDefinition,
  name: vv_RelationName,
  member: vv_CodingIdentifier.optional(),
  target: ClassName,
  many: vv.boolean(),
  modifies: vv_RelationName.optional(),
}).strict();
const vv_ClassUpdate = vv.object({
  name: ClassName,
  renameOf: vv.val(ClassName).optional(),
  state: vv.enum(['partial', 'deleted', 'delegate', 'union', 'alias']).optional(),
  aliasType: vv_CompositeType.optional(),
  usage: vv.enum(['ex', 'dto']).optional(),
  sourceFile: vv.val(SourceFilePath).optional(),
  modifiedAt: vv.val(Timestamp).optional(),
  methods: vv.array(vv_ClassMember, { min: 0, max: 100 }, ALLOWDUPS),
  relations: vv.array(vv_ClassRelation, { min: 0, max: 100 }, ALLOWDUPS),
}).strict().refine((value) => value.state !== 'delegate' || value.methods.length === 1 && value.methods[0]?.name instanceof EmptyMemberName && value.methods[0].overloads.length > 0 && value.relations.length === 0);
const vv_ClassUpdateBatch = vv.object({
  origin: vv_ClassOrigin,
  classes: vv.array(vv_ClassUpdate, { min: 1, max: 100 }, ALLOWDUPS),
}).strict();

function exposeCompositeType(value: CompositeTypeValue): CompositeTypeT {
  if (value instanceof TypeExpression) return value.exposeUnchecked();
  if (Array.isArray(value)) return value.map(item => item.exposeUnchecked());

  const result = new JsonMap<string, CompositeTypeT>();
  for (const [key, nested] of value.entries()) result.set(key.exposeUnchecked(), exposeCompositeType(nested));
  return result;
}

function exposeFieldType(value: z.output<typeof vv_FieldType>): FieldType {
  const arg = typeof value.arg === 'string' ? value.arg : value.arg.exposeUnchecked();
  const result: FieldType = { arg, t: exposeCompositeType(value.t) };
  if (value.mutability) result.mutability = value.mutability;
  return result;
}

function exposeTestUpdateBatch(value: z.output<typeof vv_TestUpdateBatch>): TestDetails[] {
  return value.map((item) => ({
    group: item.group.exposeUnchecked(),
    name: item.name.exposeUnchecked(),
    description: item.description.exposeUnchecked(),
    prompt: item.prompt?.exposeUnchecked() ?? '',
    prompts: (item.prompts ?? []).map((entry) => ({ when: entry.when.exposeUnchecked(), text: entry.text.exposeUnchecked() })),
  }));
}

function exposeClassUpdate(value: z.output<typeof vv_ClassUpdate>): ClassUpdate {
  const result: ClassUpdate = {
    name: value.name.exposeUnchecked(),
    methods: value.methods.map((member) => {
      const result: ClassUpdate['methods'][number] = {
        name: member.name.exposeUnchecked(),
        overloads: member.overloads.map((overload) => {
          const item: ClassUpdate['methods'][number]['overloads'][number] = { args: overload.args.map(exposeFieldType) };
          if (overload.modifies !== undefined) item.modifies = overload.modifies.exposeUnchecked();
          return item;
        }),
      };
      if (member.modifies !== undefined) result.modifies = member.modifies.exposeUnchecked();
      return result;
    }),
    relations: value.relations.map((relation) => {
      const result: ClassUpdate['relations'][number] = {
        kind: relation.kind,
        name: typeof relation.name === 'string' ? relation.name : relation.name.exposeUnchecked(),
        target: relation.target.exposeUnchecked(),
        many: relation.many,
      };
      if (relation.member) result.member = relation.member.exposeUnchecked();
      if (relation.modifies !== undefined) result.modifies = typeof relation.modifies === 'string' ? relation.modifies : relation.modifies.exposeUnchecked();
      return result;
    }),
  };
  if (value.renameOf !== undefined) result.renameOf = value.renameOf.exposeUnchecked();
  if (value.state) result.state = value.state;
  if (value.aliasType !== undefined) result.aliasType = exposeCompositeType(value.aliasType);
  if (value.usage) result.usage = value.usage;
  if (value.sourceFile !== undefined) result.sourceFile = value.sourceFile.exposeUnchecked();
  if (value.modifiedAt !== undefined) result.modifiedAt = value.modifiedAt.exposeUnchecked();
  return result;
}

const vv_RevisionRequest = vv.object({ howFarBack: z.number().int().min(0).max(999) }).strict();

class DuplicateClassError extends Error {}

type ErrorMiddlewareT = (
  error: unknown,
  request: unknown,
  response: Parameters<Parameters<ReturnType<typeof express>['get']>[2]>[1],
  next: (error: unknown) => void) => void;

/**
 * The current snapshot retains per-member provenance so `getClassesHistory`
 * can reconstruct the selected class's history.  `getClasses` is deliberately
 * an inventory endpoint: its class entries must remain the public ClassDetails
 * shape, while the one project-wide latest delta is exposed as `lastChange`.
 */
function classDetailsFromCurrent(value: CurrentClass): ClassDetails {
  const result: ClassDetails = {
    name: value.name,
    methods: value.methods.map((member) => {
      const result: ClassDetails['methods'][number] = {
        name: member.name,
        overloads: member.overloads.map((overload) => overload.args),
      };
      return result;
    }),
    relations: value.relations.map((relation) => {
      const result: ClassDetails['relations'][number] = {
        kind: relation.kind,
        name: relation.name,
        target: relation.target,
        many: relation.many,
      };
      if (typeof relation.member === 'string') result.member = relation.member;
      return result;
    }),
  };
  if (value.state) result.state = value.state;
  if (value.aliasType !== undefined) result.aliasType = value.aliasType;
  if (value.usage) result.usage = value.usage;
  if (value.sourceFile) result.sourceFile = value.sourceFile;
  if (value.modifiedAt) result.modifiedAt = value.modifiedAt;
  return result;
}

const logRequestError: ErrorMiddlewareT = (error, _request, _response, next) => {
  logUnhandledRequestError(error);
  next(error);
};

const respondToRequestError: ErrorMiddlewareT = (error, _request, response, _next) => {
  if (error instanceof Error && 'status' in error && error.status === 413) {
    response.status(413).json({ error: 'Request is too large.' });
  } else if (error instanceof RequestValidationError) {
    const issues = error.issues.map((issue: unknown) => {
      if (typeof issue !== 'object' || issue === null) return { field: 'body', message: 'Invalid value.' };
      const details = issue as { readonly path?: unknown; readonly message?: unknown };
      const path: string = Array.isArray(details.path) ? details.path.map((item: unknown) => String(item)).join('.') : 'body';
      const message: string = typeof details.message === 'string' ? details.message : 'Invalid value.';
      return { field: path || 'body', message };
    });
    response.status(400).json({ error: 'Invalid request.', source: error.source, issues });
  } else if (error instanceof DuplicateClassError || error instanceof InvalidClassRevisionError || (error instanceof SyntaxError && 'status' in error && error.status === 400)) {
    response.status(400).json({ error: 'Invalid request.' });
  } else {
    response.status(500).json({ error: 'Request could not be completed.' });
  }
};

export function createApp(repository: ClassRepository & TestInventoryRepository): ReturnType<typeof express> {
  const app: ReturnType<typeof express> = express();
  app.use(express.json({ limit: '256kb' }));
  app.get('/health', {}, (_request, response) => { response.json({ status: 'ok' }); });
  app.get('/api/getProjects', {}, async (_request, response) => {
    const projectNames: string[] = await repository.getProjects();
    response.json(projectNames);
  });
  app.post('/api/createProject', { body: vv_ProjectName }, async (request, response) => {
    const projectName: string = request.body.projectName.exposeUnchecked();
    await repository.createProject(projectName);
    response.status(201).json({ projectName });
  });
  app.post('/api/:projectName/classesDetails', {
    params: vv_ProjectName,
    body: vv.object({
      classNames: vv.array(vv_CodingIdentifier, { min: 1, max: 100 }, UNIQUE) }) }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const names: string[] = request.body.classNames.map((className) => className.exposeUnchecked());
    const details: ClassDetails[] = await repository.getDetails(projectName, names);
    response.json(details);
  });
  app.get('/api/:projectName/getClasses', { params: vv_ProjectName }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const current: CurrentClass[] = await repository.getClassSnapshots(projectName);
    const names: Set<string> = new Set(current.map((item: CurrentClass) => item.name));
    // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
    const legacy: ClassDetails[] = (await repository.getClasses(projectName)).filter((item: ClassDetails) => !names.has(item.name));
    const exposed: ClassDetails[] = current.map(classDetailsFromCurrent);
    const result: {
      classes: ClassDetails[];
      lastChange?: DatabaseClassChange;
    } = {
      classes: [...legacy, ...exposed].sort((left, right) => left.name.localeCompare(right.name)),
    };
    const lastChange: DatabaseClassChange | undefined = await repository.getLastClassChange(projectName);
    if (lastChange) result.lastChange = lastChange;
    response.json(result);
  });
  app.post('/api/:projectName/getClassesHistory', {
    params: vv_ProjectName,
    body: vv.object({
      classNames: vv.array(vv_CodingIdentifier, { min: 1, max: 100 }, ALLOWDUPS),
    }),
  }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const history: ClassHistory[] = await repository.getClassHistory(projectName, request.body.classNames.map((item) => item.exposeUnchecked()));
    response.json(history.map((item: ClassHistory) => {
      const result: {
        name: string;
        methods: ClassHistory['methods'];
        relations: ClassHistory['relations'];
        renames: ClassHistory['renames'];
        state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
        usage?: 'ex' | 'dto';
      } = {
        name: item.name,
        methods: item.methods,
        relations: item.relations,
        renames: item.renames,
      };
      if (item.state) result.state = item.state;
      if (item.usage) result.usage = item.usage;
      return result;
    }));
  });
  app.post('/api/:projectName/getRevisionIds', {
    params: vv_ProjectName,
    body: vv_RevisionRequest,
  }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const input: z.output<typeof vv_RevisionRequest> = request.body;
    response.json(await repository.getRevisionIds(projectName, input.howFarBack));
  });
  app.post('/api/:projectName/updateClasses', { params: vv_ProjectName, body: vv_ClassUpdateBatch }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    logValueShape('Validated /api/updateClasses body shape', request.body);
    const batch: z.output<typeof vv_ClassUpdateBatch> = request.body;
    if (new Set(batch.classes.map((item) => item.name.exposeUnchecked())).size !== batch.classes.length) logAndThrow(new DuplicateClassError());
    const classes: ClassUpdate[] = batch.classes.map(exposeClassUpdate);
    const origin: ClassOrigin = batch.origin.kind === 'user'
      ? {
        kind: 'user',
        name: 'yariv',
        version: batch.origin.version.exposeUnchecked(),
      }
      : {
        kind: batch.origin.kind,
        name: batch.origin.name.exposeUnchecked(),
        version: batch.origin.version.exposeUnchecked(),
      };
    await repository.updateClassSnapshots(projectName, classes, origin);
    response.json({ updated: classes.length });
  });
  app.get('/api/:projectName/getTests', { params: vv_ProjectName }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const tests: TestRecord[] = await repository.getTests(projectName);
    response.json(tests.map((item: TestRecord) => vv_TestSummary.parse({
      group: item.group,
      name: item.name,
      description: item.description,
      lastChangedAt: item.lastChangedAt,
    })));
  });
  app.post('/api/:projectName/getHistory', { params: vv_ProjectName, body: vv_TestIdentifierList }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const identifiers: TestIdentifier[] = request.body.map((item) => ({
      group: item.group.exposeUnchecked(),
      name: item.name.exposeUnchecked(),
    }));
    response.json((await repository.getHistory(projectName, identifiers)).map((item) => vv_TestHistory.parse(item)));
  });
  app.post('/api/:projectName/updateTests', { params: vv_ProjectName, body: vv_TestUpdateBatch }, async (request, response) => {
    const projectName: string = request.params.projectName.exposeUnchecked();
    const tests: TestDetails[] = exposeTestUpdateBatch(request.body);
    if (new Set(tests.map((item: TestDetails) => `${item.group}.${item.name}`)).size !== tests.length) logAndThrow(new DuplicateClassError());
    await repository.updateTests(projectName, tests);
    response.json({ updated: tests.length });
  });
  app.use(express.trustedMiddleware(logRequestError));
  app.use(express.trustedMiddleware(respondToRequestError));
  return app;
}
