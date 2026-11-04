// UI-flow review helpers: phones = browser contexts running the REAL pages + REAL vendored SDK;
// only Tencent's network is answered by the repo's cloudbase_emulator.mjs. Taps go through the
// harness's touch tap (elementFromPoint check first). No app test hooks are used to drive flows;
// _rtForTest/_stateForTest are only READ for observation.
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export { H };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* timer / listener census, installed before any page script runs */
export const CENSUS = () => {
  const W = window;
  if (W.__census) return;
  const c = W.__census = { iv: new Map(), to: new Map(), ls: new Map(), ivMade: 0, toMade: 0 };
  const si = W.setInterval, ci = W.clearInterval, st = W.setTimeout, ct = W.clearTimeout;
  const where = () => { try { return (new Error().stack || '').split('\n').slice(2, 5).map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?v=\d+/, '')).join(' < '); } catch (e) { return ''; } };
  W.setInterval = function (fn, ms) { const id = si.apply(this, arguments); c.iv.set(id, { ms, where: where(), at: Date.now() }); c.ivMade++; return id; };
  W.clearInterval = function (id) { c.iv.delete(id); return ci.apply(this, arguments); };
  W.setTimeout = function (fn, ms) { c.toMade++; const id = st.apply(this, arguments); return id; };
  const wrapTarget = (T, name) => {
    const a = T.addEventListener, r = T.removeEventListener;
    T.addEventListener = function (type, fn, opt) {
      const k = name + ':' + type; const s = c.ls.get(k) || new Set(); s.add(fn); c.ls.set(k, s);
      return a.apply(this, arguments);
    };
    T.removeEventListener = function (type, fn, opt) {
      const k = name + ':' + type; const s = c.ls.get(k); if (s) s.delete(fn);
      return r.apply(this, arguments);
    };
  };
  try { wrapTarget(W, 'window'); } catch (e) {}
  try { wrapTarget(W.document, 'document'); } catch (e) {}
};
export function census(p) {
  return p.eval(() => {
    const c = window.__census; if (!c) return null;
    const iv = [...c.iv.values()].map((v) => `${v.ms}ms@${v.where}`);
    const ls = {}; for (const [k, s] of c.ls) if (s.size) ls[k] = s.size;
    return { intervals: iv.length, iv, listeners: ls, ivMade: c.ivMade, toMade: c.toMade };
  });
}

export async function setup(knobs = {}, collections) {
  const emu = H.makeEmulator({ knobs, collections });
  const srv = await H.startStatic();
  const browser = await H.launchBrowser();
  const phones = [];
  let seq = 10 + Math.floor(Math.random() * 80);
  async function phone(name, opts = {}) {
    let p;
    if (opts.census) {
      /* same as H.openPhone but with the census init script installed first */
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' });
      await ctx.addInitScript(CENSUS);
      const page = await ctx.newPage();
      p = new H.Phone(name, ctx, page, emu);
      await emu.attach(ctx);
      await ctx.route((u) => { const h = new URL(u).hostname; return !/^(127\.0\.0\.1|localhost)$/.test(h) && !/(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/.test(h); }, (r) => { try { p.leaks.push(r.request().url()); r.abort('blockedbyclient').catch(() => {}); } catch (e) {} });
      page.on('pageerror', (e) => p.errors.push(String(e && e.message || e).slice(0, 200)));
      page.on('dialog', async (d) => { p.dialogs.push({ t: Date.now(), type: d.type(), message: d.message() }); try { await d.accept(); } catch (e) {} });
      await page.goto(srv.origin + (opts.path || '/spelling_pk.html'), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(opts.ready || (() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL)), null, { timeout: 45000 });
      await sleep(600);
    } else {
      p = await H.openPhone(browser, emu, srv.origin, { name, path: opts.path || '/spelling_pk.html', ready: opts.ready });
    }
    p.nick = opts.nick || name;
    if (opts.login !== false) {
      const num = '137' + String(10000000 + (seq++)).padStart(8, '0');
      p.number = num;
      const r = await H.loginPhone(p, num);
      if (!r || !r.ok) throw new Error(`[${name}] login failed ${JSON.stringify(r)}`);
      p.key = 'u' + r.uid;
    }
    if (opts.setName !== false) {
      await p.eval((nm) => {
        try { const P = window.HansenSbProfile; if (P && P.setName) P.setName(nm); } catch (e) {}
        return true;
      }, p.nick);
    }
    phones.push(p);
    return p;
  }
  async function done() {
    for (const p of phones) { try { await p.close(); } catch (e) {} }
    try { await browser.close(); } catch (e) {}
    try { srv.close(); } catch (e) {}
  }
  return { emu, srv, browser, phone, phones, done };
}

export const docs = (emu) => H.roomDocs(emu);
export async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开一间/, { timeout: 8000 });
}
export async function openRoom(emu, p, mode) {
  await p.tap('#prNew');
  await p.tap(`.pr_mode[data-mode="${mode}"]`);
  await p.waitScreen(/等对手进来/, { timeout: 15000 }).catch(() => '');
  return H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === p.cloudUid && d.status === 'open');
}
export async function joinRoomUI(g, rid) {
  await toLobby(g);
  const btn = await H.until(async () => {
    const h = await g.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 });
    if (h.ok) return h;
    await g.tap('#prRef').catch(() => {});
    return null;
  }, { timeout: 20000, interval: 900 });
  if (!btn) return false;
  await g.tap(`button[data-rid="${rid}"]`);
  return true;
}
export const rt = (p) => p.eval(() => { const r = window.HansenPkRoomUI._rtForTest(); return r ? { idx: r.idx, answered: r.answered, deadline: r.deadline, t0: r.t0 } : null; });
export const hint = (p) => p.eval(() => ((document.getElementById('prHint') || {}).innerText || '').trim());
export const scr = async (p) => (await p.screen()).replace(/\s+/g, ' ').slice(0, 300);

export function report(title) {
  const st = { pass: 0, fail: 0, lines: [] };
  console.log('\n' + title + '\n');
  return {
    st,
    log: (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); st.lines.push(s); console.log('  ' + s); },
    expect: (cond, msg) => { if (cond) { st.pass++; console.log('  OK  ' + msg); } else { st.fail++; console.log('  XX  ' + msg); } return cond; },
  };
}
