/* test_smoothness_v1166.mjs —— 「流畅」发布闸门：把「不卡、不烫、不慢」变成会红的数字
 *
 * 为什么要有它：v1163 实测（4 倍慢 CPU）首页待机主线程 64~71% 在忙、岛屿菜单 34~49%；
 *   每开一个岛后台偷偷多下 6MB；进度多的孩子每答一题主线程卡 350~410ms。
 *   v1165 修好了这些，但没有一道闸门盯着「整体手感」——下一次谁加个永远循环的装饰、
 *   或者让答题多读两遍账本，没有任何测试会红。
 *
 * 环境（尽量像低端安卓微信）：真 Chromium，390×844 DPR2 触屏，CDP 4 倍 CPU 节流，
 *   4G（下行 9Mbps / 上行 1.5Mbps / 80ms），本地静态服务器带 gzip + ETag + 正确 MIME，
 *   Service Worker 关掉，外网一律解析失败（不用 Playwright 路由：路由会关掉 HTTP 缓存，预载就测不准）。
 *
 * 合同（上限见下面 CAPS，怎么定的见 攻坚笔记/gates/GATES.md）：
 *   S1 新孩子首访前 15 秒：请求数、传输字节数有上限
 *   S2 首页待机：主线程忙碌 %、还在跑的动画数、永远循环的动画、rAF 次数/秒
 *   S3 首页 → 岛：点岛卡到岛能用（揭开 + DOM 就绪 + 玩法卡在）的时间；岛 → 首页关闭时间；再进同一个岛（保活）
 *   S4 岛屿菜单待机：同 S2
 *   S5 进度多的孩子，三个小游戏（听音辨义 / 完形填空 / 极速60秒）真点答案：
 *      Event Timing 的「处理完成 − 按下」和「到下一帧画出来」中位数、p90
 *   S6 答对揭晓、结算页：长任务总时长、最长一帧、掉帧数
 *
 * 环境变量：SMOOTH_JSON=文件  把全部测量值写成 JSON（标定上限用）
 *           SMOOTH_ONLY=S1,S5 只跑部分（调试用；闸门里不要设）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const T_START = Date.now();

/* ── 上限：在本分支反复实测后加安全余量定的（见 GATES.md「标定」一节）── */
const CAPS = {
  firstVisitRequests: 158,     // S1 前 15 秒请求数（本分支 7 次都是 153；v1163 162、预载回退 163）
  firstVisitKB: 2700,          // S1 前 15 秒传输 KB（本分支 2238；v1163 3907、预载回退 3965）
  homeIdleBusyPct: 15,         // S2 首页待机主线程忙碌 %（本分支 0.8~2.0；v1163 / 待机回退 ~60）
  homeIdleRunningAnims: 20,    // S2 首页待机还在跑的动画（本分支 6 个主题演员；回退 120）
  homeIdleRafPerSec: 5,        // S2 首页待机 rAF 次数/秒，所有框合计（本分支 0.5；回退 56）
  islandIdleBusyPct: 30,       // S4 岛屿菜单待机忙碌 %（本分支空闲 9~10、并行负载 15~23；回退 64~96）
  islandIdleRunningAnims: 10,  // S4（首页 6 个主题演员在岛下面照飞 + 宠物浮动；回退 143）
  islandIdleRafPerSec: 5,      // S4（本分支 1.0~1.1；预载回退 7、待机回退 58）
  hiddenHomeRunningRatchet: 160, // S4 岛开着时被盖住的首页还在跑的动画（棘轮：今天 138，目标 0）
  infiniteAnims: 0,            // S2/S4 待机时永远循环的装饰（首页主题演员除外）
  openMs: 4500,                // S3 点岛卡 → 岛能用（本分支 2.1~3.0 秒，2 秒硬揭开）
  closeMs: 1200,               // S3 岛 → 首页（本分支空闲 84~143ms，重负载最差 684ms）
  reopenMs: 1200,              // S3 再进同一个岛（保活）（本分支 120~289ms；保活坏了=整页重载 >2 秒）
  answerHandlerMedian: 300,    // S5 每个游戏：processingEnd − startTime 中位数（本分支空闲 92~119、重负载 ≤216；账本回退 ≥522、v1163 ≥431）
  answerPaintMedian: 400,      // S5 每个游戏：到下一帧画出（Event Timing duration）中位数（本分支空闲 136~168、重负载 ≤316；回退 ≥492）
  answerHandlerP90: 380,       // S5 三个游戏合起来 24 题的 p90（本分支空闲 127~170、重负载 ≤253；回退 ≥525）
  answerPaintP90: 520,         // S5（本分支空闲 176~224、重负载 ≤408；回退 ≥600）
  answerPaintMax: 1200,        // S5 任何一题都不许「卡住」超过这么久（本分支最差 568）
  revealMedLongTaskMs: 500,    // S6 各次答对揭晓 1.5 秒内长任务合计的中位数（本分支空闲 82~196、重负载 ≤392；账本回退 634、v1163 462）
  revealMedMaxFrameMs: 350,    // S6 揭晓最长一帧的中位数（本分支 83~250；账本回退 583、v1163 483）
  revealMedDropped: 65,        // S6 揭晓掉帧中位数（本分支空闲 4~23、重负载 ≤50；v1163 60）——护栏，不是回退探测器
  revealWorstLongTaskMs: 1400, // S6 最差一次揭晓（棘轮：撞上云存档整份重建，今天最差 957）
  revealWorstMaxFrameMs: 700,  // S6（今天最差 467）
  revealWorstDropped: 110,     // S6（今天最差 69）
  resultLongTaskMs: 900,       // S6 结算页 3 秒内长任务合计（本分支 0~320、重负载 566；v1163 800）——护栏
  resultMaxFrameMs: 450,       // S6（本分支 67~267；账本回退 600、v1163 521）
  resultDropped: 150,          // S6（本分支空闲 5~51、重负载 ≤104）——护栏
};

const ONLY = (process.env.SMOOTH_ONLY || '').split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(k);
const OUT = {};
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const p90 = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : NaN; };
const r1 = x => Math.round(x * 10) / 10;

/* ── 本地静态服务器：gzip（文本类）+ ETag/304 + 正确 MIME ── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const GZ = /\.(html|js|mjs|css|json|svg|txt|md|webmanifest)$/i;
const cache = new Map();   // 路径 → { raw, gz, etag, mtime }
function entry(fp) {
  const st = fs.statSync(fp);
  const c = cache.get(fp);
  if (c && c.mtime === st.mtimeMs) return c;
  const raw = fs.readFileSync(fp);
  const e = { raw, gz: GZ.test(fp) ? zlib.gzipSync(raw, { level: 6 }) : null, etag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"', mtime: st.mtimeMs };
  cache.set(fp, e);
  return e;
}
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  let e; try { if (!fs.statSync(fp).isFile()) throw 0; e = entry(fp); } catch (_) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('nf'); }
  const h = { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache', etag: e.etag, vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === e.etag) { res.writeHead(304, h); return res.end(); }
  const useGz = e.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = useGz ? e.gz : e.raw;
  if (useGz) h['content-encoding'] = 'gzip';
  h['content-length'] = body.length;
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

/* 外网：DNS 一律解析失败；不走代理 */
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'] });
const WX_UA = 'Mozilla/5.0 (Linux; Android 12; V2118A Build/SP1A.210812.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5235 MMWEBSDK/20230701 MicroMessenger/8.0.40.2420(0x28002837) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64';

/* 每个框都装的探针：rAF 计数、长任务、Event Timing、点击时刻、按需逐帧采样 */
const PROBE = () => {
  const now = () => performance.timeOrigin + performance.now();
  window.__g = { raf: 0, lt: [], ev: [], downs: [], frames: null };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { window.__g.raf++; return raf.call(window, cb); };
  window.__gRaf = raf;   // 采样器自己用原版，不算进 rAF 次数
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__g.lt.push({ s: performance.timeOrigin + e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.interactionId) window.__g.ev.push({ n: e.name, id: e.interactionId, st: performance.timeOrigin + e.startTime, h: e.processingEnd - e.startTime, d: e.duration }); })
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch (e) {}
  addEventListener('pointerdown', ev => { window.__g.downs.push(performance.timeOrigin + ev.timeStamp); }, { capture: true, passive: true });
  window.__gFramesStart = () => { const g = window.__g; g.frames = []; const loop = t => { if (!g.frames) return; g.frames.push(performance.timeOrigin + t); window.__gRaf.call(window, loop); }; window.__gRaf.call(window, loop); };
  window.__gFramesStop = () => { const f = window.__g.frames || []; window.__g.frames = null; return f; };
  window.__gNow = now;
};

/* SMOOTH_PROFILE=1：揭晓/结算窗口里抓 CPU 剖析，打印最费时的函数（找凶手用；会让数字变慢，闸门里别开） */
const PROFILE = process.env.SMOOTH_PROFILE === '1';
async function profStart(cdp) { if (!PROFILE) return; await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
async function profStop(cdp, label) {
  if (!PROFILE) return;
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const tot = {};
  for (let i = 0; i < profile.samples.length; i++) {
    const d = (profile.timeDeltas[i + 1] || 0) / 1000, seen = new Set(); let id = profile.samples[i];
    while (id) { const cf = byId.get(id).callFrame; const k = (cf.functionName || '(匿名)') + ' ' + cf.url.split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1); if (!seen.has(k)) { tot[k] = (tot[k] || 0) + d; seen.add(k); } id = parent.get(id); }
  }
  console.log(`      [剖析 ${label}] ` + Object.entries(tot).filter(([k]) => !/^\((idle|program|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => Math.round(v) + 'ms ' + k).join(' | '));
}

async function newCtx(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: WX_UA, serviceWorkers: 'block', locale: 'zh-CN' });
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem('__gs')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('__gs', '1'); } } catch (e) {} }, seed || {});
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Performance.enable');
  /* 网络账本：从这一刻起每个请求 */
  const net = { reqs: [], bytes: 0, fin: new Map(), external: 0 };
  cdp.on('Network.requestWillBeSent', e => { const u = e.request.url; if (/^(data|blob):/.test(u)) return; if (!u.startsWith(BASE)) net.external++; net.reqs.push({ id: e.requestId, u: u.replace(BASE, ''), t: Date.now() }); });
  cdp.on('Network.loadingFinished', e => { net.fin.set(e.requestId, e.encodedDataLength); });
  return { ctx, page, cdp, errs, net };
}
const metrics = async cdp => { const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) o[x.name] = x.value; return o; };
const islandFrame = (page, file) => page.frames().find(f => f.url().includes(file) && f.parentFrame() === page.mainFrame());

/* 真手指点：先滚到中间、等两帧、确认最上层就是它，再点 */
async function tapEl(page, frame, sel) {
  const pt = await frame.evaluate(async s => {
    const el = document.querySelector(s); if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y);
    return { x, y, hit: !!h && (h === el || el.contains(h)) };
  }, sel);
  if (!pt || !pt.hit) return false;
  await page.touchscreen.tap(pt.x, pt.y);   // 岛 iframe 铺满全屏，坐标一致
  return true;
}

/* 待机：窗口内主线程忙碌 %、rAF 次数/秒（所有框）、还在跑的动画 */
async function idleWindow(page, cdp, ms) {
  const frames = page.frames();
  const raf0 = await Promise.all(frames.map(f => f.evaluate(() => window.__g ? window.__g.raf : 0).catch(() => 0)));
  const m0 = await metrics(cdp);
  await sleep(ms);
  const m1 = await metrics(cdp);
  const raf1 = await Promise.all(frames.map(f => f.evaluate(() => window.__g ? window.__g.raf : 0).catch(() => 0)));
  const anims = [];
  for (const f of frames) {
    const a = await f.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').map(x => {
      const t = x.effect && x.effect.target; const tm = x.effect && x.effect.getTiming ? x.effect.getTiming() : {};
      return { name: x.animationName || x.constructor.name, inf: tm.iterations === Infinity, flyer: !!(t && t.closest && t.closest('.flyer')),
        visible: !!(t && t.getClientRects && t.getClientRects().length) };
    })).catch(() => []);
    anims.push(...a);
  }
  const s = ms / 1000;
  return { busyPct: r1((m1.TaskDuration - m0.TaskDuration) / s * 100), scriptPct: r1((m1.ScriptDuration - m0.ScriptDuration) / s * 100),
    stylePct: r1((m1.RecalcStyleDuration - m0.RecalcStyleDuration) / s * 100), layoutPct: r1((m1.LayoutDuration - m0.LayoutDuration) / s * 100),
    recalcPerSec: r1((m1.RecalcStyleCount - m0.RecalcStyleCount) / s), layoutPerSec: r1((m1.LayoutCount - m0.LayoutCount) / s),
    rafPerSec: r1(raf1.reduce((a, b) => a + b, 0) / s - raf0.reduce((a, b) => a + b, 0) / s), running: anims.length,
    infinite: anims.filter(a => a.inf && !a.flyer).map(a => a.name), names: [...new Set(anims.map(a => a.name))].slice(0, 12) };
}
/* 逐帧统计：最长一帧、掉帧数（每帧按 16.7ms 算）、长任务合计 */
function frameStats(frames, lts, t0, t1) {
  const f = frames.filter(t => t >= t0 && t <= t1);
  let max = 0, dropped = 0;
  for (let i = 1; i < f.length; i++) { const g = f[i] - f[i - 1]; max = Math.max(max, g); dropped += Math.max(0, Math.round(g / 16.7) - 1); }
  if (f.length) { const head = f[0] - t0; max = Math.max(max, head); dropped += Math.max(0, Math.round(head / 16.7) - 1); }
  const seen = new Set(); let lt = 0, ltMax = 0;
  for (const x of lts) { const k = Math.round(x.s) + ':' + Math.round(x.d); if (seen.has(k)) continue; seen.add(k); const ov = Math.min(t1, x.s + x.d) - Math.max(t0, x.s); if (ov > 0) { lt += ov; ltMax = Math.max(ltMax, x.d); } }
  return { frames: f.length, maxFrameMs: r1(max), dropped, longTaskMs: r1(lt), longestTask: r1(ltMax) };
}
const allLongTasks = async page => (await Promise.all(page.frames().map(f => f.evaluate(() => window.__g ? window.__g.lt : []).catch(() => [])))).flat();

/* 机器基准：同样 4 倍节流下跑一段固定的脚本 + 排版，记下毫秒数（只记录，用来解读时间类数字） */
async function bench() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + 'VERSION'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ms = await page.evaluate(() => { const t = performance.now(); let o = []; for (let i = 0; i < 3000; i++) o.push({ i, s: 'w' + i, a: [i, i * 2] }); for (let k = 0; k < 6; k++) JSON.parse(JSON.stringify(o));
    const d = document.createElement('div'); document.body.appendChild(d); for (let i = 0; i < 1500; i++) { const e = document.createElement('span'); e.textContent = 'x' + i; d.appendChild(e); } void d.offsetHeight; d.remove(); return performance.now() - t; });
  await ctx.close(); return Math.round(ms);
}
OUT.benchStart = await bench();
console.log(`机器基准（4 倍节流）：${OUT.benchStart}ms`);

/* ═════════ 第一段：新孩子（S1 S2 S3 S4）═════════ */
if (want('S1') || want('S2') || want('S3') || want('S4')) {
  console.log('\n▶ 新孩子：首访 15 秒 / 首页待机 / 进岛 / 岛屿菜单待机 / 回首页');
  const { ctx, page, cdp, errs, net } = await newCtx({});
  const t0 = Date.now();
  await page.goto(BASE + 'index.html', { waitUntil: 'commit' });
  await sleep(Math.max(0, 15000 - (Date.now() - t0)));
  const in15 = net.reqs.filter(r => r.t - t0 <= 15000);
  const kb = in15.reduce((a, r) => a + (net.fin.get(r.id) || 0), 0) / 1024;
  const big = in15.map(r => ({ u: r.u.split('?')[0], kb: r1((net.fin.get(r.id) || 0) / 1024) })).sort((a, b) => b.kb - a.kb).slice(0, 6);
  OUT.S1 = { requests: in15.length, kb: Math.round(kb), external: net.external, biggest: big };
  if (want('S1')) {
    console.log(`    最大的几个：${big.map(b => b.u + ' ' + b.kb + 'KB').join('，')}`);
    ok(in15.length <= CAPS.firstVisitRequests, `S1 首访前 15 秒请求数 ≤ ${CAPS.firstVisitRequests}（实测 ${in15.length}）`);
    ok(kb <= CAPS.firstVisitKB, `S1 首访前 15 秒传输 ≤ ${CAPS.firstVisitKB}KB（实测 ${Math.round(kb)}KB）`);
  }
  /* 首页待机：15 秒没碰屏幕，装饰该歇了（12 秒规则）；量 8 秒 */
  const home = await idleWindow(page, cdp, 8000);
  OUT.S2 = home;
  if (want('S2')) {
    console.log(`    首页待机：忙 ${home.busyPct}%（脚本 ${home.scriptPct} 样式 ${home.stylePct} 排版 ${home.layoutPct}），rAF ${home.rafPerSec}/秒，样式重算 ${home.recalcPerSec}/秒，在跑动画 ${home.running}（${home.names.join(',')}）`);
    ok(home.busyPct <= CAPS.homeIdleBusyPct, `S2 首页待机主线程忙碌 ≤ ${CAPS.homeIdleBusyPct}%（实测 ${home.busyPct}%）`);
    ok(home.running <= CAPS.homeIdleRunningAnims, `S2 首页待机在跑动画 ≤ ${CAPS.homeIdleRunningAnims}（实测 ${home.running}）`);
    ok(home.rafPerSec <= CAPS.homeIdleRafPerSec, `S2 首页待机 rAF ≤ ${CAPS.homeIdleRafPerSec}/秒（实测 ${home.rafPerSec}）`);
    ok(home.infinite.length <= CAPS.infiniteAnims, `S2 首页待机没有永远循环的装饰（主题演员除外）（实测：${home.infinite.join(',') || '无'}）`);
  }

  /* 点美食岛卡 → 岛能用 */
  const watchOpen = file => page.evaluate(f => new Promise(res => {
    const t0 = performance.timeOrigin + performance.now(); let revealed = 0;
    const tick = () => {
      const now = performance.timeOrigin + performance.now();
      const wrap = document.getElementById('islandFrameWrap'), fr = document.getElementById('islandFrame');
      let ready = false, path = '';
      try { path = fr.contentWindow.location.pathname; const d = fr.contentDocument; ready = path.endsWith('/' + f) && d.readyState !== 'loading' && d.querySelectorAll('.mode-card').length > 0; } catch (e) {}
      const vis = wrap && wrap.style.display !== 'none' && fr.style.opacity === '1';
      if (vis && !revealed) revealed = now;
      if (vis && ready) return res({ done: now, revealed });
      if (now - t0 > 20000) return res({ done: 0, revealed, path });
      window.__gRaf.call(window, tick);
    };
    window.__gRaf.call(window, tick);
  }), file);
  const tapCard = async () => {
    await page.evaluate(() => { const el = document.querySelector('a.island[href="island_food.html"]'); el.scrollIntoView({ block: 'center', behavior: 'auto' }); });
    await sleep(300);
    const box = await page.evaluate(() => { const b = document.querySelector('a.island[href="island_food.html"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 40) }; });
    const n0 = await page.evaluate(() => window.__g.downs.length);
    const w = watchOpen('island_food.html');
    await page.touchscreen.tap(box.x, box.y);
    const tapAt = Date.now();
    const r = await w;
    const down = await page.evaluate(n => window.__g.downs[n], n0);
    return { openMs: r.done && down ? Math.round(r.done - down) : Infinity, revealMs: r.revealed && down ? Math.round(r.revealed - down) : null, tapAt };
  };
  const open1 = await tapCard();
  let F = islandFrame(page, 'island_food.html');
  ok(!!F && open1.openMs < Infinity, `S3 点美食岛卡能进岛（揭开 ${open1.revealMs}ms）`);
  /* 新孩子进岛有欢迎弹窗：点「开始冒险！」 */
  if (F) {
    await F.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /开始冒险/.test(b.textContent) && b.offsetParent), null, { timeout: 8000 }).catch(() => {});
    const has = await F.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) { b.id = b.id || '__gStart'; return '#' + b.id; } return null; });
    if (has) await tapEl(page, F, has);
    /* 已知问题（v1166 发现）：点岛卡这一下算「碰了首页」，首页装饰醒过来，在岛下面接着跑 12 秒（孩子看不见）。
       棘轮：只许变少，不许变多；修好后把上限改成 0 */
    await sleep(1500);
    const hid = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    OUT.S4hidden = { hiddenHomeRunning: hid };
    if (want('S4')) ok(hid <= CAPS.hiddenHomeRunningRatchet, `S4 岛开着时被盖住的首页在跑动画 ≤ ${CAPS.hiddenHomeRunningRatchet}（棘轮，已知问题，目标 0；实测 ${hid}）`);
    /* 等到点岛卡后 14 秒：首页装饰重新歇下、岛的一次性动效播完，才算「待机」 */
    await sleep(Math.max(0, 14000 - (Date.now() - open1.tapAt)));
    const isl = await idleWindow(page, cdp, 8000);
    OUT.S4 = isl;
    if (want('S4')) {
      console.log(`    岛屿菜单待机：忙 ${isl.busyPct}%（脚本 ${isl.scriptPct} 样式 ${isl.stylePct} 排版 ${isl.layoutPct}），rAF ${isl.rafPerSec}/秒，样式重算 ${isl.recalcPerSec}/秒，在跑动画 ${isl.running}（${isl.names.join(',')}）`);
      ok(isl.busyPct <= CAPS.islandIdleBusyPct, `S4 岛屿菜单待机主线程忙碌 ≤ ${CAPS.islandIdleBusyPct}%（实测 ${isl.busyPct}%）`);
      ok(isl.running <= CAPS.islandIdleRunningAnims, `S4 岛屿菜单待机在跑动画 ≤ ${CAPS.islandIdleRunningAnims}（实测 ${isl.running}）`);
      ok(isl.rafPerSec <= CAPS.islandIdleRafPerSec, `S4 岛屿菜单待机 rAF ≤ ${CAPS.islandIdleRafPerSec}/秒（实测 ${isl.rafPerSec}）`);
      ok(isl.infinite.length <= CAPS.infiniteAnims, `S4 岛屿菜单待机没有永远循环的装饰（实测：${isl.infinite.join(',') || '无'}）`);
    }
    /* 岛 → 首页：点左上角地图按钮，量到外壳藏起、首页下一帧画出来 */
    const closeP = page.evaluate(() => new Promise(res => {
      const t0 = performance.timeOrigin + performance.now();
      const tick = () => { const w = document.getElementById('islandFrameWrap'); const now = performance.timeOrigin + performance.now();
        if (w && w.style.display === 'none') return window.__gRaf.call(window, () => res(performance.timeOrigin + performance.now()));
        if (now - t0 > 10000) return res(0); window.__gRaf.call(window, tick); };
      window.__gRaf.call(window, tick);
    }));
    const nDown = await F.evaluate(() => window.__g.downs.length);
    const tapped = await tapEl(page, F, '.world-map-btn');
    const tHome = await closeP;
    const tDown = await F.evaluate(n => window.__g.downs[n], nDown).catch(() => 0);
    const closeMs = tapped && tHome && tDown ? Math.round(tHome - tDown) : Infinity;
    await sleep(1500);
    const reopen = await tapCard();
    OUT.S3 = { openMs: open1.openMs, revealMs: open1.revealMs, closeMs, reopenMs: reopen.openMs };
    if (want('S3')) {
      ok(open1.openMs <= CAPS.openMs, `S3 首页 → 岛能用 ≤ ${CAPS.openMs}ms（实测 ${open1.openMs}ms，揭开 ${open1.revealMs}ms）`);
      ok(closeMs <= CAPS.closeMs, `S3 岛 → 首页 ≤ ${CAPS.closeMs}ms（实测 ${closeMs}ms）`);
      ok(reopen.openMs <= CAPS.reopenMs, `S3 再进同一个岛（保活）≤ ${CAPS.reopenMs}ms（实测 ${reopen.openMs}ms）`);
    }
  }
  OUT.S1.externalAttempts = net.external;
  ok(errs.length === 0, `新孩子这一段零脚本错误 ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

/* ═════════ 第二段：进度多的孩子答题（S5 S6）═════════ */
/* 夹具：27 个岛存档 + 账本约 900 已学 / 200 错词 / 300 复习计划（和 test_answer_cost_v1165 同一个配方） */
async function buildHeavyFixture() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_food.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenCanonical && window.S && typeof startListen === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const seed = await page.evaluate(() => {
    const HC = window.HansenCanonical, now = Date.now();
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const tpl = JSON.parse(JSON.stringify(window.S));
    let rnd = 12345; const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
    const out = {};
    HC.allSaveAliases().forEach((key, k) => {
      const a = HC.resolve(key); if (!a) return;
      const s = JSON.parse(JSON.stringify(tpl));
      s.learned = []; s.mc = {}; s.wrongs = {}; s.srs = {};
      for (let i = 0; i < a.length; i++) {
        if (R() < 0.95) { s.learned.push(i); s.mc[i] = 1 + Math.floor(R() * 5); }
        if (R() < 0.21) s.wrongs[i] = 1 + Math.floor(R() * 3);
        if (R() < 0.32) s.srs[i] = { box: Math.floor(R() * 5), due: ymd(new Date(now + Math.floor(R() * 6 - 2) * 86400000)), last: ymd(new Date(now - 86400000)) };
      }
      s.stats = Object.assign({}, s.stats || {}, { correct: 400 + k, wrong: 60 + k, clozeRight: 30, listenRight: 25, typeCount: 12 });
      s.totalAnswers = Math.max(s.totalAnswers || 0, 500 + k);
      s.lastSaveTime = now - (k + 2) * 3600000;
      out[key] = JSON.stringify(s); out[key + '_bak'] = out[key];
    });
    Object.entries(out).forEach(([k, v]) => localStorage.setItem(k, v));
    HC.migrate();
    const st = HC.read();
    HC.islands.forEach(isl => { const p = st.islands[isl.id]; for (let i = 0; i < isl.words; i++) if (R() < 0.75) p.cleared.wrongs[i] = now - Math.floor(R() * 40) * 86400000 - 1; });
    HC.write(st);
    const st2 = HC.read(); HC.write(st2);
    const all = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); all[k] = localStorage.getItem(k); }
    delete all.wordIslandFood; delete all.wordIslandFood_bak;
    return all;
  });
  await ctx.close();
  return seed;
}

if (want('S5') || want('S6')) {
  console.log('\n▶ 进度多的孩子：三个小游戏真点答案（4 倍慢 CPU + 4G）');
  const seed = await buildHeavyFixture();
  const { ctx, page, cdp, errs } = await newCtx(seed);
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_food.html"]'), null, { timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => { const el = document.querySelector('a.island[href="island_food.html"]'); el.scrollIntoView({ block: 'center', behavior: 'auto' }); });
  await sleep(300);
  const box = await page.evaluate(() => { const b = document.querySelector('a.island[href="island_food.html"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 40) }; });
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_food\.html$/.test(f.contentWindow.location.pathname) && typeof f.contentWindow.startListen === 'function' && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 40000 });
  const F = islandFrame(page, 'island_food.html');
  await sleep(3000);
  await F.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await sleep(800);

  const games = {}, reveals = [];
  /* 点一个答案：返回这次交互的 Event Timing（处理完成 − 按下、到下一帧）；低于 16ms 的浏览器不上报，记 16 */
  async function answer(optSel, markerSel, idx, withFrames) {
    await sleep(350);
    const n0 = await F.evaluate(() => window.__g.ev.length);
    if (withFrames) { await F.evaluate(() => window.__gFramesStart()); await profStart(cdp); }
    await F.evaluate(() => { window.__gMarked = false; if (!window.__gMO) { window.__gMO = new MutationObserver(l => { for (const m of l) if (m.target.classList && (m.target.classList.contains('correct') || m.target.classList.contains('wrong'))) window.__gMarked = true; }); window.__gMO.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); } });
    const tTap = await F.evaluate(() => window.__gNow());
    const tapped = await tapEl(page, F, `${optSel}:nth-child(${idx + 1})`);
    if (!tapped) return null;
    let ent = [];
    for (let i = 0; i < 40; i++) { await sleep(50); ent = await F.evaluate(n => window.__g.ev.slice(n), n0); if (ent.some(e => e.n === 'click')) break; }
    const marked = await F.evaluate(() => window.__gMarked);
    let fr = null;
    if (withFrames) {
      await sleep(Math.max(0, 1500 - 50));
      const frames = await F.evaluate(() => window.__gFramesStop());
      await profStop(cdp, '揭晓');
      fr = frameStats(frames, await allLongTasks(page), tTap, tTap + 1500);
    }
    const byId = {}; for (const e of ent) (byId[e.id] = byId[e.id] || []).push(e);
    const ids = Object.keys(byId);
    const grp = ids.length ? byId[ids[ids.length - 1]] : [];
    return { marked, h: grp.length ? Math.max(16, ...grp.map(e => e.h)) : 16, d: grp.length ? Math.max(16, ...grp.map(e => e.d)) : 16, below: !grp.length, fr };
  }
  const waitLessonGone = async () => {
    await F.waitForFunction(() => document.getElementById('hml_lesson'), null, { timeout: 6000 }).catch(() => {});
    await sleep(300);
    if (await F.evaluate(() => !!document.getElementById('hml_lesson'))) await tapEl(page, F, '#hml_lesson');
    await F.waitForFunction(() => !document.getElementById('hml_lesson'), null, { timeout: 10000 }).catch(() => {});
  };
  async function play(name, cfg) {
    const res = [];
    ok(await tapEl(page, F, cfg.card), `${name}：真点玩法卡`);
    await F.waitForFunction(s => document.querySelector(s), cfg.level, { timeout: 10000 }).catch(() => {});
    ok(await tapEl(page, F, cfg.level), `${name}：真点第一档难度`);
    if (cfg.after) await F.evaluate(cfg.after);
    let revealsLeft = cfg.reveals || 0;
    for (let n = 0; n < cfg.n; n++) {
      const ready = await F.waitForFunction(cfg.ready, null, { timeout: 20000 }).then(() => true).catch(() => false);
      if (!ready) { ok(false, `${name} 第 ${n + 1} 题没出来`); break; }
      const wrong = cfg.wrong.includes(n);
      const before = await F.evaluate(cfg.qid);
      const idx = await F.evaluate(cfg.pick, wrong);
      const withFrames = !wrong && revealsLeft > 0;
      const r = await answer(cfg.opt, cfg.marker, idx, withFrames);
      if (!r) { ok(false, `${name} 第 ${n + 1} 题选项点不到`); break; }
      if (!r.marked) { ok(false, `${name} 第 ${n + 1} 题点了没有对/错反馈`); break; }
      res.push(r);
      if (withFrames) { revealsLeft--; reveals.push({ game: name, ...r.fr }); }
      if (wrong) await waitLessonGone();
      await F.waitForFunction(([q, f]) => { try { return (new Function('return ' + f))() !== q; } catch (e) { return true; } }, [before, cfg.qidSrc], { timeout: 15000 }).catch(() => {});
    }
    const hs = res.map(r => r.h), ds = res.map(r => r.d);
    games[name] = { n: res.length, handler: hs.map(Math.round), paint: ds.map(Math.round), hMed: median(hs), hP90: p90(hs), dMed: median(ds), dP90: p90(ds) };
    console.log(`    ${name} 处理(ms)：${hs.map(Math.round).join(', ')}`);
    console.log(`    ${name} 到画出(ms)：${ds.map(Math.round).join(', ')}`);
    if (want('S5')) {
      const g = games[name];
      ok(g.n === cfg.n, `${name}：${cfg.n} 题全都点到、都有反馈（实测 ${g.n}）`);
      ok(g.hMed <= CAPS.answerHandlerMedian, `S5 ${name} 点答案→处理完 中位 ≤ ${CAPS.answerHandlerMedian}ms（实测 ${r1(g.hMed)}ms）`);
      ok(g.dMed <= CAPS.answerPaintMedian, `S5 ${name} 点答案→画出反馈 中位 ≤ ${CAPS.answerPaintMedian}ms（实测 ${r1(g.dMed)}ms）`);
      ok(Math.max(0, ...ds) <= CAPS.answerPaintMax, `S5 ${name} 没有一题卡住超过 ${CAPS.answerPaintMax}ms（最慢 ${Math.round(Math.max(0, ...ds))}ms）`);
    }
  }
  const back = async () => { await F.evaluate(() => { try { if (typeof stopSpeed === 'function') stopSpeed(); } catch (e) {} showScreen('home'); }); await sleep(800); };

  await play('听音辨义', { card: '.mode-card[onclick="startListen()"]', level: '#listenContent [onclick^="startListenLevel"]', n: 8, wrong: [2, 5], reveals: 4,
    ready: () => typeof listenQ !== 'undefined' && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length === 4 && !document.getElementById('hml_lesson'),
    qid: () => listenTotal, qidSrc: 'listenTotal', opt: '#listenScreen .listen-opts .boss-opt', marker: '#listenScreen .boss-opt.correct',
    pick: w => listenQ.opts.findIndex(o => w ? o.cn !== listenQ.word.cn : o.cn === listenQ.word.cn) });
  await back();
  await play('完形填空', { card: '.mode-card[onclick="startCloze()"]', level: '#clozeContent [onclick^="startClozeLevel"]', n: 6, wrong: [1, 4], reveals: 2,
    ready: () => typeof clozeQ !== 'undefined' && clozeQ && document.querySelectorAll('#clozeScreen .cloze-opt').length === 4 && !document.querySelector('#clozeScreen .cloze-opt[data-done]') && !document.getElementById('hml_lesson'),
    qid: () => clozeQ.word.en + '|' + clozePool.length, qidSrc: "clozeQ.word.en+'|'+clozePool.length", opt: '#clozeScreen .cloze-opts .cloze-opt', marker: '#clozeScreen .cloze-opt.correct',
    pick: w => clozeQ.opts.findIndex(o => w ? o.en !== clozeQ.word.en : o.en === clozeQ.word.en) });
  await back();
  await play('极速60秒', { card: '.mode-card[onclick="startSpeed()"]', level: '#speedContent [onclick^="startSpeedLevel"]', n: 10, wrong: [3, 7], reveals: 0,
    ready: () => spActive && document.querySelectorAll('#spOpts .boss-opt').length >= 2 && !document.getElementById('spOpts').dataset.done && !document.getElementById('hml_lesson'),
    after: () => { spTime = 999; },
    qid: () => window._spIdx + '|' + spPool2.length, qidSrc: "window._spIdx+'|'+spPool2.length", opt: '#spOpts .boss-opt', marker: '#spOpts .boss-opt.correct',
    pick: w => window._spOpts.findIndex(o => w ? o.en !== window._spCorrect : o.en === window._spCorrect) });
  OUT.S5 = games;
  {
    const hs = Object.values(games).flatMap(g => g.handler), ds = Object.values(games).flatMap(g => g.paint);
    OUT.S5pooled = { n: hs.length, hP90: p90(hs), dP90: p90(ds) };
    if (want('S5')) {
      ok(hs.length >= 20 && p90(hs) <= CAPS.answerHandlerP90, `S5 三个游戏 ${hs.length} 题合起来：点答案→处理完 p90 ≤ ${CAPS.answerHandlerP90}ms（实测 ${p90(hs)}ms）`);
      ok(ds.length >= 20 && p90(ds) <= CAPS.answerPaintP90, `S5 三个游戏 ${ds.length} 题合起来：点答案→画出反馈 p90 ≤ ${CAPS.answerPaintP90}ms（实测 ${p90(ds)}ms）`);
    }
  }

  /* 结算页：让极速60秒的倒计时自然走完（只把剩余时间拨到 1 秒），量结算出现后 3 秒 */
  await F.evaluate(() => { window.__gEnd = 0; const orig = window.endSpeed; window.endSpeed = function () { window.__gEnd = window.__gNow(); return orig.apply(this, arguments); }; window.__gFramesStart(); spTime = 1; });
  await F.waitForFunction(() => window.__gEnd > 0, null, { timeout: 8000 }).catch(() => {});
  const tEnd = await F.evaluate(() => window.__gEnd);
  await sleep(3200);
  const resFrames = await F.evaluate(() => window.__gFramesStop());
  const result = tEnd ? frameStats(resFrames, await allLongTasks(page), tEnd, tEnd + 3000) : null;
  const resultShown = await F.evaluate(() => /再来|再玩|返回|主页/.test((document.getElementById('speedContent') || {}).innerText || ''));
  OUT.S6 = { reveals, result };
  if (want('S6')) {
    for (const rv of reveals) {
      console.log(`    ${rv.game} 答对揭晓 1.5 秒：${rv.frames} 帧，最长一帧 ${rv.maxFrameMs}ms，掉帧 ${rv.dropped}，长任务 ${rv.longTaskMs}ms（最长 ${rv.longestTask}）`);
    }
    const worst = k => Math.max(...reveals.map(r => r[k]));
    const med = k => r1(median(reveals.map(r => r[k])));
    ok(reveals.length >= 5, `S6 至少量到 5 次答对揭晓（实测 ${reveals.length}）`);
    ok(med('longTaskMs') <= CAPS.revealMedLongTaskMs, `S6 答对揭晓长任务合计（中位）≤ ${CAPS.revealMedLongTaskMs}ms（实测 ${med('longTaskMs')}ms）`);
    ok(med('maxFrameMs') <= CAPS.revealMedMaxFrameMs, `S6 答对揭晓最长一帧（中位）≤ ${CAPS.revealMedMaxFrameMs}ms（实测 ${med('maxFrameMs')}ms）`);
    ok(med('dropped') <= CAPS.revealMedDropped, `S6 答对揭晓掉帧（中位）≤ ${CAPS.revealMedDropped}（实测 ${med('dropped')}）`);
    ok(worst('longTaskMs') <= CAPS.revealWorstLongTaskMs && worst('maxFrameMs') <= CAPS.revealWorstMaxFrameMs && worst('dropped') <= CAPS.revealWorstDropped,
      `S6 最差一次揭晓（棘轮，已知会撞上云存档整份重建）：长任务 ${worst('longTaskMs')}≤${CAPS.revealWorstLongTaskMs}，最长帧 ${worst('maxFrameMs')}≤${CAPS.revealWorstMaxFrameMs}，掉帧 ${worst('dropped')}≤${CAPS.revealWorstDropped}`);
    ok(!!result && resultShown, `S6 极速60秒倒计时走完出结算页`);
    if (result) {
      console.log(`    结算页 3 秒：${result.frames} 帧，最长一帧 ${result.maxFrameMs}ms，掉帧 ${result.dropped}，长任务 ${result.longTaskMs}ms（最长 ${result.longestTask}）`);
      ok(result.longTaskMs <= CAPS.resultLongTaskMs, `S6 结算页长任务合计 ≤ ${CAPS.resultLongTaskMs}ms（实测 ${result.longTaskMs}ms）`);
      ok(result.maxFrameMs <= CAPS.resultMaxFrameMs, `S6 结算页最长一帧 ≤ ${CAPS.resultMaxFrameMs}ms（实测 ${result.maxFrameMs}ms）`);
      ok(result.dropped <= CAPS.resultDropped, `S6 结算页掉帧 ≤ ${CAPS.resultDropped}（实测 ${result.dropped}）`);
    }
  }
  ok(errs.length === 0, `答题这一段零脚本错误 ${errs.slice(0, 2).join(' | ')}`);
  await ctx.close();
}

OUT.benchEnd = await bench();
OUT.runtimeSec = Math.round((Date.now() - T_START) / 1000);
OUT.fails = fails;
if (process.env.SMOOTH_JSON) fs.writeFileSync(process.env.SMOOTH_JSON, JSON.stringify(OUT, null, 1));
console.log(`\n用时 ${OUT.runtimeSec} 秒`);
console.log(fails ? `❌ 流畅闸门：${fails} 项失败` : '✅ 流畅闸门：首访流量、首页/岛屿待机、进出岛、三个小游戏答题手感、揭晓与结算帧 全部在上限内');
srv.close();
await browser.close();
process.exit(fails ? 1 : 0);
