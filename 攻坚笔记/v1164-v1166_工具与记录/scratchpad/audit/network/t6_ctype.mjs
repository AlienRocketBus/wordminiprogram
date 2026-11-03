import { launch, newCtx, attach, cacheSummary, swState, waitSwActive, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// 「打开变下载」 defenses: bad Content-Type / disposition / non-ok status for navigations & assets, SW installed.
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
const ctx = await newCtx(browser);
const page0 = await ctx.newPage();
await page0.goto(O + '/', { waitUntil: 'load' });
await waitSwActive(page0);
await sleep(3000);
await page0.reload({ waitUntil: 'load' });
await sleep(1500);
await openIslandTap(page0, 'island_food.html');
await waitIsland(page0, 'island_food.html', 30000);
await sleep(2000);
await page0.evaluate(() => window.closeIsland());
await page0.close();

let downloads = [];
async function tryNav(label, rules, url = '/', extra) {
  srv.cfg.rules = rules;
  const page = await ctx.newPage();
  const ev = []; attach(page, label, ev);
  page.on('download', d => downloads.push({ label, url: d.url(), name: d.suggestedFilename() }));
  let st = null, ct = null, err = null;
  try {
    const resp = await page.goto(O + url, { waitUntil: 'load', timeout: 30000 });
    st = resp && resp.status(); ct = resp && resp.headers()['content-type'];
  } catch (e) { err = String(e.message).slice(0, 160); }
  await sleep(1500);
  let info = null;
  try { info = await page.evaluate(() => ({ title: document.title, ctype: document.contentType, islands: document.querySelectorAll('a.island').length, txt: (document.body && document.body.innerText || '').slice(0, 80) })); } catch (e) { info = String(e.message).slice(0, 100); }
  if (extra) { try { info.extra = await extra(page); } catch (e) { info.extra = String(e.message).slice(0, 200); } }
  R[label] = { st, ct, err, info, ev: ev.filter(e => !/VERSION|requestfailed/.test(e.text + e.kind)).slice(0, 8).map(e => e.kind + ' ' + e.text.slice(0, 120)) };
  await page.close();
}
try {
  await tryNav('C1_root_octet', [{ re: '^/(\\?.*)?$', ctype: 'application/octet-stream' }]);
  await tryNav('C2_root_textplain', [{ re: '^/(\\?.*)?$', ctype: 'text/plain' }]);
  await tryNav('C3_index_attachment', [{ re: '^/index\\.html', ctype: 'text/html; charset=utf-8', dispo: 'attachment; filename="index.html"' }], '/index.html');
  await tryNav('C4_root_404', [{ re: '^/(\\?.*)?$', status: 404, ctype: 'text/html', body: '<h1>404 Not Found</h1>' }]);
  await tryNav('C5_root_502', [{ re: '^/(\\?.*)?$', status: 502, ctype: 'text/html', body: '<h1>502 Bad Gateway</h1>' }]);
  await tryNav('C6_root_noctype', [{ re: '^/(\\?.*)?$', ctype: '' }]);
  // island inside the iframe served octet-stream
  srv.cfg.rules = [{ re: '^/island_food\\.html', ctype: 'application/octet-stream' }];
  {
    const page = await ctx.newPage();
    page.on('download', d => downloads.push({ label: 'C7', url: d.url() }));
    await page.goto(O + '/', { waitUntil: 'load' });
    await sleep(1000);
    await openIslandTap(page, 'island_food.html');
    R.C7_island_octet = await waitIsland(page, 'island_food.html', 15000);
    await page.close();
  }
  // assets with octet-stream: icons / fonts / js -> what does SW turn them into, do they still work?
  srv.cfg.rules = [{ re: '^/icons/.*\\.webp', ctype: 'application/octet-stream' }, { re: '\\.woff2', ctype: 'application/octet-stream' }, { re: '^/hansen_toast_v1156\\.js', ctype: 'application/octet-stream' }];
  {
    const page = await ctx.newPage();
    await page.evaluate(async () => {}).catch(() => {});
    await page.goto(O + '/', { waitUntil: 'load' });
    await sleep(2500);
    R.C8_assets = await page.evaluate(async () => {
      const out = {};
      const r1 = await fetch('icons/explore_3d.webp?v=1163&probe=1'); out.iconCT = r1.headers.get('content-type');
      const r2 = await fetch('cartoon_font.woff2?probe=1'); out.fontCT = r2.headers.get('content-type');
      const r3 = await fetch('hansen_toast_v1156.js?v=1163&probe=1'); out.jsCT = r3.headers.get('content-type');
      const img = new Image(); img.src = 'icons/explore_3d.webp?v=1163&probe=2';
      await new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 3000); });
      out.imgNaturalWidth = img.naturalWidth;
      out.toastLoaded = typeof window.HansenToast;
      return out;
    });
    await page.close();
  }
} catch (e) { R.fatal = String(e.stack || e).slice(0, 1000); }
R.downloads = downloads;
await browser.close(); srv.server.close();
save('t6_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
