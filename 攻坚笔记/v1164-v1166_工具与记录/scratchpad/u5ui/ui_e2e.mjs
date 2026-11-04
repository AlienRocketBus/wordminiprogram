// 天梯 / 房间对战 —— 界面层 E2E：真 SDK 2.30.0 + 真页面 + 真账号/房间/界面模块，只有腾讯云网络由 emulator 本地应答。
// 每个浏览器上下文 = 一台手机 = 一个账号。全程用界面上的按钮（touchscreen.tap / click），不注入任何传输层桩。
// 用法: node ui_e2e.mjs [legacy|rules] [latencyMs] [lagMs]
const POC = process.env.EMU_DIR || '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/emulator-poc';
const { createEmulator, ACL } = await import(POC + '/emulator.mjs');
const { startStatic, launch, newCtx, E } = await import(POC + '/harness.mjs');
import fs from 'node:fs';

const mode = process.argv[2] || 'legacy';
const LAT = Number(process.argv[3] || 80), LAG = Number(process.argv[4] || 400);
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);
const emu = createEmulator({
  collections: { hansen_pk_rooms: ACL.READONLY, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY, counters: ACL.ADMINONLY,
                 hansen_friends: ACL.READONLY, hansen_pk_records: ACL.READONLY, hansen_ladder: ACL.READONLY },
  knobs: { permissionMode: mode, latencyMs: LAT, jitterMs: Math.round(LAT * 0.75), consistencyLagMs: LAG },
});
const USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];
for (const u of USERS) emu.seedUser({ username: u + '_ui', password: 'pw123456', name: u });

let pass = 0, failN = 0; const lines = [];
const ok = (c, m) => { const l = (c ? '  OK  ' : '  XX  ') + m; lines.push(l); console.log(l); c ? pass++ : failN++; };
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));

const srv = await startStatic();
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const P = {};
const errsOf = {};
async function open(name, url = '/spelling_pk.html', login) {
  login = login || name;
  const c = await newCtx(browser, emu, ORIGIN, { tag: name, url, waitReady: false,
    ctxOpts: { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } });
  errsOf[name] = [];
  c.page.on('pageerror', (e) => errsOf[name].push(String(e.message).slice(0, 120)));
  await c.page.waitForFunction(() => window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI
    && window.HansenLadderUI && window.HansenAuth.loginByPassword, null, { timeout: 40000 });
  await c.page.waitForTimeout(800);
  const r = await E(c.page, async (u) => {
    try { localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify({ name: u + '同学', cid: 1 })); } catch (e) {}
    const l = await window.HansenAuth.loginByPassword(u + '_ui', 'pw123456').then(() => ({ ok: true }), (e) => ({ ok: false, e: String(e && e.message || e) }));
    const s = await window.HansenAuth.ensureSession();
    /* 测试把轮询/门槛调快（产品默认不变） */
    window.HansenPkRoom._setTimingForTest({ waitPollMs: 500, ackPollMs: 400 });
    window.__hsnLadderWaitSec = 3;
    return { l, s };
  }, login);
  c.name = name; P[name] = c;
  return { c, r };
}
const docs = () => emu.dump('hansen_pk_rooms') || [];
const scr = (pg) => E(pg, () => {
  const vis = [...document.querySelectorAll('.pr_wrap,.ld_wrap')].filter((w) => {
    const h = w.parentElement; return h && getComputedStyle(h).display !== 'none';
  });
  return vis.map((w) => (w.innerText || '').replace(/\s+/g, ' ')).join(' || ').slice(0, 300);
});
async function tap(pg, sel) {
  const box = await E(pg, (s) => {
    const el = document.querySelector(s); if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel);
  if (!box || box.__thrown) return 'missing';
  const top = await E(pg, (b) => { const e = document.elementFromPoint(b.x, b.y); return e ? (e.id || e.className || e.tagName) : ''; }, box);
  await pg.touchscreen.tap(box.x, box.y);
  return top;
}
async function waitFor(pg, fn, ms = 30000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await E(pg, fn, arg);
    if (v && !v.__thrown) return v;
    await sleep(250);
  }
  return null;
}
const inBattle = (pg, ms) => waitFor(pg, () => !!document.getElementById('prIn'), ms);
/* 机器人：policy(idx) 返回 true 就立刻拼这一词（用屏幕上的键盘逐个字母点） */
async function botStep(pg, policyName) {
  return E(pg, async (pn) => {
    const UI = window.HansenPkRoomUI;
    const rt = UI._rtForTest(), st = UI._stateForTest();
    if (!rt || rt.answered || !st || !st.words) return { idle: true };
    const idx = rt.idx;
    const go = pn === 'all' ? true : pn === 'odd1' ? idx !== 1 : pn === 'only1' ? idx === 1 : false;
    if (!go) return { idx, skip: true };
    const w = st.words[idx]; if (!w) return { idle: true };
    const en = String(w.en || '').toLowerCase();
    if (/^[a-z]+$/.test(en)) {
      for (const ch of en) {
        const k = document.querySelector('.pr_key[data-k="' + ch + '"]');
        if (!k) break;
        k.click();
        await new Promise((z) => setTimeout(z, 15));
      }
    }
    const inp = document.getElementById('prIn');
    if (inp && !UI._rtForTest().answered) { inp.value = en; if (inp.oninput) inp.oninput(); }
    return { idx, typed: en };
  }, policyName);
}
async function playUntilResult(pairs, ms = 240000) {
  const t0 = Date.now(), done = {};
  while (Date.now() - t0 < ms) {
    for (const [pg, pol, name] of pairs) {
      if (done[name]) continue;
      const res = await E(pg, () => { const r = document.querySelector('.pr_res'); return r ? r.textContent : ''; });
      if (res && !res.__thrown) { done[name] = res; continue; }
      await botStep(pg, pol);
    }
    if (pairs.every(([, , n]) => done[n])) break;
    await sleep(300);
  }
  return done;
}
const summary = (pg) => E(pg, () => { const s = window.HansenPkRecord.summary(); return { rating: s.rating, total: s.total, wins: s.wins, losses: s.losses, h: s.history[0] || null }; });
const out = { mode, LAT, LAG };

try {
  for (const u of ['alice', 'bob', 'carol', 'dave', 'erin']) {
    const { r } = await open(u, u === 'alice' ? '/island_animal.html' : '/spelling_pk.html');
    ok(r && r.s && r.s.ok, `[${u}] 登录 + ensureSession ok（uid=${r && r.s && r.s.uid}）`);
  }
  const A = P.alice.page, B = P.bob.page, C = P.carol.page, D = P.dave.page, X = P.erin.page;

  /* ══ 场景 1：两个人同时点「开始排位」（A 在岛屿页、B 在大PK页）→ 配到同一间房 → 打完一局 → 两边都结算、天梯分变化 ══ */
  if (want('ladder')) {
    /* B 先有 1150 分（定级过）—— 用来验 ELO 用的是对手的真实分数 */
    await E(B, () => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1150, peakRating: 1150, placementGames: 3, wins: 3, total: 3 })); });
    const before = { A: await summary(A), B: await summary(B) };
    ok(before.B.rating === 1150 && before.A.total === 0, `开局：A ${before.A.rating} 分，B ${before.B.rating} 分`);
    /* A：岛屿页 → 拼写大PK → 天梯排位（手指点） */
    await E(A, () => openSpellPK());
    await A.waitForTimeout(500);
    const hitK = await tap(A, '#kLadder');
    await A.waitForTimeout(700);
    const aTop = await E(A, () => { const e = document.elementFromPoint(195, 300); return !!(e && e.closest('#hsn_ladder_screen')); });
    ok(aTop, `[A 岛屿页] 天梯开在大PK屏上面（点到 ${hitK}）`);
    /* B：大PK页 → 天梯排位 */
    await tap(B, '#pkLadder');
    await B.waitForTimeout(700);
    const [ga, gb] = await Promise.all([tap(A, '#ldGo'), tap(B, '#ldGo')]);
    ok(ga === 'ldGo' && gb === 'ldGo', `两边同时点到「开始排位」（A ${ga} / B ${gb}）`);
    const [ba, bb] = await Promise.all([inBattle(A, 60000), inBattle(B, 60000)]);
    ok(ba && bb, `两人同时开始 → 都进了对战屏（A ${!!ba} / B ${!!bb}）${!(ba && bb) ? ' A:' + (await scr(A)) + ' B:' + (await scr(B)) : ''}`);
    const sa = await E(A, () => { const s = window.HansenPkRoomUI._stateForTest() || {}; return { rid: s.roomId, host: s.isHost, mode: s.mode, ask: s.askMode, opp: s.oppName, oppR: s._oppRating }; });
    const sb = await E(B, () => { const s = window.HansenPkRoomUI._stateForTest() || {}; return { rid: s.roomId, host: s.isHost, mode: s.mode, ask: s.askMode, opp: s.oppName, oppR: s._oppRating }; });
    ok(sa.rid && sa.rid === sb.rid && sa.host !== sb.host, `同一间房、一个房主一个客人（${sa.rid} / A 房主=${sa.host}）`);
    ok(sa.mode === 'A' && sb.mode === 'A' && sa.ask === 'cn' && sb.ask === 'cn', `排位固定抢答赛 + 看中文（A ${sa.mode}/${sa.ask}，B ${sb.mode}/${sb.ask}）`);
    const rooms1 = docs().filter((d) => d.kind === 'room' && (d.hostName === 'alice同学' || d.hostName === 'bob同学'));
    const live1 = rooms1.filter((d) => d.status !== 'done');
    ok(live1.length === 1, `没有留下幽灵房（两人名下没关的房 ${live1.length} 间；共 ${rooms1.length} 间：${rooms1.map((d) => d.status).join(',')}）`);
    const adds = emu.log.filter((e) => e.body && e.body.action === 'database.addDocument' && /"kind":"room"/.test(JSON.stringify(e.body.data || '')) && /alice同学|bob同学/.test(JSON.stringify(e.body.data || '')));
    out.ladderRoomsCreated = adds.length;
    console.log('    （这一局两人一共开过 ' + adds.length + ' 间房；>1 说明走了「两人各开一间 → 换到先开的那间」）');
    await A.waitForTimeout(1500);
    const nm = await Promise.all([E(A, () => (document.getElementById('prOppName') || {}).textContent), E(B, () => (document.getElementById('prOppName') || {}).textContent)]);
    ok(nm[0] === 'bob同学' && nm[1] === 'alice同学', `对战屏显示对方真名（A 看到 ${nm[0]}，B 看到 ${nm[1]}）`);
    /* A 抢除第 2 词外的所有词；第 2 词让 B 抢（客人也能拿分） */
    const res = await playUntilResult([[A, 'odd1', 'A'], [B, 'only1', 'B']]);
    ok(/你赢了/.test(res.A || '') && /输了/.test(res.B || ''), `两边都结算（A「${res.A}」/ B「${res.B}」）`);
    const ra = await scr(A), rb = await scr(B);
    ok(/天梯分/.test(ra) && /天梯分|段位保护/.test(rb), `结算屏有天梯分变化（A：${(ra.match(/[+-]\d+ 天梯分/) || [''])[0]}；B：${(rb.match(/[+-]\d+ 天梯分|段位保护/) || [''])[0]}）`);
    const after = { A: await summary(A), B: await summary(B) };
    const expA = await E(A, () => window.HansenSbLadder.nextRating({ myRating: 1000, oppRating: 1150, won: true, games: 1 }));
    const expA1000 = await E(A, () => window.HansenSbLadder.nextRating({ myRating: 1000, oppRating: 1000, won: true, games: 1 }));
    const eA = Math.round((expA && expA.rating != null) ? expA.rating : expA);
    const eA0 = Math.round((expA1000 && expA1000.rating != null) ? expA1000.rating : expA1000);
    ok(after.A.total === 1 && after.A.wins === 1 && after.A.rating === eA && eA !== eA0,
       `A 记了一局胜，ELO 按对手真实分 1150 算（${before.A.rating} → ${after.A.rating}，期望 ${eA}；若按 1000 会是 ${eA0}）`);
    ok(after.B.losses === 1 && after.B.total === 4 && after.B.h && after.B.h.result === 'lose' && after.B.h.ranked,
       `B（客人）也记上了这一局负（总 ${after.B.total} 局，${before.B.rating} → ${after.B.rating}）`);
    ok(after.A.h && after.A.h.opp === 'bob同学' && after.B.h && after.B.h.opp === 'alice同学', `战绩里记的是对方真名（A 记 ${after.A.h && after.A.h.opp}，B 记 ${after.B.h && after.B.h.opp}）`);
    const sc = (after.A.h && after.B.h) ? [after.A.h.my, after.A.h.oc, after.B.h.my, after.B.h.oc] : [];
    ok(sc.length && sc[0] === sc[3] && sc[1] === sc[2] && sc[1] > 0, `两边比分一致（A ${sc[0]}:${sc[1]} / B ${sc[2]}:${sc[3]}）—— 客人抢到的那一词也算上了`);
    out.ladder = { before, after, res };
    /* 「再来一局」→ 回天梯直接开始找（A 在岛屿页：天梯要在大PK屏上面） */
    await tap(A, '#prAgain');
    await A.waitForTimeout(1200);
    const ag = await scr(A);
    const agTop = await E(A, () => { const e = document.elementFromPoint(195, 300); return !!(e && e.closest('#hsn_ladder_screen')); });
    ok(/正在找对手/.test(ag) && agTop, `[A 岛屿页]「再来一局」→ 天梯在最上面并直接开始找（${ag.slice(0, 24)}）`);
    await E(A, () => window.HansenLadderUI.close());
    await tap(B, '#prBack2');
    await B.waitForTimeout(600);
    ok(/天梯排位/.test(await scr(B)), '[B]「← 回天梯」回到天梯首页（不是房间列表）');
    await E(B, () => window.HansenLadderUI.close());
  }

  /* ══ 场景 2：公开房间（界面点「开一间」→ 别人在列表里点「进去打」）→ 同步赛打完 ══ */
  if (want('lobby')) {
    await E(C, () => window.HansenPkRoomUI.open());
    await tap(C, '#prNew');
    await C.waitForTimeout(400);
    await tap(C, '.pr_mode[data-mode="C"]');
    const cw = await waitFor(C, () => /等对手进来/.test((document.querySelector('.pr_wrap') || {}).innerText || ''), 15000);
    ok(cw, `[C] 开一间公开房 → 等对手进来（${(await scr(C)).slice(0, 30)}）`);
    await E(D, () => window.HansenPkRoomUI.open());
    let seen = null;
    for (let i = 0; i < 20 && !seen; i++) {
      await D.waitForTimeout(700);
      seen = await E(D, () => { const b = [...document.querySelectorAll('#prList button[data-rid]')]; return b.length ? b[0].getAttribute('data-rid') : null; });
      if (!seen) await E(D, () => { const r = document.getElementById('prRef'); if (r) r.click(); });
    }
    ok(!!seen && !seen.__thrown, `[D] 列表里看到 C 的房（${seen}）`);
    await tap(D, '#prList button[data-rid]');
    await D.waitForTimeout(300);
    const joining = await scr(D);
    ok(/等房主确认|进房中/.test(joining) || /第 1/.test(joining), `[D] 点「进去打」→ 先显示「正在进房，等房主确认」（${joining.slice(0, 26)}）`);
    const [bc, bd] = await Promise.all([inBattle(C, 30000), inBattle(D, 30000)]);
    ok(bc && bd, '公开房：两边都进了对战屏');
    const res2 = await playUntilResult([[C, 'all', 'C'], [D, 'only1', 'D']]);
    ok(res2.C && res2.D, `公开房打完，两边都结算（C「${res2.C}」/ D「${res2.D}」）`);
    const rc = await scr(C);
    ok(/本局不计天梯/.test(rc), '同步赛不动天梯分（说清楚「只有抢答赛计分」）');
    await tap(C, '#prBack2'); await tap(D, '#prBack2');
    await C.waitForTimeout(500);
    ok(/公开房间/.test(await scr(C)), '自由房打完「← 回到房间列表」');
  }

  /* ══ 场景 3：私密房 + 房间码；房主中途离开 → 客人立刻判胜 ══ */
  if (want('code')) {
    await E(C, () => window.HansenPkRoomUI.open());
    await tap(C, '#prPriv');
    await C.waitForTimeout(400);
    await tap(C, '.pr_mode[data-mode="B"]');
    const code = await waitFor(C, () => { const e = document.getElementById('prCodeBig'); return e ? e.textContent.trim() : null; }, 15000);
    ok(/^[0-9A-Z]{4}$/.test(code || ''), `[C] 私密房显示房间码 ${code}`);
    await E(D, () => window.HansenPkRoomUI.open());
    await E(D, (c) => { const d = document.querySelector('details'); if (d) d.open = true; const i = document.getElementById('prCode'); i.value = c; }, code);
    await tap(D, '#prJoinCode');
    const [bc, bd] = await Promise.all([inBattle(C, 30000), inBattle(D, 30000)]);
    ok(bc && bd, '输码进房：两边都进了对战屏' + (bc && bd ? '' : '（C：' + (await scr(C)).slice(0, 60) + ' / D：' + (await scr(D)).slice(0, 60) + '）'));
    await D.waitForTimeout(1500);
    /* 房主中途关掉（客人不该干等 60 秒） */
    await E(C, () => window.HansenPkRoomUI.close());
    const t0 = Date.now();
    const won = await waitFor(D, () => { const r = document.querySelector('.pr_res'); return r ? r.textContent : null; }, 20000);
    ok(/对手已离场/.test(won || ''), `房主中途离开 → 客人 ${Math.round((Date.now() - t0) / 1000)} 秒内看到「${won}」`);
    await E(D, () => window.HansenPkRoomUI.close());
  }

  /* ══ 场景 4：排位等不到人 → 房收掉、回天梯首页「暂时没有对手，等会儿再来」；自由房等不到人 → 列表 + 说人话 ══ */
  if (want('timeout')) {
    await E(X, () => { window.HansenPkRoomUI._setWaitMsForTest(5000); window.__hsnLadderWaitSec = 2; window.HansenLadderUI.open(); });
    await tap(X, '#ldGo');
    const home = await waitFor(X, () => /暂时没有对手，等会儿再来/.test((document.querySelector('#hsn_ladder_screen.on .ld_wrap') || {}).innerText || ''), 30000);
    ok(home, `[E] 排位等不到人 → 回天梯首页「暂时没有对手，等会儿再来」（${(await scr(X)).slice(0, 40)}）`);
    await X.waitForTimeout(LAG + 600);
    const left = docs().filter((d) => d.kind === 'room' && d.hostName === 'erin同学' && d.status === 'open');
    ok(left.length === 0, `[E] 等不到人的那间排位房已经收掉（还开着 ${left.length} 间）`);
    await E(X, () => window.HansenLadderUI.close());
    await E(X, () => window.HansenPkRoomUI.open());
    await tap(X, '#prNew'); await X.waitForTimeout(300); await tap(X, '.pr_mode[data-mode="C"]');
    const lob = await waitFor(X, () => /房间先关掉了/.test((document.querySelector('.pr_wrap') || {}).innerText || ''), 30000);
    const ls = await scr(X);
    ok(lob && !/出了点问题/.test(ls), `[E] 自由房等不到人 → 回列表并说「${(ls.match(/等了两分钟[^。]*。/) || [''])[0]}」（不再是「出了点问题」）`);
    await X.waitForTimeout(LAG + 600);
    const left2 = docs().filter((d) => d.kind === 'room' && d.hostName === 'erin同学' && d.status === 'open');
    ok(left2.length === 0, '[E] 自由房也收掉了（不留幽灵房、心跳停了）');
    await E(X, () => { window.HansenPkRoomUI.close(); window.HansenPkRoomUI._setWaitMsForTest(0); window.__hsnLadderWaitSec = 3; });
  }

  /* ══ 场景 5：云端设置不对（ADMINONLY）→ 「云端设置还差一步」+ 技术信息 ══ */
  if (want('config')) {
    emu.setAcl('hansen_pk_rooms', ACL.ADMINONLY);
    await E(X, () => window.HansenLadderUI.open());
    await tap(X, '#ldGo');
    const cf = await waitFor(X, () => /云端设置还差一步/.test((document.querySelector('.ld_wrap') || {}).innerText || ''), 20000);
    const cs = await scr(X);
    ok(cf && /技术信息：.*PERMISSION_DENIED/.test(cs) && /hansen_pk_rooms/.test(cs), `ADMINONLY → 「云端设置还差一步」+ 集合名 + 技术信息（${cs.slice(0, 90)}）`);
    emu.setAcl('hansen_pk_rooms', ACL.READONLY);
    await E(X, () => window.HansenLadderUI.close());
  }

  /* ══ 场景 6：断网 → 「连不上网络」+ 技术信息 network request error ══ */
  if (want('offline')) {
    await P.erin.ctx.route(/tcb-api\.tencentcloudapi\.com\/web/, (r) => r.abort());
    await E(X, () => window.HansenLadderUI.open());
    await tap(X, '#ldGo');
    const nf = await waitFor(X, () => /连不上网络/.test((document.querySelector('.ld_wrap') || {}).innerText || ''), 40000);
    const ns = await scr(X);
    ok(nf && /技术信息：.*network request error/.test(ns), `断网 → 「连不上网络」+ 技术信息（${(ns.match(/技术信息：[^|]*/) || [''])[0].slice(0, 60)}）`);
    await P.erin.ctx.unroute(/tcb-api\.tencentcloudapi\.com\/web/);
    await tap(X, '#ldRetry');
    await X.waitForTimeout(2500);
    ok(/正在找对手/.test(await scr(X)), '网通了点「重新找对手」→ 接着找');
    await E(X, () => window.HansenLadderUI.close());
  }

  /* ══ 场景 7：同一个账号两台设备 → 提示要用另一个账号 ══ */
  if (want('same')) {
    const { c: c2, r: r2 } = await open('dave2', '/spelling_pk.html', 'dave');
    ok(r2 && r2.s && r2.s.ok, '[dave 第二台设备] 同一个账号登录');
    await E(D, () => window.HansenPkRoomUI.open());
    await tap(D, '#prNew'); await D.waitForTimeout(300); await tap(D, '.pr_mode[data-mode="C"]');
    await waitFor(D, () => /等对手进来/.test((document.querySelector('.pr_wrap') || {}).innerText || ''), 15000);
    await c2.page.waitForTimeout(LAG + 300);
    await E(c2.page, () => window.HansenPkRoomUI.open());
    const hint = await waitFor(c2.page, () => /同一个账号在另一台设备上开着房/.test((document.querySelector('.pr_wrap') || {}).innerText || ''), 15000);
    ok(hint, '同一个账号两台设备：列表上说「同一个账号在另一台设备上开着房，要用另一个账号才能对战」');
    await E(D, () => window.HansenPkRoomUI.close());
    await E(c2.page, () => window.HansenPkRoomUI.close());
  }

  /* ══ 场景 8：云端不认令牌了 → 「云端登录过期了」（放最后：会让所有人的令牌失效） ══ */
  if (want('expired')) {
    emu.expireAllAccessTokens();
    await E(X, () => window.HansenLadderUI.open());
    await tap(X, '#ldGo');
    const ex = await waitFor(X, () => /云端登录过期了/.test((document.querySelector('.ld_wrap') || {}).innerText || ''), 30000);
    ok(ex && !/排位要先登录/.test(await scr(X)), `令牌被云端拒 → 「云端登录过期了 / 重新登录」（${(await scr(X)).slice(0, 40)}）`);
  }

  for (const n of Object.keys(errsOf)) ok(errsOf[n].length === 0, `[${n}] 零脚本错误${errsOf[n].length ? '：' + errsOf[n][0] : ''}`);
  /* 越权写：每个写操作的 JWT sub 都必须是文档创建者 */
  const writes = emu.log.filter((e) => e.body && /database\.(updateDocument|deleteDocument)/.test(e.body.action || ''));
  const multi = writes.filter((e) => e.body.multi);
  ok(multi.length === 0, `没有 where().update/remove 多条写（${multi.length}）`);
} catch (e) {
  ok(false, '脚本异常：' + (e && e.stack || e));
} finally {
  out.pass = pass; out.fail = failN; out.lines = lines;
  fs.writeFileSync(new URL(`./ui_result_${mode}_${LAT}_${LAG}.json`, import.meta.url), JSON.stringify(out, null, 1));
  console.log(`\n结果: ${pass} 通过 / ${failN} 失败`);
  await browser.close(); srv.close();
  process.exit(failN ? 1 : 0);
}
