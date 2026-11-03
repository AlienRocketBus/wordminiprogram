import { launch, newCtx, attach, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland, waitSwActive } from './lib.mjs';
// What does a kid hear/see when word audio fails (404 / offline / slow)?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
async function frameEval(page, fn, arg) {
  const f = page.frames().find(fr => /island_food\.html/.test(fr.url()));
  return f.evaluate(fn, arg);
}
async function run(label, rules, offline) {
  const ctx = await newCtx(browser);
  await ctx.addInitScript(() => {
    window.__aud = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const src = (this.currentSrc || this.src || '').replace(location.origin, '');
      const el = this; const t0 = Date.now();
      window.__aud.push({ k: 'play', src, t: t0 });
      el.addEventListener('error', () => window.__aud.push({ k: 'error', src, dt: Date.now() - t0 }), { once: true });
      el.addEventListener('playing', () => window.__aud.push({ k: 'playing', src, dt: Date.now() - t0 }), { once: true });
      return P.apply(this, arguments);
    };
    try {
      const S = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = function (u) { window.__aud.push({ k: 'tts', text: u && u.text, t: Date.now() }); return S(u); };
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const ev = []; attach(page, label, ev);
  srv.cfg.rules = [];
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(page);
  await sleep(2000);
  await openIslandTap(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(2500);
  await frameEval(page, () => { const b = [...document.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent) && x.offsetParent); if (b) b.click(); });
  await sleep(600);
  srv.cfg.rules = rules;
  if (offline) await ctx.setOffline(true);
  // start listening game, easiest level
  await frameEval(page, () => { startListen(); });
  await sleep(500);
  await frameEval(page, () => { const k = Object.keys(LISTEN_LEVELS)[0]; startListenLevel(k); });
  await sleep(7000);
  const res = await frameEval(page, () => ({ aud: window.__aud.slice(), word: listenQ && listenQ.word && listenQ.word.en, hint: (document.querySelector('.listen-hint') || {}).textContent, speakerPlaying: !!(document.getElementById('listenSpeaker') || { classList: { contains: () => false } }).classList.contains('playing'), visibleText: (document.getElementById('listenContent') || {}).innerText.slice(0, 200), wordMap: typeof window.WORD_MAP }));
  await page.screenshot({ path: OUT + `/t4_${label}.png` });
  // explore: tap a word card speaker (speak directly)
  await frameEval(page, () => { window.__aud.length = 0; speak('apple'); });
  await sleep(4000);
  res.speakApple = await frameEval(page, () => window.__aud.slice());
  R[label] = { ...res, events: ev.filter(e => /mp3|pageerror|dialog/.test(e.text + e.kind)).slice(0, 12) };
  await ctx.close();
}
try {
  await run('ok', [], false);
  await run('mp3_404', [{ re: '^/words/.*\\.mp3', status: 404 }], false);
  await run('mp3_slow6s', [{ re: '^/words/.*\\.mp3', delayMs: 6000 }], false);
  await run('offline', [], true);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 1000); }
await browser.close(); srv.server.close();
save('t4_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 15000));
