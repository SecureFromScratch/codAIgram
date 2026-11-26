const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const vsixPath = path.join(projectRoot, `codaigram-bridge-${packageJson.version}.vsix`);

if (!fs.existsSync(vsixPath)) {
  throw new Error(`Expected packaged VSIX was not found: ${vsixPath}`);
}

process.stdout.write(`Installing ${path.basename(vsixPath)} into the VS Code selected by the current user's code CLI.\n`);
if (process.platform === "win32") {
  const codeCommandPath = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((directory) => path.join(directory, "code.cmd"))
    .find((candidate) => fs.existsSync(candidate));
  if (!codeCommandPath) throw new Error("Could not find code.cmd on the current user's PATH.");
  const codeCommandText = fs.readFileSync(codeCommandPath, "utf8");
  const cliMatch = codeCommandText.match(/"%~dp0\.\.\\([^"]+resources\\app\\out\\cli\.js)"/iu);
  if (!cliMatch?.[1]) throw new Error(`Could not resolve the VS Code CLI entry point from ${codeCommandPath}.`);
  const codeExecutable = path.resolve(path.dirname(codeCommandPath), "..", "Code.exe");
  const cliEntryPoint = path.resolve(path.dirname(codeCommandPath), "..", cliMatch[1]);
  execFileSync(codeExecutable, [cliEntryPoint, "--install-extension", vsixPath, "--force"], {
    env: { ...process.env, VSCODE_DEV: "", ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit"
  });
} else {
  execFileSync("code", ["--install-extension", vsixPath, "--force"], { stdio: "inherit" });
}
