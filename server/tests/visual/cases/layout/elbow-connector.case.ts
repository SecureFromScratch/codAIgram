import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses, VISUAL_CLASSES } from "../../test-support.js";

export const TEST_CASE_METADATA = {
  title: "routes class connectors with right-angle elbows",
  prompt: {
    history: [
      { when: "2026/11/15 23:42", text: "add a test - connectors of type elbow lines (assuming that is supported by the graph lib)." },
    ],
  },
};

export function registerElbowConnectorCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES.map((item) => item.name === "ClassDiagram" ? { ...item, name: "AClassDiagram" } : item));
    await page.reload();
    const line: import("playwright").Locator = page.locator('.joint-link path[joint-selector="line"]');
    await line.waitFor();
    const points: { x: number; y: number }[] = await line.evaluate((element: SVGPathElement) => {
      const path: string = element.getAttribute("d") ?? "";
      const commands: string[] = path.match(/[A-Za-z][^A-Za-z]*/g) ?? [];
      if (commands.some((command: string) => !/^[ML]/i.test(command.trim()))) return [];
      return commands.map((command: string) => {
        const coordinates: number[] = (command.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        return { x: coordinates[0] ?? NaN, y: coordinates[1] ?? NaN };
      });
    });
    assert.ok(points.length >= 3, "the connector should have at least one elbow");
    for (let index: number = 1; index < points.length; index += 1) {
      const previous: { x: number; y: number } = points[index - 1]!;
      const current: { x: number; y: number } = points[index]!;
      assert.ok(previous.x === current.x || previous.y === current.y, "every connector segment should be horizontal or vertical");
    }
  });
}
