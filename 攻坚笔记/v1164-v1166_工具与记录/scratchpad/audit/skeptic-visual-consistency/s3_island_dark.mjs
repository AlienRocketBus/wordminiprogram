// Dark default theme: VC-07 (cardbook vs gacha counts), VC-05 (tabs/back controls), VC-02/VC-09 (settings pickers + lock overlay),
// VC-06 (showToast placement/duration), VC-04 (spelling bee overlay look)
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, served, external, OUT, saveJson } from './lib.mjs';
const out = { steps: {} };
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
const ISL = process.argv[2] || 'island_animal.html';
const PAL = process.argv[3] || '';
const TAG = (PAL || 'dark');
async function openIsland(page) {
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(1800);
  const t = await tapSel(page, page, `a.island[href="${ISL}"]`);
  if (!t.tapped) throw new Error('island tap failed ' + JSON.stringify(t));
  await waitFor(async () => { const f = page.frames().find(f => f.url().includes(ISL)); if (!f) return null; return await f.evaluate(() => document.readyState === 'complete').catch(() => false); }, 15000);
  await sleep(2200);
  const frame = page.frames().find(f => f.url().includes(ISL));
  const shown = await frame.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show')); });
  if (shown) { await tapText(page, frame, '#alertModal button', '开始冒险'); await sleep(700); }
  return frame;
}
async function navState(frame) {
  return frame.evaluate(() => {
    const nav = document.querySelector('.bottom-nav'); if (!nav) return { nav: 'none' };
    const r = nav.getBoundingClientRect(); const x = r.left + r.width * 0.37, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const hud = document.querySelector('.top-bar'); let hudHit = null;
    if (hud) { const hr = hud.getBoundingClientRect(); const h = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2); hudHit = h ? !!h.closest('.top-bar') : false; }
    return { navVisible: hit ? !!hit.closest('.bottom-nav') : false, hitNav: hit ? (hit.id || hit.className || hit.tagName).toString().slice(0, 60) : null, hudVisible: hudHit, active: Array.from(document.querySelectorAll('.bottom-nav .nav-item.active')).map(e => e.id) };
  });
}
const textOf = (frame, re) => frame.evaluate((src) => { const r = new RegExp(src); return Array.from(document.querySelectorAll('body *')).filter(e => { if (e.children.length > 3) return false; const t = (e.innerText || ''); if (!r.test(t)) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).map(e => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 90)).slice(0, 8); }, re.source);
try {
  const init = PAL ? { fn: (p) => { try { localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('hansen_palette_global', p); } catch (e) { } }, arg: PAL } : { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } };
  const ctx = await newCtx(browser, { dsf: 2, init });
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  let frame = await openIsland(page);
  // A. 卡册 tab
  {
    const t = await tapSel(page, frame, '#navCards'); await sleep(1500);
    out.steps.cards = { tap: t.tapped, nav: await navState(frame), texts: await textOf(frame, /已收集|全部集齐|卡牌大师|已收藏/) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_cards.png` });
    // 神秘殿堂 entry
    const s = await tapText(page, frame, 'button, div[onclick], a, [role="button"]', '神秘殿堂');
    await sleep(1500);
    out.steps.seasonHall = { tap: s.tapped || s.why, texts: await textOf(frame, /已收藏|殿堂/) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_season_hall.png` });
  }
  // A2. second visit: 卡册 again
  frame = await openIsland(page);
  {
    const t = await tapSel(page, frame, '#navCards'); await sleep(1500);
    out.steps.cards2 = { tap: t.tapped, texts: await textOf(frame, /已收集|全部集齐|卡牌大师|已收藏/), ls: await frame.evaluate(() => ({ fp: localStorage.getItem('hansen_freepass_until'), temp: localStorage.getItem('hansen_card_temp_unlock_until') })) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_cards_2ndvisit.png` });
  }
  // B. 抽卡
  frame = await openIsland(page);
  {
    const t = await tapText(page, frame, '.mode-card', '抽卡'); await sleep(1500);
    out.steps.gacha = { tap: t.tapped, texts: await textOf(frame, /已收集/), nav: await navState(frame) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_gacha.png` });
  }
  // C. 错题 tab
  frame = await openIsland(page);
  {
    const t = await tapSel(page, frame, '#navExplore'); await sleep(1200);
    out.steps.wrong = { tap: t.tapped, nav: await navState(frame), overlay: await frame.evaluate(() => { const o = document.getElementById('hwo_overlay'); if (!o) return null; const cs = getComputedStyle(o); const r = o.getBoundingClientRect(); return { pos: cs.position, z: cs.zIndex, top: r.top, bottom: r.bottom, h: r.height }; }), back: await frame.evaluate(() => { const b = document.querySelector('#hwo_overlay .hwo_back'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText, x: r.left, y: r.top, w: r.width, h: r.height }; }) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_wrong.png` });
    await tapSel(page, frame, '#hwo_overlay .hwo_back'); await sleep(600);
    // D. 复习 tab
    const r = await tapSel(page, frame, '#navReview'); await sleep(1500);
    out.steps.review = { tap: r.tapped, nav: await navState(frame), overlays: await frame.evaluate(() => Array.from(document.querySelectorAll('[id^="hr_"]')).filter(o => { const r = o.getBoundingClientRect(); return r.width > 300 && r.height > 500; }).map(o => { const cs = getComputedStyle(o); const r = o.getBoundingClientRect(); return { id: o.id, pos: cs.position, top: r.top, bottom: r.bottom }; })), backBtns: await frame.evaluate(() => Array.from(document.querySelectorAll('[id^="hr_"] button')).filter(b => { const r = b.getBoundingClientRect(); return r.top < 130 && r.width > 0; }).map(b => (b.innerText || '').slice(0, 10))) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_review.png` });
  }
  // E. 我的学习
  frame = await openIsland(page);
  {
    const t = await tapText(page, frame, '.util-card', '我的学习'); await sleep(1300);
    out.steps.mylearning = { tap: t.tapped || t.why, nav: await navState(frame), back: await frame.evaluate(() => { const el = document.getElementById('hsn-ml'); if (!el) return null; const bs = Array.from(el.querySelectorAll('button, [onclick]')).filter(b => { const r = b.getBoundingClientRect(); return r.top < 140 && r.width > 0; }); return bs.map(b => { const r = b.getBoundingClientRect(); return { t: (b.innerText || '').trim().slice(0, 8), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }); }), texts: await textOf(frame, /\d+\s*\/\s*42/) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_mylearning.png` });
  }
  // F. 设置
  frame = await openIsland(page);
  {
    const t = await tapText(page, frame, '.util-card', '设置'); await sleep(1300);
    out.steps.settings = { tap: t.tapped || t.why, headings: await frame.evaluate(() => Array.from(document.querySelectorAll('#settingsScreen h3, #settingsScreen .settings-section > div:first-child, #settingsContent h3')).map(h => (h.innerText || '').replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean).slice(0, 40)) };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_settings_0.png` });
    // scroll to the 主题选择 grid (#themeBox)
    const tb = await frame.evaluate(() => { const b = document.getElementById('themeBox'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const tiles = Array.from(b.children).map(c => { const r = c.getBoundingClientRect(); const ov = Array.from(c.querySelectorAll('*')).find(x => getComputedStyle(x).position === 'absolute' && x.getBoundingClientRect().width >= r.width - 4 && x.getBoundingClientRect().height >= r.height - 4); return { text: (c.innerText || '').replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), fullOverlay: !!ov, ovText: ov ? (ov.innerText || '').replace(/\s+/g, ' ') : null }; }); return tiles; });
    await sleep(400);
    out.steps.settings.themeBox = tb;
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_settings_themebox.png` });
    // find palette and boss theme pickers
    out.steps.settings.pickers = await frame.evaluate(() => { const txt = document.getElementById('settingsScreen') ? document.getElementById('settingsScreen').innerText : document.body.innerText; return ['整体配色', '打Boss主题', 'Boss主题', '主题选择', '樱花粉', '森野绿', '森林绿'].map(k => k + ':' + (txt.split(k).length - 1)); });
  }
  // G. showToast
  {
    await tapSel(page, frame, '.back-btn').catch(() => { }); await sleep(600);
    const msg = '⚠️ 签到账本尚未加载，本次未扣/发任何奖励，请稍后重试';
    const r = [];
    await frame.evaluate((m) => { window.showToast(m); }, msg);
    for (const ms of [100, 300, 600, 900, 1250]) {
      await sleep(ms - (r.length ? [100, 300, 600, 900, 1250][r.length - 1] : 0));
      const s = await frame.evaluate(() => { const e = document.querySelector('.float-text'); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), op: getComputedStyle(e).opacity }; });
      r.push({ ms, s });
      if (ms === 300) await page.screenshot({ path: OUT + `/shots/s3_${TAG}_toast_300ms.png` });
    }
    out.steps.toast = r;
  }
  // H. spelling bee overlay
  frame = await openIsland(page);
  {
    const t = await tapText(page, frame, '.mode-card', 'spelling bee'); await sleep(3000);
    const ov = await frame.evaluate(() => { const o = document.getElementById('hsnSbOverlay'); if (!o) return null; const r = o.getBoundingClientRect(); return { disp: getComputedStyle(o).display, w: r.width, h: r.height }; });
    const sbf = page.frames().find(f => f.url().includes('spelling_bee.html'));
    out.steps.spellbee = { tap: t.tapped, overlay: ov, sbTheme: sbf ? await sbf.evaluate(() => ({ theme: document.body.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundImage.slice(0, 120), font: getComputedStyle(document.body).fontFamily.slice(0, 80), back: (document.querySelector('.sb-back') || {}).innerText })) : 'no frame' };
    await page.screenshot({ path: OUT + `/shots/s3_${TAG}_spellbee.png` });
  }
  await page.close(); await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 40); out.external = external.slice(0, 30);
saveJson(`s3_island_${TAG}.json`, out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1).slice(0, 12000));
