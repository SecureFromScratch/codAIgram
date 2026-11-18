import type { ClassDetails } from '@codaigram/shared/class-types';
import { reviseClass } from './class-revision.js';
import type { ClassOrigin, ClassUpdate, RevisionResult } from './class-revision.js';

// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
/** Provenance of the original legacy data is unknown, not the actor performing the conversion. */
export const LEGACY_ORIGIN: ClassOrigin = {
  // Legacy documents did not record who created the class.
  kind: 'legacy',
  name: 'unknown',
  version: 'legacy',
};

export function legacyClassBaseline(details: ClassDetails): RevisionResult {
  const update: ClassUpdate = {
    name: details.name,
    methods: details.methods.map((member) => ({
      name: member.name,
      overloads: member.overloads.map((args) => ({ args })),
    })),
    relations: details.relations,
  };
  if (details.state) update.state = details.state;
  if (details.usage) update.usage = details.usage;
  if (details.sourceFile) update.sourceFile = details.sourceFile;
  if (details.modifiedAt) update.modifiedAt = details.modifiedAt;
  // UNTRUST-ALLOW-NULLISH: Legacy documents have no versioned predecessor, so the revision builder requires its documented absent predecessor to construct a labeled baseline.
  return reviseClass(update, undefined, LEGACY_ORIGIN, 'unknown');
}
// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
