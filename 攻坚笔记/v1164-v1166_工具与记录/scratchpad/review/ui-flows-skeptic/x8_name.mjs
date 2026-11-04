// UI-8 skeptic: first-time name screen on spelling_pk.html with a name the profile refuses.
import { env, sleep, H, report, flat, roomDocs, myOpenRoom } from './sk.mjs';
const NAME = process.argv[2] || '明';
const rep = report(`UI-8 skeptic · name 「${NAME}」`);
const E = await env({ latencyMs: 40 });
try {
  const P = await E.phone('孩子');   // logged in, no name
  rep.log('profile name before:', JSON.stringify(await P.eval(() => HansenSbProfile.readProfile().name)));
  await P.tap('#pkLadder');
  await P.waitScreen(/先起个名字/, { timeout: 5000 });
  await P.tap('#pkNameIn'); await P.type(NAME); await P.tap('#pkNameOk');
  await sleep(800);
  const err = await P.eval(() => (document.getElementById('pkNameErr') || {}).textContent || '');
  const nameNow = await P.eval(() => HansenSbProfile.readProfile().name);
  const v = await P.eval((n) => HansenSbProfile.validateName(n), NAME);
  rep.log(`after 开始吧: screen=${flat(await P.screen(), 70)} | error line=${JSON.stringify(err)} | saved name=${JSON.stringify(nameNow)} | validateName=${JSON.stringify(v)}`);
  // go on into a ranked room and see what others see
  await P.eval(() => { window.__hsnLadderWaitSec = 2; return 1; });
  await P.tap('#ldGo');
  await P.waitScreen(/等对手进来/, { timeout: 20000 });
  const R = myOpenRoom(E.emu, P.cloudUid);
  rep.log('the ranked room shows this kid to everyone as:', JSON.stringify(R && R.hostName));
  await P.tap('#prBack');                      // 不等了 -> ladder home
  await P.waitScreen(/开始排位/, { timeout: 8000 });
  await P.tap('#ldX');
  await sleep(500);
  await P.tap('#pkLadder');
  await sleep(600);
  rep.log('tapping 天梯排位 again ->', flat(await P.screen(), 60));
  rep.log('errors', P.errors, 'dialogs', P.dialogs.map((d) => d.message));
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
