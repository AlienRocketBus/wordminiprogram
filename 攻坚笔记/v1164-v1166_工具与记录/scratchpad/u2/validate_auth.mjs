// Real SDK 2.30.0 + real app page (spelling_pk.html) + emulator: validate v1164 auth/session/backup behaviour.
// Run: node validate_auth.mjs   (REPO defaults to /home/claude/work/repo)
import { createEmulator, ACL } from './emulator.mjs';
import { startStatic, launch, newCtx, E, ENV } from './harness.mjs';

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 600) : '')); };
const UI = 'user_info_' + ENV, CR = 'credentials_' + ENV;

const emu = createEmulator({
  collections: { hansen_pk_rooms: ACL.READONLY, hansen_saves: ACL.READONLY, sb_profile: ACL.READONLY, counters: ACL.ADMINONLY, hansen_friends: ACL.READONLY, hansen_pk_records: ACL.READONLY },
  knobs: { latencyMs: 30 },
});
emu.seedUser({ username: 'alice_poc', password: 'pw123456', name: 'Alice' });

import fs from 'node:fs';
const OLDV = process.env.OLD ? Object.fromEntries(['hansen_auth_v1004.js','hansen_backup_v944.js','hansen_cred_guard_v1092.js','hansen_backup_bootstrap_v944.js','hansen_auth_ui_v1004.js'].map((f) => ['/' + f, { type: 'text/javascript; charset=utf-8', body: fs.readFileSync(new URL('./old/' + f, import.meta.url)) }])) : {};
if (process.env.OLD) console.log('*** serving v1163 (73e1b69) auth/backup/guard files ***');
if (process.env.OLDCS) { OLDV['/hansen_cloud_save_v965.js'] = { type: 'text/javascript; charset=utf-8', body: fs.readFileSync(new URL('./old/hansen_cloud_save_v965.js', import.meta.url)) }; console.log('*** serving v1163 hansen_cloud_save_v965.js ***'); }
const srv = await startStatic(OLDV);
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const browser = await launch();
const open = async (tag) => {
  const c = await newCtx(browser, emu, ORIGIN, { tag, url: '/spelling_pk.html', waitReady: false, ctxOpts: { serviceWorkers: 'block', viewport: { width: 390, height: 844 } } });
  await c.page.waitForFunction(() => window.HansenAuth && window.HansenAuth.loginByPassword && window.HansenCredGuard, null, { timeout: 20000 });
  await c.page.waitForTimeout(800);
  c.page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return c;
};
const ageMarker = (page) => E(page, () => { const k = 'hansen_auth_v1004'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.signedAt = Date.now() - 600000; localStorage.setItem(k, JSON.stringify(o)); });
const cap = (p, ms = 30000) => Promise.race([p, new Promise((r) => setTimeout(() => r({ r: { hung: true }, trace: ['(30 秒还没返回 —— 挂死)'] }), ms))]);
const ensure = (page) => cap(E(page, async () => {
  let ev = 0; const h = () => ev++; document.addEventListener('hsn-auth-changed', h);
  const t0 = Date.now(); const r = await window.HansenAuth.ensureSession(); const ms = Date.now() - t0;
  document.removeEventListener('hsn-auth-changed', h);
  return { r, ms, ev, signed: window.HansenAuth.isSignedIn(), trace: window.HansenAuth._trace().split('\n').slice(-7).map((l) => l.replace(/^\+\s*\d+ms\s+/, '')) };
}));
const tokenCalls = () => emu.log.filter((x) => x.path === '/auth/v1/token').length;

try {
  const A = await open('A');
  const login = await E(A.page, async () => {
    const r = await window.HansenAuth.loginByPassword('alice_poc', 'pw123456').then((x) => ({ ok: true, uid: x.uid }), (e) => ({ ok: false, e: String(e && e.message || e) }));
    return { r, keys: Object.keys(localStorage).filter((k) => /credentials|user_info|cred_shadow|cred_rescue/.test(k)), guard: window.HansenCredGuard.status() };
  });
  check('login alice ok, credentials + user_info present, guard counter 0', login.r.ok && login.keys.includes('credentials_' + 'ambitious-d0g1d26xm740dc3d6') && login.guard.rescued === 0, login);
  await ageMarker(A.page);
  const s0 = await ensure(A.page);
  check('ensureSession ok on healthy session', s0.r.ok && /^\d{19}$/.test(s0.r.uid), s0.r);
  const UID = s0.r.uid;

  // ① user_info removed → recovers uid via getCurrentUser
  await E(A.page, (k) => localStorage.removeItem(k), UI);
  const s1 = await ensure(A.page);
  const back = await E(A.page, (k) => !!localStorage.getItem(k), UI);
  check('① user_info removed → ensureSession ok with same uid (getCurrentUser)', s1.r.ok && s1.r.uid === UID && /云端账号信息/.test(s1.r.uidFrom || ''), { r: s1.r, trace: s1.trace });
  check('① user_info cache repopulated by getCurrentUser', back === true, back);

  // ①b user_info corrupt (content:null) → removed + re-probe → ok, NOT expired
  await E(A.page, (k) => localStorage.setItem(k, JSON.stringify({ version: 'localCachev1', content: null })), UI);
  const s1b = await ensure(A.page);
  check('①b corrupt user_info (content:null) → repaired, ok, still signed in', s1b.r.ok && s1b.r.uid === UID && s1b.signed && s1b.trace.some((l) => /缓存修复/.test(l)), { r: s1b.r, trace: s1b.trace });
  await E(A.page, (k) => localStorage.setItem(k, '{"version":"localCachev1","content":{bad json'), UI);
  const s1c = await ensure(A.page);
  check('①c corrupt user_info (bad JSON) → repaired, ok (was: "Unexpected token" → definite expired → logged out)', s1c.r.ok && s1c.signed, { r: s1c.r, trace: s1c.trace });

  // 页面重载后的会话判定（SDK 内存里的有效凭证优先于 localStorage，所以要重载才看得到"凭证没了"）
  const reloadTo = async (c, prep) => {
    await E(c.page, prep);
    await c.page.reload(); await c.page.waitForFunction(() => window.HansenAuth && window.HansenCredGuard, null, { timeout: 20000 });
    await c.page.waitForTimeout(300);
  };
  const bootTrace = (c) => E(c.page, () => ({ signed: window.HansenAuth.isSignedIn(), trace: window.HansenAuth._trace().split('\n').map((l) => l.replace(/^\+\s*\d+ms\s+/, '')) }));
  // ② credentials removed, guard shadow fresh → rescued → ok (after reload)
  await reloadTo(A, () => { localStorage.removeItem('credentials_ambitious-d0g1d26xm740dc3d6'); const o = JSON.parse(localStorage.getItem('hansen_auth_v1004')); o.signedAt = Date.now() - 600000; localStorage.setItem('hansen_auth_v1004', JSON.stringify(o)); });
  const s2 = await ensure(A.page);
  const t2 = await bootTrace(A);
  check('② credentials removed (reload), guard shadow fresh → rescued (by ensureSession or the guard tick), ok', s2.r.ok && s2.r.uid === UID && t2.trace.some((l) => /影子副本救回/.test(l)) || (s2.r.ok && (await E(A.page, () => window.HansenCredGuard.status().rescued)) >= 1), { r: s2.r, trace: t2.trace.slice(-8) });

  // ②b credentials AND shadow removed → definite expired, marker cleared, hsn-auth-changed
  await reloadTo(A, () => { localStorage.removeItem('credentials_ambitious-d0g1d26xm740dc3d6'); localStorage.removeItem('hansen_cred_shadow'); const o = JSON.parse(localStorage.getItem('hansen_auth_v1004')); o.signedAt = Date.now() - 600000; localStorage.setItem('hansen_auth_v1004', JSON.stringify(o)); });
  const s2b = await ensure(A.page);
  const t2b = await bootTrace(A);
  const expiredSeen = t2b.trace.some((l) => /确凿过期/.test(l));
  check('②b credentials + shadow removed (reload, not fresh) → definite expired, marker cleared', !t2b.signed && expiredSeen && (s2b.r.kind === 'expired' || s2b.r.kind === 'signin'), { r: s2b.r, trace: t2b.trace.slice(-6) });
  if (s2b.r.kind === 'expired') check('②b direct result shape {expired, definite, noCredentials, tries:1} + hsn-auth-changed', s2b.r.expired && s2b.r.definite && s2b.r.noCredentials && s2b.r.tries === 1 && s2b.ev >= 1, s2b);

  // ③ invalid_grant (refresh token burnt elsewhere): rescue with same burnt RT → still expired, bounded
  const B = await open('B');
  await E(B.page, () => window.HansenAuth.loginByPassword('alice_poc', 'pw123456'));
  await ageMarker(B.page);
  const rt = await E(B.page, (k) => JSON.parse(localStorage.getItem(k)).refresh_token, CR);
  // another instance refreshes first → B's refresh token is burnt
  emu.handle({ method: 'POST', url: `https://${ENV}.ap-shanghai.tcb-api.tencentcloudapi.com/auth/v1/token`, headers: {}, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: rt }) });
  emu.expireAllAccessTokens();
  const tc0 = tokenCalls();
  await reloadTo(B, () => { const k = 'credentials_ambitious-d0g1d26xm740dc3d6'; const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c)); window.HansenCredGuard.backup(); });
  const s3 = await ensure(B.page);
  await B.page.waitForTimeout(2500);
  const tc1 = tokenCalls();
  const t3 = await bootTrace(B);
  check('③ invalid_grant (burnt refresh token) → definite expired (not "尚未就绪" forever), marker cleared; refresh attempts bounded', !t3.signed && t3.trace.some((l) => /确凿过期/.test(l)) && (tc1 - tc0) <= 3, { r: s3.r, tokenCalls: tc1 - tc0, trace: t3.trace.slice(-9) });
  const after3 = await E(B.page, (k) => ({ cred: !!localStorage.getItem(k), guard: window.HansenCredGuard.status() }), CR);
  check('③ after expiry the guard does not keep resurrecting the dead credentials', after3.cred === false, after3);

  // ④ /auth/v1/token hangs → whole-call timeout → notReady + slow (marker kept)
  const C = await open('C');
  await E(C.page, () => window.HansenAuth.loginByPassword('alice_poc', 'pw123456'));
  await ageMarker(C.page);
  await C.ctx.route(/\/auth\/v1\/token/, () => { /* 永不回应：模拟网卡住 */ });
  await reloadTo(C, () => { const k = 'credentials_ambitious-d0g1d26xm740dc3d6'; const c = JSON.parse(localStorage.getItem(k)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(c)); });
  const s4 = await ensure(C.page);
  check('④ /auth/v1/token hangs → ~10 s → {ok:false, notReady, slow, kind:slow}, marker kept', !s4.r.ok && s4.r.notReady && s4.r.slow && s4.r.kind === 'slow' && !s4.r.expired && s4.signed && s4.ms >= 9500 && s4.ms < 13000, { r: s4.r, ms: s4.ms, signed: s4.signed, trace: s4.trace });

  // ⑤ registerByPassword → honest error, no marker, no SDK traffic
  const D = await open('D');
  const n0 = emu.log.length;
  const s5 = await E(D.page, async () => {
    let err = ''; try { await window.HansenAuth.registerByPassword('bobby', 'secret123', 'secret123'); } catch (e) { err = String(e.message); }
    return { err, signed: window.HansenAuth.isSignedIn(), local: window.HansenAuth.readLocal(), cred: Object.keys(localStorage).some((k) => /^credentials/.test(k)) };
  });
  const authReq = emu.log.slice(n0).filter((x) => /\/auth\/v1\/(verification|signup)/.test(x.path)).length;
  check('⑤ registerByPassword → honest Chinese error, no marker, no credentials, no verification/signup request', /手机号/.test(s5.err) && !s5.signed && !s5.local.method && !s5.cred && authReq === 0, { s5, authReq });

  // ⑥ loginByPassword with a bad signin response (no expires_in) → no marker
  emu.injectFault((req) => /\/auth\/v1\/signin$/.test(new URL(req.url).pathname), (req) => ({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ token_type: 'Bearer', access_token: 'x.y.z', refresh_token: 'r', scope: 'user' }) }), 1);
  const s6 = await E(D.page, async () => {
    let err = ''; try { await window.HansenAuth.loginByPassword('alice_poc', 'pw123456'); } catch (e) { err = String(e && (e.message || e.error_description || e.error) || e); }
    return { err, signed: window.HansenAuth.isSignedIn(), local: window.HansenAuth.readLocal(), cred: Object.keys(localStorage).some((k) => /^credentials/.test(k)) };
  });
  check('⑥ loginByPassword with signin response lacking expires_in → rejected, no marker', !!s6.err && !s6.signed && !s6.local.method && !s6.cred, s6);
  // ⑥b non-JSON 200 body
  emu.injectFault((req) => /\/auth\/v1\/signin$/.test(new URL(req.url).pathname), () => ({ status: 200, headers: { 'content-type': 'text/html', 'access-control-allow-origin': '*' }, body: '<html>gateway</html>' }), 12);
  const s6b = await E(D.page, async () => {
    let err = ''; try { await window.HansenAuth.loginByPassword('alice_poc', 'pw123456'); } catch (e) { err = String(e && (e.message || e.error_description || e.error) || e); }
    return { err, signed: window.HansenAuth.isSignedIn() };
  });
  check('⑥b loginByPassword with non-JSON body → rejected, no marker', !!s6b.err && !s6b.signed, s6b);

  // ⑦ backup never exports SDK keys and a restore never touches them
  emu.faults.length = 0;   // 上一步注入的故障别漏到这里
  const s7 = await E(D.page, async (ENV) => {
    await window.HansenAuth.loginByPassword('alice_poc', 'pw123456');
    localStorage.setItem('wordIslandAnimal', JSON.stringify({ learned: [1, 2] }));
    const keys = window.HansenBackup.build().items.map((x) => x.key);
    const leaked = keys.filter((k) => /^(credentials|user_info|lang_|x-tcb|device_id)|cred_shadow|cred_rescue/.test(k) || k.indexOf(ENV) >= 0);
    const ui = localStorage.getItem('user_info_' + ENV), dev = localStorage.getItem('device_id');
    // forge an old-style (v1163) snapshot carrying a FOREIGN user_info + device_id
    const p = window.HansenBackup.build();
    p.items = p.items.concat([{ key: 'user_info_' + ENV, value: JSON.stringify({ version: 'localCachev1', content: { uid: '1999999999999999999' } }) }, { key: 'device_id', value: 'ffff' }]);
    p.items.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const st = (items) => items.map((x) => x.key + '\u0000' + x.value).join('\u0001');
    let h = 2166136261; const s = st(p.items); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    p.checksum = 'fnv1a32-' + (h >>> 0).toString(16).padStart(8, '0');
    let err = ''; try { window.HansenBackup.restore(JSON.stringify(p)); } catch (e) { err = e.message; }
    const r = await window.HansenAuth.ensureSession();
    return { leaked, err, uiSame: localStorage.getItem('user_info_' + ENV) === ui, devSame: localStorage.getItem('device_id') === dev, uid: r.uid, ok: r.ok };
  }, ENV);
  check('⑦ backup build has no SDK keys; old-style snapshot with foreign user_info restores without touching live SDK keys', !s7.__thrown && s7.leaked.length === 0 && !s7.err && s7.uiSame && s7.devSame && s7.ok && s7.uid !== '1999999999999999999', s7);

  // ⑧ guard counter resets when the SDK gets a new refresh token
  const s8 = await E(D.page, async (CR) => {
    localStorage.setItem('hansen_cred_rescue_n', '3');
    const before = window.HansenCredGuard.status().rescued;
    window.HansenCredGuard.backup();                       // same RT → stays
    const same = window.HansenCredGuard.status().rescued;
    const c = JSON.parse(localStorage.getItem(CR)); c.expires_at = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(CR, JSON.stringify(c));
    return { before, same };
  }, CR);
  await D.page.reload(); await D.page.waitForFunction(() => window.HansenAuth && window.HansenCredGuard, null, { timeout: 20000 });
  const s8b = await E(D.page, async () => { const r = await window.HansenAuth.ensureSession(); window.HansenCredGuard.backup(); return { ok: r.ok, rescued: window.HansenCredGuard.status().rescued }; });
  check('⑧ guard rescue counter: unchanged for same refresh token, reset after a successful refresh (new token)', s8.before === 3 && s8.same === 3 && s8b.ok && s8b.rescued === 0, { s8, s8b });

  // ⑨ cloud save: collection answers {code} (permission denied) → upload must fail honestly, lookup must be "查不到" (exists:null)
  emu.setAcl('hansen_saves', ACL.ADMINONLY);
  const s9 = await E(D.page, async () => {
    const CS = window.HansenCloudSave;
    const info = await CS.accountCloudInfo();
    let up = null, upErr = '';
    try { up = await CS.syncNow({ force: true }); } catch (e) { upErr = String(e && e.message || e); }
    const sync = await window.HansenAuth._syncOnLoginForTest();
    return { info, up, upErr, sync };
  });
  check('⑨ hansen_saves → DATABASE_PERMISSION_DENIED: lookup says "查不到" (exists:null), upload not reported ok, login sync does nothing', s9.info && s9.info.exists === null && /DATABASE_PERMISSION_DENIED/.test(s9.info.reason || '') && !(s9.up && s9.up.ok) && s9.sync && s9.sync.action === 'cloud-unreachable', s9);
  emu.setAcl('hansen_saves', ACL.READONLY);
  const s9b = await E(D.page, async () => {
    const CS = window.HansenCloudSave;
    const up = await CS.syncNow({ force: true }).catch((e) => ({ ok: false, err: String(e && e.message || e) }));
    const info = await CS.accountCloudInfo();
    return { up, info };
  });
  check('⑨b same with normal permission → upload ok and cloud copy found', s9b.up && s9b.up.ok && s9b.info && s9b.info.exists === true, s9b);

  const unrouted = [...A.unrouted, ...B.unrouted, ...C.unrouted, ...D.unrouted];
  check('no request left the sandbox', unrouted.length === 0, unrouted.slice(0, 5));
} catch (e) {
  check('script error: ' + (e && e.stack || e), false);
} finally {
  await browser.close(); srv.close();
  const f = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - f} PASS / ${f} FAIL`);
  process.exit(f ? 1 : 0);
}
