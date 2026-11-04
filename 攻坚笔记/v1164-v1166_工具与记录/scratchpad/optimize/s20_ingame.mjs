import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const fn = fs.readFileSync(O + '/boxes_fn.js', 'utf8');
const { browser, ctx } = await launch({ init: `try{localStorage.setItem('hansen_onboarded','1');}catch(e){}\n` + fn });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
const modes = [['typing','showTypingMenu()'],['cloze','startCloze()'],['scramble','startScramble()'],['moles','startMoles()'],['fish','startFish()'],['bubble','startBubble()'],['speed','startSpeed()'],['eagle','startEagle()']];
const res = [];
for (const [name, call] of modes) {
  await page.goto(BASE + 'island_animal.html'); await sleep(2500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(500);
  await page.evaluate(c => eval(c), call); await sleep(1000);
  const started = await page.evaluate(() => { const c = [...document.querySelectorAll('[onclick]')].filter(e => e.offsetParent && /初级/.test(e.innerText || '') && e.getBoundingClientRect().height > 50); if (!c.length) return false; c[0].click(); return c[0].getAttribute('onclick'); });
  await sleep(2200);
  await page.screenshot({ path: `${O}/shots/s20_${name}.png` });
  const audit = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none'; };
    const ctrls = [...document.querySelectorAll('button, [onclick], [role=button], input')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t && (t === el || el.contains(t)); }).map(el => { const r = el.getBoundingClientRect(); return { t: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; });
    const small = ctrls.filter(c => c.w < 44 || c.h < 44);
    const boxes = window.__textBoxes();
    const fsSmall = boxes.filter(b => b.fs < 12).length;
    return { n: ctrls.length, small: small.length, smallSamples: small.slice(0, 8), texts: boxes.length, fsSmall, minFs: Math.min(...boxes.map(b => b.fs)) };
  });
  res.push({ name, started, ...audit });
  console.log(name, String(started).slice(0, 40), 'ctrls', audit.n, 'small<44', audit.small, JSON.stringify(audit.smallSamples.slice(0, 6)), 'texts', audit.texts, '<12px', audit.fsSmall, 'minFs', audit.minFs);
}
fs.writeFileSync(`${O}/out/s20_ingame.json`, JSON.stringify(res, null, 1));
await browser.close();
