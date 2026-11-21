import { readConfig } from "./config";
import { startMock } from "./server";

async function main(): Promise<void> {
  const configPath: string | undefined = process.argv[2];
  if (!configPath) {
    process.stderr.write("Usage: node dist/main.js <config.json>\n");
    process.exitCode = 2;
    return;
  }
  try {
    const server = await startMock(readConfig(configPath));
    const shutdown = (): void => { server.close(); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error: unknown) {
    process.stderr.write(`${error instanceof Error ? error.message : "Unable to start mock."}\n`);
    process.exitCode = 1;
  }
}

void main();
