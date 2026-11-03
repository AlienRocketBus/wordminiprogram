// Skeptic helpers (independent of the reviewer's lib.mjs). Real pages + real vendored SDK;
// only Tencent's network is answered by the repo's cloudbase_emulator.mjs. Taps are touch taps
// after an elementFromPoint check. App test hooks are only READ (never used to drive a flow),
// except where an experiment says so explicitly.
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export { H };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* timer + listener census, installed before page scripts */
export const CENSUS = () => {
  const W = window;
  if (W.__sk) return;
  const c = W.__sk = { iv: new Map(), ls: new Map(), ivMade: 0 };
  const si = W.setInterval, ci = W.clearInterval;
  const where = () => { try { return (new Error().stack || '').split('\n').slice(2, 4).map((s) => s.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?v=\d+/g, '')).join(' < '); } catch (e) { return ''; } };
  W.setInterval = function (fn, ms) { const id = si.apply(this, arguments); c.iv.set(id, { ms, where: where() }); c.ivMade++; return id; };
  W.clearInterval = function (id) { c.iv.delete(id); return ci.apply(this, arguments); };
  for (const [T, name] of [[W, 'win'], [W.document, 'doc']]) {
    const a = T.addEventListener, r = T.removeEventListener;
    T.addEventListener = function (type, fn) { const k = name + ':' + type; const s = c.ls.get(k) || new Set(); s.add(fn); c.ls.set(k, s); return a.apply(this, arguments); };
    T.removeEventListener = function (type, fn) { const s = c.ls.get(name + ':' + type); if (s) s.delete(fn); return r.apply(this, arguments); };
  }
};
export async function census(target) {
  const f = target.page ? target.page : target;
  return f.evaluate(() => {
    const c = window.__sk; if (!c) return null;
    const ls = {}; for (const [k, s] of c.ls) if (s.size) ls[k] = s.size;
    return { intervals: c.iv.size, iv: [...c.iv.values()].map((v) => v.ms + '@' + v.where), ls, ivMade: c.ivMade };
  }).catch((e) => ({ err: String(e.message || e).slice(0, 100) }));
}

/* emulate the page (or one frame) going to the background / coming back */
export async function setHidden(frameOrPage, hidden) {
  return frameOrPage.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    return document.visibilityState;
  }, hidden);
}

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
export async function env(knobs = {}) {
  const emu = H.makeEmulator({ knobs });
  const srv = await H.startStatic();
  const browser = await H.launchBrowser();
  const phones = [];
  let seq = 100 + Math.floor(Math.random() * 800);
  async function phone(name, o = {}) {
    const ctx = await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: UA });
    if (o.census) await ctx.addInitScript(CENSUS);
    if (o.init) await ctx.addInitScript(o.init);
    const page = await ctx.newPage();
    const p = new H.Phone(name, ctx, page, emu);
    await emu.attach(ctx);
    await ctx.route((u) => { const h = new URL(u).hostname; return !/^(127\.0\.0\.1|localhost)$/.test(h) && !/(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/.test(h); }, (r) => { try { p.leaks.push(r.request().url()); r.abort('blockedbyclient').catch(() => {}); } catch (e) {} });
    page.on('pageerror', (e) => p.errors.push(String(e && e.message || e).slice(0, 200)));
    page.on('dialog', async (d) => { p.dialogs.push({ t: Date.now(), type: d.type(), message: d.message() }); try { await d.accept(o.promptAnswer); } catch (e) {} });
    await page.goto(srv.origin + (o.path || '/spelling_pk.html'), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(o.ready || (() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL)), null, { timeout: 45000 });
    await sleep(600);
    if (o.login !== false) {
      const num = '139' + String(10000000 + (seq++)).padStart(8, '0');
      const r = await H.loginPhone(p, num);
      if (!r || !r.ok) throw new Error(`[${name}] login failed ${JSON.stringify(r)}`);
      p.number = num;
    }
    if (o.nick) await p.eval((nm) => { try { return window.HansenSbProfile.setName(nm); } catch (e) { return String(e); } }, o.nick);
    p.nick = o.nick || name;
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

/* ── frames (the island runs inside index.html's #islandFrame) ── */
export function islandFrame(page) { return page.frames().find((f) => /\/island_[a-z0-9]+\.html/.test(f.url())) || null; }
export async function ftap(page, frame, sel, { timeout = 10000, text } = {}) {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < timeout) {
    const r = await frame.evaluate(([sel, text]) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; })
        .filter((e) => !text || (e.innerText || '').includes(text));
      const el = els[0];
      if (!el) return { ok: false, why: 'not visible' };
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      const b = el.getBoundingClientRect();
      const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
      const hit = document.elementFromPoint(x, y);
      const d = (e) => { const c = []; while (e && c.length < 4) { c.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')); e = e.parentElement; } return c.join('<'); };
      return { ok: !!hit && (hit === el || el.contains(hit)), x, y, hit: hit ? d(hit) : '(none)' };
    }, [sel, text || '']).catch((e) => ({ ok: false, why: String(e.message || e).slice(0, 100) }));
    if (r.ok) {
      const box = await (await frame.frameElement()).boundingBox();
      await page.touchscreen.tap(Math.round(box.x + r.x), Math.round(box.y + r.y));
      return r;
    }
    last = r.why || ('covered by ' + r.hit);
    await sleep(200);
  }
  throw new Error(`ftap ${sel}: ${last}`);
}
export async function fscreen(frame) {
  return frame.evaluate(() => {
    const pts = [[innerWidth / 2, innerHeight / 2], [innerWidth / 2, 90], [innerWidth / 2, innerHeight - 90]];
    const seen = new Set(), out = [];
    for (const [x, y] of pts) {
      let e = document.elementFromPoint(x, y), layer = null;
      while (e && e !== document.body && e !== document.documentElement) { if (getComputedStyle(e).position === 'fixed') layer = e; e = e.parentElement; }
      layer = layer || document.body;
      if (!seen.has(layer)) { seen.add(layer); out.push(layer.innerText || ''); }
    }
    return out.join('\n');
  }).catch((e) => '(frame err ' + String(e.message || e).slice(0, 60) + ')');
}
export async function fwait(frame, re, timeout = 15000) {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < timeout) { last = await fscreen(frame); if (re.test(last)) return last; await sleep(200); }
  const e = new Error(`fwait ${re} (${timeout} ms) last: ${last.replace(/\s+/g, ' ').slice(0, 240)}`); e.last = last; throw e;
}
export const flat = (s, n = 260) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/* battle helpers that work on a Page or a Frame */
export async function rtOf(f) { return f.evaluate(() => { const r = window.HansenPkRoomUI && HansenPkRoomUI._rtForTest(); return r ? { idx: r.idx, answered: r.answered, deadline: r.deadline, t0: r.t0, now: Date.now() } : null; }).catch(() => null); }
export async function stOf(f) { return f.evaluate(() => { const s = window.HansenPkRoomUI && HansenPkRoomUI._stateForTest(); return s ? { roomId: s.roomId, isHost: s.isHost, mode: s.mode, myScore: s.myScore, oppScore: s.oppScore, started: !!s.startAt, ladder: !!s.ladder, opp: s.oppName, oppRating: s._oppRating } : null; }).catch(() => null); }
export async function hintOf(f) { return f.evaluate(() => ((document.getElementById('prHint') || {}).innerText || '').trim()).catch(() => ''); }
export async function wordsOf(f, room) { return f.evaluate(([s, n]) => window.HansenPkRoom.wordsFromSeed(s, n), [room.seed, room.wordCount || 10]); }
export function roomDocs(emu) { return emu.dump('hansen_pk_rooms') || []; }
export function myOpenRoom(emu, uid) { return roomDocs(emu).find((d) => d.kind === 'room' && d._openid === uid && d.status === 'open'); }
export function report(title) {
  const st = { lines: [] };
  console.log('\n=== ' + title + ' ===');
  return { st, log: (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); st.lines.push(s); console.log('  ' + s); } };
}
