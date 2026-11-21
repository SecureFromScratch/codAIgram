import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import { supportsHttpsFixture } from "../httpsSupport";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "disables the certificate fixture on Linux while retaining it on Windows",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "On Linux skip tests requiring a certificate and display a prominent warning; preserve Windows behavior." }]
  }
};

export function registerHttpsSupportCase(): void {
    test(TEST_CASE_METADATA.title, () => {
        assert.strictEqual(supportsHttpsFixture("linux"), false);
        assert.strictEqual(supportsHttpsFixture("win32"), true);
    });
}
