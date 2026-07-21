#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const CACHE_VERSION = read('./VERSION').trim();
const occurrences = (text, needle) => text.split(needle).length - 1;
function between(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `missing block ${start} … ${end}`);
  return text.slice(a, b);
}

const template = read('./template.html');
assert.doesNotMatch(template.match(/<meta name="viewport" content="([^"]+)"/)?.[1] || '',
  /maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i, '模板必须允许缩放');
assert.match(template,
  /@keyframes chestLegendShine\s*\{\s*0%, 100% \{[^}]+\}\s*50%\s+\{[^}]+\}\s*\}\s*\/\* 🐾/s,
  '宝箱 keyframes 必须在宠物样式前正确闭合');

for (let i = 1; i <= 8; i++) {
  const file = `island_land${i}.html`;
  const html = read(`./${file}`);
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] || '';
  assert.ok(viewport, `${file}: missing viewport`);
  assert.doesNotMatch(viewport, /maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i,
    `${file}: must allow zoom`);

  for (const script of [`hansen_backup_v944.js?v=${CACHE_VERSION}`, `hansen_accessibility.js?v=${CACHE_VERSION}`]) {
    assert.equal(occurrences(html, script), 1, `${file}: ${script} must load exactly once`);
  }
  assert.doesNotMatch(html, /\?v=941\b/, `${file}: stale v941 cache stamp`);
  assert.match(html, new RegExp(`var __hsnSaveKey='wordIslandLand${i}'`), `${file}: save identity`);
  assert.match(html, new RegExp(`window\\.__hsnSaveKey = 'wordIslandLand${i}'`), `${file}: public save identity`);
  assert.match(html, /window\.__hsnSaveNow=save/, `${file}: synchronous save path`);
  /* The reset path is intentionally not required to remove main + backup up
     front.  v942 keeps the old snapshots until the cleared replacement has
     been written and verified; test_storage_reset_v942.mjs fault-injects that
     transaction and proves both rollback and successful commit. */
  assert.match(html, /function _actuallyDoReset\(\)/, `${file}: transactional reset entry point`);
  assert.match(html, /HansenCanonical\.clearCurrent\(\['learned','wrongs','mc','srs'\]\)/,
    `${file}: reset must clear canonical slice`);
  assert.match(html, /HansenAch\.reset\(\)/, `${file}: achievement clear must use authority`);
  assert.doesNotMatch(html, /_doActualImport|hansen_charxp_reset_v1'\)!=='1'/,
    `${file}: retired import/reset migration must be absent`);
  assert.doesNotMatch(html, /addXP\(L\.xpPerQ\);progressQuest\('correct',1\);markAnswer/,
    `${file}: Eagle answer must not advance the correct quest twice`);
  assert.match(html, /hsnEscapeText\(S\.pet\.name\)/, `${file}: pet name must be text-escaped`);

  assert.equal(occurrences(html, `HansenSpellBee.open('land${i}')`), 1,
    `${file}: spelling identity must stay land${i}`);
  const data = between(html, 'const DATA=[', 'const allW=');
  assert.equal((data.match(/\{en:/g) || []).length, 30, `${file}: must retain exactly 30 words`);
  const bosses = between(html, 'const BOSSES=[', '//🔴v811');
  assert.equal((bosses.match(/\{name:/g) || []).length, 5, `${file}: must retain exactly 5 bosses`);
  assert.ok(occurrences(html, `land${i}_prog`) >= 4, `${file}: own linear boss progress must remain`);
  assert.ok(html.includes("match(/island_land([1-8])\\.html/)"),
    `${file}: dynamic Land route identity must remain`);
  assert.match(html, /localStorage\.setItem\('hsn_landmap_cleared_'\+_smm\[1\],'1'\)/,
    `${file}: dynamic map clear flag must remain`);
  assert.match(html,
    /@keyframes chestLegendShine\s*\{\s*0%, 100% \{[^}]+\}\s*50%\s+\{[^}]+\}\s*\}\s*\/\* 🐾/s,
    `${file}: repaired CSS must be propagated`);
}

const land8Bosses = between(read('./island_land8.html'), 'const BOSSES=[', '//🔴v811');
assert.deepEqual([...land8Bosses.matchAll(/hp:(\d+)/g)].map(m => Number(m[1])),
  [760, 880, 1000, 1150, 1300], 'Land8 hand-tuned HP values must never be regenerated');
assert.match(land8Bosses, /星核帝皇·弗沙欧/, 'Land8 final boss identity must remain intact');

/* A Land3 reset owns canonical season slots 60..89 only. */
class Storage {
  constructor(seed = {}) { this.m = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)])); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(String(k)) ? this.m.get(String(k)) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(String(k)); }
}
const canonicalSeed = {
  version: 941,
  islands: {
    season: {
      learned: [59, 60, 89, 90], mc: {59: 3, 60: 3, 89: 3, 90: 3},
      wrongs: {59: 1, 60: 1, 89: 1, 90: 1},
      cleared: {learned: {}, mc: {}, wrongs: {}}
    }
  }
};
const storage = new Storage({hansen_canonical_progress_v941: JSON.stringify(canonicalSeed)});
const context = {
  console, localStorage: storage, location: {pathname: '/island_land3.html'},
  document: {readyState: 'loading', addEventListener() {}}, addEventListener() {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(read('./hansen_canonical_progress.js'), context);
assert.equal(context.HansenCanonical.clearCurrent(['learned', 'mc', 'wrongs']), true);
const season = context.HansenCanonical.read().islands.season;
assert.deepEqual(Array.from(season.learned), [59, 90]);
assert.deepEqual(Object.keys(season.mc), ['59', '90']);
assert.deepEqual(Object.keys(season.wrongs), ['59', '90']);

console.log('land sync v942: 8-page shell contract + CSS + identities + Land3 slice + Land8 bosses ✅');
