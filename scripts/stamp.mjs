// ---- Cache-busting stamps ----
// GitHub Pages lets browsers cache files for ~10 minutes. Without stamps a
// visitor can get a fresh HTML page with stale JavaScript modules (or the
// reverse), which breaks the page in odd ways. This script gives every
// first-party script a ?v=<content hash> URL:
//   - entry <script type="module"> tags get the stamp in their src;
//   - modules imported by relative path are remapped through the page's
//     import map, so their imports need no changes.
// A file's URL changes only when its content does.
//
//   node scripts/stamp.mjs          rewrite the pages
//   node scripts/stamp.mjs --check  exit 1 if any stamp is out of date

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'characters3d.html'];
const MODULE_DIRS = ['src/office3d', 'src/characters3d'];

const hash = path => createHash('sha1').update(readFileSync(join(ROOT, path))).digest('hex').slice(0, 8);
const modules = MODULE_DIRS.flatMap(dir =>
  readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.js')).map(f => relative(ROOT, join(ROOT, dir, f))));
const stamped = path => `${path}?v=${hash(path)}`;

let stale = false;
for (const page of PAGES) {
  const file = join(ROOT, page);
  const before = readFileSync(file, 'utf8');
  let html = before;

  // Import map: keep the vendored three entries, remap every module.
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, () => {
    const imports = {
      three: './vendor/three/three.module.min.js',
      'three/addons/': './vendor/three/addons/',
      ...Object.fromEntries(modules.map(m => [`./${m}`, `./${stamped(m)}`])),
    };
    const body = JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n    ');
    return `<script type="importmap">\n    ${body}\n  </script>`;
  });
  // Entry modules.
  for (const path of modules) {
    const esc = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`src="${esc}(\\?v=[0-9a-f]+)?"`, 'g'), `src="${stamped(path)}"`);
  }

  if (html !== before) {
    stale = true;
    if (!process.argv.includes('--check')) writeFileSync(file, html);
    console.log(`${process.argv.includes('--check') ? 'stale' : 'stamped'}: ${page}`);
  }
}
if (process.argv.includes('--check') && stale) {
  console.error('Script stamps are out of date. Run: npm run stamp');
  process.exit(1);
}
