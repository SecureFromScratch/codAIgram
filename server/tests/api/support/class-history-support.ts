import assert from 'node:assert/strict';
import type { Server } from 'node:net';
import { createApp } from '../../../dist/app.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { loggedFetch } from '../../../dist/server_utils.js';
import type { ClassUpdate, MemberUpdate, OverloadUpdate, RelationUpdate } from '../../../dist/class-revision.js';

export type OriginT = {
  kind: 'scan' | 'ai' | 'user';
  name: string;
  version: string
};
export type OverloadT = {
  args: { arg: string; t: string }[];
  origin: OriginT;
  modifies?: string
};
export type MemberT = {
  name: string;
  overloads: OverloadT[];
  origin: OriginT;
  modifies?: string
};
export type RelationT = {
  kind: 'OWNS' | 'REF';
  name: string;
  target: string;
  // UNTRUST-ALLOW-BOOLEAN: The tested relationship DTO intentionally preserves the established boolean multiplicity at the API boundary instead of changing the client contract.
  many: boolean;
  origin: OriginT;
  modifies?: string
};
export type ClassDtoT = {
  name: string;
  methods: MemberT[];
  relations: RelationT[];
  state?: 'partial' | 'deleted';
};
export type CurrentClassDtoT = {
  name: string;
  methods: {
    name: string;
    overloads: { arg: string; t: string }[][];
  }[];
  relations: {
    kind: 'OWNS' | 'REF';
    name: string;
    target: string;
    many: boolean;
  }[];
  state?: 'partial' | 'deleted';
};
export type ChangeT = { origin: OriginT; when: string };
export type HistoryMemberT = Omit<MemberT, 'overloads'> & {
  status: 'active' | 'deleted';
  history: ChangeT[];
  overloads: (OverloadT & { status: 'active' | 'deleted'; history: ChangeT[] })[]
};
export type HistoryRelationT = RelationT & { status: 'active' | 'deleted'; history: ChangeT[] };
export type ClassHistoryT = {
  name: string;
  methods: HistoryMemberT[];
  relations: HistoryRelationT[]
};

export const SCAN: OriginT = {
  kind: 'scan',
  name: 'scanner-os-user',
  version: 'scan-v1'
};
export const AI: OriginT = { kind: 'ai', name: 'assistant', version: 'ai-v2' };
export const USER: OriginT = {
  kind: 'user',
  name: 'yariv',
  version: '2026-11-15T09:35:00Z'
};

export async function runWithServer(run: (base: string) => Promise<void>): Promise<void> {
  const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(new MemoryClassRepository([])).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address: ReturnType<Server['address']> = server.address();
  assert.ok(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}/api/mock-project`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve())); }
}

export async function update(base: string, value: ClassDtoT, origin: OriginT): Promise<void> {
  const snapshot: ClassUpdate = {
    name: value.name,
    methods: value.methods.map(({ name, overloads, modifies }) => {
      const member: MemberUpdate = {
        name,
        overloads: overloads.map(({ args, modifies: previous }) => {
          const overload: OverloadUpdate = { args };
          if (typeof previous === 'string') overload.modifies = previous;
          return overload;
        }),
      };
      if (typeof modifies === 'string') member.modifies = modifies;
      return member;
    }),
    relations: value.relations.map(({ kind, name, target, many, modifies }) => {
      const relation: RelationUpdate = { kind, name, target, many };
      if (typeof modifies === 'string') relation.modifies = modifies;
      return relation;
    }),
  };
  const wire: { name: string; methods: MemberUpdate[]; relations: RelationUpdate[]; state?: 'partial' | 'deleted' } = {
    name: snapshot.name,
    methods: snapshot.methods,
    relations: snapshot.relations,
  };
  if (value.state) wire.state = value.state;
  const response: Response = await loggedFetch(`${base}/updateClasses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, classes: [wire] }),
  });
  assert.equal(response.status, 200);
}

export function initial(): ClassDtoT {
  return {
    name: 'Notebook',
    methods: [
      {
        name: 'title',
        origin: SCAN,
        overloads: [{ args: [{ arg: '+RO', t: 'string' }], origin: SCAN }]
      },
      {
        name: 'find',
        origin: SCAN,
        overloads: [{ args: [{ arg: 'name', t: 'string' }], origin: SCAN }]
      },
    ],
    relations: [{
      kind: 'OWNS',
      name: 'pages',
      target: 'Page',
      many: true,
      origin: SCAN
    }],
  };
}

export function classData(value: ClassDtoT): CurrentClassDtoT {
  return {
    name: value.name,
    methods: value.methods.map((member) => ({
      name: member.name,
      overloads: member.overloads.map((overload) => overload.args),
    })),
    relations: value.relations.map((relation) => ({
      kind: relation.kind,
      name: relation.name,
      target: relation.target,
      many: relation.many,
    })),
  };
}

