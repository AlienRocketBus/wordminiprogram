#!/usr/bin/env node
/* test_cloud_errors_v1164.mjs —— 云端出问题时，孩子/老师看到的话对不对
 *
 * 为什么要有它：SDK 遇到「权限不够」「集合不存在」是 resolve 一个 {code}，不报错 ——
 *   以前没人查 code，于是权限被拒看起来像「空列表」「没人开房」，天梯一直转圈；
 *   断网和没登录又被混成一句「排位要先登录」。老师照着提示永远修不好。
 *   这里页面/账号/房间/SDK 全是真的，只有腾讯云由 cloudbase_emulator.mjs 应答，按场景出错。
 *
 *   ① 集合权限是「无权限」（ADMINONLY）→ 天梯和公开房间都显示「云端设置还差一步」，
 *      说清是哪个集合、该改成什么权限，并带技术信息（原始错误码）
 *   ② 没建 hansen_pk_rooms 集合 → 同一屏，说清要新建哪个集合
 *   ③ 断网（这台手机的所有请求都被掐断，登录服务也连不上）→ 重试几次后「连不上网络」+ 技术信息
 *      （network request error）；网回来点「重新找对手」就接着找 —— 中途绝不说「排位要先登录」
 *   ③b 网是通的、登录服务也通，只有数据库回了非 200（没权限 403 / 没集合 404，SDK 只说 network request error）
 *      →「云端连得上，但数据库这次没让读写」+ 可能的原因 + 再试一次 + 技术信息；
 *      绝不说「连不上网络 · 检查 Wi-Fi」（审查 TI-4：v1163 的原症状），也不一口咬定「网没有断」（审查 FX-8）
 *   ④ 登录令牌该刷新了、刷新请求却发不出去 → 「云端还没连上」或「连不上网络」+ 重试；
 *      绝不说「排位要先登录」「登录过期」（凭证还在，不是没登录）；网回来就好
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('云端出错时的提示 · 真 SDK 端到端（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
let seq = 60;

async function phone(name, nick, knobs) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, '138000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick;
  return p;
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}
/* 一直看着屏幕，记下出现过的每一句关键话（中途闪过的错话也算） */
async function watch(p, doneRe, ms) {
  const seen = new Set(); let last = '';
  const KEYS = [/排位要先登录/, /云端登录过期/, /连不上网络/, /云端还没连上/, /云端设置还差一步/, /正在连接云端/, /正在找对手/, /等对手进来/];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    last = (await p.screen()) + ' ' + p.dialogs.map((d) => d.message).join(' ');
    for (const k of KEYS) if (k.test(last)) seen.add(k.source);
    if (doneRe.test(last)) break;
    await H.sleep(400);
  }
  return { seen: [...seen], last, ms: Date.now() - t0 };
}

try {
  /* ══ ① 集合「无权限」 ═══════════════════════════════════════════ */
  t.section('① hansen_pk_rooms 设成了「无权限」（ADMINONLY · rules）');
  emu = H.makeEmulator({ collections: H.defaultCollections({ hansen_pk_rooms: H.ACL.ADMINONLY }), knobs: { permissionMode: 'rules', latencyMs: 40 } });
  names = {};
  const A = await phone('甲', '小蜂甲');
  await toLadderHome(A);
  await A.tap('#ldGo');
  let w = await watch(A, /云端设置还差一步/, 30000);
  await t.ok(has(w.last, /云端设置还差一步/), `天梯：显示「云端设置还差一步」（用了 ${Math.round(w.ms / 1000)} 秒；看到：${flat(w.last).slice(0, 160)}）`, () => explain());
  await t.ok(has(w.last, /hansen_pk_rooms/) && has(w.last, /读取全部数据，修改本人数据/), '说清是哪个集合、该改成什么权限（hansen_pk_rooms →「读取全部数据，修改本人数据」）', () => explain());
  await t.ok(has(w.last, /技术信息/) && has(w.last, /DATABASE_PERMISSION_DENIED/), '带着技术信息（原始错误码 DATABASE_PERMISSION_DENIED）', () => explain());
  await t.ok(!w.seen.some((k) => /排位要先登录|连不上网络|登录过期/.test(k)), `中途没有说成「要登录」或「断网」（出现过：${w.seen.join('、')}）`, () => explain());
  /* 关掉天梯（点 ×）之后不能冒出「这一步没能打开」的救援层 —— 看门狗只该救真卡住的人 */
  await A.tap('#ldCancel');
  let rescue = false;
  for (let i = 0; i < 18 && !rescue; i++) { await H.sleep(500); rescue = has(await A.screen(), /这一步没能打开/); }
  const homeOk = (await A.hitTest('#pkRooms', { timeout: 1000 })).ok;
  const home = await A.eval(() => { const h = document.getElementById('pkHome'); return h ? { cls: h.className, inline: h.style.display || '', shown: getComputedStyle(h).display } : null; });
  await t.ok(!rescue && homeOk, `点 × 关掉天梯 → 回到大PK首页，没有冒出「这一步没能打开」（救援层 ${rescue ? '冒出来了' : '没有'}，首页按钮 ${homeOk ? '点得到' : '点不到'}；#pkHome ${JSON.stringify(home)}）`,
    () => explain(home && home.inline === 'none' ? '首页 #pkHome 被内联 display:none 藏着 —— 起名屏 askName() 把所有 .pk_screen 都藏了、起完名没恢复，于是关掉天梯后整页空白' : ''));
  if (rescue || !homeOk) {   // 卡住了就像孩子一样刷新页面，接着测后面的
    await A.page.reload({ waitUntil: 'domcontentloaded' });
    await A.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoomUI && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
    await H.sleep(800);
  }
  await A.tap('#pkRooms');
  await H.answerNameIfAsked(A, A.nick);
  const lob = await A.waitScreen(/云端设置还差一步/, { timeout: 15000 }).catch((e) => e.lastText || '');
  await t.ok(has(lob, /云端设置还差一步/) && has(lob, /DATABASE_PERMISSION_DENIED/), `公开房间：列表处也说「云端设置还差一步」+ 技术信息（看到：${flat(lob).slice(0, 140)}）`, () => explain());
  await A.tap('#prNew').catch(() => {});
  await A.tap('.pr_mode[data-mode="C"]').catch(() => {});
  const mk = await A.waitScreen(/云端设置还差一步|等对手进来/, { timeout: 15000 }).catch((e) => e.lastText || '');
  await t.ok(has(mk, /云端设置还差一步/) && !has(mk, /等对手进来/), `开房：说「云端设置还差一步」，没有假装开好了（看到：${flat(mk).slice(0, 120)}）`, () => explain());
  await H.cleanPhones(t, [A]);   /* 审查 T8：关手机之前看一眼页面报错 */
  await A.close(); live.length = 0;

  /* ══ ② 没建集合 ════════════════════════════════════════════════ */
  t.section('② 还没建 hansen_pk_rooms 集合（legacy）');
  const cols = H.defaultCollections(); delete cols.hansen_pk_rooms;
  emu = H.makeEmulator({ collections: cols, knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const B = await phone('乙', '小蜂乙');
  await toLadderHome(B);
  await B.tap('#ldGo');
  w = await watch(B, /云端设置还差一步/, 30000);
  await t.ok(has(w.last, /云端设置还差一步/) && has(w.last, /hansen_pk_rooms/) && has(w.last, /新建|建/), `天梯：「云端设置还差一步」，说清要新建 hansen_pk_rooms（看到：${flat(w.last).slice(0, 160)}）`, () => explain());
  await t.ok(has(w.last, /技术信息/) && has(w.last, /DATABASE_COLLECTION_NOT_EXIST/), '带着技术信息（DATABASE_COLLECTION_NOT_EXIST）', () => explain());
  await t.ok(!w.seen.some((k) => /排位要先登录|连不上网络|等对手进来/.test(k)), `没有说成「要登录」「断网」，也没有假装开了房（出现过：${w.seen.join('、')}）`, () => explain());
  await H.cleanPhones(t, [B]);
  await B.close(); live.length = 0;

  /* ══ ③ 断网 ════════════════════════════════════════════════════ */
  t.section('③ 断网：这台手机的请求全被掐断（数据库 + 登录服务，legacy）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
  names = {};
  const C = await phone('丙', '小蜂丙');
  await toLadderHome(C);
  /* 真断网：不光数据库，登录服务也连不上（审查 TI-4 以后，「只有数据库不通」是另一种情况，见 ③b） */
  const cut = emu.fault({ uid: C.cloudUid, do: 'abort' });
  await C.tap('#ldGo');
  w = await watch(C, /连不上网络/, 60000);
  await t.ok(has(w.last, /连不上网络/), `重试几次后显示「连不上网络」（用了 ${Math.round(w.ms / 1000)} 秒；看到：${flat(w.last).slice(0, 140)}）`, () => explain());
  await t.ok(has(w.last, /技术信息/) && has(w.last, /network request error/i), '技术信息里是原始错误「network request error」', () => explain());
  await t.ok(!w.seen.some((k) => /排位要先登录|登录过期|云端设置/.test(k)), `断网时没有说成「要登录」或「云端设置」（出现过：${w.seen.join('、')}）`, () => explain());
  cut.remove();
  await C.tap('#ldRetry').catch(() => C.tap('button', { hasText: '重新找对手' }));
  const back = await C.waitScreen(/正在找对手|等对手进来/, { timeout: 15000 }).catch((e) => e.lastText || '');
  await t.ok(has(back, /正在找对手|等对手进来/), `网回来了点「重新找对手」→ 接着找（看到：${flat(back).slice(0, 80)}）`, () => explain());
  await H.cleanPhones(t, [C]);
  await C.close(); live.length = 0;

  /* ══ ③b 数据库回非 200、登录服务是通的 ══════════════════════════ */
  for (const v of [
    { tag: '没权限 · HTTP 403', cols: H.defaultCollections({ hansen_pk_rooms: H.ACL.ADMINONLY }), knobs: { permissionMode: 'rules', deniedStatus: 403 } },
    { tag: '没建集合 · HTTP 404', cols: (() => { const c = H.defaultCollections(); delete c.hansen_pk_rooms; return c; })(), knobs: { permissionMode: 'legacy', missingStatus: 404 } },
  ]) {
    t.section(`③b 数据库回了非 200（${v.tag}），登录服务是通的`);
    emu = H.makeEmulator({ collections: v.cols, knobs: Object.assign({ latencyMs: 40 }, v.knobs) });
    names = {};
    const E = await phone('戊', '小蜂戊');
    await toLadderHome(E);
    await E.tap('#ldGo');
    w = await watch(E, /数据库这次没让读写|数据库拒绝了|连不上网络/, 70000);
    /* 🔴审查 FX-8：话说成「可能」、先给「再试一次」—— 断网刚恢复时也会走到这里，不能一口咬定「网没有断」 */
    await t.ok(has(w.last, /云端连得上，但数据库这次没让读写/) && has(w.last, /安全域名|权限|集合/) && has(w.last, /可能/) && !has(w.last, /网没有断/),
      `显示「云端连得上，但数据库这次没让读写」并说可能的原因（用了 ${Math.round(w.ms / 1000)} 秒；看到：${flat(w.last).slice(0, 150)}）`, () => explain());
    await t.ok((await E.hitTest('#ldRetry', { timeout: 1000 })).ok, '有「再试一次」按钮、点得到', () => explain());
    await t.ok(!has(w.last, /连不上网络|检查一下 Wi-Fi/), '没有让老师去查 Wi-Fi（网是通的）', () => explain());
    await t.ok(has(w.last, /技术信息/) && has(w.last, /network request error/i), '技术信息里是原始错误「network request error」', () => explain());
    const probed = emu.log.some((x) => x.uid === E.cloudUid && /\/auth\/v1\/user\/me/.test(x.path) && x.status === 200);
    await t.ok(probed, '真的问过一次登录服务（/auth/v1/user/me 回了 200）才下的结论', () => explain());
    await t.ok(!w.seen.some((k) => /排位要先登录|登录过期/.test(k)), `没有说成「要登录」（出现过：${w.seen.join('、')}）`, () => explain());
    await H.cleanPhones(t, [E]);
    await E.close(); live.length = 0;
  }

  /* ══ ④ 刷新令牌发不出去 ═════════════════════════════════════════ */
  t.section('④ 登录令牌过期要刷新、刷新请求却发不出去（legacy）');
  /* 令牌只给 35 秒：SDK 记的过期时间是 35-30=5 秒后，之后每次用云端都要先刷新 */
  emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, accessTokenTtlSec: 35 } });
  names = {};
  const D = await phone('丁', '小蜂丁');
  await toLadderHome(D);
  const noRefresh = emu.fault({ path: '/auth/v1/token', do: 'abort' });
  await H.sleep(6500);
  await D.tap('#ldGo');
  w = await watch(D, /云端还没连上|连不上网络/, 70000);
  await t.ok(has(w.last, /云端还没连上|连不上网络/) && (await D.hitTest('#ldRetry', { timeout: 1000 })).ok,
    `显示「云端还没连上」或「连不上网络」并给重试按钮（用了 ${Math.round(w.ms / 1000)} 秒；看到：${flat(w.last).slice(0, 140)}）`, () => explain());
  await t.ok(!w.seen.some((k) => /排位要先登录|云端登录过期/.test(k)), `凭证还在，就绝不说「要登录 / 登录过期」（出现过：${w.seen.join('、')}）`, () => explain());
  const st = await D.eval(() => ({ signed: HansenAuth.isSignedIn(), cred: HansenAuth.credentialsPresent() }));
  await t.ok(st && st.signed && st.cred, `本机登录记录和云端凭证都还在（已登录=${st && st.signed}，凭证=${st && st.cred}）`);
  noRefresh.remove();
  await D.tap('#ldRetry');
  const ok4 = await D.waitScreen(/正在找对手|等对手进来/, { timeout: 30000 }).catch((e) => e.lastText || '');
  await t.ok(has(ok4, /正在找对手|等对手进来/), `刷新恢复后点重试 → 接着找对手（看到：${flat(ok4).slice(0, 80)}）`, () => explain());
  for (const p of live) await t.ok(!p.errors.length, `[${p.name}] 没有页面报错（${p.errors.slice(0, 2).join(' | ') || '无'}）`);
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
