const fs = require('node:fs');
const path = require('node:path');

const bridgeDir = path.resolve(__dirname, '..');
const protocolDir = path.resolve(bridgeDir, '../bridge-protocol');
const mandateDir = path.resolve(bridgeDir, '../../mandate/packages/core');
const vvSource = path.resolve(bridgeDir, '../../vv_ts/packages/vv');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function resolvePackage(fromDir, packageName) {
  let current = fromDir;
  while (true) {
    const candidate = path.join(current, 'node_modules', ...packageName.split('/'), 'package.json');
    if (fs.existsSync(candidate)) return { path: fs.realpathSync(candidate), manifest: readJson(candidate) };
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Cannot resolve ${packageName} from ${fromDir}`);
    current = parent;
  }
}

const bridge = resolvePackage(bridgeDir, '@untrust/vv');
const protocol = resolvePackage(protocolDir, '@untrust/vv');
const mandate = resolvePackage(mandateDir, '@untrust/vv');
const versions = new Set([bridge.manifest.version, protocol.manifest.version, mandate.manifest.version]);
if (versions.size !== 1) {
  console.error('VV dependency alignment failed.');
  for (const [name, item] of [['bridge', bridge], ['bridge-protocol', protocol], ['Mandate', mandate]])
    console.error(`  ${name}: ${item.manifest.version} at ${item.path}`);
  process.exitCode = 1;
} else {
  console.log(`VV versions aligned: ${bridge.manifest.version}`);
}
const sourceManifest = readJson(path.join(vvSource, 'package.json'));
if (bridge.manifest.version !== sourceManifest.version) {
  console.error(`Installed VV ${bridge.manifest.version} differs from local source ${sourceManifest.version}; rebuild VV and reinstall local dependencies.`);
  process.exitCode = 1;
}
