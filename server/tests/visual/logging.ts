import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOG_PATH: string = path.resolve("logs", "visual-tests.log");

export function initializeVisualLog(): void {
  mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  writeFileSync(LOG_PATH, "", "utf8");
}

export function logVisualEvent(level: string, message: string): void {
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${level} ${message}\n`, "utf8");
}

export function logAndThrow(error: Error): never {
  logVisualEvent("WARN", error.stack ?? error.message);
  // UNTRUST-ALLOW-UNLOGGED-THROW: The visual test logger just recorded this error and its stack in the test log; throwing the same instance lets the test runner report the failure.
  throw error;
}
