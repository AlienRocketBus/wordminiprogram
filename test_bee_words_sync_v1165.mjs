/* test_bee_words_sync_v1165.mjs —— 拼写蜂词表里的星海例句和岛上一致（也就能播真人例句录音）
 *
 * 事故（内容校对 CQ-08）：spelling_bee.html 的 WORDS 里 25 个星海词的例句（ex / exCn）还是旧版本，和岛上、和录音都不一样
 *   （录音表 hansen_ex_audio.js 按例句原文找文件，旧句子找不到 → 偷偷变回合成音）。
 *
 * 合同（静态）：这 25 个词，拼写蜂 WORDS 的 ex/exCn == island_data.json 星海 DATA；每句在 __HANSEN_EX_AUDIO 里都有录音键；
 *   en/pn 和岛上一致（cn 的分隔符由 test_content_copies_v1165.mjs 管）。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'island_data.json'), 'utf8'));
const c = {}; vm.createContext(c); vm.runInContext(d.season.DATA.replace('const DATA=', 'DATA='), c);
const idx = {}; c.DATA.forEach(g => g.words.forEach(w => { idx[w.en] = w; }));
const src = fs.readFileSync(path.join(ROOT, 'spelling_bee.html'), 'utf8');
const block = src.slice(src.indexOf('var WORDS=['), src.indexOf('\n];', src.indexOf('var WORDS=[')));
const ex = {}; vm.createContext(ex); ex.window = ex; vm.runInContext(fs.readFileSync(path.join(ROOT, 'hansen_ex_audio.js'), 'utf8'), ex);
const AUDIO = ex.__HANSEN_EX_AUDIO || {};
const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const words = 'describe realize mention admit indicate comment debate provide produce invent destroy repair establish manage handle perform examine calculate stranger customer chemical creature particle employee colleague'.split(' ');
let same = 0, audio = 0, other = 0;
for (const w of words) {
  const m = block.match(new RegExp('\\{"en": "' + w + '"[^\\n]*'));
  const bee = m ? JSON.parse(m[0].replace(/,$/, '')) : null, e = idx[w];
  if (!bee || !e) { ok(false, `${w}：词表或岛上找不到`); continue; }
  if (bee.ex === e.ex && bee.exCn === e.exCn) same++; else console.log(`    ✗ ${w}：拼写蜂「${bee.ex}」≠ 岛上「${e.ex}」`);
  if (AUDIO[norm(bee.ex)]) audio++; else console.log(`    ✗ ${w}：例句没有录音键（${norm(bee.ex)}）`);
  if (bee.en === e.en && bee.pn === e.pn) other++; else console.log(`    ✗ ${w}：en/pn 和岛上不一样`);
}
ok(same === words.length, `25 个词的例句和岛上一致（${same}/25）`);
ok(audio === words.length, `25 句都能找到真人例句录音（${audio}/25）`);
ok(other === words.length, `单词和音标和岛上一致（${other}/25）`);
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 拼写蜂的星海例句和岛上一致');
process.exit(fails ? 1 : 0);
