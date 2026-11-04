#!/usr/bin/env node
/* test_quota_safety_cloud_v1164.mjs —— 免费额度撑不撑得住、排行榜能不能被人刷、云存档的权限能不能收紧
 *（审查第一轮 SE-2、SE-3、SE-4、SEC-4、SEC-2）
 *
 * 真页面、真模块、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答（数的是模拟云端真收到的请求）。
 *
 *   ① 排行榜（审查 SEC-4）：分数是各人手机自己写的。有人把自己写成 9999 分、名字写成「加微信…领皮肤」——
 *      以前所有孩子的排行榜第一名就是他。现在：不可能的分数不上榜，广告名字换成「小蜜蜂」，榜上写明「仅供参考」。
 *   ② 找对手时顺手清死房（审查 SE-3）：以前每列一次房就多查 3 次（找 20 秒 ≈ 33 次查询）；现在 10 分钟最多清一次。
 *   ③ 云存档（审查 SE-4）：以前「强制上传」连内容没变也传一整份；切一次后台传两次。现在没变就不传。
 *   ④ 好友在线心跳（审查 SE-2）：以前一个岛屿页里 3 个 frame 各写各的、每 20 秒一次（一小时 540 次）。
 *      现在只有一个 frame 写、每 60 秒一次。
 *   ⑤ 云存档集合改成「仅创建者可读写」以后（审查 SEC-2，要老师在控制台改）：同一个账号换手机照样取得回，
 *      别的账号读不到 —— 先在模拟云端里验证这样改不会把功能弄坏。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('额度 · 排行榜 · 云存档权限 · 真 SDK 端到端（审查 SE-2/3/4、SEC-2/4）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
let seq = 50;

async function phone(name, nick, opts = {}) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  const r = await H.loginPhone(p, '133000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.uid = r.uid; p.key = 'u' + r.uid;
  if (nick) await p.eval((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过 */ } return true; }, nick);
  return p;
}
async function closeAll() {
  for (const p of live) {
    await t.ok(!p.errors.length && !p.leaks.length, `[${p.name}] 没有页面报错、没有连外网（${p.errors.slice(0, 2).join(' | ') || '无'}）`);
    await p.close();
  }
  live.length = 0;
}
const writesBy = (uid, col) => emu.writes.filter((w) => w.uid === uid && w.collection === col);

try {
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30, jitterMs: 20, consistencyLagMs: 200 } });
  names = {};
  /* ④ 先开着岛屿页（登录着、什么都不点），最后再数它写了几次在线心跳 */
  const I = await phone('岛屿页', '', { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenFriends && window.HansenCloudSave) });
  await H.dismissIslandWelcome(I);
  const iT0 = Date.now(), iW0 = writesBy(I.uid, 'hansen_friends').length;

  /* ══ ① 排行榜 ══════════════════════════════════════════════════ */
  t.section('① 有人把自己的天梯分写成 9999、名字写成广告（审查 SEC-4）');
  const X = await phone('刷榜', '刷榜的'), Y = await phone('广告', '广告的');
  const w9 = await X.eval(async (uid) => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('sb_profile').doc(uid).update({ ladderRating: 9999, ladderGames: 999, ladderAt: Date.now(), name: '第一名9999' });
    return r && (r.code || (r.updated != null ? 'updated=' + r.updated : 'ok'));
  }, X.uid);
  const wA = await Y.eval(async (uid) => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('sb_profile').doc(uid).update({ ladderRating: 3000, ladderGames: 999, ladderAt: Date.now(), name: '加微信8888领皮肤' });
    return r && (r.code || (r.updated != null ? 'updated=' + r.updated : 'ok'));
  }, Y.uid);
  await t.ok(/updated=1/.test(String(w9)) && /updated=1/.test(String(wA)), `两个人都改得了自己的资料（${w9}；${wA}）—— 云端拦不住，只能靠显示的时候把关`, () => explain());
  /* 看榜的孩子是之后才打开的（榜单在本机缓存 1 分钟 —— 先打开的话看到的是缓存里的旧榜） */
  const V = await phone('看榜', '小蜂看榜');
  await V.tap('#pkLadder'); await H.answerNameIfAsked(V, V.nick);
  const board = await V.waitScreen(/仅供参考/, { timeout: 15000 }).catch((e) => e.lastText || '');
  const bTxt = await V.eval(() => (document.getElementById('ldBoard') || {}).innerText || '');
  await t.ok(!has(bTxt, /9999|第一名9999/), `9999 分的不上榜（榜上：${flat(bTxt).slice(0, 120)}）—— 以前排第一`, () => explain());
  await t.ok(!has(bTxt, /微信|8888|领皮肤/) && has(bTxt, /小蜜蜂/), '广告名字换成了「小蜜蜂」，联系方式一个字也不显示', () => explain());
  await t.ok(has(board, /仅供参考/), '榜上写明「排行榜是大家手机上传的分数，仅供参考」', () => explain());
  await H.cleanPhones(t, [X, Y]);   /* 审查 T8：关手机之前看一眼页面报错 */
  await X.close(); await Y.close(); live.splice(live.indexOf(X), 1); live.splice(live.indexOf(Y), 1);

  /* ══ ② 列房时清死房 ════════════════════════════════════════════ */
  t.section('② 连着列 10 次房：清死房只做一次（审查 SE-3）');
  const n0 = emu.log.length;
  for (let i = 0; i < 10; i++) { await H.room(V, 'listRooms'); await H.sleep(300); }
  await H.sleep(2500);
  const q = emu.log.slice(n0).filter((x) => x.uid === V.uid && x.action === 'database.queryDocument' && x.collection === 'hansen_pk_rooms').length;
  await t.ok(q <= 14, `列 10 次房一共查了 ${q} 次（10 次列房 + 最多一次清理）—— 以前每列一次多查 3 次（约 40 次）`, () => explain());

  /* ══ ③ 云存档：没变就不传 ══════════════════════════════════════ */
  t.section('③ 云存档：内容没变就不上传（审查 SE-4）');
  await I.eval(() => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [1, 2, 3] })); return true; });
  const s1 = await I.eval(() => window.HansenCloudSave.syncNow({ force: true }));
  const w1 = writesBy(I.uid, 'hansen_saves').length;
  const s2 = await I.eval(() => window.HansenCloudSave.syncNow({ force: true }));
  const s3 = await I.eval(() => window.HansenCloudSave.syncNow({ force: true }));
  const w3 = writesBy(I.uid, 'hansen_saves').length;
  await t.ok(s1 && s1.ok && w1 >= 1, `第一次真传上去了（${JSON.stringify(s1 && { ok: s1.ok, skipped: s1.skipped })}）`, () => explain());
  await t.ok(s2 && s2.ok && s3 && s3.ok && w3 === w1, `内容没变，再「强制同步」两次：一次也没传（多写了 ${w3 - w1} 次）—— 以前每次都传一整份`, () => explain());
  await I.eval(() => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [1, 2, 3, 4] })); return true; });
  const wv0 = writesBy(I.uid, 'hansen_saves').length;
  await I.eval(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    return true;
  });
  await H.sleep(4000);
  const wv = writesBy(I.uid, 'hansen_saves').length - wv0;
  await I.eval(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  });
  await t.ok(wv === 1, `学会一个新词后切到后台：传了 ${wv} 次（该是 1 次）—— 以前两个「切后台」处理各传一次、几个 frame 各传各的`, () => explain());

  /* ══ ④ 好友在线心跳 ════════════════════════════════════════════ */
  t.section('④ 开着岛屿页什么都不点：好友在线心跳写了几次（审查 SE-2）');
  const waitMore = 65000 - (Date.now() - iT0);
  if (waitMore > 0) await H.sleep(waitMore);
  const beats = writesBy(I.uid, 'hansen_friends').length - iW0;
  const secs = Math.round((Date.now() - iT0) / 1000);
  await t.ok(beats <= 2, `${secs} 秒里写了 ${beats} 次在线心跳（一个 frame、每 60 秒一次 → 最多 2 次）—— 以前 3 个 frame × 每 20 秒`, () => explain());
  await closeAll();

  /* ══ ⑤ 云存档集合「仅创建者可读写」═════════════════════════════ */
  t.section('⑤ hansen_saves 设成「仅创建者可读写」以后（审查 SEC-2 · 要老师在控制台改）');
  /* 控制台预设「仅创建者可读写」= 服务端自动只看自己的记录（legacy 模式），不是自定义规则（那要求每个查询都带 _openid） */
  emu = H.makeEmulator({ collections: H.defaultCollections({ hansen_saves: H.ACL.PRIVATE }), knobs: { permissionMode: 'legacy', latencyMs: 30, consistencyLagMs: 200 } });
  names = {};
  const P1 = await phone('旧手机', '', { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave) });
  await P1.eval(() => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [1, 2, 3, 4, 5] })); return true; });
  const u1 = await P1.eval(() => window.HansenCloudSave.syncNow({ force: true }));
  await t.ok(u1 && u1.ok, `旧手机传上去了（${JSON.stringify(u1 && { ok: u1.ok, reason: u1.reason })}）`, () => explain());
  seq--;   /* 新手机登录同一个手机号 */
  const P2 = await phone('新手机', '', { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave) });
  const got = await P2.eval(() => { try { return (JSON.parse(localStorage.getItem('wordIslandFood') || '{}').learned || []).length; } catch (e) { return -1; } });
  await t.ok(P2.uid === P1.uid && got === 5, `同一个账号换了手机：登录后自动取回 ${got} 个词（应是 5）—— 收紧权限不影响自己读自己的`, () => explain());
  const P3 = await phone('别的账号', '', { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave) });
  const peek = await P3.eval(async () => {
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('hansen_saves').limit(20).get();
    return { code: r && r.code, n: ((r && r.data) || []).length };
  });
  await t.ok(peek && (peek.code || peek.n === 0), `别的账号想把所有人的存档都拉下来：一份也拿不到（${JSON.stringify(peek)}）—— 「读取全部数据」时谁都能拉`, () => explain());
  await closeAll();
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
