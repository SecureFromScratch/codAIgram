# codAIgram agent guidance

Read the documents in `docs/` before making architectural changes. The in-memory document is the source of truth; the editor shows selected class definitions and the renderer graph is a projection, not canonical state. Never discard hidden classes when the editor is empty. Treat user content as untrusted, render text as text, keep boundaries validated through Mandate and VV, and enforce authorization server-side before adding document access or collaboration. Keep client and domain logic independent of rendering. Run `npm run verify`. The current parser is deliberately provisional; do not imply it implements the future DSL. Update the design docs when decisions change. Do not copy tldraw implementation code without reviewing its license.

Keep `docs/startup.md` current whenever local prerequisites, emulator setup, seeding, startup, or test commands change.
