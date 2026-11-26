import * as path from "node:path";
import { readFileSync } from "node:fs";

export interface AskAboutContext {
  readonly relatedFile: string;
  readonly relatedClass: string;
  readonly relatedMember: string;
}

export class AskAboutPromptGenerator {
  private readonly template: string;

  public constructor(extensionPath: string, templateOverride?: string) {
    // UNTRUST-ALLOW-NULLISH: An omitted override means production loads the bundled prompt file; an explicitly supplied string, including an empty one, keeps tests independent of filesystem access.
    this.template = templateOverride !== undefined
      ? templateOverride.trimEnd()
      : readFileSync(path.join(extensionPath, "ask_about.prompt"), "utf8").trimEnd();
  }

  public generate(projectName: string, context: AskAboutContext, userPrompt: string): string {
    const projectPrompt: string = this.template.replace(/<projectName>/gu, projectName);
    const focus: string[] = [];
    if (context.relatedFile.length > 0) focus.push(context.relatedFile);
    if (context.relatedClass.length > 0) focus.push(`type ${context.relatedClass}`);
    if (context.relatedMember.length > 0) focus.push(`member ${context.relatedMember}`);
    const focusPrompt: string = focus.length > 0 ? `\nWe are focusing on ${focus.join(" ")}` : "";
    return `${projectPrompt}${focusPrompt}\n\n${userPrompt}`;
  }
}
