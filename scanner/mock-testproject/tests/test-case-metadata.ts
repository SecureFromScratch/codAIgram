export type AvailablePromptT = {
  readonly availability: 'available';
  readonly text: string;
};

export type UnavailablePromptT = {
  readonly availability: 'unavailable';
  readonly reason: string;
};

export type TestCaseMetadataT = {
  readonly title: string;
  readonly prompt: AvailablePromptT | UnavailablePromptT;
};
