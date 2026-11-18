/** Stable application error and validation codes. */
interface ErrorCodes {
  readonly CLASS_HISTORY_INCOMPLETE: 'CLASS_HISTORY_INCOMPLETE';
  readonly CLASS_REVISION_INVALID: 'CLASS_REVISION_INVALID';
  readonly TEST_UPDATE_INVALID: 'test-update.invalid';
  readonly BOOLEAN_INVALID: 'boolean.invalid';
  readonly FIELD_TYPE_INVALID: 'field-type.invalid';
  readonly CLASS_UPDATE_INVALID: 'class-update.invalid';
}

export const ERROR_CODES: ErrorCodes = {
  CLASS_HISTORY_INCOMPLETE: 'CLASS_HISTORY_INCOMPLETE',
  CLASS_REVISION_INVALID: 'CLASS_REVISION_INVALID',
  TEST_UPDATE_INVALID: 'test-update.invalid',
  BOOLEAN_INVALID: 'boolean.invalid',
  FIELD_TYPE_INVALID: 'field-type.invalid',
  CLASS_UPDATE_INVALID: 'class-update.invalid',
} as const;

export type StorageErrorCodeT = ErrorCodes['CLASS_HISTORY_INCOMPLETE' | 'CLASS_REVISION_INVALID'];
