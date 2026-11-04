#!/usr/bin/env node
/* test_reconcile_busy_cloud_v1164.mjs —— 「登录时没对上账、稍后再对一次」不许打断任何一层页面里的联机（审查 R3-F1、R3 minor-2）
 *
 * 岛屿页里嵌着一层藏起来的预热页（赛季岛），两层各有一份账号 / 云存档 / 备份 / 联机模块。
 * 以前「再对一次账」只看**自己这一层**是不是在对战：
 *   · 对战在岛上、藏着的赛季岛去对账 → 恢复云端 → 把外层岛重新载入（对战中整页刷掉，对手白拿一局）；
 *   · 对战在赛季岛里、岛去对账 → 岛自己重新载入，把正在对战的赛季岛一起刷掉；
 *   · 进房 / 开房的那几秒、天梯页开着，也不算「忙」。
 * 真页面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。「在对战」用把那一层的 isBusy() 换成「对战中」来摆出来
 *（要测的是「每一层都看」，不是 isBusy 本身）；天梯页是真打开的。
 *
 *   ① 对战在岛上，赛季岛去对账 → 不恢复、不刷新
 *   ② 对战在赛季岛里，岛去对账 → 不恢复、不刷新
 *   ③ 岛上正在开房（creating）→ 岛自己去对账也不对（以前只看对战 / 等人）
 *   ④ 岛上开着天梯页，赛季岛去对账 → 不对
 *   ⑤ 都闲下来以后，下一次触发（网通了）照常对账：云端的 20 个词恢复到这台手机
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('稍后再对账：不打断任何一层页面里的联机 · 真 SDK（审查 R3-F1）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);

const ISLAND = { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenBackup && window.HansenPkRoomUI) };
async function login(p, num) {
  const r = await p.eval(async ([n, c]) => {
    try {
      await window.HansenAuth.sendPhoneCode(n);
      const x = await window.HansenAuth.loginByPhoneCode(c);
      const s = await window.HansenAuth.ensureSession();
      return { ok: !!(s && s.ok), uid: String((s && s.uid) || (x && x.uid) || ''), sync: (x && x.sync) || null };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, [num, emu.knobs.verificationCode]);
  if (r && r.uid) { p.uid = r.uid; p.cloudUid = r.uid; names[r.uid] = p.name; }
  await t.ok(r && r.ok && r.uid, `[${p.name}] 登录 ${num.slice(-4)}（对账：${r && r.sync ? (r.sync.action || r.sync.reason) : '—'}）`, () => explain(JSON.stringify(r)));
  return r || {};
}
const words = (p) => p.eval(() => { try { return (JSON.parse(localStorage.getItem('wordIslandFood') || '{}').learned || []).length; } catch (e) { return -1; } });
const setWords = (p, n) => p.eval((k) => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: Array.from({ length: k }, (_, i) => i + 1) })); return true; }, n);
const RETRY = /上次登录时没对上账 → 再对一次/;

try {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
  const NUM = '13400000088';
  /* 平板上 20 个词已经在云端 */
  const T = await H.openPhone(browser, emu, srv.origin, Object.assign({ name: '平板' }, ISLAND));
  live.push(T);
  await login(T, NUM);
  await setWords(T, 20);
  const up = await T.eval(() => window.HansenCloudSave.syncNow({ force: true, rewrite: true }));
  await t.ok(up && up.ok, '平板上 20 个词已经在云端', () => explain());
  await T.close(); live.splice(live.indexOf(T), 1);

  /* 新手机：岛页 + 藏着的赛季岛都就绪 */
  const N = await H.openPhone(browser, emu, srv.origin, Object.assign({ name: '新手机' }, ISLAND));
  live.push(N);
  await setWords(N, 3);
  const seasonOf = () => N.page.frames().find((f) => /island_season\.html/.test(f.url()));
  const sReady = await H.until(async () => {
    const f = seasonOf();
    return (f && await f.evaluate(() => !!(window.HansenAuth && window.HansenCloudSave && window.HansenBackup && window.HansenPkRoomUI)).catch(() => false)) ? f : null;
  }, { timeout: 40000, interval: 500 });
  await t.ok(!!sReady, `岛页里嵌着赛季岛，模块都就绪（${sReady ? '有' : '没有'}）`, () => explain());
  if (!sReady) throw new Error('没有赛季岛');

  /* 登录那一下读不到云端 → 「还没对上账」 */
  const blk = emu.fault({ db: true, collection: 'hansen_saves', do: 'abort' });
  const ln = await login(N, NUM);
  blk.remove();
  const tFail = Date.now();
  await t.ok(ln.sync && ln.sync.action === 'cloud-unreachable', `登录时云端读不到（对账：${ln.sync && ln.sync.action}）`, () => explain());

  /* 每一层：记号（重新载入就没了）+ 可以摆成「忙」的 isBusy */
  const prep = () => {
    window.__r3mk = 1;
    const U = window.HansenPkRoomUI;
    if (!window.__r3ob) window.__r3ob = U.isBusy;
    window.__r3busy = (o) => { U.isBusy = o ? () => Object.assign({ on: true, battle: false, waiting: false, joining: false, creating: false }, o) : window.__r3ob; return true; };
    return true;
  };
  const island = N.page.mainFrame();
  const fr = { island, season: sReady };
  await island.evaluate(prep); await sReady.evaluate(prep);
  /* 等「刚试过」的 20 秒过去时，两层都摆成「对战中」—— 页面自己的定时器这时触发也照样被挡住（改之前、改之后都挡） */
  await island.evaluate(() => window.__r3busy({ battle: true })); await sReady.evaluate(() => window.__r3busy({ battle: true }));
  const wait = 21000 - (Date.now() - tFail);
  if (wait > 0) await H.sleep(wait);

  const state = async () => {
    const one = (f) => f.evaluate(() => ({ mk: window.__r3mk === 1, tr: String(window.HansenAuth._trace ? window.HansenAuth._trace() : '') })).catch(() => ({ mk: false, tr: '' }));
    const a = await one(island), b = await one(sReady);
    return { reloaded: !a.mk || !b.mk, retried: RETRY.test(a.tr) || RETRY.test(b.tr), n: await words(N),
             flag: await N.eval(() => window.HansenCloudSave.reconcileState()) };
  };
  let ladderOn = false;
  /* 先摆上这一段要的「忙」，再撤掉不要的 —— 中间不会有「两层都闲着」的一刻（别的触发正好落在那一刻就不准了） */
  async function apply(c) {
    for (const k of ['island', 'season']) if (c[k]) await fr[k].evaluate((o) => window.__r3busy(o), c[k]);
    if (c.ladder) {
      ladderOn = await island.evaluate(() => { window.HansenLadderUI.open(); const el = document.getElementById('hsn_ladder_screen'); return !!(el && el.classList.contains('on')); });
      await t.ok(ladderOn, `天梯页真的打开了（${ladderOn ? '开着' : '没开'}）`, () => explain());
    }
    for (const k of ['island', 'season']) if (!c[k]) await fr[k].evaluate(() => window.__r3busy(null));
  }
  const CASES = [
    { id: '①', label: '对战在岛上，藏着的赛季岛去对账', island: { battle: true }, season: null, trigger: 'season' },
    { id: '②', label: '对战在赛季岛里，岛去对账', island: null, season: { battle: true }, trigger: 'island' },
    { id: '③', label: '岛上正在开房（creating），岛自己去对账', island: { creating: true }, season: null, trigger: 'island' },
    { id: '④', label: '岛上开着天梯页，赛季岛去对账', island: null, season: null, ladder: true, trigger: 'season' }
  ];
  /* 只跑某几段（排查 / 证明「改回去就红」用）：R3_ONLY=①,③ node 这个文件（⑤ 每次都跑） */
  const only = String(process.env.R3_ONLY || '').split(',').filter(Boolean);
  for (const c of CASES) {
    if (only.length && only.indexOf(c.id) < 0) continue;
    t.section(c.id + ' ' + c.label);
    await apply(c);
    await fr[c.trigger].evaluate(() => { window.HansenAuth.uploadGate(); return true; });
    await H.sleep(5000);
    const s = await state();
    await t.ok(!s.reloaded && !s.retried && s.n === 3 && s.flag === N.uid,
      `${c.label}：没去对账、没恢复、没刷新（${s.reloaded ? '❌ 页面被重新载入了' : '没刷新'}；${s.retried ? '❌ 去对账了' : '没对账'}；本机 ${s.n} 个词；还没对上账的记号：${s.flag || '已清'}）`, () => explain());
    if (s.reloaded) break;   /* 页面已经被刷掉了，后面几段摆不出来 */
  }

  t.section('⑤ 都闲下来以后，下一次触发照常对账');
  await island.evaluate((lo) => { if (window.__r3busy) window.__r3busy(null); if (lo) window.HansenLadderUI.close(); return true; }, ladderOn).catch(() => {});
  await sReady.evaluate(() => { if (window.__r3busy) window.__r3busy(null); window.dispatchEvent(new Event('online')); return true; }).catch(() => {});   /* 网通了 */
  await H.sleep(7000);
  try { await N.page.waitForFunction(ISLAND.ready, null, { timeout: 30000 }); } catch (e) { /* 没刷新 */ }
  await H.sleep(800);
  const n5 = await words(N), f5 = await N.eval(() => window.HansenCloudSave.reconcileState());
  await t.ok(n5 === 20 && !f5, `网通了（下一次触发）：照常对账，云端的 20 个词恢复到了这台手机（本机 ${n5} 个；还没对上账的记号：${f5 || '已清'}）`, () => explain());
} catch (e) {
  await t.ok(false, '脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
