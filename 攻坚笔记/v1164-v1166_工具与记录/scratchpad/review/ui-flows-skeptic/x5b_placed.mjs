// UI-5 skeptic b: does 开始排位 sit under 取消，回天梯 for a PLACED kid too (different tier card)?
import { env, sleep, H, report, flat } from './sk.mjs';
const rep = report('UI-5 skeptic b · placed kid');
const E = await env({ latencyMs: 60 });
try {
  const P = await E.phone('孩子', { nick: '老手蜂' });
  await P.eval(() => { localStorage.setItem('hansen_pk_record_v1', JSON.stringify({ rating: 1180, peakRating: 1240, placementGames: 5, wins: 6, losses: 4, words: 50, correct: 40, history: [] })); return 1; });
  await P.tap('#pkLadder'); await P.waitScreen(/开始排位/, { timeout: 8000 }); await sleep(400);
  const g = await P.hitTest('#ldGo');
  await P.tap('#ldGo'); await P.waitScreen(/正在找对手/, { timeout: 4000 });
  const c = await P.hitTest('#ldCancel2');
  const under = await P.eval(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : null; }, [g.x, g.y]);
  rep.log(`placed kid: 开始排位 center (${g.x},${g.y}) h=${g.h}; 取消，回天梯 box center (${c.x},${c.y}) h=${c.h}; on the matching screen the old 开始排位 point is over: ${under}`);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
