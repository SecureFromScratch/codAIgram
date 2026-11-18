import { z } from 'zod';
import { ALLOWDUPS, vv } from '@untrust/vv/zod';
import { isFieldType } from '@codaigram/shared/class-types';
import type { FieldType } from '@codaigram/shared/class-types';
import type { ClassRevision, CurrentClass } from './class-revision.js';
import { logAndThrow, logStorageValidationIssues, warnLegacyPartialField } from './server_utils.js';
import { StorageError } from './storage-error.js';
import { ERROR_CODES } from './error-codes.js';

function isBoundedComposite(value: unknown, depth: number): boolean {
  if (typeof value === 'string') return value.length > 0 && value.length <= 1000 && /^[\x20-\x7e]+$/.test(value);
  if (Array.isArray(value)) return value.length <= 100 && value.every((item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 1000 && /^[\x20-\x7e]+$/.test(item));
  if (!value || typeof value !== 'object' || depth >= 20) return false;
  const entries: [unknown, unknown][] = value instanceof Map ? Array.from(value.entries()) : Object.entries(value);
  return entries.length <= 100 && entries.every(([name, item]: [unknown, unknown]) => typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && isBoundedComposite(item, depth + 1));
}

function originDto() { return vv.object({
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  kind: vv.enum(['scan', 'ai', 'user', 'legacy']),
  name: vv.string().min(1).max(100).regex(/^[^\x00-\x1f\x7f]+$/u),
  version: vv.string().min(1).max(100).regex(/^[\x20-\x7e]+$/),
}).strict(); }
const ORIGIN_DTO: ReturnType<typeof originDto> = originDto();
const FIELD_DTO: z.ZodType<FieldType> = z.unknown().transform<FieldType>((input, context) => {
  if (!isFieldType(input) || !input || typeof input !== 'object' || !('arg' in input) || typeof input.arg !== 'string' || input.arg.length > 100 || !/^(?:\+[A-Z]+|[A-Za-z_][A-Za-z0-9_]*)$/.test(input.arg) || !('t' in input) || !isBoundedComposite(input.t, 0)) {
    context.addIssue({ code: 'custom', message: 'Invalid stored field.' });
    return z.NEVER;
  }
  const field: FieldType = input as FieldType;
  const result: FieldType = { arg: field.arg, t: field.t };
  if (field.mutability) result.mutability = field.mutability;
  return result;
});
function argsDto() { return vv.array(FIELD_DTO, { min: 0, max: 100 }, ALLOWDUPS); }
const ARGS_DTO: ReturnType<typeof argsDto> = argsDto();
function storedOverloadDto() { return vv.object({
  args: ARGS_DTO,
  origin: ORIGIN_DTO,
  changedAt: vv.string().min(1).max(100).default('unknown'),
}).strict(); }
const STORED_OVERLOAD_DTO: ReturnType<typeof storedOverloadDto> = storedOverloadDto();
function storedMemberDto() { return vv.object({
  name: vv.string().min(1).max(1000).regex(/^[\x20-\x7e]+$/),
  overloads: vv.array(STORED_OVERLOAD_DTO, { min: 0, max: 100 }, ALLOWDUPS),
  origin: ORIGIN_DTO,
  changedAt: vv.string().min(1).max(100).default('unknown'),
}).strict(); }
const STORED_MEMBER_DTO: ReturnType<typeof storedMemberDto> = storedMemberDto();
function storedRelationDto() { return vv.object({
  kind: vv.enum(['OWNS', 'REF', 'UNK']),
  name: vv.string().max(100).regex(/^(?:[A-Za-z_][A-Za-z0-9_]*)?$/),
  target: vv.string().min(1).max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  many: vv.boolean(),
  origin: ORIGIN_DTO,
  changedAt: vv.string().min(1).max(100).default('unknown'),
}).strict(); }
const STORED_RELATION_DTO: ReturnType<typeof storedRelationDto> = storedRelationDto();
function storedClassDto() { return vv.object({
  name: vv.string().min(1).max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  nonCryptoGuid: z.string().uuid().optional(),
  usage: vv.enum(['ex', 'dto']).optional(),
  sourceFile: vv.string().min(1).max(1024).optional(),
  modifiedAt: vv.string().datetime().optional(),
  methods: vv.array(STORED_MEMBER_DTO, { min: 0, max: 100 }, ALLOWDUPS),
  relations: vv.array(STORED_RELATION_DTO, { min: 0, max: 100 }, ALLOWDUPS),
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  isPartial: vv.boolean().optional(),
  state: vv.enum(['partial', 'deleted']).optional(),
}).strict(); }
const STORED_CLASS_DTO: ReturnType<typeof storedClassDto> = storedClassDto();
function revisionOverloadDto() { return vv.object({ args: ARGS_DTO }).strict(); }
const REVISION_OVERLOAD_DTO: ReturnType<typeof revisionOverloadDto> = revisionOverloadDto();
function revisionMemberDto() { return vv.object({
  name: vv.string().min(1).max(1000).regex(/^[\x20-\x7e]+$/),
  overloads: vv.array(REVISION_OVERLOAD_DTO, { min: 0, max: 100 }, ALLOWDUPS),
}).strict(); }
const REVISION_MEMBER_DTO: ReturnType<typeof revisionMemberDto> = revisionMemberDto();
function revisionRelationDto() { return vv.object({
  kind: vv.enum(['OWNS', 'REF', 'UNK']),
  name: vv.string().max(100).regex(/^(?:[A-Za-z_][A-Za-z0-9_]*)?$/),
  target: vv.string().min(1).max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  many: vv.boolean(),
}).strict(); }
const REVISION_RELATION_DTO: ReturnType<typeof revisionRelationDto> = revisionRelationDto();
function revisionRenameDto() { return vv.object({
  from: vv.string().max(100000),
  to: vv.string().max(100000),
}).strict(); }
const REVISION_RENAME_DTO: ReturnType<typeof revisionRenameDto> = revisionRenameDto();
function classChangeDto() { return vv.object({
  kind: z.literal('class'),
  before: vv.enum(['partial', 'deleted', 'complete']),
  after: vv.enum(['partial', 'deleted', 'complete']),
}).strict(); }
const CLASS_CHANGE_DTO: ReturnType<typeof classChangeDto> = classChangeDto();
function usageChangeDto() { return vv.object({
  kind: z.literal('usage'),
  before: vv.enum(['ex', 'dto', 'none']),
  after: vv.enum(['ex', 'dto', 'none']),
}).strict(); }
const USAGE_CHANGE_DTO: ReturnType<typeof usageChangeDto> = usageChangeDto();
function sourceValueDto() { return vv.object({
  sourceFile: vv.string().max(1024),
  modifiedAt: vv.string().max(100),
}).strict(); }
const SOURCE_VALUE_DTO: ReturnType<typeof sourceValueDto> = sourceValueDto();
function sourceChangeDto() { return vv.object({
  kind: z.literal('source'),
  before: SOURCE_VALUE_DTO,
  after: SOURCE_VALUE_DTO,
}).strict(); }
const SOURCE_CHANGE_DTO: ReturnType<typeof sourceChangeDto> = sourceChangeDto();
function classRenameDto() { return vv.object({
  kind: z.literal('rename'),
  before: vv.string().min(1).max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  after: vv.string().min(1).max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
}).strict(); }
const CLASS_RENAME_DTO: ReturnType<typeof classRenameDto> = classRenameDto();
function memberChangeDto() { return vv.object({
  kind: z.literal('member'),
  before: vv.union([REVISION_MEMBER_DTO, z.literal('absent')]),
  after: vv.union([REVISION_MEMBER_DTO, z.literal('absent')]),
  overloadRenames: vv.array(REVISION_RENAME_DTO, { min: 0, max: 100 }, ALLOWDUPS),
}).strict(); }
const MEMBER_CHANGE_DTO: ReturnType<typeof memberChangeDto> = memberChangeDto();
function relationChangeDto() { return vv.object({
  kind: z.literal('relation'),
  before: vv.union([REVISION_RELATION_DTO, z.literal('absent')]),
  after: vv.union([REVISION_RELATION_DTO, z.literal('absent')]),
}).strict(); }
const RELATION_CHANGE_DTO: ReturnType<typeof relationChangeDto> = relationChangeDto();
function changeDto() { return vv.union([CLASS_CHANGE_DTO, CLASS_RENAME_DTO, USAGE_CHANGE_DTO, SOURCE_CHANGE_DTO, MEMBER_CHANGE_DTO, RELATION_CHANGE_DTO]); }
const CHANGE_DTO: ReturnType<typeof changeDto> = changeDto();
function revisionDto() { return vv.object({
  nonCryptoGuid: z.string().uuid().optional(),
  origin: ORIGIN_DTO,
  when: vv.string().min(1).max(100).default('unknown'),
  changes: vv.array(CHANGE_DTO, { min: 0, max: 201 }, ALLOWDUPS),
}).strict().transform((value) => {
  const result: ClassRevision = {
    origin: value.origin,
    when: value.when,
    changes: value.changes,
  };
  if (value.nonCryptoGuid) result.nonCryptoGuid = value.nonCryptoGuid;
  return result;
}); }
const REVISION_DTO: ReturnType<typeof revisionDto> = revisionDto();
const REVISION_ENVELOPE_DTO: z.ZodType<{ ordinal: number; value: ClassRevision }> = z.object({
  ordinal: z.number().int().positive(),
  value: REVISION_DTO,
}).strict();

export function parseStoredClassSnapshot(input: unknown, documentId: string = ''): CurrentClass {
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  // UNTRUST-ALLOW-NULLISH: Stored values are untrusted and may be null; only inspect the legacy field after verifying the input is a non-null object.
  if (typeof input === 'object' && input !== null && 'isPartial' in input) warnLegacyPartialField('class snapshots', documentId);
  const parsed: z.ZodSafeParseResult<z.output<typeof STORED_CLASS_DTO>> = STORED_CLASS_DTO.safeParse(input);
  if (!parsed.success) {
    logStorageValidationIssues('class snapshot', parsed.error.issues, documentId);
    return logAndThrow(new Error('Stored class snapshot is invalid.'));
  }
  const value: CurrentClass = {
    name: parsed.data.name,
    methods: parsed.data.methods,
    relations: parsed.data.relations,
  };
  if (parsed.data.usage) value.usage = parsed.data.usage;
  if (parsed.data.state) value.state = parsed.data.state;
  // LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
  // REMOVE THIS BACKWARD COMPATIBILITY CODE IF NO PROBLEMS FOUND BY 2020/11/23
  else if (parsed.data.isPartial === true) value.state = 'partial';
  if (parsed.data.nonCryptoGuid) value.nonCryptoGuid = parsed.data.nonCryptoGuid;
  if (parsed.data.sourceFile) value.sourceFile = parsed.data.sourceFile;
  if (parsed.data.modifiedAt) value.modifiedAt = parsed.data.modifiedAt;
  return value;
}

export function parseStoredClassRevision(input: unknown, documentId: string = ''): ClassRevision {
  const parsed: z.ZodSafeParseResult<ClassRevision> = REVISION_DTO.safeParse(input);
  if (!parsed.success) {
    logStorageValidationIssues('class revision', parsed.error.issues, documentId);
    return logAndThrow(new StorageError(ERROR_CODES.CLASS_REVISION_INVALID, 'Stored class revision is invalid.'));
  }
  return parsed.data;
}

export function parseStoredClassRevisionEnvelope(input: unknown, documentId: string = ''): { ordinal: number; value: ClassRevision } {
  const parsed: z.ZodSafeParseResult<{ ordinal: number; value: ClassRevision }> = REVISION_ENVELOPE_DTO.safeParse(input);
  if (!parsed.success) {
    logStorageValidationIssues('class history entry', parsed.error.issues, documentId);
    return logAndThrow(new StorageError(ERROR_CODES.CLASS_REVISION_INVALID, 'Stored class history entry is invalid.'));
  }
  return parsed.data;
}
