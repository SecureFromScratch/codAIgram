import type { ChildProcess } from "node:child_process";

export type CodexHealthEventT = "unexpected_exit";

export class CodexProcessHealth {
  private intentional: "unmarked" | "marked" = "unmarked";
  private notified: "pending" | "reported" = "pending";
  private readonly onExit: () => void;

  public constructor(private readonly child: ChildProcess, private readonly report: (event: CodexHealthEventT) => void) {
    this.onExit = () => {
      if (this.intentional === "unmarked" && this.notified === "pending") {
        this.notified = "reported";
        this.report("unexpected_exit");
      }
    };
    child.once("exit", this.onExit);
    child.once("close", this.onExit);
  }

  public markIntentionalShutdown(): void {
    this.intentional = "marked";
  }

  public dispose(): void {
    this.child.removeListener("exit", this.onExit);
    this.child.removeListener("close", this.onExit);
  }
}
