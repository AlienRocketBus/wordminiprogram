#!/usr/bin/env node
/* test_ui_flows_cloud_v1164.mjs —— 孩子真会怎么点：手快连点、切到别的 App、点了取消、起个不行的名字、按返回键
 *（审查第一轮 UI-1、UI-3、UI-5、UI-6、UI-7、UI-8、UI-9、UI-10）
 *
 * 真页面、真界面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。点击都是「手指」点（看得见、没被挡住才点）。
 *
 *   ① 连点两下「开始排位」（审查 UI-5）：以前第二下点在「取消，回天梯」上，刚开始就取消了；连点两下「取消」又重新开始。
 *   ② 「已等 N 秒」（审查 UI-7）：天梯等满 20 秒自己开房那一下，以前数字 20 → 0 → 22 乱跳。现在只往上走。
 *   ③ 开始排位以后切到别的 App（审查 UI-10）：以前后台 20 秒照样自己开一间排位房、别的孩子被配进来对着空气打。
 *      现在后台不找不开；离开超过 30 秒，回来先停下、说清楚。
 *   ④ 连点两下「选个玩法」（审查 UI-6）：以前开出两条「等人」的轮询（请求翻倍、两个计时器）。
 *   ⑤ 「正在进房，等房主确认…」点取消（审查 UI-3）：以前抢座位的请求还在路上时点了没反应，要等 15 秒。
 *   ⑥ 起名屏起个资料模块不收的名字（审查 UI-8）：以前不声不响放进去，对手看到「无名蜂」。
 *   ⑦ 岛屿页「点这里设置名字」（审查 UI-9）：以前资料页开在大PK屏后面，点了什么都看不见。
 *   ⑧ 首页里打开岛、在岛里开着房等人 / 正在对战时按手机返回键（审查 UI-1）：
 *      以前岛只是藏起来，房还挂在列表里、别人照样被配进来；现在等人时收房，对战时先问一句。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('孩子真会怎么点 · 真界面 + 真 SDK（审查 UI-1/3/5/6/7/8/9/10）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
let seq = 30;

async function phone(name, nick, opts = {}) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  const r = await H.loginPhone(p, '139000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid; p.uid = r.uid;
  return p;
}
async function closeAll() {
  for (const p of live) {
    await t.ok(!p.errors.length && !p.leaks.length, `[${p.name}] 没有页面报错、没有连外网（${p.errors.slice(0, 2).join(' | ') || '无'}）`);
    await p.close();
  }
  live.length = 0;
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}
/* 手指在同一个位置连点两下（两下之间 150 毫秒） */
async function doubleTap(p, sel) {
  const h = await p.hitTest(sel, { timeout: 8000 });
  if (!h.ok) return h;
  await p.page.touchscreen.tap(h.x, h.y);
  await H.sleep(150);
  await p.page.touchscreen.tap(h.x, h.y);
  return h;
}
const roomsBy = (p) => H.roomDocs(emu).filter((d) => d.kind === 'room' && d.hostId === p.key);
const waitedSecs = (s) => { const m = /已等\s*(?:(\d+)\s*分\s*)?(\d+)\s*秒/.exec(s); return m ? Number(m[1] || 0) * 60 + Number(m[2]) : null; };
async function setHidden(p, hidden) {
  return p.eval((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  }, hidden);
}

{
  try {
    /* ══ ①② 连点「开始排位」+「已等 N 秒」══════════════════════════ */
    t.section('① 连点两下「开始排位」/「取消，回天梯」（审查 UI-5）+ ② 「已等 N 秒」只往上走（审查 UI-7）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('甲', '小蜂甲');
    await toLadderHome(A);
    await doubleTap(A, '#ldGo');
    await H.sleep(1500);
    let s = await A.screen();
    await t.ok(has(s, /正在找对手/) && !has(s, /开始排位/), `连点两下「开始排位」：还在找对手，没被第二下取消（看到：${flat(s).slice(0, 70)}）`, () => explain());
    const seen = [];
    for (let i = 0; i < 27; i++) { const v = waitedSecs(await A.screen()); if (v != null) seen.push(v); await H.sleep(1000); }
    const drops = seen.filter((v, i) => i > 0 && v < seen[i - 1]);
    const selfHosted = roomsBy(A).length > 0;
    await t.ok(selfHosted && seen.length >= 20 && !drops.length, `「已等 N 秒」一路往上走，自己开房那一下也不跳回 0（${selfHosted ? '已自己开房' : '还没开房'}；${seen.join(',')}）`, () => explain());
    await A.tap('#prBack').catch(() => {});
    await A.waitScreen(/开始排位/, { timeout: 10000 }).catch(() => '');
    await A.tap('#ldGo');
    await A.waitScreen(/取消，回天梯/, { timeout: 6000 }).catch(() => '');
    await H.sleep(2500);
    await doubleTap(A, '#ldCancel2');
    await H.sleep(1800);
    s = await A.screen();
    await t.ok(has(s, /开始排位/) && !has(s, /正在找对手/), `连点两下「取消，回天梯」：停在天梯首页，没有又开始找（看到：${flat(s).slice(0, 70)}）`, () => explain());
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ③ 开始排位后切到别的 App ══════════════════════════════════ */
    t.section('③ 开始排位以后切到别的 App（审查 UI-10）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const B = await phone('乙', '小蜂乙');
    await toLadderHome(B);
    await B.tap('#ldGo');
    await B.waitScreen(/正在找对手/, { timeout: 6000 }).catch(() => '');
    await setHidden(B, true);
    await H.sleep(26000);
    await t.ok(roomsBy(B).length === 0, `在后台 26 秒：没有自己开排位房（开了 ${roomsBy(B).length} 间）—— 以前 20 秒就开了`, () => explain());
    await H.sleep(7000);
    await setHidden(B, false);
    const back = await B.waitScreen(/切出去太久/, { timeout: 6000 }).catch((e) => e.lastText || '');
    await t.ok(has(back, /切出去太久/) && roomsBy(B).length === 0, `离开 33 秒再回来：先停下、说清楚（看到：${flat(back).slice(0, 80)}）`, () => explain());
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ④⑤ 连点「选个玩法」+ 进房时点取消 ═════════════════════════ */
    t.section('④ 连点两下「选个玩法」（审查 UI-6）+ ⑤ 「正在进房」时点取消（审查 UI-3）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const C = await phone('房主', '小蜂房主'), D = await phone('客人', '小蜂客人');
    await C.tap('#pkRooms'); await H.answerNameIfAsked(C, C.nick);
    await C.tap('#prNew');
    await doubleTap(C, '.pr_mode[data-mode="C"]');
    await C.waitScreen(/等对手进来/, { timeout: 15000 }).catch(() => '');
    await H.sleep(4000);   /* 先让开房、第一轮轮询过去 */
    const n0 = emu.log.length, t0 = Date.now();
    await H.sleep(12000);
    const q = emu.log.slice(n0).filter((x) => x.uid === C.uid && x.action === 'database.queryDocument').length;
    const qps = q / ((Date.now() - t0) / 1000);
    await t.ok(roomsBy(C).length === 1 && qps <= 0.75, `只开了 ${roomsBy(C).length} 间房、只有一条「等人」的轮询（12 秒里读了 ${q} 次 = ${qps.toFixed(2)} 次/秒）`, () => explain());
    const rid = (roomsBy(C)[0] || {})._id;
    await D.tap('#pkRooms'); await H.answerNameIfAsked(D, D.nick);
    await D.waitScreen(/小蜂房主/, { timeout: 20000 }).catch(() => '');
    const hold = emu.hold({ uid: D.uid, db: true, action: 'database.addDocument' });
    await D.tap(`button[data-rid="${rid}"]`);
    await D.waitScreen(/正在进房/, { timeout: 8000 }).catch(() => '');
    const tc = Date.now();
    await D.tap('#prJoinCancel');
    const left = await H.until(async () => !has(await D.screen(), /正在进房/), { timeout: 8000, interval: 150 });
    const ms = Date.now() - tc;
    await t.ok(left && ms < 2500, `抢座位的请求还在路上时点「取消」：${(ms / 1000).toFixed(1)} 秒就离开了这一屏 —— 以前要等 15 秒`, () => explain());
    hold.release();
    await H.sleep(9000);
    const seat = H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === rid && d.guestId === D.key);
    const cScr = await C.screen();
    await t.ok((!seat || seat.left) && !(await H.battleView(C)) && (await H.alive(C)) && has(cScr, /等对手进来/),
      `晚到的座位被收回（${seat ? 'left=' + seat.left : '已删'}），房主没被拉进一局空对战（房主：${flat(cScr).slice(0, 50)}）`, () => explain());
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ⑥ 起名屏 ══════════════════════════════════════════════════ */
    t.section('⑥ 起名屏起个资料模块不收的名字（审查 UI-8）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
    names = {};
    const E = await phone('丙', '小蜂丙');
    await E.tap('#pkLadder');
    const askHit = await E.hitTest('#pkNameIn', { timeout: 5000 });
    await t.ok(askHit.ok, '第一次进天梯：先让起名字', () => explain());
    for (const bad of ['管理员小明', 'a']) {
      await E.page.fill('#pkNameIn', '');
      await E.tap('#pkNameIn'); await E.type(bad);
      await E.tap('#pkNameOk');
      await H.sleep(500);
      const err = await E.eval(() => (document.getElementById('pkNameErr') || {}).textContent || '');
      const still = (await E.hitTest('#pkNameIn', { timeout: 1000 })).ok;
      await t.ok(still && err.length > 0, `起「${bad}」：留在起名屏、说了为什么（${err}）—— 以前不声不响放进去，对手看到「无名蜂」`, () => explain());
    }
    await E.page.fill('#pkNameIn', '');
    await E.tap('#pkNameIn'); await E.type('小蜂丙');
    await E.tap('#pkNameOk');
    const lh = await E.waitScreen(/开始排位/, { timeout: 8000 }).catch((e) => e.lastText || '');
    const nm = await E.eval(() => (window.HansenSbProfile.readProfile() || {}).name || '');
    await t.ok(has(lh, /开始排位/) && nm === '小蜂丙', `换个正常名字就进去了（资料里的名字：${nm}）`, () => explain());
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ⑦ 岛屿页「点这里设置名字」═══════════════════════════════ */
    t.section('⑦ 岛屿页「点这里设置名字」（审查 UI-9）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
    names = {};
    const F = await H.openPhone(browser, emu, srv.origin, { name: '丁', path: '/island_animal.html',
      ready: () => !!(window.HansenAuth && window.HansenSbPK && window.HansenSbProfile) });
    live.push(F);
    const lf = await H.loginPhone(F, '139000000' + (seq++));
    await t.ok(lf && lf.ok, `[丁] 在岛屿页登录 uid=${lf && lf.uid}`, () => explain(JSON.stringify(lf)));
    await H.dismissIslandWelcome(F);
    await F.tap('.mode-card[onclick*="openSpellPK"]');
    await F.waitScreen(/点这里设置名字/, { timeout: 8000 }).catch(() => '');
    await F.tap('#kMe');
    await H.sleep(700);
    const prof = await F.eval(() => { const el = document.getElementById('hsb_prof'); if (!el) return null; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + Math.min(r.height, 400) / 2)); return { on: el.classList.contains('on'), top: !!hit && el.contains(hit), z: getComputedStyle(el).zIndex }; });
    await t.ok(prof && prof.on && prof.top, `资料页打开在最上层、点得到（${JSON.stringify(prof)}）—— 以前开在大PK屏后面`, () => explain());
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ⑧ 首页里的岛：等人 / 对战时按返回键 ════════════════════════ */
    t.section('⑧ 首页打开岛、开着房等人时按手机返回键（审查 UI-1）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const G = await phone('首页', '小蜂首页', { path: '/index.html', ready: () => typeof window.openIsland === 'function' && !!window.HansenAuth });
    const K = await phone('别人', '小蜂别人');
    /* 第一次打开首页会有「欢迎来到单词大冒险」引导 —— 孩子会点「跳过」 */
    if ((await G.hitTest('#__hansen_onboarding button', { hasText: '跳过', timeout: 3000 })).ok) await G.tap('#__hansen_onboarding button', { hasText: '跳过' });
    await H.sleep(500);
    await G.eval(() => { window.openIsland('island_animal.html'); return true; });
    const fr = await H.until(async () => {
      const f = G.page.frames().find((x) => /island_animal/.test(x.url()));
      if (!f) return null;
      const ok = await f.evaluate(() => !!(window.HansenPkRoomUI && window.HansenPkRoom && window.HansenSbProfile)).catch(() => false);
      return ok ? f : null;
    }, { timeout: 45000, interval: 500 });
    await t.ok(!!fr, '首页里的岛打开了（iframe 里大PK模块就绪）', () => explain());
    if (fr) {
      await fr.evaluate((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过 */ } window.HansenPkRoomUI.open(); return true; }, G.nick);
      await fr.locator('#prNew').tap();
      await fr.locator('.pr_mode[data-mode="C"]').tap();
      const rid2 = await H.until(async () => (roomsBy(G).find((d) => d.status === 'open') || {})._id, { timeout: 15000 });
      const seenByK = rid2 ? await H.until(async () => { const lr = await H.room(K, 'listRooms'); return lr && lr.ok && lr.rooms.some((x) => x._id === rid2); }, { timeout: 20000, interval: 1500 }) : null;
      await t.ok(!!rid2 && !!seenByK, `在岛里开了房，别人列得到（${rid2 || '没开成'}）`, () => explain());
      await G.page.goBack();
      await H.sleep(2500);
      const wrapHidden = await G.eval(() => (document.getElementById('islandFrameWrap') || {}).style.display === 'none');
      const R2 = H.roomDocs(emu).find((d) => d._id === rid2);
      const stillListed = await H.until(async () => { const lr = await H.room(K, 'listRooms'); return lr && lr.ok && !lr.rooms.some((x) => x._id === rid2); }, { timeout: 15000, interval: 1500 });
      await t.ok(wrapHidden && (!R2 || R2.status !== 'open') && !!stillListed,
        `按返回键回首页：岛收起来了、房也关了（${R2 ? R2.status + '/' + (R2.endedBy || '-') : '已删'}），别人列表里不再有它 —— 以前房一直挂着`, () => explain());
    }
    await closeAll();
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
    for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
    live.length = 0;
  }
  try {
    /* ══ ⑨ 自由房的抢答赛：客人的 ELO 按房主真实的分算 ══════════════ */
    t.section('⑨ 自由房的抢答赛也计天梯：客人算 ELO 用房主真实的分（审查 UI-12）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
    names = {};
    const Hs = await phone('高手房主', '高手'), Gs = await phone('客人', '小蜂客人');
    await Hs.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1300, peakRating: 1300, placementGames: 3, wins: 9, losses: 2, history: [] })); return true; });
    const made = await H.room(Hs, 'createRoom', { mode: 'A' });
    const R0 = H.roomDocs(emu).find((d) => d._id === made.roomId) || {};
    await t.ok(made && made.ok && Number(R0.hostRating) === 0 && Number(R0.hostElo) === 1300,
      `自由房：hostRating 写 0（天梯不会配进来），真实分数 hostElo=${R0.hostElo}`, () => explain());
    await H.roomWait(Hs, made.roomId);
    await Gs.tap('#pkRooms'); await H.answerNameIfAsked(Gs, Gs.nick);
    await Gs.waitScreen(/高手/, { timeout: 20000 }).catch(() => '');
    await Gs.tap(`button[data-rid="${made.roomId}"]`);
    await H.roomEvent(Hs, 40000);
    await H.room(Hs, 'markReady', made.roomId);
    const inB = await H.until(async () => H.battleView(Gs), { timeout: 40000, interval: 400 });
    const st = await Gs.eval(() => { const s = window.HansenPkRoomUI._stateForTest(); return s ? { opp: s._oppRating, mode: s.mode } : null; });
    await t.ok(!!inB && st && st.mode === 'A' && st.opp === 1300, `客人进了抢答赛，结算按房主的 1300 分算 ELO（记下的对手分：${st && st.opp}）—— 以前按 0 → 1000 算`, () => explain());
  } catch (e) {
    await t.ok(false, '这一段测试脚本自己出错：' + String(e && e.stack || e).slice(0, 400), () => explain());
  }
  for (const p of live) { try { await p.close(); } catch (e2) { /* 已关 */ } }
  live.length = 0;
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
