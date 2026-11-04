// EXP3b: where does the 2nd finger of a double tap on 「开始排位」 land once the matching screen is painted?
//        And the reverse: double tap on 「取消，回天梯」.  Also on the island page (390x844 and 360x640).
import { setup, sleep, report, H, census } from './lib.mjs';
const rep = report('EXP3b double tap 开始排位 / 取消');
const env = await setup({ permissionMode: 'legacy', latencyMs: 120, jitterMs: 60, consistencyLagMs: 300 });
const desc = (p, x, y) => p.eval(([x, y]) => { const e = document.elementFromPoint(x, y); if (!e) return '(none)'; const c = []; let n = e; while (n && c.length < 4) { c.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(/\s+/)[0] : '')); n = n.parentElement; } return c.join(' < ') + ' 「' + (e.innerText || '').trim().slice(0, 20) + '」'; }, [x, y]);
try {
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 375, height: 667 }]) {
    const P = await env.phone('甲' + vp.width, { nick: '双击蜂' });
    await P.page.setViewportSize(vp);
    await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
    await sleep(800);
    const h = await P.hitTest('#ldGo', { timeout: 3000 });
    await P.page.touchscreen.tap(h.x, h.y);
    await sleep(60);
    const under = await desc(P, h.x, h.y);
    await sleep(40);
    await P.page.touchscreen.tap(h.x, h.y);       // 2nd finger, ~100 ms after the 1st
    await sleep(1500);
    const s = (await P.screen()).replace(/\s+/g, ' ').slice(0, 60);
    rep.log(`[${vp.width}x${vp.height}] 开始排位 at (${h.x},${h.y}); after the 1st tap that point is ${under}; after the 2nd tap the screen shows: ${s}`);
    rep.expect(/正在找对手/.test(s), `[${vp.width}x${vp.height}] double tap on 开始排位 still ends on the matching screen`);
    if (/正在找对手/.test(s)) {
      const c = await P.hitTest('#ldCancel2', { timeout: 3000 });
      await P.page.touchscreen.tap(c.x, c.y);
      await sleep(60);
      const under2 = await desc(P, c.x, c.y);
      await sleep(60);
      await P.page.touchscreen.tap(c.x, c.y);
      await sleep(1500);
      const s2 = (await P.screen()).replace(/\s+/g, ' ').slice(0, 60);
      rep.log(`[${vp.width}x${vp.height}] 取消 at (${c.x},${c.y}); after the 1st tap that point is ${under2}; after the 2nd tap: ${s2}`);
      rep.expect(!/正在找对手/.test(s2), `[${vp.width}x${vp.height}] double tap on 取消 does not restart matching`);
    }
    await P.close();
  }
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
