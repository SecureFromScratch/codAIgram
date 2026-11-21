import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import type { Server } from 'node:net';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';
import { loggedFetch } from '../../dist/scanner_utils.js';
import type { ClassDetails, CompositeTypeT } from '@codaigram/shared/class-types';
import { JsonMap } from '@codaigram/shared/json-map';

export const TEST_CASE_METADATA = {
  title: 'uploads every scanned member and unknown reference relationship',
  prompt: {
    availability: 'available',
    old: 'Scan mock TypeScript declarations with fields, accessors, single and overloaded methods, upload them, and assert classesDetails returns every member and UNK reference relationship.'
  ,
    history: [
      { when: "2026/11/16 00:00", text: "add a server test - calling getRevisionIds(howFarBack) - returns a reverse datetime ordered list of the revision names stored when updates were perrformed. combine this either as part-of or right-after the tests performing an updateClasses to se if the new revision id is returned. howFarBack of 0 returns latest revision id. after you have theses new tests, add logic to test this also with the mock project tests in scanner." },
      { when: "2026/11/15 09:35", text: "in the scanner's mock-project (for testing) - add mock src files - one defining a class, another an interface.\nadd scanner tests that check that scanner executed with --types class find those mock interfaces and classes and add them to the server (you get them back using classesDetails).\nin the mock sources make sure that the one of the interfaces has a member variable referencing a single other class.\nmake sure one of the classes has 3 member variables: one referencing a single interface, another referencing multiple classes (i.e. an array), a third refeerencing multiple interfaces using a non-array multiple holding container (list, queue, etc).\nthe test checks that reference types default to 'UNK' (short for unknown) for now." },
      { when: "2026/11/15 09:35", text: "i think the scanner's class scanning tests are misdefined, methods section should also include public attributes, especially readonly.\na public attribute will not have () after its name.\nchange ClassDetails format - methods should be an array of\n{\n  name: string,\n  overloads: string[]\n}\noverloads is the args list of a single method, no parantheses, separated by comma.\nspecial values for overload strings:\n\"+READONLY\" - read only public variable member,\n \"+MUTABLE\" - mutable member var\n\"+GET\" - has a getter\n\"+SET\" - has a setter.\nadjust the interface of ClassDetails, tests" },
      { when: "2026/11/15 09:35", text: "1\\) make sure the api tests try to updateClasses with a mix of single-overload-method, several-overloaded method, radonly variable ,mutable variable, property with get+set\n\nTest that returned classes contain all information updated.\n\n2\\) make sure api tests for updating classes succeed.\n\n3\\) make sure scanner update classes test stores all information ion server and retrieves it back" },
      { when: "2026/11/15 09:35", text: "mock-project for scanner slightlty changes:\n\n&#x20;limits: {\\\n&#x20;     // this is a comment to ensure comments are ignored\\\n&#x20;     limitType: 'none' | 'count' | 'size';\\\n&#x20;     maximum: number;\\\n&#x20;   };\n\n(used to only have maximum\n\n---\n\nexec scanner tests. they should fail because data tests expect differs from actual mock project data" },
      { when: "2026/11/16 09:35", text: "mock-testproject now has a new class-details.ts file with more types. update tests:\n\n1) scan tests should detect these type in testproject but not in testproject2\n2) relations field in ClassDetails contains a comment and relations contains a complext type that is not an interface - make sure the scan correctly analyzes and filters the type, AFAIK it should be an entry under the \"methods\" array, with a single overload representing a complex field type (CompositeTypeT).\n3) when testproject2 is scanned all of the types in this file should be marked as delete." },
      { when: "2026/11/17 09:35", text: "mock-testproject2 now defines an evolved ClassDetails declaration. Change scan tests to reflect the change, ensure getClasses returns all modifications, ensure getClassesHistory returns all modifications, and document the class modification database and response schemas." },
    ],
  }
};

const EXPECTED_DETAILS: readonly ClassDetails[] = [
  { name: 'AssigneeContract', methods: [], relations: [], },
  { name: 'ChildTask', methods: [], relations: [], },
  { name: 'Queue', methods: [], relations: [], },
  {
    name: 'ClassDetails',
    methods: [
      { name: 'name', overloads: [[{ arg: '+RW', t: 'string' }]] },
      { name: 'usage', overloads: [[{ arg: '+RW', t: "'ex'" }]] },
      { name: 'sourceFile', overloads: [[{ arg: '+RW', t: 'string' }]] },
      { name: 'modifiedAt', overloads: [[{ arg: '+RW', t: 'string' }]] },
      { name: 'methods', overloads: [[{ arg: '+RW', t: 'ClassMember[]' }]] },
      {
        name: 'relations',
        overloads: [[{
          arg: '+RW',
          t: "{ kind: 'OWNS' | 'REF' | 'UNK'; name: string; target: string; many: boolean; }[]"
        }]]
      },
      { name: 'state', overloads: [[{ arg: '+RW', t: ['partial', 'deleted'] }]] }
    ],
    relations: [{ kind: 'UNK', name: 'methods', target: 'ClassMember', many: true }],
  },
  {
    name: 'ClassMember',
    methods: [
      { name: 'name', overloads: [[{ arg: '+RW', t: 'string' }]] },
      { name: 'overloads', overloads: [[{ arg: '+RW', t: 'ArgsListT[]' }]] }
    ],
    relations: [{ kind: 'UNK', name: 'overloads', target: 'ArgsListT', many: true }],
  },
  {
    name: 'FieldType',
    methods: [
      { name: 'arg', overloads: [[{ arg: '+RW', t: 'string' }]] },
      { name: 't', overloads: [[{ arg: '+RW', t: 'CompositeTypeT' }]] },
      { name: 'mutability', overloads: [[{ arg: '+RW', t: ['m', 'x', 'r'] }]] }
    ],
    relations: [{ kind: 'UNK', name: 't', target: 'CompositeTypeT', many: false }],
  },
  {
    name: 'Task',
    methods: [
      { name: 'contract', overloads: [[{ arg: '+RO', t: 'TaskContract' }]] },
      { name: 'children', overloads: [[{ arg: '+RW', t: 'ChildTask[]' }]] },
      { name: 'assignees', overloads: [[{ arg: '+RW', t: 'Queue<AssigneeContract>' }]] },
      {
        name: 'assign',
        overloads: [[
          { arg: 'assignee', t: 'AssigneeContract' },
          { arg: 'urgent', t: 'boolean' }
        ]]
      },
      { name: 'count', overloads: [[{ arg: '+PROP', t: 'number' }]] },
      {
        name: 'lookup',
        overloads: [
          [{ arg: 'value', t: 'string' }],
          [{ arg: 'value', t: 'number' }],
          [{ arg: 'value', t: 'string | number' }]
        ]
      }
    ],
    relations: [
      { kind: 'UNK', name: 'contract', target: 'TaskContract', many: false },
      { kind: 'UNK', name: 'children', target: 'ChildTask', many: true },
      { kind: 'UNK', name: 'assignees', target: 'AssigneeContract', many: true }
    ],
    },
  {
    name: 'TaskContract',
    methods: [
      { name: 'task', overloads: [[{ arg: '+RW', t: 'Task' }]] },
      {
        name: 'options',
        overloads: [[{
          arg: '+RW',
          t: new JsonMap<string, CompositeTypeT>([
            ['format', 'string'],
            ['limits', new JsonMap<string, CompositeTypeT>([
              ['limitType', ['none', 'count', 'size']],
              ['maximum', 'number'] ])] ])
        }]]
      },
      { name: 'describe', overloads: [[{ arg: 'format', t: 'string' }]] }
    ],
    relations: [{ kind: 'UNK', name: 'task', target: 'Task', many: false }],
    }
];

const SECOND_CLASS_DETAILS: ClassDetails = {
  name: 'ClassDetails',
  methods: [
    { name: 'name', overloads: [[{ arg: '+RW', t: 'string' }]] },
    { name: 'usage', overloads: [[{ arg: '+RW', t: "'ex' | 'dto' | undefined" }]] },
    { name: 'sourceFile', overloads: [[{ arg: '+RW', t: 'string' }]] },
    { name: 'modifiedAt', overloads: [[{ arg: '+RW', t: 'string' }]] },
    {
      name: 'relations',
      overloads: [[{
        arg: '+RW',
        t: "{ kind: 'OWNS' | 'REF'; name: string; many: '1' | '*' | '+'; }[]"
      }]]
    },
    { name: 'state', overloads: [[{ arg: '+RW', t: 'string' }]] }
  ],
  relations: [],
};

function executeScanner(serverUrl: string): Promise<string> {
  const scannerPath: string = path.resolve('scanner/dist/index.js');
  const fixturePath: string = path.resolve('scanner/mock-testproject');
  const logDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-classes-upload-'));
  const logPath: string = path.join(logDirectory, 'scanner.log');
  return new Promise<string>((resolve, reject) => {
    const processHandle: ChildProcessWithoutNullStreams = spawn(process.execPath, [scannerPath, 'mock-class-project', fixturePath, '--types', 'class', '--server-url', serverUrl, '--logfile', logPath], { stdio: 'pipe' });
    let stdout: string = '';
    let stderr: string = '';
    processHandle.stdout.setEncoding('utf8');
    processHandle.stdout.on('data', (chunk: string) => { stdout += chunk; });
    processHandle.stderr.setEncoding('utf8');
    processHandle.stderr.on('data', (chunk: string) => { stderr += chunk; });
    processHandle.once('error', reject);
    processHandle.once('close', (exitCode: number | null) => exitCode === 0 ? resolve(stdout) : reject(new Error(`Scanner exited with ${String(exitCode)}: ${stderr.trim()}`)));
  }).finally(() => { rmSync(logDirectory, { recursive: true, force: true }); });
}

export function registerUploadsMockProjectClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const serverUrl: string = `http://127.0.0.1:${String(address.port)}`;
      const output: string = await executeScanner(serverUrl);
      assert.match(output, /^CLASS Task$/m);
      assert.match(output, /^INTERFACE TaskContract$/m);
      assert.match(output, /^INTERFACE ClassDetails$/m);
      assert.match(output, /^INTERFACE ClassMember$/m);
      assert.match(output, /^INTERFACE FieldType$/m);
      assert.doesNotMatch(output, /^(?:CLASS|INTERFACE) CompositeTypeT$/m);
      assert.match(output, /^  FIELD contract \+RO: TaskContract$/m);
      assert.match(output, /^  FIELD children \+RW: ChildTask\[\]$/m);
      assert.match(output, /^  METHOD assign\(assignee: AssigneeContract, urgent: boolean\)$/m);
      assert.match(output, /^  METHOD lookup\(value: string\)$/m);
      assert.match(output, /^  METHOD lookup\(value: number\)$/m);
      assert.match(output, /^  METHOD lookup\(value: string \| number\)$/m);
      assert.match(output, /^  ACCESSOR count \+PROP: number$/m);
      assert.match(output, /^  RELATION UNK assignees: AssigneeContract\[\]$/m);
      assert.match(output, /^  FIELD relations \+RW: \{ kind: 'OWNS' \| 'REF' \| 'UNK'; name: string; target: string; many: boolean; \}\[\]$/m);
      const response: Response = await loggedFetch(`${serverUrl}/api/mock-class-project/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: EXPECTED_DETAILS.map((detail: ClassDetails) => detail.name) }) });
      assert.equal(response.status, 200);
      const received: ClassDetails[] = await response.json() as ClassDetails[];
      received.forEach((item: ClassDetails) => {
        assert.ok(item.sourceFile);
        assert.equal(item.modifiedAt, statSync(path.resolve('scanner/mock-testproject', item.sourceFile)).mtime.toISOString());
        delete item.sourceFile;
        delete item.modifiedAt;
      });
      assert.deepEqual(received, JSON.parse(JSON.stringify(EXPECTED_DETAILS)));
      const allResponse: Response = await loggedFetch(`${serverUrl}/api/mock-class-project/getClasses`);
      assert.equal(allResponse.status, 200);
      const firstInventory: {
        classes: readonly ClassDetails[];
        lastChange?: { origin: { kind: string; name: string; version: string } };
      } = await allResponse.json() as {
        classes: readonly ClassDetails[];
        lastChange?: { origin: { kind: string; name: string; version: string } };
      };
      const actor = firstInventory.lastChange?.origin;
      assert.ok(actor);
      assert.equal(actor.kind, 'scan');
      assert.equal(actor.name, os.userInfo().username);
      assert.ok(!Number.isNaN(Date.parse(actor.version)));
      const revisions: Response = await loggedFetch(`${serverUrl}/api/mock-class-project/getRevisionIds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ howFarBack: 0 }),
      });
      assert.equal(revisions.status, 200);
      assert.deepEqual(await revisions.json(), [actor.version]);
      const secondFixturePath: string = path.resolve('scanner/mock-testproject2');
      const secondLogDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-classes-deletion-'));
      const secondLogPath: string = path.join(secondLogDirectory, 'scanner.log');
      try {
        const secondScan: ChildProcessWithoutNullStreams = spawn(process.execPath, [path.resolve('scanner/dist/index.js'), 'mock-class-project', secondFixturePath, '--types', 'class', '--server-url', serverUrl, '--logfile', secondLogPath], { stdio: 'pipe' });
        let secondOutput: string = '';
        secondScan.stdout.setEncoding('utf8');
        secondScan.stdout.on('data', (chunk: string) => { secondOutput += chunk; });
        const secondExitCode: number | null = await new Promise<number | null>((resolve, reject) => {
          secondScan.once('error', reject);
          secondScan.once('close', resolve);
        });
        assert.equal(secondExitCode, 0);
        assert.match(secondOutput, /^INTERFACE ClassDetails$/m);
        assert.match(secondOutput, /^  FIELD usage \+RW: 'ex' \| 'dto' \| undefined$/m);
        assert.match(secondOutput, /^  FIELD relations \+RW: \{ kind: 'OWNS' \| 'REF'; name: string; many: '1' \| '\*' \| '\+'; \}\[\]$/m);
        assert.doesNotMatch(secondOutput, /^(?:CLASS|INTERFACE) ClassMember$/m);
        assert.doesNotMatch(secondOutput, /^(?:CLASS|INTERFACE) FieldType$/m);
      } finally {
        rmSync(secondLogDirectory, { recursive: true, force: true });
      }
      const afterSecondScan: {
        classes: ClassDetails[];
        lastChange: {
          classes: {
            name: string;
            status: string;
            changes: {
              kind: string;
              before?: { name: string } | 'absent';
              after?: { name: string } | 'absent';
            }[];
          }[];
        };
      } = await (await loggedFetch(`${serverUrl}/api/mock-class-project/getClasses`)).json() as {
        classes: ClassDetails[];
        lastChange: {
          classes: {
            name: string;
            status: string;
            changes: {
              kind: string;
              before?: { name: string } | 'absent';
              after?: { name: string } | 'absent';
            }[];
          }[];
        };
      };
      const classDetails: ClassDetails | undefined = afterSecondScan.classes.find((candidate: ClassDetails) => candidate.name === 'ClassDetails');
      assert.ok(classDetails);
      assert.equal(classDetails.sourceFile, 'src/class-details.ts');
      assert.equal(classDetails.modifiedAt, statSync(path.resolve('scanner/mock-testproject2', 'src/class-details.ts')).mtime.toISOString());
      delete classDetails.sourceFile;
      delete classDetails.modifiedAt;
      assert.deepEqual(classDetails, SECOND_CLASS_DETAILS);
      ['ClassMember', 'FieldType'].forEach((name: string) => {
        const item: ClassDetails | undefined = afterSecondScan.classes.find((candidate: ClassDetails) => candidate.name === name);
        assert.equal(item?.state, 'deleted');
      });
      const modified: {
        name: string;
        status: string;
        changes: {
          kind: string;
          before?: { name: string } | 'absent';
          after?: { name: string } | 'absent';
        }[];
      } | undefined = afterSecondScan.lastChange.classes.find((item) => item.name === 'ClassDetails');
      assert.equal(modified?.status, 'modified');
      const changedMembers: string[] = modified?.changes
        .filter((change) => change.kind === 'member')
        .map((change) => change.after !== 'absent' && change.after !== undefined ? change.after.name : change.before !== 'absent' && change.before !== undefined ? change.before.name : '')
        .sort() ?? [];
      assert.deepEqual(changedMembers, ['methods', 'relations', 'state', 'usage']);
      assert.ok(modified?.changes.some((change) => change.kind === 'relation'));
      assert.ok(!modified?.changes.some((change) => change.kind === 'source'));
      ['ClassMember', 'FieldType'].forEach((name: string) => {
        assert.equal(afterSecondScan.lastChange.classes.find((item) => item.name === name)?.status, 'deleted');
      });
      const historyResponse: Response = await loggedFetch(`${serverUrl}/api/mock-class-project/getClassesHistory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['ClassDetails', 'ClassMember', 'FieldType'] }),
      });
      assert.equal(historyResponse.status, 200);
      const history: {
        name: string;
        methods: { name: string; status: string; history: unknown[] }[];
        state?: string;
      }[] = await historyResponse.json() as {
        name: string;
        methods: { name: string; status: string; history: unknown[] }[];
        state?: string;
      }[];
      const classDetailsHistory = history.find((item) => item.name === 'ClassDetails');
      assert.equal(classDetailsHistory?.methods.find((item) => item.name === 'methods')?.status, 'deleted');
      assert.equal(classDetailsHistory?.methods.find((item) => item.name === 'usage')?.history.length, 2);
      assert.equal(classDetailsHistory?.methods.find((item) => item.name === 'relations')?.history.length, 2);
      assert.equal(classDetailsHistory?.methods.find((item) => item.name === 'state')?.history.length, 2);
      ['ClassMember', 'FieldType'].forEach((name: string) => {
        const item = history.find((candidate) => candidate.name === name);
        assert.equal(item?.state, 'deleted');
        assert.ok(item?.methods.every((member) => member.status === 'deleted' && member.history.length === 2));
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error === undefined ? resolve() : reject(error)));
    }
  });
}
