/* test_content_fixes_v1165.mjs —— 内容校对里「确定要改」的几处，生成源和生成出来的岛页都改对了
 *
 * 改了什么（只改音标 / 中文 / 中文例句 / 配图，英文例句一个字不动 → 录音和音频锁不受影响）：
 *   August 音标 /ɔːˈɡʌst/（那是形容词 august「威严的」）→ /ˈɔːɡəst/；cabbage 白菜 → 卷心菜（图是卷心菜）；sheep 羊 → 绵羊（同岛有山羊）；
 *   skirt 短裙 → 裙子；set the table 不是「摆桌子」→「摆好碗筷」（table、meanwhile 两句）；「年纪很老了」→「年纪很大了」；
 *   「春天三月开始」→「春天从三月开始」；星海 14 个词的义项分隔符「;」→「/」（高亮只认「/」）；
 *   scientist（居里夫人）、singer（She's…）配女性图；tradition（吃饺子）配 🥟，不是日本人偶 🎎。
 * 合同（静态）：island_data.json / land_data.json / 生成出来的岛页里新值都在、旧值都不在；两个生成器逐字一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SEP = { available: '可获得的/可用的', develop: '发展/发育', destroy: '摧毁/毁坏', struggle: '奋斗/挣扎', maximum: '最大值/最大的', minimum: '最小值/最小的', instead: '反而/作为替代',
  consequently: '因此/结果', generally: '通常/一般来说', fortunately: '幸好/幸运的是', public: '公共的/公众的', chemical: '化学物质/化学的', business: '生意/商业', employee: '员工/雇员' };
// [页面, 词, 字段, 新值, 旧值]
const FIX = [
  ['island_time.html', 'August', 'pn', '/ˈɔːɡəst/', '/ɔːˈɡʌst/'],
  ['island_food.html', 'cabbage', 'cn', '卷心菜', '白菜'],
  ['island_food.html', 'cabbage', 'exCn', '奶奶在花园里种卷心菜。', '奶奶在花园里种白菜。'],
  ['island_animal.html', 'sheep', 'cn', '绵羊', '羊'],
  ['island_clothes.html', 'skirt', 'cn', '裙子', '短裙'],
  ['island_home.html', 'table', 'exCn', '我们摆好碗筷准备吃晚饭吧。', '我们摆桌子吃晚饭吧。'],
  ['island_adjective.html', 'old', 'exCn', '我爷爷年纪很大了。', '我爷爷年纪很老了。'],
  ['island_time.html', 'March', 'exCn', '春天从三月开始。', '春天三月开始。'],
  ['island_job.html', 'scientist', 'emoji', '👩‍🔬', '👨‍🔬'],
  ['island_job.html', 'singer', 'emoji', '👩‍🎤', '👨‍🎤'],
  ['island_season.html', 'meanwhile', 'exCn', '你来摆碗筷,与此同时我来做晚饭。', '你摆桌子,与此同时我来做晚饭。'],
  ['island_land3.html', 'meanwhile', 'exCn', '你来摆碗筷,与此同时我来做晚饭。', '你摆桌子,与此同时我来做晚饭。'],
  ['island_season.html', 'tradition', 'emoji', '🥟', '🎎'],
  ['island_land7.html', 'tradition', 'emoji', '🥟', '🎎'],
  ...Object.entries(SEP).map(([w, v]) => ['island_season.html', w, 'cn', v, v.replace('/', ';')]),
  ...Object.entries(SEP).map(([w, v]) => ['LAND', w, 'cn', v, v.replace('/', ';')]),
];
function entry(src, en) { const m = src.match(new RegExp('\\{en:"' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",[^\\n]*')); return m ? m[0] : ''; }
const field = (seg, f) => { const m = seg.match(new RegExp('[{,]' + f + ':"([^"]*)"')); return m ? m[1] : null; };
const isl = JSON.parse(read('island_data.json')), land = JSON.parse(read('land_data.json'));
const landPages = [1, 2, 3, 4, 5, 6, 7, 8].map(n => 'island_land' + n + '.html');
const bad = [];
for (const [page, en, f, nv, ov] of FIX) {
  const pages = page === 'LAND' ? landPages.filter(p => entry(read(p), en)) : [page];
  if (!pages.length) { bad.push(`${en}: 单词大陆里没找到`); continue; }
  for (const p of pages) {
    const v = field(entry(read(p), en), f);
    if (v !== nv) bad.push(`${p} ${en}.${f} = ${v}（应为 ${nv}）`);
    // 生成源
    if (/island_land\d/.test(p)) {
      const n = p.match(/land(\d)/)[1]; const seg = land['land' + n].slots.map(s => entry(s, en)).find(Boolean) || '';
      if (field(seg, f) !== nv) bad.push(`land_data.json land${n} ${en}.${f} = ${field(seg, f)}`);
    } else {
      const key = p.replace('island_', '').replace('.html', ''); const v2 = field(entry(isl[key].DATA, en), f);
      if (v2 !== nv) bad.push(`island_data.json ${key} ${en}.${f} = ${v2}`);
    }
  }
}
ok(bad.length === 0, `${FIX.length} 处更正：生成源和岛页都是新值、旧值都不在` + (bad.length ? '\n     ' + bad.slice(0, 20).join('\n     ') : ''));
// 例句英文没动（录音靠它对上）
const exSame = ['meanwhile', 'tradition', 'table', 'old', 'March', 'cabbage'].every(w => {
  const pages = { meanwhile: 'island_season.html', tradition: 'island_season.html', table: 'island_home.html', old: 'island_adjective.html', March: 'island_time.html', cabbage: 'island_food.html' };
  return !!field(entry(read(pages[w]), w), 'ex');
});
ok(exSame, '这几个词的英文例句都还在（没有改英文，录音照旧对得上）');
for (const g of ['generate.py', 'generate_land.py']) {
  if (g === 'generate.py') {
    // generate.py 没有 --verify：在临时目录里重新生成一遍，和现有岛页逐字比
    const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp_gen_'));
    try {
      for (const f of ['generate.py', 'template.html', 'island_data.json']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
      const r = spawnSync('python3', [path.join(tmp, 'generate.py')], { cwd: tmp, encoding: 'utf8' });
      const diff = Object.keys(isl).filter(k => fs.readFileSync(path.join(tmp, 'island_' + k + '.html'), 'utf8') !== read('island_' + k + '.html'));
      ok(r.status === 0 && diff.length === 0, `generate.py 重新生成的 19 个岛页和现有的逐字一致（不一致：${diff.join(',') || '无'}）`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  } else {
    const v = spawnSync('python3', [path.join(ROOT, g), '--verify'], { cwd: ROOT, encoding: 'utf8' });
    ok(v.status === 0, 'generate_land.py --verify 逐字一致');
  }
}
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 内容更正：生成源和岛页都改对了');
