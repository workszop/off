// ---- Syntax check ----
// Runs `node --check` on every first-party script, found by folder, so a new
// file is covered without editing a list.
//
//   node scripts/check.mjs

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'scripts', 'tests', 'worker/margo/src', 'worker/margo/test'];

const scripts = DIRS.flatMap(dir =>
  readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.m?js$/.test(entry.name))
    .map(entry => relative(ROOT, join(entry.parentPath, entry.name))))
  .sort();

let failed = 0;
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', join(ROOT, script)], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    console.error(`${script}\n${result.stderr}`);
  }
}
console.log(`Checked ${scripts.length} scripts, ${failed} with syntax errors.`);
process.exit(failed ? 1 : 0);
