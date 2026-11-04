/* test_pk_back_v1165.mjs —— 拼写大PK 对战中按手机「返回」：不会只删掉画面、留着房间
 *
 * 复查（v1165 第 1 轮 REG-01）：「返回只退一步」的通用关浮层办法，找不到关闭按钮、点空白处也关不掉时，就把浮层整个拿掉（el.remove()）。
 *   对战屏（#hsn_pkroom_screen）没有它认得的关闭按钮 → 一按返回对战屏被删掉，可 HansenPkRoomUI.close() 一步没做：
 *   心跳照跳、房间没退、对手干等，约 15 秒后下一回合又把对战屏画出来。大厅、个人资料也被这样删掉。
 *
 * 合同（首页外壳里的动物岛；history.back() = 手机返回键；对战用测试入口直接开一局，不连云端）：
 *   对战屏有自己的「退出」确认 HansenPkRoomUI.askQuit（复查第 2 轮 R2-02；v1164 对战组的真东西，合并后不再临时装一个）：
 *   ① 对战中按 1 次返回：弹它的「要退出这一局吗？…记一场输」，不 close()：屏还在、局还在、没退房间，岛还开着
 *   ② 再按 1 次 = 点「继续打」：确认框关了，对战还在、没退房间、什么都没记
 *   ③ 再按 → 又弹确认框；孩子自己点「退出」才 close()（停心跳 + 退出房间），之后 6 秒对战屏不会再冒出来，回到房间列表。
 *      两下返回手势绝不会不记输就把一局丢掉。（测试局 roomId='test' 不记战绩 —— 「退出 = 记一场输」由
 *      test_battle_ui_r2_cloud_v1164 ① 用真房间守）
 *   ④ 再按 1 次：关掉房间列表（它自己的「← 返回」），回到拼写大PK 大厅；⑤ 再按 1 次：关掉大厅（用它自己的关闭，不是删掉），岛还开着
 *   ⑥ 一个认不出、也关不掉的全屏浮层：按返回不把它删掉（交给下一步：回首页）
 *   （以前没有 askQuit 的对战屏是「提醒一次、3 秒内再按才 close()」—— 合并后对战屏都有 askQuit，那条路走不到了）
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await ctx.addInitScript(() => { try { if (window.top === window && !sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openIsland === 'function' && document.querySelector('a.island[href="island_animal.html"]'), null, { timeout: 30000 });
  await sleep(800);
  const pt = await page.evaluate(() => { const a = document.querySelector('a.island[href="island_animal.html"]'); a.scrollIntoView({ block: 'center' }); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForFunction(() => { const f = document.getElementById('islandFrame'); try { return /island_animal\.html$/.test(f.contentWindow.location.pathname) && f.contentWindow.HansenPkRoomUI && f.contentWindow.HansenSbPK && f.contentDocument.readyState === 'complete'; } catch (e) { return false; } }, null, { timeout: 30000 });
  await sleep(2500);
  const F = () => page.frames().find(f => /island_animal\.html/.test(f.url()) && f.parentFrame() === page.mainFrame());
  await F().evaluate(() => { try { closeAlert(); } catch (e) {} const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
  await sleep(400);
  const before = await F().evaluate(async () => {
    window.__spy = { stopHeartbeat: 0, leaveRoom: 0, record: 0 };
    try { const R = window.HansenPkRoom; ['stopHeartbeat', 'leaveRoom'].forEach(k => { const o = R[k]; R[k] = function () { window.__spy[k]++; try { return o.apply(this, arguments); } catch (e) {} }; }); } catch (e) {}
    try { const P = window.HansenPkRecord; const o = P.record; P.record = function () { window.__spy.record++; return o.apply(this, arguments); }; } catch (e) {}
    HansenSbPK.open();
    await new Promise(r => setTimeout(r, 400));
    const words = (window.allW || []).slice(0, 5).map(w => ({ en: w.en, cn: w.cn }));
    HansenPkRoomUI._startMatchForTest(words, '测试对手', 'cn', 'race');
    await new Promise(r => setTimeout(r, 700));
    const room = document.getElementById('hsn_pkroom_screen');
    return { roomOn: !!(room && room.classList.contains('on')), state: !!HansenPkRoomUI._stateForTest(), lobbyOn: document.getElementById('hsn_pk_screen').classList.contains('on') };
  });
  ok(before.roomOn && before.state && before.lobbyOn, `开了一局对战（对战屏 ${before.roomOn}、局 ${before.state}、大厅 ${before.lobbyOn}）`);
  const room = () => F().evaluate(() => { const r = document.getElementById('hsn_pkroom_screen'); return { inDom: !!r, on: !!(r && r.classList.contains('on')), state: !!HansenPkRoomUI._stateForTest(), spy: Object.assign({}, window.__spy),
    battle: !!document.getElementById('prQuit'), list: !!(r && r.classList.contains('on') && /公开房间/.test(r.textContent || '')),
    ask: ((document.getElementById('prQuitAsk') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    lobbyInDom: !!document.getElementById('hsn_pk_screen'), lobbyOn: !!(document.getElementById('hsn_pk_screen') && document.getElementById('hsn_pk_screen').classList.contains('on')) }; });
  const wrap = () => page.evaluate(() => document.getElementById('islandFrameWrap').style.display !== 'none');

  console.log('\n▶ ① 对战中按 1 次返回：弹出对战屏自己的「要退出这一局吗？」');
  await page.evaluate(() => history.back()); await sleep(900);
  const r1 = await room();
  console.log('     ' + JSON.stringify(r1));
  ok(/要退出这一局吗/.test(r1.ask) && /记一场输/.test(r1.ask), `弹出它自己的确认框，说清楚退出就记一场输（${r1.ask.slice(0, 40) || '没有弹'}）`);
  ok(r1.inDom && r1.on && r1.state && r1.battle && r1.spy.leaveRoom === 0 && r1.spy.stopHeartbeat === 0, `对战还在：屏还在（${r1.inDom}/${r1.on}）、局还在（${r1.state}）、没退房间（leaveRoom ${r1.spy.leaveRoom} 次、停心跳 ${r1.spy.stopHeartbeat} 次）`);
  ok(await wrap(), '岛还开着');

  console.log('\n▶ ② 再按 1 次 = 「继续打」');
  await page.evaluate(() => history.back()); await sleep(900);
  const r2 = await room();
  console.log('     ' + JSON.stringify(r2));
  ok(!r2.ask && r2.on && r2.state && r2.battle && r2.spy.leaveRoom === 0 && r2.spy.stopHeartbeat === 0 && r2.spy.record === 0,
    `确认框关了（${r2.ask ? '还开着' : '已关'}）、对战还在（屏 ${r2.on}、局 ${r2.state}）、没退房间（leaveRoom ${r2.spy.leaveRoom} 次）、什么都没记（记战绩 ${r2.spy.record} 次）`);
  ok(await wrap(), '岛还开着');

  console.log('\n▶ ③ 再按 → 又弹确认框；孩子点「退出」才真的退出这一局');
  await page.evaluate(() => history.back()); await sleep(900);
  const r3 = await room();
  ok(/要退出这一局吗/.test(r3.ask) && r3.state && r3.spy.leaveRoom === 0 && r3.spy.stopHeartbeat === 0, `又弹确认框、对战还在、还没退房间（局 ${r3.state}、leaveRoom ${r3.spy.leaveRoom} 次）`);
  await F().evaluate(() => document.getElementById('prQuitYes').click()); await sleep(900);
  const r4 = await room();
  console.log('     ' + JSON.stringify(r4));
  ok(!r4.state && !r4.battle && r4.spy.stopHeartbeat >= 1 && r4.spy.leaveRoom >= 1, `点「退出」：走 close() 真的退出了这一局（停心跳 ${r4.spy.stopHeartbeat} 次、退出房间 ${r4.spy.leaveRoom} 次、局清空 ${!r4.state}）`);
  let reappeared = false;
  for (let k = 0; k < 12; k++) { await sleep(500); const x = await room(); if (x.battle || x.state) { reappeared = true; break; } }
  ok(!reappeared, '之后 6 秒对战屏没有再冒出来');
  ok(await wrap() && r4.list, `回到房间列表（${r4.list}），岛还开着`);

  console.log('\n▶ ④ 再按 1 次：关房间列表');
  await page.evaluate(() => history.back()); await sleep(900);
  const r5 = await room();
  ok(!r5.on && r5.lobbyOn, `房间层用它自己的「← 返回」收起（显示着 ${r5.on}），回到拼写大PK 大厅（${r5.lobbyOn}）`);
  ok(await wrap(), '岛还开着');

  console.log('\n▶ ⑤ 再按 1 次：关大厅');
  await page.evaluate(() => history.back()); await sleep(900);
  const r6 = await room();
  ok(r6.lobbyInDom && !r6.lobbyOn, `大厅用它自己的关闭收起（还在页面里 ${r6.lobbyInDom}、显示着 ${r6.lobbyOn}）`);
  ok(await wrap(), '岛还开着');

  console.log('\n▶ ⑥ 认不出、也关不掉的全屏浮层');
  await F().evaluate(() => { const d = document.createElement('div'); d.id = 'xUnknownLayer'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6)'; d.innerHTML = '<p style="color:#fff">一块别的模块的浮层</p>'; document.body.appendChild(d); });
  await sleep(400);
  await page.evaluate(() => history.back()); await sleep(1200);
  const still = await F().evaluate(() => !!document.getElementById('xUnknownLayer')).catch(() => null);
  ok(still === true, `按返回没有把它删掉（还在页面里：${still}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs.slice(0, 2).join(' | ') : ''));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 对战中按返回：先问「要退出这一局吗」、再按是「继续打」、孩子点「退出」才真的退出；不再只删画面');
process.exit(fails ? 1 : 0);
