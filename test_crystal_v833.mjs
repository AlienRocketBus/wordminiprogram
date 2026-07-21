import { chromium } from './playwright_loader.mjs';
const PORT = 8946;
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
// 与正式小程序一致使用手机视口，避免桌面外壳把页面导航到 _frame 选择页。
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  serviceWorkers: 'block'
});
const errors = [];
page.on('console', m => { if (m.type() === 'error') { const t = m.text(); const u = (m.location() && m.location().url) || ''; if (!/favicon|autoplay|net::ERR/i.test(t) && !/favicon/i.test(u)) errors.push('C:' + t); } });
page.on('pageerror', e => errors.push('P:' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/island_animal.html`, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForFunction(() => window.HansenCrystal && window.HansenCrystal._onAnswer && window.allW && window.allW.length > 0, { timeout: 15000 });

const results = await page.evaluate(() => {
  const KEY = 'hsn_crystal_animal';
  const R = []; const ok = (n, c, info) => R.push({ n, pass: !!c, info: info || '' });
  const loadM = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const saveM = (m) => { const raw=JSON.stringify(m); localStorage.setItem(KEY,raw); localStorage.setItem(KEY+'_bak',raw); };
  const setW = (i, w) => { const m = loadM(); m[i] = w; saveM(m); };
  const getW = (i) => loadM()[i];
  const gems = () => parseInt(localStorage.getItem('hansen_wallet_gems') || '0', 10);
  const setG = (k, v) => localStorage.setItem(k, String(v));
  const getG = (k) => parseInt(localStorage.getItem(k) || '0', 10);
  const A = window.HansenCrystal._onAnswer;
  const PAST = '2000-1-1';
  const killMemo = () => { const e = document.getElementById('hsnCrystalMemo'); if (e) e.remove(); };
  const memoShown = () => { const e = document.getElementById('hsnCrystalMemo'); return !!(e && e.classList.contains('show')); };
  const memoText = () => { const e = document.getElementById('hsnCrystalMemo'); return e ? e.textContent : ''; };
  const reset = () => { saveM({}); setG('hsn_crystal_total', 0); setG('hsn_crystal_gems', 0); setG('hsn_crystal_rank', 0); localStorage.setItem('hansen_wallet_gems', '0'); localStorage.removeItem('hsn_crystal_boost_until'); localStorage.removeItem('hsn_crystal_isldone_animal'); };

  // ===== VT1: 答对但未锁星(进度0→1) → 不弹浮层(不刷屏·v833核心) =====
  reset(); killMemo();
  A(0, true);                       // 进度 0→1, 未锁星
  ok('VT1 答对未锁星→浮层不弹(快游戏不刷屏)', !memoShown() && !document.getElementById('hsnCrystalMemo'), 'shown=' + memoShown());
  ok('VT1 但进度确实涨了(p=1·机制没变)', getW(0) && getW(0).p === 1, JSON.stringify(getW(0)));

  // ===== VT2: 答对锁星 → 弹一下⭐(稀少里程碑) =====
  reset(); killMemo();
  setW(1, { lv: 1, p: 1, d: PAST, done: 0 });  // 差1次填满·隔天
  A(1, true);                                   // p=2 → 锁星
  ok('VT2 锁一颗星→浮层弹出(show)', memoShown(), 'shown=' + memoShown());
  ok('VT2 浮层是⭐锁星样式(含★/记忆+1)', /⭐|★|记忆/.test(memoText()), memoText().slice(0, 40));
  ok('VT2 锁星生效(lv 1→2)', getW(1) && getW(1).lv === 2, JSON.stringify(getW(1)));

  // ===== VT3: 答对但今天这词已锁过(进度满+d=today) → 不弹 =====
  reset(); killMemo();
  const T = (function(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })();
  setW(2, { lv: 2, p: 2, d: T, done: 0 });   // 今天已锁过·进度已满
  A(2, true);                                 // 不该再锁·不该弹
  ok('VT3 今天已锁该词·再答对→不弹浮层', !memoShown() && !document.getElementById('hsnCrystalMemo'), 'shown=' + memoShown());

  // ===== RT1: 一天只锁1星(防刷核心·回归) =====
  reset();
  setW(3, { lv: 0, p: 0, d: '', done: 0 });
  A(3, true); A(3, true);          // 锁星1
  A(3, true); A(3, true); A(3, true);   // 同天狂答
  ok('RT1 同一天狂答→只锁1星(防刷)', getW(3) && getW(3).lv === 1, JSON.stringify(getW(3)));

  // ===== RT2: 答错不倒扣(回归) =====
  reset();
  setW(4, { lv: 3, p: 1, d: PAST, done: 0 });
  A(4, false);
  ok('RT2 答错不倒扣(lv=3,p=1不变)', getW(4) && getW(4).lv === 3 && getW(4).p === 1, JSON.stringify(getW(4)));

  // ===== RT3: 记忆强化锁星翻倍(回归) =====
  reset();
  window.HansenCrystal.grantBoost(60, true);
  setW(5, { lv: 1, p: 1, d: PAST, done: 0 });
  A(5, true);   // 锁星·翻倍
  ok('RT3 记忆强化锁星翻倍(lv 1→3)', getW(5) && getW(5).lv === 3, JSON.stringify(getW(5)));
  localStorage.removeItem('hsn_crystal_boost_until');

  // ===== RT4: 满5星永久掌握→发4钻(回归) =====
  reset();
  const g0 = gems();
  setW(6, { lv: 4, p: 1, d: PAST, done: 0 });
  A(6, true);   // 锁星→满5→永久掌握
  ok('RT4 满5星永久掌握(done=1)', getW(6) && getW(6).done === 1, JSON.stringify(getW(6)));
  ok('RT4 永久掌握→发4钻', gems() - g0 === 4, `+${gems() - g0}`);

  // ===== RT5: 老存档无p字段兼容(回归) =====
  reset();
  setW(7, { lv: 2, d: PAST, done: 0 });   // 无p
  A(7, true);
  ok('RT5 老存档无p→自动补0并涨进度', getW(7) && getW(7).p === 1 && getW(7).lv === 2, JSON.stringify(getW(7)));

  // ===== RT6: 永久掌握仍弹💎结晶弹窗(不受浮层精简影响) =====
  // (crystallize 的 toast 是独立的·只验证 done 流程跑通无报错·已在RT4覆盖发钻)
  ok('RT6 stats无报错·perWord=4', (function(){ try { return window.HansenCrystal.stats().perWord === 4; } catch (e) { return false; } })(), '');

  return R;
});
await browser.close();
console.log('\n===== v833 浮层时机 + 核心回归 测试 =====\n');
let p = 0, f = 0;
for (const r of results) { console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.pass ? '' : '  → ' + r.info}`); r.pass ? p++ : f++; }
console.log(`\n通过 ${p}/${p + f}`);
if (errors.length) { console.log('\n⚠️ 错误:'); errors.forEach(e => console.log('  ' + e)); } else console.log('✅ 无 console.error/pageerror');
console.log('\n' + (f === 0 && errors.length === 0 ? '🎉 全部通过·零错误' : '❌ 有失败'));
process.exit(f === 0 && errors.length === 0 ? 0 : 1);
