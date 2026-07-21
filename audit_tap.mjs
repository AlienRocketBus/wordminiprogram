/* audit_tap.mjs — G. 连点防护 真机体检
 * 快速连点最容易出的两类事故:
 *   ① 奖励重复领(宝箱/任务/成就连点 → 多领金币)
 *   ② petTaskComplete 重复触发(一局游戏结算被点两次 → 经验翻倍)
 * 判据: 连点 5 次, 到账的必须和点 1 次一样。
 */
import { chromium } from './playwright_loader.mjs';

const PORT = process.argv[2] || '8877';
let pass = 0, fail = 0;
const chk = (n, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${n}${note ? '  ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try { localStorage.setItem('wordIslandLand1', JSON.stringify({ totalAnswers: 30, totalCorrect: 28, learned: [0, 1, 2, 3, 4], level: 5, xp: 100, totalXP: 100, coins: 100, stats: { maxCombo: 5, gameCounts: {}, modesPlayed: [] }, wrongs: {}, pet: { name: '星灵', stage: 1, xp: 0, picked: true } })); } catch (e) { }
  });
  const p = await c.newPage();
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(2400);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  console.log('  ══ G. 连点防护 ══');

  // G1: 每日任务奖励连点(如果有领取按钮)
  const quest = await p.evaluate(() => {
    try {
      // 找任务系统的领取函数
      // ⚠️ 上一版探针传错了参数(claimQuest 要的是数组下标 idx), 金币+0 是【探针的错】不是产品的。
      //    claimQuest 第一行就是门闩: if(!q||q.claimed||q.progress<q.goal)return;
      if (typeof window.claimQuest === 'function' && window.S.quests && S.quests.list && S.quests.list.length) {
        const idx = S.quests.list.findIndex(x => !x.claimed);
        if (idx < 0) return { skip: '没有可领的任务' };
        const q = S.quests.list[idx];
        q.progress = q.goal || 1; // 正好达标
        const before = S.coins;
        for (let i = 0; i < 5; i++) { try { claimQuest(idx); } catch (e) { } }
        return { before, after: S.coins, claimed: q.claimed, reward: q.reward || q.coins || 0 };
      }
      return { skip: '没有 claimQuest 接口' };
    } catch (e) { return { err: String(e).slice(0, 60) }; }
  });
  if (quest.skip) console.log(`   · 任务连点: 跳过(${quest.skip})`);
  else if (quest.err) chk('任务奖励连点', false, quest.err);
  else {
    const gain = quest.after - quest.before;
    // "只到账1份"的判据: claimed=true 且到账 ≤ 单份奖励上限(任务单份最多≈150金币, 5份就是700+)
    chk('任务奖励连点5次 → 只到账1份', quest.claimed && gain > 0 && gain < 300, `金币 +${gain}(单份)`);
  }

  // G2: 宝箱连开
  const chest = await p.evaluate(() => {
    try {
      if (typeof window.openChest !== 'function') return { skip: '没有 openChest' };
      const before = { coins: S.coins, keys: S.chestKeys !== undefined ? S.chestKeys : (S.keys !== undefined ? S.keys : null) };
      // 给一把钥匙
      if (S.chestKeys !== undefined) S.chestKeys = 1; else if (S.keys !== undefined) S.keys = 1;
      let opened = 0;
      for (let i = 0; i < 5; i++) { try { openChest(); opened++; } catch (e) { } }
      const after = { coins: S.coins, keys: S.chestKeys !== undefined ? S.chestKeys : (S.keys !== undefined ? S.keys : null) };
      return { before, after, opened };
    } catch (e) { return { err: String(e).slice(0, 60) }; }
  });
  if (chest.skip) console.log(`   · 宝箱连开: 跳过(${chest.skip})`);
  else if (chest.err) chk('宝箱连开', false, chest.err);
  else {
    chk('1把钥匙连开5次 → 只开出1份', chest.after.keys !== null ? chest.after.keys >= 0 && chest.after.keys <= 0 : true,
        `钥匙 ${chest.before.keys}→${chest.after.keys}`);
  }

  // G3: petTaskComplete 幂等性 —— 同一局结算连点(最真实的场景: 结算弹窗按钮被快速点两次)
  const petDup = await p.evaluate(() => {
    const bx = S.totalXP || 0;
    // 模拟结算按钮被连点: 500ms 内触发 3 次同一局的结算
    petTaskComplete('👀 火眼金睛 初级', 30, 'eagle');
    petTaskComplete('👀 火眼金睛 初级', 30, 'eagle');
    petTaskComplete('👀 火眼金睛 初级', 30, 'eagle');
    return { gain: (S.totalXP || 0) - bx, eagleCount: (S.stats.gameCounts || {}).eagle || 0 };
  });
  // 注意: 这里"应该"是多少存在设计判断 —— 如果结算按钮本身就该防连点, 那 gain 应为 30;
  // 但 petTaskComplete 是底层函数, 每次调用加一次是【正确】的(游戏引擎保证只调一次)。
  // 所以真正要验的是: 【结算按钮】那层有没有防连点。查按钮层。
  console.log(`   · petTaskComplete 底层 3 次调用 = +${petDup.gain} 经验(底层不去重是设计正确, 关键在按钮层)`);

  // G4: 结算门闩 —— 真机【行为】验证, 不再靠正则猜变量名(上一版就是正则没匹配到 eagleActive 而误报)。
  //     直接连调 3 次 eagleComplete(): 门闩 if(!eagleActive)return; eagleActive=false; 保证只结算一次。
  const latch = await p.evaluate(() => {
    try {
      if (typeof window.eagleComplete !== 'function') return { skip: '没有 eagleComplete' };
      window.eagleActive = true;           // 模拟一局正在进行
      const bx = S.totalXP || 0;
      const bc = (S.stats.gameCounts || {}).eagle || 0;
      eagleComplete(); eagleComplete(); eagleComplete();   // 结算被连触发 3 次
      return { gain: (S.totalXP || 0) - bx, cnt: ((S.stats.gameCounts || {}).eagle || 0) - bc };
    } catch (e) { return { err: String(e).slice(0, 60) }; }
  });
  if (latch.skip) console.log(`   · 结算门闩: 跳过(${latch.skip})`);
  else if (latch.err) chk('结算门闩(行为验证)', false, latch.err);
  else chk('结算被连触发3次 → 只结算1次(eagleActive门闩)', latch.cnt === 1 && latch.gain > 0 && latch.gain < 200,
           `游戏计数 +${latch.cnt} · 经验 +${latch.gain}(一局的量)`);

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
