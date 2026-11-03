#!/usr/bin/env node
/* test_battle_fair_cloud_v1164.mjs —— 对战计时公平不公平、一局要花多少次云端请求（审查 F7、SE-1）
 *
 * 真页面、真对战屏、真 SDK；只有腾讯云由 cloudbase_emulator.mjs 应答。两个孩子走天梯配对、在对战屏上点键盘拼词。
 *
 *   ① 对手手机钟慢 15 秒（审查 F7）：以前对手每拿下一词，我下一词的钟从「⏱ 5s」起跑（拿对手的钟算我的截止时间）；
 *      反过来对手那边多出 15 秒。现在每一词的钟都从本机看到这一词的时刻起算：两边都是满的 20 秒。
 *   ② 对手手机钟快 10 分钟（审查 F7）：以前我这边「⏱ 617s」、一直卡在这一词；对手那边一上来就「超时了」。
 *   ③ 一局对战里每台手机每秒发多少次云端请求（审查 SE-1）：以前约 3.1 次/秒，一个班一天七万多次，免费额度撑不住。
 */
import * as H from './cloudbase_e2e_harness.mjs';

const t = H.checker('对战计时公平 · 请求量 · 真 SDK 端到端（审查 F7 / SE-1）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const flat = (s) => String(s || '').replace(/\s+/g, ' ');
let seq = 40;

async function phone(name, nick, opts = {}) {
  const p = await H.openPhone(browser, emu, srv.origin, Object.assign({ name }, opts));
  live.push(p);
  const r = await H.loginPhone(p, '137000000' + (seq++));
  await t.ok(r && r.ok && r.uid, `[${name}] 手机号验证码登录 uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
  names[r.uid] = nick; p.nick = nick; p.key = 'u' + r.uid; p.uid = r.uid;
  return p;
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}
async function clockOf(p) {
  return p.eval(() => { const el = document.getElementById('prClock'); const m = el && /(\d+)/.exec(el.textContent || ''); return m ? Number(m[1]) : null; });
}
/* 等到这部手机进了第 r 词、输入框能用，过 1.5 秒（钟已经按截止时间走过一两下）再读钟
   —— 刚画出来的那一下写的是满格，要等计时器跑起来才看得出截止时间算得对不对 */
async function enterRound(p, r, ms = 45000) {
  const v = await H.until(async () => { const b = await H.battleView(p); return b && b.round === r && !b.disabled ? b : null; }, { timeout: ms, interval: 120 });
  if (!v) return null;
  await H.sleep(1500);
  return { v, clock: await clockOf(p) };
}
async function closeAll() {
  for (const p of live) {
    await t.ok(!p.errors.length && !p.leaks.length, `[${p.name}] 没有页面报错、没有连外网（${p.errors.slice(0, 2).join(' | ') || '无'}）`);
    await p.close();
  }
  live.length = 0;
}

try {
  for (const sc of [{ off: -15000, tag: '① 对手（房主或客人）手机钟慢 15 秒', rate: true }, { off: 600000, tag: '② 对手手机钟快 10 分钟' }]) {
    t.section(sc.tag + '（审查 F7）');
    emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 40, consistencyLagMs: 300 } });
    names = {};
    const A = await phone('钟不准', '钟不准的', { clockOffsetMs: sc.off }), B = await phone('钟准', '钟准的');
    await toLadderHome(A); await toLadderHome(B);
    await A.tap('#ldGo'); await H.sleep(1200); await B.tap('#ldGo');
    const both = await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 90000, interval: 500 });
    await t.ok(!!both, '天梯配上、两边都进了对战屏', () => explain());
    if (!both) { await closeAll(); continue; }
    const R = H.roomDocs(emu).find((d) => d.kind === 'room' && (d.hostId === A.key || d.hostId === B.key) && d.status === 'playing');
    const words = R ? await H.wordsOfRoom(A, R) : [];
    await t.ok(words.length >= 3 && H.typeable(words[0]) && H.typeable(words[1]), `拿到了这一局的词（${words.slice(0, 3).map((w) => w.en).join(', ')}）`, () => explain());
    if (!(words.length >= 3 && H.typeable(words[0]) && H.typeable(words[1]))) { await closeAll(); continue; }

    /* 第 1 词：钟不准的那位先拼对 → 看钟准的这位第 2 词的钟 */
    const a0 = await enterRound(A, 0), b0 = await enterRound(B, 0);
    await t.ok(a0 && b0, `两边都到了第 1 词（钟：钟不准 ${a0 && a0.clock}s，钟准 ${b0 && b0.clock}s）`, () => explain());
    await H.typeWord(A, words[0].en);
    const b1 = await enterRound(B, 1);
    await t.ok(b1 && b1.clock >= 15 && b1.clock <= 20, `钟不准的拿下第 1 词后，钟准的这位第 2 词开始 1.5 秒后钟上还有 ${b1 && b1.clock}s（该是 18s 左右）—— 以前${sc.off < 0 ? '只剩 5 秒左右' : '600 多秒'}`, () => explain());
    /* 第 2 词：钟准的这位先拼对 → 看钟不准那位第 3 词的钟 */
    await H.typeWord(B, words[1].en);
    const a2 = await enterRound(A, 2);
    await t.ok(a2 && a2.clock >= 15 && a2.clock <= 20, `钟准的拿下第 2 词后，钟不准那位第 3 词开始 1.5 秒后钟上还有 ${a2 && a2.clock}s（该是 18s 左右）—— 以前${sc.off < 0 ? '多出 15 秒' : '一上来就超时'}`, () => explain());

    if (sc.rate) {
      /* ③ 两边都停在第 3 词上（谁都不拼）：数 12 秒里每台手机发了多少次云端请求 */
      t.section('③ 对战时每台手机每秒的云端请求（审查 SE-1）');
      const n0 = emu.log.length, t0 = Date.now();
      await H.sleep(12000);
      const secs = (Date.now() - t0) / 1000;
      const seg = emu.log.slice(n0);
      for (const p of [A, B]) {
        const mine = seg.filter((x) => x.uid === p.uid && x.method !== 'OPTIONS');
        const rate = mine.length / secs;
        const kinds = {};
        for (const x of mine) kinds[x.action || x.path] = (kinds[x.action || x.path] || 0) + 1;
        await t.ok(rate <= 1.5, `[${p.name}] 对战中每秒 ${rate.toFixed(2)} 次云端请求（${JSON.stringify(kinds)}）—— 以前约 3.1 次/秒`, () => explain());
      }
    }
    await closeAll();
  }
} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
