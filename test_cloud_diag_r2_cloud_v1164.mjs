#!/usr/bin/env node
/* test_cloud_diag_r2_cloud_v1164.mjs —— 天梯「找房」接连失败以后，到底说哪一句（审查第二轮 T5、FX-8）
 *
 * 为什么要有它：数据库回非 200 时 SDK 只说「network request error」，和断网一模一样。第一轮修成了
 *   「登录服务通 = 数据库拒绝了，截图给老师」—— 可数据库只是**慢**、网关偶尔回 502、断网**刚好恢复**、
 *   或者会话被云端撤了（数据库回 401）时，也被说成「集合没建、权限不对、安全域名」，老师去查一个好好的控制台。
 *   真页面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答，只有数据库出问题、登录服务一直是好的。
 *
 *   ① 数据库卡住不回话（我们自己的超时）→「🐢 网络太慢了」，不说数据库 / 云端设置
 *   ② 数据库一直回 502 → 话说成「可能」、给「再试一次」（不一口咬定、不让查 Wi-Fi）；好了以后点一下就接着找
 *   ③ 数据库回 502 一阵、看是哪里不通的那一下刚好好了 → 马上再找一次房，接着找对手，什么错都不报
 *   ④ 只有数据库断了一阵（登录服务通）、看的那一下刚好恢复 → 同上（FX-8：以前直接「数据库拒绝了」）
 *   ⑤ 会话被云端撤了、数据库回 HTTP 401 →「云端登录过期了」+「重新登录」打开的是登录表单（不说数据库）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('天梯找房接连失败时说哪一句 · 真 SDK（审查 T5、FX-8）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
let seq = 10;

async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, '131000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.uid = r.uid;
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function part(title, fn) {
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}
const KEYS = [/排位要先登录/, /云端登录过期/, /连不上网络/, /云端还没连上/, /云端设置还差一步/, /数据库这次没让读写|数据库拒绝了/, /网络太慢了/, /正在看看是哪里不通/, /正在找对手/, /等对手进来/];
/* 一直看着屏幕，记下出现过的每一句关键话；onSee(文字) 可以在看到某句话时做点什么（比如让故障消失） */
async function watch(p, doneRe, ms, onSee) {
  const seen = new Set(); let last = '';
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    last = (await p.screen()) + ' ' + p.dialogs.map((d) => d.message).join(' ');
    for (const k of KEYS) if (k.test(last)) seen.add(k.source);
    if (onSee) await onSee(last);
    if (doneRe.test(last)) break;
    await H.sleep(300);
  }
  return { seen: [...seen], last, ms: Date.now() - t0 };
}
const BAD_DB = /数据库这次没让读写|数据库拒绝了|云端设置还差一步/;

{
  /* ══ ① 数据库卡住 ═══════════════════════════════════════════════ */
  await part('① 数据库卡住不回话、登录服务好好的：「网络太慢了」（T5）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const A = await phone('甲', '小蜂甲');
    await toLadderHome(A);
    const f = emu.fault({ uid: A.uid, db: true, collection: 'hansen_pk_rooms', do: 'hang', ms: 30000 });
    await A.tap('#ldGo');
    const w = await watch(A, /网络太慢了|数据库这次没让读写|数据库拒绝了|连不上网络|云端设置还差一步|云端登录过期/, 150000);
    f.remove();
    await t.ok(has(w.last, /网络太慢了/), `说的是「网络太慢了」（用了 ${Math.round(w.ms / 1000)} 秒；看到：${flat(w.last).slice(0, 120)}）`, () => explain());
    await t.ok(!w.seen.some((k) => BAD_DB.test(k)), `没说成数据库 / 云端设置的问题（出现过：${w.seen.join('、')}）`, () => explain());
    await t.ok((await A.hitTest('#ldRetry', { timeout: 1000 })).ok, '有重试按钮、点得到', () => explain());
  });

  /* ══ ② 一直 502 ════════════════════════════════════════════════ */
  await part('② 数据库一直回 502：话说成「可能」、给「再试一次」；好了以后点一下就接着找（T5）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const A = await phone('乙', '小蜂乙');
    await toLadderHome(A);
    const f = emu.fault({ uid: A.uid, db: true, collection: 'hansen_pk_rooms', do: 'http500', status: 502 });
    await A.tap('#ldGo');
    const w = await watch(A, /数据库这次没让读写|数据库拒绝了|连不上网络|云端设置还差一步|网络太慢了/, 90000);
    await t.ok(has(w.last, /数据库这次没让读写/) && has(w.last, /可能/) && !has(w.last, /网没有断|检查一下 Wi-Fi/),
      `说的是「云端连得上，但数据库这次没让读写」、话说成「可能」，不一口咬定、不让查 Wi-Fi（看到：${flat(w.last).slice(0, 150)}）`, () => explain());
    const probed = emu.log.some((x) => x.uid === A.uid && /\/auth\/v1\/user\/me/.test(x.path) && x.status === 200);
    await t.ok(probed, '真的问过一次登录服务才下的结论', () => explain());
    f.remove();
    await A.tap('#ldRetry');
    const back = await A.waitScreen(/正在找对手|等对手进来/, { timeout: 20000 }).catch((e) => e.lastText || '');
    await t.ok(has(back, /正在找对手|等对手进来/), `数据库好了以后点「再试一次」→ 接着找对手（看到：${flat(back).slice(0, 80)}）`, () => explain());
  });

  /* ══ ③ 502 一阵，看的那一下刚好好了 ═══════════════════════════════ */
  await part('③ 数据库回 502 一阵、看是哪里不通的那一下刚好好了：马上再找一次，接着找对手（T5 / FX-8）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const A = await phone('丙', '小蜂丙');
    await toLadderHome(A);
    const f = emu.fault({ uid: A.uid, db: true, collection: 'hansen_pk_rooms', do: 'http500', status: 502 });
    let healed = false;
    const heal = (txt) => { if (!healed && (/正在看看是哪里不通/.test(txt) || emu.log.some((x) => x.uid === A.uid && /\/auth\/v1\/user\/me/.test(x.path)))) { f.remove(); healed = true; } };
    await A.tap('#ldGo');
    const w = await watch(A, /等对手进来|数据库这次没让读写|数据库拒绝了|连不上网络|云端设置还差一步|网络太慢了/, 90000, heal);
    await t.ok(healed, '502 是在「看看是哪里不通」那一下消失的', () => explain());
    await t.ok(has(w.last, /等对手进来|正在找对手/) && !w.seen.some((k) => BAD_DB.test(k) || /连不上网络/.test(k)),
      `接着找对手、最后自己开了房等人，什么错都没报（出现过：${w.seen.join('、')}）—— 以前直接「数据库拒绝了，截图发给老师」`, () => explain());
  });

  /* ══ ④ 只有数据库断了一阵 ═════════════════════════════════════════ */
  await part('④ 只有数据库断了一阵（登录服务通）、看的那一下刚好恢复：接着找对手（FX-8）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const A = await phone('丁', '小蜂丁');
    await toLadderHome(A);
    const f = emu.fault({ uid: A.uid, db: true, do: 'abort' });
    let healed = false;
    const heal = (txt) => { if (!healed && (/正在看看是哪里不通/.test(txt) || emu.log.some((x) => x.uid === A.uid && /\/auth\/v1\/user\/me/.test(x.path)))) { f.remove(); healed = true; } };
    await A.tap('#ldGo');
    const w = await watch(A, /等对手进来|数据库这次没让读写|数据库拒绝了|连不上网络|云端设置还差一步|网络太慢了/, 90000, heal);
    await t.ok(healed, '断网是在「看看是哪里不通」那一下恢复的', () => explain());
    await t.ok(has(w.last, /等对手进来|正在找对手/) && !w.seen.some((k) => BAD_DB.test(k)),
      `接着找对手，没说成「数据库拒绝了 / 云端设置」（出现过：${w.seen.join('、')}）`, () => explain());
  });

  /* ══ ⑤ 会话被撤、数据库回 401 ═════════════════════════════════════ */
  await part('⑤ 会话被云端撤了、数据库回 HTTP 401：「云端登录过期了」+ 重新登录表单（T5）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, tokenErrStatus: 401 } });
    names = {};
    const A = await phone('戊', '小蜂戊');
    await toLadderHome(A);
    await H.sleep(61000 - 0);   /* 过了「刚登录 60 秒」的保护期（那 60 秒里不清登录记录） */
    emu.revokeSessions(A.uid);
    await A.tap('#ldGo');
    const w = await watch(A, /云端登录过期|排位要先登录|数据库这次没让读写|数据库拒绝了|连不上网络|云端设置还差一步/, 90000);
    await t.ok(has(w.last, /云端登录过期/) && !w.seen.some((k) => BAD_DB.test(k)), `说的是「云端登录过期了」，没说成数据库的问题（出现过：${w.seen.join('、')}；看到：${flat(w.last).slice(0, 100)}）`, () => explain());
    if ((await A.hitTest('#ldGoLogin', { timeout: 1500 })).ok) await A.tap('#ldGoLogin');
    const form = await A.hitTest('#auPhone', { timeout: 6000 });
    await t.ok(form.ok, `「重新登录」打开的是登录表单、手机号框点得到（${form.ok || form.why}）`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
