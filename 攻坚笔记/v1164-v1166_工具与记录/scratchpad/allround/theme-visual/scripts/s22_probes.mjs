// Misc evidence probes: palette CSS size, font glyph coverage, font swap timing, emoji in chrome.
import { newCtx, closeBrowser, sleep, save, BASE, tapText } from './lib.mjs';
const out = {};
// 1) palette engine: how many rules / attribute-substring selectors are live on an island page (light palette)
{
  const ctx = await newCtx({ palette: 'cloud' }); const pg = await ctx.newPage();
  await pg.goto(BASE + 'island_food.html', { waitUntil: 'load' }); await sleep(3500);
  out.paletteCSS = await pg.evaluate(() => {
    const st = document.getElementById('hsnPaletteCSS'); if (!st) return null;
    const rules = [...st.sheet.cssRules]; let sel = 0, attr = 0, imp = 0;
    for (const r of rules) { if (!r.selectorText) continue; const parts = r.selectorText.split(','); sel += parts.length; attr += parts.filter(p => p.includes('[style*=')).length; imp += (r.cssText.match(/!important/g) || []).length; }
    const all = [...document.styleSheets].reduce((n, s) => { try { return n + s.cssRules.length; } catch (e) { return n; } }, 0);
    return { bytes: st.textContent.length, rules: rules.length, selectors: sel, attrSubstringSelectors: attr, importantDecls: imp, totalRulesOnPage: all, elementsWithStyleAttr: document.querySelectorAll('[style]').length };
  });
  // style recalc cost of the palette sheet: time a forced full style recalc with and without it
  out.paletteRecalc = await pg.evaluate(async () => {
    const st = document.getElementById('hsnPaletteCSS'); const t = [];
    function force() { document.body.style.setProperty('--tv-x', String(Math.random())); const t0 = performance.now(); document.body.offsetHeight; getComputedStyle(document.body).color; [...document.querySelectorAll('*')].slice(0, 4000).forEach(e => e.getBoundingClientRect()); return performance.now() - t0; }
    const on = [], off = [];
    for (let i = 0; i < 5; i++) { document.documentElement.classList.add('tv-flip' + i); on.push(force()); }
    st.disabled = true; for (let i = 0; i < 5; i++) { document.documentElement.classList.add('tv-flop' + i); off.push(force()); } st.disabled = false;
    const med = a => a.sort((x, y) => x - y)[2];
    return { withPaletteMs: +med(on).toFixed(1), withoutPaletteMs: +med(off).toFixed(1), note: 'html class change → full style recalc + layout read, median of 5, unthrottled' };
  });
  await ctx.close();
}
// 2) glyph coverage of the shipped fonts (canvas pixel test: glyph in font vs fallback-only rendering)
{
  const ctx = await newCtx({ palette: 'cosmos' }); const pg = await ctx.newPage();
  await pg.goto(BASE + 'island_food.html', { waitUntil: 'load' }); await sleep(2500);
  await tapText(pg, /开始冒险/); await sleep(500);
  out.fonts = await pg.evaluate(async () => {
    try { window.__hsnLateFont && window.__hsnLateFont(); } catch (e) {}
    const ff = new FontFace('TVBaloo', 'url(baloo2.woff2)', { weight: '800' }); await ff.load(); document.fonts.add(ff);
    const fc = new FontFace('TVCartoon', 'url(cartoon_font.woff2)', { weight: '900' }); await fc.load(); document.fonts.add(fc);
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d', { willReadFrequently: true });
    function sig(font, ch) { x.clearRect(0, 0, 64, 64); x.font = font; x.fillStyle = '#000'; x.textBaseline = 'top'; x.fillText(ch, 4, 4); const d = x.getImageData(0, 0, 64, 64).data; let h = 0; for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) >>> 0; return h; }
    function has(fam, w, ch) { return sig(`${w} 40px ${fam}, "WenQuanYi Zen Hei"`, ch) !== sig(`${w} 40px "WenQuanYi Zen Hei"`, ch); }
    // characters actually shown in CartoonBlack on this page (headings, buttons, labels)
    const used = new Set();
    for (const el of document.querySelectorAll('body *')) { if (!el.childNodes.length) continue; const f = getComputedStyle(el).fontFamily; if (!/CartoonBlack/.test(f.split(',')[0])) continue; for (const n of el.childNodes) if (n.nodeType === 3) for (const ch of n.nodeValue) if (/[一-鿿A-Za-z0-9]/.test(ch)) used.add(ch); }
    const usedArr = [...used]; const missing = usedArr.filter(ch => !has('TVCartoon', 900, ch));
    const latin = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const balooMissing = latin.filter(ch => !has('TVBaloo', 800, ch));
    const cartoonLatinMissing = latin.filter(ch => !has('TVCartoon', 900, ch));
    const pn = '/ˈːəɪʊæɒʌɜɔŋθðʃʒ'.split(''); const balooIPA = pn.filter(ch => !has('TVBaloo', 800, ch));
    return { cartoonUsedChars: usedArr.length, cartoonMissing: missing.length, cartoonMissingSample: missing.slice(0, 40).join(''), cartoonLatinMissing: cartoonLatinMissing.join(''), balooMissingOfAlnum: balooMissing.join(''), balooIPAmissing: balooIPA.join('') };
  });
  // 3) emoji used as UI chrome on the island page (top bar / nav / mode labels)
  out.chromeEmoji = await pg.evaluate(() => { const re = /\p{Extended_Pictographic}/u; const pick = [...document.querySelectorAll('.top-bar *, .bottom-nav *, .stat-badge, .daily-card *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && re.test(n.nodeValue))); return [...new Set(pick.map(e => (e.className || e.tagName) + ':' + [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join('').slice(0, 12)))].slice(0, 20); });
  await ctx.close();
}
// 4) when does the CartoonBlack face become active on an island page (4G-like network, CPU 4x)?
{
  const res = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await newCtx({ palette: 'cosmos' }); const pg = await ctx.newPage();
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await pg.addInitScript(() => { window.__fontT = null; const t = setInterval(() => { try { for (const f of document.fonts) if (f.family.replace(/['"]/g, '') === 'CartoonBlack' && f.status === 'loaded') { window.__fontT = performance.now(); clearInterval(t); } } catch (e) {} }, 50); });
    await pg.goto(BASE + 'island_food.html', { waitUntil: 'load', timeout: 90000 }); await sleep(9000);
    res.push(await pg.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0]; return { fcpMs: fcp ? Math.round(fcp.startTime) : null, loadMs: Math.round(n.loadEventEnd), cartoonActiveMs: window.__fontT ? Math.round(window.__fontT) : null }; }));
    await ctx.close();
  }
  out.fontSwap = res;
}
// 5) which real font files render key text (CDP CSS.getPlatformFontsForNode)
{
  const ctx = await newCtx({ palette: 'cosmos' }); const pg = await ctx.newPage();
  await pg.goto(BASE + 'index.html', { waitUntil: 'load' }); await sleep(4000);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument', { depth: -1 });
  const res = {};
  for (const sel of ['.island-en', '.how-sub', '.how-step .num', '.subtitle', '.stat-num', '.tagline', '.island-name', '.intro']) {
    try { const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel }); if (!nodeId) { res[sel] = null; continue; }
      const f = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); const cs = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
      res[sel] = { declared: (cs.computedStyle.find(x => x.name === 'font-family') || {}).value, rendered: f.fonts.map(x => x.familyName + (x.isCustomFont ? '(web)' : '') + ' x' + x.glyphCount) };
    } catch (e) { res[sel] = String(e).slice(0, 80); }
  }
  out.renderedFonts = res;
  await ctx.close();
}
save('probes', out);
console.log(JSON.stringify(out, null, 1));
await closeBrowser();
