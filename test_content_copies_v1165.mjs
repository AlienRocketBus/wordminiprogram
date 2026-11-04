/* test_content_copies_v1165.mjs —— 确定的内容更正同步到词库副本（复习用 vocab_all.js、拼写蜂词表、单词大陆地图），完形高亮亮对词
 *
 * 背景（内容校对 CQ-02 / CQ-05 / CQ-06 / CQ-16）：岛页的生成源已经改好（A 线 test_content_fixes_v1165），但同一批词在
 *   vocab_all.js（首页/错题复习）、spelling_bee.html WORDS（拼写蜂）、land_map.html MAP_GROUPS（大陆地图词表）里还有副本，
 *   还是旧的：August 音标、白菜、羊、短裙、「摆桌子」、两句不通顺的中文、星海 14 个词用「;」分隔义项、科学家/歌手配男性图、
 *   传统配人偶。完形填空的金色高亮在 12 句里亮的是不相干的单个字（多半是「的」），且只认「/」分隔义项。
 *
 * 合同（静态，值写死在这里）：每个副本里该改的值都改了、旧值一个不剩；smartHighlight 在这 12 句亮的是指定的词；
 *   改过内容的那些句子不会只亮一个不相干的字。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── 三个副本，各自解析成 [{en,field...,where}] ──
const vaLine = read('vocab_all.js').split('\n').find(l => l.startsWith('window.HANSEN_VOCAB_ALL = '));
const VA = JSON.parse(vaLine.slice('window.HANSEN_VOCAB_ALL = '.length).replace(/;\s*$/, ''));
const vocab = []; for (const k of Object.keys(VA)) for (const w of VA[k]) vocab.push({ ...w, where: k });
const sb = read('spelling_bee.html'); const sbBlock = sb.slice(sb.indexOf('var WORDS=['), sb.indexOf('\n];', sb.indexOf('var WORDS=[')));
const bee = sbBlock.split('\n').filter(l => l.startsWith('{"en": ')).map(l => { const w = JSON.parse(l.replace(/,$/, '')); return { ...w, where: w.isl }; });
const MG = JSON.parse(read('land_map.html').match(/window\.MAP_GROUPS=(\[[\s\S]*?\]);/)[1]);
const map = []; for (const g of MG) for (const w of g.words) map.push({ ...w, where: 'land' + g.id });
const COPIES = { 'vocab_all.js': vocab, 'spelling_bee.html': bee, 'land_map.html': map };

// [单词, 字段, 旧值, 新值, 只在哪些副本里有这个字段]
const FIX = [
  ['August', 'pn', '/ɔːˈɡʌst/', '/ˈɔːɡəst/'],
  ['cabbage', 'cn', '白菜', '卷心菜'], ['cabbage', 'exCn', '奶奶在花园里种白菜。', '奶奶在花园里种卷心菜。'],
  ['sheep', 'cn', '羊', '绵羊'], ['skirt', 'cn', '短裙', '裙子'],
  ['table', 'exCn', '我们摆桌子吃晚饭吧。', '我们摆好碗筷准备吃晚饭吧。'],
  ['meanwhile', 'exCn', '你摆桌子,与此同时我来做晚饭。', '你来摆碗筷,与此同时我来做晚饭。'],
  ['old', 'exCn', '我爷爷年纪很老了。', '我爷爷年纪很大了。'],
  ['March', 'exCn', '春天三月开始。', '春天从三月开始。'],
  ['scientist', 'emoji', '👨‍🔬', '👩‍🔬'], ['singer', 'emoji', '👨‍🎤', '👩‍🎤'], ['tradition', 'emoji', '🎎', '🥟'],
  ['available', 'cn', '可获得的;可用的', '可获得的/可用的'], ['develop', 'cn', '发展;发育', '发展/发育'], ['destroy', 'cn', '摧毁;毁坏', '摧毁/毁坏'],
  ['struggle', 'cn', '奋斗;挣扎', '奋斗/挣扎'], ['maximum', 'cn', '最大值;最大的', '最大值/最大的'], ['minimum', 'cn', '最小值;最小的', '最小值/最小的'],
  ['instead', 'cn', '反而;作为替代', '反而/作为替代'], ['consequently', 'cn', '因此;结果', '因此/结果'], ['generally', 'cn', '通常;一般来说', '通常/一般来说'],
  ['fortunately', 'cn', '幸好;幸运的是', '幸好/幸运的是'], ['public', 'cn', '公共的;公众的', '公共的/公众的'], ['chemical', 'cn', '化学物质;化学的', '化学物质/化学的'],
  ['business', 'cn', '生意;商业', '生意/商业'], ['employee', 'cn', '员工;雇员', '员工/雇员'],
  /* v1165 复查（C2 / C3）：「摆好碗筷」那句里没有一个字对得上 table，完形金色提示就没了 → 改成「把餐桌摆好」；
     dress（连衣裙）的例句译成「红裙子」，和 skirt=裙子 分不开 → 改成「红色的连衣裙」（中文译文不读出来，录音不受影响） */
  ['table', 'exCn', '我们摆好碗筷准备吃晚饭吧。', '我们把餐桌摆好,准备吃晚饭吧。'],
  ['dress', 'exCn', '她穿了一条红裙子去参加聚会。', '她穿了一条红色的连衣裙去参加聚会。'],
];
console.log('\n▶ 副本里的值');
for (const [file, list] of Object.entries(COPIES)) {
  let stale = [], fixed = 0, seen = 0;
  for (const [en, f, oldV, newV] of FIX) {
    for (const w of list.filter(x => x.en === en && f in x)) {
      seen++;
      if (w[f] === oldV) stale.push(`${w.where}:${en}.${f}=${oldV}`);
      else if (w[f] === newV) fixed++;
    }
  }
  ok(seen > 0 && stale.length === 0, `${file}：${seen} 处里旧值 ${stale.length} 处${stale.length ? '（' + stale.slice(0, 4).join('，') + '）' : ''}，新值 ${fixed} 处`);
}
ok(!/[;；]/.test(map.map(w => w.cn).join('|')), 'land_map.html 地图词表的中文义项不再用「;」分隔');
ok(!/[;；]/.test(bee.filter(w => /^land[1-8]$|^season$/.test(w.isl)).map(w => w.cn).join('|')), '拼写蜂星海词的中文义项不再用「;」分隔');

console.log('\n▶ 完形填空的金色高亮');
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(read('highlight_helper.js'), ctx);
const hl = (cn, ex, en) => { const m = /<span[^>]*>(.*?)<\/span>/.exec(ctx.window.smartHighlight(cn, ex, en)); return m ? m[1] : ''; };
// 中文义项用岛上真实的（生成源 island_data.json），不是凭印象写的
const ISL = JSON.parse(read('island_data.json')), REAL = {};
for (const k of Object.keys(ISL)) { const c = {}; vm.createContext(c); vm.runInContext(ISL[k].DATA.replace('const DATA=', 'DATA='), c); c.DATA.forEach(g => g.words.forEach(w => { if (!REAL[w.en]) REAL[w.en] = w; })); }
const realCn = (en, fallback) => (REAL[en] && REAL[en].cn) || fallback;
const HL = [['frightened', '吓到的', '小男孩被巨大的雷声吓到了。', '吓到'], ['confused', '困惑的', '这些复杂的说明让我完全搞糊涂了。', '搞糊涂'], ['cautious', '谨慎的', '过这条繁忙的马路时要小心。', '小心'],
  ['ordinary', '普通的', '那只是平常的一天,没发生什么特别的事。', '平常'], ['available', '可获得的/可用的', '今晚演出的票还有。', '还有'], ['valuable', '有价值的', '时间是我们拥有的最宝贵的东西。', '宝贵'],
  ['galaxy', '星系', '我们的太阳系是银河系的一部分。', '银河系'], ['constantly', '不断地', '她不停地看手机有没有消息。', '不停地'], ['previously', '以前', '在成为作家之前,他曾当过老师。', '曾'],
  ['fly', '飞', '你坐过飞机吗?', '坐过'], ['determined', '坚决的', '他下定决心无论如何都要跑完比赛。', '下定决心'], ['natural', '自然的', '蜂蜜是一种天然的甜味剂。', '天然的'],
  /* v1165 复查（C2 / C3）：改过译文以后完形金色提示亮不起来的三句 */
  ['old', '旧的/老的', '我爷爷年纪很大了。', '年纪很大'], ['table', '桌子', '我们把餐桌摆好,准备吃晚饭吧。', '餐桌'], ['dress', '连衣裙', '她穿了一条红色的连衣裙去参加聚会。', '连衣裙']];
for (const [en, cn0, ex, want] of HL) { const cn = realCn(en, cn0); const got = hl(cn, ex, en); ok(got === want, `${en}（${cn}）：亮「${got}」（应为「${want}」）`); }
// 改过内容的句子：亮的要么是整个词，要么不亮，绝不只亮一个不相干的字
const STRAY = [['destroy', '摧毁/毁坏', '一场大火几分钟就能摧毁整栋楼。'], ['chemical', '化学物质/化学的', '这种化学物质很危险,千万不要碰。'], ['employee', '员工/雇员', '他是公司里最勤奋的员工。'],
  ['public', '公共的/公众的', '公共场所禁止吸烟。'], ['maximum', '最大值/最大的', '这条路的最高限速是每小时60公里。'], ['instead', '反而/作为替代', '我们没坐公交,而是走着去的。'],
  ['cabbage', '卷心菜', '奶奶在花园里种卷心菜。'], ['sheep', '绵羊', '绵羊有柔软的白色羊毛。'], ['skirt', '裙子', '我妹妹很喜欢她的新蓝裙子。'], ['March', '三月', '春天从三月开始。'],
  ['destroy;', '摧毁;毁坏', '一场大火几分钟就能摧毁整栋楼。']];
for (const [en, cn, ex] of STRAY) { const got = hl(cn, ex, en.replace(';', '')); ok(got.length !== 1, `${en}（${cn}）：亮「${got}」，不是一个孤零零的字`); }
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 词库副本同步、完形高亮亮对词');
process.exit(fails ? 1 : 0);
