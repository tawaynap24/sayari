#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evidenceDirectory } from './evidence.mjs';
const out = await evidenceDirectory(), results = [];
// Vite empties dist. Confirm the standard output directory is inside this checkout.
const expected = path.resolve('dist');
try { if (await fs.realpath(expected) !== expected || (await fs.lstat(expected)).isSymbolicLink()) throw new Error('Unexpected dist target'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [script, log] of [['nanoka:test', 'unit-tests.log'], ['build', 'build.log'], ['lint', 'lint.log']]) {
  const startedAt = new Date().toISOString();
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
    : spawnSync('npm', ['run', script], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  await fs.writeFile(path.join(out, log), `${result.stdout ?? ''}${result.stderr ?? ''}`, 'utf8');
  results.push({ command: `npm run ${script}`, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status, error: result.error?.message, log });
  console.log(`${script}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${log})`);
}
await fs.writeFile(path.join(out, 'TEST_RESULTS.json'), JSON.stringify({ note: 'Offline unit tests, build and lint. Live coverage and browser evidence are separate.', results }, null, 2));
if (results.some(r => r.exitCode !== 0)) process.exitCode = 1;
