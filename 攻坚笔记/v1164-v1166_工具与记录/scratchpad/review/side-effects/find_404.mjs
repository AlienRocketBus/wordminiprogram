import { H } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { consistencyLagMs: 0 } });
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenSbProfile && window.HANSEN_VOCAB_ALL);
const p = await H.openPhone(browser, emu, srv.origin, { name: 'x', ready: PK_READY });
const bad = [];
p.page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(srv.origin, '')); });
p.page.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text().slice(0, 120) + ' @ ' + ((m.location() || {}).url || '').replace(srv.origin, '')); });
await H.loginPhone(p, '13599990000');
await p.eval(async () => { window.HansenSbProfile.setName('小查'); for (let i = 0; i < 40 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250)); });
for (const path of ['/index.html']) {
  await p.page.goto(srv.origin + path, { waitUntil: 'domcontentloaded' });
  await H.sleep(3000);
  await p.eval(() => { try { openIsland('island_animal.html'); } catch (e) {} });
  await H.sleep(40000);
}
console.log('missing:', JSON.stringify(srv.missing));
console.log(bad.join('\n') || '(none)');
await p.close(); srv.close(); await browser.close();
