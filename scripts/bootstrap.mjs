import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
for (const [directory, workspace] of [['vv_ts', '@untrust/vv'], ['mandate', '@untrust/mandate-core'], ['mandate', '@untrust/mandate-express'], ['BuildGates_ts', ''], ['BuildGates_react', '']]) {
  const args = ['pack', ...(workspace ? ['--workspace', workspace] : []), '--pack-destination', artifacts];
  const result = spawnSync('npm', args, { cwd: resolve(root, '..', directory), stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const packageVersions = new Map();
for (const name of await readdir(artifacts)) {
  const match = /^(.*)-(\d+)\.(\d+)\.(\d+)\.tgz$/.exec(name);
  if (!match) continue;
  const [, packageName, major, minor, patch] = match;
  const version = [Number(major), Number(minor), Number(patch)];
  const previous = packageVersions.get(packageName);
  if (!previous || version.some((part, index) => part !== previous.version[index]
    && version.slice(0, index).every((prefix, prefixIndex) => prefix === previous.version[prefixIndex])
    && part > previous.version[index])) {
    packageVersions.set(packageName, { name, version });
  }
}
const packages = [...packageVersions.values()].map(({ name }) => resolve(artifacts, name));
console.log(`Installing latest local package tarballs: ${[...packageVersions.values()].map(({ name }) => name).join(', ')}`);
const install = spawnSync('npm', ['install', '--no-save', ...packages], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (install.status !== 0) process.exit(install.status ?? 1);
