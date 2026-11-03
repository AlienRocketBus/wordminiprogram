import * as H from '/home/claude/work/repo/cloudbase_e2e_harness.mjs';
const emu = H.makeEmulator({ collections: H.defaultCollections({ hansen_pk_rooms: H.ACL.ADMINONLY }), knobs: { permissionMode: 'rules', latencyMs: 40 } });
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const t0 = Date.now(); const lg = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  A.page.on('framenavigated', (f) => { if (f === A.page.mainFrame()) lg('NAVIGATED', f.url()); });
  await H.loginPhone(A, '13800000099');
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '甲');
  await A.waitScreen(/开始排位/); await A.tap('#ldGo');
  await A.waitScreen(/云端设置还差一步/); lg('config shown');
  await A.tap('#ldCancel'); lg('tapped x');
  for (let i = 0; i < 30; i++) {
    const st = await A.eval(() => ({ rs: document.readyState, url: location.href.slice(-20), vis: !!(document.getElementById('pkRooms') && document.getElementById('pkRooms').offsetParent), txt: (document.body && document.body.innerText || '').slice(0, 60).replace(/\n/g, ' '), ld: (document.getElementById('hsn_ladder_screen') || {}).className }));
    lg(JSON.stringify(st));
    await H.sleep(300);
  }
  console.log('dialogs', A.dialogs, 'errors', A.errors);
} catch (e) { console.log('ERR', e.message); }
await browser.close(); srv.close();
