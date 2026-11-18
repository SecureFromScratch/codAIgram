# Current design

`GET /api/getClasses` returns `{ classes, lastChange }`. `lastChange` contains
`origin` (kind, name, and version) and `changedAt`, the database-wide time of
the latest class update that changed data. It is omitted until such a change
has been recorded; older stored classes do not by themselves establish this
metadata. No-op class updates and test-inventory updates do not change it.
Firestore records the change time at commit and stores the metadata in the
same transaction as the class updates.

The latest tracked update also has `lastChange.classes`: one entry per changed
class, with its name, `added`, `modified`, or `deleted` status, and the revision deltas.
Member deltas include before and after overloads and explicit overload renames;
relationship and class-property deltas use the same revision representation.
Older stored metadata may lack this list. A class can be renamed by supplying
`renameOf` with its previous name. Its prior names remain reserved, its class
ID stays unchanged, and the history response lists rename events. A complete
update with `state: "deleted"` marks the class deleted and retains its history.
When a legacy-only class is renamed or deleted, the server records a baseline
with origin kind `legacy`, name `unknown`, version `legacy`, and time `unknown`.
The subsequent change records the actual origin and time. This preserves the
old data without inventing provenance that was never stored.

When the client loads this latest delta, added or changed members are shown in
blue. Members deleted by that same delta remain visible temporarily with a
strikethrough. This is an inventory-change indicator, not editor text state;
the next changing batch replaces it.

New class snapshots have an internal `nonCryptoGuid`, which is copied into
new revision records. It is a non-cryptographic identifier, never an access
token. Firestore reserves each generated identifier transactionally and rejects
collisions. Legacy snapshots acquire an identifier on their next update; older
revision records remain readable without one and are not rewritten.

The client has Classes and Tests modes. Classes is a browser-local editing session: CodeMirror holds the text; a small pure parser produces a semantic diagram; a JointJS adapter renders it. A heading names each class; classes are separated by blank lines, and properties have required types. Method declarations start with exactly two spaces; while their parentheses are open they may continue on lines indented at least four spaces. Tabs do not count as indentation. Whitespace around method parameters and relationship punctuation is accepted. The editor scrolls horizontally instead of visually wrapping. The diagram shows method names, with signatures and parameter types in hover tooltips. `OWNS`, `REF`, and `UNK` use `KIND field: Type[]` declarations. `OWNS` creates a target class and a labelled connector with a filled owner-side diamond and a `*` at a many-valued target; `REF` is a directed reference; `UNK` is a dashed unknown connection. Relationship declarations are not method rows. Invalid method edits retain the last valid graph; recoverable relationship edits update the graph with a diagnostic. This is a provisional grammar, not the complete language. Text and graph are not saved. The canvas is read-only and no AI, authentication or collaboration is implemented. Tests has no text editor: its left pane reads the persisted tests inventory and presents a tree of test groups and cases. Its right pane is deliberately a placeholder until a test-flow or sequence-diagram design is chosen.

The client uses a swappable object model, `Model.current`, as its in-memory class inventory. Each model stores `ClassDetails` in a map keyed by class name. `Model.parse` converts one class description to `ClassDetails` or returns an error. Server loading initializes a model; valid editor changes update only the classes described, retaining all other classes. Model updates record per-class attribute history and emit filtered change events. `initClasses` reconciles a complete server inventory and emits removal events for classes no longer present. The editor and graph remain UI projections, and an empty editor does not erase the model. The current syntax, recoverable ownership editing, and editor highlighting are defined in [class-diagram-dsl.md](class-diagram-dsl.md).

The Mandate Express server provides `GET /health`, `GET /api/getClasses` for the complete class inventory, `POST /api/classesDetails` for a bounded list of class names, `POST /api/updateClasses` for complete class snapshots, and `POST /api/getClassesHistory` for their histories. A versioned update carries one originator (`scan`, `ai`, or `user`, plus a name and a version tag) for the entire batch. Method overloads are objects containing an `args` array of `{ arg, t }` fields; a composite `t` is either a type-expression string, an inline enum array, or a recursively keyed object. Method fields use parameter names; variables and properties use exactly one `+RO`, `+RW`, `+GET`, `+SET`, or `+PROP` marker and carry the member type. The server validates the batch, rejects duplicate class names, and applies it atomically. It responds with `{ "updated": number }`.

`getClasses.classes` contains only public class details; it deliberately excludes per-member origins and change times. Its single `lastChange` value contains the database-wide origin, server time, and the complete delta list for only the latest changing batch. A free-text version tag is not assumed to be a timestamp. Identical updates retain the existing data, provenance, timestamps, and revision count. An optional `modifies` identifies the previous member or relationship by name, or an overload by its flattened argument text. Omitted items are detected as deletions. `getClassesHistory` accepts `{ "classNames": [...] }` and includes active and deleted items, their prior values, originators, and change times. Current snapshots and per-update delta documents are stored separately; each delta records its originator and time once. Previously stored, unversioned class documents remain readable through the legacy shape, but do not have invented provenance or class history. A new versioned update creates versioned history from that point onward. The detailed storage and response schemas are in [class-storage-and-api.md](class-storage-and-api.md).

The server also provides `POST /api/updateTests`, `GET /api/getTests`, and `POST /api/getHistory` for the scanner's test inventory and its separate prompt and description history. `getTests` does not return prompts. The scanner reads the timestamped `prompt.history` entries; archival metadata fields are not interpreted. The repository uses a Firestore Native-mode emulator. The server currently requires a loopback emulator, not a cloud database, and does not implement authentication or authorization. Consequently submitted originators are not authenticated and this local-only API must not be exposed publicly. The manual workbench starts an unseeded emulator and persists its local export under `.workbench/firestore`; ordinary API and browser tests use deterministic in-memory repositories, while Firestore integration tests create and clean up their own test data. At startup the client retrieves the complete inventory, derives the initial editor text from its first class, and projects every returned class. Editor edits are not automatically saved. Vite proxies API requests during local development. Run instructions are in the root README. Local packages are built and staged by bootstrap; application builds invoke both general and React gates.

Example update request body (one to 100 classes):

```json
{
  "origin": {
    "kind": "scan",
    "name": "scanner-user",
    "version": "scan-1"
  },
  "classes": [
    {
      "name": "Example",
      "methods": [
        {
          "name": "run",
          "overloads": [{ "args": [{ "arg": "value", "t": "string" }] }]
        }
      ],
      "relations": [
        { "kind": "OWNS", "name": "items", "target": "Item", "many": true }
      ]
    }
  ]
}
```

Each update replaces the complete stored class, not just selected fields. The request body is limited to 256 KiB; each class has at most 100 methods and 100 relations. The endpoint is intended for the existing local-only development server and is not safe to expose publicly without authentication, authorization, and browser request protections.
# Development commands

The development client exposes `window.__app.selectClass(name)` and
`window.__app.getSelection()` once the class workspace has loaded. Selection
uses the same application action as the graph and replaces the visible editor
selection. The hook is unavailable in production builds and is removed when
the workspace unmounts. Visual tests use it to prepare editor state without
clicking the graph. The selection action can also serve a future command
palette; the hook itself is a development interface, not that palette.

