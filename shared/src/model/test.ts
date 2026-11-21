export type PromptHistoryEntryT = { readonly when: string; readonly text: string };

export type ScannedTestCaseT = {
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly prompts: readonly PromptHistoryEntryT[];
}

export type TestScanResultT = {
  readonly groups: readonly string[];
  readonly cases: readonly ScannedTestCaseT[];
}
