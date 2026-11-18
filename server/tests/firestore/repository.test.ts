import { describe } from "node:test";
import { registerPersistAndReadCase } from "./cases/persist-and-read.case.js";
import { registerRequestedOrderCase } from "./cases/requested-order.case.js";
import { registerClassHistoryCase } from "./cases/class-history.case.js";
import { registerClassHistoryConcurrencyCase } from "./cases/class-history-concurrency.case.js";
import { registerLegacyPartialWarningCase } from "./cases/legacy-partial-warning.case.js";
import { registerClassRenameDeleteCase } from "./cases/class-rename-delete.case.js";
import { registerClassLegacyBaselineCase } from "./cases/class-legacy-baseline.case.js";
describe("Firestore class repository", () => {
  registerPersistAndReadCase();
  registerRequestedOrderCase();
  registerClassHistoryCase();
  registerClassHistoryConcurrencyCase();
  registerLegacyPartialWarningCase();
  registerClassRenameDeleteCase();
  registerClassLegacyBaselineCase();
});
