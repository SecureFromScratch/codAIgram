import { describe } from "node:test";
import { registerGetProjectsCase } from "./cases/get-projects.case.js";
import { registerCreateProjectCase } from "./cases/create-project.case.js";

describe("projects API", () => {
  registerGetProjectsCase();
  registerCreateProjectCase();
});
