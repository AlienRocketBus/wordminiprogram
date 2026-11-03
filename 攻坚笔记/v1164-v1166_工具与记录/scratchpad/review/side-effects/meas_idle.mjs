/* 空闲时每部手机每分钟读写多少次（真 SDK + 模拟云端） */
import { H, tally, fmt, timeline } from './meas_lib.mjs';
const DUR = Number(process.env.DUR || 120) * 1000;
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
let seq = 50;
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL);
const ISL_READY = () => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoom && window.HansenFriends);
const HOME_READY = () => !!(window.HansenAuth && document.getElementById('islandFrame'));

async function signedPhone(name, nick) {
  const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 40, consistencyLagMs: Number(process.env.LAG || 300) } });
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: PK_READY });
  const r = await H.loginPhone(p, '139000000' + (seq++));
  const prof = await p.eval(async (n) => {
    window.HansenSbProfile.setName(n);
    for (let i = 0; i < 60 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250));
    return window.HansenSbProfile.readProfile();
  }, nick);
  p.emu = emu; p.cid = prof && prof.cid;
  if (!(r && r.ok && p.cid)) console.log(`[${name}] 登录/发号没成：`, JSON.stringify(r).slice(0, 200), JSON.stringify(prof).slice(0, 120));
  return p;
}
async function measure(p, label, t0, extra) {
  await H.sleep(DUR);
  const t1 = t0 + DUR;
  const all = tally(p.emu, { t0, t1 });
  const mine = tally(p.emu, { uid: p.cloudUid, t0, t1 });
  const tl = timeline(p.emu, p.cloudUid, t0, t1, 20000);
  const frames = p.page.frames().map((f) => (f.url() || '').replace(/^https?:\/\/[^/]+\//, '').slice(0, 40));
  console.log(`\n=== ${label}（${DUR / 1000} 秒）cid=${p.cid} frames=${frames.length} [${frames.join(' | ')}]`);
  console.log(fmt(mine, DUR / 1000));
  if (all.total !== mine.total) console.log('  （全部 uid 合计 ' + all.total + '）');
  console.log('  每 20 秒 读:', tl.r.join(' '), ' 写:', tl.w.join(' '));
  if (extra) console.log('  ' + extra);
  console.log('  页面报错:', p.errors.slice(0, 3).join(' | ') || '无', ' 控制台错误:', p.consoleErrors.slice(0, 4).join(' | ') || '无', ' 外网:', p.leaks.length);
}
const scen = {
  async anon() {
    const emu = H.makeEmulator({});
    const p = await H.openPhone(browser, emu, srv.origin, { name: 'anon', path: '/island_animal.html', ready: ISL_READY });
    p.emu = emu; p.cloudUid = '';
    const t0 = Date.now();
    await measure(p, '没登录 · 岛屿页', t0);
    await p.close();
  },
  async island() {
    const p = await signedPhone('isl', '小岛');
    await p.page.goto(srv.origin + '/island_animal.html', { waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(ISL_READY, null, { timeout: 45000 });
    const t0 = Date.now();
    await H.dismissIslandWelcome(p);
    await measure(p, '已登录 · 岛屿页（直接打开）', t0);
    await p.close();
  },
  async home() {
    const p = await signedPhone('home', '小家');
    await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(HOME_READY, null, { timeout: 45000 });
    const t0 = Date.now();
    await measure(p, '已登录 · 首页（还没进岛）', t0);
    await p.close();
  },
  async homeIsland() {
    const p = await signedPhone('homeIsl', '小进');
    await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(HOME_READY, null, { timeout: 45000 });
    await H.sleep(1500);
    const t0 = Date.now();
    await p.eval(() => { try { openIsland('island_animal.html'); } catch (e) { return String(e); } });
    await measure(p, '已登录 · 首页里打开岛（iframe）', t0);
    await p.close();
  },
  async homeBack() {
    const p = await signedPhone('homeBack', '小回');
    await p.page.goto(srv.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(HOME_READY, null, { timeout: 45000 });
    await H.sleep(1500);
    await p.eval(() => { try { openIsland('island_animal.html'); } catch (e) { return String(e); } });
    await H.sleep(15000);
    await p.eval(() => { try { closeIsland(); } catch (e) { return String(e); } });
    await H.sleep(1000);
    const shown = await p.eval(() => (document.getElementById('islandFrameWrap') || {}).style.display);
    const t0 = Date.now();
    await measure(p, '已登录 · 进过一个岛又回到首页（岛藏起来了）', t0, '岛外壳 display=' + shown);
    await p.close();
  },
  async pk() {
    const p = await signedPhone('pk', '小PK');
    await p.page.reload({ waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(PK_READY, null, { timeout: 45000 });
    const t0 = Date.now();
    await measure(p, '已登录 · 拼写大PK 首页', t0);
    await p.close();
  },
  async ladder() {
    const p = await signedPhone('lad', '小梯');
    await p.page.reload({ waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(PK_READY, null, { timeout: 45000 });
    await H.sleep(800);
    const t0 = Date.now();
    await p.tap('#pkLadder'); await H.answerNameIfAsked(p, '小梯');
    const s = await p.waitScreen(/开始排位/, { timeout: 8000 }).catch((e) => e.lastText || '');
    await measure(p, '已登录 · 天梯首页开着', t0, '屏幕：' + s.replace(/\s+/g, ' ').slice(0, 100));
    await p.close();
  },
  async friends() {
    const p = await signedPhone('fr', '小友');
    await p.page.reload({ waitUntil: 'domcontentloaded' });
    await p.page.waitForFunction(PK_READY, null, { timeout: 45000 });
    await H.sleep(800);
    const t0 = Date.now();
    await p.tap('#pkFriends'); await H.answerNameIfAsked(p, '小友');
    await H.sleep(2000);
    const s = await p.screen();
    await measure(p, '已登录 · 好友页开着', t0, '屏幕：' + s.replace(/\s+/g, ' ').slice(0, 100));
    await p.close();
  },
};
const names = only.length ? only : Object.keys(scen);
await Promise.all(names.map((n, i) => H.sleep(i * 1500).then(() => scen[n]()).catch((e) => console.log('场景出错', n, e && e.stack || e))));
srv.close(); await browser.close();
