import type { ClassDetails } from '@codaigram/shared/class-types';
import type { ClassChangeT, ClassHistory, ClassOrigin, ClassUpdate, CurrentClass } from './class-revision.js';

export interface DatabaseClassDelta {
  name: string;
  status: 'added' | 'modified' | 'deleted';
  renameOf?: string;
  changes: ClassChangeT[];
}

export interface DatabaseClassChange {
  origin: ClassOrigin;
  changedAt: string;
  classes?: DatabaseClassDelta[];
}

export type { ArgsListT, ClassDetails, ClassMember, CompositeTypeT, FieldType } from '@codaigram/shared/class-types';
export interface ClassRepository {
  getDetails(names: readonly string[]): Promise<ClassDetails[]>;
  getClasses(): Promise<ClassDetails[]>;
  updateClasses(classes: readonly ClassDetails[]): Promise<void>;
  getClassSnapshots(): Promise<CurrentClass[]>;
  getClassHistory(names: readonly string[]): Promise<ClassHistory[]>;
  getRevisionIds(howFarBack: number): Promise<string[]>;
  getLastClassChange(): Promise<DatabaseClassChange | undefined>;
  updateClassSnapshots(classes: readonly ClassUpdate[], origin: ClassOrigin): Promise<void>;
}

export interface TestDetails {
  group: string;
  name: string;
  description: string;
  prompt: string;
  prompts?: TestChange[];
}

export interface TestIdentifier {
  group: string;
  name: string;
}

export interface TestChange {
  when: string;
  text: string;
}

export interface TestHistory extends TestIdentifier {
  prompts: TestChange[];
  descriptions: TestChange[];
}

export interface TestRecord extends TestDetails {
  lastChangedAt: string;
  prompts: TestChange[];
  descriptions: TestChange[];
}

export interface TestInventoryRepository {
  getTests(): Promise<TestRecord[]>;
  getHistory(identifiers: readonly TestIdentifier[]): Promise<TestHistory[]>;
  updateTests(tests: readonly TestDetails[]): Promise<void>;
}
