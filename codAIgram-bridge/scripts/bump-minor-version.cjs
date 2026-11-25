const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageLockPath = path.join(projectRoot, "package-lock.json");
const minorVersionPath = path.join(projectRoot, "vsix_minor_version.txt");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));
const currentMinor = Number(fs.readFileSync(minorVersionPath, "utf8").trim());
const versionParts = packageJson.version.split(".").map(Number);

if (versionParts.length !== 3 || versionParts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`Cannot package invalid extension version: ${packageJson.version}`);
}
if (!Number.isInteger(currentMinor) || currentMinor !== versionParts[1] || versionParts[2] !== 0) {
  throw new Error(`VSIX marker ${String(currentMinor)} must match the current minor version ${packageJson.version}.`);
}
if (packageLock.version !== packageJson.version || packageLock.packages[""]?.version !== packageJson.version) {
  throw new Error(`Package lock version does not match extension version ${packageJson.version}.`);
}

const nextMinor = currentMinor + 1;
const nextVersion = `${versionParts[0]}.${nextMinor}.0`;
packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[""].version = nextVersion;

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
fs.writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8");
fs.writeFileSync(minorVersionPath, `${String(nextMinor)}\n`, "utf8");
process.stdout.write(`VSIX version advanced to ${nextVersion}.\n`);
