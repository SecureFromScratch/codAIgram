# CodAIgram Bridge — Revised Implementation Roadmap

This roadmap supersedes the original roadmap's execution order while retaining original phase identifiers for progress and design references. The original scope and phase definitions remain in `design_roadmap-original.md` unless explicitly revised here.

## Implementation order

| Order | Original phase | Scope |
| --- | --- | --- |
| 1 | Phase 1 | Connection Foundation |
| 2 | Phase 2 | Application Messaging Protocol |
| 3 | Phase 4 | Codex App Server Lifecycle |
| 4 | Phase 5 | Source-Code Interrogation |
| 5 | Phase 3 | Workspace and IDE Integration |
| 6 | Phase 6 | Source-Code Modification |
| 7 | Phase 7 | Production Hardening |

## Phase 4 — Minimal Workspace Dependency

Before launching Codex App Server:

- Identify the VS Code workspace associated with the bridge instance.
- Select an explicit working directory.
- Reject ambiguous workspace selection, including unresolved multi-root workspaces.
- Validate that the selected directory belongs to the authorized workspace.
- Associate Codex threads with that workspace.
- Apply appropriate sandbox restrictions.

These are prerequisites for safe Codex integration, not completion of Phase 3.

The initial workspace-root resolver accepts exactly one `file`-scheme workspace folder and returns its VS Code filesystem path. No workspace, multiple folders, and non-file workspace URIs produce distinct errors. Arbitrary virtual filesystem URI paths are not guaranteed to be local operating-system working directories; remote and virtual workspace support requires a separate design. Resolving a path alone does not authorize it, verify it exists, or launch a process.

The separate working-directory validator accepts an already authorized root and an absolute candidate, canonicalizes both using the real filesystem, requires directories, and accepts only the root or a descendant. This rejects symlink escapes at validation time. It does not establish that the supplied root is authorized, prevent filesystem changes after validation, or replace sandbox enforcement; process startup must address those boundaries explicitly.

The launch-directory resolver composes these operations for the current workspace, selecting its single local folder as both root and candidate and returning its canonical directory or the original typed error. It does not start a process; validation remains subject to the filesystem race described above.

Codex discovery searches absolute entries in the extension host's PATH without invoking a shell. On POSIX it requires a regular file with execute permission; on Windows it considers supported PATHEXT executable and command-script extensions and identifies command scripts separately. Discovery checks availability at a point in time; it does not establish executable provenance or start it. Safe Windows command-script invocation and process lifecycle remain separate design work.

The launch specification accepts a native executable and canonical working directory, rejects command scripts, and fixes the App Server transport to stdio with `sandbox_mode="read-only"` and `approval_policy="on-request"` CLI overrides. The [Codex CLI source](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs) defines the stdio transport and [Codex configuration documentation](https://developers.openai.com/codex/config-advanced/) describes `-c` TOML overrides. These startup defaults alone do not prove the effective policy of later RPC requests; lifecycle and request handling must enforce and verify appropriate restrictions separately.

The startup helper uses that specification to spawn the native executable with the explicit working directory, piped standard streams, and no shell. It returns the child process after Node reports a successful spawn, and returns typed errors for invalid launch inputs or process creation failures. Extension activation, protocol initialization, and process management are separate steps.

## Phase 5 — Initial Source-Code Interrogation

Prioritize a minimal end-to-end workflow:

1. Browser submits a prompt through the authenticated WebSocket.
2. Extension forwards the prompt to its dedicated Codex App Server.
3. Codex inspects the selected workspace using read-only permissions.
4. Extension returns the response to the browser.

Implement streaming, cancellation, conversation continuity, and structured diagram context as separate TDD steps. IDE navigation and highlighting are not required for the initial chat milestone.

## Deferred Phase 3 — Workspace and IDE Integration

Implement after the initial browser-to-Codex chat workflow is operational. Retain these capabilities:

- Workspace identification and enumeration.
- Active editor information.
- Open files and reveal source ranges.
- Highlight code and navigate to definitions.
- Read editor selections.
- Editor and source-file change notifications.
- Multi-root workspace handling.
- Workspace authorization and path validation.

Reuse the minimal workspace-selection capability introduced in Phase 4.

## Phase 6 dependency

Do not begin source-code modification until workspace authorization and path validation are sufficient to prevent unauthorized file access.

## Unchanged implementation rules

- Complete Phase 1 and Phase 2 before Codex integration.
- Implement one independently testable behavior per step.
- Follow mandatory RED → GREEN → REVIEW.
- Run real VS Code integration tests where required.
- Preserve one-time authentication, Host validation, and Origin validation.
- Obtain explicit user approval before moving to a new implementation phase. Continue autonomously between steps within the approved phase.
- Never silently weaken Codex sandbox or approval enforcement.

## First major functional milestone

A user can connect the CodAIgram browser to VS Code, ask Codex a question about the selected workspace, and receive a grounded response without requiring IDE navigation features.
