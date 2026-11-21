# Step 29 Summary - Active Editor Presence Notification

## Change

After a client authenticates, the bridge subscribes to VS Code's real active-text-editor change event. Each change sends the unsolicited JSON text message `{ "version": 1, "type": "active_editor_changed", "hasActiveEditor": true|false }` to the connected client. The payload contains no path, filename, content, or request ID, and no initial editor state is sent on connection.

Each client owns its VS Code subscription. The socket close handler disposes it, and extension deactivation disposes remaining subscriptions before terminating clients. Existing single-client authentication and token lifecycle are preserved.

## Files changed

- `src/extension.ts`: subscribe per authenticated client, send the presence event, and dispose the subscription on close/deactivation.
- `tests/suite/extension.active-editor-notification.case.ts`: open and close a real untitled VS Code editor and assert both unsolicited event objects.
- `tests/suite/extension.test.ts`: register the case.
- `docs/application_protocol.md`: document the event and privacy/lifecycle behavior.
- `docs/step_summary_29.md`: this record.

## RED

With only the new test added, `npm run compile` passed all BuildGates and TypeScript. `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration` exited 1 with **21 passing, 1 pending, 1 failing** in authentication. The new test timed out waiting for an editor notification after a real editor was opened. The pending test was the existing Linux HTTPS skip. This was a functional RED.

## GREEN

- `npm run compile`: passed BuildGates, TypeScript and adapter bundling.
- `CODAIGRAM_BRIDGE_CHROMIUM_PATH=/snap/bin/chromium npm run test:integration`: exited 0 across authentication, concurrency and shutdown scenarios using project-local VS Code 1.146.0. Authentication reported **22 passing and 1 pending**, including the real editor open/close event assertions; shutdown reported **4 passing**. Concurrency passed; its count was not captured from the truncated host output.
- `npm run verify`: unavailable because this package has no verify script.

## Limitations

The integration test checks both real editor transitions and closes the authenticated connection; it does not directly instrument VS Code's listener-disposal call. The Linux HTTPS browser case remains pending. Progress documentation was not modified.
