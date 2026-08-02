/* test_tap_targets_v1120.mjs —— 点击目标必须够大
 *
 * 🔴 这条我**犯了两次**：
 *   v1112  关闭按钮只有 27×31px  → 改成 44×44
 *   v1119  320px 下键盘最窄键 24px → 改成 ≥27px
 *
 * 「点击目标要够大」这条我知道，但**换个地方就忘了** ——
 * 说明它不该靠记性，该靠机器盯。
 *
 * 判据：**320px 老手机**下扫全部界面，任何可点击元素
 * 的宽高都不得小于 27px。
 *
 * 为什么是 27 而不是苹果的 44：
 *   键盘上 10 个键并排，320px 屏幕物理上放不下 10×44。
 *   27px 是"手指能稳定点中"的下限（约 5mm），
 *   而单独的按钮（关闭、提交这类）仍按 44px 要求。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/work/repo';
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg',
  '.svg':'image/svg+xml','.ico':'image/x-icon' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('点击目标尺寸 v1120');

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, {'content-type':'text/plain'}); r.end('1120'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, {'content-type': MIME[path.extname(p)] || 'application/octet-stream'}); r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
/* 320px：还在用的最小主流屏幕。大屏上没问题不代表小屏上没问题 —— v1119 就栽在这 */
const page = await (await b.newContext({ viewport: { width: 320, height: 568 } })).newPage();
await page.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);

const SCAN = () => {
  const bad = [];
  document.querySelectorAll('button,a[href],[onclick],input[type=button]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (r.height < 27 || r.width < 27) {
      bad.push({ t: (el.textContent || '').trim().slice(0, 10) || el.id || String(el.className).slice(0, 14),
                 w: Math.round(r.width), h: Math.round(r.height) });
    }
  });
  return bad;
};

async function check(name, prep) {
  if (prep) await prep();
  await page.waitForTimeout(1200);
  const bad = await page.evaluate(SCAN);
  ok(bad.length === 0,
     `★ ${name}：所有点击目标 ≥27px${bad.length ? '（不合格 ' + JSON.stringify(bad.slice(0, 3)) + '）' : ''}`);
}

await check('PK 主页');
await check('天梯页', () => page.click('#pkLadder'));
await page.evaluate(() => { if (window.HansenLadderUI) HansenLadderUI.close(); });
await check('好友页', () => page.click('#pkFriends'));
await page.evaluate(() => { if (window.HansenFriendsUI) HansenFriendsUI.close(); });
await check('对战屏', () => page.evaluate(() => {
  const doc = { _id:'R1', hostId:'H', guestId:'G', mode:'C', askMode:'cn',
                round:0, winners:[], wordCount:1 };
  window.HansenPkRoom._setTransportForTest({ read: async () => doc, claim: async () => ({updated:1}),
    patch: async () => ({updated:1}), add: async () => ({id:'R1'}),
    list: async () => [], listOpen: async () => [], remove: async () => ({}) });
  window.HansenPkRoom._setMeForTest({ id:'H', name:'我' });
  window.HansenPkRoomUI._startMatchForTest([{en:'cat',cn:'猫'}], '对手', 'cn', 'C', 'R1');
}));

/* 键盘在各种屏宽下都不能太窄 */
for (const W of [320, 360, 390, 430]) {
  const p2 = await (await b.newContext({ viewport: { width: W, height: 700 } })).newPage();
  await p2.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3500);
  await p2.evaluate(() => {
    const doc = { _id:'R1', hostId:'H', guestId:'G', mode:'C', askMode:'cn',
                  round:0, winners:[], wordCount:1 };
    window.HansenPkRoom._setTransportForTest({ read: async () => doc, claim: async () => ({updated:1}),
      patch: async () => ({updated:1}), add: async () => ({id:'R1'}),
      list: async () => [], listOpen: async () => [], remove: async () => ({}) });
    window.HansenPkRoom._setMeForTest({ id:'H', name:'我' });
    window.HansenPkRoomUI._startMatchForTest([{en:'cat',cn:'猫'}], '对手', 'cn', 'C', 'R1');
  });
  await p2.waitForTimeout(900);
  const r = await p2.evaluate((W) => {
    const ks = [...document.querySelectorAll('.pr_key')].map(k => k.getBoundingClientRect().width);
    const rows = [...document.querySelectorAll('.pr_kbrow')].map(x => x.getBoundingClientRect().width);
    return { min: Math.round(Math.min(...ks)), over: Math.max(...rows) > W + 1 };
  }, W);
  ok(r.min >= 27 && !r.over, `★ ${W}px 屏：键宽 ${r.min}px 且不溢出`);
  await p2.close();
}

await b.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
