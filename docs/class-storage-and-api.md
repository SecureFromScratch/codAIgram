# Class modification storage and API schemas

This document describes the Firestore Native-mode representation used by the
local server and the public class-query responses. It is a persistence and API
contract description, not a browser/client model. Inputs are validated at the
Mandate/VV boundary and persisted values are revalidated before use.

## Storage

`classes_snapshots/{className}` is the current versioned snapshot for a class.
Its `value` contains the current class state:

```text
CurrentClass
  name: string
  nonCryptoGuid?: UUID v4-like identifier; never a secret or security token
  usage?: "ex"
  sourceFile?: string
  modifiedAt?: ISO-8601 string
  state?: "partial" | "deleted"
  methods: CurrentMember[]
  relations: CurrentRelation[]

CurrentMember
  name: string
  overloads: CurrentOverload[]
  origin: Origin
  changedAt: ISO-8601 string | "unknown"

CurrentOverload
  args: FieldType[]
  origin: Origin
  changedAt: ISO-8601 string | "unknown"

CurrentRelation
  kind: "OWNS" | "REF" | "UNK"
  name: string
  target: string
  many: boolean
  origin: Origin
  changedAt: ISO-8601 string | "unknown"

Origin
  kind: "scan" | "ai" | "user" | "legacy"
  name: string
  version: string
```

The origin and `changedAt` fields in a snapshot are internal reconstruction
data. They are not returned in `getClasses.classes`.

Each snapshot document also holds `revisionCount` and, after a rename,
`historyName`. Immutable revision documents live at
`classes_snapshots/{historyName}/revisions/{zero-padded ordinal}`:

```text
ClassRevision
  nonCryptoGuid?: string
  origin: Origin
  when: ISO-8601 string | "unknown"
  changes: ClassChange[]
```

One revision stores the origin and time once for the complete class update.
`ClassChange` is one of:

- `rename`: previous and new class name.
- `class`: state transition among `complete`, `partial`, and `deleted`.
- `usage`: transition between `ex` and `none`.
- `source`: a source-file path change, with previous and new `{ sourceFile, modifiedAt }` context.
- `member`: previous and new member, or `absent`, plus overload rename pairs.
- `relation`: previous and new relation, or `absent`.

Refreshing only `modifiedAt` updates the current snapshot but is not a semantic change: it creates no
revision, does not alter `lastChange`, and is absent from `getClassesHistory`. This preserves the
timestamp for a future git-status-like view without showing an unchanged class as modified.

`classes_metadata/last_class_change` is the one database-wide latest class
change. It stores `origin`, Firestore server `changedAt`, and its complete list
of changed class deltas. `classes_revision_ids` stores version-tag/time pairs
for revision-ID lookups. `classes_class_guids` reserves generated class IDs to
detect collisions. The older `classes` collection is legacy compatibility
storage; it does not contain reconstructed history.

## `GET /api/getClasses`

The response is deliberately an inventory plus the most recent database-wide
change. A class entry has no origin, `changedAt`, revision ordinal, or deleted
member history.

```text
{
  classes: ClassDetails[],
  lastChange?: {
    origin: Origin,
    changedAt: ISO-8601 string,
    classes: LatestClassDelta[]
  }
}

ClassDetails
  name: string
  usage?: "ex"
  sourceFile?: string
  modifiedAt?: ISO-8601 string
  state?: "partial" | "deleted"
  methods: { name: string, overloads: FieldType[][] }[]
  relations: { kind: "OWNS" | "REF" | "UNK", name: string,
               target: string, many: boolean }[]

LatestClassDelta
  name: string
  status: "added" | "modified" | "deleted"
  renameOf?: string
  changes: ClassChange[]
```

`lastChange` is omitted until a changing class update succeeds. A no-op update
and any test-inventory update leave it unchanged. It contains all changes in
the latest batch, not a filtered subset.

## `POST /api/getClassesHistory`

Request:

```json
{ "classNames": ["ClassDetails", "Task"] }
```

The response contains one record for each selected, current class. It is the
only public endpoint for per-class, per-member, and per-overload provenance:

```text
ClassHistory
  name: string
  usage?: "ex"
  state?: "partial" | "deleted"
  renames: { from: string, to: string, origin: Origin, when: string }[]
  methods: HistoryMember[]
  relations: HistoryRelation[]

HistoryMember
  name: string
  status: "active" | "deleted"
  overloads: HistoryOverload[]
  origin: Origin
  changedAt: string
  history: { origin: Origin, when: string, value: Member | "deleted" }[]

HistoryOverload
  args: FieldType[]
  status: "active" | "deleted"
  origin: Origin
  changedAt: string
  history: { origin: Origin, when: string, value: Overload | "deleted" }[]

HistoryRelation
  kind, name, target, many
  status: "active" | "deleted"
  origin: Origin
  changedAt: string
  history: { origin: Origin, when: string, value: Relation | "deleted" }[]
```

Deleted members, overloads, relations, and classes remain available here with
their final deletion event. This lets callers reconstruct every change to the
selected class without making `getClasses` carry historical data for the whole
inventory.
