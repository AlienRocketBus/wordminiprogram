const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_real_path_smoke_v1163.mjs —— 不用任何测试桩的真实路径冒烟测试
 *
 * ═══ 为什么要有这个文件 ═══
 *
 * BAT MAN 问：「为什么每个版本后面它总会出现这么多问题？」
 *
 * 统计出来的答案很清楚：
 *   用测试桩绕过云端的测试：14 个
 *
 * 那些测试都注入 `_setTransportForTest` / `_setDbForTest` / `_setAuthForTest`，
 * **把真实的云端调用整个替换掉**。于是：
 *
 *   · `app.database is not a function`（_app 返回 Promise 却被当同步用）
 *   · 对战页从来没引 vocab_all.js
 *   · 默认传输层根本没有 list 方法
 *
 * 这三个都是**建房完全不能用**级别的故障，
 * 而它们**从来没被任何测试碰到过** —— 因为测试不走那条路。
 *
 * > **178 个测试全绿，和「建房完全不能用」，可以同时成立。**
 * > 这不是运气不好，是结构性的。
 * >
 * > 测试桩替换掉的那一段，就是永远不会被验证的那一段。
 *
 * ═══ 这个文件的规矩 ═══
 *
 * **它一行测试桩都不许有。**
 *
 * 它不验业务结果（那些别的测试管），只验一件事：
 * **从页面加载到调用云端之前的那条链路，每一环都接得上。**
 *
 * 具体查五件事，每一件都对应一个真机上出过的故障：
 *   ① 页面上该有的模块都在（对战页少引 vocab_all.js → 建房秒结束）
 *   ② 模块之间的调用约定对得上（_app 返回 Promise 却被当同步用）
 *   ③ 传输层提供了代码实际会调的每个方法（缺 list → is not a function）
 *   ④ 入口按钮真的绑了处理函数（绑两次 → 后绑的覆盖先绑的）
 *   ⑤ 版本号在各处一致（散落九处 → 岛屿页无限刷新）
 */

import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = __HSN_ROOT.replace(/\/$/, '');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; console.log('  XX  ' + name); }
}

const VER = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain' }); r.end(VER); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

console.log('真实路径冒烟 v1163（零测试桩）\n');

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addInitScript(() => {
  try {
    if (window.top === window) localStorage.clear();
    /* 只放登录态和名字 —— 这是真实用户的状态，不是测试桩 */
    localStorage.setItem('hansen_auth_v1004',
      JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() }));
    localStorage.setItem('hansen_sb_profile_v1002',
      JSON.stringify({ name: '小明', cid: 'C0001' }));
  } catch (e) {}
});
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
const missing = [];
pg.on('response', r => { if (r.status() === 404) missing.push(r.url().split('/').pop().split('?')[0]); });

await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(7000);

/* ── ① 页面上该有的模块都在 ── */
{
  const r = await pg.evaluate(() => ({
    vocab: !!window.HANSEN_VOCAB_ALL,
    vocabCount: (() => {
      let n = 0;
      try { Object.keys(window.HANSEN_VOCAB_ALL || {}).forEach(k => { n += (window.HANSEN_VOCAB_ALL[k] || []).length; }); } catch (e) {}
      return n;
    })(),
    room: typeof window.HansenPkRoom,
    roomUI: typeof window.HansenPkRoomUI,
    auth: typeof window.HansenAuth,
    ladder: typeof window.HansenLadderUI,
    profile: typeof window.HansenSbProfile
  }));
  ok(r.vocab && r.vocabCount > 100,
     `★① 对战页加载了词库（${r.vocabCount} 个词）—— 空词表会让对战一开始就结束`);
  ok(r.room === 'object' && r.roomUI === 'object', '★① 房间模块和房间界面都在');
  ok(r.auth === 'object' && r.profile === 'object', '★① 账号模块和资料模块都在');
  ok(r.ladder === 'object', '★① 天梯界面在');
}

/* ── ② 模块之间的调用约定对得上 ── */
{
  const r = await pg.evaluate(() => {
    const A = window.HansenAuth;
    const out = {};
    out.hasApp = typeof (A && A._app);
    /* _app 必须返回 Promise —— 有三个模块曾经把它当同步用 */
    try {
      const v = A._app();
      out.appReturnsPromise = !!(v && typeof v.then === 'function');
      if (v && v['catch']) v['catch'](function () {});   /* 别让它变成未捕获拒绝 */
    } catch (e) { out.appReturnsPromise = 'threw'; }
    return out;
  });
  ok(r.hasApp === 'function', '★② HansenAuth 提供 _app()');
  ok(r.appReturnsPromise === true,
     '★② _app() 返回 Promise —— 调用方必须 .then()，不能当同步用');
}

/* ── ③ 传输层提供了代码实际会调的每个方法 ── */
{
  const src = fs.readFileSync(path.join(ROOT, 'hansen_pk_room_v1065.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const called = new Set([...code.matchAll(/T\(\)\.(\w+)\s*\(/g)].map(m => m[1]));
  const i = code.indexOf('function realTransport()');
  let provided = new Set();
  if (i >= 0) {
    let d = 0, j = code.indexOf('{', i), k = j;
    while (k < code.length) {
      if (code[k] === '{') d++;
      else if (code[k] === '}') { d--; if (d === 0) break; }
      k++;
    }
    provided = new Set([...code.slice(i, k + 1).matchAll(/(\w+):\s*function/g)].map(m => m[1]));
  }
  const miss = [...called].filter(x => !provided.has(x));
  ok(miss.length === 0,
     `★③ 传输层提供了全部 ${called.size} 个被调用的方法${miss.length ? '（缺 ' + miss.join(',') + '）' : ''}`);
}

/* ── ④ 入口按钮真的绑了处理函数，且只绑一次 ── */
{
  const r = await pg.evaluate(() => {
    const ids = ['pkRooms', 'pkLadder', 'pkFriends'];
    const out = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      out[id] = el ? (typeof el.onclick === 'function') : 'missing';
    });
    return out;
  });
  ok(r.pkRooms === true, '★④ 大PK 入口绑了处理函数');
  ok(r.pkLadder === true, '★④ 天梯入口绑了处理函数');
  ok(r.pkFriends === true, '★④ 好友入口绑了处理函数');

  const html = fs.readFileSync(path.join(ROOT, 'spelling_pk.html'), 'utf8');
  const names = [...html.matchAll(/(\w+)\s*\)?\.onclick\s*=/g)].map(m => m[1]);
  const cnt = {};
  names.forEach(n => { cnt[n] = (cnt[n] || 0) + 1; });
  const dup = Object.keys(cnt).filter(k => cnt[k] > 1 && !['b', 'btn', 'el'].includes(k));
  ok(dup.length === 0,
     `★④ 没有元素被绑两次 onclick${dup.length ? '（' + dup.join(',') + '）' : ''} —— 后绑的会覆盖先绑的`);
}

/* ── ⑤ 版本号在各处一致 ── */
{
  const files = fs.readdirSync(ROOT).filter(f => /\.(js|html|json)$/.test(f));
  const bad = [];
  for (const f of files) {
    if (f === 'hansen_audio_lock.json' || f === 'package-lock.json') continue;
    let c = '';
    try { c = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
    const m = c.match(/CURRENT_APP_VERSION\s*=\s*(\d+)/);
    if (m && m[1] !== VER) bad.push(`${f}:${m[1]}`);
    const m2 = c.match(/__HBU_VERSION__\s*=\s*['"]v(\d+)/);
    if (m2 && m2[1] !== VER) bad.push(`${f}:${m2[1]}`);
  }
  ok(bad.length === 0,
     `★⑤ 各处版本号都是 v${VER}${bad.length ? '（对不上：' + bad.slice(0, 2).join(' ') + '）' : ''} —— 对不上会让整个 App 无限刷新`);
}

/* ── 全程零脚本错误、零 404 ── */
ok(errs.length === 0, `★ 真实路径零脚本错误${errs.length ? '（' + errs[0] + '）' : ''}`);
{
  const realMissing = missing.filter(f => !/\.mp3$/.test(f));   /* 音频缺失单独有测试管 */
  ok(realMissing.length === 0,
     `★ 没有 404 的脚本/样式${realMissing.length ? '（' + realMissing.slice(0, 2).join(',') + '）' : ''}`);
}

await b.close();
srv.close();

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
