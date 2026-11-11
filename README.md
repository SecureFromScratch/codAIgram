# codAIgram

A text-first diagram editor. The initial preview has a CodeMirror editor and a JointJS canvas; editing the heading, members, or `OWNS name: Type[]` relationship updates the projection. Invalid headings or relationships retain the last valid diagram. Content is local to the browser and is not saved.

## Run locally

See [local startup and setup](docs/startup.md) for prerequisites, Firestore emulator setup, seeding, server and client startup, and troubleshooting. Update that guide when startup requirements change.

`POST /api/detailsClasses` accepts JSON `{ "classNames": ["ClassDiagram", "Class"] }` and returns a JSON array of `{ name, methods, relations, isPartial }`. Relations have `kind`, `name`, `target`, and `many`; unknown class names are omitted and requested order is preserved. Names are validated and each request is limited to 100 names.

See [current design](docs/current-design.md) for scope and [choices](docs/choices.md) for future design decisions.
"# codAIgram" 
# codAIgram
