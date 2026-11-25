const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, "package-lock.json"), "utf8"));
const minorVersion = Number(fs.readFileSync(path.join(projectRoot, "vsix_minor_version.txt"), "utf8").trim());
const versionParts = packageJson.version.split(".").map(Number);

if (versionParts.length !== 3 || versionParts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`Cannot package invalid extension version: ${packageJson.version}`);
}
if (versionParts[1] !== minorVersion || versionParts[2] !== 0) {
  throw new Error(`VSIX version ${packageJson.version} does not match the minor-version marker ${String(minorVersion)}.`);
}
if (packageLock.version !== packageJson.version || packageLock.packages[""]?.version !== packageJson.version) {
  throw new Error(`Package lock version does not match extension version ${packageJson.version}.`);
}
