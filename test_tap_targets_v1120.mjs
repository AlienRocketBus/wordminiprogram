const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
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

const ROOT = __HSN_ROOT.replace(/\/$/, '');
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

/* 🔴v1161：**先给自己起个名字，否则三个入口都会被身份检查拦住。**

   v1161 起，大PK / 天梯 / 好友三个入口在没名字时会弹起名屏
   （之前是彻底静默，用户报「点了完全没反应」）。
   这个测试量的是**触控目标尺寸**，不是身份流程 ——
   被起名屏挡住就点不到那些按钮，报 30 秒超时。

   > 一个测试被别的功能挡住时，要么把前置条件补上，
   > 要么就是在测两件事 —— 这里选前者。 */
await page.addInitScript(() => {
  try {
    localStorage.setItem('hansen_auth_v1004',
      JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() }));
    localStorage.setItem('hansen_sb_profile_v1002',
      JSON.stringify({ name: '小明', cid: 'C0001' }));
  } catch (e) {}
});
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
  /* v1164：按 id 查（真库就是这样）；房间和座位是两份文档 */
  const t = Date.now();
  const docs = { R1: { _id:'R1', proto:2, kind:'room', seat:0, status:'playing', hostId:'H', guestId:'G',
                       mode:'C', askMode:'cn', wordCount:1, heartbeatAt:t, hostBeat:t, createdAt:t },
                 R1_s0: { _id:'R1_s0', proto:2, kind:'seat', roomId:'R1', epoch:0, guestId:'G', guestBeat:t, createdAt:t } };
  window.HansenPkRoom._setTransportForTest({ read: async id => docs[id] || null,
    patch: async id => ({updated: id === 'R1' ? 1 : 0}), add: async d => ({id: d._id}),
    list: async () => [], listOpen: async () => [], remove: async () => ({deleted:0}) });
  window.HansenPkRoom._setMeForTest({ id:'H', name:'我' });
  window.HansenPkRoomUI._startMatchForTest([{en:'cat',cn:'猫'}], '对手', 'cn', 'C', 'R1');
}));

/* 键盘在各种屏宽下都不能太窄 */
for (const W of [320, 360, 390, 430]) {
  const p2 = await (await b.newContext({ viewport: { width: W, height: 700 } })).newPage();
  await p2.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(3500);
  await p2.evaluate(() => {
    const t = Date.now();
    const docs = { R1: { _id:'R1', proto:2, kind:'room', seat:0, status:'playing', hostId:'H', guestId:'G',
                         mode:'C', askMode:'cn', wordCount:1, heartbeatAt:t, hostBeat:t, createdAt:t },
                   R1_s0: { _id:'R1_s0', proto:2, kind:'seat', roomId:'R1', epoch:0, guestId:'G', guestBeat:t, createdAt:t } };
    window.HansenPkRoom._setTransportForTest({ read: async id => docs[id] || null,
      patch: async id => ({updated: id === 'R1' ? 1 : 0}), add: async d => ({id: d._id}),
      list: async () => [], listOpen: async () => [], remove: async () => ({deleted:0}) });
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
