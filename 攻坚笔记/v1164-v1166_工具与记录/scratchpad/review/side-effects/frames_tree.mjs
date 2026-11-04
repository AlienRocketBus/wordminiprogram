import { H } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({});
const p = await H.openPhone(browser, emu, srv.origin, { name: 'f', path: process.env.PAGE || '/island_animal.html', ready: () => !!window.HansenAuth });
if (process.env.OPEN) await p.eval((f) => { try { openIsland(f); } catch (e) {} }, process.env.OPEN);
await H.sleep(Number(process.env.WAIT || 20000));
function tree(f, d) { console.log('  '.repeat(d) + (f.url() || '(blank)').replace(/^https?:\/\/[^/]+\//, '')); for (const c of f.childFrames()) tree(c, d + 1); }
tree(p.page.mainFrame(), 0);
console.log('missing:', JSON.stringify(srv.missing.slice(0, 20)));
console.log('console errors:', p.consoleErrors.slice(0, 5));
await p.close(); srv.close(); await browser.close();
