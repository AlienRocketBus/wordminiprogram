#!/usr/bin/env node
const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_ladder_contrast_v1156.mjs —— 天梯各屏的文字对比度
 *
 * ═══ 为什么要有这个 ═══
 *
 * 手工量出来两处不达标，其中一处**恰恰是最该看清的那一行**：
 *
 *   排行榜里「自己那一行」对比度 3.8（需 4.5）——
 *   半透明紫底把背景提亮了，而文字颜色没跟着变，
 *   于是自己那行成了整个榜上最难读的一行。
 *   而榜的意义就是"我在哪儿"。
 *
 *   对战屏的玩法徽章 2.1 —— 灰字配几乎透明的底，等于没写。
 *
 * 这两处都是**加新东西时顺手写的颜色**，没人量过。
 * 而每加一处新样式就手工量一遍是不现实的 —— 所以做成自动的。
 *
 * ═══ 一条踩过的坑 ═══
 *
 * > **半透明底色的对比度算不准 —— 它取决于底下是什么。**
 * > 要确定的对比度，就用确定的颜色。
 *
 * 中途把徽章改成 `--pk-txt` 配 `rgba(255,255,255,.16)`，
 * 对比度反而从 2.1 掉到 1.2 —— 因为半透明白底叠在深色上几乎不提亮。
 *
 * ═══ 判据 ═══
 *
 * WCAG AA：正常字 ≥4.5，大字（≥24px，或 ≥18.66px 且加粗）≥3.0。
 * 只量**当前可见**的那一层 —— 底下被浮层盖住的元素不算
 * （第一版没做这个过滤，报出一堆主页的假阳性）。
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

console.log('天梯各屏文字对比度 v1156\n');

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('hansen_auth_v1004',
      JSON.stringify({ uid: 'ME', method: 'phone', signedAt: Date.now() }));
  } catch (e) {}
});
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e.message).slice(0, 60)));
await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(4600);

/* 把测量函数装进页面 */
await pg.evaluate(() => {
  window.__contrast = function (sel) {
    const root = document.querySelector(sel);
    if (!root) return [{ t: '(找不到 ' + sel + ')', r: 0, need: 4.5 }];
    const lum = c => {
      const m = (c.match(/[\d.]+/g) || [0, 0, 0]);
      const f = x => { x = x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]);
    };
    const ratio = (fg, bg) => {
      const a = lum(fg), b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const bgOf = el => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
        n = n.parentElement;
      }
      return 'rgb(11,16,32)';
    };
    const bad = [];
    root.querySelectorAll('div,span,button,b,summary,input').forEach(el => {
      if (el.offsetParent === null) return;
      const only = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3;
      const t = only ? (el.textContent || '').trim() : '';
      if (!t || t.length < 2) return;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const r = ratio(cs.color, bgOf(el));
      const big = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700);
      const need = big ? 3.0 : 4.5;
      if (r < need) bad.push({ t: t.slice(0, 14), r: +r.toFixed(1), need: need });
    });
    return bad;
  };
});

async function screen(label, sel, setup, waitFor) {
  await pg.evaluate(setup);
  await pg.waitForTimeout(1700);
  /* v1164：对战屏要等两边都报到（最多 2 秒）才画出来 —— 等它真出来再量，别量到「准备开始」那一屏 */
  if (waitFor) { try { await pg.waitForSelector(waitFor, { timeout: 8000 }); await pg.waitForTimeout(300); } catch (e) {} }
  const bad = await pg.evaluate(s => window.__contrast(s), sel);
  ok(bad.length === 0,
     `★ ${label} 所有文字对比度达标` +
     (bad.length ? ` —— 不达标：${bad.map(x => x.t + ' ' + x.r + '(需' + x.need + ')').join('、')}` : ''));
}

await screen('天梯页', '.ld_wrap', () => {
  const R = window.HansenPkRecord;
  if (R._reset) R._reset();
  for (let i = 0; i < 6; i++) {
    R.record({ mode: 'A', result: i === 2 ? 'lose' : 'win', oppName: '小明',
      myScore: 300, oppScore: 100, words: 5, correct: 5,
      totalMs: 7000, firstWins: 5, fastestMs: 800 });
  }
  window.HansenLadderBoard.fetchTop = async () => ({ ok: true, myRank: 1, list: [
    { rank: 1, uid: 'ME', name: '我', cid: 1, rating: 1108, games: 6 },
    { rank: 2, uid: 'B', name: '阿强', cid: 2, rating: 1000, games: 9 }] });
  window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
  /* v1164：假库按真库的脾气来（按 id 查、没有 claim 这种「改别人文档」的口子） */
  window.HansenPkRoom._setTransportForTest({
    read: async () => null,
    patch: async () => ({ updated: 0 }), add: async d => ({ id: d._id }),
    list: async () => [], remove: async () => ({ deleted: 0 }), listOpen: async () => [] });
  window.HansenLadderUI.open();
});

await screen('对战屏', '.pr_wrap', () => {
  window.HansenLadderUI.close();
  /* v1164：房间 / 座位 / 回合各是各的文档，按 id 查 —— 和真库一样 */
  const t = Date.now();
  const docs = {
    C: { _id: 'C', proto: 2, kind: 'room', seat: 0, status: 'playing', hostId: 'ME', guestId: 'G',
         guestName: '小明', mode: 'A', askMode: 'cn', wordCount: 2, hostBeat: t, heartbeatAt: t, createdAt: t },
    C_s0: { _id: 'C_s0', proto: 2, kind: 'seat', roomId: 'C', epoch: 0, guestId: 'G', guestName: '小明',
            guestBeat: t, createdAt: t }
  };
  window.HansenPkRoom._setTransportForTest({
    read: async id => { docs.C_s0.guestBeat = Date.now(); return docs[id] ? JSON.parse(JSON.stringify(docs[id])) : null; },
    patch: async id => ({ updated: id === 'C' ? 1 : 0 }),
    add: async d => { if (docs[d._id]) throw Object.assign(new Error('dup'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
                      docs[d._id] = JSON.parse(JSON.stringify(d)); return { id: d._id }; },
    list: async () => [], remove: async () => ({ deleted: 0 }), listOpen: async () => [] });
  window.HansenPkRoomUI._startMatchForTest([{ en: 'cat', cn: '猫' }], '小明', 'cn', 'A', 'C');
}, '#prIn');

await screen('房间列表', '.pr_wrap', () => {
  const now = Date.now();
  const rooms = [{ _id: '1', proto: 2, kind: 'room', seat: 0, status: 'open', isPrivate: false, guestId: '', hostId: 'A',
    hostName: '小红', hostRating: 1450, mode: 'A', wordCount: 5,
    heartbeatAt: now, createdAt: now }];
  window.HansenPkRoom._setTransportForTest({
    read: async id => rooms.find(x => x._id === id) || null,
    patch: async () => ({ updated: 0 }),
    add: async d => ({ id: d._id }), list: async () => [], remove: async () => ({ deleted: 0 }),
    listOpen: async () => rooms });
  window.HansenPkRoomUI.open();
});

ok(errs.length === 0, '★ 全程零脚本错误');

await ctx.close();
await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
