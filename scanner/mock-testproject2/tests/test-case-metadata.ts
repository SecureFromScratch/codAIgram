export type AvailablePromptT = {
  readonly availability: 'available';
  /** Additional archival fields are retained as data and are not interpreted. */
  readonly [archivedField: string]: unknown;
  readonly history: readonly { readonly when: string; readonly text: string }[];
};

export type UnavailablePromptT = {
  readonly availability: 'unavailable';
  readonly reason: string;
  readonly history: readonly { readonly when: string; readonly text: string }[];
};

export type TestCaseMetadataT = {
  readonly title: string;
  readonly prompt: AvailablePromptT | UnavailablePromptT;
};
