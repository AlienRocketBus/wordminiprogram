/* TI-9(e): does sitting idle on a ladder/room screen bring up the watchdog's rescue overlay? (no test idles ≥25 s) */
import { H, phone, toLadderHome, toLobby, flat } from './common.mjs';
const WHERE = process.argv[2] || 'ladderHome';
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
const out = { WHERE, samples: [] };
try {
  const A = await phone(browser, emu, srv, 'A', '13800000151', '小蜂A', live, names);
  if (WHERE === 'ladderHome') await toLadderHome(A);
  else if (WHERE === 'ladderHomeAfterCancel') { await toLadderHome(A); await A.tap('#ldGo'); await H.sleep(3000); await A.tap('#ldCancel2'); await A.waitScreen(/开始排位/, { timeout: 8000 }); }
  else if (WHERE === 'lobby') await toLobby(A);
  const t0 = Date.now(); let rescueAt = null;
  while (Date.now() - t0 < 70000) {
    const r = await A.eval(() => { const d = document.getElementById('pkRescue'); return d ? (d.innerText || '').replace(/\s+/g, ' ').slice(0, 120) : ''; });
    if (r && !rescueAt) { rescueAt = Math.round((Date.now() - t0) / 1000); out.rescueText = r; break; }
    await H.sleep(1000);
  }
  out.rescueAfterSec = rescueAt;
  out.hitLdGo = rescueAt ? (await A.hitTest('#ldGo', { timeout: 500 })).why : '';
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
