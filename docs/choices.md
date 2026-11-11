# Choices and driving reasons

| Area | Choice | Reason and status |
| --- | --- | --- |
| Source of truth | In-memory class document | Retains class definitions when the editor shows only a selection or is empty; graph and editor are views. Implemented locally. |
| Frontend | React, TypeScript, CodeMirror 6 | Component and editor transaction model; implemented. |
| Graph | JointJS Community | Graph model and rendering fit a projection adapter; implemented for this preview. Review MPL obligations before distribution. |
| Parser | Lezer | Incremental editor parsing is the target; the first preview uses a small standalone parser. Exact grammar remains open. |
| Collaboration | Yjs text plus separate visual overrides | Designed for concurrent text and layout state; planned, not implemented. |
| Backend | Mandate Express with VV boundaries and a Firestore repository | Typed, validated HTTP routes; Firestore is currently emulator-only. WebSocket collaboration is planned. |
| AI | Server-side revision-checked DSL proposals | Limits trust and protects concurrent edits; planned. |
| Invalid text | Last valid graph with a diagnostic | Supports ordinary incomplete edits; implemented for recognized errors. |
| tldraw | Architectural reference, not dependency | Its editor boundaries are useful; the attached research flags licensing and model fit. |

Authentication, cloud deployment, the exact grammar, offline support, AI approval policy, and layout engine remain open. The current Firestore emulator data is temporary and does not persist user edits. Before implementation, decide and record a design and verify current licenses. The attached research report motivated these choices; recommendations in it are future-facing, not claims that those capabilities exist today.
