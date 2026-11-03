// NET-03 re-check: what happens when a word mp3 can't load (404 / connection drop / offline)?
import { launch, ctxOf, watch, waitSw, tapIsland, waitIsland, start, SNAP, OUT, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const isle = 'island_food.html';
function fr(page) { return page.frames().find(f => f.url().includes(isle)); }
async function run(label, rules, offline, sw = false) {
  const ctx = await ctxOf(browser, { sw });
  await ctx.addInitScript(() => {
    window.__aud = [];
    const P = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const src = (this.currentSrc || this.src || '').replace(location.origin, '');
      const t0 = Date.now();
      if (!/^data:/.test(src)) {
        window.__aud.push({ k: 'play', src });
        this.addEventListener('error', () => window.__aud.push({ k: 'error', src, dt: Date.now() - t0 }), { once: true });
        this.addEventListener('playing', () => window.__aud.push({ k: 'playing', src, dt: Date.now() - t0 }), { once: true });
      }
      return P.apply(this, arguments);
    };
    try { const S = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { if (u && u.text && u.text.trim()) window.__aud.push({ k: 'tts', text: u.text }); return S(u); }; } catch (e) {}
  });
  // the 404 rule is active from the very start (no preloaded copies in HTTP cache)
  srv.cfg.rules = rules;
  const page = await ctx.newPage();
  const ev = []; watch(page, ev, label);
  await page.goto(O + '/', { waitUntil: 'load' });
  if (sw) { await waitSw(page); await sleep(1000); }
  await sleep(1500);
  await tapIsland(page, isle);
  await waitIsland(page, isle, 30000);
  await sleep(2500);
  await fr(page).evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent) && x.offsetParent); if (b) b.click(); });
  await sleep(500);
  if (offline) await ctx.setOffline(true);
  await fr(page).evaluate(() => { window.__aud.length = 0; startListen(); });
  await sleep(400);
  await fr(page).evaluate(() => { startListenLevel(Object.keys(LISTEN_LEVELS)[0]); });
  await sleep(4000);
  const a1 = await fr(page).evaluate(() => ({ aud: window.__aud.splice(0), word: listenQ && listenQ.word && listenQ.word.en }));
  // kid taps the speaker again (real touch)
  const box = await fr(page).evaluate(() => { const s = document.getElementById('listenSpeaker'); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return { x, y, ok: h === s || s.contains(h) }; });
  if (box.ok) await page.touchscreen.tap(box.x, box.y);
  await sleep(4000);
  const a2 = await fr(page).evaluate(() => ({ aud: window.__aud.splice(0), hint: (document.querySelector('.listen-hint') || {}).textContent, toasts: [...document.querySelectorAll('[class*=toast],[id*=toast]')].map(e => e.innerText).filter(Boolean).slice(0, 3) }));
  R[label] = { word: a1.word, autoplay: a1.aud, tapSpeaker: { tapped: box.ok, ...a2 }, errs: ev.filter(e => /pageerror|dialog/.test(e.k)).slice(0, 5) };
  await page.screenshot({ path: OUT + `/s03_${label}.png` });
  await ctx.close();
}
try {
  await run('ok', [], false);
  await run('mp3_404', [{ re: '^/words/.*\\.mp3', status: 404 }], false);
  await run('mp3_drop', [{ re: '^/words/.*\\.mp3', drop: true }], false);
  await run('offline_sw', [], true, true);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s03_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 8000));
