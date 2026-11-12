import assert from "node:assert/strict";
import type { Server } from "node:net";
import { after, before, beforeEach } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { createApp } from "../../dist/app.js";
import { MemoryClassRepository } from "../../dist/memory-class-repository.js";
import { initializeVisualLog, logVisualEvent } from "./logging.js";
let browser: Browser | undefined;
let server: ViteDevServer | undefined;
let api: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
export let page: Page;
export function registerVisualLifecycle(): void {
  before(async () => {
    initializeVisualLog();
    logVisualEvent("INFO", "Starting visual test suite");
    const repository: MemoryClassRepository = new MemoryClassRepository();
    await repository.updateTests([
      {
        group: "diagram",
        name: "renders-class",
        description: "renders a class diagram",
        prompt: "Render a class diagram.",
      },
      {
        group: "repository",
        name: "stores-details",
        description: "stores class details",
        prompt: "Store class details.",
      },
    ]);
    api = createApp(repository).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => api?.once("listening", resolve));
    const apiAddress: ReturnType<NonNullable<typeof api>["address"]> =
      api.address();
    assert.ok(apiAddress && typeof apiAddress !== "string");
    server = await createServer({
      configFile: "client/vite.config.ts",
      server: {
        host: "127.0.0.1",
        port: 41731,
        strictPort: true,
        proxy: { "/api": `http://127.0.0.1:${String(apiAddress.port)}` },
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
    await page.locator(".canvas svg").first().waitFor({ timeout: 10000 });
  });
  beforeEach(async (context) => {
    logVisualEvent("INFO", `Starting test: ${context.name}`);
    await page.reload();
    await page.locator(".canvas svg").first().waitFor({ timeout: 10000 });
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
