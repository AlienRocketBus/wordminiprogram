// Scenario: home → skip onboarding → tap island card → island opens in iframe#islandFrame.
// Measures: frame tree, scripts executed in both top + island frame, nested warm iframes, requests/bytes,
// /VERSION polling, timers per frame, prefetch-vs-navigation URL, then close + open a second island.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { startServer, hits } from './server.mjs';

const W = +(process.env.W || 390);
const ISL1 = process.env.ISL1 || 'island_food.html';
const ISL2 = process.env.ISL2 || 'island_animal.html';
const WAIT = +(process.env.WAIT || 25000);
const out = { W };
const { srv, port } = await startServer();
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'zh-CN',
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' });
const ext = [];
await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN) || /^(data|blob):/.test(u)) return r.continue(); ext.push(u); return r.abort(); });
await ctx.addInitScript(() => {
  window.__ph = { rej: [], timers: 0, intervals: 0 };
  addEventListener('unhandledrejection', e => { try { window.__ph.rej.push(String(e.reason && (e.reason.stack || e.reason)).slice(0, 300)); } catch (_) {} });
  const si = window.setInterval; window.setInterval = function () { window.__ph.intervals++; return si.apply(this, arguments); };
  window.__ph.ls = {};
  try { const ss = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { try { if (this === window.localStorage) { window.__ph.ls[k] = (window.__ph.ls[k] || 0) + 1; } } catch (_) {} return ss.apply(this, arguments); }; } catch (_) {}
});
const page = await ctx.newPage();
const log = { console: [], pageerrors: [], dialogs: [] };
page.on('console', m => { if (m.type() === 'error') log.console.push(m.text().slice(0, 300)); });
page.on('pageerror', e => log.pageerrors.push(phase + ' :: ' + String(e.stack || e).slice(0, 400)));
page.on('dialog', d => { log.dialogs.push(d.type() + ': ' + d.message().slice(0, 150)); d.dismiss().catch(() => {}); });
let phase = 'home'; const net = {};
page.on('requestfinished', async r => {
  try { const s = await r.sizes(); const resp = await r.response(); net[phase] = net[phase] || { n: 0, bytes: 0, n304: 0, docs: [] }; net[phase].n++; net[phase].bytes += s.responseBodySize; if (resp && resp.status() === 304) net[phase].n304++; let fu = '?'; try { fu = r.frame().url().replace(ORIGIN, '').split('?')[0] || 'about:blank'; } catch (e) {} const key = fu + ' ' + r.resourceType(); net[phase].byFrame = net[phase].byFrame || {}; const bf = net[phase].byFrame[key] = net[phase].byFrame[key] || [0, 0]; bf[0]++; bf[1] += s.responseBodySize; if (r.resourceType() === 'document') net[phase].docs.push(r.url().replace(ORIGIN, '') + ' ' + (resp && resp.status())); } catch (e) {}
});
async function realTap(locatorOrHandle, label) {
  const h = locatorOrHandle;
  await h.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(120);
  const box = await h.boundingBox();
  if (!box) return { ok: false, why: 'no box', label };
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await h.evaluate((el, [x, y]) => { const t = document.elementFromPoint(x, y); return { same: !!t && (t === el || el.contains(t)), hit: t ? (t.tagName + '#' + t.id + '.' + String(t.className).slice(0, 40)) : null }; }, [x - (await h.evaluate(() => 0)), y]);
  await page.touchscreen.tap(x, y);
  return { ok: hit.same, hit: hit.hit, label, x: Math.round(x), y: Math.round(y) };
}
const t0 = Date.now();
await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
out.homeLoadMs = Date.now() - t0;
// onboarding skip
const skip = page.locator('button:has-text("跳过"), a:has-text("跳过"), [role=button]:has-text("跳过")').first();
out.onboarding = (await skip.count()) ? await realTap(skip, 'skip') : 'no skip button';
await page.waitForTimeout(800);
out.homeOverflow = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth }));
// close any remaining overlays that block the card
out.homeHits = hits.map(h => h.join(' '));
const card = page.locator(`a.island[href="${ISL1}"]`).first();
out.tap1 = await realTap(card, ISL1);
phase = 'open1';
const tOpen = Date.now();
let revealMs = null;
for (let i = 0; i < 200; i++) {
  const st = await page.evaluate(f => { const w = document.getElementById('islandFrameWrap'), fr = document.getElementById('islandFrame'); let p = ''; try { p = fr.contentWindow.location.pathname.split('/').pop(); } catch (e) {} return { disp: w && w.style.display, op: fr && fr.style.opacity, p, rect: fr ? [fr.getBoundingClientRect().width, fr.getBoundingClientRect().height] : null }; }, ISL1);
  if (st.disp === 'block' && st.op === '1' && st.p === ISL1) { revealMs = Date.now() - tOpen; out.frameRect = st.rect; break; }
  await page.waitForTimeout(50);
}
out.revealMs = revealMs;
const islandHtmlHits = () => hits.filter(h => h[0].startsWith('/' + ISL1.replace('.html', ''))).map(h => h.join(' '));
await page.waitForTimeout(WAIT);
// welcome popup inside iframe
const fr1 = page.frames().find(f => f.url().replace(ORIGIN, '').split('?')[0] === '/' + ISL1);
if (fr1) {
  const start = fr1.locator('button:has-text("开始冒险")').first();
  out.welcome = (await start.count()) ? await start.isVisible() : 'none';
  out.welcomeText = await fr1.evaluate(() => { const d = document.getElementById('alertInner'); return d ? d.innerText.slice(0, 300) : null; }).catch(e => String(e));
  out.modeTiles = await fr1.evaluate(() => { const names = ['探索单词', '听音辨义', '记忆翻牌', '打字大师', '完形填空', '字母拼拼乐', 'Spelling Bee', '拼写大PK', '打地鼠', '钓鱼', '泡泡', '极速60秒', '火眼金睛', '抽卡']; const hs = document.getElementById('homeScreen') || document.body; const txt = hs.innerText; return names.map(n => [n, txt.toLowerCase().includes(n.toLowerCase())]); }).catch(e => String(e));
}
async function frameTree() {
  const rows = [];
  for (const f of page.frames()) {
    let depth = 0, p = f.parentFrame(); while (p) { depth++; p = p.parentFrame(); }
    let info = {};
    try { info = await f.evaluate(() => ({ scripts: [...document.scripts].map(s => (s.getAttribute('src') || '').split('?')[0]).filter(Boolean), intervals: window.__ph && window.__ph.intervals, ls: window.__ph && window.__ph.ls, rej: window.__ph && window.__ph.rej, vis: (() => { try { const fe = window.frameElement; if (!fe) return 'top'; const cs = getComputedStyle(fe); const r = fe.getBoundingClientRect(); let a = fe, disp = 'shown'; while (a) { if (getComputedStyle(a).display === 'none') { disp = 'display:none'; break; } a = a.parentElement; } return disp + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); } catch (e) { return '?'; } })() })); } catch (e) { info = { err: String(e).slice(0, 80) }; }
    rows.push({ depth, url: f.url().replace(ORIGIN, ''), ...info });
  }
  return rows;
}
out.tree1 = await frameTree();
const top = out.tree1.find(r => r.depth === 0), isl = out.tree1.find(r => r.depth === 1 && r.url.split('?')[0] === '/' + ISL1);
if (top && isl) {
  const both = top.scripts.filter(s => isl.scripts.includes(s));
  const sz = s => { try { return fs.statSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/' + s).size; } catch (e) { return 0; } };
  out.scriptsInBoth = { count: both.length, bytes: both.reduce((a, s) => a + sz(s), 0), list: both };
  out.allScriptExecs = out.tree1.reduce((a, r) => a + (r.scripts ? r.scripts.length : 0), 0);
  const cnt = {}; out.tree1.forEach(r => (r.scripts || []).forEach(s => cnt[s] = (cnt[s] || 0) + 1));
  out.scriptMultiExec = Object.entries(cnt).filter(([k, v]) => v > 2).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' x' + v + ' (' + Math.round(sz(k) / 1024) + 'KB)').slice(0, 40);
}
out.islandHtmlHits = islandHtmlHits();
out.open1Hits = hits.slice(out.homeHits.length).map(h => h.join(' '));
const cdp = await ctx.newCDPSession(page);
out.dom1 = await cdp.send('Memory.getDOMCounters');
out.heap1MB = +((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6).toFixed(1);
// VERSION polling over 30s while island open
const v0 = hits.filter(h => h[0] === '/VERSION').length;
await page.waitForTimeout(30000);
out.versionPollsPer30s = hits.filter(h => h[0] === '/VERSION').length - v0;
// close island via history.back (what the in-island home button does)
phase = 'close';
await page.evaluate(() => window.closeIsland && window.closeIsland());
await page.waitForTimeout(1500);
out.afterClose = await page.evaluate(() => ({ wrap: document.getElementById('islandFrameWrap').style.display, bodyOverflow: document.body.style.overflow }));
out.framesAfterClose = page.frames().length;
// open second island
phase = 'open2';
const card2 = page.locator(`a.island[href="${ISL2}"]`).first();
out.tap2 = await realTap(card2, ISL2);
await page.waitForTimeout(WAIT);
out.tree2 = (await frameTree()).map(r => ({ depth: r.depth, url: r.url, nScripts: r.scripts ? r.scripts.length : 0, vis: r.vis, intervals: r.intervals }));
out.dom2 = await cdp.send('Memory.getDOMCounters');
out.heap2MB = +((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6).toFixed(1);
out.net = net; out.ext = ext; out.log = log;
out.lsAfter = await page.evaluate(() => { let n = 0, big = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k) || ''; n += (k.length + v.length) * 2; big.push([k, v.length]); } big.sort((a, b) => b[1] - a[1]); return { keys: localStorage.length, bytesUtf16: n, biggest: big.slice(0, 10) }; });
out.tree1 = out.tree1.map(r => ({ depth: r.depth, url: r.url, nScripts: r.scripts ? r.scripts.length : 0, vis: r.vis, intervals: r.intervals, rej: r.rej, lsKeysWritten: r.ls ? Object.keys(r.ls).length : 0, lsWrites: r.ls ? Object.values(r.ls).reduce((a, b) => a + b, 0) : 0, lsTop: r.ls ? Object.entries(r.ls).sort((a, b) => b[1] - a[1]).slice(0, 25) : [] }));
await page.screenshot({ path: `shots/scenario_${W}_island2.png` });
fs.writeFileSync(`scenario_${W}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
await browser.close(); srv.close();
