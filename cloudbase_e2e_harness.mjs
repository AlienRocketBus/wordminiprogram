/* cloudbase_e2e_harness.mjs —— 「两部手机 + 模拟云端」端到端测试的公共部分（v1164）
 *
 * 规矩（为什么这样写）：
 *   · **App 一行不替换**：不用 _setTransportForTest / _setAuthForTest / _setMeForTest。
 *     页面、账号、房间、天梯、vendor SDK 都是真的，只有腾讯云的网络由 cloudbase_emulator.mjs 应答。
 *   · **按手指点**：tap() 先滚到眼前、再用 elementFromPoint 确认手指下面真是那个按钮
 *     （被别的层盖住就报错 —— 天梯藏在大PK屏后面那种 bug 只有这样才抓得到），再 touchscreen.tap。
 *   · **绝不联网**：腾讯云的域名交给模拟云端；其它外网一律掐断并记下来（leaks）。
 *   · 一个浏览器上下文 = 一部手机 = 一个账号（各自的 localStorage）。
 *   · 失败时把每部手机屏幕上的字、弹窗、数据库快照一起打出来，不用重跑就能看懂。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';
import { createEmulator, ACL } from './cloudbase_emulator.mjs';

export { createEmulator, ACL };
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
/* 「手机」关掉时还在路上的请求会在 Playwright 里报 Target closed —— 那是测试本身在关手机，不算错；
   别的未处理错误照旧让进程崩掉（不许被吞掉） */
process.on('unhandledRejection', (e) => {
  if (/Target page, context or browser has been closed|Target closed|has been closed/.test(String((e && e.message) || e))) return;
  throw e;
});
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 环境 ID 从 App 自己的配置里读 —— 和真机请求的是同一个域名 */
export function cloudConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'hansen_cloud_config_v965.js'), 'utf8');
  const env = (/envId\s*:\s*'([^']+)'/.exec(src) || [])[1];
  const region = (/region\s*:\s*'([^']*)'/.exec(src) || [])[1] || '';
  if (!env) throw new Error('读不到 hansen_cloud_config_v965.js 里的 envId');
  return { env, region: region || 'ap-shanghai' };
}

/* App 用到的集合（权限按交接文档里控制台的实际设置） */
export function defaultCollections(overrides = {}) {
  return Object.assign({
    hansen_pk_rooms: ACL.READONLY,
    hansen_saves: ACL.READONLY,
    sb_profile: ACL.READONLY,
    counters: ACL.ADMINONLY,
    hansen_friends: ACL.READONLY,
    hansen_friend_msgs: ACL.READONLY,
  }, overrides);
}

export function makeEmulator({ collections, knobs } = {}) {
  const c = cloudConfig();
  return createEmulator({ env: c.env, region: c.region, collections: collections || defaultCollections(), knobs });
}

// ─── 静态服务器：照部署时的 Content-Type 回文件 ─────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
export async function startStatic() {
  const missing = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    const fp = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { missing.push(p); res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(fp).pipe(res);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  srv.origin = `http://127.0.0.1:${srv.address().port}`;
  srv.missing = missing;
  return srv;
}

export async function launchBrowser() {
  return chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
}

const LOCAL = /^(127\.0\.0\.1|localhost)$/;
const TENCENT = /(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// ─── 一部手机 ───────────────────────────────────────────────
export class Phone {
  constructor(name, ctx, page, emu) {
    this.name = name; this.ctx = ctx; this.page = page; this.emu = emu;
    this.leaks = []; this.errors = []; this.dialogs = []; this.consoleErrors = [];
    this.closed = false;
  }
  async eval(fn, arg) {
    try { return await this.page.evaluate(fn, arg); }
    catch (e) { return { __thrown: String((e && e.message) || e).slice(0, 300) }; }
  }
  /* 手指下面是不是这个元素（不点） */
  async hitTest(sel, { hasText, timeout = 10000 } = {}) {
    let loc = this.page.locator(sel);
    if (hasText) loc = loc.filter({ hasText });
    loc = loc.filter({ visible: true }).first();
    try { await loc.waitFor({ state: 'visible', timeout }); }
    catch (e) { return { ok: false, why: `等了 ${timeout}ms 也没看到「${sel}${hasText ? ' ' + hasText : ''}」` }; }
    return loc.evaluate((el) => {
      try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) { /* 老内核 */ }
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      const hit = document.elementFromPoint(x, y);
      const desc = (e) => { const c = []; while (e && c.length < 6) { c.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); e = e.parentElement; } return c.join(' < '); };
      const ok = !!hit && (hit === el || el.contains(hit));
      return { ok, x, y, w: Math.round(r.width), h: Math.round(r.height), hit: hit ? desc(hit) : '(屏幕外)', el: desc(el),
               why: ok ? '' : `手指下面不是它，而是 ${hit ? desc(hit) : '屏幕外'}` };
    });
  }
  /* 像人一样点：看得见、没被挡住，才按下去 */
  async tap(sel, opts = {}) {
    const t0 = Date.now(), limit = opts.timeout || 10000;
    let h = null;
    while (Date.now() - t0 < limit) {
      h = await this.hitTest(sel, { hasText: opts.hasText, timeout: Math.max(500, limit - (Date.now() - t0)) });
      if (h.ok) break;
      if (/没看到/.test(h.why || '')) break;
      await sleep(250);   // 可能是一闪而过的提示条挡着
    }
    if (!h || !h.ok) {
      const e = new Error(`[${this.name}] 点不到「${sel}${opts.hasText ? ' ' + opts.hasText : ''}」：${h ? h.why : ''}`);
      e.tapFail = h; throw e;
    }
    await this.page.touchscreen.tap(h.x, h.y);
    return h;
  }
  async type(text) { await this.page.keyboard.type(String(text), { delay: 15 }); }
  /* 最上面那一层（全屏浮层）里的字 —— 这才是孩子此刻看到的 */
  async screen() {
    const r = await this.eval(() => {
      const pts = [[innerWidth / 2, innerHeight / 2], [innerWidth / 2, 90], [innerWidth / 2, innerHeight - 90]];
      const seen = new Set(), out = [];
      for (const [x, y] of pts) {
        let e = document.elementFromPoint(x, y), layer = null;
        while (e && e !== document.body && e !== document.documentElement) {
          if (getComputedStyle(e).position === 'fixed') layer = e;
          e = e.parentElement;
        }
        layer = layer || document.body;
        if (!seen.has(layer)) { seen.add(layer); out.push(layer.innerText || ''); }
      }
      return out.join('\n');
    });
    return typeof r === 'string' ? r : JSON.stringify(r);
  }
  async allText() { const r = await this.eval(() => document.body ? document.body.innerText : ''); return typeof r === 'string' ? r : ''; }
  /* 等屏幕上出现某句话（弹窗也算看到） */
  async waitScreen(re, { timeout = 15000, all = false, interval = 250 } = {}) {
    const t0 = Date.now(); let last = '';
    while (Date.now() - t0 < timeout) {
      last = (all ? await this.allText() : await this.screen()) + '\n' + this.dialogs.map((d) => '[弹窗] ' + d.message).join('\n');
      if (re.test(last)) return last;
      await sleep(interval);
    }
    const e = new Error(`[${this.name}] ${timeout}ms 内屏幕上没出现 ${re}；最后看到：\n${indent(last.slice(0, 900))}`);
    e.lastText = last; throw e;
  }
  async local() { return this.eval(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }); }
  async uid() { const r = await this.eval(() => (window.HansenAuth && HansenAuth.readLocal && HansenAuth.readLocal().uid) || ''); return typeof r === 'string' ? r : ''; }
  /* 正常关掉（会触发 pagehide） */
  async close() {
    if (this.closed) return; this.closed = true;
    try { await this.page.close({ runBeforeUnload: true }); } catch (e) { /* 已关 */ }
    await sleep(300);
    try { await this.ctx.close(); } catch (e) { /* 已关 */ }
  }
  /* 手机没电/没信号：先断网，再关 —— 什么告别都发不出去 */
  async kill() {
    if (this.closed) return;
    const uid = this.cloudUid || await this.uid();
    if (uid && this.emu) this.emu.fault({ uid, do: 'abort' });
    this.closed = true;
    try { await this.ctx.close(); } catch (e) { /* 已关 */ }
  }
}

function indent(s, p = '      ') { return String(s || '').split('\n').map((l) => p + l).join('\n'); }

export async function openPhone(browser, emu, origin, { name = 'A', path: urlPath = '/spelling_pk.html', viewport = { width: 390, height: 844 }, ready } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai', userAgent: UA });
  const page = await ctx.newPage();
  const ph = new Phone(name, ctx, page, emu);
  if (emu) await emu.attach(ctx);
  /* 别的外网一律掐断并记下来 —— 测试绝不联网 */
  await ctx.route((u) => { const h = new URL(u).hostname; return !LOCAL.test(h) && !TENCENT.test(h); }, (r) => { try { ph.leaks.push(r.request().url()); r.abort('blockedbyclient').catch(() => {}); } catch (e) { /* 页面已关 */ } });
  page.on('pageerror', (e) => ph.errors.push(String(e && e.message || e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') ph.consoleErrors.push(m.text().slice(0, 200)); if (process.env.E2E_VERBOSE) console.log(`    [${name} ${m.type()}] ${m.text().slice(0, 240)}`); });
  /* 弹窗：记下内容（孩子看到的话），然后像人一样点「确定」 */
  page.on('dialog', async (d) => { ph.dialogs.push({ t: Date.now(), type: d.type(), message: d.message() }); try { await d.accept(); } catch (e) { /* 已处理 */ } });
  await page.goto(origin + urlPath, { waitUntil: 'domcontentloaded' });
  const want = ready || (() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL));
  await page.waitForFunction(want, null, { timeout: 45000 });
  await sleep(600);
  return ph;
}

// ─── 登录：走真的 HansenAuth（真 SDK 发真请求，由模拟云端应答） ──────
export async function loginPhone(ph, number, code) {
  const r = await ph.eval(async ([num, c]) => {
    try {
      await window.HansenAuth.sendPhoneCode(num);
      await window.HansenAuth.loginByPhoneCode(c);
      const s = await window.HansenAuth.ensureSession();
      return { ok: !!(s && s.ok), uid: s && s.uid, session: s };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, [number, code || (ph.emu && ph.emu.knobs.verificationCode) || '123456']);
  if (r && r.uid) ph.cloudUid = String(r.uid);
  return r;
}
export async function loginPassword(ph, username, password) {
  const r = await ph.eval(async ([u, p]) => {
    try {
      await window.HansenAuth.loginByPassword(u, p);
      const s = await window.HansenAuth.ensureSession();
      return { ok: !!(s && s.ok), uid: s && s.uid, session: s };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, [username, password]);
  if (r && r.uid) ph.cloudUid = String(r.uid);
  return r;
}
/* 登录面板那一行提示（#auMsg）出结果了没有：不是空的、也不是「处理中…」 */
export async function authPanelMsg(ph, { timeout = 25000 } = {}) {
  const r = await until(async () => {
    const v = await ph.eval(() => (document.getElementById('auMsg') || {}).innerText || '');
    return (typeof v === 'string' && v.trim() && !/处理中/.test(v)) ? v.trim() : null;
  }, { timeout, interval: 200 });
  return r || '';
}
/* 用界面登录：点「注册 / 登录」→ 填手机号 → 获取验证码 → 填码 → 登录 */
export async function loginPhoneUI(ph, number, code) {
  await ph.tap('#pkReg');
  await ph.tap('#auPhone'); await ph.type(number);
  await ph.tap('#auSend');
  await ph.waitScreen(/验证码已发送/, { timeout: 15000 });
  await ph.tap('#auCode'); await ph.type(code || (ph.emu && ph.emu.knobs.verificationCode) || '123456');
  await ph.tap('#auGo');
  const txt = await authPanelMsg(ph);
  ph.cloudUid = await ph.uid();
  return txt;
}

/* 起名屏（第一次进对战都会遇到）：点输入框、打字、点「开始吧」 */
export async function answerNameIfAsked(ph, name, { timeout = 3000 } = {}) {
  const h = await ph.hitTest('#pkNameIn', { timeout });
  if (!h.ok) return false;
  await ph.tap('#pkNameIn');
  await ph.type(name);
  await ph.tap('#pkNameOk');
  await sleep(400);
  return true;
}

/* 岛屿页第一次打开会弹「欢迎来到…」—— 孩子会点「开始冒险！」把它关掉 */
export async function dismissIslandWelcome(ph, { rounds = 4 } = {}) {
  for (let i = 0; i < rounds; i++) {
    const h = await ph.hitTest('#alertModal.show button', { timeout: 1200 });
    if (!h.ok) return i;
    await ph.tap('#alertModal.show button');
    await sleep(500);
  }
  return rounds;
}

// ─── 对战屏 ────────────────────────────────────────────────
/* 对战屏上现在显示什么（没在对战屏就是 null） */
export async function battleView(ph) {
  const r = await ph.eval(() => {
    const inp = document.getElementById('prIn');
    if (!inp || !inp.offsetParent) return null;
    const scr = document.getElementById('hsn_pkroom_screen');
    const txt = (scr || document.body).innerText || '';
    const m = /第\s*(\d+)\s*\/\s*(\d+)\s*词/.exec(txt);
    const opp = document.getElementById('prOpp');
    const oppNameEl = opp && opp.parentElement ? opp.parentElement.querySelector('span') : null;
    const cn = document.querySelector('.pr_cn');
    return {
      round: m ? Number(m[1]) - 1 : -1, total: m ? Number(m[2]) : 0,
      cn: cn ? cn.innerText.trim() : '', hint: ((document.querySelector('.pr_word') || {}).innerText || '').trim(),
      my: Number(((document.getElementById('prMy') || {}).textContent) || NaN),
      opp: Number(((opp || {}).textContent) || NaN),
      oppName: oppNameEl ? oppNameEl.innerText.trim() : '',
      disabled: !!inp.disabled, value: inp.value || '',
      hintLine: ((document.getElementById('prHint') || {}).innerText || '').trim(),
    };
  });
  return r && !r.__thrown ? r : null;
}
/* 用对战屏下面的字母键盘一个一个点出来 */
export async function typeWord(ph, word) {
  for (const ch of String(word).toLowerCase()) {
    if (!/[a-z]/.test(ch)) continue;
    await ph.tap(`#prKb .pr_key[data-k="${ch}"]`, { timeout: 4000 });
  }
}
/* 这一局的词：房主只存种子，双方用 App 里同一个确定性随机取词（纯函数，不改任何状态） */
export async function wordsOfRoom(ph, room) {
  const r = await ph.eval(([seed, n]) => window.HansenPkRoom.wordsFromSeed(seed, n), [room.seed, room.wordCount || 10]);
  return Array.isArray(r) ? r : [];
}

/* 对战键盘只有 26 个字母 —— 带空格/连字符的词（fire station、T-shirt）根本拼不出来 */
export const typeable = (w) => !!(w && /^[a-zA-Z]+$/.test(String(w.en || '')));

/* 两部手机按「剧本」打完一局：plan(i, word) → {first:'host'|'guest', second?, delayMs?}
 *   first 先拼；second 等 first 拼完 delayMs 后再拼（B/C 模式「后拼对」的那位）；
 *   拼不出来的词谁都不拼，等它超时。顺便记下每一词屏幕上显示的中文对不对。 */
export async function playMatch(players, words, plan, { timeout = 170000, stopAt = -1 } = {}) {
  const typed = { host: new Set(), guest: new Set() }, doneAt = {}, shown = { host: {}, guest: {} }, wrongCn = [];
  const t0 = Date.now();
  let lastSeen = { host: null, guest: null };
  let maxGap = 0;   /* 两部手机同时在对战屏时，所在的词号最多差几个（B/C 要一起翻篇：≤1） */
  while (Date.now() - t0 < timeout) {
    const views = {};
    for (const side of ['host', 'guest']) views[side] = players[side] && !players[side].closed ? await battleView(players[side]) : null;
    if (!views.host && !views.guest && (lastSeen.host || lastSeen.guest)) break;
    if (stopAt >= 0 && views.host && views.guest && views.host.round >= stopAt && views.guest.round >= stopAt) break;
    if (views.host && views.guest && views.host.round >= 0 && views.guest.round >= 0) maxGap = Math.max(maxGap, Math.abs(views.host.round - views.guest.round));
    for (const side of ['host', 'guest']) {
      const v = views[side];
      if (v) lastSeen[side] = v;
      if (!v || v.round < 0) continue;
      const w = words[v.round];
      if (!shown[side][v.round]) {
        shown[side][v.round] = v;
        if (w && v.cn && !String(v.cn).includes(String(w.cn || '').trim().slice(0, 4))) wrongCn.push(`${players[side].name} 第${v.round + 1}词 显示「${v.cn}」应是「${w.cn}」`);
      }
      if (v.disabled || !w || !typeable(w) || typed[side].has(v.round)) continue;
      const p = plan(v.round, w) || {};
      if (p.first === side || (p.second === side && doneAt[v.round] && Date.now() - doneAt[v.round] >= (p.delayMs || 700))) {
        typed[side].add(v.round);
        try { await typeWord(players[side], w.en); } catch (e) { wrongCn.push(`${players[side].name} 第${v.round + 1}词 打字失败：${e.message.slice(0, 160)}`); }
        if (p.first === side) doneAt[v.round] = Date.now();
      }
    }
    await sleep(120);
  }
  return { typed, shown, wrongCn, lastSeen, maxGap, ms: Date.now() - t0 };
}
/* 按剧本算两边应得的分：A 抢答只有先拼对的得分；B/C 先对 firstScore、后对 secondScore */
export function expectedScores(words, plan, M) {
  const s = { host: 0, guest: 0 };
  words.forEach((w, i) => {
    if (!typeable(w)) return;
    const p = plan(i, w) || {};
    if (p.first) s[p.first] += M.firstScore;
    if (p.second && M.waitAll) s[p.second] += M.secondScore;
  });
  return s;
}
/* 结算屏上的字 */
export async function resultView(ph) {
  const txt = await ph.screen();
  const m = /你\s*(\d+)\s*分\s*·\s*对手\s*(\d+)\s*分/.exec(txt);
  const d = /([+-]\d+)\s*天梯分/.exec(txt);
  return { text: txt, mine: m ? Number(m[1]) : null, theirs: m ? Number(m[2]) : null, delta: d ? Number(d[1]) : null,
           floor: /段位保护/.test(txt), win: /你赢了|本局你胜/.test(txt), lose: /这局输了/.test(txt), draw: /打平/.test(txt),
           abandon: /对手已离场/.test(txt) };
}
export async function waitResult(ph, timeout = 60000) {
  return until(async () => { const r = await resultView(ph); return (r.win || r.lose || r.draw) ? r : null; }, { timeout, interval: 400 });
}
export async function ladderRecord(ph) {
  const r = await ph.eval(() => { const s = window.HansenPkRecord && HansenPkRecord.summary(); const d = window.HansenPkRecord && HansenPkRecord.read(); return s ? { rating: s.rating, placed: !!s.placed, placementGames: d.placementGames, total: s.total, wins: s.wins, losses: s.losses } : null; });
  return r && !r.__thrown ? r : null;
}

// ─── 数据库快照（失败时打印，也用来断言「谁写了谁的文档」） ─────────
export function roomDocs(emu) { return emu.dump('hansen_pk_rooms') || []; }
export function describeRooms(emu, names = {}) {
  const who = (uid) => names[uid] || (uid ? uid.slice(-4) : '?');
  return roomDocs(emu).sort((a, b) => String(a._id).localeCompare(String(b._id))).map((d) => {
    const k = d.kind || (d.hostId !== undefined ? 'room(旧)' : '?');
    if (k === 'room') return `房间 ${d._id} 建者=${who(d._openid)} status=${d.status} mode=${d.mode} seat=${d.seat} host=${d.hostName} guest=${d.guestName || '-'} hostScore=${d.hostScore} endedBy=${d.endedBy || '-'} private=${!!d.isPrivate} code=${d.code || '-'}`;
    if (k === 'seat') return `座位 ${d._id} 建者=${who(d._openid)} guest=${d.guestName} ready=${!!d.guestReady} score=${d.guestScore} left=${!!d.left} abandonWin=${d.abandonWin || '-'}`;
    if (k === 'win') return `回合 ${d._id} 建者=${who(d._openid)} winner=${d.winner || '(没人)'}`;
    return `${k} ${d._id} 建者=${who(d._openid)} ${JSON.stringify(d).slice(0, 160)}`;
  }).join('\n') || '(hansen_pk_rooms 是空的)';
}
export function recentLog(emu, n = 14, names = {}) {
  return emu.log.slice(-n).map((e) => `${new Date(e.t).toISOString().slice(14, 23)} ${names[e.uid] || (e.uid || '').slice(-4) || '-'} ${e.method} ${e.path}${e.action ? ' ' + e.action.replace('database.', '') + ' ' + e.collection : ''} → ${e.status || '…'}${e.code ? ' ' + e.code : ''}${e.fault ? ' [故障:' + e.fault + ']' : ''}`).join('\n');
}

// ─── 断言与报告 ─────────────────────────────────────────────
export function checker(title) {
  const st = { pass: 0, fail: 0, fails: [], t0: Date.now() };
  console.log(`\n${title}\n`);
  return {
    st,
    get failed() { return st.fail; },
    /* explain 只在失败时才算（它要读每部手机的屏幕和数据库） */
    async ok(cond, msg, explain) {
      if (cond) { st.pass++; console.log('  OK  ' + msg); return true; }
      st.fail++; st.fails.push(msg); console.log('  XX  ' + msg);
      if (explain) {
        try { const d = typeof explain === 'function' ? await explain() : explain; if (d) console.log(indent(String(d).slice(0, 4000))); }
        catch (e) { console.log(indent('（打印现场时出错：' + e.message + '）')); }
      }
      return false;
    },
    section(name) { console.log(`\n── ${name} ──`); },
    summary() {
      console.log(`\n${st.pass} 通过，${st.fail} 失败（${Math.round((Date.now() - st.t0) / 1000)} 秒）`);
      if (st.fail) console.log('失败的：\n' + st.fails.map((m) => '  · ' + m).join('\n'));
    },
  };
}
/* 失败现场：每部手机屏幕上的字、弹窗、页面报错 + 数据库 + 最近的云端请求 */
export function explainer(emu, phonesFn, namesFn) {
  return async (extra) => {
    const phones = phonesFn().filter(Boolean);
    const names = namesFn ? namesFn() : {};
    const parts = [];
    if (extra) parts.push(String(extra));
    for (const p of phones) {
      if (p.closed) { parts.push(`[${p.name}] （已关）`); continue; }
      const s = (await p.screen()).replace(/\n{2,}/g, '\n').slice(0, 500);
      parts.push(`[${p.name} 屏幕] ${s.replace(/\n/g, ' ⏎ ')}`);
      if (p.dialogs.length) parts.push(`[${p.name} 弹窗] ` + p.dialogs.slice(-3).map((d) => d.message.slice(0, 120)).join(' | '));
      if (p.errors.length) parts.push(`[${p.name} 页面报错] ` + p.errors.slice(-3).join(' | '));
    }
    parts.push('[数据库 hansen_pk_rooms]\n' + describeRooms(emu, names));
    if (emu.foreign.length) parts.push('[改别人文档的尝试] ' + emu.foreign.slice(-4).map((f) => `${names[f.uid] || f.uid.slice(-4)} ${f.action} ${f.collection} ${f.ids.join(',')}`).join(' | '));
    parts.push('[最近的云端请求]\n' + recentLog(emu, 12, names));
    return parts.join('\n');
  };
}

/* 等到条件成立（条件可以是 async），超时返回 null */
export async function until(fn, { timeout = 15000, interval = 250 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(interval);
  }
  return null;
}

/* 新协议下谁都不该去改别人的文档；有就是协议又退回去了 */
export function foreignWrites(emu, collection = 'hansen_pk_rooms') {
  return emu.foreign.filter((f) => !collection || f.collection === collection);
}
/* 房间集合里不许出现手机号、用户名（所有人都能读这个集合） */
export function leakedIdentity(emu, secrets) {
  const all = JSON.stringify(roomDocs(emu));
  return secrets.filter((s) => s && all.includes(String(s).replace(/^\+86\s*/, '')));
}
