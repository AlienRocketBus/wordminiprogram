#!/usr/bin/env node
/* test_island_r2_cloud_v1164.mjs —— 首页（index.html）里的岛：返回键、云存档、拼写大PK首页
 *（审查第二轮 T1、FX-2、FX-3、R2-2（账号）、R2-1（回归）、R2-6（回归）、R2-UI-11）
 *
 * 孩子最常走的路：首页 → 点一个岛（岛开在首页里的 iframe 里，按返回只是藏起来、不卸载）。
 * 真页面、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。
 *
 *   ① 岛里「公开房间 → 开一间 → 选玩法」，房还没开好就按手机返回键 —— 房不许开出来、别人列不到（T1）
 *   ② 岛里「天梯 → 开始排位」，等了 20 秒自己开房「正在开房间…」时按返回键 —— 同样（FX-2）
 *   ③ 岛里学了东西、8 秒内点返回回到首页、马上切出 App —— 这一局要传上云，而且只传一次（FX-3 / R2-2 / R2-1）；
 *      之后在首页改了进度（首页本身没有云存档模块）再切出 App —— 也要传上去
 *   ④ 去过岛以后再打开首页：不再预取一个不存在的 island_wordIslandAnimal.html（404，R2-6）
 *   ⑤ 岛上的「拼写大PK」首页：打过排位以后显示真的段位分和胜率（R2-UI-11：以前「未定级」「— 对战胜率」）
 *   ⑥ 打开一个岛：开机「云端有没有更新的存档」只查一次（R2-5 配额：以前岛 + 几个预热页面各查一次）
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('首页里的岛：返回键 / 云存档 / 拼写大PK首页 · 真 SDK（审查 T1、FX-2、FX-3、R2-1/2/6、R2-UI-11）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
const has = (s, re) => re.test(String(s || ''));
let seq = 10;

const HOME = { path: '/index.html', ready: () => typeof window.openIsland === 'function' && !!window.HansenAuth };
async function phone(name, nick, opts = {}, login = true) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  p.nick = nick;
  if (!login) return p;
  const r = await H.loginPhone(p, '135000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.key = 'u' + r.uid; p.uid = r.uid;
  return p;
}
async function closeAll() {
  await H.cleanPhones(t, live);
  for (const p of live) await p.close();
  live.length = 0;
}
async function part(title, fn) {
  /* 只跑某几段（排查用）：R2_ONLY=①,③ node 这个文件 */
  const only = String(process.env.R2_ONLY || '').split(',').filter(Boolean);
  if (only.length && !only.some((x) => title.startsWith(x))) return;
  t.section(title);
  try { await fn(); }
  catch (e) { await t.ok(false, '这一段脚本出错：' + String(e && e.stack || e).slice(0, 500), () => explain()); }
  try { await closeAll(); } catch (e) { /* 已关 */ }
}
const liveRooms = (p) => H.roomDocs(emu).filter((d) => d.kind === 'room' && d.hostId === p.key && (d.status === 'open' || d.status === 'away'));
const writesBy = (uid, col) => emu.writes.filter((w) => w.uid === uid && w.collection === col);
/* 首页 → 打开动物岛，等岛里的模块就绪；返回岛的 frame */
async function openAnimalIsland(G) {
  if ((await G.hitTest('#__hansen_onboarding button', { hasText: '跳过', timeout: 3000 })).ok) await G.tap('#__hansen_onboarding button', { hasText: '跳过' });
  await H.sleep(400);
  await G.eval(() => { window.openIsland('island_animal.html'); return true; });
  const fr = await H.until(async () => {
    const f = G.page.frames().find((x) => /island_animal/.test(x.url()) && x.parentFrame() === G.page.mainFrame());
    if (!f) return null;
    const ok = await f.evaluate(() => !!(window.HansenPkRoomUI && window.HansenPkRoom && window.HansenSbProfile && window.HansenCloudSave && window.HansenLadderUI)).catch(() => false);
    return ok ? f : null;
  }, { timeout: 45000, interval: 500 });
  await t.ok(!!fr, '首页里的岛打开了（iframe 里的模块就绪）', () => explain());
  if (fr) await fr.evaluate((nm) => { try { window.HansenSbProfile.setName(nm); } catch (e) { /* 起过 */ } return true; }, G.nick);
  /* 🔴v1165 返回键「只退一步」：岛上的「欢迎来到动物大冒险！」也算一步（第一下返回先关它）。
     孩子进岛先点掉它再去玩（和 H.dismissIslandWelcome 一样，只是这里的岛在首页的框里） */
  if (fr) {
    for (let i = 0; i < 4; i++) {
      if (!(await fr.evaluate(() => !!document.querySelector('#alertModal.show button')).catch(() => false))) break;
      await fr.locator('#alertModal.show button').first().tap();
      await H.sleep(500);
    }
  }
  return fr;
}
const wrapHidden = (G) => G.eval(() => (document.getElementById('islandFrameWrap') || {}).style.display === 'none');
/* 整个 App 切到后台 / 回到前台：首页和里面每一层 iframe 都会收到 visibilitychange */
async function appHidden(G, hidden) {
  const set = (h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    return true;
  };
  for (const f of G.page.frames()) { try { await f.evaluate(set, hidden); } catch (e) { /* 跨域 / 已卸载 */ } }
}

{
  /* ══ ① 开一间、还没开好就按返回 ═══════════════════════════════════ */
  await part('① 岛里「开一间 → 选玩法」，房还没开好就按手机返回键：房不许开出来（T1）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 300 } });
    names = {};
    const G = await phone('首页', '小蜂首页', HOME);
    const K = await phone('别人', '小蜂别人');
    const fr = await openAnimalIsland(G);
    if (!fr) return;
    await fr.evaluate(() => { window.HansenPkRoomUI.open(); return true; });
    await fr.locator('#prNew').tap();
    const hold = emu.hold({ uid: G.uid, db: true, action: 'database.addDocument' });
    await fr.locator('.pr_mode[data-mode="C"]').tap();
    await H.sleep(500);
    /* 🔴v1165 返回键「只退一步」：第 1 下 =「选个玩法」上的「← 返回」（回房间列表，这一次开房作废）；
       第 2 下 = 房间列表的「← 返回」（关掉房间层）；第 3 下才收起岛。房不许开出来 —— 从第 1 下起就不许 */
    await G.page.goBack();
    await H.sleep(800);
    hold.release();
    await H.sleep(5000);
    const wait1 = await fr.evaluate(() => /等对手进来/.test((document.getElementById('hsn_pkroom_screen') || {}).innerText || '')).catch(() => null);
    const lr1 = await H.room(K, 'listRooms');
    const listed1 = !!(lr1 && lr1.ok && (lr1.rooms || []).some((x) => x.hostName === G.nick));
    await t.ok(wait1 === false && liveRooms(G).length === 0 && !listed1, `第 1 下返回（房还没开好）：没画「等对手进来」、云端没有开着的房、别人列不到（等对手：${wait1}；开着 ${liveRooms(G).length} 间；别人列表里${listed1 ? '有' : '没有'}）`, () => explain());
    await G.page.goBack();
    await H.sleep(800);
    await G.page.goBack();
    await H.sleep(1500);
    const hidden = await wrapHidden(G);
    const uiOn = await fr.evaluate(() => !!document.querySelector('#hsn_pkroom_screen.on')).catch(() => null);
    const lr = await H.room(K, 'listRooms');
    const listed = !!(lr && lr.ok && (lr.rooms || []).some((x) => x.hostName === G.nick));
    await t.ok(hidden && uiOn === false, `按返回键：岛收起来了，藏起来的岛里也没有「等对手进来」（岛收起：${hidden}；房间层开着：${uiOn}）`, () => explain());
    await t.ok(liveRooms(G).length === 0 && !listed, `云端没有开着的房、别人也列不到（开着 ${liveRooms(G).length} 间；别人列表里${listed ? '有' : '没有'}）`, () => explain());
  });

  /* ══ ② 天梯自己开房时按返回 ═══════════════════════════════════════ */
  await part('② 岛里「天梯 → 开始排位」，自己开房「正在开房间…」时按返回键：房不许开出来（FX-2）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 40, jitterMs: 20, consistencyLagMs: 2000 } });
    names = {};
    const G = await phone('首页', '小蜂首页', HOME);
    const K = await phone('别人', '小蜂别人');
    const fr = await openAnimalIsland(G);
    if (!fr) return;
    await fr.evaluate(() => { window.HansenLadderUI.open(); return true; });
    await fr.locator('#ldGo').tap();
    const hold = emu.hold({ uid: G.uid, db: true, action: 'database.addDocument' });
    const creating = await H.until(async () => {
      const txt = await fr.evaluate(() => document.body.innerText).catch(() => '');
      return /正在开房间/.test(txt) ? txt : null;
    }, { timeout: 45000, interval: 300 });
    await t.ok(!!creating, '没人可配：天梯自己开房「正在开房间…」', () => explain());
    /* 🔴v1165 返回键「只退一步」：第 1 下 = 这一屏的「取消，回天梯」（这一次开房作废）；第 2 下关天梯页；第 3 下才收起岛。
       房不许开出来 —— 从第 1 下起就不许（以前第 1 下被当成对战去问「要退出吗？」，房照样开出来挂在列表上） */
    await G.page.goBack();
    await H.sleep(800);
    hold.release();
    await H.sleep(6000);
    const lr1 = await H.room(K, 'listRooms', { ladder: true });
    const listed1 = !!(lr1 && lr1.ok && (lr1.rooms || []).some((x) => x.hostName === G.nick));
    await t.ok(liveRooms(G).length === 0 && !listed1, `第 1 下返回（正在开房间）：排位房没开出来（开着 ${liveRooms(G).length} 间；别人${listed1 ? '列得到' : '列不到'}）`, () => explain());
    await G.page.goBack();
    await H.sleep(800);
    await G.page.goBack();
    await H.sleep(1500);
    const hidden = await wrapHidden(G);
    const lr = await H.room(K, 'listRooms', { ladder: true });
    const listed = !!(lr && lr.ok && (lr.rooms || []).some((x) => x.hostName === G.nick));
    await t.ok(hidden, '按返回键：岛收起来了', () => explain());
    await t.ok(liveRooms(G).length === 0 && !listed, `排位房没开出来（开着 ${liveRooms(G).length} 间；别人${listed ? '列得到' : '列不到'}）—— 以前藏起来的岛里开着一间排位房等人、别人被配进来跟空气打`, () => explain());
  });

  /* ══ ③ 学了东西、返回、切出 App ═══════════════════════════════════ */
  await part('③ 岛里学了东西、8 秒内点返回、马上切出 App：传上云，只传一次；首页上改的也传（FX-3 / R2-2 / R2-1）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 200 } });
    names = {};
    const G = await phone('首页', '小蜂首页', HOME);
    const fr = await openAnimalIsland(G);
    if (!fr) return;
    await H.sleep(4000);   /* 登录 / 开岛时的那几次同步先做完 */
    const n0 = writesBy(G.uid, 'hansen_saves').length;
    await fr.evaluate(() => {
      localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6] }));
      document.dispatchEvent(new Event('hsn-data-changed'));
      return true;
    });
    await H.sleep(1500);
    await G.page.goBack();               /* 8 秒的合并窗口还没到 */
    await H.sleep(700);
    await appHidden(G, true);
    await H.sleep(6000);
    const n1 = writesBy(G.uid, 'hansen_saves').length - n0;
    await appHidden(G, false);
    await t.ok(await wrapHidden(G), '回到了首页（岛藏起来了）', () => explain());
    /* 1 次是本意；岛里预热着的星海岛隔几秒会改一次它自己的进度，刚好赶上时会多传一次（传的是新内容，不是重复） */
    await t.ok(n1 >= 1 && n1 <= 2, `学了东西、点返回、切出 App：云存档传了 ${n1} 次（该是 1 次，最多 2 次）—— 以前 0 次，这一局没上云`, () => explain());
    /* 首页上改了进度（首页本身没有云存档模块，由藏起来的岛替它传） */
    await H.sleep(1500);
    const n2 = writesBy(G.uid, 'hansen_saves').length;
    await G.eval(() => { localStorage.setItem('wordIslandFood', JSON.stringify({ learned: [1, 2, 3, 4, 5, 6, 7] })); return true; });
    await appHidden(G, true);
    await H.sleep(5000);
    const n3 = writesBy(G.uid, 'hansen_saves').length - n2;
    await appHidden(G, false);
    await t.ok(n3 >= 1 && n3 <= 2, `在首页上改了进度再切出 App：传了 ${n3} 次（该是 1 次，最多 2 次）`, () => explain());
    /* 没改东西再切一次：最多传一次，不会一层页面传一次（审查 SE-4 省下的配额还在）。
       ⚠️ 岛里预热着的星海岛隔几秒会改一次它自己的进度 —— 那种时候传一次是对的，所以这里只要求「不超过一次」 */
    await H.sleep(1500);
    const n4 = writesBy(G.uid, 'hansen_saves').length;
    await appHidden(G, true);
    await H.sleep(4000);
    const n5 = writesBy(G.uid, 'hansen_saves').length - n4;
    await appHidden(G, false);
    await t.ok(n5 <= 1, `什么都没改再切出去：最多传一次（传了 ${n5} 次；以前一层页面传一次，切一次后台传好几次）`, () => explain());
  });

  /* ══ ④ 去过岛以后的首页：不预取不存在的文件 ═════════════════════════ */
  await part('④ 去过岛以后再打开首页：不再预取 island_wordIslandAnimal.html（R2-6）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const G = await phone('首页', '小蜂首页', HOME, false);
    const fr = await openAnimalIsland(G);
    if (!fr) return;
    await G.page.goBack();
    await H.sleep(800);
    const last = await G.eval(() => localStorage.getItem('lastIslandKey'));
    const m0 = srv.missing.length;
    await G.page.reload({ waitUntil: 'domcontentloaded' });
    await H.sleep(7000);
    const bad = srv.missing.slice(m0).filter((p) => /island_/.test(p));
    await t.ok(!!last, `首页记下了最近去的岛（${last}）`, () => explain());
    await t.ok(!bad.length, `重新打开首页：没有去拿不存在的岛文件（404：${bad.join(', ') || '没有'}）`, () => explain());
  });

  /* ══ ⑤ 岛上的拼写大PK首页：段位和胜率 ═══════════════════════════════ */
  await part('⑤ 岛上的「拼写大PK」首页：打过排位以后显示真的段位分和胜率（R2-UI-11）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const I = await phone('岛屿页', '小蜂岛', { path: '/island_animal.html' }, false);
    await I.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1095, peakRating: 1095, placementGames: 4, wins: 4, losses: 0, draws: 0, history: [] })); return true; });
    const lad = await I.eval(() => { const s = window.HansenPkRecord.summary(); return { rating: s.rating, placed: s.placed, total: s.total, wins: s.wins }; });
    await H.dismissIslandWelcome(I);
    await I.tap('.mode-card[onclick*="openSpellPK"]');
    const pk = await I.waitScreen(/拼写大PK/, { timeout: 8000 }).catch((e) => e.lastText || '');
    await t.ok(lad && lad.placed && lad.total === 4, `战绩里是 4 胜、1095 分、已定级（${JSON.stringify(lad)}）`, () => explain());
    await t.ok(has(pk, /1095\s*分/) && !has(pk, /未定级/), `拼写大PK首页的身份条显示「1095 分」，不是「未定级」（看到：${flat(pk).slice(0, 120)}）`, () => explain());
    await t.ok(has(pk, /100%/), `「我的战绩」里胜率是 100%，不是「—」（看到：${(flat(pk).match(/我的战绩.{0,80}/) || [''])[0]}）`, () => explain());
  });

  /* ══ ⑥ 开机查云存档：只有最上面那一层查 ══════════════════════════ */
  await part('⑥ 打开一个岛：开机「云端有没有更新的存档」只查一次（R2-5 配额：以前岛 + 几个预热页面各查一次）', async () => {
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
    names = {};
    const I = await phone('岛屿页', '小蜂岛', { path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenCloudRestore) });
    await H.sleep(2000);
    /* 🔴v1165：藏着的预热页（赛季岛）只给「真的打开过星海房间」的孩子做（hansen_room_warm_v1023.js wasOpened('season')，
       记号同 test_room_warm_v1023）。这里要数的是「几层页面各查一次」，所以这是一个去过星海的孩子：重新打开前写上记号 */
    await I.eval(() => { localStorage.setItem('hansen_room_opened_v1165_season', '1'); return true; });
    const t0 = Date.now();
    await I.page.reload({ waitUntil: 'domcontentloaded' });
    await I.page.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudRestore), null, { timeout: 45000 });
    await H.sleep(14000);
    const frames = await I.eval(() => { let n = 0; const walk = (w) => { try { if (w.HansenCloudRestore) n++; for (let i = 0; i < w.frames.length; i++) walk(w.frames[i]); } catch (e) { /* 跨域 */ } }; walk(window); return n; });
    const reads = emu.log.filter((x) => x.uid === I.uid && x.collection === 'hansen_saves' && x.action === 'database.queryDocument' && x.t >= t0).length;
    await t.ok(frames >= 2, `这一页里装着云存档开机检查的有 ${frames} 层（岛 + 预热的页面）`, () => explain());
    /* 开机检查自己记下的结果（v1165 复查第 4 轮加的）：0 次时说清楚是没登录好、模块没到还是没跑到 */
    const boot = await I.eval(() => { const b = window.__hsnRestoreBoot; return b ? JSON.stringify({ ago: Date.now() - b.t, top: b.top, r: b.r }) : '没跑到'; });
    await t.ok(reads >= 1 && reads <= 2, `打开一次岛，开机查云存档 ${reads} 次（该是 1 次；以前每层各查一次）· 开机检查：${boot}`, () => explain());
  });
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
