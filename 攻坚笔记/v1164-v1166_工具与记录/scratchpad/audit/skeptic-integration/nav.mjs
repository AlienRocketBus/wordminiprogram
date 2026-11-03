import { sleep, tap } from './kit.mjs';
export async function islandState(page) {
  return page.evaluate(() => {
    const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
    let p = ''; try { p = f.contentWindow.location.pathname.split('/').pop() + f.contentWindow.location.search; } catch (e) { p = 'ERR'; }
    let rs = ''; try { rs = f.contentDocument.readyState; } catch (e) {}
    return { wrap: w.style.display, op: f.style.opacity, path: p, rs, hist: history.length, state: JSON.stringify(history.state), scrollY: Math.round(scrollY) };
  });
}
export async function waitVisible(page, file, t0, timeout = 15000) {
  while (Date.now() - t0 < timeout) {
    const s = await islandState(page);
    if (s.wrap === 'block' && s.op === '1' && s.path.split('?')[0] === file) return { ms: Date.now() - t0, s };
    await sleep(25);
  }
  return { ms: -1, s: await islandState(page) };
}
export async function waitHidden(page, t0, timeout = 8000) {
  while (Date.now() - t0 < timeout) {
    const s = await islandState(page);
    if (s.wrap === 'none') return { ms: Date.now() - t0, s };
    await sleep(15);
  }
  return { ms: -1, s: await islandState(page) };
}
export async function frameOf(page) { const h = await page.$('#islandFrame'); return h.contentFrame(); }
export async function dismissWelcome(page, timeout = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const fr = await frameOf(page);
    try {
      const shown = await fr.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show') && /开始冒险/.test(m.textContent)); });
      if (shown) {
        const btn = await fr.$('#alertModal button.game-btn');
        const r = await tap(page, fr, btn);
        await sleep(300);
        return { dismissed: true, r };
      }
    } catch (e) {}
    await sleep(100);
  }
  return { dismissed: false };
}
export async function tapMap(page) {
  const fr = await frameOf(page);
  return tap(page, fr, 'a.world-map-btn');
}
export async function freshHome(K, page, path = 'index.html') {
  await page.goto(K.base + path, { waitUntil: 'load' });
  // skip onboarding
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const h = await page.$('button[aria-label="跳过新手引导"]');
    if (h && await h.isVisible()) { const r = await tap(page, page, h); await sleep(300); return { skipped: true, r }; }
    await sleep(150);
  }
  return { skipped: false };
}
