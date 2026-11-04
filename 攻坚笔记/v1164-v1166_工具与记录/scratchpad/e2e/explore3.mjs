import * as H from '/home/claude/work/repo/cloudbase_e2e_harness.mjs';
const emu = H.makeEmulator({});
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const E = await H.openPhone(browser, emu, srv.origin, { name: 'E', path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI) });
  for (let i = 0; i < 4; i++) {
    const m = await E.eval(() => { const m = document.querySelector('#alertModal.show'); if (!m) return null; return [...m.querySelectorAll('button,[onclick]')].map((b) => (b.id || '') + ':' + (b.innerText || '').slice(0, 20) + ':' + (b.getAttribute('onclick') || '').slice(0, 40)); });
    console.log('modal', JSON.stringify(m));
    if (!m) break;
    await E.tap('#alertModal.show button');
    await H.sleep(600);
  }
  const card = await E.eval(() => { const c = document.querySelector('.mode-card[onclick*="openSpellPK"]'); if (!c) return 'none'; let e = c, chain = []; while (e && chain.length < 8) { chain.push((e.id || e.className || e.tagName).toString().slice(0, 30) + (getComputedStyle(e).display === 'none' ? '(HIDDEN)' : '')); e = e.parentElement; } return chain.join(' < '); });
  console.log('card', card);
  console.log('screen', (await E.screen()).slice(0, 300).replace(/\n/g, ' | '));
  const h = await E.hitTest('.mode-card[onclick*="openSpellPK"]', { timeout: 3000 });
  console.log('hit', JSON.stringify(h));
} catch (e) { console.log('ERR', e.message); }
await browser.close(); srv.close();
