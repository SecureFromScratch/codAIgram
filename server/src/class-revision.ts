import { JsonMap } from '@codaigram/shared/json-map';
import type { ArgsListT, CompositeTypeT, FieldType } from '@codaigram/shared/class-types';
import { logAndThrow } from './server_utils.js';

export class InvalidClassRevisionError extends Error {}

// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
export type OriginKindT = 'scan' | 'ai' | 'user' | 'legacy';

export interface ClassOrigin {
  kind: OriginKindT;
  name: string;
  version: string;
}

export interface OverloadUpdate {
  args: ArgsListT;
  modifies?: string;
}

export interface MemberUpdate {
  name: string;
  overloads: OverloadUpdate[];
  modifies?: string;
}

export interface RelationUpdate {
  kind: 'OWNS' | 'REF' | 'UNK';
  name: string;
  member?: string | undefined;
  target: string;
  // UNTRUST-ALLOW-BOOLEAN: This adapter preserves the existing public class relationship contract's boolean multiplicity when it validates and records revisions.
  many: boolean;
  modifies?: string;
}

export interface ClassUpdate {
  name: string;
  renameOf?: string;
  state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
  aliasType?: CompositeTypeT;
  usage?: 'ex' | 'dto';
  sourceFile?: string;
  modifiedAt?: string;
  methods: MemberUpdate[];
  relations: RelationUpdate[];
}

export interface CurrentOverload {
  args: ArgsListT;
  origin: ClassOrigin;
  changedAt: string;
}

export interface CurrentMember {
  name: string;
  overloads: CurrentOverload[];
  origin: ClassOrigin;
  changedAt: string;
}

export interface CurrentRelation {
  kind: 'OWNS' | 'REF' | 'UNK';
  name: string;
  member?: string | undefined;
  target: string;
  // UNTRUST-ALLOW-BOOLEAN: Current snapshots preserve the class API's existing boolean multiplicity so scanner and editor consumers retain their established contract.
  many: boolean;
  origin: ClassOrigin;
  changedAt: string;
}

export interface CurrentClass {
  name: string;
  nonCryptoGuid?: string;
  usage?: 'ex' | 'dto';
  sourceFile?: string;
  modifiedAt?: string;
  methods: CurrentMember[];
  relations: CurrentRelation[];
  state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
  aliasType?: CompositeTypeT;
}

export interface ClassRenameChange {
  kind: 'rename';
  before: string;
  after: string;
}

export interface ClassRenameHistory {
  from: string;
  to: string;
  origin: ClassOrigin;
  when: string;
}

export type ClassChangeT =
  | ClassRenameChange
  | {
    kind: 'source';
    before: { sourceFile: string; modifiedAt: string };
    after: { sourceFile: string; modifiedAt: string };
  }
  | {
    kind: 'usage';
    before: 'ex' | 'dto' | 'none';
    after: 'ex' | 'dto' | 'none';
  }
  | {
    kind: 'class';
    before: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias' | 'complete';
    after: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias' | 'complete';
  }
  | {
    kind: 'member';
    before: MemberUpdate | 'absent';
    after: MemberUpdate | 'absent';
    overloadRenames: OverloadRename[]
  }
  | {
    kind: 'relation';
    before: RelationUpdate | 'absent';
    after: RelationUpdate | 'absent'
  };

export interface ClassRevision {
  nonCryptoGuid?: string;
  origin: ClassOrigin;
  when: string;
  changes: ClassChangeT[];
}

export interface OverloadRename {
  from: string;
  to: string;
}

export interface HistoryEntry<T> {
  origin: ClassOrigin;
  when: string;
  value: T | 'deleted';
}

export interface HistoryOverload extends CurrentOverload {
  status: 'active' | 'deleted';
  history: HistoryEntry<OverloadUpdate>[];
}

export interface HistoryMember {
  name: string;
  overloads: HistoryOverload[];
  origin: ClassOrigin;
  changedAt: string;
  status: 'active' | 'deleted';
  history: HistoryEntry<MemberUpdate>[];
}

export interface HistoryRelation extends CurrentRelation {
  status: 'active' | 'deleted';
  history: HistoryEntry<RelationUpdate>[];
}

export interface ClassHistory {
  name: string;
  usage?: 'ex' | 'dto';
  methods: HistoryMember[];
  relations: HistoryRelation[];
  state?: 'partial' | 'deleted' | 'delegate' | 'union' | 'alias';
  renames: ClassRenameHistory[];
}

export interface RevisionResult {
  current: CurrentClass;
  changes: ClassChangeT[];
}

function cloneType(type: CompositeTypeT): CompositeTypeT {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return [...type];
  return new JsonMap<string, CompositeTypeT>(Array.from(type.entries(), ([name, value]) => [name, cloneType(value)]));
}

export function cloneClassSnapshot(value: CurrentClass): CurrentClass {
  const result: CurrentClass = {
    name: value.name,
    methods: value.methods.map((member: CurrentMember) => {
      const copy: CurrentMember = {
        name: member.name,
        changedAt: member.changedAt || 'unknown',
        origin: {
          kind: member.origin.kind,
          name: member.origin.name,
          version: member.origin.version
        },
        overloads: member.overloads.map((overload: CurrentOverload) => ({
          changedAt: overload.changedAt || 'unknown',
          origin: {
            kind: overload.origin.kind,
            name: overload.origin.name,
            version: overload.origin.version
          },
          args: overload.args.map((field: FieldType) => {
            const result: FieldType = { arg: field.arg, t: cloneType(field.t) };
            if (field.mutability) result.mutability = field.mutability;
            return result;
          }),
        })),
      };
      return copy;
    }),
    relations: value.relations.map((relation: CurrentRelation) => {
      const copy: CurrentRelation = {
        kind: relation.kind,
        name: relation.name,
        target: relation.target,
        many: relation.many,
        changedAt: relation.changedAt || 'unknown',
        origin: {
          kind: relation.origin.kind,
          name: relation.origin.name,
          version: relation.origin.version
        },
      };
      if (typeof relation.member === 'string') copy.member = relation.member;
      return copy;
    }),
  };
  if (value.usage) result.usage = value.usage;
  if (value.state) result.state = value.state;
  if (value.aliasType !== undefined) result.aliasType = cloneType(value.aliasType);
  if (value.nonCryptoGuid) result.nonCryptoGuid = value.nonCryptoGuid;
  if (value.sourceFile) result.sourceFile = value.sourceFile;
  if (value.modifiedAt) result.modifiedAt = value.modifiedAt;
  return result;
}

export function overloadText(args: ArgsListT): string {
  return args.map((field) => `${field.arg}: ${typeof field.t === 'string' ? field.t : canonicalJson(field.t)}`).join(', ');
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(input: unknown): string {
  if (typeof input === 'string') return JSON.stringify(input);
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  if (!input) return 'null';
  if (Array.isArray(input)) return `[${input.map(canonicalJson).join(',')}]`;
  if (typeof input !== 'object') return JSON.stringify(String(input));
  const entries: [string, unknown][] = input instanceof Map ? Array.from(input.entries()) : Object.entries(input);
  entries.sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([name, value]) => `${JSON.stringify(name)}:${canonicalJson(value)}`).join(',')}}`;
}

function memberValue(member: CurrentMember): MemberUpdate {
  return {
    name: member.name,
    overloads: member.overloads.map((item: CurrentOverload) => ({ args: item.args })),
  };
}

function relationValue(relation: CurrentRelation | RelationUpdate): RelationUpdate {
  const result: RelationUpdate = {
    kind: relation.kind,
    name: relation.name,
    target: relation.target,
    many: relation.many,
  };
  if (typeof relation.member === 'string') result.member = relation.member;
  return result;
}

function currentOverloads(updates: readonly OverloadUpdate[], previous: readonly CurrentOverload[], origin: ClassOrigin, when: string): CurrentOverload[] {
  const used: Set<string> = new Set<string>();
  const names: Set<string> = new Set<string>();
  return updates.map((update: OverloadUpdate) => {
    const name: string = overloadText(update.args);
    const oldName: string = update.modifies ?? name;
    if (names.has(name) || used.has(oldName)) logAndThrow(new InvalidClassRevisionError('Duplicate overload.'));
    names.add(name);
    used.add(oldName);
    const requested: CurrentOverload | undefined = previous.find((item: CurrentOverload) => overloadText(item.args) === oldName);
    const old: CurrentOverload | undefined = requested ?? (typeof update.modifies === 'string' ? previous.find((item: CurrentOverload) => overloadText(item.args) === name) : requested);
    if (typeof update.modifies === 'string' && !old) logAndThrow(new InvalidClassRevisionError('Modified overload does not exist.'));
    if (typeof update.modifies === 'string' && requested && name !== oldName && previous.some((item: CurrentOverload) => overloadText(item.args) === name)) logAndThrow(new InvalidClassRevisionError('Overload signature already exists.'));
    const unchanged: boolean = !!old && sameValue(old.args, update.args);
    return {
      args: old && unchanged ? old.args : update.args,
      origin: old && unchanged ? old.origin : origin,
      changedAt: old && unchanged ? old.changedAt || 'unknown' : when,
    };
  });
}

export function reviseClass(update: ClassUpdate, previous: CurrentClass | undefined, origin: ClassOrigin, when: string = new Date().toISOString()): RevisionResult {
  const changes: ClassChangeT[] = [];
  if (previous && previous.name !== update.name) changes.push({
    kind: 'rename',
    before: previous.name,
    after: update.name,
  });
  const oldMembers: readonly CurrentMember[] = previous?.methods ?? [];
  const oldRelations: readonly CurrentRelation[] = previous?.relations ?? [];
  const usedMembers: Set<string> = new Set<string>();
  const usedRelations: Set<string> = new Set<string>();
  const memberNames: Set<string> = new Set<string>();
  const relationNames: Set<string> = new Set<string>();
  const methods: CurrentMember[] = update.methods.map((member: MemberUpdate) => {
    const oldName: string = member.modifies ?? member.name;
    if (memberNames.has(member.name) || usedMembers.has(oldName)) logAndThrow(new InvalidClassRevisionError('Duplicate class member.'));
    memberNames.add(member.name);
    usedMembers.add(oldName);
    const requested: CurrentMember | undefined = oldMembers.find((item: CurrentMember) => item.name === oldName);
    const old: CurrentMember | undefined = requested ?? (member.modifies ? oldMembers.find((item: CurrentMember) => item.name === member.name) : requested);
    if (member.modifies && !old) logAndThrow(new InvalidClassRevisionError('Modified class member does not exist.'));
    if (member.modifies && requested && member.name !== oldName && oldMembers.some((item: CurrentMember) => item.name === member.name)) logAndThrow(new InvalidClassRevisionError('Class member name already exists.'));
    const requestedMember: MemberUpdate = {
      name: member.name,
      overloads: member.overloads.map((item: OverloadUpdate) => ({ args: item.args })),
    };
    if (member.modifies && !requested && old && !sameValue(memberValue(old), requestedMember)) logAndThrow(new InvalidClassRevisionError('Modified class member does not exist.'));
    if (old) usedMembers.add(old.name);
    const overloads: CurrentOverload[] = currentOverloads(member.overloads, old?.overloads ?? [], origin, when);
    const changed: boolean = !old || old.name !== member.name || !sameValue(old.overloads.map((item: CurrentOverload) => item.args), overloads.map((item: CurrentOverload) => item.args));
    const current: CurrentMember = {
      name: member.name,
      overloads,
      origin: old && !changed ? old.origin : origin,
      changedAt: old && !changed ? old.changedAt || 'unknown' : when,
    };
    if (changed) changes.push({
      kind: 'member',
      before: old ? memberValue(old) : 'absent',
      after: memberValue(current),
      overloadRenames: member.overloads.filter((item: OverloadUpdate) => typeof item.modifies === 'string').map((item: OverloadUpdate) => ({ from: item.modifies!, to: overloadText(item.args) })),
    });
    return current;
  });
  oldMembers.forEach((member: CurrentMember) => {
    if (!usedMembers.has(member.name)) changes.push({
      kind: 'member',
      before: memberValue(member),
      after: 'absent',
      overloadRenames: []
    });
  });
  const relations: CurrentRelation[] = update.relations.map((relation: RelationUpdate) => {
    const oldName: string = relation.modifies ?? relation.name;
    if (relationNames.has(relation.name) || usedRelations.has(oldName)) logAndThrow(new InvalidClassRevisionError('Duplicate class relationship.'));
    relationNames.add(relation.name);
    usedRelations.add(oldName);
    const requested: CurrentRelation | undefined = oldRelations.find((item: CurrentRelation) => item.name === oldName);
    const old: CurrentRelation | undefined = requested ?? (typeof relation.modifies === 'string' ? oldRelations.find((item: CurrentRelation) => item.name === relation.name) : requested);
    if (typeof relation.modifies === 'string' && !old) logAndThrow(new InvalidClassRevisionError('Modified class relationship does not exist.'));
    if (typeof relation.modifies === 'string' && requested && relation.name !== oldName && oldRelations.some((item: CurrentRelation) => item.name === relation.name)) logAndThrow(new InvalidClassRevisionError('Class relationship name already exists.'));
    if (typeof relation.modifies === 'string' && !requested && old && !sameValue(relationValue(old), relationValue(relation))) logAndThrow(new InvalidClassRevisionError('Modified class relationship does not exist.'));
    if (old) usedRelations.add(old.name);
    const changed: boolean = !old || !sameValue(relationValue(old), relationValue(relation));
    const current: CurrentRelation = {
      kind: relation.kind,
      name: relation.name,
      target: relation.target,
      many: relation.many,
      origin: old && !changed ? old.origin : origin,
      changedAt: old && !changed ? old.changedAt || 'unknown' : when,
    };
    if (typeof relation.member === 'string') current.member = relation.member;
    if (changed) changes.push({
      kind: 'relation',
      before: old ? relationValue(old) : 'absent',
      after: relationValue(current)
    });
    return current;
  });
  oldRelations.forEach((relation: CurrentRelation) => {
    if (!usedRelations.has(relation.name)) changes.push({
      kind: 'relation',
      before: relationValue(relation),
      after: 'absent'
    });
  });
  if (previous && previous.usage !== update.usage) changes.push({
    kind: 'usage',
    before: previous.usage ?? 'none',
    after: update.usage ?? 'none',
  });
  // A file timestamp is freshness metadata for future git-status-like views, not a semantic class change.
  if (previous && previous.sourceFile !== update.sourceFile) changes.push({
    kind: 'source',
    before: {
      sourceFile: previous.sourceFile ?? '',
      modifiedAt: previous.modifiedAt ?? '',
    },
    after: {
      sourceFile: update.sourceFile ?? '',
      modifiedAt: update.modifiedAt ?? '',
    },
  });
  if (previous && previous.state !== update.state) changes.push({
    kind: 'class',
    before: previous.state ?? 'complete',
    after: update.state ?? 'complete'
  });
  const current: CurrentClass = {
    name: update.name,
    methods: methods,
    relations: relations,
  };
  if (update.usage) current.usage = update.usage;
  if (update.state) current.state = update.state;
  if (update.aliasType !== undefined) current.aliasType = cloneType(update.aliasType);
  if (previous?.nonCryptoGuid) current.nonCryptoGuid = previous.nonCryptoGuid;
  if (update.sourceFile) current.sourceFile = update.sourceFile;
  if (update.modifiedAt) current.modifiedAt = update.modifiedAt;
  return { current, changes };
}

export function rebuildClassHistory(current: CurrentClass, revisions: readonly ClassRevision[]): ClassHistory {
  const methods: Map<string, HistoryMember> = new Map<string, HistoryMember>();
  const relations: Map<string, HistoryRelation> = new Map<string, HistoryRelation>();
  const renames: ClassHistory['renames'] = [];
  revisions.forEach((revision: ClassRevision) => {
    const when: string = revision.when || 'unknown';
    revision.changes.forEach((change: ClassChangeT) => {
      if (change.kind === 'rename') {
        renames.push({
          from: change.before,
          to: change.after,
          origin: revision.origin,
          when,
        });
        return;
      }
      if (change.kind === 'class' || change.kind === 'usage' || change.kind === 'source') return;
      if (change.kind === 'relation') {
        const before: RelationUpdate | 'absent' = change.before;
        const after: RelationUpdate | 'absent' = change.after;
        const oldName: string = before === 'absent' ? '' : before.name;
        const value: RelationUpdate = after === 'absent' ? before as RelationUpdate : after;
        const existing: HistoryRelation | undefined = relations.get(before === 'absent' ? value.name : oldName);
        const history: HistoryEntry<RelationUpdate>[] = existing ? existing.history : [];
        history.push({
          origin: revision.origin,
          when,
          value: after === 'absent' ? 'deleted' : after
        });
        if (existing && existing.name !== value.name) relations.delete(existing.name);
        relations.set(value.name, {
          kind: value.kind,
          name: value.name,
          target: value.target,
          many: value.many,
          origin: revision.origin,
          changedAt: when,
          status: after === 'absent' ? 'deleted' : 'active',
          history,
        });
        if (typeof value.member === 'string') {
          const storedRelation: HistoryRelation | undefined = relations.get(value.name);
          if (storedRelation) storedRelation.member = value.member;
        }
        return;
      }
      const before: MemberUpdate | 'absent' = change.before;
      const after: MemberUpdate | 'absent' = change.after;
      const oldName: string = before === 'absent' ? '' : before.name;
      const value: MemberUpdate = after === 'absent' ? before as MemberUpdate : after;
      const existing: HistoryMember | undefined = methods.get(before === 'absent' ? value.name : oldName);
      const member: HistoryMember = existing ?? {
        name: value.name,
        origin: revision.origin,
        changedAt: when,
        status: 'active',
        history: [],
        overloads: [],
      };
      if (existing && existing.name !== value.name) methods.delete(existing.name);
      member.name = value.name;
      member.origin = revision.origin;
      member.changedAt = when;
      member.status = after === 'absent' ? 'deleted' : 'active';
      member.history.push({
        origin: revision.origin,
        when,
        value: after === 'absent' ? 'deleted' : after
      });
      const remaining: Set<string> = new Set<string>();
      if (after !== 'absent') after.overloads.forEach((overload: OverloadUpdate) => {
        const name: string = overloadText(overload.args);
        const rename: OverloadRename | undefined = change.overloadRenames.find((item: OverloadRename) => item.to === name);
        const oldOverload: HistoryOverload | undefined = member.overloads.find((item: HistoryOverload) => overloadText(item.args) === (rename ? rename.from : name));
        if (!oldOverload) {
          member.overloads.push({
            args: overload.args,
            origin: revision.origin,
            changedAt: when,
            status: 'active',
            history: [{
              origin: revision.origin,
              when,
              value: { args: overload.args },
            }]
          });
        } else {
          remaining.add(overloadText(oldOverload.args));
          if (oldOverload.status === 'deleted' || !sameValue(oldOverload.args, overload.args)) {
            oldOverload.args = overload.args;
            oldOverload.origin = revision.origin;
            oldOverload.changedAt = when;
            oldOverload.status = 'active';
            oldOverload.history.push({
              origin: revision.origin,
              when,
              value: { args: overload.args },
            });
          }
        }
        remaining.add(name);
      });
      member.overloads.forEach((overload: HistoryOverload) => {
        if (overload.status === 'active' && !remaining.has(overloadText(overload.args))) {
          overload.status = 'deleted';
          overload.origin = revision.origin;
          overload.changedAt = when;
          overload.history.push({ origin: revision.origin, when, value: 'deleted' });
        }
      });
      methods.set(value.name, member);
    });
  });
  const result: ClassHistory = {
    name: current.name,
    methods: Array.from(methods.values()),
    relations: Array.from(relations.values()),
    renames,
  };
  if (current.usage) result.usage = current.usage;
  if (current.state) result.state = current.state;
  return result;
}
