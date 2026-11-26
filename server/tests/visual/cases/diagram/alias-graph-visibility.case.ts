import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { isClassDetails, parseClassDetails, type ClassDetails, type CompositeTypeT } from '@codaigram/shared/class-types';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const OWNER_CLASS: string = 'AliasGraphOwner';
const CLASSES: readonly ClassDetails[] = [
  {
    name: OWNER_CLASS,
    methods: [
      { name: 'items', overloads: [[{ arg: '+RO', t: 'ArgsListT' }]] },
      { name: 'details', overloads: [[{ arg: '+RO', t: 'ReadonlyDetailsT' }]] },
      { name: 'label', overloads: [[{ arg: '+RO', t: 'TextAliasT' }]] },
    ],
    relations: [
      { kind: 'UNK', name: 'items', target: 'ArgsListT', many: true },
      { kind: 'UNK', name: 'details', target: 'ReadonlyDetailsT', many: false },
      { kind: 'UNK', name: 'label', target: 'TextAliasT', many: false },
    ],
  },
  {
    name: 'ArgsListT',
    state: 'alias',
    aliasType: 'FieldType[]',
    methods: [],
    relations: [],
  },
  {
    name: 'ReadonlyDetailsT',
    state: 'alias',
    aliasType: 'Readonly<FieldDetails>',
    methods: [],
    relations: [],
  },
  {
    name: 'TextAliasT',
    state: 'alias',
    aliasType: 'string',
    methods: [],
    relations: [],
  },
  {
    name: 'FieldType',
    methods: [{ name: 'arg', overloads: [[{ arg: '+RO', t: 'string' }]] }],
    relations: [],
  },
  {
    name: 'FieldDetails',
    methods: [{ name: 'description', overloads: [[{ arg: '+RO', t: 'string' }]] }],
    relations: [],
  },
];

const EXCLUDED_TYPE_NAMES: ReadonlySet<string> = new Set<string>([
  'string', 'number', 'boolean', 'bigint', 'symbol', 'undefined', 'null', 'void', 'never', 'unknown', 'any', 'object',
  'integer', 'positive', 'datetime', 'Array', 'ReadonlyArray', 'Promise', 'Map', 'ReadonlyMap', 'Set', 'ReadonlySet',
  'WeakMap', 'WeakSet', 'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'Parameters', 'ConstructorParameters', 'InstanceType', 'ThisType', 'Awaited',
  'Date', 'RegExp', 'Error', 'Function', 'Object', 'String', 'Number', 'Boolean', 'keyof', 'typeof', 'infer',
  'extends', 'readonly', 'new', 'this', 'true', 'false',
]);

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'hides alias boxes and shows their nonprimitive target types',
  prompt: {
    availability: 'available',
    history: [
      {
        when: '2026/11/25 00:00',
        text: 'Add a visual test that examines every alias returned by getClasses: aliases have no classbox, while each aliased nonprimitive type has a graph classbox unless it belongs to the established primitive or standard utility exclusion group.',
      },
    ],
  },
};

function references(type: CompositeTypeT): string[] {
  if (typeof type === 'string') return Array.from(type.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/gu), (match: RegExpMatchArray) => match[0]).filter((name: string) => !EXCLUDED_TYPE_NAMES.has(name));
  if (Array.isArray(type)) return [];
  return Array.from(type.values()).flatMap(references);
}

export function registerAliasGraphVisibilityCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const responseValue: unknown = await page.evaluate(async () => {
      const response: Response = await fetch('/api/mock-project/getClasses');
      if (!response.ok) throw new Error(`getClasses returned HTTP ${String(response.status)}.`);
      return response.json() as Promise<unknown>;
    });
    assert.ok(typeof responseValue === 'object' && responseValue !== null && 'classes' in responseValue, 'getClasses should return its class inventory.');
    const inventoryValue: unknown = responseValue.classes;
    assert.ok(Array.isArray(inventoryValue), 'getClasses should return its class inventory.');
    assert.ok(inventoryValue.every(isClassDetails), 'getClasses should return valid class details.');
    const inventory: ClassDetails[] = inventoryValue.map((item: unknown) => parseClassDetails(item, (error: Error) => { throw error; }));
    const aliases: ClassDetails[] = inventory.filter((item: ClassDetails) => item.state === 'alias' || item.state === 'union');
    assert.ok(aliases.length > 0, 'The test inventory should include aliases.');

    for (const alias of aliases) {
      assert.equal(await page.locator(`[data-class-name="${alias.name}"]`).count(), 0, `${alias.name} must not have its own classbox.`);
    }

    const aliasesByName: Map<string, ClassDetails> = new Map(aliases.map((alias: ClassDetails) => [alias.name, alias]));
    const representedTargets: Set<string> = new Set<string>();
    const collectTargets: (type: CompositeTypeT, visited: ReadonlySet<string>) => void = (type, visited): void => {
      references(type).forEach((name: string) => {
        if (visited.has(name)) return;
        const nestedAlias: ClassDetails | undefined = aliasesByName.get(name);
        if (nestedAlias?.aliasType !== undefined) {
          const nextVisited: Set<string> = new Set<string>(visited);
          nextVisited.add(name);
          collectTargets(nestedAlias.aliasType, nextVisited);
          return;
        }
        representedTargets.add(name);
      });
    };
    aliases.forEach((alias: ClassDetails) => {
      if (alias.aliasType !== undefined) collectTargets(alias.aliasType, new Set<string>([alias.name]));
    });

    for (const targetName of representedTargets) {
      const targetBox: Locator = page.locator(`[data-class-name="${targetName}"]`);
      assert.equal(await targetBox.count(), 1, `${targetName}, referenced by an alias, should have a graph classbox.`);
    }
  });
}
