#!/usr/bin/env node
/* test_pk_back_cloud_v1165.mjs —— 拼写大PK 两个「不是对战」的屏上按手机返回键 · 真 SDK（v1165 合并 v1164 后复查）
 *
 * 返回键在房间屏上的规矩（hansen_home_link.js 的 pkRoomBack）：这一屏有自己的返回 / 取消按钮，就点它（和孩子亲手点一样）；
 * 只有对战屏才交给对战组的 askQuit（「要退出这一局吗？…记一场输」）。以前没认出来的屏都被当成对战：
 *   ① 「📨 这一局的结果没拿到」（只有一个「← 回天梯 / ← 回到房间列表」#prResBack）：
 *      返回键弹「要退出吗？房间会关掉」，点「退出」回的是自由房列表 —— 排位局本该回天梯。
 *      现在：返回 = 点 #prResBack —— 不弹框、战绩不变、排位局回天梯。
 *   ② 天梯两人同时开始、后开房的那位换到先开的那间：「找到一间先开好的房，正在进去…」当场就换成「⚡ 排位 · 进房中」
 *      （这一屏有「← 返回 / 取消」）。返回 = 点「← 返回」：不弹框、战绩不变、对方房里不留座位、
 *      自己开的那间也不能留着挂在列表上等人。
 * 真页面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。岛页在最外层打开，「按返回键」= 调岛页的 __hsnIslandBack()
 *（首页外壳收到返回键时先调的就是它；外壳那一段由 test_island_back_v1165 / test_island_r2_cloud_v1164 守）。
 * 只跑某一段（排查 / 证明「改回去就红」用）：BACK_ONLY=①  或  BACK_ONLY=②
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('拼写大PK：「结果没拿到」/「换房进房中」上按返回键 · 真 SDK（v1165）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {}, seq = 40;
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');

const ISLAND = { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HansenPkRecord && typeof window.__hsnIslandBack === 'function') };
async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, ISLAND));
  live.push(p);
  const r = await H.loginPhone(p, '136000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.uid = r.uid; p.key = 'u' + r.uid;
  await H.dismissIslandWelcome(p);
  await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过 */ } return true; }, nick);
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function part(title, fn) {
  const only = String(process.env.BACK_ONLY || '').split(',').filter(Boolean);
  if (only.length && !only.some((x) => title.startsWith(x))) return;
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}
/* 这一页的战绩 + 「记战绩」被调了几次 + 有没有出现过「要退出…」的确认框（装一个记号，按返回之前装） */
const watch = (p) => p.eval(() => {
  window.__bk = { record: 0, ask: 0 };
  const P = window.HansenPkRecord, o = P.record;
  if (!P.__bkWrapped) { P.__bkWrapped = 1; P.record = function () { window.__bk.record++; return o.apply(this, arguments); }; }
  const seen = () => { if (document.getElementById('prQuitAsk')) window.__bk.ask++; };
  seen();
  new MutationObserver(seen).observe(document.body, { childList: true });
  const s = P.summary();
  return { total: s.total, wins: s.wins, losses: s.losses, rating: s.rating };
});
const look = (p) => p.eval(() => {
  const s = window.HansenPkRecord.summary();
  const room = document.getElementById('hsn_pkroom_screen'), lad = document.getElementById('hsn_ladder_screen');
  const go = document.getElementById('ldGo');
  return { bk: Object.assign({}, window.__bk), total: s.total, losses: s.losses, rating: s.rating,
           ask: ((document.getElementById('prQuitAsk') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
           roomOn: !!(room && room.classList.contains('on')), roomTxt: room ? (room.textContent || '').replace(/\s+/g, ' ').slice(0, 60) : '',
           ladderHome: !!(lad && lad.classList.contains('on') && go && go.getClientRects().length) };
});
const back = (p) => p.eval(() => window.__hsnIslandBack());
const isSeatAdd = (ctx) => ctx.action === 'database.addDocument' && /kind\\*"\s*:\s*\\*"seat/.test(JSON.stringify(ctx.body || {}));

{
  /* ══ ① 「这一局的结果没拿到」 ══════════════════════════════════════ */
  await part('① 排位打完、交卷一直交不上 →「这一局的结果没拿到」：按返回 = 点「← 回天梯」', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('房主', '小蜂房主'), B = await phone('客人', '小蜂客人');
    /* 房主先开始排位：20 秒没人可配 → 自己开一间排位房等人；客人再开始排位 → 配进这一间 */
    await A.eval(() => { window.HansenLadderUI.open(); return true; });
    await A.tap('#ldGo');
    const rid = await H.until(() => (H.roomDocs(emu).find((d) => d.kind === 'room' && d.hostId === A.key && d.status === 'open') || {})._id, { timeout: 60000, interval: 500 });
    await t.ok(!!rid, `房主自己开了一间排位房等人（${rid || '没开成'}）`, () => explain());
    if (!rid) return;
    /* 房主交卷（写 hostScore）一直写不进去 —— 网不稳；别的照常 */
    emu.fault({ uid: A.uid, db: true, action: 'database.updateDocument', test: (ctx) => /hostScore/.test(JSON.stringify(ctx.body || {})), do: 'abort' });
    await B.eval(() => { window.HansenLadderUI.open(); return true; });
    await B.tap('#ldGo');
    const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)) ? true : null, { timeout: 45000, interval: 500 });
    await t.ok(both, '两个人配上了、都进了对战屏', () => explain());
    if (!both) return;
    const R = H.roomDocs(emu).find((d) => d._id === rid);
    const words = await H.wordsOfRoom(A, R);
    await H.playMatch({ host: A, guest: B }, words, () => ({ first: 'host' }), { timeout: 120000 });
    const failed = await H.until(async () => /结果没拿到/.test(await A.screen()) ? true : null, { timeout: 90000, interval: 1000 });
    await t.ok(failed, `房主交卷交不上：「📨 这一局的结果没拿到」+「← 回天梯」（看到：${flat(await A.screen()).slice(0, 80)}）`, () => explain());
    if (!failed) return;
    const w0 = await watch(A);
    const handled = await back(A);
    await H.sleep(900);
    const v1 = await look(A);
    const askTxt = v1.ask;
    /* 修之前这里会弹「要退出吗？」—— 孩子多半会点「退出」：照着点，看看会不会记一场输、回到了哪里 */
    if (askTxt) { await A.eval(() => { const b = document.getElementById('prQuitYes'); if (b) b.click(); return true; }); await H.sleep(900); }
    const v2 = await look(A);
    await t.ok(handled === true && !v2.bk.ask, `按返回：没有弹「要退出…」的确认框（弹了 ${v2.bk.ask} 次${askTxt ? '：' + askTxt.slice(0, 40) : ''}）`, () => explain());
    await t.ok(v2.bk.record === 0 && v2.total === w0.total && v2.losses === w0.losses && v2.rating === w0.rating,
      `战绩一点没变（记战绩 ${v2.bk.record} 次；局数 ${w0.total} → ${v2.total}；输 ${w0.losses} → ${v2.losses}；分 ${w0.rating} → ${v2.rating}）`, () => explain());
    await t.ok(v2.ladderHome && !v2.roomOn, `回到了「← 回天梯」去的地方：天梯页（天梯页 ${v2.ladderHome}；房间层开着 ${v2.roomOn}${v2.roomOn ? '：' + v2.roomTxt : ''}）`, () => explain());
  });

  /* ══ ② 天梯换房「进房中」 ═════════════════════════════════════════ */
  await part('② 两人同时开始排位、后开房的那位换到先开的那间，「进房中」时按返回 = 点「← 返回」', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 60, consistencyLagMs: 500 } });
    names = {};
    const C = await phone('丙', '小蜂丙'), D = await phone('丁', '小蜂丁');
    /* 进房时占座位那一下先扣住：换房的那位就停在「进房中」，孩子这时按返回 */
    const seatHold = emu.hold({ db: true, test: isSeatAdd });
    for (const p of [C, D]) await p.eval(() => { window.HansenLadderUI.open(); return true; });
    await Promise.all([C.tap('#ldGo'), D.tap('#ldGo')]);
    const who = await H.until(async () => {
      for (const p of [C, D]) if (/进房中/.test(await p.screen())) return p;
      return null;
    }, { timeout: 90000, interval: 300 });
    await t.ok(!!who, `后开房的那位换去先开的那间：「⚡ 排位 · 进房中」（${who ? who.name : '没换'}）`, () => explain());
    if (!who) { seatHold.release(); return; }
    const S = who, O = (who === C) ? D : C;
    const ownRid = (H.roomDocs(emu).find((d) => d.kind === 'room' && d.hostId === S.key) || {})._id;
    const target = (H.roomDocs(emu).find((d) => d.kind === 'room' && d.hostId === O.key && (d.status === 'open' || d.status === 'away')) || {})._id;
    const w0 = await watch(S);
    const handled = await back(S);
    await H.sleep(900);
    const v1 = await look(S);
    if (v1.ask) { await S.eval(() => { const b = document.getElementById('prQuitYes'); if (b) b.click(); return true; }); await H.sleep(600); }
    seatHold.release();
    await H.sleep(8000);   /* 扣住的那一下放行：数据层发现已经取消了，要自己把座位收回 */
    const v2 = await look(S);
    await t.ok(handled === true && !v2.bk.ask, `按返回：没有弹「要退出…」的确认框（弹了 ${v2.bk.ask} 次${v1.ask ? '：' + v1.ask.slice(0, 40) : ''}）`, () => explain());
    await t.ok(v2.bk.record === 0 && v2.total === w0.total && v2.losses === w0.losses && v2.rating === w0.rating,
      `战绩一点没变（记战绩 ${v2.bk.record} 次；局数 ${w0.total} → ${v2.total}；分 ${w0.rating} → ${v2.rating}）`, () => explain());
    await t.ok(v2.ladderHome && !v2.roomOn, `回到了「← 返回」去的地方：天梯页（天梯页 ${v2.ladderHome}；房间层开着 ${v2.roomOn}${v2.roomOn ? '：' + v2.roomTxt : ''}）`, () => explain());
    const seats = H.roomDocs(emu).filter((d) => d.kind === 'seat' && d.guestId === S.key && !d.left);
    await t.ok(!!target && seats.length === 0, `对方那间（${target || '找不到'}）里没留下这孩子的座位（还占着 ${seats.length} 个）`, () => explain());
    const own = H.roomDocs(emu).find((d) => d._id === ownRid);
    const lr = await H.room(O, 'listRooms', { ladder: true });
    const listed = !!(lr && lr.ok && (lr.rooms || []).some((x) => x._id === ownRid));
    await t.ok(!!ownRid && (!own || (own.status !== 'open' && own.status !== 'away')) && !listed,
      `自己先前开的那间也收掉了，不留着挂在列表上等人（${own ? own.status : '已删'}；别人${listed ? '列得到' : '列不到'}）`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
