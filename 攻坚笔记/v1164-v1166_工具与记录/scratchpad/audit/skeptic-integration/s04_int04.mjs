// INT-04: phone back (history.back on the top window) from in-island screens / overlays
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(1000);
let t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
await waitVisible(page, 'island_animal.html', t0);
await dismissWelcome(page);
await sleep(2500);
const inner = async () => (await frameOf(page)).evaluate(() => {
  const a = document.querySelector('.screen.active');
  const ovs = ['hsnSbOverlay', 'hsn_pk_screen', '__hsn_pk_ov'].filter(id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; });
  const anyFixed = [...document.querySelectorAll('body > div')].filter(d => { const s = getComputedStyle(d); return s.position === 'fixed' && s.display !== 'none' && +s.zIndex > 100000 && d.offsetWidth > 300 && d.offsetHeight > 500; }).map(d => d.id || d.className.slice(0, 20));
  return { screen: a && a.id, ovs, bigFixed: anyFixed.slice(0, 4), path: location.pathname.split('/').pop() };
}).catch(e => ({ err: e.message.slice(0, 80) }));
const modes = [
  ['探索单词', "showScreen('explore')"], ['听音辨义', 'startListen()'], ['记忆翻牌', 'startMatch()'], ['打字大师', 'showTypingMenu()'],
  ['完形填空', 'startCloze()'], ['字母拼拼乐', 'startScramble()'], ['spelling bee', "HansenSpellBee.open('animal')"], ['拼写大PK', 'openSpellPK()'],
  ['打地鼠', 'startMoles()'], ['极速60秒', 'startSpeed()'], ['火眼金睛', 'startEagle()'], ['抽卡', 'HansenContextGacha.open()']];
for (const [name, oc] of modes) {
  const fr = await frameOf(page);
  const h = await fr.$(`.mode-card[onclick="${oc}"]`);
  if (!h) { out(name, 'card not found'); continue; }
  const r = await tap(page, fr, h);
  await sleep(1500);
  const before = await inner();
  const hl0 = (await islandState(page)).hist;
  await page.evaluate(() => history.back());
  await sleep(1200);
  const s = await islandState(page);
  const after = await inner();
  out(`${name}: opened ${JSON.stringify(before)} | after phone-back: wrap=${s.wrap} topState=${s.state} hist ${hl0}->${s.hist} | inside hidden/visible island: ${JSON.stringify(after)}`);
  // restore: if island closed, re-enter via card (keep-alive, same island); then reset to home screen
  if (s.wrap === 'none') {
    t0 = Date.now();
    await tap(page, page, 'a.island[href="island_animal.html"]');
    const v = await waitVisible(page, 'island_animal.html', t0);
    const re = await inner();
    out(`   re-enter card -> visibleMs ${v.ms}, island shows ${JSON.stringify(re)}`);
  }
  await (await frameOf(page)).evaluate(() => {
    try { if (window.HansenSpellBee) HansenSpellBee.close(); } catch (e) {}
    try { if (window.HansenSbPK && HansenSbPK.close) HansenSbPK.close(); } catch (e) {}
    try { if (window.HansenContextGacha && HansenContextGacha.close) HansenContextGacha.close(); } catch (e) {}
    try { showScreen('home'); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
  }).catch(() => {});
  await sleep(800);
}
out('pageerrors', JSON.stringify(errs));
await K.done();
