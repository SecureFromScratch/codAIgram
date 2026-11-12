import { describe } from "node:test";
import { registerClassDetailsCase } from "./cases/class-details.case.js";
import { registerInvalidInputCase } from "./cases/invalid-input.case.js";
import { registerInvalidUpdateCase } from "./cases/invalid-update.case.js";
import { registerOversizeUpdateCase } from "./cases/oversize-update.case.js";
import { registerUpdateClassesCase } from "./cases/update-classes.case.js";
describe("class details API", () => {
  registerClassDetailsCase();
  registerUpdateClassesCase();
  registerInvalidUpdateCase();
  registerOversizeUpdateCase();
  registerInvalidInputCase();
});
