// Boss 答错：反击特效(z 9990~9999)和揭晓卡(z 9990)在时间上是否重叠、谁盖谁
import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const lvs = (process.argv[3] || '1,6,12,20').split(',').map(Number);
const { page, errs } = await openIsland(file);
await page.evaluate(() => window.__hansenBossFXReady && window.__hansenBossFXReady());
await page.waitForFunction(() => window.__hansenBossFXLoaded, null, { timeout: 30000 }).catch(() => {});
const res = {};
for (const lv of lvs) {
  await page.evaluate((lv) => { showScreen('boss'); hansenStartRebattle(lv); }, lv);
  const ok = await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0 && !document.getElementById('bossOpts').dataset.done, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!ok) { res[lv] = 'no fight'; continue; }
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__fxlog = []; const c = window._bossCorrectIdx; const n = document.querySelectorAll('#bossOpts .boss-opt').length; bossAnswer((c + 1) % n); const t0 = performance.now();
    (function tick() {
      const t = Math.round(performance.now() - t0);
      const card = document.getElementById('hml_lesson');
      const cr = card ? card.querySelector('.listen-reveal').getBoundingClientRect() : null;
      let over = 0, names = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (card && card.contains(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
        const z = parseInt(cs.zIndex, 10); if (!(z >= 9990)) continue;
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
        if (cr && (r.right < cr.left || r.left > cr.right || r.bottom < cr.top || r.top > cr.bottom)) continue;
        over++; if (names.length < 3) names.push((el.id || String(el.className).slice(0, 18) || el.tagName) + '@' + z);
      }
      window.__fxlog.push({ t, card: !!card, fx: over, names });
      if (t < 4200) setTimeout(tick, 150);
    })();
  });
  await page.waitForTimeout(4600);
  const log = await page.evaluate(() => window.__fxlog);
  const overlap = log.filter(x => x.card && x.fx > 0);
  const fxEnd = Math.max(0, ...log.filter(x => x.fx > 0).map(x => x.t));
  const cardStart = (log.find(x => x.card) || {}).t;
  res[lv] = { fxLastSeenMs: fxEnd, cardFromMs: cardStart, overlapSamples: overlap.length, sample: overlap.slice(0, 3) };
  await page.evaluate(() => { try { stopBoss(); } catch (e) {} showScreen('home'); });
  await page.waitForTimeout(500);
}
console.log(JSON.stringify(res, null, 1));
console.log('errs', errs);
await done();
