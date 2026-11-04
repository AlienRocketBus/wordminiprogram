// Battle screen: modes A/B/C × (mid-round typing, I scored, opponent scored, last-5s, timeout), TTS ask mode,
// net-warning bar, opponent-idle warning, submitted/waiting-for-result, results (win/lose/draw).
import { startServer, launch, newCtx, islandPage, openPage, capture, shot } from './lib.mjs';
import fs from 'node:fs';

const { srv, base } = await startServer();
const browser = await launch();
const width = Number(process.env.W || 390);
const sfx = width === 390 ? '' : '_' + width;
const themes = (process.env.THEMES || 'dark,light').split(',');
const host = process.env.HOST || 'island';
const summary = {};
const R = '#hsn_pkroom_screen';

const WORDS = [{ en: 'apple', cn: '苹果' }, { en: 'banana', cn: '香蕉' }, { en: 'noodles', cn: '面条' }];

async function battle(pg, mode, askMode, words, opts = {}) {
  await pg.evaluate(([mode, askMode, words, opts]) => {
    try { window.HansenPkRoomUI.close(); } catch (e) {}
    const doc = { _id: 'R', hostId: 'ME', guestId: 'G', mode, askMode, round: 0, winners: [], wordCount: words.length,
      hostBeat: Date.now(), guestBeat: Date.now(), createdAt: Date.now(), roundAt: Date.now(), startedAt: Date.now(),
      hostScore: null, guestScore: opts.guestScore == null ? null : opts.guestScore, status: 'playing', hostRating: 1000 };
    window.__doc = doc; window.__dead = false; window.__oppIdle = false;
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '小明' });
    window.HansenPkRoom._setTransportForTest({
      read: async () => { if (window.__dead) throw new TypeError('Failed to fetch'); if (!window.__oppIdle) doc.guestBeat = Date.now(); return JSON.parse(JSON.stringify(doc)); },
      claim: async (id, g, p) => { for (const k of Object.keys(g)) if (doc[k] !== g[k]) return { updated: 0 }; Object.assign(doc, p); return { updated: 1 }; },
      patch: async (id, p) => { Object.assign(doc, p); return { updated: 1 }; },
      add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => []
    });
    window.HansenPkRoomUI._startMatchForTest(words, opts.opp || '小红', askMode, mode, 'R');
  }, [mode, askMode, words, opts]);
  await pg.waitForTimeout(1600);
}
const type = (pg, s) => pg.evaluate(async s => {
  for (const ch of s) { const k = document.querySelector('.pr_key[data-k="' + ch + '"]'); if (k) k.click(); await new Promise(r => setTimeout(r, 60)); }
}, s);
const oppTakes = (pg, idx) => pg.evaluate(idx => { const d = window.__doc; d.winners = d.winners.concat(['guest']); d.round = idx + 1; d.roundAt = Date.now(); }, idx);

for (const theme of themes) {
  const ctx = await newCtx(browser, { theme, width });
  const pg = host === 'island' ? await islandPage(ctx, base) : await openPage(ctx, base, 'spelling_pk.html', 4600);
  await pg.evaluate(() => { window.HansenPkRecord._reset(); });

  for (const mode of ['A', 'B', 'C']) {
    // mid-round with 2 letters typed
    await battle(pg, mode, 'cn', WORDS);
    await type(pg, 'ap');
    await pg.waitForTimeout(300);
    summary[`mid_${mode}_${theme}`] = await capture(pg, `30_battle_${mode}_midround_${theme}${sfx}`, R);
    // header geometry
    summary[`geom_${mode}_${theme}`] = await pg.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), fs: getComputedStyle(e).fontSize, txt: (e.innerText || e.value || '').slice(0, 40) }; };
      const keys = [...document.querySelectorAll('.pr_key')].map(k => k.getBoundingClientRect());
      return { top: r('#hsn_pkroom_screen .pr_top'), scoreRow: r('#hsn_pkroom_screen .pr_top .pr_h'), sub: r('#hsn_pkroom_screen .pr_top .pr_sub'),
        clock: r('#prClock'), my: r('#prMy'), opp: r('#prOpp'), cn: r('#hsn_pkroom_screen .pr_cn'), hint: r('#hsn_pkroom_screen .pr_word'), input: r('#prIn'), oppSt: r('#prHint'), kb: r('#prKb'),
        keyW: keys.length ? [Math.round(Math.min(...keys.map(k => k.width))), Math.round(Math.max(...keys.map(k => k.width)))] : null,
        keyH: keys.length ? Math.round(keys[0].height) : null, vh: innerHeight,
        kbBottom: keys.length ? Math.round(Math.max(...keys.map(k => k.bottom))) : null };
    });
    // opponent scores this word
    await oppTakes(pg, 0);
    await pg.waitForTimeout(1150);
    summary[`oppscored_${mode}_${theme}`] = await capture(pg, `31_battle_${mode}_opp_scored_${theme}${sfx}`, R);
    // what does the hint/status show 200ms after detection? (sample a few times)
    // now on word 2: I score
    await pg.waitForTimeout(1200);
    await type(pg, 'banana');
    await pg.waitForTimeout(350);
    summary[`iscored_${mode}_${theme}`] = await capture(pg, `32_battle_${mode}_i_scored_${theme}${sfx}`, R);
    await pg.waitForTimeout(1500);
    // word 3: last 5 seconds, then timeout
    await pg.evaluate(() => { const rt = window.HansenPkRoomUI._rtForTest(); if (rt) rt.deadline = Date.now() + 4300; });
    await pg.waitForTimeout(1300);
    summary[`last5_${mode}_${theme}`] = await capture(pg, `33_battle_${mode}_last5s_${theme}${sfx}`, R);
    await pg.waitForTimeout(3600);
    summary[`timeout_${mode}_${theme}`] = await capture(pg, `34_battle_${mode}_timeout_${theme}${sfx}`, R);
    await pg.waitForTimeout(1600);
    // after the 3rd word → 交卷 / waiting for opponent result (guestScore null)
    summary[`submitted_${mode}_${theme}`] = await capture(pg, `35_battle_${mode}_submitted_waiting_${theme}${sfx}`, R);
  }

  // TTS ask mode
  await battle(pg, 'A', 'tts', WORDS);
  summary[`tts_${theme}`] = await capture(pg, `36_battle_A_tts_${theme}${sfx}`, R);

  // net warning bar
  await battle(pg, 'A', 'cn', WORDS);
  await pg.evaluate(() => { window.__dead = true; });
  await pg.waitForTimeout(6500);
  summary[`netwarn_${theme}`] = await capture(pg, `37_battle_netwarn_${theme}${sfx}`, R);

  // opponent idle warning
  await battle(pg, 'C', 'cn', WORDS);
  await pg.evaluate(() => { window.__oppIdle = true; window.__doc.guestBeat = Date.now() - 30000; });
  await pg.waitForTimeout(5200);
  summary[`oppidle_${theme}`] = await capture(pg, `38_battle_opp_idle_${theme}${sfx}`, R);

  // results: 1-word matches. win (A ranked), lose (A ranked), draw (C)
  for (const [res, mode, guestScore] of [['win', 'A', 0], ['lose', 'A', 200], ['draw', 'C', 100]]) {
    await battle(pg, mode, 'cn', [{ en: 'apple', cn: '苹果' }], { guestScore });
    await type(pg, 'apple');
    await pg.waitForTimeout(3200);
    summary[`result_${res}_${theme}`] = await capture(pg, `40_result_${res}_${mode}_${theme}${sfx}`, R);
    const h = await pg.evaluate(() => { const w = document.querySelector('#hsn_pkroom_screen .pr_wrap'); return w ? w.scrollHeight : 0; });
    summary[`result_${res}_h_${theme}`] = h;
  }
  summary[`errs_${theme}`] = pg.__errs;
  await pg.close();
  await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s05_summary' + sfx + (host === 'island' ? '' : '_' + host) + '.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v && v.contrastFails ? { text: v.text.slice(0, 160), cf: v.contrastFails.map(x => x.t + ' ' + x.ratio + '/' + x.need), tf: v.tapFails.length, ov: v.overflow.scrollW + '/' + v.overflow.vw, errs: v.errs.length } : v])), null, 1));
await browser.close(); srv.close();
