/* test_land_subtitle_v1165.mjs —— 单词大陆 8 个岛的英文副标题各是各的
 *
 * v1163：副标题写死在母版里，8 个岛都显示旧星海时代的「STAR SEA I: EMOTION & CHARACTER ISLAND」。
 * 合同（静态）：8 个岛主页的英文副标题互不相同、和各自 <title> 的大陆编号一致；哪儿都没有「STAR SEA I」；
 *              generate_land.py --verify 逐字一致（副标题来自 land_data.json，由生成器填进去）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const circ = '①②③④⑤⑥⑦⑧';
const subs = [];
for (let n = 1; n <= 8; n++) {
  const html = fs.readFileSync(path.join(ROOT, `island_land${n}.html`), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const home = html.slice(html.indexOf('id="homeScreen"'), html.indexOf('<!-- Pet hero -->'));
  const sub = (home.match(/letter-spacing:1px">([^<]+)<\/div>/) || [])[1] || '';
  subs.push(sub);
  ok(/STAR SEA/i.test(html) === false || !/STAR SEA I:/.test(html), `land${n} 页面里没有「STAR SEA I:」`);
  ok(title.includes('单词大陆·' + circ[n - 1]) && title.includes('Word Continent ' + n + ':') && sub === 'WORD CONTINENT ' + circ[n - 1], `land${n} 副标题「${sub}」和标题「${title}」的编号一致`);
}
ok(new Set(subs).size === 8, '8 个副标题互不相同 ' + JSON.stringify(subs));
ok(!/STAR SEA I:/.test(fs.readFileSync(path.join(ROOT, 'land_template.html'), 'utf8')), '母版里也没有写死的「STAR SEA I:」');
const v = spawnSync('python3', [path.join(ROOT, 'generate_land.py'), '--verify'], { cwd: ROOT, encoding: 'utf8' });
ok(v.status === 0 && /逐字一致/.test(v.stdout), 'generate_land.py --verify 全部逐字一致' + (v.status ? '\n' + v.stdout.slice(-400) : ''));
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 单词大陆副标题各是各的');
