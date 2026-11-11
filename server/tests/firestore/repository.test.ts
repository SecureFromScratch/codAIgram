import { describe } from "node:test";
import { registerPersistAndReadCase } from "./cases/persist-and-read.case.js";
import { registerRequestedOrderCase } from "./cases/requested-order.case.js";
describe("Firestore class repository", (): void => {
  registerPersistAndReadCase();
  registerRequestedOrderCase();
});
