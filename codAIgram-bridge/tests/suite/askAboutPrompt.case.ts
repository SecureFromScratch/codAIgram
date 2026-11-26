import * as assert from "node:assert";
import { AskAboutPromptGenerator } from "../../src/askAboutPrompt";
import type { AskAboutContext } from "../../src/askAboutPrompt";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "composes analysis-only prompts with project and related source context",
  prompt: {
    availability: "available",
    reason: "Prompt composition is deterministic and tested without invoking Codex.",
    history: [{ when: "2026-11-25", text: "Add project preamble and optional file, class, and member focus to bridge chat prompts." }]
  }
};

export function registerAskAboutPromptCase(): void {
  test(TEST_CASE_METADATA.title, () => {
    const template: string = "This is a question about the code in project <projectName>. You are required to analyze only. No code changes!";
    const generator: AskAboutPromptGenerator = new AskAboutPromptGenerator("", template);
    const noRelatedContext: AskAboutContext = { relatedFile: "", relatedClass: "", relatedMember: "" };
    const completeRelatedContext: AskAboutContext = {
      relatedFile: "src/a.ts",
      relatedClass: "Thing",
      relatedMember: "run"
    };
    const classRelatedContext: AskAboutContext = {
      relatedFile: "",
      relatedClass: "Thing",
      relatedMember: ""
    };
    assert.strictEqual(
      generator.generate("my-project", noRelatedContext, "Explain this."),
      "This is a question about the code in project my-project. You are required to analyze only. No code changes!\n\nExplain this."
    );
    assert.strictEqual(
      generator.generate("my-project", completeRelatedContext, "What does it do?"),
      "This is a question about the code in project my-project. You are required to analyze only. No code changes!\nWe are focusing on src/a.ts type Thing member run\n\nWhat does it do?"
    );
    assert.strictEqual(
      generator.generate("my-project", classRelatedContext, "Explain."),
      "This is a question about the code in project my-project. You are required to analyze only. No code changes!\nWe are focusing on type Thing\n\nExplain."
    );
  });
}
