/* Does the exported save change every 8 s on an idle island page (so "skip if unchanged" would not stop the uploads)? */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const p = await H.openPhone(browser, null, srv.origin, { name: 'kid', path: '/island_animal.html', ready: () => !!(window.HansenBackup && window.HansenCloudSave) });
await H.sleep(6000);
const snap = () => p.eval(() => {
  const b = window.HansenBackup.build();
  const items = (b && b.items) || [];
  const prog = items.filter((x) => /^hsn_progress:/.test(x.key)).map((x) => x.key + ' ts=' + (JSON.parse(x.value).ts));
  let code = ''; try { code = window.HansenBackup.exportCode(); } catch (e) { code = 'ERR ' + e.message; }
  let h = 2166136261; for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  return { n: items.length, prog, hash: (h >>> 0).toString(16), len: code.length };
});
const a = await snap(); await H.sleep(9000); const b = await snap();
console.log('t0  ', JSON.stringify(a));
console.log('t+9s', JSON.stringify(b));
console.log('export hash changed while the kid did nothing:', a.hash !== b.hash);
await p.close(); srv.close(); await browser.close();
