// 每个小游戏：真手指点错 → 揭晓卡是否在最上层可见 → 真手指点卡 → 卡消失、游戏继续
import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const { page, errs } = await openIsland(file);
async function tapExpr(expr) {
  const p = await page.evaluate((expr) => {
    const el = (new Function('return (' + expr + ')'))();
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: !!hit && (hit === el || el.contains(hit)), hitDesc: hit ? (hit.id || hit.className || hit.tagName) : null };
  }, expr);
  if (!p) return { ok: false, why: 'no element' };
  await page.touchscreen.tap(p.x, p.y);
  return p;
}
async function cardState() {
  return page.evaluate(() => {
    const el = document.getElementById('hml_lesson');
    if (!el) return { present: false };
    const card = el.querySelector('.listen-reveal');
    const r = card.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const cs = getComputedStyle(card);
    return { present: true, onTop: !!hit && el.contains(hit), hitDesc: hit ? (hit.id || String(hit.className) || hit.tagName) : null, opacity: cs.opacity, text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) };
  });
}
const GAMES = {
  listen: { start: `startListen(),startListenLevel('easy')`, wrong: `document.querySelectorAll('#listenScreen .boss-opt')[listenQ.opts.findIndex(o=>o.cn!==listenQ.word.cn)]`, ready: `listenQ && !listenQ.answered` },
  cloze: { start: `startCloze(),startClozeLevel('easy')`, wrong: `document.querySelectorAll('#clozeScreen .cloze-opt')[clozeQ.opts.findIndex(o=>o.en!==clozeQ.word.en)]`, ready: `document.querySelector('#clozeScreen .cloze-opt') && !document.querySelector('#clozeScreen .cloze-opt').dataset.done` },
  moles: { start: `startMoles(),startMolesLevel('easy')`, wrong: `[...document.querySelectorAll('[id^="moleSlot"]')].find(s=>s.dataset.en&&molesTarget&&s.dataset.en!==molesTarget.en&&!s.dataset.locked)`, ready: `molesTarget && [...document.querySelectorAll('[id^="moleSlot"]')].some(s=>s.dataset.en===molesTarget.en&&!s.dataset.locked)` },
  fish: { start: `startFish(),startFishLevel('easy')`, wrong: `[...document.querySelectorAll('#fishPond [data-en]')].find(f=>fishTarget&&f.dataset.en!==fishTarget.en&&f.getBoundingClientRect().width>0&&f.getBoundingClientRect().x>20&&f.getBoundingClientRect().right<370)`, ready: `fishTarget && [...document.querySelectorAll('#fishPond [data-en]')].filter(f=>f.dataset.en!==fishTarget.en&&f.getBoundingClientRect().x>20&&f.getBoundingClientRect().right<370).length>0`, wait: 9000 },
  bubble: { start: `startBubble(),startBubbleLevel('easy')`, wrong: `[...document.querySelectorAll('#bbArea .bubble')].find(b=>bubbleTarget&&b.dataset.en!==bubbleTarget.en)`, ready: `bubbleTarget && document.querySelectorAll('#bbArea .bubble').length>1` },
  speed: { start: `startSpeed(),startSpeedLevel('easy')`, wrong: `document.querySelectorAll('#spOpts .boss-opt')[window._spOpts.findIndex(o=>o.en!==window._spCorrect)]`, ready: `document.getElementById('spOpts') && !document.getElementById('spOpts').dataset.done` },
  typing: { start: `startTyping(1)`, wrong: `[...document.querySelectorAll('#typingContent .key')].find(k=>k.textContent===(typeWord.en[0]==='z'?'q':'z'))`, ready: `typeActive && typeWord && document.querySelector('#typingContent .key')`, repeat: `typeWord.en.replace(/ /g,'').length` },
  scramble: { start: `startScramble(),startScrambleLevel('easy')`, wrong: `(function(){var ls=[...document.querySelectorAll('.scramble-letter:not(.used)')];return ls[ls.length-1]})()`, ready: `scrWord && document.querySelector('.scramble-letter')`, repeat: `scrWord.en.replace(/ /g,'').length` },
  eagle: { start: `startEagle(),startEagleLevel('easy')`, wrong: `[...document.querySelectorAll('#eagleGrid .eagle-cell')].find(c=>eagleTarget&&c.textContent!==eagleTarget.en&&!c.dataset.done)`, ready: `eagleTarget && document.querySelectorAll('#eagleGrid .eagle-cell').length>0` },
};
const out = {};
for (const [name, g] of Object.entries(GAMES)) {
  if (only && !only.includes(name)) continue;
  await page.evaluate(`(${g.start})`);
  const ready = await page.evaluate(`__w(()=>(${g.ready}), ${g.wait || 6000})`);
  if (!ready) { out[name] = { error: 'not ready' }; continue; }
  await page.waitForTimeout(300);
  let t = await tapExpr(g.wrong);
  if (g.repeat) { const n = await page.evaluate(`(${g.repeat})`); for (let k = 1; k < n; k++) { await page.waitForTimeout(120); if (await page.evaluate(() => !!document.getElementById('hml_lesson'))) break; t = await tapExpr(g.wrong); } }
  await page.waitForTimeout(450);
  const c1 = await cardState();
  let c2 = null;
  if (c1.present) {
    const tc = await tapExpr(`document.querySelector('#hml_lesson .listen-reveal')`);
    await page.waitForTimeout(500);
    c2 = await cardState();
  }
  out[name] = { tapHit: t.hit, tapHitDesc: t.hitDesc, card: c1, afterTap: c2 && c2.present };
  await page.evaluate(() => { try { showScreen('home'); } catch (e) {} try { stopFish&&stopFish(); } catch (e) {} });
  await page.waitForTimeout(800);
}
console.log(JSON.stringify(out, null, 1));
console.log('errs', errs);
await done();
