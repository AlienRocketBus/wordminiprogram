// UI-5 skeptic: a real double tap (two touch taps GAP ms apart at the same point) on 开始排位 and on 取消，回天梯.
import { env, sleep, H, report, flat } from './sk.mjs';
const GAP = Number(process.argv[2] || 150);
const VW = (process.argv[3] || '390x844').split('x').map(Number);
const rep = report(`UI-5 skeptic · double tap gap ${GAP} ms · viewport ${VW.join('x')}`);
const E = await env({ latencyMs: 60, jitterMs: 30 });
try {
  const P = await E.phone('孩子', { nick: '双击蜂', viewport: { width: VW[0], height: VW[1] } });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 });
  await sleep(500);
  const h = await P.hitTest('#ldGo');
  rep.log(`开始排位 at (${h.x},${h.y}) ${h.w}x${h.h}`);
  await P.page.touchscreen.tap(h.x, h.y);
  const under = await P.eval(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' 「' + (e.innerText || '').trim().slice(0, 20) + '」') : null; }, [h.x, h.y]);
  await sleep(Math.max(0, GAP - 20));
  await P.page.touchscreen.tap(h.x, h.y);
  rep.log('right after the 1st tap the finger point is over:', under);
  await sleep(1500);
  rep.log('after the double tap the kid sees:', flat(await P.screen(), 120));
  const run = await P.eval(() => window.HansenLadderUI._runForTest());
  rep.log('matching run alive:', JSON.stringify(run));
  // now start matching with a single tap and double-tap 取消，回天梯
  await P.waitScreen(/开始排位/, { timeout: 4000 });
  await P.tap('#ldGo');
  await P.waitScreen(/正在找对手/, { timeout: 4000 });
  await sleep(1200);
  const c = await P.hitTest('#ldCancel2');
  rep.log(`取消，回天梯 at (${c.x},${c.y})`);
  await P.page.touchscreen.tap(c.x, c.y);
  const under2 = await P.eval(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' 「' + (e.innerText || '').trim().slice(0, 20) + '」') : null; }, [c.x, c.y]);
  await sleep(Math.max(0, GAP - 20));
  await P.page.touchscreen.tap(c.x, c.y);
  rep.log('right after the 1st tap the finger point is over:', under2);
  await sleep(1500);
  rep.log('after double-tapping 取消 the kid sees:', flat(await P.screen(), 120));
  rep.log('matching run alive:', JSON.stringify(await P.eval(() => window.HansenLadderUI._runForTest())));
  rep.log('errors', P.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
