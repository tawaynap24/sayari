import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const [name, cwd, ...args] = process.argv.slice(2);
if (!name || !cwd || !args.length || !/^[a-z0-9-]+$/.test(name)) throw Error('Usage: run-check.mjs NAME CWD NODE_ARGS...');
const startedAt = new Date().toISOString();
const log = `evidence/project-split/${name}.log`;
const stream = fs.createWriteStream(log);
const child = spawn(process.execPath, args, { cwd: path.resolve(cwd), env: { ...process.env, NO_COLOR: '1' } });
child.stdout.pipe(stream, { end: false });
child.stderr.pipe(stream, { end: false });
child.on('error', error => stream.write(error.stack));
child.on('close', code => {
  stream.end();
  fs.writeFileSync(`evidence/project-split/${name}.json`, JSON.stringify({ name, cwd, args, startedAt, finishedAt: new Date().toISOString(), exitCode: code, log }, null, 2));
  console.log(`${name}: ${code === 0 ? 'PASS' : 'FAIL'}; ${log}`);
  if (code !== 0) console.log(fs.readFileSync(log, 'utf8').slice(-6000));
  process.exitCode = code ?? 1;
});
