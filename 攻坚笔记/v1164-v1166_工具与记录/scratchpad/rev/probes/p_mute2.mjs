import { openIsland, done } from './h.mjs';
const { page, errs } = await openIsland('island_animal.html', { seed: { hansen_muted: '1' } });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  window.__plays = [];
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__plays.push('audio:' + String(this.currentSrc || this.src).split('/').pop() + ' @' + new Error().stack.split('\n').slice(2, 5).map(s => s.trim().split(' ')[1]).join('<')); return P.apply(this, arguments); };
  const info = { muted: localStorage.getItem('hansen_muted'), hooked: !!(window.speak && window.speak.__hansenMuteHooked) };
  speak('cat'); await new Promise(r => setTimeout(r, 300));
  info.afterSpeakCat = window.__plays.splice(0);
  startSpeed(); startSpeedLevel('easy'); spTime = 9999; await new Promise(r => setTimeout(r, 500));
  info.afterStart = window.__plays.splice(0);
  return info;
});
console.log(JSON.stringify(r, null, 1));
await done();
