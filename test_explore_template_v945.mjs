#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const version=read('VERSION').trim();
const pages=fs.readdirSync(ROOT).filter(name=>/^island_[a-z0-9]+\.html$/.test(name)).sort();
assert.equal(pages.length,27,'all 19 canonical islands + 8 Land pages must be covered');

for(const name of ['template.html',...pages]){
  const html=read(name),refs=[...html.matchAll(/<script\b[^>]*src=["']hansen_explore_progress_v945\.js\?v=(\d+)["'][^>]*>/g)];
  assert.equal(refs.length,1,`${name}: explore module must load exactly once`);
  assert.equal(refs[0][1],version,`${name}: explore module cache stamp must match VERSION`);
  assert.equal((html.match(new RegExp(`src=["']hansen_review\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: review hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_wrong_overview\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: wrong-overview hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_backup_v944\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: backup semantic-validation hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_canonical_progress\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: canonical progress input-validation hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_season\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: season storage/network hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_pet_showcase\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: pet-name repair hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_cards\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: card-progress/network hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_quest_global\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: daily-task ledger validation hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_island_upgrade\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: per-word coin-cap repair hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_addiction\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: HF7 rank-text color hotfix must load exactly once`);
  assert.equal((html.match(new RegExp(`src=["']hansen_boss_lock\\.js\\?v=${__APPV__}["']`,'g'))||[]).length,1,
    `${name}: Boss rainbow-timer HF5 runtime must load exactly once`);
  for(const runtime of ['hansen_spell_practice','hansen_cinema_themes','hansen_accessibility','hansen_perf_v944']){
    const pattern=new RegExp(`src=["']${runtime}\\.js\\?v=${__APPV__}["']`,'g');
    assert.equal((html.match(pattern)||[]).length,1,`${name}: ${runtime} HF2 runtime must load exactly once`);
  }
  const scriptRefs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  const order=['hansen_canonical_progress.js','hansen_gem_system.js','hansen_crystal.js','hansen_pet_showcase.js','hansen_explore_progress_v945.js'].map(file=>{const hit=scriptRefs.find(m=>m[1].split('?')[0]===file);return hit?hit.index:-1;});
  assert(order.every(x=>x>=0),`${name}: missing a dual-progress dependency`);
  assert.deepEqual(order,[...order].sort((a,b)=>a-b),`${name}: dependency order must be canonical → gems → crystal → pet → explore`);
}

const template=read('template.html');
const showWord=template.slice(template.indexOf('function showWord'),template.indexOf('function closeModal'));
assert.doesNotMatch(showWord,/✅ 已掌握|学会了！/,'S.learned must be labelled as 已认识/加入学习');
assert.match(showWord,/已认识（已加入学习）/);
assert.match(showWord,/加入学习！\+10 经验/);
assert.doesNotMatch(template,/掌握后亮⭐收集|<span>掌握进度<\/span>|清已掌握单词|已掌握的单词/);
assert.match(template,/🐾 宠物掌握 · 💎 知识结晶/);
assert.match(template,/认识进度/);

const module=read('hansen_explore_progress_v945.js');
assert.doesNotMatch(module,/setInterval\s*\(/,'explore progress must refresh by events, never polling');
assert.doesNotMatch(module,/hxpPractice|openPractice|answerPractice|data-hxp-practice|hxp-option/,'v946 must not retain the easy explore quiz');
assert.doesNotMatch(module,/root\.markAnswer\(/,'explore UI must route to real spelling games, never settle answers itself');
assert.match(module,/HansenTypingMasterV946\.openFocus/);
assert.match(module,/HansenSpellBee\.openFocused/);
assert.match(module,/run:runProof,commit:runProof,consume:consumeProof,settle:settleProof,allows:allowsLaunch/);
assert.match(module,/cpm>=80\?5:\(cpm>=50\?7:10\)/);
assert.match(module,/@media\(max-width:480px\).*repeat\(2,minmax\(0,1fr\)\)/s);
assert.match(module,/max-height:calc\(100dvh/);
assert.match(module,/aria-pressed/);
assert.match(module,/role="progressbar"/);
assert.match(module,/只有打字大师中无提示、整词精确拼写/);
assert.match(module,/账本证明 4 钻已到账/);

assert.match(read('hansen_canonical_progress.js'),/sliceSnapshot:sliceSnapshot/);
assert.match(read('hansen_crystal.js'),/sliceProgress:sliceProgress/);
assert.match(read('hansen_crystal.js'),/consume\('crystal',\+idx\)/);
assert.match(read('hansen_gem_system.js'),/awardStates:awardStates/);
assert.match(read('hansen_pet_showcase.js'),/progressSnapshot:progressSnapshot/);
assert.match(read('hansen_pet_showcase.js'),/consume\('pet',\+idx\)/);
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_explore_progress_v945\\.js\\?v=${__APPV__}`),'hotfixed runtime must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_review\\.js\\?v=${__APPV__}`),'Land review hotfix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_wrong_overview\\.js\\?v=${__APPV__}`),'wrong-overview sanitization must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_backup_v944\\.js\\?v=${__APPV__}`),'HF6 Boss round backup validation must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_canonical_progress\\.js\\?v=${__APPV__}`),'canonical progress validation must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_season\\.js\\?v=${__APPV__}`),'season/network hotfix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_pet_showcase\\.js\\?v=${__APPV__}`),'pet-name repair must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_cards\\.js\\?v=${__APPV__}`),'card/network hotfix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_quest_global\\.js\\?v=${__APPV__}`),'daily-task ledger validation must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_island_upgrade\\.js\\?v=${__APPV__}`),'per-word coin-cap and light-contrast repair must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_boss_lock\\.js\\?v=${__APPV__}`),'HF5 Boss rainbow timer must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_addiction\\.js\\?v=${__APPV__}`),'HF7 rank-text color fix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_diamond_shop\\.js\\?v=${__APPV__}`),'HF7 forbidden-text-color fix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_econ_guide\\.js\\?v=${__APPV__}`),'HF7 settings-guide color fix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_round_reward\\.js\\?v=${__APPV__}`),'HF6 Boss round ledger must be an exact offline-shell key');
assert.match(read('sw_v944.js'),new RegExp(`\\.\\/hansen_round_bar\\.js\\?v=${__APPV__}`),'HF7 Boss round-card color fix must be an exact offline-shell key');
assert.match(read('sw_v944.js'),/PAGE_CACHE\s*=\s*CACHE_PREFIX\s*\+\s*'pages-104'/,'v960 must use the current offline page cache');
assert.match(read('sw_v944.js'),/ASSET_CACHE\s*=\s*CACHE_PREFIX\s*\+\s*'assets-104'/,'v960 must use the current runtime asset cache');

console.log('explore template v945/v946: 27-page wiring + spelling-only routes + isolated progress contract ✅');
