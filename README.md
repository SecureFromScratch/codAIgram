# codAIgram

A text-first diagram editor. The initial preview has a CodeMirror editor and a JointJS canvas; editing the heading, members, or `OWNS name: Type[]` relationship updates the projection. Invalid headings or relationships retain the last valid diagram. Content is local to the browser and is not saved.

## Run locally

See [local startup and setup](docs/startup.md) for prerequisites, Firestore emulator setup, seeding, server and client startup, and troubleshooting. Update that guide when startup requirements change.

`GET /api/getClasses` returns every `{ name, methods, relations, isPartial }` class detail. `POST /api/classesDetails` accepts JSON `{ "classNames": ["ClassDiagram", "Class"] }` for a bounded named lookup; unknown class names are omitted and requested order is preserved. Each member is `{ name, overloads }`, where `overloads` is an `ArgsList` of `{ arg, t }` fields. A composite `t` is either a type-expression string or a recursively keyed object. Method fields use their parameter name as `arg`; variable and property members use one marker field: `+RO`, `+RW`, `+GET`, `+SET`, or `+PROP` (getter and setter). Relations have `kind`, `name`, `target`, and `many`.

See [current design](docs/current-design.md) for scope and [choices](docs/choices.md) for future design decisions.
"# codAIgram" 
# codAIgram
