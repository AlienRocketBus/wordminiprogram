/* sb_audit.mjs — 拼写蜂出题池 全库核对
 *
 * Hansen: "岛里面明明有 30 个或 40 个单词, 但这个模块里考的单词却不全面。
 *          比如某个岛有 40 个单词, 却只考了 38 个, 有的 40 个只考了 25 个。"
 *
 * ★ 判据(真机, 不看代码): 对每一个岛
 *     ① 岛页面里 allW.length = 本岛【真实】单词数
 *     ② spelling_bee.html?island=<key> 里 WORDS.length = 拼写蜂【能考到】的单词数
 *       (它是按 w.isl === islandKey 从自己的词库里筛出来的)
 *     ③ 选"全部"难度时 pool 的大小 = 实际会考的数量
 *   三个数必须一样。少一个词都算 bug。
 * ★ 并且把【差在哪几个词】逐个列出来 —— 这样才能修得准。
 */
import { chromium } from './playwright_loader.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';

// 岛文件 → HansenSpellBee.open(?) 里传的 islandKey
function islandKeys() {
  const out = [];
  for (const f of fs.readdirSync('.').filter(x => /^island_\w+\.html$/.test(x)).sort()) {
    const s = fs.readFileSync(f, 'utf8');
    const m = s.match(/HansenSpellBee\.open\('([^']+)'\)/);
    out.push({ file: f, key: m ? m[1] : null });
  }
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const list = islandKeys();
  console.log(`  共 ${list.length} 个岛\n`);
  console.log('  岛                       岛上真实词数   拼写蜂能考到   差额   判定');
  console.log('  ' + '─'.repeat(70));

  let bad = 0;
  const details = [];

  for (const { file, key } of list) {
    if (!key) { console.log(`  ${file.padEnd(24)} ❌ 找不到 HansenSpellBee.open 的 islandKey`); bad++; continue; }

    // ① 岛上真实词表
    const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p1 = await c1.newPage();
    await p1.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 45000 });
    await p1.waitForTimeout(1800);
    const islandWords = await p1.evaluate(() => (window.allW || []).map(w => w.en)).catch(() => []);
    await c1.close();

    // ② 拼写蜂在这个岛下能考到的词
    // ⚠️ 必须走【用户真实路径】: 进岛 → HansenSpellBee.open(key) → iframe(embed=1) → 读 parent.allW
    //    上一版探针直接开 spelling_bee.html?island=xxx(没有 embed=1、没有父页面),
    //    走的是"自带词库按标签筛"的兜底路径 —— 测的根本不是用户走的那条路, 修好了也显示没修好。
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p2 = await c2.newPage();
    await p2.goto(`http://localhost:${PORT}/${file}`, { waitUntil: 'load', timeout: 45000 });
    await p2.waitForTimeout(2000);
    await p2.evaluate(() => {
      ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      document.body.classList.remove('modal-open');
    });
    await p2.evaluate((k) => { try { window.HansenSpellBee.open(k); } catch (e) { } }, key);
    await p2.waitForTimeout(2600);
    let sb = { n: -1, words: [], poolAll: -1 };
    try {
      const fr = p2.frames().find(f => /spelling_bee\.html/.test(f.url()));
      if (fr) {
        sb = await fr.evaluate(() => {
          const W = (window.WORDS || []);
          let poolAll = 0;
          try { const L = window.LEVELS; poolAll = L && L.all ? W.filter(L.all.test).length : W.length; } catch (e) { poolAll = W.length; }
          return { n: W.length, words: W.map(w => w.en), poolAll };
        });
      }
    } catch (e) { }
    await c2.close();

    const miss = islandWords.filter(w => !sb.words.includes(w));
    const extra = sb.words.filter(w => !islandWords.includes(w));
    const ok = miss.length === 0 && extra.length === 0 && sb.n === islandWords.length;
    if (!ok) bad++;
    console.log(`  ${key.padEnd(24)} ${String(islandWords.length).padEnd(14)} ${String(sb.n).padEnd(14)} ${String(islandWords.length - sb.n).padEnd(6)} ${ok ? '✅' : '❌'}`);
    if (!ok) details.push({ key, islandN: islandWords.length, sbN: sb.n, miss, extra });
  }

  console.log('\n  ' + '═'.repeat(70));
  if (bad === 0) {
    console.log('  ✅ 全部岛: 拼写蜂考的词 = 岛上的词, 一个不多一个不少');
  } else {
    console.log(`  ❌ ${bad} 个岛对不上:\n`);
    details.forEach(d => {
      console.log(`  【${d.key}】 岛上 ${d.islandN} 词 · 拼写蜂只有 ${d.sbN} 词`);
      if (d.miss.length) console.log(`     🚨 拼写蜂【考不到】的 ${d.miss.length} 个词: ${d.miss.slice(0, 14).join(', ')}${d.miss.length > 14 ? ' …' : ''}`);
      if (d.extra.length) console.log(`     ⚠️ 拼写蜂里【岛上没有】的 ${d.extra.length} 个词: ${d.extra.slice(0, 8).join(', ')}${d.extra.length > 8 ? ' …' : ''}`);
    });
  }
  await b.close();
  if (bad) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
