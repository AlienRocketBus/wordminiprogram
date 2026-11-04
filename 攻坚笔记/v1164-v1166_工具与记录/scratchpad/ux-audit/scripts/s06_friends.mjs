// Friends screen: list with friends (online/offline/pending), empty, not logged in, detail, add-friend error,
// plus: does the 15 s auto refresh wipe what the user is typing?
import { startServer, launch, newCtx, openPage, capture } from './lib.mjs';
import fs from 'node:fs';

const { srv, base } = await startServer();
const browser = await launch();
const width = Number(process.env.W || 390);
const sfx = width === 390 ? '' : '_' + width;
const themes = (process.env.THEMES || 'dark,light').split(',');
const summary = {};
const F = '#hsn_friends_screen';

const FRIENDS = [
  { cid: 12, name: '小红', online: true, sub: '刚才还在', pending: false, lastSeen: Date.now() },
  { cid: 3, name: '阿强', online: true, sub: '刚才还在', pending: false, lastSeen: Date.now() },
  { cid: 27, name: 'Lucy', online: false, sub: '25 分钟前在线', pending: false, lastSeen: 1 },
  { cid: 41, name: '王小明同学的超长名字啊', online: false, sub: '3 天前在线', pending: false, lastSeen: 1 },
  { cid: 8, name: '豆豆', online: false, sub: '等他也加你为好友', pending: true, lastSeen: 0 }
];

async function setFriends(pg, mode) {
  await pg.evaluate(([mode, FR]) => {
    const H = window.HansenFriends;
    H.myStatus = () => 'online';
    H.setStatus = () => true;
    H.listFriends = async () => mode === 'nologin' ? { ok: false, reason: '先登录', friends: [] }
      : { ok: true, friends: mode === 'empty' ? [] : FR };
    H.addFriend = async (cid) => ({ ok: false, reason: '没找到竞赛 ID 为 ' + cid + ' 的同学 —— 检查一下数字对不对' });
    H.sendQuick = async (cid, q) => ({ ok: true, sent: H.QUICK.find(x => x.id === q) });
  }, [mode, FRIENDS]);
}

for (const theme of themes) {
  const ctx = await newCtx(browser, { theme, width });
  const pg = await openPage(ctx, base, 'spelling_pk.html', 4600);

  await setFriends(pg, 'list');
  await pg.evaluate(() => window.HansenFriendsUI.open());
  await pg.waitForTimeout(900);
  summary['list_' + theme] = await capture(pg, `50_friends_list_${theme}${sfx}`, F, theme === 'light' ? 'rgb(244,246,251)' : 'rgb(11,16,32)');

  // add-friend error inline
  await pg.evaluate(() => { const i = document.getElementById('frCid'); i.value = '999'; document.getElementById('frAdd').click(); });
  await pg.waitForTimeout(500);
  summary['adderr_' + theme] = await capture(pg, `51_friends_add_error_${theme}${sfx}`, F, theme === 'light' ? 'rgb(244,246,251)' : 'rgb(11,16,32)');

  // detail
  await pg.evaluate(() => document.querySelector('.fr_item').click());
  await pg.waitForTimeout(500);
  await pg.evaluate(() => document.querySelector('.fr_q').click());
  await pg.waitForTimeout(400);
  summary['detail_' + theme] = await capture(pg, `52_friends_detail_${theme}${sfx}`, F, theme === 'light' ? 'rgb(244,246,251)' : 'rgb(11,16,32)');
  // what does "⚔️ 开个房间叫他来打" lead to?
  await pg.evaluate(() => document.getElementById('frPk').click());
  await pg.waitForTimeout(1200);
  summary['detail_pk_dest_' + theme] = await pg.evaluate(() => {
    const r = document.getElementById('hsn_pkroom_screen');
    return r && r.classList.contains('on') ? (r.innerText || '').replace(/\s+/g, ' ').slice(0, 80) : '(room UI not open)';
  });
  await pg.evaluate(() => { try { window.HansenPkRoomUI.close(); } catch (e) {} });

  // empty
  await setFriends(pg, 'empty');
  await pg.evaluate(() => window.HansenFriendsUI.open());
  await pg.waitForTimeout(800);
  summary['empty_' + theme] = await capture(pg, `53_friends_empty_${theme}${sfx}`, F, theme === 'light' ? 'rgb(244,246,251)' : 'rgb(11,16,32)');

  // not logged in
  await setFriends(pg, 'nologin');
  await pg.evaluate(() => window.HansenFriendsUI.open());
  await pg.waitForTimeout(800);
  summary['nologin_' + theme] = await capture(pg, `54_friends_not_logged_in_${theme}${sfx}`, F, theme === 'light' ? 'rgb(244,246,251)' : 'rgb(11,16,32)');

  if (theme === 'dark') {
    // typing wiped by the 15 s refresh?
    await setFriends(pg, 'list');
    await pg.evaluate(() => window.HansenFriendsUI.open());
    await pg.waitForTimeout(800);
    await pg.evaluate(() => { const i = document.getElementById('frCid'); i.focus(); i.value = '12'; });
    await pg.waitForTimeout(15600);
    summary['typing_after_15s'] = await pg.evaluate(() => ({ value: document.getElementById('frCid').value, focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName) }));
  }
  summary['errs_' + theme] = pg.__errs;
  await pg.close(); await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/metrics/_s06_summary' + sfx + '.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v && v.contrastFails ? { cf: v.contrastFails.map(x => x.t + ' ' + x.ratio + '/' + x.need), tf: v.tapFails.map(x => x.t + ' ' + x.w + 'x' + x.h), ov: v.overflow.scrollW + '/' + v.overflow.vw, errs: v.errs } : v])), null, 1));
await browser.close(); srv.close();
