import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
for (const [isl, call, lvl, name] of [['question', 'showTypingMenu()', 'startTyping(1)', 'typing'], ['body', 'startScramble()', "startScrambleLevel('easy')", 'scramble'], ['question', 'startEagle()', "startEagleLevel('easy')", 'eagle']]) {
  await page.goto(BASE + `island_${isl}.html`); await sleep(2500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(400);
  await page.evaluate(c => eval(c), call); await sleep(700);
  await page.evaluate(c => eval(c), lvl); await sleep(1800);
  await page.screenshot({ path: `${O}/shots/s34_${isl}_${name}.png` });
  const ans = await page.evaluate(() => { try { return (window.typeWord && typeWord.en) || (window.scrWord && scrWord.en) || ''; } catch (e) { return ''; } });
  console.log(isl, name, 'answer', ans);
}
await browser.close();
