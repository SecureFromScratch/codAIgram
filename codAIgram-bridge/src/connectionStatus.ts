import type * as vscode from "vscode";

export class ConnectionStatus {
    constructor(private readonly item: vscode.StatusBarItem) {
        this.item.text = "$(debug-disconnect) CodAIgram: Disconnected";
        this.item.show();
    }

    connected(): void {
        this.item.text = "$(plug) CodAIgram: Connected";
    }

    disconnected(): void {
        this.item.text = "$(debug-disconnect) CodAIgram: Disconnected";
    }

    dispose(): void {
        this.item.dispose();
    }
}
