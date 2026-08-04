import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const html = read('index.html');
const css = read('css/style.css');
const game = read('js/game.js');
const events = read('js/events.js');
const data = read('js/data.js');

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing marker: ${marker}`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `Missing opening brace after: ${marker}`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed block after: ${marker}`);
}

function arrayAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing marker: ${marker}`);
  const open = source.indexOf('[', start);
  assert.notEqual(open, -1, `Missing opening bracket after: ${marker}`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++;
    if (source[i] === ']') depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed array after: ${marker}`);
}

function unique(values, label) {
  const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  assert.deepEqual(duplicates, [], `${label} must not contain duplicates: ${duplicates.join(', ')}`);
}

test('all application scripts pass Node syntax checks', () => {
  for (const file of ['js/data.js', 'js/game.js', 'js/events.js']) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, `${file} syntax check failed:\n${result.stderr}`);
  }
});

test('HTML script order and ID contract match the classic-script application', () => {
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ['js/data.js', 'js/game.js', 'js/events.js']);

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  unique(ids, 'HTML ids');
  const idSet = new Set(ids);
  const requestedIds = [...new Set([...game.matchAll(/\$\('([^']+)'\)/g), ...events.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]))];
  assert.deepEqual(requestedIds.filter((id) => !idSet.has(id)), [], 'Every $(id) lookup must have one HTML element');
});

test('furniture is inert outside edit mode and edit controls are state-gated', () => {
  assert.match(css, /\.furniture-layer\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /\.furniture\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(css, /body\.edit-mode \.furniture\s*\{[^}]*pointer-events:\s*auto;/s);

  const drawer = blockAfter(game, 'function closeDrawer()');
  assert.match(drawer, /state\.editMode\s*=\s*false;/);
  assert.match(drawer, /document\.body\.classList\.remove\('edit-mode'\)/);
  assert.match(drawer, /clearFurnitureSelection\(\)/);

  const openDrawer = blockAfter(game, 'function openDrawer(view)');
  assert.match(openDrawer, /state\.editMode\s*=\s*view\s*===\s*'edit';/);
  assert.match(openDrawer, /document\.body\.classList\.toggle\('edit-mode',\s*state\.editMode\)/);
  assert.match(openDrawer, /if \(!state\.editMode\) clearFurnitureSelection\(\)/);

  const draggable = blockAfter(game, 'function makeFurnitureDraggable');
  assert.match(draggable, /if \(!state\.editMode\) return;/);
  assert.match(draggable, /if \(!state\.editMode \|\| e\.target\.closest\('\.furniture-btn, \.furniture-resize-handle'\)\) return;/);
  assert.match(draggable, /if \(!drag\) return;/);
  assert.match(draggable, /if \(!resize\) return;/);
});

test('pause and resume guard the loop and cancel scene-owned work', () => {
  const loop = blockAfter(game, 'function gameLoop(timestamp)');
  assert.match(loop, /if \(state\.isPlaying\)\s*\{/);

  const listener = blockAfter(game, "$('btnPlay').addEventListener('click'");
  assert.match(listener, /state\.isPlaying\s*=\s*!state\.isPlaying;/);
  assert.match(listener, /playText'\)\.textContent\s*=\s*state\.isPlaying \? 'Pause' : 'Play'/);
  assert.match(listener, /if \(!state\.isPlaying\)\s*\{/);
  for (const requiredCleanup of ['clearPendingTimers()', 'clearAllBubbles()', 'state.convPairs.clear()', 'releaseSocial(c)', 'cancelActivity(c)', 'clearTarget(c)']) {
    assert.ok(listener.includes(requiredCleanup), `Pause handler must call ${requiredCleanup}`);
  }
  assert.match(listener, /if \(isSceneLocked\(c\)\) c\.idleTimer\s*=\s*0;/);
});

test('scenes and reset cancel stale targets, timers, activities, and scene locks', () => {
  const clearTimers = blockAfter(game, 'function clearPendingTimers()');
  assert.match(clearTimers, /for \(const id of state\.pendingTimers\) clearTimeout\(id\);/);
  assert.match(clearTimers, /state\.pendingTimers\.clear\(\);/);
  assert.match(clearTimers, /state\.activeScene\s*=\s*false;/);

  const beginScene = blockAfter(events, 'function beginScene()');
  for (const requiredCleanup of ['clearPendingTimers()', 'clearAllBubbles()', 'state.convPairs.clear()', 'releaseSocial(c)', 'cancelActivity(c)', 'closeObsCard()', 'state.activeScene = true']) {
    assert.ok(beginScene.includes(requiredCleanup), `beginScene must call ${requiredCleanup}`);
  }

  const gather = blockAfter(events, 'function gatherAndChat');
  assert.equal((gather.match(/beginScene\(\)/g) || []).length, 1, 'Each gather scene must initialise exactly once');
  assert.match(gather, /trackedTimeout\(tickArrival, 600\)/);
  assert.match(gather, /if \(!state\.activeScene\) return;/);
  assert.match(gather, /state\.activeScene\s*=\s*false;\s*\n\s*disperseCharacters\(1\.25\)/);

  const reset = blockAfter(game, "$('btnReset').addEventListener('click'");
  for (const requiredCleanup of ['clearPendingTimers()', 'clearTarget(c)', 'releaseSocial(c)', 'cancelActivity(c)', 'state.convPairs.clear()', 'state.stats = freshStats()', 'state.recentLines = freshRecentLines()']) {
    assert.ok(reset.includes(requiredCleanup), `Reset handler must call ${requiredCleanup}`);
  }
});

test('active sprite and furniture asset references resolve to files', () => {
  const paletteFiles = [...data.matchAll(/ZINE_FURNITURE_ROOT}\/([\w-]+\.webp)/g)].map((match) => match[1]);
  assert.equal(paletteFiles.length, 11, 'Furniture palette should retain its complete asset catalogue');
  unique(paletteFiles, 'Furniture asset references');
  for (const file of paletteFiles) {
    const path = join(ROOT, 'assets', file);
    assert.ok(existsSync(path), `Missing furniture asset: assets/${file}`);
    assert.ok(statSync(path).size > 0, `Empty furniture asset: assets/${file}`);
  }

  const characterTypes = ['andy', 'jazz', 'olex', 'ghost'];
  const directions = ['front', 'threequarter', 'side', 'back'];
  for (const type of characterTypes) {
    for (const direction of directions) {
      const root = join(ROOT, 'assets', 'sprites', 'zine', type);
      const idle = join(root, `${direction}_idle.webp`);
      assert.ok(existsSync(idle), `Missing idle sprite: ${type}/${direction}`);
      assert.ok(statSync(idle).size > 0, `Empty idle sprite: ${type}/${direction}`);
      for (let frame = 1; frame <= 4; frame++) {
        const walk = join(root, `${direction}_walk_${String(frame).padStart(2, '0')}.webp`);
        assert.ok(existsSync(walk), `Missing walk sprite: ${type}/${direction}/${frame}`);
        assert.ok(statSync(walk).size > 0, `Empty walk sprite: ${type}/${direction}/${frame}`);
      }
    }
  }
});

test('fonts are local, licensed, and free of runtime Google requests', () => {
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/);
  for (const family of ['Caveat', 'Inter', 'JetBrainsMono']) {
    const font = join(ROOT, 'assets', 'fonts', `${family}-Variable.woff2`);
    const license = join(ROOT, 'assets', 'fonts', `OFL-${family}.txt`);
    assert.ok(existsSync(font) && statSync(font).size > 0, `Missing local font: ${family}`);
    assert.ok(existsSync(license) && statSync(license).size > 0, `Missing font license: ${family}`);
  }
});

test('application state and DOM data contracts stay unique and observable', () => {
  const globals = [...`${data}\n${game}\n${events}`.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)\b/gm)].map((match) => match[1]);
  unique(globals, 'Top-level classic-script declarations');

  const stateBlock = blockAfter(game, 'const state =');
  const stateKeys = [...stateBlock.matchAll(/^  ([A-Za-z_$][\w$]*)\s*:/gm)].map((match) => match[1]);
  unique(stateKeys, 'Top-level state keys');
  for (const key of ['chars', 'isPlaying', 'editMode', 'activeScene', 'pendingTimers', 'stats', 'recentLines']) {
    assert.ok(stateKeys.includes(key), `state.${key} is part of the app contract`);
  }

  const renderCharacter = blockAfter(game, 'function renderCharacter');
  for (const contract of ['el.dataset.id = c.id', 'el.dataset.type = c.type', "el.dataset.paperFigure = 'true'", "el.dataset.motion = 'walking'"]) {
    assert.ok(renderCharacter.includes(contract), `Character render contract missing: ${contract}`);
  }
  const sync = blockAfter(game, 'function updateCharDOM');
  for (const contract of ['el.dataset.social =', 'el.dataset.socialCooldown =', 'el.dataset.spriteFrame =', 'el.dataset.facing =', 'el.dataset.viewDirection =']) {
    assert.ok(sync.includes(contract), `Character sync contract missing: ${contract}`);
  }
  const placeFurniture = blockAfter(game, 'function placeFurniturePiece');
  assert.match(placeFurniture, /el\.dataset\.furniture\s*=\s*def\.type;/);
  assert.match(placeFurniture, /el\.dataset\.paperCutout\s*=\s*'true';/);
  const appSync = blockAfter(game, 'function syncAppDOM');
  for (const contract of ['playing:', 'scene:', 'drawer:', 'editMode:']) {
    assert.ok(appSync.includes(contract), `App sync contract missing: ${contract}`);
  }
  assert.match(appSync, /document\.body\.dataset\[key\]\s*=\s*value;/);
  assert.match(appSync, /canvas\.dataset\[key\]\s*=\s*value;/);

  const paletteTypes = [...data.matchAll(/type:\s*'([\w-]+)'/g)].map((match) => match[1]);
  unique(paletteTypes, 'Furniture palette types');
  const defaultOffice = blockAfter(game, 'function initDefaultOffice()');
  for (const layoutName of ['desktopLayout', 'mobileLayout']) {
    const layout = arrayAfter(defaultOffice, `const ${layoutName} = [`);
    const types = [...layout.matchAll(/\['([\w-]+)'/g)].map((match) => match[1]);
    unique(types, `${layoutName} furniture assignments`);
    assert.deepEqual(types.filter((type) => !paletteTypes.includes(type)), [], `${layoutName} only uses palette types`);
  }
});
