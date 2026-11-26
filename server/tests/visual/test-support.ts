import assert from "node:assert/strict";
import type { Server } from "node:net";
import { after, before, beforeEach } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { createApp } from "../../dist/app.js";
import { MemoryClassRepository } from "../../dist/memory-class-repository.js";
import type { ClassDetails, ClassRepository, DatabaseClassChange, TestInventoryRepository } from "../../dist/memory-repository.js";
import { initializeVisualLog, logVisualEvent } from "./logging.js";
let browser: Browser | undefined;
let server: ViteDevServer | undefined;
let api: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
let repository: MemoryClassRepository = new MemoryClassRepository();
export let page: Page;

export const VISUAL_CLASSES: readonly ClassDetails[] = [
  {
    name: "ClassDiagram",
    methods: [
      {
        name: "addClass",
        overloads: [[{ arg: "name", t: "string" }, { arg: "publicMethods", t: "string[]" }]] 
      },
      {
        name: "addPartialClass",
        overloads: [[{ arg: "name", t: "string" }]] 
      },
      {
        name: "connectClasses",
        overloads: [[
        { arg: "from", t: "string" },
        { arg: "to", t: "string" },
        { arg: "connectionType", t: "ConnectionType" },
        { arg: "arity", t: "integer" },
      ]] 
      },
      { name: "recalcLayout", overloads: [[]] },
    ],
    relations: [{
      kind: "OWNS",
      name: "classes",
      target: "Class",
      many: true 
    }],
    
  },
  {
    name: "Class",
    methods: [],
    relations: [],
    state: 'partial' 
  },
];

class VisualMemoryRepository extends MemoryClassRepository {
  readonly #classOrder: readonly string[];
  readonly #lastChange: DatabaseClassChange | undefined;

  constructor(classes: readonly ClassDetails[], lastChange?: DatabaseClassChange) {
    super([]);
    this.#classOrder = classes.map((item: ClassDetails) => item.name);
    this.#lastChange = lastChange;
  }

  override async getClasses(projectName: string): Promise<ClassDetails[]> {
    const classes: ClassDetails[] = await super.getClasses(projectName);
    return classes.sort((left: ClassDetails, right: ClassDetails) => this.#classOrder.indexOf(left.name) - this.#classOrder.indexOf(right.name));
  }

  override async getLastClassChange(projectName: string): Promise<DatabaseClassChange | undefined> {
    if (projectName === "mock-project") return this.#lastChange;
    return;
  }
}

export async function setVisualClasses(classes: readonly ClassDetails[], lastChange?: DatabaseClassChange): Promise<void> {
  repository = new VisualMemoryRepository(classes, lastChange);
  await repository.updateClasses("mock-project", classes);
  await repository.updateTests("mock-project", [
    {
      group: "diagram",
      name: "renders-class",
      description: "renders a class diagram",
      prompt: "Render a class diagram." 
    },
    {
      group: "repository",
      name: "stores-details",
      description: "stores class details",
      prompt: "Store class details." 
    },
  ]);
  const otherProjectClasses: readonly ClassDetails[] = [
    { name: "AnotherProjectClass", methods: [], relations: [] },
  ];
  await repository.updateClasses("another", otherProjectClasses);
}

const visualRepository: ClassRepository & TestInventoryRepository = {
  getProjects: () => repository.getProjects(),
  createProject: (projectName) => repository.createProject(projectName),
  getDetails: (projectName, names) => repository.getDetails(projectName, names),
  getClasses: (projectName) => repository.getClasses(projectName),
  updateClasses: (projectName, classes) => repository.updateClasses(projectName, classes),
  getClassSnapshots: (projectName) => repository.getClassSnapshots(projectName),
  getClassHistory: (projectName, names) => repository.getClassHistory(projectName, names),
  getRevisionIds: (projectName, howFarBack) => repository.getRevisionIds(projectName, howFarBack),
  getLastClassChange: (projectName) => repository.getLastClassChange(projectName),
  updateClassSnapshots: (projectName, classes, origin) => repository.updateClassSnapshots(projectName, classes, origin),
  getTests: (projectName) => repository.getTests(projectName),
  getHistory: (projectName, identifiers) => repository.getHistory(projectName, identifiers),
  updateTests: (projectName, tests) => repository.updateTests(projectName, tests),
};

export const VISUAL_FIXTURE_METADATA: { prompt: { history: { when: string; text: string; }[]; }; } = {
  prompt: {
    history: [
      { 
        when: "2026/11/15 09:35", 
        text: "for the current test suite use this definition of ClassDiagvram:\nClassDiagram\n  addClass(name: string, publicMethods: string[])\n  addPartialClass(name: string)\n  connectClasses(from: string, to: string, connectionType: ConnectionType, arity: integer)\n  recalcLayout()\nOWNS classes: Class[]\n\nalso - Class is a partial class.\n\nall tests should be agains the in-memory storage so we control the content." 
      },
    ],
  },
};

export function registerVisualLifecycle(): void {
  before(async () => {
    initializeVisualLog();
    logVisualEvent("INFO", "Starting visual test suite");
    await setVisualClasses(VISUAL_CLASSES);
    api = createApp(visualRepository).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => api?.once("listening", resolve));
    const apiAddress: ReturnType<NonNullable<typeof api>["address"]> =
      api.address();
    assert.ok(apiAddress && typeof apiAddress !== "string");
    server = await createServer({
      configFile: "client/vite.config.ts",
      configLoader: "runner",
      server: {
        host: "127.0.0.1",
        port: 41731,
        strictPort: true,
        proxy: { 
          "/api": `http://127.0.0.1:${String(apiAddress.port)}` 
        },
      },
    });
    await server.listen();
    const httpServer: ViteDevServer["httpServer"] = server.httpServer;
    assert.ok(httpServer);
    const address: ReturnType<Server["address"]> = httpServer.address();
    assert.ok(address && typeof address !== "string");
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on("console", (message) => logVisualEvent(message.type().toUpperCase(), message.text()));
    page.on("pageerror", (error: Error) => logVisualEvent("ERROR", error.stack ?? error.message));
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${String(address.port)}/`);
    await page.locator(".canvas").first().waitFor({ timeout: 10000 });
  });
  beforeEach(async (context) => {
    logVisualEvent("INFO", `Starting test: ${context.name}`);
    await page.evaluate(() => {
      window.localStorage.removeItem("codaigram.editorPercent");
      window.localStorage.removeItem("codaigram.selectedProject");
      window.localStorage.removeItem("codaigram.vscodeBridgeSession");
    });
    await setVisualClasses(VISUAL_CLASSES);
    await page.reload();
    await page.locator(".canvas").first().waitFor({ timeout: 10000 });
  });
  after(async () => {
    logVisualEvent("INFO", "Closing visual test suite");
    if (browser) await browser.close();
    if (server) await server.close();
    if (api)
      await new Promise<void>((resolve, reject) =>
        api?.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
  });
}
