/* TI-4: the same permission problem (pk collection 「无权限」/ missing) answered with HTTP 200+code vs a non-200 status.
   argv STATUS: 200 (emulator default: 200 + DATABASE_PERMISSION_DENIED) | 403 | 404 (non-200; SDK drops status+body) */
import { H, phone, toLadderHome, flat } from './common.mjs';
const STATUS = Number(process.argv[2] || 200);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const cols = H.defaultCollections(STATUS === 200 ? { hansen_pk_rooms: H.ACL.ADMINONLY } : {});
const emu = H.makeEmulator({ collections: cols, knobs: { permissionMode: 'rules', latencyMs: 40 } });
if (STATUS === 404) emu.dropCollection('hansen_pk_rooms');
const out = { STATUS };
try {
  const A = await phone(browser, emu, srv, 'A', '13800000141', '小蜂A', live, names);
  if (STATUS !== 200) {
    const body = STATUS === 403 ? '{"code":"DATABASE_PERMISSION_DENIED","message":"Permission denied"}' : '{"code":"DATABASE_COLLECTION_NOT_EXIST","message":"Db or Table not exist"}';
    await A.ctx.route((u) => { const x = new URL(u); return /tcb-api\.tencentcloudapi\.com$/.test(x.hostname) && x.pathname === '/web'; }, async (route) => {
      let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      if (b.collectionName === 'hansen_pk_rooms') return route.fulfill({ status: STATUS, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body });
      return route.fallback();
    });
  }
  await toLadderHome(A);
  const t0 = Date.now();
  await A.tap('#ldGo');
  const fin = await H.until(async () => { const s = await A.screen(); return /云端设置还差一步|连不上网络|这次没成功|云端还没连上/.test(s) ? flat(s) : null; }, { timeout: 60000, interval: 500 });
  out.afterSec = Math.round((Date.now() - t0) / 1000);
  out.screen = fin ? fin.slice(0, 260) : '(no problem screen within 60 s)';
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
