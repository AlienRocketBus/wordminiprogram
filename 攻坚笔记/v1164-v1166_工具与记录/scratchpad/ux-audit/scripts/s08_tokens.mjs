// Computed-style inventory: compare island/home building blocks vs. battle overlays.
import { startServer, launch, newCtx, islandPage, openPage, wire, capture } from './lib.mjs';
import fs from 'node:fs';

const { srv, base } = await startServer();
const browser = await launch();
const out = {};
const pick = `(sel) => { const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); const r=e.getBoundingClientRect();
  return { sel, font: c.fontFamily.slice(0,60), size: c.fontSize, weight: c.fontWeight, radius: c.borderRadius, bg: (c.backgroundImage!=='none'?c.backgroundImage.slice(0,90):c.backgroundColor), color: c.color, shadow: c.boxShadow.slice(0,60), textShadow: c.textShadow.slice(0,40), h: Math.round(r.height), w: Math.round(r.width) }; }`;

for (const theme of ['dark', 'light']) {
  const ctx = await newCtx(browser, { theme });
  const pg = await islandPage(ctx, base);
  out['island_' + theme] = await pg.evaluate(`(${pick.replace(/\n/g, ' ')}, [ '.mode-card', '.m-title', '.screen-title', '.game-btn', '.game-btn.gold', '.top-bar', '.bottom-nav', 'body' ].map(s => (${pick.replace(/\n/g, ' ')})(s)))`).catch(e => String(e));
  await pg.evaluate(() => openSpellPK()); await pg.waitForTimeout(500);
  out['pkinpage_' + theme] = await pg.evaluate(`[ '#hsn_pk_screen', '#hsn_pk_screen .k_h1', '#hsn_pk_screen .k_card', '#hsn_pk_screen .k_back', '#hsn_pk_screen .k_ab.primary', '#hsn_pk_screen .k_t' ].map(s => (${pick.replace(/\n/g, ' ')})(s))`);
  await pg.evaluate(() => window.HansenSbPK.close());
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenPkRoomUI.open()); await pg.waitForTimeout(800);
  out['room_' + theme] = await pg.evaluate(`[ '#hsn_pkroom_screen', '#hsn_pkroom_screen .pr_h', '#hsn_pkroom_screen .pr_back', '#prNew', '#prPriv', '#hsn_pkroom_screen .pr_empty' ].map(s => (${pick.replace(/\n/g, ' ')})(s))`);
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  await pg.evaluate(() => { window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] }); window.HansenLadderUI.open(); }); await pg.waitForTimeout(700);
  out['ladder_' + theme] = await pg.evaluate(`[ '#hsn_ladder_screen', '#hsn_ladder_screen .ld_h', '#hsn_ladder_screen .ld_card', '#ldGo', '#hsn_ladder_screen .ld_x' ].map(s => (${pick.replace(/\n/g, ' ')})(s))`);
  await pg.evaluate(() => window.HansenLadderUI.close());
  await pg.close();

  // standalone page battle (light) to check the input box there too
  const p2 = await openPage(ctx, base, 'spelling_pk.html', 4600);
  await p2.evaluate(() => {
    const doc = { _id: 'R', hostId: 'ME', guestId: 'G', mode: 'A', askMode: 'cn', round: 0, winners: [], wordCount: 3, hostBeat: Date.now(), guestBeat: Date.now(), createdAt: Date.now(), roundAt: Date.now() };
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '小明' });
    window.HansenPkRoom._setTransportForTest({ read: async () => JSON.parse(JSON.stringify(doc)), claim: async () => ({ updated: 1 }), patch: async () => ({ updated: 1 }), add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => [] });
    window.HansenPkRoomUI._startMatchForTest([{ en: 'apple', cn: '苹果' }, { en: 'milk', cn: '牛奶' }], '对手', 'cn', 'A', 'R');
  });
  await p2.waitForTimeout(1500);
  await p2.evaluate(async () => { for (const ch of 'ap') { document.querySelector('.pr_key[data-k="' + ch + '"]').click(); } });
  await p2.waitForTimeout(300);
  const m = await capture(p2, `39_battle_A_midround_standalone_${theme}`, '#hsn_pkroom_screen');
  out['standalone_battle_input_' + theme] = await p2.evaluate(() => { const i = document.getElementById('prIn'); return __ratio(i, 'rgb(244,246,251)'); });
  out['standalone_battle_header_' + theme] = await p2.evaluate(() => { const b = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; return { my: b('#prMy'), opp: b('#prOpp'), clock: b('#prClock'), font: getComputedStyle(document.querySelector('#hsn_pkroom_screen')).fontFamily }; });
  await p2.close();
  await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s08_tokens.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 12000));
await browser.close(); srv.close();
