// Shared helpers for the skeptic re-runs. No request interception (keeps HTTP cache realistic);
// external hosts are made unresolvable at the browser level instead.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

export const WECHAT_UA = 'Mozilla/5.0 (Linux; Android 13; V2154A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160065 MMWEBSDK/20231202 MMWEBID/2585 MicroMessenger/8.0.47.2560(0x28002F30) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64';

export async function launch() {
  return chromium.launch({
    args: ['--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
      '--autoplay-policy=no-user-gesture-required'],
  });
}

export async function newCtx(browser, W, H = 844, ua = WECHAT_UA) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'zh-CN', userAgent: ua,
  });
  await ctx.addInitScript(() => {
    const W = window;
    W.__sk = { set: {}, setN: 0, plays: [], speaks: [], dlg: [], rej: [], err: [], ivl: 0, t0: Date.now() };
    try {
      const o = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        try { if (this === W.localStorage) { W.__sk.set[k] = (W.__sk.set[k] || 0) + 1; W.__sk.setN++; } } catch (e) {}
        return o.apply(this, arguments);
      };
    } catch (e) {}
    try {
      const op = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        try { W.__sk.plays.push({ src: String(this.currentSrc || this.src || '').split('/').slice(-2).join('/'), t: Date.now() - W.__sk.t0, muted: this.muted, vol: this.volume }); } catch (e) {}
        return op.apply(this, arguments);
      };
    } catch (e) {}
    try {
      if (W.speechSynthesis) {
        const os = W.speechSynthesis.speak.bind(W.speechSynthesis);
        W.speechSynthesis.speak = function (u) { try { W.__sk.speaks.push({ text: u && u.text, t: Date.now() - W.__sk.t0 }); } catch (e) {} return os(u); };
      }
    } catch (e) {}
    ['alert', 'confirm', 'prompt'].forEach(n => {
      try { const o = W[n]; W[n] = function (m) { try { W.__sk.dlg.push({ n, m: String(m).slice(0, 160) }); } catch (e) {} return o.apply(W, arguments); }; } catch (e) {}
    });
    try { const si = W.setInterval; W.setInterval = function () { W.__sk.ivl++; return si.apply(this, arguments); }; } catch (e) {}
    W.addEventListener('unhandledrejection', e => { try { const r = e.reason; W.__sk.rej.push(String(r && r.name ? r.name + ': ' + r.message : r).slice(0, 220)); } catch (_) {} });
    W.addEventListener('error', e => { try { W.__sk.err.push(String(e.message).slice(0, 220)); } catch (_) {} });
  });
  return ctx;
}

// Real touch tap with an elementFromPoint check (in the frame that owns the element).
export async function realTap(page, handle, label) {
  await handle.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(150);
  const box = await handle.boundingBox();
  if (!box) return { ok: false, why: 'no box', label };
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // elementFromPoint in top document coordinates
  const hit = await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return t ? (t.tagName + '#' + t.id + '.' + String(t.className).slice(0, 50)) : null; }, [x, y]);
  const own = await handle.evaluate((el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && (t === el || el.contains(t)); });
  await page.touchscreen.tap(x, y);
  return { ok: own, hitTop: hit, label, x: Math.round(x), y: Math.round(y) };
}

export async function frameTree(page, origin) {
  const rows = [];
  for (const f of page.frames()) {
    let depth = 0, p = f.parentFrame(); while (p) { depth++; p = p.parentFrame(); }
    let info = {};
    try {
      info = await f.evaluate(() => {
        const o = { vis: document.visibilityState, rs: document.readyState, nScripts: document.scripts.length };
        let hidden = false;
        try {
          let w = window;
          while (w !== w.top) {
            const fe = w.frameElement; if (!fe) break;
            let el = fe;
            while (el && el.nodeType === 1) { const c = el.ownerDocument.defaultView.getComputedStyle(el); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) { hidden = true; break; } el = el.parentElement; }
            const r = fe.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) hidden = true;
            w = w.parent;
          }
        } catch (e) { o.hidErr = String(e).slice(0, 60); }
        o.hidden = hidden;
        const s = window.__sk;
        if (s) { o.setN = s.setN; o.setKeys = Object.keys(s.set).length; o.top = Object.entries(s.set).sort((a, b) => b[1] - a[1]).slice(0, 12); o.plays = s.plays; o.speaks = s.speaks; o.dlg = s.dlg; o.rej = s.rej; o.err = s.err.slice(0, 6); o.ivl = s.ivl; }
        return o;
      });
    } catch (e) { info = { evalErr: String(e).slice(0, 80) }; }
    rows.push({ depth, url: f.url().replace(origin, ''), ...info });
  }
  return rows;
}

export function summarizeLog(entries, origin) {
  const by = { n: 0, bytes: 0, n200: 0, n304: 0, n206: 0, n404: 0, byExt: {}, byRef: {} };
  for (const e of entries) {
    by.n++; by.bytes += e.bytes || 0;
    if (e.st === 200) by.n200++; else if (e.st === 304) by.n304++; else if (e.st === 206) by.n206++; else if (e.st === 404) by.n404++;
    const ext = (e.p.match(/\.([a-z0-9]+)$/i) || [, 'other'])[1].toLowerCase();
    const b = by.byExt[ext] = by.byExt[ext] || [0, 0]; b[0]++; b[1] += e.bytes || 0;
    let ref = e.ref || '(none)';
    try { if (ref.startsWith(origin)) ref = ref.slice(origin.length); } catch (_) {}
    const r = by.byRef[ref] = by.byRef[ref] || [0, 0]; r[0]++; r[1] += e.bytes || 0;
  }
  by.MB = +(by.bytes / 1e6).toFixed(2);
  for (const k of Object.keys(by.byExt)) by.byExt[k][1] = +(by.byExt[k][1] / 1e6).toFixed(2);
  for (const k of Object.keys(by.byRef)) by.byRef[k][1] = +(by.byRef[k][1] / 1e6).toFixed(2);
  return by;
}
