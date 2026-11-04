import { launch, sleep, BASE, O } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_body.html'); await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(400);
await page.evaluate(() => showTypingMenu()); await sleep(600);
await page.evaluate(() => startTyping(1)); await sleep(1200);
for (let k = 0; k < 25; k++) {
  const st = await page.evaluate(() => { const svgT = [...document.querySelectorAll('#typingScreen svg text')].map(t => t.textContent).join(' '); let en = ''; try { en = typeWord.en; } catch (e) {} return { en, svgT }; });
  if (st.svgT && st.en && st.svgT.toLowerCase().includes(st.en.toLowerCase())) { await page.screenshot({ path: `${O}/shots/s36_typing_giveaway.png` }); console.log('FOUND give-away in typing:', JSON.stringify(st)); break; }
  // type the answer to advance
  await page.evaluate(() => { try { const w = typeWord.en; for (const ch of w) { const key = [...document.querySelectorAll('#typingScreen .key')].find(k => k.textContent.trim() === ch); if (key) key.click(); } } catch (e) {} });
  await sleep(1500);
}
await browser.close();
