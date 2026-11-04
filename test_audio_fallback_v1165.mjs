/* test_audio_fallback_v1165.mjs —— 单词/例句录音没加载出来时，用手机朗读兜底（只读一次、不联网、静音时不出声）
 *
 * v1163：岛里的单词和例句先放本地录音（words/*.mp3）。录音出错时只是悄悄「当它读完了」，
 *        孩子在听音辨义里什么都听不到，也不知道为什么。
 *
 * 合同：
 *   ① 录音 404：自动朗读、点 🔊 各让手机朗读正好一次（读的就是这个词）
 *   ② 例句录音 404：答对完形后读例句 → 手机朗读这一句，正好一次
 *   ③ 录音正常：手机朗读一次都不用
 *   ④ 开着「一键静音」：自动朗读一点声音都没有
 *   ⑤ 全程不去 gstatic / baidu / youdao 联网找发音
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const online = [];

async function makeCtx({ audio404, muted }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.addInitScript(([muted]) => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hsn_season_prologue_seen', '1'); if (muted) localStorage.setItem('hansen_muted', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    window.__tts = []; window.__plays = [];
    // 第一次点屏幕时页面会放一段静音的 data: 音频、读一个空格来「解锁」声音——那不算出声，不记
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { const s = String(this.src || ''); if (!/^data:/.test(s)) window.__plays.push(s.split('/').slice(-2).join('/')); } catch (e) {} return P.apply(this, arguments); };
    try { const S0 = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { if (u && String(u.text || '').trim()) window.__tts.push(u.text); return S0(u); }; } catch (e) {}
  }, [!!muted]);
  // 录音文件「没下载下来」
  if (audio404) await ctx.route(/\/(words|sentences)\/[^?]*\.mp3/, r => r.fulfill({ status: 404, body: '' }));
  // 记下所有去在线发音的请求（不许有）
  await ctx.route(/gstatic\.com|baidu\.com|youdao\.com/, r => { online.push(r.request().url().slice(0, 90)); r.abort(); });
  return ctx;
}
async function open(ctx, file) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startListen === 'function' && typeof speak === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} window.__tts.length = 0; window.__plays.length = 0; });
  return { page, errs };
}
// 真点「听音辨义 → 初级」：第一题会自动读一遍
async function startListenEasy(page) {
  await page.locator('#homeScreen .mode-card[onclick="startListen()"]').first().tap();
  await page.waitForTimeout(300);
  await page.locator('#listenContent [onclick^="startListenLevel"]', { hasText: '初级' }).first().tap();
  await page.waitForTimeout(3200);
  return page.evaluate(() => ({ word: listenQ.word.en, tts: window.__tts.slice(), plays: window.__plays.slice() }));
}

try {
  // ① 录音 404：自动朗读 + 点 🔊
  console.log('\n▶ ① 单词录音没下载下来（island_body）');
  {
    const ctx = await makeCtx({ audio404: true });
    const { page, errs } = await open(ctx, 'island_body.html');
    const a = await startListenEasy(page);
    ok(a.plays.some(p => /^words\//.test(p)), '① 先试了本地录音 ' + JSON.stringify(a.plays));
    ok(a.tts.length === 1 && a.tts[0] === a.word, `① 自动朗读：手机朗读正好一次、读的是「${a.word}」 ` + JSON.stringify(a.tts));
    await page.evaluate(() => { window.__tts.length = 0; });
    await page.locator('#listenSpeaker').tap();
    await page.waitForTimeout(3200);
    const b = await page.evaluate(() => window.__tts.slice());
    ok(b.length === 1 && b[0] === a.word, '① 点 🔊：手机朗读正好一次 ' + JSON.stringify(b));
    ok(errs.length === 0, '① 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  // ② 例句录音 404：完形答对后读例句
  console.log('\n▶ ② 例句录音没下载下来（island_season 完形填空）');
  {
    const ctx = await makeCtx({ audio404: true });
    const { page, errs } = await open(ctx, 'island_season.html');
    await page.evaluate(() => showScreen('home'));
    await page.locator('#homeScreen .mode-card[onclick="startCloze()"]').first().tap();
    await page.waitForTimeout(300);
    await page.locator('#clozeContent [onclick^="startClozeLevel"]', { hasText: '初级' }).first().tap();
    await page.waitForTimeout(600);
    const q = await page.evaluate(() => { window.__tts.length = 0; window.__plays.length = 0; const ex = clozeQ.word.ex; const k = ex.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); return { ex, hasRec: !!(window.__HANSEN_EX_AUDIO && window.__HANSEN_EX_AUDIO[k]), i: clozeQ.opts.findIndex(o => o.en === clozeQ.word.en) }; });
    await page.locator('#clozeScreen .cloze-opt').nth(q.i).tap();
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => ({ tts: window.__tts.slice(), plays: window.__plays.slice() }));
    ok(q.hasRec && r.plays.some(p => /_ex_season\.mp3/.test(p)), '② 先试了这句例句的本地录音 ' + JSON.stringify(r.plays));
    ok(r.tts.filter(t => t === q.ex).length === 1, `② 手机朗读了这句例句、正好一次「${q.ex}」 ` + JSON.stringify(r.tts));
    ok(errs.length === 0, '② 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  // ③ 录音正常：不用手机朗读
  console.log('\n▶ ③ 录音正常（island_body）');
  {
    const ctx = await makeCtx({ audio404: false });
    const { page, errs } = await open(ctx, 'island_body.html');
    const a = await startListenEasy(page);
    await page.locator('#listenSpeaker').tap();
    await page.waitForTimeout(3000);
    const b = await page.evaluate(() => ({ tts: window.__tts.slice(), plays: window.__plays.slice() }));
    ok(b.plays.filter(p => /^words\//.test(p)).length >= 2 && b.tts.length === 0, '③ 自动朗读和点 🔊 都放本地录音，手机朗读 0 次 ' + JSON.stringify(b));
    ok(errs.length === 0, '③ 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  // ④ 一键静音 + 录音 404：自动朗读一点声音都没有
  console.log('\n▶ ④ 一键静音（island_body，录音也没下载下来）');
  {
    const ctx = await makeCtx({ audio404: true, muted: true });
    const { page, errs } = await open(ctx, 'island_body.html');
    const a = await startListenEasy(page);
    ok(a.tts.length === 0 && a.plays.length === 0, '④ 静音时自动朗读：不放录音、也不用手机朗读 ' + JSON.stringify(a));
    ok(errs.length === 0, '④ 页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  ok(online.length === 0, '⑤ 全程没有去 gstatic / baidu / youdao 联网找发音 ' + JSON.stringify(online.slice(0, 5)));
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 录音没下载下来时用手机朗读兜底：只读一次、不联网、静音时不出声');
