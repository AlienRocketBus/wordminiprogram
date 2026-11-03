// EXP7: first-time name screen on spelling_pk.html (「✏️ 先起个名字」).
//   a) a one-character name (very common for a Chinese kid: 「明」) / a name the profile refuses
//   b) a valid name, then ladder × -> is the PK home usable again (v1164 fix)
import { setup, docs, sleep, report, H } from './lib.mjs';
const rep = report('EXP7 name screen');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 200 });
try {
  for (const name of ['明', '管理员小明']) {
    const P = await env.phone('甲' + name, { setName: false });
    await P.tap('#pkLadder');
    await P.waitScreen(/先起个名字/, { timeout: 6000 });
    await P.tap('#pkNameIn'); await P.type(name); await P.tap('#pkNameOk');
    await sleep(1200);
    const s = (await P.screen()).replace(/\s+/g, ' ').slice(0, 90);
    const err = await P.eval(() => (document.getElementById('pkNameErr') || {}).textContent || '');
    const saved = await P.eval(() => window.HansenSbProfile.readProfile().name);
    const why = await P.eval((n) => JSON.stringify(window.HansenSbProfile.validateName(n)), name);
    rep.log(`typed 「${name}」 + 开始吧 -> screen: ${s} | error line: ${JSON.stringify(err)} | saved name: ${JSON.stringify(saved)} | validateName says ${why}`);
    rep.expect(saved === name || err, `「${name}」: either saved, or the screen says why not`);
    if (/开始排位/.test(s)) {
      await P.tap('#ldGo');
      await P.waitScreen(/等对手进来/, { timeout: 40000 }).catch(() => '');
      const R = docs(env.emu).find((d) => d.kind === 'room' && d._openid === P.cloudUid && d.status === 'open');
      rep.log(`its ranked room shows the kid to everyone as: ${JSON.stringify(R && R.hostName)}`);
      await P.tap('#prBack').catch(() => {});
      await sleep(800);
      await P.tap('#ldX').catch(() => {});
      await sleep(600);
      await P.tap('#pkLadder');
      await sleep(800);
      const again = (await P.screen()).replace(/\s+/g, ' ').slice(0, 60);
      rep.log(`tapping 天梯排位 again -> ${again}`);
    }
    await P.close();
  }
  // b) valid name -> ladder -> × -> home usable
  const Q = await env.phone('乙', { setName: false });
  await Q.tap('#pkLadder');
  await H.answerNameIfAsked(Q, '小明明');
  await Q.waitScreen(/开始排位/, { timeout: 6000 });
  await Q.tap('#ldX'); await sleep(600);
  const hits = {};
  for (const sel of ['#pkRooms', '#pkLadder', '#pkFriends', '#pkMe']) hits[sel] = (await Q.hitTest(sel, { timeout: 1500 })).ok;
  rep.log('after name -> ladder -> ×, PK home buttons tappable:', hits);
  rep.expect(Object.values(hits).every(Boolean), 'PK home is usable after the first-time name screen');
  // c) name screen -> 返回
  const S2 = await env.phone('丙', { setName: false });
  await S2.tap('#pkRooms');
  await S2.waitScreen(/先起个名字/, { timeout: 6000 });
  await S2.tap('#pkNameBack');
  await sleep(2500);
  rep.log('name screen 返回 ->', (await S2.screen()).replace(/\s+/g, ' ').slice(0, 60));
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
