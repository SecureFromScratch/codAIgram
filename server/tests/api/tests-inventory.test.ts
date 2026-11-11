import { describe } from "node:test";
import { registerInitialInventoryCase } from "./cases/initial-inventory.case.js";
import { registerUpdateInventoryCase } from "./cases/update-inventory.case.js";
describe("test inventory API", (): void => {
  registerInitialInventoryCase();
  registerUpdateInventoryCase();
});
