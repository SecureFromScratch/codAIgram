import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { page } from "../../test-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "records browser logAndThrow failures in the visual test log",
  prompt: {
    availability: "available",
    text: "Make browser-side visual test errors use the client logAndThrow and capture browser console output in a file for later inspection.",
  },
};

export function registerBrowserErrorLoggingCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await assert.rejects(
      page.evaluate(() => window.logAndThrow(new Error("visual logging probe"))),
      /visual logging probe/,
    );
    const logContents: string = readFileSync("logs/visual-tests.log", "utf8");
    assert.match(logContents, /WARNING Error: visual logging probe/);
  });
}
