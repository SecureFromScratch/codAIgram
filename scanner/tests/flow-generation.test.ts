import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

type FlowCallT = {
  readonly call: string;
  readonly subcalls?: readonly FlowCallT[];
  readonly recursiveCall?: readonly string[];
};

type TestFlowT = {
  readonly testname: string;
  readonly calls: readonly FlowCallT[];
};

function scan(rootPath: string, logPath: string): void {
  execFileSync(process.execPath, [
    path.resolve('dist/index.js'),
    'flow-fixture',
    rootPath,
    '--types',
    'test',
    '--logfile',
    logPath,
  ], { stdio: 'pipe' });
}

function allCalls(calls: readonly FlowCallT[]): readonly FlowCallT[] {
  return calls.flatMap((call: FlowCallT) => [call, ...allCalls(call.subcalls ?? [])]);
}

test('test scans generate and refresh bounded recursive call-flow JSON beside each case file', () => {
  const temporaryDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-flow-generation-'));
  const casesDirectory: string = path.join(temporaryDirectory, 'cases');
  const groupPath: string = path.join(temporaryDirectory, 'model.test.ts');
  const casePath: string = path.join(casesDirectory, 'sample.case.ts');
  const flowPath: string = path.join(casesDirectory, 'sample.case.flow.json');
  const logPath: string = path.join(temporaryDirectory, 'scanner.log');
  mkdirSync(casesDirectory);
  writeFileSync(groupPath, 'export {};\n', 'utf8');
  writeFileSync(casePath, [
    "declare function it(name: string, callback: () => void): void;",
    "export const TEST_CASE_METADATA = { title: 'records a recursive call flow', prompt: { availability: 'available', history: [] } };",
    'function rootCall(): void { innerCall(); }',
    'function innerCall(): void { rootCall(); }',
    'export function registerCase(): void { it(TEST_CASE_METADATA.title, () => { rootCall(); }); }',
  ].join('\n'), 'utf8');

  try {
    scan(temporaryDirectory, logPath);
    const firstFlow: TestFlowT = JSON.parse(readFileSync(flowPath, 'utf8')) as TestFlowT;
    assert.equal(firstFlow.testname, 'records a recursive call flow');
    assert.deepEqual(firstFlow.calls, [{
      call: 'rootCall',
      subcalls: [{
        call: 'innerCall',
        subcalls: [{ call: 'rootCall', recursiveCall: ['rootCall'] }],
      }],
    }]);

    writeFileSync(casePath, [
      "declare function it(name: string, callback: () => void): void;",
      "export const TEST_CASE_METADATA = { title: 'records a recursive call flow', prompt: { availability: 'available', history: [] } };",
      'function rootCall(): void { changedCall(); }',
      'function changedCall(): void { rootCall(); }',
      'export function registerCase(): void { it(TEST_CASE_METADATA.title, () => { rootCall(); }); }',
    ].join('\n'), 'utf8');

    scan(temporaryDirectory, logPath);
    const updatedFlow: TestFlowT = JSON.parse(readFileSync(flowPath, 'utf8')) as TestFlowT;
    assert.deepEqual(allCalls(updatedFlow.calls).map((call: FlowCallT) => call.call), ['rootCall', 'changedCall', 'rootCall']);
    assert.deepEqual(allCalls(updatedFlow.calls).at(-1)?.recursiveCall, ['rootCall']);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
