// Skeptic's own helpers (independent of the reviewer's lib.mjs).
// Real page + real SDK in Chromium contexts; only Tencent's network is answered by the repo's emulator.
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export { H };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const TENCENT = /(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/;

export async function env(knobs = {}, { emuFactory } = {}) {
  const emu = emuFactory ? emuFactory(knobs) : H.makeEmulator({ knobs });
  const srv = await H.startStatic();
  const browser = await H.launchBrowser();
  const phones = [];
  let n = 0;
  const base = 13800000000 + Math.floor(Math.random() * 1e6) * 10;
  async function phone(name, { skewMs = 0, path = '/spelling_pk.html' } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: UA });
    if (skewMs) {
      // wall clock off by skewMs; timers run at real speed (like a phone whose clock is set wrong)
      await ctx.addInitScript((off) => {
        const RD = Date; const rnow = RD.now.bind(RD);
        function D(...a) { if (!new.target) return new RD(rnow() + off).toString(); return a.length ? new RD(...a) : new RD(rnow() + off); }
        Object.setPrototypeOf(D, RD); D.prototype = RD.prototype; D.now = () => rnow() + off; D.parse = RD.parse; D.UTC = RD.UTC;
        window.Date = D; window.__skewMs = off;
      }, skewMs);
    }
    const page = await ctx.newPage();
    const ph = new H.Phone(name, ctx, page, emu);
    await emu.attach(ctx);
    await ctx.route((u) => { const h = new URL(u).hostname; return !/^(127\.0\.0\.1|localhost)$/.test(h) && !TENCENT.test(h); }, (r) => r.abort('blockedbyclient').catch(() => {}));
    page.on('dialog', async (d) => { ph.dialogs.push(d.message()); try { await d.accept(); } catch (e) {} });
    page.on('pageerror', (e) => ph.errors.push(String(e && e.message || e).slice(0, 200)));
    await page.goto(srv.origin + path, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
    await sleep(500);
    const num = String(base + (n++));
    const r = await H.loginPhone(ph, num);
    if (!r || !r.ok) throw new Error(`[${name}] login failed ${JSON.stringify(r)}`);
    ph.key = 'u' + r.uid;
    await ph.eval((nm) => {
      try { const k = 'hansen_sb_profile_v1002'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.name = nm; localStorage.setItem(k, JSON.stringify(o)); } catch (e) {}
      window.__ev = []; return true;
    }, name);
    phones.push(ph);
    return ph;
  }
  async function done() { for (const p of phones) { try { await p.ctx.close(); } catch (e) {} } try { await browser.close(); } catch (e) {} try { srv.close(); } catch (e) {} }
  return { emu, srv, browser, phone, phones, done };
}
export function call(p, fn, ...args) {
  return p.eval(async ([fn, args]) => { try { return await window.HansenPkRoom[fn](...args); } catch (e) { return { __threw: String((e && e.message) || e) }; } }, [fn, args]);
}
export function bg(p, tag, fn, ...args) {   // fire and forget; result in window.__bg[tag]
  return p.eval(([tag, fn, args]) => {
    window.__bg = window.__bg || {}; window.__bg[tag] = { done: false, t0: Date.now() };
    Promise.resolve().then(() => window.HansenPkRoom[fn](...args)).then((r) => { window.__bg[tag] = { done: true, r, at: Date.now() }; }, (e) => { window.__bg[tag] = { done: true, err: String(e && e.message || e), at: Date.now() }; });
    return true;
  }, [tag, fn, args]);
}
export async function bgResult(p, tag, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = await p.eval((t) => (window.__bg || {})[t], tag); if (r && r.done) return r; await sleep(120); }
  return { done: false };
}
export function wait(p, rid, ms = 120000, ladder = null) {
  return p.eval(([rid, ms, ladder]) => {
    window.__ev = [];
    window.__cancel = window.HansenPkRoom.waitForOpponent(rid, (e) => window.__ev.push(Object.assign({ at: Date.now() }, e)), ms,
      ladder ? { ladder: { rating: ladder.rating, band: () => ladder.band } } : undefined);
    return true;
  }, [rid, ms, ladder]);
}
export async function ev(p, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const e = await p.eval(() => (window.__ev || []).slice()); if (Array.isArray(e) && e.length) return e[0]; await sleep(150); }
  return null;
}
export const docs = (emu) => emu.dump('hansen_pk_rooms') || [];
export const doc = (emu, id) => docs(emu).find((d) => d._id === id) || null;
export function out(...a) { console.log(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }
