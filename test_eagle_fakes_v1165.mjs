/* test_eagle_fakes_v1165.mjs —— 火眼金睛：词组的假选项不能只是多/少/挪了一个空格
 *
 * v1163：makeFakeSpelling 会在空格处「多写一个字母」（= 多一个空格，ice  cream）、删掉空格、把空格和字母互换，
 *        去重也不看空格多少。屏幕上「ice  cream」和「ice cream」看起来一模一样，选对的孩子可能点到假的。
 * 合同（静态，27 个岛页里的 makeFakeSpelling + 本岛每个带空格的词）：假选项里没有连续空格，
 *        把空格合并、忽略大小写以后也不等于正确答案；空格个数和正确答案一样（只改字母，不动空格）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const files = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();
let multi = 0; const bad = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const i = html.indexOf('const DATA=['), j = html.indexOf('const allW=', i);
  const DATA = (new Function(html.slice(i, j).replace('const DATA=', 'return ')))();
  const a = html.indexOf('function makeFakeSpelling(word){');
  let depth = 0, k = html.indexOf('{', a), e = k;
  for (; e < html.length; e++) { if (html[e] === '{') depth++; else if (html[e] === '}') { depth--; if (!depth) break; } }
  const make = (new Function(html.slice(a, e + 1) + '\nreturn makeFakeSpelling;'))();
  const norm = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  for (const w of DATA.flatMap(d => d.words)) {
    if (!/ /.test(w.en)) continue;
    multi++;
    const nsp = w.en.split(' ').length;
    for (const fake of make(w.en)) {
      const why = /\s\s/.test(fake) ? '连续空格' : norm(fake) === norm(w.en) ? '和答案一样' : fake.split(' ').length !== nsp || fake.trim() !== fake ? '空格被删/被挪/多了' : '';
      if (why) bad.push(`${f.replace('island_', '').replace('.html', '')}「${w.en}」→「${fake}」${why}`);
    }
  }
}
ok(multi > 10, `检查了 ${multi} 个带空格的词`);
ok(bad.length === 0, '假选项都看得出和答案不一样' + (bad.length ? '（' + bad.length + ' 个）\n     ' + bad.slice(0, 12).join('\n     ') : ''));
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 火眼金睛：词组的假选项不再只差一个空格');
