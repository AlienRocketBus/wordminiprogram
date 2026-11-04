// S1: new user, home -> skip onboarding -> real tap on an island card -> wait -> frame tree,
// server-side bytes (HTTP cache ENABLED: no request interception), localStorage side effects, 我的学习 rows.
// MODE=asis | nowarm (room warm disabled, baseline) | fixwarm (skip warm when parent already has HansenRoom)
import fs from 'node:fs';
import { startServer, log } from './srv.mjs';
import { launch, newCtx, realTap, frameTree, summarizeLog } from './lib.mjs';

const W = +(process.env.W || 390);
const MODE = process.env.MODE || 'asis';
const WAIT = +(process.env.WAIT || 25000);
const ISL = process.env.ISL || 'island_food.html';
const CACHE = process.env.CACHE || 'no-cache';
const OUT = process.env.OUT || `s1_${MODE}_${W}${process.env.NOCONN ? '_noconn' : ''}${process.env.ROUTE ? '_route' : ''}.json`;
const A = "if (document.readyState === 'complete') scheduleWarm();\n  else window.addEventListener('load', scheduleWarm);";
const patch = {};
if (MODE === 'nowarm') patch['/hansen_room_warm_v1023.js'] = s => { if (!s.includes(A)) throw new Error('patch anchor missing'); return s.replace(A, '/* skeptic: warm disabled */'); };
if (MODE === 'fixwarm') patch['/hansen_room_warm_v1023.js'] = s => { if (!s.includes(A)) throw new Error('patch anchor missing'); return s.replace(A, "var __nested=false; try{ __nested=(window.self!==window.top && !!(window.parent && window.parent.HansenRoom)); }catch(e){}\n  if(!__nested){ if (document.readyState === 'complete') scheduleWarm(); else window.addEventListener('load', scheduleWarm); }"); };

const out = { W, MODE, WAIT, ISL, CACHE };
const { srv, port } = await startServer({ patch, cache: CACHE });
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const ctx = await newCtx(browser, W);
if (process.env.NOCONN) await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => undefined, configurable: true }); } catch (e) {} });
if (process.env.ROUTE) await ctx.route('**/*', r => { const u = r.request().url(); if (u.startsWith(ORIGIN) || /^(data|blob):/.test(u)) return r.continue(); return r.abort(); });
const page = await ctx.newPage();
const ev = { pageerror: [], consoleErr: [], dialogs: [], external: [], failed: [] };
page.on('pageerror', e => ev.pageerror.push(String(e.message || e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') ev.consoleErr.push(m.text().slice(0, 200)); });
page.on('dialog', d => { ev.dialogs.push(d.type() + ': ' + d.message().slice(0, 150)); d.dismiss().catch(() => {}); });
page.on('request', r => { const u = r.url(); if (!u.startsWith(ORIGIN) && !/^(data|blob|about):/.test(u)) ev.external.push(u.slice(0, 120)); });
page.on('requestfailed', r => { const u = r.url(); if (u.startsWith(ORIGIN)) ev.failed.push(u.replace(ORIGIN, '') + ' ' + (r.failure() && r.failure().errorText)); });

const t0 = Date.now();
await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load', timeout: 90000 });
out.homeLoadMs = Date.now() - t0;
await page.waitForTimeout(3000);
const skip = page.locator('#__hsOnbSkip');
out.skip = (await skip.count()) ? await realTap(page, skip.first(), 'skip') : 'none';
await page.waitForTimeout(1500);
const homeIdx = log.length;
out.home = summarizeLog(log.slice(0, homeIdx), ORIGIN);
out.homeIslandHtml = log.slice(0, homeIdx).filter(e => /^\/(island_|land_map)/.test(e.p)).map(e => e.p + e.q + ' ' + e.st + ' ' + e.dest);

const card = page.locator(`a.island[href="${ISL}"]`).first();
out.tap = await realTap(page, card, ISL);
const tTap = Date.now();
let reveal = null;
for (let i = 0; i < 120; i++) {
  const st = await page.evaluate(f => { const w = document.getElementById('islandFrameWrap'), fr = document.getElementById('islandFrame'); let p = ''; try { p = fr.contentWindow.location.pathname.split('/').pop(); } catch (e) {} return w && w.style.display === 'block' && fr.style.opacity === '1' && p === f; }, ISL);
  if (st) { reveal = Date.now() - tTap; break; }
  await page.waitForTimeout(100);
}
out.revealMs = reveal;
await page.waitForTimeout(WAIT);
out.tree = await frameTree(page, ORIGIN);
const openLog = log.slice(homeIdx);
out.open = summarizeLog(openLog, ORIGIN);
out.docs = openLog.filter(e => e.dest === 'iframe' || e.dest === 'document' || /\.html$/.test(e.p)).map(e => `+${e.t - tTap}ms ${e.p}${e.q} ${e.st} ${e.bytes}B dest=${e.dest} ref=${(e.ref || '').replace(ORIGIN, '')}`);
// unique-resource accounting: how many bytes of distinct files were downloaded during the open phase
const uniq = new Map(); for (const e of openLog) { if (e.st === 200 || e.st === 206) { const k = e.p; uniq.set(k, Math.max(uniq.get(k) || 0, e.bytes)); } }
out.uniqueFiles = uniq.size; out.uniqueMB = +([...uniq.values()].reduce((a, b) => a + b, 0) / 1e6).toFixed(2);
const dup200 = {}; for (const e of openLog) if (e.st === 200) dup200[e.p] = (dup200[e.p] || 0) + 1;
out.dup200 = Object.entries(dup200).filter(([k, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, 15);
// season-related bytes: files requested with a referer that is island_season or land_map document
out.mp3 = { n: openLog.filter(e => /\.mp3$/.test(e.p)).length, MB: +(openLog.filter(e => /\.mp3$/.test(e.p)).reduce((a, e) => a + e.bytes, 0) / 1e6).toFixed(2) };
// state side effects
out.ls = await page.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return ks.filter(k => /^hsn_progress:|^wordIsland|lastIsland/.test(k)).sort(); });
const fr = page.frames().find(f => f.parentFrame() === page.mainFrame() && f.url().replace(ORIGIN, '').split('?')[0] === '/' + ISL);
if (fr) {
  out.myLearning = await fr.evaluate(() => {
    try { window.HansenMyLearning._open(); } catch (e) { return 'open failed ' + e; }
    const el = document.getElementById('hsn-ml'); if (!el) return 'no panel';
    const rows = [...el.querySelectorAll('.hsn-ml-isl')].map(r => r.innerText.replace(/\s+/g, ' ').trim());
    const cnt = (el.querySelector('.hsn-ml-sec .cnt') || {}).innerText;
    const r = { rows, cnt };
    try { window.HansenMyLearning._close(); } catch (e) {}
    return r;
  }).catch(e => 'eval err ' + e);
}
out.ev = ev;
const cdp = await ctx.newCDPSession(page);
out.dom = await cdp.send('Memory.getDOMCounters');
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const brief = { ...out }; delete brief.tree; delete brief.docs;
console.log(JSON.stringify(brief, null, 1).slice(0, 5000));
console.log('TREE:'); for (const r of out.tree) console.log('  '.repeat(r.depth) + `[${r.depth}] ${r.url} hidden=${r.hidden} vis=${r.vis} scripts=${r.nScripts} ivl=${r.ivl} setN=${r.setN} setKeys=${r.setKeys} plays=${(r.plays || []).length} speaks=${(r.speaks || []).length} dlg=${JSON.stringify(r.dlg || [])} rej=${JSON.stringify(r.rej || [])}`);
console.log('DOCS:'); for (const d of out.docs) console.log('  ' + d);
await browser.close(); srv.close();
