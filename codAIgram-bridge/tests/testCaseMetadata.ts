export interface TestCaseMetadata {
  title: string;
  prompt: TestCasePrompt;
}

interface TestCasePrompt {
  availability: string;
  reason?: string;
  history: PromptHistoryEntry[];
}

interface PromptHistoryEntry {
  when: string;
  text: string;
}
