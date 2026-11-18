# CodAIgram Bridge - Project Design and Implementation Roadmap

**Project:** CodAIgram Bridge  
**Platform:** VS Code Extension  
**Language:** TypeScript  
**Development methodology:** Incremental Test-Driven Development (RED → GREEN)  
**Current status:** Phase 1, Steps 1–4 implemented

## 1. Project Overview

CodAIgram is a browser-based application for creating, visualizing, and managing software class diagrams.

Users define classes, fields, methods, and relationships through a textual representation. CodAIgram generates diagrams from these definitions.

The application includes an AI chat panel that allows users to interrogate and modify the actual source code associated with their diagrams.

Typical operations include:

- Selecting a field and asking what it is used for.
- Finding references to a class or method.
- Explaining relationships between classes.
- Requesting source-code changes.
- Refactoring implementations.
- Opening referenced files in VS Code.
- Highlighting source definitions.
- Receiving notifications when code changes.

**CodAIgram Bridge** is the VS Code extension that enables this integration.

It connects the publicly hosted CodAIgram browser application to the local VS Code workspace and a dedicated Codex AI agent.

The extension must support both source-code interrogation and modification.

## 2. Architecture

```text
CodAIgram Browser
(Public HTTPS application)
          |
          | WebSocket over localhost
          | One-time token authentication
          |
          v
CodAIgram Bridge
(VS Code Extension)
          |
          +-- Connection Management
          |      +-- Random localhost port
          |      +-- One-time authentication
          |      +-- Persistent WebSocket
          |      +-- Request/response protocol
          |
          +-- Workspace Management
          |      +-- Workspace identification
          |      +-- Project root selection
          |      +-- File change notifications
          |
          +-- IDE Integration
          |      +-- Open source files
          |      +-- Navigate to definitions
          |      +-- Highlight source ranges
          |      +-- Read editor selections
          |
          +-- Codex Client
                 |
                 | JSON-RPC over stdio
                 |
                 v
          Codex App Server
                 |
                 +-- Source inspection
                 +-- Code modification
                 +-- Command execution
                 +-- Test execution
                 +-- Sandbox enforcement
                 +-- Approval handling
```

The extension manages its own Codex App Server instance.

It does not connect to or modify the official Codex VS Code extension.

Each VS Code window runs an independent bridge instance.

The browser-facing protocol must remain independent of Codex-specific implementation details.

## 3. Architectural Decisions

### 3.1 Browser Communication

- WebSocket over localhost.
- Bind exclusively to `127.0.0.1`.
- OS-assigned random listening port.
- One persistent authenticated connection per extension instance.
- Bidirectional communication.
- No REST API beyond what is necessary for the WebSocket upgrade.
- No TLS or custom encryption in the initial version.

The accepted security assumption is that loopback traffic cannot be intercepted or modified by the attacker.

### 3.2 Authentication

Each extension instance generates a cryptographically secure 256-bit token.

The user receives a connection URL:

`http://localhost:<port>/<token>`

CodAIgram converts it to:

`ws://localhost:<port>/<token>`

The token:

- Is validated during the WebSocket handshake.
- Can authenticate exactly one successful connection.
- Is atomically consumed.
- Cannot be reused after disconnection.
- Is never persisted.
- Is never logged.
- Is not transmitted in subsequent WebSocket messages.

The authenticated WebSocket becomes the session.

Reconnection requires generating and copying a new token.

No cookies, persistent authentication credentials, or automatic reconnection are required initially.

The token is not a substitute for Host and Origin validation.

### 3.3 Browser Security

CodAIgram is publicly hosted over HTTPS.

The extension must account for:

- Cross-origin WebSocket connections.
- Local Network Access browser permissions.
- DNS rebinding.
- Cross-site WebSocket hijacking.
- Malicious websites attempting localhost access.
- Unauthorized workspace access.

Required protections include:

- Loopback-only binding.
- Strict Host validation.
- Configurable allowlist of trusted CodAIgram Origins.
- Authentication before WebSocket upgrade completion.
- Strict runtime message validation.
- Workspace-specific authorization.

### 3.4 IDE Integration

Use documented VS Code Extension APIs.

The bridge must eventually support:

- Workspace discovery and identification.
- Opening source files.
- Navigating to source locations.
- Highlighting code.
- Reading current editor selections.
- Receiving editor and file-change events.

Do not implement a separate source-code editor.

### 3.5 Codex Integration

Use a dedicated Codex App Server process.

The extension is responsible for:

- Starting and stopping the process.
- Creating and resuming threads.
- Sending user requests.
- Forwarding streamed events.
- Handling cancellation.
- Forwarding approval requests.
- Selecting appropriate sandbox policies.
- Reporting source-code modifications.

Codex performs actual source inspection, editing, and execution.

The extension must not reimplement these capabilities.

### 3.6 Code Modification Security

Default interrogation operations to read-only.

Use workspace-write for explicitly requested modifications.

Never silently enable unrestricted filesystem access.

Preserve Codex sandbox and approval enforcement.

Do not rely on prompts as security boundaries.

### 3.7 Multiple VS Code Windows

Each VS Code window independently owns:

- Its listening port.
- Its authentication token.
- Its WebSocket connection.
- Its workspace context.
- Its Codex App Server process.

No central discovery service is required.

Users connect CodAIgram to the desired workspace by copying its connection URL.

## 4. Development Methodology - Mandatory

The project must be developed through **very small, independently testable steps**.

A phase is a group of related capabilities, not a single implementation task.

**Never implement an entire phase in one step.**

Each step must introduce the smallest useful behavior that can be verified through automated tests.

### 4.1 Step Selection

Before starting each step:

1. Inspect the existing implementation.
2. Identify the next missing capability in the current phase.
3. Define the smallest independently testable change.
4. Avoid combining unrelated changes.
5. Define explicit acceptance criteria.
6. Delegate implementation only for that step.

A good step changes one observable behavior.

Prefer extending existing code rather than introducing speculative abstractions.

### 4.2 Mandatory RED → GREEN Workflow

Every implementation step must follow this sequence:

**RED**

1. Define the expected behavior.
2. Write or modify automated tests before production code.
3. Compile the tests.
4. Run them against the unchanged implementation.
5. Verify they fail for the expected functional reason.
6. Record the failing test results.

**GREEN**

1. Make the minimum production-code change.
2. Run the tests.
3. Fix implementation defects.
4. Repeat until all tests pass.
5. Run the complete regression suite.

**REVIEW**

1. Review the production changes.
2. Review the tests and their assertions.
3. Verify the RED evidence.
4. Verify the GREEN evidence.
5. Ensure no unrelated functionality was introduced.
6. Report the result.

A test that fails because of a compilation error, broken environment, or invalid test setup does not count as a valid RED result.

Do not weaken tests merely to obtain GREEN.

Do not claim successful TDD without actual RED and GREEN test execution.

### 4.3 Testing Infrastructure

Use the existing VS Code integration test infrastructure based on `@vscode/test-electron`.

Tests must execute against a real VS Code Extension Development Host.

`npm test` must:

- Compile the latest source.
- Start the test VS Code host.
- Load the extension.
- Execute integration tests.
- Shut down the test host.
- Verify cleanup.
- Return a nonzero exit code on failure.

Use unit tests where appropriate, but do not replace integration tests with mocks when behavior depends on the real VS Code runtime.

### 4.4 Delegation and Review

The parent agent acts as technical lead.

The implementation subagent performs the assigned RED → GREEN step.

The parent must:

- Define the next minimal step.
- Delegate implementation.
- Verify test evidence.
- Review code changes.
- Request corrections when needed.
- Report completion.
- Propose the next minimal step.

Do not implement several steps in one delegation.

Do not proceed to another step without user approval.

### 4.5 Phase Progression

**Complete the current phase through successive minimal steps.**

After each completed step:

1. Determine whether the phase's acceptance criteria are satisfied.
2. If not, identify the next smallest missing capability in that phase.
3. If yes, mark the phase complete.
4. Begin the next phase by defining its smallest independently testable first step.
5. Request user approval before implementation.

Do not automatically implement all remaining steps in a phase.

Phase boundaries are checkpoints, not invitations to make large changes.

## 5. Implementation Roadmap

The following phases define the intended progression.

Individual future steps are deliberately not fully specified.

They must be defined incrementally as development proceeds, using the current repository state and the smallest testable change.

---

## Phase 1 - Connection Foundation

**Goal:** Establish a secure, authenticated browser-to-extension WebSocket connection with a usable pairing interface.

### Completed Steps

**Step 1 - Minimal HTTP Listener**

Implemented:

- VS Code extension skeleton.
- Automatic activation.
- HTTP listener on `127.0.0.1:11100`.
- `Hello` response.
- Output channel logging.
- Graceful shutdown.
- Real VS Code integration tests.

**Step 2 - WebSocket Communication**

Implemented:

- WebSocket server using `ws`.
- Initial `Hello` message.
- Persistent connections.
- Client disconnect handling.
- HTTP endpoint behavior.
- WebSocket integration tests.

**Step 3 - Dynamic Port Allocation**

Implemented:

- OS-assigned listening port using port `0`.
- Retrieval of allocated port.
- Exposure of port through the extension activation API.
- Updated dynamic-port integration tests.
- Verification that fixed port `11100` is no longer required.

**Step 4 - One-Time Authentication**

Implemented:

- Cryptographically random 256-bit token.
- Token supplied in WebSocket connection URL.
- Authentication before successful WebSocket upgrade.
- Single-use token enforcement.
- Concurrent authentication protection.
- HTTP 401 rejection for unauthorized connections.
- Integration tests for authentication and token reuse.

The parent agent should inspect the repository and test results to confirm the implemented state. This roadmap records the expected progress; it does not replace verification.

### Remaining Phase 1 Capabilities

Implement through separate minimal steps:

- Display the connection URL inside VS Code.
- Provide a Copy button.
- Display connection status.
- Allow manual token regeneration.
- Generate a new token after disconnection.
- Implement strict Host validation.
- Implement Origin allowlisting.
- Verify browser connection from a publicly hosted HTTPS application.
- Handle connection errors and lifecycle transitions.
- Verify localhost sleep/wake behavior where practical.

Do not bundle all these features into one step.

### Phase 1 Completion Criteria

Phase 1 is complete when:

1. The extension starts on a random localhost port.
2. A cryptographically secure one-time token is generated.
3. The user can see and copy a connection URL from VS Code.
4. CodAIgram or a representative HTTPS test client can establish an authenticated WebSocket connection.
5. The token cannot be reused.
6. Unauthorized Origins and Hosts are rejected.
7. Connection state is displayed.
8. A disconnected session can be replaced using a newly generated token.
9. The extension closes connections and releases its port cleanly.
10. Automated integration tests pass.

---

## Phase 2 - Application Messaging Protocol

**Goal:** Replace the initial `Hello` demonstration with structured, bidirectional application communication.

Future capabilities:

- Versioned JSON message format.
- Request identifiers.
- Request/response correlation.
- Structured errors.
- Runtime schema validation.
- Request timeout handling.
- Asynchronous server-to-browser notifications.
- Concurrent outstanding requests.
- Message size limits.
- Cancellation messages.
- Connection failure handling.

The first step should be the smallest possible meaningful protocol change, such as replacing the literal `Hello` message with a structured JSON welcome message.

Do not implement a complete RPC framework in one step.

### Phase 2 Completion Criteria

The browser can send typed requests, receive correlated responses, receive unsolicited events, and handle errors without message ambiguity.

All protocol boundaries are validated.

---

## Phase 3 - Workspace and IDE Integration

**Goal:** Expose selected VS Code workspace and editor capabilities through the authenticated protocol.

Future capabilities:

- Workspace identification.
- Workspace folder enumeration.
- Active editor information.
- Open source file.
- Reveal source range.
- Highlight source range.
- Read current selection.
- Navigate to source definitions.
- Editor change notifications.
- Source file change notifications.
- Multi-root workspace handling.
- Workspace authorization and path validation.

Implement one IDE operation at a time.

For example, begin with a read-only `workspace.info` request, then progress toward file navigation and editor operations.

### Phase 3 Completion Criteria

CodAIgram can identify the connected workspace and navigate to relevant source code.

The extension can report relevant IDE events.

Unauthorized file and workspace access is rejected.

---

## Phase 4 - Codex App Server Lifecycle

**Goal:** Start and manage a dedicated Codex App Server from the VS Code extension.

Future capabilities:

- Discover the Codex executable.
- Launch Codex App Server.
- Initialize the documented JSON-RPC protocol.
- Detect process health.
- Handle startup failures.
- Stop the managed process.
- Recover from unexpected termination.
- Create Codex threads.
- Resume existing threads.
- Persist conversation-to-thread mappings.

Start with the smallest testable operation, such as launching Codex App Server and verifying a successful protocol initialization.

Use a mock App Server for deterministic tests where useful, supplemented by real integration tests.

Do not implement chat or code modifications in the initial lifecycle step.

### Phase 4 Completion Criteria

The extension can reliably manage Codex App Server processes and conversation threads associated with the selected workspace.

---

## Phase 5 - Source-Code Interrogation

**Goal:** Allow CodAIgram users to ask questions about their project source code.

Future capabilities:

- Submit prompts to Codex.
- Associate questions with structured diagram context.
- Execute read-only turns.
- Receive responses.
- Stream response updates.
- Handle tool execution events.
- Handle errors and cancellation.
- Support multi-turn conversations.
- Return source references.
- Navigate from AI responses to source files.

Start with a single simple prompt and complete response.

Add streaming, structured context, and navigation in subsequent steps.

### Phase 5 Completion Criteria

A user can select a diagram element, ask a question, receive a Codex answer grounded in project source code, and navigate to referenced source locations.

---

## Phase 6 - Source-Code Modification

**Goal:** Allow CodAIgram users to request controlled code modifications.

Future capabilities:

- Explicit modification requests.
- Workspace-write sandbox configuration.
- Codex approval requests.
- Browser approval responses.
- File modification detection.
- Changed-file reporting.
- Diff presentation support.
- Unsaved editor conflict handling.
- Test execution.
- Cancellation of modifying turns.
- Prevention of unsafe automatic retries.

Begin with one minimal, controlled file modification in a test workspace.

Add approvals, reporting, and advanced handling incrementally.

### Phase 6 Completion Criteria

Codex can safely modify project files through explicit requests.

The extension enforces configured sandbox and approval policies, reports modifications, and preserves unsaved user changes.

CodAIgram receives notifications needed to rescan affected source files.

---

## Phase 7 - Production Hardening

**Goal:** Prepare the extension for reliable daily use and distribution.

Future capabilities:

- Full lifecycle and error recovery testing.
- Multiple VS Code window isolation.
- Resource limits and backpressure.
- Browser compatibility testing.
- Windows sleep/wake testing.
- Unexpected process termination.
- Cancellation correctness.
- Security regression testing.
- Structured diagnostic logging.
- VSIX packaging.
- Installation documentation.
- End-to-end acceptance tests.

Use independently testable steps for each reliability or security improvement.

### Phase 7 Completion Criteria

The extension passes its integration and security tests, supports the intended browser and desktop environments, and can be packaged and installed as a VSIX.

---

## 6. Current Development Position

**Current phase:** Phase 1 - Connection Foundation

**Completed:** Steps 1, 2, 3, and 4.

**Next task:** Define the next smallest Step 5 within Phase 1.

The likely next capability is displaying the generated connection URL inside VS Code with a Copy button.

However, inspect the current repository before finalizing the step definition.

Do not begin Phase 2 until all Phase 1 completion criteria have been satisfied.

## 7. Parent Agent Operating Rules

These rules supplement the parent agent instructions already provided.

1. Maintain the overall architecture and roadmap.
2. Work on only one minimal step at a time.
3. Define the step based on actual repository state.
4. Specify tests before implementation.
5. Delegate implementation to the designated coding subagent.
6. Require observable RED results.
7. Require passing GREEN results.
8. Review both tests and production changes.
9. Reject unrelated code changes.
10. Report completed functionality and remaining phase requirements.
11. Request user approval before starting the next step.
12. Continue defining minimal steps until the current phase is complete.
13. After phase completion, start the next phase with its smallest testable step.
14. Never implement an entire phase in one delegation.
15. Never skip RED → GREEN, even for small changes.

Prefer the simplest implementation that satisfies the current step.

Avoid premature frameworks, speculative abstractions, and unrelated cleanup.

If existing code needs refactoring, justify it and preserve observable behavior through regression tests.

## 8. Required Reporting After Every Step

The parent agent must report:

### Step Completed

- Step number and title.
- Behavior added.
- Files changed.

### RED Evidence

- Tests written before implementation.
- Command executed.
- Expected failures observed.

### GREEN Evidence

- Command executed.
- Tests passed and failed.
- Confirmation of real VS Code integration testing.

### Review

- Correctness assessment.
- Security considerations.
- Unexpected changes or limitations.

### Next Step

- Current phase completion status.
- Smallest recommended next step.
- Why it is independently testable.

**Stop after reporting. Wait for explicit user approval before delegating the next implementation step.**

## 9. Final Principle

The project must progress through small, verified improvements:

**Define one behavior → write tests → observe RED → implement minimum change → observe GREEN → review → request approval.**

Repeat until the current phase is complete.

Then begin the next phase with another minimal RED → GREEN step.

The goal is not to implement the architecture as quickly as possible. The goal is to maintain a continuously working, tested extension while introducing one small capability at a time.
