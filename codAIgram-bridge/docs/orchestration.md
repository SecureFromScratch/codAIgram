# CodAIgram Bridge orchestration

## Scope and roles

The technical lead maintains project design and progress documentation, defines the smallest independently testable step, and delegates implementation and testing to the Luna worker. All modifications, including temporary files, remain inside codAIgram-bridge. Request human approval if a change outside the project is required.

## Step workflow

1. Define one step in the current phase with precise acceptance criteria.
2. Delegate it to Luna. Require tests first, an observed functional RED, minimal implementation, and a passing full GREEN suite.
3. Use the project-local VS Code 1.146.0 managed by @vscode/test-electron for integration tests.
4. Require docs/step_summary_XX.md with changed files, tests, RED and GREEN commands and results, counts, and deviations.
5. Read the summary. On success, accept the reported results without independently reviewing code, tests, or rerunning tests. Update implementation_progress.md and design documentation as needed.
6. Continue with the next minimal step in the current phase. Request human approval before starting a new phase.

## Failure handling

When a Luna implementation step fails, delegate diagnosis to a subagent.

- If the subagent diagnoses the cause, delegate a fix to a subagent.
- If subagent diagnosis fails, the technical lead diagnoses the failure. If the lead cannot diagnose it, request human assistance.
- If the fix succeeds, resume the step workflow and continue to the next step.
- If the fix fails a second time, stop and request human assistance.

Record failures, diagnoses, corrections, and test evidence in the relevant step summary. Do not claim RED for compilation, environment, or test setup failures.
