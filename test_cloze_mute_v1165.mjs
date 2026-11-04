/* test_cloze_mute_v1165.mjs —— 开了「一键静音」，完形填空答对时也不读整句例句；没开静音照旧读
 *
 * 复查（v1165 第 1 轮 G5）：静音模块把「点一下之后 120ms 内」的朗读当成孩子主动要听（hansen_mute 的放行窗口）。
 *   完形答对时，例句是在点击处理里同步读的，正好落在窗口里 → 开着静音照样出声（答错那条走小课，早就延后读、静音了）。
 *
 * 合同（island_animal 完形填空初级，真点正确选项 3 题）：
 *   ① 开了一键静音：这 3 题一次都不出声（录音和机器朗读都不算）
 *   ② 没开静音：每答对一题都把整句例句读一遍（教学价值，不能弄丢）
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
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required'] });

async function play(muted) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(m => {
    try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); if (m) localStorage.setItem('hansen_muted', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    /* 记下每一次真的要出声：录音 play() 和机器朗读 speak() */
    window.__sounds = [];
    const scr = () => { try { return (document.querySelector('.screen.active') || {}).id || ''; } catch (e) { return ''; } };
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { try { window.__sounds.push({ src: String(this.src || '').split('/').pop(), scr: scr() }); } catch (e) {} return P.apply(this, arguments); };
    try { const S0 = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { window.__sounds.push({ tts: u && u.text, scr: scr() }); return S0(u); }; } catch (e) {}
  }, muted);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + 'island_animal.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState !== 'loading' && typeof startCloze === 'function' && typeof window.speak === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { closeAlert(); } catch (e) {} showScreen('home'); });
  await page.waitForTimeout(300);
  await page.locator('#homeScreen .mode-card[onclick="startCloze()"]').first().tap();
  await page.waitForTimeout(400);
  await page.locator('#clozeContent [onclick^="startClozeLevel"]').first().tap();
  const per = [];
  for (let n = 0; n < 3; n++) {
    await page.waitForFunction(() => clozeQ && document.querySelector('#clozeScreen .cloze-opt') && !document.querySelector('#clozeScreen .cloze-opt[data-done]') && !document.getElementById('hml_lesson'), null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const q = await page.evaluate(() => ({ i: clozeQ.opts.findIndex(o => o.en === clozeQ.word.en), ex: clozeQ.word.ex, n: window.__sounds.length }));
    await page.locator('#clozeScreen .cloze-opt').nth(q.i).tap();
    await page.waitForTimeout(1500);
    const got = await page.evaluate(n => window.__sounds.slice(n).filter(s => s.scr === 'clozeScreen'), q.n);
    per.push({ ex: q.ex, sounds: got.map(s => s.src || ('tts:' + s.tts)) });
    await page.waitForFunction(i => !clozeQ || !document.querySelector('#clozeScreen .cloze-opt[data-done]'), null, { timeout: 12000 }).catch(() => {});
  }
  await ctx.close();
  return { per, errs };
}

try {
  console.log('\n▶ ① 开了一键静音');
  const m = await play(true);
  const leaked = m.per.filter(p => p.sounds.length);
  console.log('     ' + JSON.stringify(m.per));
  ok(leaked.length === 0, `答对 3 题，一次都没出声（漏声 ${leaked.length} 题：${leaked.map(p => p.sounds.join('+')).join(' | ') || '无'}）`);
  ok(m.errs.length === 0, '页面无报错 ' + m.errs.join(' | '));
  console.log('\n▶ ② 没开静音');
  const u = await play(false);
  console.log('     ' + JSON.stringify(u.per));
  ok(u.per.every(p => p.sounds.length >= 1), `每答对一题都把整句例句读一遍（${u.per.map(p => p.sounds.length).join(' / ')} 次）`);
  ok(u.errs.length === 0, '页面无报错 ' + u.errs.join(' | '));
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 完形答对：静音时不出声，不静音照旧读例句');
