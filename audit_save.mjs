/* audit_save.mjs — C存档安全 + F边界数据 真机体检
 *
 * C. 存档安全: 用户手机上 localStorage 可能出现【半截JSON/乱码/超旧格式】(微信清缓存、写盘被打断)。
 *    如果 load() 不设防, 结果就是【白屏 + 存档全丢】—— 发布后最致命的事故。
 * F. 边界数据: 0经验/满级/宠物满阶/空错题本/巨大数值 —— 任何一种都不能崩。
 */
import { chromium } from './playwright_loader.mjs';

const PORT = process.argv[2] || '8877';
let pass = 0, fail = 0;
const chk = (n, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${n}${note ? '  ' + note : ''}`); };

async function boot(b, saveVal, key) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (saveVal !== undefined) {
    await c.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { } }, [key || 'wordIslandLand1', saveVal]);
  }
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
  try {
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(2400);
  } catch (e) { errs.push('LOAD FAIL'); }
  const st = await p.evaluate(() => ({
    S: !!window.S, coins: window.S ? S.coins : '-', xp: window.S ? (S.totalXP || 0) : '-',
    homeVisible: !!(document.getElementById('homeScreen') && document.getElementById('homeScreen').offsetHeight > 100),
    bodyText: (document.body.innerText || '').length,
  })).catch(() => ({ S: false, homeVisible: false, bodyText: 0 }));
  return { p, c, errs, st };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });

  console.log('  ══ C. 存档安全: 坏存档绝不能白屏/丢档 ══');
  // C1 半截 JSON(写盘被打断)
  let r = await boot(b, '{"totalXP":500,"learned":[1,2,3],"coi');
  chk('半截JSON存档 → 页面照常起来(不白屏)', r.errs.length === 0 && r.st.S && r.st.homeVisible, `报错${r.errs.length} 首页${r.st.homeVisible}`);
  await r.c.close();
  // C2 纯乱码
  r = await boot(b, '\u0000\uFFFD###not-json###');
  chk('乱码存档 → 页面照常起来', r.errs.length === 0 && r.st.S && r.st.homeVisible);
  await r.c.close();
  // C3 类型全错(数字变字符串/数组变对象)
  r = await boot(b, JSON.stringify({ totalXP: "abc", learned: { a: 1 }, coins: null, stats: "x", wrongs: 7, pet: [] }));
  chk('字段类型全错 → 不崩且能自愈', r.errs.length === 0 && r.st.S && r.st.homeVisible, `coins=${r.st.coins}`);
  await r.c.close();
  // C4 备份恢复: 主键坏了, _bak 是好的 → 该从备份恢复
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try {
        localStorage.setItem('wordIslandLand1', '{"broken');
        localStorage.setItem('wordIslandLand1_bak', JSON.stringify({ totalXP: 777, learned: [0, 1], coins: 99, stats: {}, wrongs: {} }));
      } catch (e) { }
    });
    const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(1));
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(2400);
    const got = await p.evaluate(() => (window.S ? (S.totalXP || 0) : -1));
    chk('主存档坏 + 备份好 → 自动从备份恢复(经验777没丢)', errs.length === 0 && got === 777, `恢复到 totalXP=${got}`);
    await c.close();
  }

  console.log('\n  ══ F. 边界数据: 任何极端状态都不能崩 ══');
  // F1 满级+巨大数值
  r = await boot(b, JSON.stringify({ totalXP: 99999999, xp: 99999999, level: 999, coins: 99999999, diamonds: 9999999, learned: Array.from({ length: 752 }, (_, i) => i), stats: { maxCombo: 9999, gameCounts: { eagle: 9999, moles: 9999 } }, wrongs: {}, pet: { name: '满', stage: 35, xp: 0, picked: true } }));
  chk('满级+巨大数值 → 不崩', r.errs.length === 0 && r.st.homeVisible, `xp=${r.st.xp}`);
  if (r.errs.length === 0) {
    // 宠物页在满阶时也要正常
    await r.p.evaluate(() => { try { showScreen('pet'); } catch (e) { } });
    await r.p.waitForTimeout(1100);
    const pet = await r.p.evaluate(() => {
      const sc = document.getElementById('petScreen');
      const t = (sc && sc.innerText) || '';
      return { has: t.length > 30, final: /终焉|100%|已达/.test(t) };
    });
    chk('宠物满阶(36/36) → 宠物页正常显示"已达终焉"', pet.has && pet.final);
    // 得经验也不能崩
    const gainOk = await r.p.evaluate(() => { try { petTaskComplete('测试', 30, 'eagle'); return true; } catch (e) { return false; } });
    chk('满阶后再得经验 → 不崩', gainOk);
  } else { chk('宠物满阶检查', false, '(前置已崩)'); chk('满阶后得经验', false, '(前置已崩)'); }
  await r.c.close();
  // F2 全新用户(什么都没有)
  r = await boot(b, undefined);
  chk('全新用户(无任何存档) → 正常起步', r.errs.length === 0 && r.st.S && r.st.homeVisible);
  await r.c.close();
  // F3 localStorage 超配额(写不进去)
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (String(k).indexOf('wordIsland') === 0) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
        return orig.apply(this, arguments);
      };
    });
    const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 60)));
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
    await p.waitForTimeout(2200);
    const ok = await p.evaluate(() => { try { save(); addXP(10); return true; } catch (e) { return false; } });
    chk('存储写满(QuotaExceeded) → 游戏继续玩不崩', errs.length === 0 && ok, `报错${errs.length}`);
    await c.close();
  }

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
