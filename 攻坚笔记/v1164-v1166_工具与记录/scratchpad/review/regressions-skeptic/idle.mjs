/* Skeptic re-measurement of idle cloud traffic, with per-FRAME attribution.
 * HARNESS=<path to cloudbase_e2e_harness.mjs> (v1164 repo or the v1163 copy)
 * SCEN=island|homeBack|pk|friends   DUR=seconds */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const DUR = Number(process.env.DUR || 120) * 1000;
const SCEN = process.env.SCEN || 'island';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenSbProfile);
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: PK_READY });
const num = '1380000' + String(Math.floor(Math.random() * 9000) + 1000);
const r = await H.loginPhone(p, num);
const prof = await p.eval(async () => {
  try { window.HansenSbProfile.setName('小测'); } catch (e) {}
  for (let i = 0; i < 80 && !((window.HansenSbProfile.readProfile() || {}).cid); i++) await new Promise((z) => setTimeout(z, 250));
  return window.HansenSbProfile.readProfile();
});
console.log('login', JSON.stringify(r).slice(0, 120), 'cid', prof && prof.cid);

/* per-frame attribution of every Tencent request */
const reqs = [];
p.ctx.on('request', (q) => {
  try {
    const u = new URL(q.url());
    if (!/tencentcloudapi\.com$/.test(u.hostname) || q.method() === 'OPTIONS') return;
    let body = {}; try { body = JSON.parse(q.postData() || '{}'); } catch (e) {}
    let fr = '?'; try { fr = (q.frame().url() || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, ''); const par = q.frame().parentFrame(); fr += '@' + (par ? (par.url() || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') : 'top'); } catch (e) {}
    const a = String(body.action || u.pathname).replace('database.', '');
    reqs.push({ t: Date.now(), frame: fr, op: a + ' ' + (body.collectionName || ''), id: (body.query && body.query._id) ? 'id' : '' });
  } catch (e) {}
});

async function settleAndCount(label, extra) {
  await H.sleep(8000);
  const t0 = Date.now();
  await H.sleep(DUR);
  const t1 = Date.now();
  const win = reqs.filter((x) => x.t >= t0 && x.t < t1);
  const byOp = {}, byFrameOp = {};
  for (const x of win) { const k = x.op + (x.id ? '(id)' : ''); byOp[k] = (byOp[k] || 0) + 1; const kf = x.frame + ' :: ' + k; byFrameOp[kf] = (byFrameOp[kf] || 0) + 1; }
  const frames = p.page.frames().map((f) => (f.url() || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, ''));
  const friendsFrames = [];
  for (const f of p.page.frames()) { try { if (await f.evaluate(() => !!window.HansenFriends)) friendsFrames.push((f.url() || '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '')); } catch (e) {} }
  console.log(`\n=== ${label} (${((t1 - t0) / 1000).toFixed(0)} s) total=${win.length} frames=${frames.length} [${frames.join(', ')}]`);
  console.log('  frames with HansenFriends:', friendsFrames.length, friendsFrames.join(', '));
  for (const [k, v] of Object.entries(byOp).sort((a, b) => b[1] - a[1])) console.log('   ', String(v).padStart(4), k);
  console.log('  per frame:');
  for (const [k, v] of Object.entries(byFrameOp).sort((a, b) => b[1] - a[1])) console.log('   ', String(v).padStart(4), k);
  if (extra) console.log('  ' + extra);
  console.log('  page errors:', p.errors.slice(0, 3).join(' | ') || 'none', '| console errors:', p.consoleErrors.slice(0, 3).join(' | ') || 'none');
}

if (SCEN === 'island') {
  await p.page.goto(srv.origin + '/island_animal.html', { waitUntil: 'domcontentloaded' });
  await H.sleep(3000);
  await H.dismissIslandWelcome(p);
  await settleAndCount('signed-in, island_animal.html opened directly');
} else if (SCEN === 'homeBack') {
  await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.page.waitForFunction(() => !!document.getElementById('islandFrame'), null, { timeout: 45000 });
  await H.sleep(2000);
  await p.eval(() => { openIsland('island_animal.html'); });
  await H.sleep(15000);
  await p.eval(() => { closeIsland(); });
  await H.sleep(1500);
  const vis = await p.eval(() => getComputedStyle(document.getElementById('islandFrameWrap')).display);
  await settleAndCount('signed-in, home (index.html) after visiting one island and closing it', 'islandFrameWrap display=' + vis);
} else if (SCEN === 'home') {
  await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await H.sleep(3000);
  await settleAndCount('signed-in, home (index.html), no island visited');
} else if (SCEN === 'pk') {
  await p.page.reload({ waitUntil: 'domcontentloaded' });
  await H.sleep(3000);
  await settleAndCount('signed-in, spelling_pk.html home');
}
await p.close(); srv.close(); await browser.close();
