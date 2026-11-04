// 360px (and 320px) pass over key screens: horizontal overflow + clipped text + key/score geometry.
// Also: does a real touch tap on an entry card leave a visible focus ring on the overlay's close button?
import { startServer, launch, newCtx, islandPage, openPage, capture, wire, shot } from './lib.mjs';
import fs from 'node:fs';

const { srv, base } = await startServer();
const browser = await launch();
const summary = {};
const W = [360, 320];
const clipCheck = sel => `(() => { const out=[]; document.querySelectorAll('${sel} *').forEach(e=>{ if(!e.getClientRects().length) return; const cs=getComputedStyle(e); if((cs.overflow==='hidden'||cs.textOverflow==='ellipsis') && e.scrollWidth>e.clientWidth+1) out.push((e.innerText||'').slice(0,24)+' ['+e.clientWidth+'/'+e.scrollWidth+']'); }); return out; })()`;

for (const width of W) {
  const ctx = await newCtx(browser, { theme: 'dark', width });
  const pg = await islandPage(ctx, base);
  const sfx = '_' + width;
  const rec = async (name, root) => { const m = await capture(pg, name + sfx, root); m.clipped = await pg.evaluate(clipCheck(root)); summary[name + sfx] = { ov: m.overflow.scrollW + '/' + m.overflow.vw, bad: m.overflow.bad.slice(0, 4), clipped: m.clipped, tapFails: m.tapFails.map(x => x.t + ' ' + x.w + 'x' + x.h) }; };

  await pg.evaluate(() => openSpellPK()); await pg.waitForTimeout(600);
  await rec('60_pk_inpage', '#hsn_pk_screen');
  await pg.evaluate(() => window.HansenSbPK.close());

  await wire(pg, {});
  await pg.evaluate(() => {
    const R = window.HansenPkRecord; R._reset();
    for (let i = 0; i < 5; i++) R.record({ mode: 'A', result: i === 1 ? 'lose' : 'win', oppName: '王小明同学的超长名字啊', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 20000, firstWins: 3, fastestMs: 1800 });
    window.HansenLadderBoard.fetchTop = async () => ({ ok: true, myRank: 2, list: [{ uid: 'A', name: '王小明同学的超长名字啊', rating: 1462 }, { uid: 'ME', name: '小明', rating: 1090 }] });
    window.HansenLadderUI.open();
  });
  await pg.waitForTimeout(900);
  await rec('61_ladder_home', '#hsn_ladder_screen');
  await pg.evaluate(() => document.getElementById('ldGo').click()); await pg.waitForTimeout(1200);
  await rec('62_ladder_matching', '#hsn_ladder_screen');
  await pg.evaluate(() => window.HansenLadderUI.close());

  const now = Date.now();
  await wire(pg, { rooms: [
    { _id: '1', status: 'open', isPrivate: false, guestId: '', hostId: 'H1', hostName: '王小明同学的超长名字啊', hostRating: 1820, mode: 'A', wordCount: 5, heartbeatAt: now, createdAt: now - 130000 },
    { _id: '2', status: 'open', isPrivate: false, guestId: '', hostId: 'H2', hostName: '小红', hostRating: 0, mode: 'C', wordCount: 5, heartbeatAt: now, createdAt: now - 5000 }] });
  await pg.evaluate(() => window.HansenPkRoomUI.open()); await pg.waitForTimeout(1100);
  await rec('63_lobby', '#hsn_pkroom_screen');
  await pg.evaluate(() => document.getElementById('prNew').click()); await pg.waitForTimeout(400);
  await rec('64_chooser', '#hsn_pkroom_screen');
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenPkRoomUI.open()); await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('prPriv').click()); await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('.pr_mode[data-mode=A]').click()); await pg.waitForTimeout(1800);
  await rec('65_waiting_private', '#hsn_pkroom_screen');
  await pg.evaluate(() => window.HansenPkRoomUI.close());

  // battle with a long opponent name and 3-digit scores
  await pg.evaluate(() => {
    const doc = { _id: 'R', hostId: 'ME', guestId: 'G', mode: 'A', askMode: 'cn', round: 0, winners: [], wordCount: 10,
      hostBeat: Date.now(), guestBeat: Date.now(), createdAt: Date.now(), roundAt: Date.now(), hostScore: null, guestScore: null, status: 'playing' };
    window.__doc = doc;
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '小明' });
    window.HansenPkRoom._setTransportForTest({ read: async () => { doc.guestBeat = Date.now(); return JSON.parse(JSON.stringify(doc)); },
      claim: async (id, g, p) => { for (const k of Object.keys(g)) if (doc[k] !== g[k]) return { updated: 0 }; Object.assign(doc, p); return { updated: 1 }; },
      patch: async (id, p) => { Object.assign(doc, p); return { updated: 1 }; }, add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => [] });
    const W = 'strawberry,banana,apple,noodles,milk,bread,juice,rice,egg,cake'.split(',').map(e => ({ en: e, cn: '词' }));
    W[0].cn = '草莓';
    window.HansenPkRoomUI._startMatchForTest(W, '王小明同学的超长名字啊', 'cn', 'A', 'R');
  });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const d = window.__doc; d.winners = ['guest', 'guest']; d.round = 2; });
  await pg.waitForTimeout(1300);
  await rec('66_battle_longname', '#hsn_pkroom_screen');
  summary['66_geom' + sfx] = await pg.evaluate(() => {
    const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const keys = [...document.querySelectorAll('.pr_key')].map(k => k.getBoundingClientRect().width);
    return { my: b('#prMy'), opp: b('#prOpp'), clock: b('#prClock'), sub: b('#hsn_pkroom_screen .pr_sub'), scoreRow: b('#hsn_pkroom_screen .pr_top .pr_h'), keyMin: Math.round(Math.min(...keys)), keyMax: Math.round(Math.max(...keys)) };
  });
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  await pg.close();
  await ctx.close();
}

// focus ring after a real touch tap (standalone page, entry cards are real buttons)
{
  const ctx = await newCtx(browser, { theme: 'dark', width: 390 });
  const pg = await openPage(ctx, base, 'spelling_pk.html', 4600);
  await wire(pg, {});
  await pg.evaluate(() => { window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] }); });
  await pg.tap('#pkLadder');
  await pg.waitForTimeout(900);
  summary['focus_after_tap'] = await pg.evaluate(() => { const a = document.activeElement; return { id: a && a.id, focusVisible: a ? a.matches(':focus-visible') : null, outline: a ? getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth : null }; });
  await shot(pg, '67_ladder_after_real_tap_focusring_check');
  await pg.close(); await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s07_summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
await browser.close(); srv.close();
