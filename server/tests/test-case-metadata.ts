export interface PromptHistoryEntry {
  when: string;
  text: string;
}

export interface TestCaseMetadata {
  title: string;
  prompt: {
    availability: 'available';
    history: PromptHistoryEntry[];
    [archivedField: string]: unknown;
  };
}
