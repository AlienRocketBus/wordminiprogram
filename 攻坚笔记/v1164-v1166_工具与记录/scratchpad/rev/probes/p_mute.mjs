// 一键静音开着：答错 → 小课卡片 → 点卡片继续 → 下一题的自动朗读有没有真的发出声音
import { openIsland, done } from './h.mjs';
const { page, errs } = await openIsland(process.argv[2] || 'island_animal.html', { seed: { hansen_muted: '1' } });
const r = await page.evaluate(async () => {
  window.__plays = [];
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__plays.push('audio:' + String(this.currentSrc || this.src).split('/').pop()); return P.apply(this, arguments); };
  try { const S0 = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { window.__plays.push('tts:' + (u && u.text)); return S0(u); }; } catch (e) {}
  const out = {};
  for (const g of ['speed', 'typing']) {
    if (g === 'speed') { startSpeed(); startSpeedLevel('easy'); spTime = 9999; await new Promise(r => setTimeout(r, 400)); spAnswer(window._spOpts.findIndex(o => o.en !== window._spCorrect)); }
    else { startTyping(1); await new Promise(r => setTimeout(r, 400)); for (const ch of typeWord.en.toLowerCase()) typeKey(ch === 'z' ? 'q' : 'z'); }
    await __w(__card, 3000);
    await new Promise(r => setTimeout(r, 400));          // 小课自己的重读（200ms 后，静音应吞掉）
    const duringLesson = window.__plays.splice(0);
    __tapCard();                                          // 点卡片继续 → 下一题
    await new Promise(r => setTimeout(r, 700));
    out[g] = { duringLesson, afterTap: window.__plays.splice(0) };
    showScreen('home'); await new Promise(r => setTimeout(r, 300));
  }
  return out;
});
console.log(JSON.stringify(r));
console.log('errs', errs);
await done();
