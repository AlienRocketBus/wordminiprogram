// Ladder: home (unranked+empty board / ranked+populated board / board error), matching, offline, need-login.
import { startServer, launch, newCtx, islandPage, capture, wire, shot } from './lib.mjs';

const { srv, base } = await startServer();
const browser = await launch();
const width = Number(process.env.W || 390);
const sfx = width === 390 ? '' : '_' + width;
const themes = (process.env.THEMES || 'dark,light').split(',');
const summary = {};

const BOARD = [
  ['阿强', 1462], ['Lucy', 1388], ['小红', 1310], ['王小明同学的超长名字', 1250], ['朵朵', 1188],
  ['小明', 1108, 'ME'], ['乐乐', 1062], ['豆豆', 1040], ['Tom', 1015], ['妞妞', 1000]
];

for (const theme of themes) {
  const ctx = await newCtx(browser, { theme, width });

  // ── 1. unranked, empty board, no games
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, {});
    await pg.evaluate(() => {
      window.HansenPkRecord._reset();
      window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] });
      window.HansenLadderUI.open();
    });
    await pg.waitForTimeout(900);
    summary['ladder_unranked_' + theme] = await capture(pg, `10_ladder_home_unranked_emptyboard_${theme}${sfx}`, '#hsn_ladder_screen');
    await shot(pg, `10_ladder_home_unranked_emptyboard_${theme}${sfx}_full`, true);
    // scroll inside the overlay to show the board
    await pg.evaluate(() => { const l = document.getElementById('hsn_ladder_screen'); l.scrollTop = l.scrollHeight; });
    await pg.waitForTimeout(200);
    await shot(pg, `10_ladder_home_unranked_emptyboard_${theme}${sfx}_bottom`);
    await pg.close();
  }

  // ── 2. ranked, populated board, history
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, {});
    await pg.evaluate((B) => {
      const R = window.HansenPkRecord; R._reset();
      const res = ['win', 'win', 'lose', 'win', 'win', 'win', 'lose', 'win'];
      const opp = ['阿强', 'Lucy', '小红', '朵朵', '乐乐', '豆豆', 'Tom', '妞妞'];
      res.forEach((r, i) => R.record({ mode: i === 6 ? 'C' : 'A', result: r, oppName: opp[i], oppRating: 1050,
        myScore: r === 'win' ? 300 : 100, oppScore: r === 'win' ? 100 : 300, words: 5, correct: r === 'win' ? 4 : 2,
        totalMs: 21000, firstWins: r === 'win' ? 3 : 1, fastestMs: 1900 }));
      window.HansenLadderBoard.fetchTop = async () => ({ ok: true, myRank: 6, list:
        B.map((x, i) => ({ rank: i + 1, uid: x[2] || ('U' + i), name: x[0], cid: i + 1, rating: x[1], games: 9 })) });
      window.HansenLadderUI.open();
    }, BOARD);
    await pg.waitForTimeout(900);
    summary['ladder_ranked_' + theme] = await capture(pg, `11_ladder_home_ranked_board_${theme}${sfx}`, '#hsn_ladder_screen');
    await shot(pg, `11_ladder_home_ranked_board_${theme}${sfx}_full`, true);
    // full content of overlay: take tall screenshot by expanding viewport
    const h = await pg.evaluate(() => document.querySelector('#hsn_ladder_screen .ld_wrap').scrollHeight);
    await pg.setViewportSize({ width, height: Math.min(h + 20, 4000) });
    await pg.waitForTimeout(300);
    await shot(pg, `11_ladder_home_ranked_board_${theme}${sfx}_tall`);
    await pg.setViewportSize({ width, height: 844 });
    // measure the "me" row contrast specifically
    summary['ladder_me_row_' + theme] = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll('#ldBoard > div')];
      const me = rows.find(r => /\(你\)/.test(r.innerText));
      const nameSpan = me && me.querySelector('span:nth-child(2)');
      return me ? __ratio(nameSpan, getComputedStyle(document.getElementById('hsn_ladder_screen')).backgroundColor) : null;
    });
    await pg.close();
  }

  // ── 3. board fetch fails + ranked but outside top 20 (myRoughRank)
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, {});
    await pg.evaluate(() => {
      const R = window.HansenPkRecord; R._reset();
      for (let i = 0; i < 3; i++) R.record({ mode: 'A', result: 'win', oppName: '小红', myScore: 300, oppScore: 100, words: 5, correct: 4, totalMs: 20000, firstWins: 3, fastestMs: 2100 });
      window.HansenLadderBoard.fetchTop = async () => ({ ok: false, reason: 'net' });
      window.HansenLadderUI.open();
    });
    await pg.waitForTimeout(900);
    await pg.evaluate(() => { const l = document.getElementById('hsn_ladder_screen'); l.scrollTop = l.scrollHeight; });
    await pg.waitForTimeout(200);
    summary['ladder_boardfail_' + theme] = await capture(pg, `12_ladder_home_boardfail_${theme}${sfx}`, '#hsn_ladder_screen');
    await pg.close();
  }

  // ── 4. matching screen (no rooms, stays searching), capture at 1s and ~9s
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, { waitSec: 600 });
    await pg.evaluate(() => { window.HansenPkRecord._reset(); window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] }); window.HansenLadderUI.open(); });
    await pg.waitForTimeout(700);
    await pg.evaluate(() => document.getElementById('ldGo').click());
    await pg.waitForTimeout(1200);
    summary['matching_1s_' + theme] = await capture(pg, `13_ladder_matching_1s_${theme}${sfx}`, '#hsn_ladder_screen');
    // record how the "已等 N 秒" text evolves each 500ms and whether DOM is rebuilt (animation restart)
    const timeline = await pg.evaluate(async () => {
      const out = []; let lastNode = null;
      for (let i = 0; i < 20; i++) {
        const card = document.querySelector('#hsn_ladder_screen .ld_card');
        const t = card ? card.innerText.replace(/\s+/g, ' ') : '';
        const m = t.match(/已等 (\d+) 秒/);
        out.push({ ms: i * 500, waited: m ? +m[1] : null, rebuilt: card !== lastNode, focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName) });
        lastNode = card;
        await new Promise(r => setTimeout(r, 500));
      }
      return out;
    });
    summary['matching_timeline_' + theme] = timeline;
    summary['matching_10s_' + theme] = await capture(pg, `13_ladder_matching_10s_${theme}${sfx}`, '#hsn_ladder_screen');
    await pg.close();
  }

  // ── 5. offline → 连不上网络
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, { offline: true });
    await pg.evaluate(() => { window.HansenPkRecord._reset(); window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] }); window.HansenLadderUI.open(); });
    await pg.waitForTimeout(700);
    const t0 = Date.now();
    await pg.evaluate(() => document.getElementById('ldGo').click());
    let secs = null;
    for (let i = 0; i < 40; i++) {
      await pg.waitForTimeout(500);
      const s = await pg.evaluate(() => (document.querySelector('#hsn_ladder_screen') || {}).innerText || '');
      if (/连不上网络/.test(s)) { secs = (Date.now() - t0) / 1000; break; }
    }
    summary['offline_after_s_' + theme] = secs;
    summary['offline_' + theme] = await capture(pg, `14_ladder_offline_${theme}${sfx}`, '#hsn_ladder_screen');
    await pg.close();
  }

  // ── 6. need login: (a) cloud says not signed in → showNeedLogin ; (b) not signed in locally → native confirm()
  {
    const pg = await islandPage(ctx, base);
    await wire(pg, {});
    await pg.evaluate(() => {
      window.HansenPkRecord._reset(); window.HansenLadderBoard.fetchTop = async () => ({ ok: false, reason: 'not-signed-in' });
      // listRooms returns {ok:false, reason:'请先登录…'} like a failed ensureSession
      window.HansenPkRoom.listRooms = async () => ({ ok: false, reason: '请先登录再开房', rooms: [] });
      window.HansenLadderUI.open();
    });
    await pg.waitForTimeout(700);
    await pg.evaluate(() => document.getElementById('ldGo').click());
    await pg.waitForTimeout(1500);
    summary['needlogin_' + theme] = await capture(pg, `15_ladder_needlogin_${theme}${sfx}`, '#hsn_ladder_screen');
    // (b)
    await pg.evaluate(() => { localStorage.removeItem('hansen_auth_v1004'); window.HansenLadderUI.open(); });
    await pg.waitForTimeout(500);
    await pg.evaluate(() => document.getElementById('ldGo').click());
    await pg.waitForTimeout(600);
    summary['needlogin_native_' + theme] = pg.__errs.filter(x => /DIALOG/.test(x));
    await pg.close();
  }
  await ctx.close();
}
const fs = await import('node:fs');
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s03_summary' + sfx + '.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v && v.contrastFails ? { cf: v.contrastFails.map(x => x.t + ' ' + x.ratio + '/' + x.need), tf: v.tapFails.map(x => x.t + ' ' + x.w + 'x' + x.h), ov: v.overflow.scrollW + '/' + v.overflow.vw, errs: v.errs } : v])), null, 1));
await browser.close(); srv.close();
