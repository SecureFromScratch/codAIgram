import type { ClassDetails } from '@codaigram/shared/class-types';

export type { ArgsListT, ClassDetails, ClassMember, CompositeTypeT, FieldType } from '@codaigram/shared/class-types';
export interface ClassRepository {
  getDetails(names: readonly string[]): Promise<ClassDetails[]>;
  getClasses(): Promise<ClassDetails[]>;
  updateClasses(classes: readonly ClassDetails[]): Promise<void>;
}

export interface TestDetails {
  group: string;
  name: string;
  description: string;
  prompt: string;
}

export interface TestInventoryRepository {
  getTests(): Promise<TestDetails[]>;
  updateTests(tests: readonly TestDetails[]): Promise<void>;
}
