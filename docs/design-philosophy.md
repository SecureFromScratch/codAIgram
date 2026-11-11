# Design philosophy

Use one canonical in-memory document representation. The editor displays selected class definitions, and valid edits update the document; the graph is a projection of that document. Hiding editor text is not deletion. Preserve the author's text and invalid drafts; future graph edits should use targeted, revision-aware operations. Separate the model from renderer, React, transport, and AI.

Follow OWASP Untrust's boundary-first philosophy: validate untrusted input, make invalid states difficult to express, make privilege explicit, and prevent unsafe patterns with build gates. Use tldraw as architectural inspiration for clean boundaries between editor, state, rendering, and interaction; do not copy its implementation without a license review.
