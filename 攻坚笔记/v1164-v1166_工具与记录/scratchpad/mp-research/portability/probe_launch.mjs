// probe_launch.mjs — measure first-launch network + localStorage of the v1163 snapshot.
// Usage: node probe_launch.mjs <port> <snapshot_dir> <out_json>
// All non-127.0.0.1 requests are ABORTED (no CloudBase traffic) and recorded.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [PORT, SNAP, OUT] = process.argv.slice(2);
const BASE = `http://127.0.0.1:${PORT}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322d) NetType/WIFI Language/zh_CN';

function fileSize(u) {
  try {
    const p = decodeURIComponent(new URL(u).pathname).replace(/^\//, '') || 'index.html';
    return fs.statSync(path.join(SNAP, p)).size;
  } catch { return 0; }
}
function kind(u) {
  const e = path.extname(new URL(u).pathname).toLowerCase();
  if (['.mp3', '.wav', '.ogg'].includes(e)) return 'audio';
  if (['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(e)) return 'image';
  if (['.woff2', '.woff', '.ttf'].includes(e)) return 'font';
  if (e === '.js' || e === '.mjs') return 'js';
  if (e === '.html' || e === '') return 'html';
  return 'other:' + e;
}

async function lsDump(page) {
  return page.evaluate(() => {
    const o = {}; let chars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); const v = localStorage.getItem(k) || '';
      o[k] = v.length; chars += k.length + v.length;
    }
    let utf8 = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); utf8 += new TextEncoder().encode(k + (localStorage.getItem(k) || '')).length;
    }
    return { keys: localStorage.length, chars, utf8, sizes: o };
  });
}

async function run(label, url, { sw = 'block', waitMs = 12000, after = null } = {}) {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: sw, locale: 'zh-CN' });
  const reqs = []; const external = []; const errors = [];
  await c.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    external.push(u.slice(0, 200)); return route.abort();
  });
  c.on('request', r => { const u = r.url(); if (u.startsWith(BASE)) reqs.push({ u: u.replace(BASE, ''), t: kind(u), b: fileSize(u), at: Date.now() }); });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
  const tLoad = Date.now() - t0;
  const reqAtLoad = reqs.length;
  await p.waitForTimeout(waitMs);
  let extra = null;
  if (after) extra = await after(p, reqs);
  const ls = await lsDump(p);
  await b.close();
  const dedup = new Map();
  for (const r of reqs) { const k = r.u.split('?')[0]; if (!dedup.has(k)) dedup.set(k, r); }
  const byT = {};
  for (const r of dedup.values()) { byT[r.t] = byT[r.t] || { n: 0, bytes: 0 }; byT[r.t].n++; byT[r.t].bytes += r.b; }
  const loadSet = new Map();
  for (const r of reqs.slice(0, reqAtLoad)) { const k = r.u.split('?')[0]; if (!loadSet.has(k)) loadSet.set(k, r); }
  const byTLoad = {};
  for (const r of loadSet.values()) { byTLoad[r.t] = byTLoad[r.t] || { n: 0, bytes: 0 }; byTLoad[r.t].n++; byTLoad[r.t].bytes += r.b; }
  return {
    label, url, sw, tLoad_ms: tLoad,
    unique_requests_total: dedup.size, bytes_total: [...dedup.values()].reduce((a, r) => a + r.b, 0), by_type_total: byT,
    unique_requests_until_load: loadSet.size, bytes_until_load: [...loadSet.values()].reduce((a, r) => a + r.b, 0), by_type_until_load: byTLoad,
    external_attempts: [...new Set(external)], page_errors: errors.slice(0, 15), localStorage: ls, extra,
    request_list: [...dedup.values()].map(r => `${r.t}\t${r.b}\t${r.u}`),
  };
}

const results = [];
results.push(await run('home first launch (SW blocked)', '/index.html', { sw: 'block', waitMs: 15000 }));
results.push(await run('home first launch (SW allowed)', '/index.html', { sw: 'allow', waitMs: 20000 }));
results.push(await run('home then open island food', '/index.html', {
  sw: 'block', waitMs: 6000, after: async (p, reqs) => {
    const before = reqs.length;
    const ok = await p.evaluate(() => { try { window.openIsland('island_food.html'); return true; } catch (e) { return String(e); } });
    await p.waitForTimeout(12000);
    const added = new Map();
    for (const r of reqs.slice(before)) { const k = r.u.split('?')[0]; if (!added.has(k)) added.set(k, r); }
    const byT = {};
    for (const r of added.values()) { byT[r.t] = byT[r.t] || { n: 0, bytes: 0 }; byT[r.t].n++; byT[r.t].bytes += r.b; }
    const frames = p.frames().map(f => f.url().replace(BASE, ''));
    return { openIsland: ok, frames, island_unique_new_requests: added.size, island_new_bytes: [...added.values()].reduce((a, r) => a + r.b, 0), island_by_type: byT };
  }
}));
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
for (const r of results) {
  console.log('==', r.label, 'load', r.tLoad_ms, 'ms; untilLoad', r.unique_requests_until_load, r.bytes_until_load, 'total', r.unique_requests_total, r.bytes_total);
  console.log('   byTypeTotal', JSON.stringify(r.by_type_total));
  console.log('   byTypeUntilLoad', JSON.stringify(r.by_type_until_load));
  console.log('   ls', r.localStorage.keys, 'keys', r.localStorage.utf8, 'utf8 bytes');
  console.log('   external', r.external_attempts.length, JSON.stringify(r.external_attempts.slice(0, 8)));
  console.log('   errors', JSON.stringify(r.page_errors.slice(0, 5)));
  if (r.extra) console.log('   extra', JSON.stringify(r.extra));
}
