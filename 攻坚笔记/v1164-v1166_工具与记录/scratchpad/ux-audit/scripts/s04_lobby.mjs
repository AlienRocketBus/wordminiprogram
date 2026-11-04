// Room lobby (empty / several rooms / error), mode chooser, waiting (public / private code), room taken (ladder)
import { startServer, launch, newCtx, islandPage, capture, wire, shot } from './lib.mjs';
import fs from 'node:fs';

const { srv, base } = await startServer();
const browser = await launch();
const width = Number(process.env.W || 390);
const sfx = width === 390 ? '' : '_' + width;
const themes = (process.env.THEMES || 'dark,light').split(',');
const summary = {};
const R = '#hsn_pkroom_screen';

function roomsFixture() {
  const now = Date.now();
  const mk = (id, name, mode, rating, ageS, tier) => ({ _id: id, status: 'open', isPrivate: false, guestId: '', hostId: 'H' + id,
    hostName: name, hostRating: rating, hostTier: tier || '', mode, askMode: 'cn', wordCount: 5, seed: 1, winners: [], round: 0,
    heartbeatAt: now, createdAt: now - ageS * 1000 });
  return [mk('1', '小红', 'A', 1450, 12), mk('2', '阿强', 'C', 0, 45), mk('3', '王小明同学的超长名字啊', 'B', 1210, 130),
    mk('4', 'Lucy', 'A', 1820, 300), mk('5', '豆豆', 'C', 1000, 8, '🐝 工蜂'), mk('6', '朵朵', 'B', 0, 600)];
}

for (const theme of themes) {
  const ctx = await newCtx(browser, { theme, width });
  const pg = await islandPage(ctx, base);

  // empty lobby
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenPkRoomUI.open());
  await pg.waitForTimeout(1200);
  summary['lobby_empty_' + theme] = await capture(pg, `20_lobby_empty_${theme}${sfx}`, R);
  // open the room-code <details>
  await pg.evaluate(() => { const d = document.querySelector('#hsn_pkroom_screen details'); if (d) d.open = true; });
  await pg.waitForTimeout(200);
  await pg.evaluate(() => document.getElementById('prJoinCode').click());
  await pg.waitForTimeout(400);
  summary['lobby_code_open_' + theme] = await capture(pg, `20b_lobby_code_empty_submit_${theme}${sfx}`, R);

  // populated lobby
  await wire(pg, { rooms: roomsFixture() });
  await pg.evaluate(() => window.HansenPkRoomUI.open());
  await pg.waitForTimeout(1200);
  summary['lobby_rooms_' + theme] = await capture(pg, `21_lobby_rooms_${theme}${sfx}`, R);

  // lobby network error
  await wire(pg, { offline: true });
  await pg.evaluate(() => window.HansenPkRoomUI.open());
  await pg.waitForTimeout(1500);
  summary['lobby_error_' + theme] = await capture(pg, `22_lobby_error_offline_${theme}${sfx}`, R);

  // mode chooser
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenPkRoomUI.open());
  await pg.waitForTimeout(900);
  await pg.evaluate(() => document.getElementById('prNew').click());
  await pg.waitForTimeout(500);
  summary['chooser_' + theme] = await capture(pg, `23_mode_chooser_${theme}${sfx}`, R);
  const h = await pg.evaluate(() => document.querySelector('#hsn_pkroom_screen .pr_wrap').scrollHeight);
  await pg.setViewportSize({ width, height: Math.min(h + 10, 3000) });
  await pg.waitForTimeout(250);
  await shot(pg, `23_mode_chooser_${theme}${sfx}_tall`);
  await pg.setViewportSize({ width, height: 844 });
  // tap the 听发音 option to see the selected state
  await pg.evaluate(() => document.querySelector('.pr_ask[data-ask=tts]').click());
  await pg.waitForTimeout(300);
  summary['chooser_tts_' + theme] = await capture(pg, `23b_mode_chooser_tts_selected_${theme}${sfx}`, R);
  await pg.evaluate(() => document.querySelector('.pr_ask[data-ask=cn]').click());

  // waiting (public) — pick mode C
  await pg.evaluate(() => document.querySelector('.pr_mode[data-mode=C]').click());
  await pg.waitForTimeout(3300);
  summary['wait_public_' + theme] = await capture(pg, `24_waiting_public_${theme}${sfx}`, R);

  // waiting (private code)
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenPkRoomUI.open());
  await pg.waitForTimeout(800);
  await pg.evaluate(() => document.getElementById('prPriv').click());
  await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('.pr_mode[data-mode=A]').click());
  await pg.waitForTimeout(2300);
  summary['wait_private_' + theme] = await capture(pg, `25_waiting_private_code_${theme}${sfx}`, R);
  await pg.evaluate(() => document.getElementById('prCopy').click());
  await pg.waitForTimeout(400);
  summary['wait_private_copied_' + theme] = await capture(pg, `25b_waiting_private_copy_tapped_${theme}${sfx}`, R);
  await pg.evaluate(() => window.HansenPkRoomUI.close());

  // ladder: room taken screen
  await wire(pg, { claimFails: true, rooms: [{ _id: 'TAKEN', status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '对手', hostRating: 1000, mode: 'A', askMode: 'cn', wordCount: 5, seed: 1, winners: [], round: 0,
    heartbeatAt: Date.now(), createdAt: Date.now() }] });
  await pg.evaluate(() => { window.HansenPkRecord._reset(); window.HansenLadderBoard.fetchTop = async () => ({ ok: true, list: [] }); window.HansenLadderUI.open(); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(2500);
  summary['ladder_taken_' + theme] = await capture(pg, `16_ladder_room_taken_${theme}${sfx}`, R);
  await pg.evaluate(() => window.HansenPkRoomUI.close());

  // ladder: no rival → auto-create ranked room → waiting screen (what the ladder player sees)
  await wire(pg, { rooms: [], waitSec: 2 });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  const seq = [];
  for (let i = 0; i < 16; i++) {
    await pg.waitForTimeout(400);
    seq.push(await pg.evaluate(() => {
      const r = document.getElementById('hsn_pkroom_screen'), l = document.getElementById('hsn_ladder_screen');
      const vis = e => !!(e && e.classList.contains('on'));
      return (vis(l) ? 'L:' + (l.innerText || '').replace(/\s+/g, ' ').slice(0, 30) : '') + (vis(r) ? ' R:' + (r.innerText || '').replace(/\s+/g, ' ').slice(0, 30) : '');
    }));
  }
  summary['ladder_autocreate_seq_' + theme] = seq;
  summary['ladder_autocreate_wait_' + theme] = await capture(pg, `17_ladder_autocreated_waiting_${theme}${sfx}`, R);
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  await pg.close();
  await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s04_summary' + sfx + '.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v && v.contrastFails ? { cf: v.contrastFails.map(x => x.t + ' ' + x.ratio + '/' + x.need), tf: v.tapFails.map(x => x.t + ' ' + x.w + 'x' + x.h), ov: v.overflow.scrollW + '/' + v.overflow.vw, errs: v.errs } : v])), null, 1));
await browser.close(); srv.close();
