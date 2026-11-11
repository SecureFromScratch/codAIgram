import assert from "node:assert/strict";
import { after, before, beforeEach } from "node:test";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { createApp } from "../../dist/app.js";
import { MemoryClassRepository } from "../../dist/memory-class-repository.js";
let browser: Browser | undefined;
let server: ViteDevServer | undefined;
let api: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
export let page: Page;
export function registerVisualLifecycle(): void {
  before(async (): Promise<void> => {
    api = createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    await new Promise<void>((resolve): void => api?.once("listening", resolve));
    const apiAddress: ReturnType<NonNullable<typeof api>["address"]> =
      api.address();
    assert.ok(apiAddress !== null && typeof apiAddress !== "string");
    server = await createServer({
      configFile: "client/vite.config.ts",
      server: {
        host: "127.0.0.1",
        port: 41731,
        strictPort: false,
        proxy: { "/api": `http://127.0.0.1:${String(apiAddress.port)}` },
      },
    });
    await server.listen();
    const httpServer: ViteDevServer["httpServer"] = server.httpServer;
    assert.ok(httpServer !== null);
    const address: ReturnType<typeof httpServer.address> = httpServer.address();
    assert.ok(address !== null && typeof address !== "string");
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${String(address.port)}/`);
    await page.locator(".canvas svg").first().waitFor({ timeout: 10000 });
  });
  beforeEach(async (): Promise<void> => {
    await page.reload();
    await page.locator(".canvas svg").first().waitFor({ timeout: 10000 });
  });
  after(async (): Promise<void> => {
    if (browser !== undefined) await browser.close();
    if (server !== undefined) await server.close();
    if (api !== undefined)
      await new Promise<void>((resolve, reject): void =>
        api?.close((error?: Error): void =>
          error === undefined ? resolve() : reject(error),
        ),
      );
  });
}
