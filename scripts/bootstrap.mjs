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
const packages = (await readdir(artifacts)).filter(name => name.endsWith('.tgz')).map(name => resolve(artifacts, name));
const install = spawnSync('npm', ['install', '--no-save', ...packages], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (install.status !== 0) process.exit(install.status ?? 1);
