import { launch, throttle, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => {
  try { localStorage.setItem('hansen_onboarded','1'); } catch(e){}
  window.__bossInj = [];
  const ap = Node.prototype.appendChild;
  Node.prototype.appendChild = function (c) {
    try { if (c && c.tagName === 'SCRIPT' && /hansen_boss_attack/.test(c.src || '')) window.__bossInj.push({ t: Math.round(performance.now()), stack: new Error().stack.split('\n').slice(1, 9).join(' | '), sc: (document.getElementById('settingsContent') || {}).childNodes ? document.getElementById('settingsContent').childNodes.length : -1, ss: (document.getElementById('settingsScreen')||{}).className }); } catch (e) {}
    return ap.call(this, c);
  };
}});
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + (process.argv[2] || 'island_food.html')); await sleep(8000);
const r = await page.evaluate(() => ({ inj: window.__bossInj, loaded: !!window.__hansenBossFXLoaded, res: performance.getEntriesByType('resource').filter(e => /boss_attack|bosses\/|bossfx/.test(e.name)).map(e => [e.name.replace(location.origin + '/', ''), e.initiatorType, Math.round(e.startTime)]) }));
console.log(JSON.stringify(r, null, 1));
await browser.close();
