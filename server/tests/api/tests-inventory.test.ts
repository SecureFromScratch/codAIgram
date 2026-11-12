import { describe } from "node:test";
import { registerInitialTestsInventoryCase } from "./cases/initial-tests-inventory.case.js";
import { registerUpdateTestsInventoryCase } from "./cases/update-tests-inventory.case.js";
describe("tests inventory API", () => {
  registerInitialTestsInventoryCase();
  registerUpdateTestsInventoryCase();
});
