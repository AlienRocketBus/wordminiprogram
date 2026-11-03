/* test_review2_words_v1166.mjs —— 复习 2.0 的词表来源必须和岛页一字不差
 *
 * 为什么：复习 2.0 在首页也要能出星海词，首页没有星海词表，所以打包了一份
 *   hansen_review2_words_v1166.js（从 island_season.html 生成）。两份词表一旦走散，
 *   复习里答的「第 60 个词」就不是岛里的第 60 个词，进度会记到别的词上。
 *   常规 18 岛用 vocab_all.js，这里也一并核对它和每个岛页 allW 的顺序。
 *
 * 用法：node test_review2_words_v1166.mjs           只检查
 *       node test_review2_words_v1166.mjs --write   重新生成数据文件（改了星海词以后跑一次）
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'hansen_review2_words_v1166.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };

function pageWords(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = html.match(/const DATA\s*=\s*(\[[\s\S]*?\]);\s*\n/);
  if (!m) throw new Error(file + ' 找不到 const DATA');
  const data = vm.runInNewContext('(' + m[1] + ')', {});
  return data.flatMap(d => d.words);
}
const pick = w => ({ en: String(w.en), cn: String(w.cn || ''), pn: String(w.pn || ''), emoji: String(w.emoji || '') });

const season = pageWords('island_season.html').map(pick);
ok(season.length === 240, '星海岛页 240 个词 (' + season.length + ')');
let land = [];
for (let i = 1; i <= 8; i++) land = land.concat(pageWords('island_land' + i + '.html').map(pick));
ok(JSON.stringify(land.map(w => w.en)) === JSON.stringify(season.map(w => w.en)), '单词大陆 1–8 依次拼起来 = 星海 240 词（同一批槽位）');

if (process.argv.includes('--write')) {
  const body = season.map(w => '  ' + JSON.stringify(w)).join(',\n');
  const src = '/* hansen_review2_words_v1166.js — 复习 2.0 用的星海 240 词（自动生成，别手改）\n'
    + ' * 来源：island_season.html 的 DATA（= 单词大陆 1–8 依次拼起来）。只放 en/cn/pn/emoji。\n'
    + ' * 首页没有星海词表，复习 2.0 跨岛出题要用；改了星海词以后运行：\n'
    + ' *   node test_review2_words_v1166.mjs --write\n'
    + ' * 测试 test_review2_words_v1166.mjs 会盯着它和岛页一字不差。 */\n'
    + '(function(root){\n'
    + "  'use strict';\n"
    + '  if(!root||root.HANSEN_REVIEW2_SEASON_WORDS)return;\n'
    + '  root.HANSEN_REVIEW2_SEASON_WORDS=[\n' + body + '\n  ];\n'
    + "})(typeof window!=='undefined'?window:globalThis);\n";
  fs.writeFileSync(OUT, src);
  console.log('  ✍️  已写 ' + path.basename(OUT));
}

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(OUT, 'utf8'), ctx);
const shipped = ctx.window.HANSEN_REVIEW2_SEASON_WORDS;
ok(Array.isArray(shipped) && shipped.length === 240, '数据文件里 240 个词');
ok(JSON.stringify(shipped) === JSON.stringify(season), '数据文件和 island_season.html 一字不差（顺序、英文、中文、音标、图）');

// 常规 18 岛：vocab_all.js 的顺序必须和岛页 allW 一样（复习 2.0 按下标对槽位）
const vctx = { window: {}, localStorage: { setItem() {} } };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'vocab_all.js'), 'utf8'), vctx);
const V = vctx.window.HANSEN_VOCAB_ALL || {};
const ISL = { action: 'wordIslandVerbs', adjective: 'wordIslandAdj', animal: 'wordIslandAnimal', body: 'wordIslandBody', city: 'wordIslandCity',
  clothes: 'wordIslandClothes', color: 'wordIslandColorNum', family: 'wordIslandFamily', food: 'wordIslandFood', home: 'wordIslandHouse',
  job: 'wordIslandPeople', nature: 'wordIslandNature', question: 'wordIslandPronouns', school: 'wordIslandSchool', sports: 'wordIslandSports',
  time: 'wordIslandTime', traffic: 'wordIslandTransport', treasure: 'wordIslandMisc' };
let same = 0;
for (const [id, key] of Object.entries(ISL)) {
  const a = pageWords('island_' + id + '.html').map(w => w.en), b = (V[key] || []).map(w => w.en);
  if (JSON.stringify(a) === JSON.stringify(b)) same++;
  else ok(false, id + ' 岛：vocab_all.js 顺序和岛页不一致');
}
ok(same === 18, '18 个常规岛 vocab_all.js 顺序都和岛页 allW 一致 (' + same + '/18)');

// 和权威账本的岛定义对得上（词数）
const cctx = { window: { localStorage: { getItem() { return null; }, setItem() {}, removeItem() {}, length: 0, key() { return null; } }, addEventListener() {} } };
cctx.window.window = cctx.window;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'hansen_canonical_progress.js'), 'utf8'), cctx);
const HC = cctx.window.HansenCanonical;
ok(!!HC, '账本模块能在 node 里加载');
if (HC) {
  const bad = HC.islands.filter(i => (i.id === 'season' ? shipped.length : (V[i.saveKey] || []).length) !== i.words).map(i => i.id);
  ok(bad.length === 0, '19 个标准岛的词数都和账本一致' + (bad.length ? ' 不一致：' + bad.join(',') : ''));
}

console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 全部通过');
process.exit(fails ? 1 : 0);
