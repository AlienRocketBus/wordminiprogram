// Frame-aware touch helpers for the index.html shell (island runs inside #islandFrame).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function islandFrame(page) {
  return page.frames().find((f) => /island_[a-z0-9]+\.html/.test(f.url())) || null;
}
/* hit-test + tap an element inside a frame, with the iframe's offset added */
export async function ftap(page, frame, sel, { timeout = 10000, hasText } = {}) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeout) {
    const r = await frame.evaluate(([sel, hasText]) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
        .filter((e) => !hasText || (e.innerText || '').includes(hasText));
      const el = els[0];
      if (!el) return { ok: false, why: 'not visible' };
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      const b = el.getBoundingClientRect();
      const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
      const hit = document.elementFromPoint(x, y);
      const desc = (e) => { const c = []; while (e && c.length < 5) { c.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')); e = e.parentElement; } return c.join(' < '); };
      return { ok: !!hit && (hit === el || el.contains(hit)), x, y, hit: hit ? desc(hit) : '(none)' };
    }, [sel, hasText || '']).catch((e) => ({ ok: false, why: String(e.message || e).slice(0, 120) }));
    if (r.ok) {
      const fe = await frame.frameElement();
      const box = await fe.boundingBox();
      await page.touchscreen.tap(Math.round(box.x + r.x), Math.round(box.y + r.y));
      return r;
    }
    last = r.why || ('covered by ' + r.hit);
    await sleep(250);
  }
  throw new Error(`frame tap ${sel} failed: ${last}`);
}
/* topmost fixed layer text inside the frame (what the kid sees there) */
export async function fscreen(frame) {
  return frame.evaluate(() => {
    const pts = [[innerWidth / 2, innerHeight / 2], [innerWidth / 2, 90], [innerWidth / 2, innerHeight - 90]];
    const seen = new Set(), out = [];
    for (const [x, y] of pts) {
      let e = document.elementFromPoint(x, y), layer = null;
      while (e && e !== document.body && e !== document.documentElement) { if (getComputedStyle(e).position === 'fixed') layer = e; e = e.parentElement; }
      layer = layer || document.body;
      if (!seen.has(layer)) { seen.add(layer); out.push(layer.innerText || ''); }
    }
    return out.join('\n');
  }).catch((e) => '(frame gone: ' + String(e.message || e).slice(0, 60) + ')');
}
export async function fwait(frame, re, timeout = 15000) {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < timeout) { last = await fscreen(frame); if (re.test(last)) return last; await sleep(250); }
  throw Object.assign(new Error(`frame: no ${re} in ${timeout} ms; last: ${last.replace(/\s+/g, ' ').slice(0, 200)}`), { last });
}
