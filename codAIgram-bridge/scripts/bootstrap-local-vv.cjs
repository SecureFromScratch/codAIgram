const { spawnSync } = require('node:child_process');
const path = require('node:path');

const bridge = path.resolve(__dirname, '..');
const helper = path.resolve(bridge, '../../vv_ts/scripts/bootstrap-consumer.mjs');
const result = spawnSync(process.execPath, [helper, bridge], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
