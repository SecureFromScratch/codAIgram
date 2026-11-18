export type PromptHistoryEntry = {
  readonly when: string;
  readonly text: string;
};

export type ScannedTestCase = {
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly prompts: readonly PromptHistoryEntry[];
};

export type TestScanResult = {
  readonly groups: readonly string[];
  readonly cases: readonly ScannedTestCase[];
};
