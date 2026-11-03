/* test_friends_ui_v1107.mjs —— 好友界面
 *
 * 合同：
 *   ① 在线的头像亮 + 绿点；离线的**整体变灰**（不是只去掉绿点）——
 *      一眼扫过去就知道谁能约
 *   ② 在线的排在最前面（你想找的就是能马上打的那个）
 *   ③ 好友详情屏**没有任何输入框** —— 这是"不能打字聊天"
 *      在界面上的直接体现，不是靠禁用某个功能藏起来的
 *   ④ 快捷语点了真的发出去，且发的是 id 不是文本
 *   ⑤ 措辞用「刚才还在」而不是「在线中」——
 *      网页没有真正的长连接，不想让这个功能骗人
 *   ⑥ PK 页有好友入口（做了功能没入口等于没做）
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from './playwright_loader.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('好友界面 v1107');

const ui = fs.readFileSync('/home/claude/work/repo/hansen_friends_ui_v1107.js', 'utf8');
const code = ui.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 在线亮 / 离线整体变灰 */
{
  ok(/\.fr_item\.off\{opacity:\.45\}/.test(code) || /fr_item\.off[^}]*opacity/.test(code),
     '★ 离线整体降透明度（不是只去掉绿点）—— 一眼扫出谁能约');
  ok(/fr_item\.on2 \.fr_av\{[^}]*box-shadow/.test(code), '★ 在线头像有高亮描边');
  ok(/fr_dot\{[^}]*#22c55e/.test(code), '★ 绿点是绿色');
  ok(/f\.online \? 'on2' : 'off'/.test(code), '★ 按在线状态给不同样式');
  ok(/f\.online \? '<span class="fr_dot">/.test(code), '★ 只有在线的才有绿点');
}

/* ② 在线排前面 */
{
  const svc = fs.readFileSync('/home/claude/work/repo/hansen_friends_v1106.js', 'utf8');
  ok(/friends\.sort/.test(svc) && /b\.online \? 1 : 0/.test(svc),
     '★ 在线的排最前（你想找的就是能马上打的那个）');
}

/* ③ 详情屏没有输入框 —— 本测试最关键的一条 */
{
  const i = code.indexOf('function detail');
  ok(i > 0, '有好友详情屏');
  const seg = code.slice(i, i + 3000);
  ok(!/<input/.test(seg),
     '★ 好友详情屏里**没有任何 input** —— 不能打字聊天不是藏起来的，是根本没有');
  ok(!/textarea|contenteditable/.test(seg), '★ 也没有 textarea / contenteditable');
  ok(/不能打字/.test(ui), '★ 界面上明说"只能发这些，不能打字"');
}

/* ④ 快捷语 */
{
  const i = code.indexOf('function detail');
  const seg = code.slice(i, i + 3000);
  ok(/QUICK\.map/.test(seg), '★ 快捷语从服务层的 QUICK 读，不在界面里另抄一份');
  ok(/sendQuick\(f\.cid, qid\)/.test(seg), '★ 发的是 qid（id），不是文本');
  ok(/没发出去/.test(seg), '★ 发送失败有明确提示，不是静默失败');
}

/* ⑤ 措辞不骗人 */
{
  const svc = fs.readFileSync('/home/claude/work/repo/hansen_friends_v1106.js', 'utf8');
  ok(/刚才还在/.test(svc), '★ 用「刚才还在」');
  ok(!/在线中/.test(ui.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 不用「在线中」这种斩钉截铁的说法（网页没有真正的长连接）');
  ok(/网页不能像 App 那样一直挂着/.test(ui),
     '★ 界面上向用户解释了这个限制，而不是让他自己纳闷');
}

/* ⑥ 入口 */
{
  const pk = fs.readFileSync('/home/claude/work/repo/spelling_pk.html', 'utf8');
  ok(/pkFriends/.test(pk), '★ PK 页有好友入口（做了功能没入口等于没做）');
  ok(/HansenFriendsUI/.test(pk), '★ 入口接到了好友界面');
}

/* ⑦ 隐身开关 */
{
  ok(/frHide/.test(code) && /setStatus\('hidden'\)/.test(code), '★ 有隐身开关');
  ok(/隐身时好友看到的你和「不在线」一模一样/.test(ui),
     '★ 说清楚隐身的效果（用户要知道自己选的是什么）');
}

/* ── 🔴v1164 真浏览器：每人只写自己的记录时，界面要把三种关系说清楚 ──────
 *
 * 云端用的是和真数据库一个脾气的假货（在页面里注入传输层）：
 * add 时盖上写入者的 _openid，只有创建者能改/删 —— 改别人的记录改了 0 条。
 *   · 互为好友（两边各一条）→ 正常显示、能发招呼
 *   · 我加了他、他没加我 → 「（待确认）」，详情里发不了招呼（发了他也看不到）
 *   · 他加了我、我没加他 → 「想加你为好友」+「加他」按钮
 *   · 收件箱只显示好友发来的招呼
 *   · 集合没建 → 「云端设置还差一步」+ 集合名 + 权限 + 技术信息
 *   · z-index 在拼写大PK屏(2147483400)之上、对战屏(2147483600)之下
 *   · 打开好友页不能让看门狗盖「这一步没能打开」
 */
{
  const ROOT = '/home/claude/work/repo';
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
    '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
    });
  });
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  /* 不许连外网：腾讯云的请求一律掐掉（这一段只验界面，云端用注入的假货） */
  await ctx.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.toString()), r => r.abort());
  await ctx.addInitScript(() => {
    try { localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify({ name: '小明', cid: 1, cidLocked: true })); } catch (e) {}
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.HansenFriends && window.HansenFriendsUI, null, { timeout: 20000 });
  await pg.evaluate(() => {
    const now = Date.now();
    const rows = [
      { _id: 'p2', kind: 'presence', cid: 2, name: '小红', at: now, _openid: 'oB' },
      { _id: 'p3', kind: 'presence', cid: 3, name: '小刚', at: now - 600000, _openid: 'oC' },
      { _id: 'p4', kind: 'presence', cid: 4, name: '小美', at: now, _openid: 'oD' },
      { _id: 'f12', kind: 'friend', owner: 1, friend: 2, name: '小红', at: now, _openid: 'oA' },
      { _id: 'f21', kind: 'friend', owner: 2, friend: 1, name: '小明', at: now, _openid: 'oB' },
      { _id: 'f13', kind: 'friend', owner: 1, friend: 3, name: '小刚', at: now, _openid: 'oA' },
      { _id: 'f41', kind: 'friend', owner: 4, friend: 1, name: '小明', at: now, _openid: 'oD' }
    ];
    const msgs = [
      { _id: 'm1', from: 2, fromName: '小红', to: 1, fromOpenid: 'oB', _openid: 'oB', qid: 'pk', at: now - 1000 },
      { _id: 'm2', from: 9, fromName: '陌生人', to: 1, fromOpenid: 'oX', _openid: 'oX', qid: 'hi', at: now - 500 }
    ];
    const W = { denied: 0, adds: [], msgAdds: 0, failList: null };
    const mt = (w) => (x) => Object.keys(w || {}).every((k) => {
      const v = w[k];
      if (v && typeof v === 'object' && Array.isArray(v.$in)) return v.$in.includes(x[k]);
      if (v && typeof v === 'object' && typeof v.$lt === 'number') return x[k] < v.$lt;
      return x[k] === v;
    });
    const cp = (x) => JSON.parse(JSON.stringify(x));
    let n = 0;
    const me = 'oA';
    window.__fr = { rows, msgs, W };
    window.HansenFriends._setTransportForTest({
      read: async (id) => cp(rows.find((x) => x._id === id) || null),
      list: async (w) => { if (W.failList) throw W.failList; return rows.filter(mt(w)).map(cp); },
      add: async (d) => { const doc = Object.assign(cp(d), { _id: 'n' + (++n), _openid: me }); rows.push(doc); W.adds.push(doc); return { id: doc._id }; },
      patch: async (id, d) => { const r = rows.find((x) => x._id === id); if (!r) return { updated: 0 }; if (r._openid !== me) { W.denied++; return { updated: 0 }; } Object.assign(r, d); return { updated: 1 }; },
      remove: async (id) => { const i = rows.findIndex((x) => x._id === id); if (i < 0) return { deleted: 0 }; if (rows[i]._openid !== me) { W.denied++; return { deleted: 0 }; } rows.splice(i, 1); return { deleted: 1 }; },
      addMsg: async (d) => { W.msgAdds++; const doc = Object.assign(cp(d), { _id: 'm' + (++n), _openid: me }); msgs.push(doc); return { id: doc._id }; },
      listMsg: async (w) => msgs.filter(mt(w)).map(cp),
      removeMsg: async () => ({ deleted: 0 })
    });
  });
  const shot = async (ms) => { await pg.waitForTimeout(ms || 1200); return pg.evaluate(() => {
    const el = document.getElementById('hsn_friends_screen');
    return { txt: el ? el.innerText : '', z: el ? getComputedStyle(el).zIndex : '', on: !!(el && el.classList.contains('on')) };
  }); };

  /* 先开天梯再开好友 —— 天梯页 close() 会给看门狗上哨 */
  await pg.evaluate(() => { if (window.HansenLadderUI) window.HansenLadderUI.open(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => window.HansenFriendsUI.open());
  let v = await shot(1500);
  ok(v.z === '2147483500', `★ 好友页 z-index 2147483500（实得 ${v.z}）—— 在拼写大PK屏之上、对战屏之下`);
  const wd = await pg.evaluate(() => window.HansenPkWatchdog ? window.HansenPkWatchdog._stateForTest().armed : false);
  ok(wd === false, '★ 打开好友页后看门狗没上哨（否则 6 秒后「这一步没能打开」会盖住好友页）');
  ok(/小红/.test(v.txt) && !/小红\s*（待确认）/.test(v.txt), '★ 互为好友的正常显示');
  ok(/小刚\s*（待确认）/.test(v.txt) && /等他也加你为好友/.test(v.txt), '★ 我加了他、他没加我 → 「待确认」');
  ok(/想加你为好友/.test(v.txt) && /小美/.test(v.txt), '★ 他加了我、我没加他 → 「想加你为好友」');
  ok(/收到的招呼/.test(v.txt) && /来一局/.test(v.txt) && !/陌生人/.test(v.txt), '★ 收件箱只显示好友发来的招呼（陌生人的不显示）');

  /* 点「加他」→ 只写我自己的一条，当场互为好友 */
  await pg.click('#frInc [data-acc="0"]');
  v = await shot(1500);
  const st = await pg.evaluate(() => ({ adds: window.__fr.W.adds.filter((x) => x.kind === 'friend'), denied: window.__fr.W.denied }));
  ok(st.adds.length === 1 && st.adds[0].owner === 1 && st.adds[0].friend === 4, '★「加他」只写我自己的一条（owner=我）');
  ok(/互为好友/.test(v.txt) && !/想加你为好友/.test(v.txt), '★ 加完当场互为好友，请求那一栏消失');
  ok(st.denied === 0, '★ 界面全程没去改/删别人的记录');

  /* 待确认的好友：详情里发不了招呼 */
  await pg.evaluate(() => {
    const items = [...document.querySelectorAll('#frList .fr_item')];
    const it = items.find((x) => /小刚/.test(x.innerText)); if (it) it.click();
  });
  await pg.waitForTimeout(400);
  await pg.click('.fr_q[data-q="pk"]');
  await pg.waitForTimeout(400);
  const dt = await pg.evaluate(() => ({ sent: (document.getElementById('frSent') || {}).textContent || '', n: window.__fr.W.msgAdds,
    del: (document.getElementById('frDel') || {}).textContent || '' }));
  ok(/还没加你/.test(dt.sent) && dt.n === 0, '★ 他还没加我 → 不发招呼，并说清楚原因');
  ok(/撤回/.test(dt.del), '待确认的好友：按钮写「撤回好友请求」而不是「删除好友」');
  await pg.evaluate(() => window.HansenFriendsUI.close());

  /* 集合没建 → 云端设置还差一步 */
  await pg.evaluate(() => {
    window.__fr.W.failList = Object.assign(new Error('读取好友记录：[ResourceNotFound] Db or Table not exist: hansen_friends'),
      { code: 'DATABASE_COLLECTION_NOT_EXIST', cloud: true, collection: 'hansen_friends' });
    window.HansenFriendsUI.open();
  });
  v = await shot(1500);
  ok(/云端设置还差一步/.test(v.txt) && /hansen_friends/.test(v.txt) && /读取全部数据，修改本人数据/.test(v.txt),
     '★ 缺集合 → 「云端设置还差一步」，说清楚建哪个集合、权限选什么');
  ok(/技术信息/.test(v.txt) && /DATABASE_COLLECTION_NOT_EXIST/.test(v.txt), '★ 原话放在「技术信息」里（排查要用）');
  ok(!/连不上网络/.test(v.txt), '★ 不把配置问题说成网络问题');
  ok(errs.length === 0, `零脚本错误${errs.length ? '：' + errs.join(' | ') : ''}`);
  await browser.close(); srv.close();
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
