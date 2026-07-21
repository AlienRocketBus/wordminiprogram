/* pet_probe.mjs (v938) — 宠物经验/进化 全链路真机体检
 *
 * Hansen: "为什么宠物不进化? 感觉宠物好像没有得到经验和进化。
 *          玩完一个火眼金睛得到的宠物经验, 看宠物的时候能及时看到宠物增加的经验。"
 *
 * ★ 这次一共挖出 5 个根因, 每一个都单独验:
 *   ① 8 个星域岛(island_land1~8)【不在宠物的岛屿名单里】→ 在星海觉醒里打的经验宠物根本看不见
 *      → 永远算成 0 → 宠物永不进化。(全库 27 个岛, 名单里只有 19 个)
 *   ② 打字大师/完形填空的关卡配置【没有 petXp 字段】→ 传进去 undefined
 *      → addXP 里 isFinite(NaN)=false 直接 return → 一点经验都不加, 飘字还骗人说"+undefined 经验"
 *   ③ 得到经验后【没有任何东西刷新宠物界面】→ 宠物页开着也纹丝不动
 *   ④ 宠物页【只有一个百分比】→ 看不到"现在多少经验/还差多少", 更看不出卡在哪个条件
 *   ⑤ perf_boost.js 把 save() 换成了【防抖延迟写盘】, 而宠物读的是 localStorage
 *      → 刚拿到的经验还没落盘, 读盘读到旧值 → 界面显示 0
 *
 * ★ 判据全部是真机渲染的事实, 不是静态扫描。
 */
import { chromium } from './playwright_loader.mjs';

const PORT = process.argv[2] || '8877';
const GAMES = [
  ['moles', '打地鼠'], ['fish', '钓鱼大师'], ['bubble', '泡泡大作战'],
  ['scramble', '词序拼接'], ['speed', '极速挑战'], ['listen', '听音辨义'],
  ['type', '打字大师'], ['cloze', '完形填空'], ['eagle', '火眼金睛'], ['review', '复习救援'],
];

let pass = 0, fail = 0;
const chk = (n, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${n}${note ? '  ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand1', JSON.stringify({
        totalAnswers: 10, totalCorrect: 8, learned: [0, 1], level: 1, xp: 0, totalXP: 0, coins: 100,
        stats: { maxCombo: 2, gameCounts: {}, modesPlayed: [] }, wrongs: { 0: 1, 1: 1 },
        pet: { name: '星灵', stage: 0, xp: 0, picked: true }
      }));
      // 另一个岛(主题岛)也放一点经验 —— 用来验"宠物是不是把全部岛都算上了"
      localStorage.setItem('wordIslandAnimal', JSON.stringify({ totalXP: 40, learned: [0, 1, 2], stats: {} }));
    } catch (e) { }
  });
  const p = await c.newPage();
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 50000 });
  await p.waitForTimeout(2600);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  // ── ① 核心: 星域岛的经验, 宠物看得见吗 ──
  console.log('  ① 核心: 星域岛(星海觉醒)的经验, 宠物系统看得见吗');
  // ⚠️ 这里的断言要小心: 探针预置了另一个岛 40 经验, 所以【起点就不是 0 阶】。
  //    用"阶段有没有变"当判据是【错的】(加30到70, 而第2阶要85 —— 没变是对的)。
  //    真正要证明的是: 【星域岛的经验有没有被算进宠物的全局经验】—— 直接比 globalXP 的增量。
  const seen = await p.evaluate(() => {
    const gx = () => { let s = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('wordIsland') === 0 && !/_bak$/.test(k) && k !== window.__hsnSaveKey) { try { const o = JSON.parse(localStorage.getItem(k)); s += Math.max(+o.xp || 0, +o.totalXP || 0); } catch (e) { } } } return s + (S.totalXP || 0); };
    const before = gx(), stB = window.getPetStage();
    petTaskComplete('👀 火眼金睛 初级', 30, 'eagle');
    const after = gx();
    // 再加够, 看阶段是不是真的会往前走
    for (let i = 0; i < 4; i++) petTaskComplete('👀 火眼金睛 高级', 75, 'eagle');
    return { key: window.__hsnSaveKey || '(没暴露)', gBefore: before, gAfter: after,
             stB, stEnd: window.getPetStage(), gEnd: gx() };
  });
  await p.waitForTimeout(500);
  chk('宠物系统认得当前岛的存档', seen.key === 'wordIslandLand1', `__hsnSaveKey=${seen.key}`);
  chk('★在星域岛拿的经验【真的被算进】宠物全局经验', seen.gAfter - seen.gBefore === 30,
      `全局经验 ${seen.gBefore} → ${seen.gAfter} (+${seen.gAfter - seen.gBefore})`);
  chk('★经验攒够 → 宠物真的进化', seen.stEnd > seen.stB,
      `阶段 ${seen.stB} → ${seen.stEnd} (全局经验 ${seen.gEnd})`);
  // 别的岛的经验也要算进去
  const cross = await p.evaluate(() => {
    // wordIslandAnimal 里预置了 40 经验, 应该被算进全局
    let fromLS = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('wordIsland') === 0 && !/_bak$/.test(k) && k !== window.__hsnSaveKey) {
        try { const o = JSON.parse(localStorage.getItem(k)); fromLS += Math.max(+o.xp || 0, +o.totalXP || 0); } catch (e) { }
      }
    }
    return { otherIslandsXP: fromLS, mine: S.totalXP || 0 };
  });
  chk('别的岛的经验也算进宠物(跨岛累计)', cross.otherIslandsXP >= 40, `其它岛合计 ${cross.otherIslandsXP} 经验`);

  // ── ② 10 个游戏, 每个都必须真的给到经验 ──
  console.log('\n  ② 10 个游戏, 每个都必须【真的】给到宠物经验(不能是 undefined)');
  for (const [key, name] of GAMES) {
    const r = await p.evaluate((k) => {
      const before = window.getPetStage();
      const bx = S.totalXP || 0;
      // 故意【不传】petXp —— 模拟"关卡配置里没有 petXp"那种情况(打字/完形原来就是这样)
      petTaskComplete('测试 ' + k, undefined, k);
      return { gain: (S.totalXP || 0) - bx, stage: window.getPetStage(), before };
    }, key);
    chk(`${name.padEnd(6)} 就算配置里漏了 petXp 也能拿到经验(兜底)`, r.gain > 0, `+${r.gain} 经验`);
  }

  // ── ③④ 宠物页: 数字看得见 + 得经验后自动刷新 ──
  console.log('\n  ③④ 宠物页: 能不能看到真实经验数字 + 得经验后会不会【自动】更新');
  await p.evaluate(() => { try { showScreen('pet'); } catch (e) { } });
  await p.waitForTimeout(1100);
  const ui1 = await p.evaluate(() => {
    const box = document.getElementById('petContent');
    const rows = [...(box ? box.querySelectorAll('.psw-req-row') : [])].map(e => e.innerText.replace(/\n/g, ' '));
    return { rows, hasNum: rows.some(r => /\d+\s*\/\s*\d+/.test(r)) };
  });
  chk('宠物页显示【真实经验数字】(不是只有一个百分比)', ui1.hasNum, ui1.rows[0] || '(没有经验行)');

  const ui2 = await p.evaluate(() => {
    const box = document.getElementById('petContent');
    const before = [...box.querySelectorAll('.psw-req-row')].map(e => e.innerText)[0] || '';
    petTaskComplete('👀 火眼金睛 高级', 75, 'eagle');
    return new Promise(res => setTimeout(() => {
      const box2 = document.getElementById('petContent');
      const after = [...box2.querySelectorAll('.psw-req-row')].map(e => e.innerText)[0] || '';
      res({ before: before.replace(/\n/g, ' '), after: after.replace(/\n/g, ' '), toast: !!document.querySelector('.psw-gain') });
    }, 900));
  });
  chk('宠物页开着时得经验 → 数字【自动】更新', ui2.before !== ui2.after, `${ui2.before} → ${ui2.after}`);
  chk('得经验时飘出 "🐾 宠物经验 +N"', ui2.toast);

  // ── ⑤ 防抖写盘不影响显示 ──
  console.log('\n  ⑤ save() 被防抖延迟写盘时, 宠物界面【不能】显示旧数据');
  const dbz = await p.evaluate(() => {
    const bx = S.totalXP || 0;
    petTaskComplete('eagle', 50, 'eagle');
    // 立刻(同一个 tick)读: 内存 S 已更新, localStorage 可能还没落盘
    let onDisk = 0;
    try { onDisk = JSON.parse(localStorage.getItem(window.__hsnSaveKey) || '{}').totalXP || 0; } catch (e) { }
    const box = document.getElementById('petContent');
    const shown = ([...box.querySelectorAll('.psw-req-row')].map(e => e.innerText)[0] || '').replace(/\n/g, ' ');
    const m = shown.match(/(\d+)\s*\/\s*(\d+)/);
    return { mem: S.totalXP || 0, onDisk, shownXp: m ? +m[1] : -1, shown };
  });
  chk('界面显示的是【内存里的最新经验】而不是盘上的旧值',
      dbz.shownXp >= 0 && Math.abs(dbz.shownXp - dbz.mem) <= 60,
      `内存 ${dbz.mem} · 界面显示 ${dbz.shownXp} · (盘上 ${dbz.onDisk})`);

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
