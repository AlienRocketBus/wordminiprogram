#!/usr/bin/env node
/* test_room_ui_r2_cloud_v1164.mjs —— 公开房间这一屏：开房 / 查码卡住时离开、房主切到别的 App、数据库不让读写、
 * 没登录、自动刷新的列表（审查第二轮 R2-UI-1、R2-UI-2、R2-UI-3、R2-UI-6、R2-UI-8、R2-UI-13、FX-9）
 *
 * 真页面、真界面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。点击都是「手指」点（看得见、没被挡住才点）。
 *
 *   ① 开房卡住（网慢）：点了玩法要看得见「正在开房…」和「取消」（R2-UI-6）；点「取消」/ 连按「← 返回」
 *      回到首页以后，开房那一下回来了也**不许**再弹出「等对手进来」、房也不许开着（R2-UI-1）；
 *      取消以后换一种玩法再开，开出来的就是新选的那种（以前第二下被吞掉，开出来的还是上一种）
 *   ② 输了房间码、点「进房」、查码还没回来就「← 返回」：查到了也不许进房（R2-UI-2）
 *   ③ 房主等人的时候切到别的 App：公开房马上下架、进不来；私密房不点头（进来的人等着）；回来接着等、照常开打（R2-UI-3）
 *   ④ 数据库回非 200（没建集合 · 404）：列表和开房失败都不说「连不上网络 · 检查 Wi-Fi」，而是「云端连得上，
 *      但数据库这次没让读写」；开房失败以后同一个红框不画两遍（R2-UI-8 / R2-UI-13）
 *   ⑤ 从没登录过：按钮叫「🔐 去登录」、不放一行看不懂的 not-signed-in，点了就是登录表单（R2-UI-13）
 *   ⑥ 列表自动刷新：已经在列表里的房不挪位置，新开的房接在后面（FX-9：以前新房插到最上面，孩子点进了别人的房）
 *   ⑦ 天梯没人可配、自己开房「正在开房间…」卡住：有「取消，回天梯」，点了回天梯首页、房不许开出来（R2-UI-6 / R2-UI-1）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('公开房间这一屏 · 真界面 + 真 SDK（审查 R2-UI-1/2/3/6/8/13、FX-9）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
let seq = 10;

async function phone(name, nick, { login = true } = {}) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  p.nick = nick;
  if (!login) return p;
  const r = await H.loginPhone(p, '137000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.key = 'u' + r.uid; p.uid = r.uid;
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/公开房间/, { timeout: 10000 });
}
async function setHidden(p, hidden) {
  return p.eval((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  }, hidden);
}
/* 点得到就点，点不到返回 false（不让脚本自己崩掉，后面的检查照样跑） */
async function tryTap(p, sel, opts) {
  try { await p.tap(sel, Object.assign({ timeout: 4000 }, opts || {})); return true; } catch (e) { return false; }
}
const liveRooms = (p) => H.roomDocs(emu).filter((d) => d.kind === 'room' && d.hostId === p.key && (d.status === 'open' || d.status === 'away'));
const seatsBy = (p, rid) => H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.guestId === p.key && (!rid || d.roomId === rid));
const errBoxes = (p) => p.eval(() => [].slice.call(document.querySelectorAll('#hsn_pkroom_screen .pr_err')).filter((e) => e.offsetParent).length);
const rowNames = (p) => p.eval(() => [].slice.call(document.querySelectorAll('#prList .pr_room .n b')).map((b) => b.innerText.trim()));
/* 每一段各管各的：前一段出错（比如旧版本弹出了不该弹的屏）不连累后面几段 */
async function part(title, fn) {
  /* 只跑某几段（排查用）：R2_ONLY=①,③ node 这个文件 */
  const only = String(process.env.R2_ONLY || '').split(',').filter(Boolean);
  if (only.length && !only.some((x) => title.startsWith(x))) return;
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}

{
  /* ══ ① 开房卡住时：看得见、能取消，取消了就真的不开 ══════════════ */
  await part('① 开房卡住：「正在开房…」+「取消」；取消 / 连按「← 返回」以后不许再弹出等人屏（R2-UI-1 / R2-UI-6）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const A = await phone('甲', '小蜂甲');
  await toLobby(A);

  /* 1a：点玩法 → 卡住 → 「取消」 */
  let hold = emu.hold({ uid: A.uid, db: true, action: 'database.addDocument' });
  await A.tap('#prNew');
  await A.tap('.pr_mode[data-mode="C"]');
  await H.sleep(700);
  const busy = await A.eval(() => {
    const cards = [].slice.call(document.querySelectorAll('.pr_mode'));
    return { creating: !!(document.getElementById('prCreating') && document.getElementById('prCreating').offsetParent),
             text: (document.getElementById('prCreating') || {}).innerText || '',
             disabled: cards.length > 0 && cards.every((c) => getComputedStyle(c).pointerEvents === 'none' || c.getAttribute('aria-disabled') === 'true') };
  });
  const cancelHit = await A.hitTest('#prCreateCancel', { timeout: 1500 });
  await t.ok(busy && busy.creating && /正在开房/.test(busy.text) && busy.disabled && cancelHit.ok,
    `点了玩法：选玩法这一屏上看得见「正在开房…」、玩法卡片点不动了、有「取消」点得到（${JSON.stringify(busy)}；取消：${cancelHit.ok || cancelHit.why}）`, () => explain());
  const cancelled = await tryTap(A, '#prCreateCancel');
  if (!cancelled) await tryTap(A, '#prBack');   /* 旧版本没有「取消」：孩子只能按「← 返回」 */
  await A.waitScreen(/公开房间/, { timeout: 5000 }).catch(() => '');
  hold.release();
  await H.sleep(4500);
  let scr = await A.screen();
  await t.ok(!has(scr, /等对手进来/) && has(scr, /公开房间/), `点了「取消」：开房那一下回来以后，屏幕还是房间列表，没有自己弹出「等对手进来」（看到：${flat(scr).slice(0, 90)}）`, () => explain());
  await t.ok(liveRooms(A).length === 0, `点了「取消」：云端没有开着的房（开着 ${liveRooms(A).length} 间）`, () => explain());

  /* 1b：点玩法 → 卡住 → 「← 返回」两下回到拼写大PK首页 */
  hold = emu.hold({ uid: A.uid, db: true, action: 'database.addDocument' });
  await A.tap('#prNew');
  await A.tap('.pr_mode[data-mode="B"]');
  await H.sleep(500);
  await tryTap(A, '#prBack');                       /* 选玩法屏的「← 返回」→ 房间列表 */
  await A.waitScreen(/公开房间/, { timeout: 5000 }).catch(() => '');
  await tryTap(A, '#prBack');                       /* 房间列表的「← 返回」→ 拼写大PK首页 */
  await H.sleep(600);
  hold.release();
  await H.sleep(4500);
  scr = await A.screen();
  const homeHit = await A.hitTest('#pkRooms', { timeout: 1500 });
  const roomUiOn = await A.eval(() => !!document.querySelector('#hsn_pkroom_screen.on'));
  await t.ok(homeHit.ok && roomUiOn === false && !has(scr, /等对手进来|云端设置/), `连按「← 返回」回到首页：开房那一下回来以后，首页还在最上面、没被房间那一层盖住（${homeHit.ok ? '首页点得到' : homeHit.why}；房间层${roomUiOn ? '又弹出来了' : '没弹出来'}；看到：${flat(scr).slice(0, 90)}）`, () => explain());
  await t.ok(liveRooms(A).length === 0, `回到首页以后：云端没有开着的房（开着 ${liveRooms(A).length} 间）`, () => explain());

  /* 1c：取消以后换一种玩法再开 → 开出来的就是新选的那种 */
  await toLobby(A);
  hold = emu.hold({ uid: A.uid, db: true, action: 'database.addDocument' });
  await A.tap('#prNew');
  await A.tap('.pr_mode[data-mode="B"]');
  await H.sleep(500);
  if (!(await tryTap(A, '#prCreateCancel'))) await tryTap(A, '#prBack');
  await A.waitScreen(/公开房间/, { timeout: 5000 }).catch(() => '');
  await A.tap('#prNew');
  await A.tap('.pr_mode[data-mode="A"]');
  await H.sleep(500);
  hold.release();
  const w1 = await A.waitScreen(/等对手进来/, { timeout: 15000 }).catch((e) => e.lastText || '');
  const lr = liveRooms(A);
  await t.ok(has(w1, /等对手进来/) && has(w1, /抢答赛/) && lr.length === 1 && lr[0].mode === 'A',
    `取消以后改选「⚡抢答赛」：开出来的就是抢答赛（屏幕：${flat(w1).match(/你开的是[^·]*/) || flat(w1).slice(0, 60)}；云端开着 ${lr.length} 间：${lr.map((d) => d.mode).join(',')}）`, () => explain());
  await tryTap(A, '#prBack');   /* ← 关掉房间 */
  await H.sleep(1500);
  await t.ok(liveRooms(A).length === 0, `点「← 关掉房间」以后云端没有开着的房（${liveRooms(A).length}）`, () => explain());
  });

  /* ══ ② 查房间码的时候「← 返回」 ════════════════════════════════ */
  await part('② 输了房间码、点「进房」、还没查到就「← 返回」：查到了也不许进房（R2-UI-2）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const B = await phone('乙', '小蜂乙');
  const C = await phone('丙', '小蜂丙');
  const made = await H.room(B, 'createRoom', { private: true, mode: 'A' });
  const code = made && made.room && made.room.code;
  await t.ok(made && made.ok && code, `[乙] 开了一间私密房（码 ${code}）`, () => explain(JSON.stringify(made)));
  await H.roomWait(B, made.roomId, { ms: 90000 });
  await toLobby(C);
  await C.tap('summary', { hasText: '房间码' });
  await C.tap('#prCode'); await C.type(code);
  const qhold = emu.hold({ uid: C.uid, db: true, action: 'database.queryDocument' });
  await C.tap('#prJoinCode');
  await H.sleep(400);
  await tryTap(C, '#prBack');
  await H.sleep(500);
  qhold.release();
  await H.sleep(5000);
  const scr = await C.screen();
  const cHome = await C.hitTest('#pkRooms', { timeout: 1500 });
  const bv = await H.battleView(C);
  const cUiOn = await C.eval(() => !!document.querySelector('#hsn_pkroom_screen.on'));
  await t.ok(cHome.ok && !bv && cUiOn === false && !has(scr, /进房中|正在进房/), `查到码以后也没进房：首页还在最上面，没被「🚪 进房中」/ 对战屏盖住（${cHome.ok ? '首页点得到' : cHome.why}；房间层${cUiOn ? '又弹出来了' : '没弹出来'}；看到：${flat(scr).slice(0, 80)}）`, () => explain());
  await t.ok(seatsBy(C, made.roomId).length === 0, `云端没有丙抢的座位（${seatsBy(C, made.roomId).length}）`, () => explain());
  const evB = await H.roomEvent(B, 500);
  await t.ok(!evB, `乙那边没有人进来（${evB ? JSON.stringify(evB).slice(0, 80) : '没有'}）`, () => explain());
  });

  /* ══ ③ 房主切到别的 App ══════════════════════════════════════════ */
  await part('③ 房主等人的时候切到别的 App：公开房下架进不来、私密房不点头；回来接着等、照常开打（R2-UI-3）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const D = await phone('丁', '小蜂丁');
  const G = await phone('戊', '小蜂戊');
  await toLobby(D);
  await D.tap('#prNew');
  await D.tap('.pr_mode[data-mode="A"]');
  await D.waitScreen(/等对手进来/, { timeout: 15000 }).catch(() => '');
  const pubRoom = liveRooms(D)[0];
  await t.ok(!!pubRoom, `[丁] 开了一间公开房（${pubRoom && pubRoom._id}）`, () => explain());
  await setHidden(D, true);
  await H.sleep(2500);
  const awayDoc = H.roomDocs(emu).find((d) => pubRoom && d._id === pubRoom._id) || {};
  const listed = await H.room(G, 'listRooms');
  const seen = !!(listed && listed.ok && (listed.rooms || []).some((x) => pubRoom && x.id === pubRoom._id));
  const j1 = pubRoom ? await H.room(G, 'joinRoom', pubRoom._id, {}) : null;
  const dBattle = await H.battleView(D);
  await t.ok(!seen && j1 && !j1.ok && !dBattle,
    `丁切出去以后：列表里看不到这间房（${seen ? '还看得到' : '看不到'}；房的状态 ${awayDoc.status}），硬进也进不去（${j1 && (j1.ok ? '进去了' : j1.kind + '：' + j1.reason)}），丁的手机上没在后台开打`, () => explain());
  if (j1 && j1.ok) { await H.room(G, 'leaveRoom', pubRoom._id); }
  await setHidden(D, false);
  await H.sleep(2500);
  const back = H.roomDocs(emu).find((d) => pubRoom && d._id === pubRoom._id) || {};
  const j2 = pubRoom ? await H.room(G, 'joinRoom', pubRoom._id, {}) : null;
  const dIn = await H.until(async () => H.battleView(D), { timeout: 20000 });
  await t.ok(back.status === 'open' && j2 && j2.ok && !!dIn, `丁回来了：房又上架（${back.status}），戊进得去（${j2 && (j2.ok ? 'ok' : j2.reason)}），丁这边照常开打（${dIn ? '对战屏' : '没开打'}）`, () => explain());
  await closeAll();

  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 20 } });
  names = {};
  const P = await phone('己', '小蜂己');
  const Q = await phone('庚', '小蜂庚');
  await toLobby(P);
  await P.tap('#prPriv');
  await P.tap('.pr_mode[data-mode="A"]');
  await P.waitScreen(/等对手进来/, { timeout: 15000 }).catch(() => '');
  const pcode = await P.eval(() => ((document.getElementById('prCodeBig') || {}).innerText || '').trim());
  const privRoom = liveRooms(P)[0];
  await t.ok(!!privRoom && /^[A-Z0-9]{4}$/.test(pcode || ''), `[己] 开了一间私密房（码 ${pcode}）`, () => explain());
  await setHidden(P, true);
  await H.sleep(1500);
  if (privRoom) await H.roomLaunch(Q, 'j', 'joinRoom', privRoom._id, { code: pcode });
  await H.sleep(7000);
  const qPend = await Q.eval(() => (window.__hsnPend || {}).j || null);
  const pBattle = await H.battleView(P);
  const pStarted = H.roomDocs(emu).find((d) => privRoom && d._id === privRoom._id) || {};
  await t.ok(qPend && !qPend.done && !pBattle && !pStarted.startAt,
    `己切出去（多半在微信里发码）：庚进房先等着、没被确认进来（${qPend && qPend.done ? '已经进来了：' + JSON.stringify(qPend.r).slice(0, 80) : '还在等'}），己的手机上没在后台开打（startAt=${pStarted.startAt || 0}）`, () => explain());
  await setHidden(P, false);
  const qRes = await H.roomResult(Q, 'j', 30000);
  const pIn = await H.until(async () => H.battleView(P), { timeout: 20000 });
  await t.ok(qRes && qRes.done && qRes.r && qRes.r.ok && !!pIn, `己回来了：庚进来了（${qRes && qRes.r ? (qRes.r.ok ? 'ok' : qRes.r.reason) : '没结果'}），己这边照常开打（${pIn ? '对战屏' : '没开打'}）`, () => explain());
  });

  /* ══ ④ 数据库回非 200 ═══════════════════════════════════════════ */
  await part('④ 数据库回了非 200（没建集合 · 404）：不说「连不上网络」；开房失败后不画两个一样的红框（R2-UI-8 / R2-UI-13）', async () => {
  {
    const cols = H.defaultCollections(); delete cols.hansen_pk_rooms;
    emu = H.makeEmulator({ collections: cols, knobs: { permissionMode: 'legacy', latencyMs: 40, missingStatus: 404 } });
  }
  names = {};
  const E = await phone('辛', '小蜂辛');
  await toLobby(E);
  const lst = await E.waitScreen(/数据库这次没让读写|连不上网络|检查一下 Wi-Fi/, { timeout: 45000 }).catch((e) => e.lastText || '');
  await t.ok(has(lst, /云端连得上，但数据库这次没让读写/) && has(lst, /可能/) && !has(lst, /连不上网络|检查一下 Wi-Fi/),
    `房间列表：说「云端连得上，但数据库这次没让读写」和可能的原因，不让老师去查 Wi-Fi（看到：${flat(lst).slice(0, 150)}）`, () => explain());
  const probed = emu.log.some((x) => x.uid === E.uid && /\/auth\/v1\/user\/me/.test(x.path) && x.status === 200);
  await t.ok(probed, '真的问过一次登录服务（/auth/v1/user/me 回了 200）才下的结论', () => explain());
  await E.tap('#prNew');
  await E.tap('.pr_mode[data-mode="C"]');
  await H.until(async () => (await E.hitTest('#prNew', { timeout: 300 })).ok, { timeout: 45000 });
  await H.sleep(9000);   /* 列表那一块也刷完 */
  const scr = await E.screen();
  const boxes = await errBoxes(E);
  await t.ok(has(scr, /数据库这次没让读写/) && !has(scr, /连不上网络|检查一下 Wi-Fi/),
    `开房失败：顶上也说「数据库这次没让读写」，不说「连不上网络」（看到：${flat(scr).slice(0, 150)}）`, () => explain());
  await t.ok(boxes === 1, `同一种错误只画一个红框（画了 ${boxes} 个）`, () => explain());
  });

  /* ══ ⑤ 从没登录过 ══════════════════════════════════════════════ */
  await part('⑤ 从没登录过的孩子点「公开房间」：按钮叫「🔐 去登录」，不放 not-signed-in（R2-UI-13）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const N = await phone('壬', '小蜂壬', { login: false });
  await toLobby(N);
  const lg = await N.hitTest('#prLogin', { timeout: 15000 });
  const nscr = await N.screen();
  const btnTxt = await N.eval(() => ((document.getElementById('prLogin') || {}).innerText || '').trim());
  await t.ok(lg.ok && /去登录/.test(btnTxt) && !/重新登录/.test(btnTxt), `按钮是「去登录」（看到按钮：${btnTxt || '没有'}）`, () => explain());
  await t.ok(!has(nscr, /技术信息|not-signed-in|云端会话不可用/), `没有一行看不懂的技术信息（看到：${flat(nscr).slice(0, 120)}）`, () => explain());
  if (lg.ok) await N.tap('#prLogin');
  const form = await N.hitTest('#auPhone', { timeout: 5000 });
  await t.ok(form.ok, `点了就是登录表单、手机号框点得到（${form.ok || form.why}）`, () => explain());
  });

  /* ══ ⑥ 自动刷新：行不挪位置 ═══════════════════════════════════════ */
  await part('⑥ 房间列表自动刷新：已经在的房不挪位置，新开的房接在后面（FX-9）', async () => {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const hosts = [];
  for (const nm of ['一号', '二号', '三号']) {
    const h = await phone(nm, '房主' + nm);
    await h.eval((n) => { try { window.HansenSbProfile.setName(n); } catch (e) { /* 旧版本 */ } return true; }, h.nick);
    const r = await H.room(h, 'createRoom', { mode: 'C' });
    await H.roomWait(h, r.roomId, { ms: 120000 });
    hosts.push(h);
    await H.sleep(1200);   /* 开房时间错开：新旧顺序分得清 */
  }
  const K = await phone('癸', '小蜂癸');
  await toLobby(K);
  await H.until(async () => ((await rowNames(K)) || []).length >= 3, { timeout: 15000 });
  const before = await rowNames(K);
  const h4 = await phone('四号', '房主四号');
  await h4.eval((n) => { try { window.HansenSbProfile.setName(n); } catch (e) { /* 旧版本 */ } return true; }, h4.nick);
  const r4 = await H.room(h4, 'createRoom', { mode: 'C' });
  await H.roomWait(h4, r4.roomId, { ms: 120000 });
  const after = await H.until(async () => { const n = await rowNames(K); return n && n.length >= 4 ? n : null; }, { timeout: 25000 });
  await t.ok(Array.isArray(before) && before.length === 3, `一开始列表里有三间房（${(before || []).join(' / ')}）`, () => explain());
  await t.ok(after && before && before.every((n, i) => after[i] === n) && after[3] === '房主四号',
    `自动刷新以后：原来的三间还在原位，新开的「房主四号」接在最后（刷新前：${(before || []).join(' / ')}；刷新后：${(after || []).join(' / ')}）`, () => explain());
  });

  /* ══ ⑦ 天梯自己开房时「取消，回天梯」 ══════════════════════════════ */
  await part('⑦ 天梯「正在开房间…」卡住：「取消，回天梯」点得到，点了房不许开出来（R2-UI-6 / R2-UI-1）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const L = await phone('子', '小蜂子');
    const O = await phone('丑', '小蜂丑');
    await L.tap('#pkLadder');
    await H.answerNameIfAsked(L, L.nick);
    await L.waitScreen(/开始排位/, { timeout: 10000 });
    const hold = emu.hold({ uid: L.uid, db: true, action: 'database.addDocument' });
    await L.tap('#ldGo');
    const cr = await L.waitScreen(/正在开房间/, { timeout: 45000 }).catch((e) => e.lastText || '');
    const cbtn = await L.hitTest('#prCreateCancel', { timeout: 2000 });
    await t.ok(has(cr, /正在开房间/) && cbtn.ok, `没人可配、自己开房：「正在开房间…」这一屏上有「取消，回天梯」、点得到（${cbtn.ok || cbtn.why}）`, () => explain());
    if (cbtn.ok) await L.tap('#prCreateCancel');
    await H.sleep(800);
    hold.release();
    await H.sleep(5000);
    const scr = await L.screen();
    const lr = await H.room(O, 'listRooms');
    const listed = !!(lr && lr.ok && (lr.rooms || []).some((x) => x.hostName === L.nick));
    await t.ok(has(scr, /开始排位/) && !has(scr, /等对手进来/), `回到了天梯首页，开房那一下回来以后也没有弹出「等对手进来」（看到：${flat(scr).slice(0, 80)}）`, () => explain());
    await t.ok(liveRooms(L).length === 0 && !listed, `排位房没开出来（开着 ${liveRooms(L).length} 间；别人${listed ? '列得到' : '列不到'}）`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
