import fs from 'node:fs/promises';
import path from 'node:path';
export async function evidenceDirectory() {
  let workflow;
  try { workflow = JSON.parse(await fs.readFile('.nanoka/workflow.json', 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    workflow = { evidenceDir: `evidence/nanoka-zzz/${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}` };
    await fs.mkdir('.nanoka', { recursive: true });
    await fs.writeFile('.nanoka/workflow.json', JSON.stringify(workflow, null, 2) + '\n');
  }
  const root = path.resolve('evidence/nanoka-zzz'), destination = path.resolve(workflow.evidenceDir);
  if (!destination.startsWith(root + path.sep)) throw new Error('Evidence directory must stay inside evidence/nanoka-zzz/');
  await fs.mkdir(destination, { recursive: true });
  return destination;
}
