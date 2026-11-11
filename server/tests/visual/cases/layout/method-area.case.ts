import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectDiagram } from '../../support/diagram-inspection.ts';

export const TEST_CASE_METADATA = {
  title: 'keeps method text below the header and within class borders',
  prompt: { availability: 'available', text: 'The text box with the methods text does not overflow into the class name area or outside the class borders.' }
};

export function registerMethodAreaCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const data = await inspectDiagram();
    for (const member of ['addClass', 'addPartialClass', 'connectClasses', 'recalcLayout']) assert.ok(data.bodyValue.includes(member), `${member} is present`);
    assert.ok(!data.bodyValue.includes('OWNS'), 'ownership is not displayed as a method');
    assert.ok(data.bodyText.top >= data.header.bottom, 'body text does not overlap the heading area');
    assert.ok(data.bodyText.left >= data.box.left && data.bodyText.right <= data.box.right, 'body text fits horizontally');
    assert.ok(data.bodyText.bottom <= data.box.bottom, 'body text fits vertically');
  });
}
