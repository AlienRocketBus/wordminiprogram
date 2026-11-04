// EXP3d: double tap on 「取消，回天梯」 (matching screen) — where does the 2nd tap land?
import { setup, sleep, report, H } from './lib.mjs';
const rep = report('EXP3d double tap 取消，回天梯');
const env = await setup({ permissionMode: 'legacy', latencyMs: 120, jitterMs: 60, consistencyLagMs: 300 });
const desc = (p, x, y) => p.eval(([x, y]) => { const e = document.elementFromPoint(x, y); if (!e) return '(none)'; const b = e.closest('button'); return (b ? 'button#' + b.id : e.tagName) + ' 「' + ((b || e).innerText || '').trim().slice(0, 20) + '」'; }, [x, y]);
try {
  const P = await env.phone('甲', { nick: '双击蜂' });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await sleep(600);
  await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 5000 });
  await sleep(2500);
  const c = await P.hitTest('#ldCancel2', { timeout: 3000 });
  await P.page.touchscreen.tap(c.x, c.y);
  await sleep(60);
  const under = await desc(P, c.x, c.y);
  await sleep(40);
  await P.page.touchscreen.tap(c.x, c.y);
  await sleep(1500);
  const s = (await P.screen()).replace(/\s+/g, ' ').slice(0, 60);
  rep.log(`取消 at (${c.x},${c.y}); right after the 1st tap that point is ${under}; after the 2nd tap: ${s}`);
  rep.expect(!/正在找对手/.test(s), 'a double tap on 取消 leaves the kid on the ladder home');
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
