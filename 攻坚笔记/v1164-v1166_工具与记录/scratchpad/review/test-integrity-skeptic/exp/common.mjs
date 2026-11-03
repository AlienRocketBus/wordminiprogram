/* skeptic helpers on top of the repo's own harness (read-only use of the repo) */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
export { H };
export const TENC = (u) => { try { const x = new URL(u); return /tcb-api\.tencentcloudapi\.com$/.test(x.hostname) && x.pathname === '/web'; } catch (e) { return false; } };
/* overlay registered AFTER emu.attach → runs first; non-matching requests fall back to the emulator */
export async function overlay(ph, pred, respond, stats) {
  await ph.ctx.route(TENC, async (route) => {
    let b = {};
    try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) { b = {}; }
    if (pred(b, route)) {
      stats.hits = (stats.hits || 0) + 1;
      const r = respond(b);
      if (r.abort) return route.abort(r.abort).catch(() => {});
      return route.fulfill({ status: r.status || 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(r.body) }).catch(() => {});
    }
    return route.fallback().catch(() => {});
  });
}
export async function phone(browser, emu, srv, name, num, nick, live, names) {
  const p = await H.openPhone(browser, emu, srv.origin, { name });
  live.push(p);
  const r = await H.loginPhone(p, num);
  if (!(r && r.ok)) throw new Error(`[${name}] login failed ${JSON.stringify(r).slice(0, 300)}`);
  names[r.uid] = nick; p.nick = nick; p.number = num;
  return p;
}
export async function toLobby(p) {
  await p.tap('#pkRooms');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开一间/, { timeout: 10000 });
}
export async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 10000 });
}
export const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
