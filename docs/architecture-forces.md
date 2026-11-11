# Architecture forces

- Users need direct text editing and a visual representation without competing sources of truth; the editor may show only a subset of the in-memory document.
- Incomplete text is normal during editing, so the canvas should retain the last valid model and identify that it is stale.
- Collaboration requires convergent shared text, but convergence alone does not validate application semantics or authorize access.
- Visual positions and routes should survive separately from semantic text.
- AI output is untrusted and can become stale while a request is running.
- Extensible diagrams must not let user content instantiate arbitrary classes, execute code, or inject HTML.
- Licensing, maintainability, and an eventual move from one server to multiple servers constrain library and transport choices.
