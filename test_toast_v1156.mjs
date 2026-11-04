#!/usr/bin/env node
const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_toast_v1156.mjs —— 页内提示替代 alert
 *
 * 全站原有 39 处 `alert`。它在手机上有几个实实在在的毛病：
 *   · **会打断输入焦点** —— 关掉弹窗还得再点一次输入框重输
 *   · 微信 / Safari 里样式各不相同，和 App 完全脱节
 *   · 连续弹几次后，有些浏览器会给"阻止此页面再弹窗"的选项，
 *     **用户一旦勾了，之后所有错误提示他都看不到了**
 *
 * 而且其中 5 处是同一句话的变体：「XX 模块未加载，请刷新页面」——
 * **这句话对一个孩子毫无意义**：他不知道什么是"模块"，
 * 不知道为什么刷新能解决，也不一定知道怎么刷新。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = __HSN_ROOT.replace(/\/$/, '');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain' }); r.end('1156'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

console.log('页内提示 v1156\n');

/* ══ 静态判据 ══ */
{
  const src = fs.readFileSync(ROOT + '/hansen_toast_v1156.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/_seen\[msg\]/.test(code),
     '★ **去重要按每条消息各记各的** —— ' +
     '第一版只记"最后一条"，被别的消息一冲就失效：' +
     'bad(A) → good(B) → bad(A)，第三条照样显示');
  ok(/Object\.keys\(_seen\)/.test(code),
     '★ 顺手清过期的，别让去重表无限长大');
  ok(/function notReady/.test(code),
     '★ 有「还没准备好」的专用提示');
  ok(/再试一次/.test(code) && /先不弄了/.test(code),
     '★ **「还没准备好」要给出路** —— ' +
     '光说"没准备好"等于没说，得给一个能点的');
  ok(/pointer-events:none/.test(code),
     '★ **提示不挡操作** —— ' +
     '一个必须点掉才能继续的提示，本身就是个负担');
}

/* ══ 「模块未加载」那 5 处已经换掉 ══ */
{
  for (const f of ['hansen_sb_pk_v1022.js', 'hansen_signup_gate_v1030.js']) {
    const s = fs.readFileSync(ROOT + '/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/alert\('[^']*模块未加载/.test(s),
       `★ ${f} 不再用 alert 说「模块未加载」—— ` +
       '这句话对孩子毫无意义：他不知道什么是"模块"');
    ok(/notReadyOr/.test(s), `★ ${f} 改用说人话的提示`);
  }
}

/* ══ 真浏览器 ══ */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 60)));
  let alerts = 0;
  pg.on('dialog', d => { alerts++; d.dismiss(); });
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4600);

  const r = await pg.evaluate(async () => {
    const T = window.HansenToast;
    if (!T) return { loaded: false };
    const n = () => document.querySelectorAll('#hsnToastHost > div').length;
    T.bad('房间码不对'); T.good('已加为好友'); T.bad('房间码不对'); T.bad('房间码不对');
    await new Promise(r2 => setTimeout(r2, 300));
    const shown = n();
    await new Promise(r2 => setTimeout(r2, 3200));
    const gone = n();
    T.notReady('天梯', function () {});
    await new Promise(r2 => setTimeout(r2, 300));
    const nr = document.getElementById('hsnNotReady');
    return { loaded: true, shown: shown, gone: gone,
             notReadyShown: !!nr,
             hasRetry: !!document.getElementById('hsnNotReadyGo') };
  });

  ok(r.loaded, '★ 提示模块在页面上加载了');
  ok(r.shown === 2,
     '★ **重复的不堆** —— 连点三次同一个按钮，只该看到一条提示');
  ok(r.gone === 0,
     '★ **几秒后自己走** —— 不需要用户点"确定"');
  ok(r.notReadyShown && r.hasRetry,
     '★ 「还没准备好」说人话且给了重试按钮');
  ok(alerts === 0, '★ 整个过程一个 alert 都没弹');
  ok(errs.length === 0, '★ 零脚本错误');
  await ctx.close();
}


/* ── 🔴v1156 ask()：说清楚后果的确认框 ──────────────── */
{
  const t = fs.readFileSync(ROOT + '/hansen_toast_v1156.js', 'utf8');
  ok(/function ask\(o\)/.test(t), '★ 有 ask() 替代 confirm');
  ok(/esc\(o\.yes \|\| '继续'\)/.test(t),
     '★ **按钮上写要干什么，不是「确定/取消」** —— ' +
     'confirm 的两个按钮永远叫确定和取消，' +
     '而用户真正需要知道的是"点了之后会怎样"');
  ok(/o\.danger \? '#991b1b'/.test(t),
     '★ 不可逆的操作把确认键标红');

  const k = fs.readFileSync(ROOT + '/hansen_sb_pk_v1022.js', 'utf8');
  const code = k.replace(/\/\*[\s\S]*?\*\//g, '');
  const body = (key) => {
    const i = code.indexOf(key);
    if (i < 0) return '';
    let d = 0, j = code.indexOf('{', i), m = j;
    while (m < code.length) {
      if (code[m] === '{') d++;
      else if (code[m] === '}') { d--; if (d === 0) break; }
      m++;
    }
    return code.slice(i, m + 1);
  };
  for (const key of ["q('kSwitch').onclick", "q('kOut').onclick"]) {
    ok(/HansenToast\.ask/.test(body(key)), `★ ${key} 用 ask() 而不是裸 confirm`);
  }
  ok(/不会丢/.test(k) && /都还在/.test(k),
     '★ **说清楚"我的进度会不会没"** —— ' +
     '孩子最怕的就是这个，而原文一个字没提：' +
     '只说"切换账号会先退出当前账号，确定吗？"，' +
     '没说进度去哪了，也没说能不能换回来');
}

await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
