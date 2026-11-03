// Review helpers: N phones (browser contexts) with the REAL page + REAL SDK, network answered by the
// repo's cloudbase_emulator.mjs. Drives HansenPkRoom (the data layer) directly, like the UI does.
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export { H };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function setup(knobs = {}, collections, createEmu) {
  const cc = H.cloudConfig();
  const emu = createEmu ? createEmu({ env: cc.env, region: cc.region, collections: collections || H.defaultCollections(), knobs })
                        : H.makeEmulator({ knobs, collections });
  const srv = await H.startStatic();
  const browser = await H.launchBrowser();
  const phones = [];
  let seq = 50 + Math.floor(Math.random() * 40);
  async function phone(name, opts = {}) {
    const p = opts.skewMs ? await openSkewed(browser, emu, srv.origin, name, opts.path || '/spelling_pk.html', opts.skewMs)
                          : await H.openPhone(browser, emu, srv.origin, { name, path: opts.path || '/spelling_pk.html' });
    const num = '139' + String(10000000 + (seq++)).padStart(8, '0');
    p.number = num;
    const r = await H.loginPhone(p, num);
    if (!r || !r.ok) throw new Error(`[${name}] login failed ${JSON.stringify(r)}`);
    await p.eval((nm) => {
      try { localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('hansen_sb_profile_v1002') || '{}'), { name: nm }))); } catch (e) {}
      window.__ev = [];
      window.__log = [];
      return true;
    }, name);
    p.key = 'u' + r.uid;
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

/* call a HansenPkRoom method in the page and return its (serialisable) result */
export function call(p, fn, ...args) {
  return p.eval(async ([fn, args]) => {
    try { return await window.HansenPkRoom[fn](...args); }
    catch (e) { return { __threw: String((e && e.message) || e) }; }
  }, [fn, args]);
}
/* start the host's waitForOpponent; events land in window.__ev */
export function startWait(p, rid, { ms = 120000, ladder = null } = {}) {
  return p.eval(([rid, ms, ladder]) => {
    window.__ev = [];
    window.__cancel = window.HansenPkRoom.waitForOpponent(rid, (e) => window.__ev.push(Object.assign({ at: Date.now() }, e)), ms,
      ladder ? { ladder: { rating: ladder.rating, band: () => ladder.band } } : undefined);
    return true;
  }, [rid, ms, ladder]);
}
export async function waitEv(p, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const e = await p.eval(() => (window.__ev || []).slice());
    if (Array.isArray(e) && e.length) return e[0];
    await sleep(200);
  }
  return null;
}
/* fire-and-forget call: result is stored in window.__pending[tag] */
export function launch(p, tag, fn, ...args) {
  return p.eval(([tag, fn, args]) => {
    window.__pending = window.__pending || {};
    window.__pending[tag] = { done: false };
    Promise.resolve().then(() => window.HansenPkRoom[fn](...args)).then(
      (r) => { window.__pending[tag] = { done: true, r, at: Date.now() }; },
      (e) => { window.__pending[tag] = { done: true, err: String((e && e.message) || e), at: Date.now() }; });
    return true;
  }, [tag, fn, args]);
}
export async function result(p, tag, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await p.eval((tag) => (window.__pending || {})[tag], tag);
    if (r && r.done) return r;
    await sleep(150);
  }
  return { done: false, timeout: true };
}
export const docs = (emu) => emu.dump('hansen_pk_rooms') || [];
export function show(emu, names = {}) { return H.describeRooms(emu, names); }
export function makeReport(title) {
  const lines = [];
  let pass = 0, fail = 0;
  console.log('\n=== ' + title + ' ===');
  return {
    log: (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); lines.push(s); console.log('  ' + s); },
    expect: (cond, msg) => { if (cond) { pass++; console.log('  [as-expected] ' + msg); } else { fail++; console.log('  [UNEXPECTED]  ' + msg); } lines.push((cond ? 'OK ' : 'XX ') + msg); },
    lines, get pass() { return pass; }, get fail() { return fail; },
  };
}

/* A phone whose wall clock is off by skewMs (Date / Date.now only; timers are real) — like a kid's tablet set wrong. */
async function openSkewed(browser, emu, origin, name, urlPath, skewMs) {
  const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: UA });
  await ctx.addInitScript((off) => {
    const RD = Date; const now0 = RD.now.bind(RD);
    function D(...a) { if (!(this instanceof D)) return new RD(now0() + off).toString(); return a.length ? new RD(...a) : new RD(now0() + off); }
    D.prototype = RD.prototype; D.now = () => now0() + off; D.parse = RD.parse; D.UTC = RD.UTC;
    Object.defineProperty(D, 'name', { value: 'Date' });
    window.Date = D; window.__skew = off;
  }, skewMs);
  const page = await ctx.newPage();
  const ph = new H.Phone(name, ctx, page, emu);
  if (emu) await emu.attach(ctx);
  await ctx.route((u) => { const h = new URL(u).hostname; return !/^(127\.0\.0\.1|localhost)$/.test(h) && !/(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/.test(h); }, (r) => { r.abort('blockedbyclient').catch(() => {}); });
  page.on('dialog', async (d) => { ph.dialogs.push({ t: Date.now(), type: d.type(), message: d.message() }); try { await d.accept(); } catch (e) {} });
  page.on('pageerror', (e) => ph.errors.push(String(e && e.message || e).slice(0, 200)));
  await page.goto(origin + urlPath, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
  await sleep(600);
  return ph;
}
