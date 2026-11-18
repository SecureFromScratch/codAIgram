import type { TestChange, TestDetails, TestHistory, TestRecord } from './memory-repository.js';

export function updateTestRecord(test: TestDetails, previous: TestRecord | undefined): TestRecord {
  const when: string = new Date().toISOString();
  const prompts: TestChange[] = previous ? structuredClone(previous.prompts) : [];
  const known: Set<string> = new Set(prompts.map((item: TestChange) => JSON.stringify([item.when, item.text])));
  (test.prompts ?? []).forEach((item: TestChange) => {
    const key: string = JSON.stringify([item.when, item.text]);
    if (!known.has(key)) {
      known.add(key);
      prompts.push({ when: item.when, text: item.text });
    }
  });
  if (test.prompt && (!previous || previous.prompt !== test.prompt) && !(test.prompts ?? []).some((item: TestChange) => item.text === test.prompt)) {
    prompts.push({ when, text: test.prompt });
  }
  if (previous && previous.description === test.description && previous.prompt === test.prompt && prompts.length === previous.prompts.length) return structuredClone(previous);
  return {
    group: test.group,
    name: test.name,
    description: test.description,
    prompt: test.prompt,
    lastChangedAt: when,
    prompts,
    descriptions: previous && previous.description === test.description ? previous.descriptions : [...(previous?.descriptions ?? []), { when, text: test.description }],
  };
}

export function testRecordHistory(record: TestRecord): TestHistory {
  return structuredClone({
    group: record.group,
    name: record.name,
    prompts: record.prompts,
    descriptions: record.descriptions,
  });
}
