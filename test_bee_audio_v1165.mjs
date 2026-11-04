/* test_bee_audio_v1165.mjs —— 拼写蜂念的单词录音和岛上是同一个文件；星海终战不再 404 退成机器音
 *
 * 事故（v1163 审计 P2-05、内容校对 CQ-15）：spelling_bee.html 的 speak() 只给 land1-8 的词加 _season 后缀，
 *   星海终战（isl=season）的词去要 words/calm.mp3 —— 不存在（404），只好退成手机朗读；
 *   而且不看岛自己的录音表 __ISLAND_LOCAL_AUDIO：cook / turn / have / stop … 14 个词播的是另一段录音。
 *
 * 合同：从 island_season / island_land3 / island_food / island_action 打开拼写蜂，各念 10 个本岛的词：
 *   /words/ 下 0 个 ≥400 的响应；文件存在就不调 speechSynthesis.speak；动作岛的 cook 要的是岛上的 words/cook_action.mp3
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });

try {
  for (const [file, key, probe] of [['island_season.html', 'season', null], ['island_land3.html', 'land3', null], ['island_food.html', 'food', null], ['island_action.html', 'action', ['cook', 'words/cook_action.mp3']]]) {
    console.log(`\n▶ ${file} 里的拼写蜂`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
      window.__tts = [];
      try { if (window.speechSynthesis) { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { try { if (u && String(u.text || '').trim()) window.__tts.push(u.text); } catch (e) {} return sp(u); }; } } catch (e) {}
    });
    const page = await ctx.newPage();
    const bad = [], wordReqs = [];
    page.on('response', r => { const u = r.url(); if (/\/words\//.test(u)) { wordReqs.push(u.replace(BASE, '').split('?')[0]); if (r.status() >= 400) bad.push(r.status() + ' ' + u.replace(BASE, '')); } });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(BASE + file, { waitUntil: 'load' });
    await page.waitForFunction(() => window.HansenSpellBee && window.S, null, { timeout: 30000 });
    await sleep(1200);
    await page.evaluate(() => { const b = document.querySelector('#alertModal.show .game-btn.gold'); if (b) b.click(); });
    await page.evaluate(k => HansenSpellBee.open(k), key);
    const bee = await (async () => { for (let i = 0; i < 100; i++) { const f = page.frames().find(f => /spelling_bee\.html/.test(f.url())); if (f) { try { await f.waitForFunction(() => typeof speak === 'function' && Array.isArray(WORDS) && WORDS.length > 0, null, { timeout: 500 }); return f; } catch (e) {} } await sleep(200); } return null; })();
    ok(!!bee, '拼写蜂打开了');
    if (!bee) { await ctx.close(); continue; }
    wordReqs.length = 0; bad.length = 0;
    const said = await bee.evaluate(async probe => {
      const list = WORDS.slice(0, 10);
      if (probe) { const w = WORDS.find(x => x.en.toLowerCase() === probe[0]); if (w) list.unshift(w); }
      const out = [];
      for (const w of list) {
        curWord = w; speak(w.en); out.push(w.en);
        await new Promise(r => setTimeout(r, 450));
      }
      return out;
    }, probe);
    await sleep(1500);
    const tts = await bee.evaluate(() => window.__tts.slice());
    ok(said.length >= 10, `念了 ${said.length} 个本岛的词（${said.slice(0, 4).join(', ')}…）`);
    ok(bad.length === 0, `/words/ 下没有出错的响应（${bad.slice(0, 3).join(' | ') || '无'}）`);
    ok(tts.length === 0, `文件都在，一次手机朗读都没用（${tts.slice(0, 3).join(', ') || '无'}）`);
    if (probe) ok(wordReqs.includes(probe[1]), `${probe[0]} 要的是岛上的 ${probe[1]}（实际：${wordReqs.filter(u => /cook/.test(u)).join(', ') || '没要'}）`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 拼写蜂念的录音和岛上一致、不再 404');
process.exit(fails ? 1 : 0);
