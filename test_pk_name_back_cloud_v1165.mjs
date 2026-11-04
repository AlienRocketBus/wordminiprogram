/* test_pk_name_back_cloud_v1165.mjs —— 拼写大PK「✏️ 先起个名字」框上按手机返回：关的是这个框，不是它后面的大厅
 *
 * 为什么有这个测试（v1165 合并 v1164 后的复查第 4 轮发现）：
 *   起名框 kNameAsk 是 v1164 新加的；v1165 的「返回只退一步」按一张表认浮层（hansen_home_link.js 的 KNOWN），
 *   表里没有它，它的两个按钮（「开始吧」「先不玩联机」）又认不出是关闭按钮 —— 于是返回键跳过它、
 *   把后面的拼写大PK 大厅关了：框还盖在那儿，再按一下整个岛都退了。两条线各自都没有这个问题，是合并后才有的。
 * 合同（真 SDK + 模拟云端，首页外壳里的动物岛，page.goBack() = 手机返回键）：
 *   ① 没起名字的孩子点「公开房间」→ 起名框出来
 *   ② 按 1 次返回：起名框关掉（= 点「先不玩联机」），大厅还在，岛还开着
 *   ③ 再按 1 次返回：大厅关掉，岛还开着（只退一步）
 */
import * as H from './cloudbase_e2e_harness.mjs';
const t = H.checker('拼写大PK 起名框 · 手机返回只关这一层（v1165 复查第 4 轮）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 20 } });
const HOME = { path: '/index.html', ready: () => typeof window.openIsland === 'function' && !!window.HansenAuth };
const G = await H.openPhone(browser, emu, srv.origin, Object.assign({ name: 'G' }, HOME));
const explain = () => '';
try {
  const r = await H.loginPhone(G, '13500000077');
  await t.ok(!!(r && r.ok), '登录好了（没起名字）');
  if ((await G.hitTest('#__hansen_onboarding button', { hasText: '跳过', timeout: 3000 })).ok) await G.tap('#__hansen_onboarding button', { hasText: '跳过' });
  await G.eval(() => { window.openIsland('island_animal.html'); return true; });
  const fr = await H.until(async () => {
    const f = G.page.frames().find((x) => /island_animal/.test(x.url()) && x.parentFrame() === G.page.mainFrame());
    if (!f) return null;
    return (await f.evaluate(() => !!(window.HansenSbPK && window.HansenPkRoomUI && typeof window.__hsnIslandBack === 'function')).catch(() => false)) ? f : null;
  }, { timeout: 45000, interval: 500 });
  await t.ok(!!fr, '首页里的动物岛打开了');
  /* 岛的欢迎框也算一步（v1165 只退一步）：先点掉 */
  for (let i = 0; i < 4; i++) { if (!(await fr.evaluate(() => !!document.querySelector('#alertModal.show button')).catch(() => false))) break; await fr.locator('#alertModal.show button').first().tap(); await H.sleep(500); }
  const st = async () => {
    const shell = await G.eval(() => ({ islandOpen: (document.getElementById('islandFrameWrap') || {}).style.display !== 'none' }));
    const isl = await fr.evaluate(() => { const vis = (id) => { const e = document.getElementById(id); if (!e) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && e.getClientRects().length > 0; }; return { hall: vis('hsn_pk_screen'), nameAsk: vis('kNameAsk') }; });
    return Object.assign(shell, isl);
  };
  t.section('① 点「公开房间」→ 起名框');
  await fr.evaluate(() => { window.HansenSbPK.open(); return true; }); await H.sleep(700);
  await fr.locator('#kRooms').tap(); await H.sleep(800);
  const s0 = await st();
  await t.ok(s0.nameAsk && s0.hall && s0.islandOpen, `起名框出来了，大厅在后面（${JSON.stringify(s0)}）`);
  t.section('② 按 1 次返回');
  await G.page.goBack(); await H.sleep(1200);
  const s1 = await st();
  await t.ok(!s1.nameAsk, `起名框关掉了（${JSON.stringify(s1)}）—— 以前框还在，后面的大厅反倒被关了`);
  await t.ok(s1.hall && s1.islandOpen, `大厅还在、岛还开着（只退一步）`);
  t.section('③ 再按 1 次返回');
  await G.page.goBack(); await H.sleep(1500);
  const s2 = await st();
  await t.ok(!s2.hall && !s2.nameAsk && s2.islandOpen, `大厅关掉了，岛还开着（${JSON.stringify(s2)}）`);
} catch (e) {
  await t.ok(false, '这段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400));
}
t.summary();
try { await G.close(); } catch (e) { /* 已关 */ }
await browser.close(); srv.close();
process.exit(t.failed ? 1 : 0);
