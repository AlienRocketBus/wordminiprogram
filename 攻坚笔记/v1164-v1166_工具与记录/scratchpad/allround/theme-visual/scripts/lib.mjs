// Harness for the theme & visual audit (v1163 snapshot). One browser at a time.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
export const TV = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual';
export const SNAP = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
export const PORT = fs.readFileSync(TV + '/out/port.txt', 'utf8').trim();
export const BASE = `http://127.0.0.1:${PORT}/`;
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const WX_UA = 'Mozilla/5.0 (Linux; Android 12; V2118A Build/SP1A.210812.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5235 MMWEBSDK/20230701 MMWEBID/1234 MicroMessenger/8.0.40.2420(0x28002837) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64';
export const PALETTES = ['cosmos','violet','aurora','woods','cloud','sakura','cream','mint'];
export const LIGHT = new Set(['cloud','sakura','cream','mint']);

let _browser = null;
export async function browser() {
  if (!_browser) _browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  return _browser;
}
export async function closeBrowser() { if (_browser) { await _browser.close(); _browser = null; } }

/* preset: {palette, coinTheme, dia, bossTheme, sbTheme, coins, extra:{k:v}, reducedMotion} */
export async function newCtx(preset = {}, opts = {}) {
  const b = await browser();
  const ctx = await b.newContext({
    viewport: { width: opts.width || 390, height: opts.height || 844 }, deviceScaleFactor: opts.dpr || 2,
    isMobile: true, hasTouch: true, userAgent: WX_UA, serviceWorkers: 'block', locale: 'zh-CN',
    reducedMotion: preset.reducedMotion ? 'reduce' : 'no-preference',
  });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  await ctx.addInitScript((p) => {
    try {
      if (sessionStorage.getItem('__tv_init')) return;
      sessionStorage.setItem('__tv_init', '1');
      localStorage.setItem('hansen_onboarded', '1');
      if (p.palette && p.palette !== 'cosmos') localStorage.setItem('hansen_palette_global', p.palette); else localStorage.removeItem('hansen_palette_global');
      if (p.coinTheme) { localStorage.setItem('theme', p.coinTheme); localStorage.setItem('hansen_unlocked_themes', JSON.stringify(['forest','ocean','peach','rainbow'])); }
      if (p.dia) localStorage.setItem('hansen_diamond_shop', JSON.stringify({ owned: { [p.dia]: true }, equipped: p.dia }));
      if (p.bossTheme) localStorage.setItem('hansen_boss_theme', p.bossTheme);
      if (p.sbTheme) localStorage.setItem('hansen_sb_theme', p.sbTheme);
      if (p.extra) for (const k in p.extra) localStorage.setItem(k, p.extra[k]);
    } catch (e) {}
  }, preset);
  return ctx;
}
export async function openPage(ctx, url, wait = 3500) {
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  pg.on('dialog', async d => { errs.push('DIALOG(' + d.type() + '): ' + d.message().slice(0, 120)); try { await d.dismiss(); } catch (e) {} });
  await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(wait);
  pg.__errs = errs;
  return pg;
}
export async function shot(pg, name, o = {}) {
  const file = TV + '/shots/' + name + '.png';
  await pg.screenshot({ path: file, fullPage: !!o.full, animations: o.freeze ? 'disabled' : 'allow' });
  return file;
}
export async function tapText(pg, re, scope = 'body') {
  const p = await pg.evaluate(([src, scope]) => {
    const re = new RegExp(src);
    const root = document.querySelector(scope) || document.body;
    const els = [...root.querySelectorAll('[onclick], button, a, .d-card, .util-card, .mode-card, [role=button]')]
      .filter(e => e.offsetParent !== null && re.test((e.innerText || '').trim()));
    els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    const el = els[0]; if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: (el.innerText || '').slice(0, 30) };
  }, [re.source, scope]);
  if (!p) return null;
  await sleep(250);
  await pg.touchscreen.tap(p.x, p.y);
  return p;
}
export function save(name, obj) { fs.writeFileSync(TV + '/out/' + name + '.json', JSON.stringify(obj, null, 1)); }
