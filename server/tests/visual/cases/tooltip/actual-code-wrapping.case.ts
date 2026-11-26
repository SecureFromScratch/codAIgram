import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ClassDetails } from "../../../../dist/memory-repository.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { page, setVisualClasses } from "../../test-support.js";
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge } from "../../support/mock-bridge.js";

type VisualLineT = {
  readonly text: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly left: number;
};

type WrappedLineT = {
  readonly source: string;
  readonly firstContentLeft: number;
  readonly spaceWidth: number;
  readonly rows: readonly VisualLineT[];
};

type ActualCodeLayoutT = {
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly bodyIndent: number;
  readonly lines: readonly WrappedLineT[];
};

const CLASS_NAME: string = "WrappedSource";
const WORKSPACE_ROOT: string = resolve("codAIgram-bridge/tests/mock-get-code-project-one");
const ACTUAL_SOURCE: string = [
  "class WrappedSource {",
  "  public readonly description: string = \"This sentence has many words and should wrap at the nearest previous space instead of overflowing past the tooltip edge\";",
  "  public readonly identifier: string = \"ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ\";",
  "}",
].join("\n");

const CLASS: ClassDetails = {
  name: CLASS_NAME,
  methods: [{ name: "run", overloads: [[]] }],
  relations: [],
  sourceFile: "src/wrapped-source.ts",
  modifiedAt: "2026-11-22T09:00:00.000Z",
};

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "wraps long fetched source lines and indents continuation lines in the class tooltip",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/25 00:00",
        text: "add a visual test: if class's fetched code has lines exceeding the tooltips width, those lines are warpped - lines are cut at nearest previous space (word wrapping) or at character if not possible. wrapped lines are indented on more level then the line they are for (indent level can be determined by indent after opening brace, if existing, defaulting to 3 spaces.",
      },
    ],
  },
};

export function registerActualCodeWrappingCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([CLASS]);
    await page.reload();

    const className: Locator = page.locator(`[data-class-name="${CLASS_NAME}"] text[joint-selector="headerText"]`);
    await className.waitFor();
    await className.click({ button: "right" });
    await page.getByRole("menu", { name: "Class actions" })
      .getByRole("menuitemcheckbox", { name: "Show actual code" })
      .click();

    const mockBridge = await startMockBridgeWithFolders([
      { name: "mock-get-code-project-one", uri: pathToFileURL(WORKSPACE_ROOT).href, index: 0 },
    ], 0, [], [{
      projectName: "mock-project",
      expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, "/")],
      filepath: CLASS.sourceFile ?? "",
      typeName: CLASS_NAME,
      code: ACTUAL_SOURCE,
    }]);

    try {
      await page.evaluate(async (connectionUrl: string) => {
        const app: { connectToVscodeBridge?: (url: string) => Promise<void> } | undefined =
          (window as Window & { __app?: { connectToVscodeBridge?: (url: string) => Promise<void> } }).__app;
        const connect: ((url: string) => Promise<void>) | undefined = app?.connectToVscodeBridge;
        if (!connect) throw new Error("The development bridge connection hook is unavailable.");
        await connect(connectionUrl);
      }, mockBridge.connectionUrl);
      await page.waitForFunction(() => (window as Window & { __app?: { isVscodeBridgeConnected?: () => boolean } }).__app?.isVscodeBridgeConnected?.() === true);
      await page.mouse.move(0, 0);
      await className.hover();

      const tooltip: Locator = page.getByRole("tooltip");
      const codeBlock: Locator = tooltip.locator("pre.actual-code-snippet");
      await codeBlock.waitFor();
      assert.equal(await codeBlock.textContent(), ACTUAL_SOURCE);

      const layout: ActualCodeLayoutT = await codeBlock.evaluate((element: HTMLElement): ActualCodeLayoutT => {
        const sourceElements: readonly HTMLElement[] = Array.from(element.querySelectorAll<HTMLElement>(".actual-code-line"));
        const sourceLines: readonly string[] = sourceElements.map((line: HTMLElement) => line.textContent ?? "");
        const firstBodyLineIndex: number = sourceLines.findIndex((line: string, index: number) =>
          index > 0 && sourceLines[index - 1]?.includes("{") && line.trim().length > 0,
        );
        const firstBodyLine: string = sourceLines.at(firstBodyLineIndex) ?? "";
        const bodyIndent: number = /^ */u.exec(firstBodyLine)?.[0].length ?? 3;
        const measuredLines: WrappedLineT[] = sourceElements.map((lineElement: HTMLElement, lineIndex: number): WrappedLineT => {
          const line: string = sourceLines[lineIndex] ?? "";
          const textNode: ChildNode | null = lineElement.firstChild;
          if (!textNode || textNode.nodeType !== Node.TEXT_NODE) throw new Error("Expected each source line to contain one text node.");
          const rows: { text: string; startIndex: number; endIndex: number; left: number; top: number }[] = [];
          let firstContentLeft: number = Number.NaN;
          let spaceWidth: number = Number.NaN;
          for (let characterIndex: number = 0; characterIndex < line.length; characterIndex += 1) {
            const range: Range = document.createRange();
            range.setStart(textNode, characterIndex);
            range.setEnd(textNode, characterIndex + 1);
            const rect: DOMRect = range.getBoundingClientRect();
            const character: string = line[characterIndex] ?? "";
            const row: { text: string; startIndex: number; endIndex: number; left: number; top: number } | undefined = rows.at(-1);
            if (row && Math.abs(row.top - rect.top) < 1) {
              row.text += character;
              row.endIndex = characterIndex;
            } else {
              rows.push({ text: character, startIndex: characterIndex, endIndex: characterIndex, left: rect.left, top: rect.top });
            }
            if (!Number.isFinite(firstContentLeft) && character.trim().length > 0) firstContentLeft = rect.left;
            if (!Number.isFinite(spaceWidth) && character === " " && rect.width > 0) spaceWidth = rect.width;
          }
          return {
            source: line,
            firstContentLeft,
            spaceWidth,
            rows: rows.map((row) => ({ text: row.text, startIndex: row.startIndex, endIndex: row.endIndex, left: row.left })),
          };
        });
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          bodyIndent,
          lines: measuredLines,
        };
      });

      const descriptionLine: WrappedLineT | undefined = layout.lines.find((line: WrappedLineT) => line.source.includes("description:"));
      const identifierLine: WrappedLineT | undefined = layout.lines.find((line: WrappedLineT) => line.source.includes("identifier:"));
      assert.ok(descriptionLine);
      assert.ok(identifierLine);
      assert.ok(layout.clientWidth > 0);
      assert.ok(
        layout.scrollWidth <= layout.clientWidth,
        `long source lines must wrap inside the tooltip width (scrollWidth=${layout.scrollWidth}, clientWidth=${layout.clientWidth})`,
      );
      assert.ok(descriptionLine.rows.length > 1, "the line with spaces must wrap");
      assert.ok(identifierLine.rows.length > 1, "the long unbroken identifier must wrap at character boundaries");
      const longIdentifier: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const longIdentifierStart: number = identifierLine.source.indexOf(longIdentifier);
      const longIdentifierEnd: number = longIdentifierStart + longIdentifier.length - 1;
      const identifierRows: readonly VisualLineT[] = identifierLine.rows.filter((row: VisualLineT) => row.endIndex >= longIdentifierStart && row.startIndex <= longIdentifierEnd);
      assert.ok(longIdentifierStart >= 0 && identifierRows.length > 1, "the unbroken identifier itself must split at character boundaries");

      const continuationIndent: number = layout.bodyIndent * (descriptionLine.spaceWidth || 1);
      const wrappedLines: readonly WrappedLineT[] = [descriptionLine, identifierLine];
      wrappedLines.forEach((line: WrappedLineT) => {
        const firstRow: VisualLineT | undefined = line.rows.at(0);
        assert.ok(firstRow);
        line.rows.slice(1).forEach((row: VisualLineT) => {
          assert.ok(row.left >= line.firstContentLeft + continuationIndent - 1, "wrapped continuation lines must be indented one additional body-indent level");
        });
      });

      for (let rowIndex: number = 1; rowIndex < descriptionLine.rows.length; rowIndex += 1) {
        const previousRow: VisualLineT | undefined = descriptionLine.rows[rowIndex - 1];
        const currentRow: VisualLineT | undefined = descriptionLine.rows[rowIndex];
        assert.ok(previousRow && currentRow);
        const previousCharacter: string = descriptionLine.source[previousRow.endIndex] ?? "";
        const currentCharacter: string = descriptionLine.source[currentRow.startIndex] ?? "";
        assert.ok(/\s/u.test(previousCharacter) || /\s/u.test(currentCharacter), "word wrapping should break at a nearby space when one is available");
      }
    } finally {
      await page.reload();
      await stopMockBridge(mockBridge.process);
      removeMockBridgeConfig(mockBridge.configPath);
    }
  });
}
