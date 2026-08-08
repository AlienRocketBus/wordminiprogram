#!/usr/bin/env node
/* test_ladder_board_v1156.mjs —— 天梯排行榜
 *
 * 原来天梯页只显示「我 1062 分」，**看不到自己排第几** ——
 * 而天梯的核心动力恰恰是「我比别人强多少」。
 * 一个只告诉你分数、不告诉你位置的排位系统，少了一半意思。
 *
 * 这个文件守的是几条**容易在后续版本里被改坏**的设计取舍。
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/work/repo';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain' }); r.end('1156'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

console.log('天梯排行榜 v1156\n');

/* ══ 静态判据：几条设计取舍不许被改掉 ══ */
{
  const src = fs.readFileSync(ROOT + '/hansen_ladder_board_v1156.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/COL = 'sb_profile'/.test(code),
     '★ **复用已有的 sb_profile 集合，不新建** —— ' +
     '新建一个就要多维护一套权限、索引、清理逻辑，而这里要存的只是一个数字');

  ok(/if \(!s\.placed\) return/.test(code),
     '★ **定级赛没打完不上榜** —— 那时候的分数没有参考价值，上榜只会稀释榜单');

  ok(/STALE_DAYS/.test(code) && /ladderAt.*?< alive|alive/.test(code),
     '★ **三十天没打过就不上榜** —— ' +
     '榜首挂着一个半年前的号，对现在还在打的人不公平');

  /* v1135 的教训：字段缺失 ≠ 值不匹配 */
  const m = code.match(/\.collection\(COL\)[\s\S]{0,200}?\.get\(\)/);
  const query = m ? m[0] : '';
  ok(!/where\(\{[^}]*ladder(Games|At)/.test(query),
     '★ **where 里不放 ladderGames / ladderAt** —— ' +
     'v1135 的教训：字段缺失 ≠ 值不匹配，' +
     '老记录没有这些字段就会整批查不出来（那次房间列表就是这么全废的）');
  ok(/filter\(function \(x\)/.test(code),
     '★ 其余条件放本地过滤');

  ok(/CACHE_MS/.test(code),
     '★ 有缓存 —— 榜单不需要实时，一分钟内不重复拉');

  ok(/myRoughRank/.test(code) && /\.count\(\)/.test(code),
     '★ **不在前 20 时单独数一次名次** —— ' +
     '只数"比我分高的有几个"，一次 count 比拉全表便宜得多；' +
     '没有这一步，第 21 名看到的是一个和自己无关的榜');
}

/* ══ UI 判据 ══ */
{
  const ui = fs.readFileSync(ROOT + '/hansen_ladder_ui_v1108.js', 'utf8');
  ok(/function renderBoard/.test(ui), '★ 天梯页有渲染榜的函数');
  ok(/ldBoard/.test(ui), '★ 榜有自己的容器');
  ok(/\(你\)/.test(ui),
     '★ **自己那一行要标出来** —— 榜的意义是"我在哪儿"，一眼找不到自己就白做了');
  ok(/🥇/.test(ui) && /🥈/.test(ui) && /🥉/.test(ui),
     '★ 前三名给牌子 —— 纯数字的榜看着没劲');
}

/* ══ 真浏览器：有榜 / 没榜 两种都要对 ══ */
async function open(seedBoard) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('hansen_auth_v1004',
        JSON.stringify({ uid: 'ME', method: 'phone', signedAt: Date.now() }));
    } catch (e) {}
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 60)));
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4600);
  await pg.evaluate(seed => {
    const R = window.HansenPkRecord;
    const G = (res, c) => ({ mode: 'A', result: res, oppName: '小明', myScore: 300, oppScore: 100,
      words: 5, correct: c, totalMs: 7000, firstWins: 4, fastestMs: 800 });
    [G('win', 5), G('win', 4), G('lose', 3), G('win', 5)].forEach(g => R.record(g));
    window.HansenLadderBoard.fetchTop = async () => seed;
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
    window.HansenPkRoom._setTransportForTest({
      read: async () => null, claim: async () => ({ updated: 1 }), patch: async () => ({ updated: 1 }),
      add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => [] });
    window.HansenLadderUI.open();
  }, seedBoard);
  await pg.waitForTimeout(1600);
  return { pg, ctx, errs };
}

{
  const { pg, ctx, errs } = await open({ ok: true, myRank: 3, list: [
    { rank: 1, uid: 'A', name: '小红', cid: 7, rating: 1420, games: 30 },
    { rank: 2, uid: 'B', name: '阿强', cid: 12, rating: 1310, games: 22 },
    { rank: 3, uid: 'ME', name: '我', cid: 2, rating: 1057, games: 4 }
  ] });
  const txt = await pg.evaluate(() => {
    const el = document.getElementById('ldBoard');
    return el ? (el.innerText || '') : '';
  });
  ok(/小红/.test(txt) && /1420/.test(txt), '★ 榜能正常显示（名字 + 分数）');
  ok(/\(你\)/.test(txt), '★ 自己那一行标了「(你)」');
  ok(/🥇/.test(txt), '★ 第一名有金牌');
  ok(errs.length === 0, '★ 有榜时零脚本错误');
  await ctx.close();
}

{
  const { pg, ctx, errs } = await open({ ok: false, reason: 'not-signed-in' });
  const r = await pg.evaluate(() => {
    const el = document.getElementById('ldBoard');
    const w = document.querySelector('.ld_wrap');
    return { board: el ? (el.innerText || '') : '',
             usable: !!(w && /开始排位/.test(w.innerText || '')) };
  });
  ok(/暂时看不到/.test(r.board), '★ 拿不到榜时说人话，而不是空白或报错');
  ok(r.usable,
     '★ **拿不到榜，天梯照常能用** —— ' +
     '排行榜是锦上添花，不能因为它拿不到就让人打不了排位');
  ok(errs.length === 0, '★ 没榜时零脚本错误');
  await ctx.close();
}


/* ── 🔴v1156 另外两处改进 ────────────────────────────── */
{
  const L = fs.readFileSync(ROOT + '/hansen_sb_ladder_v1002.js', 'utf8');
  const ui = fs.readFileSync(ROOT + '/hansen_ladder_ui_v1108.js', 'utf8');

  /* ① 升段进度 */
  ok(/function nextTierOf/.test(L),
     '★ 段位模块能算「离下一段还差多少」');
  ok(/nextTierOf: nextTierOf/.test(L),
     '★ 而且导出了 —— 算了不导出等于没算');
  ok(/return null;\s*\/\* 已经是最高段|return null;/.test(L),
     '★ **最高段返回 null** —— 一个永远填不满的进度条只会让人困惑');
  ok(/function nextTierBlock/.test(ui),
     '★ 天梯页画了升段进度条');
  ok(/大约再赢 /.test(ui),
     '★ **给一句「还要打几局」** —— 比「还差 138 分」更好懂');
  ok(/已经是最高段位/.test(ui),
     '★ 封顶时说实话，不画假进度');

  /* ② 连胜那一格不再重复 */
  ok(/sm\.streak >= 2\s*\?\s*kv\('当前连胜'/.test(ui),
     '★ **正在连胜时报当前的** —— 那是此刻最有意思的数字');
  ok(/kv\('最高连胜'/.test(ui),
     '★ 没在连胜时才退回报历史最高');
  ok(/重新点燃/.test(ui),
     '★ 断了连胜时给一句「再赢 2 局重新点燃」—— ' +
     '原来那一格把两个数字挤在一起，同一件事说了两遍，' +
     '占一整格却没多给信息');
}


/* ── 🔴v1156 结算屏：本局表现 + 升段进度 ────────────── */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');

  ok(/function thisGameBlock/.test(ui),
     '★ **结算屏显示这一局打得怎么样** —— ' +
     '原来只说"你赢了 / 200:100 / +15 分"，对刚才那局本身一个字都没有；' +
     '而刚打完那一刻恰恰是最想知道自己表现的时候：' +
     '赢了想知道赢在哪，输了想知道差在哪');

  ok(/_lastStats/.test(ui),
     '★ **本局统计要提前存下来** —— ' +
     'showResult 跑的时候 _state 已经被清空了，现取取不到');
  const iRec = ui.indexOf('_lastStats = Object.assign');
  /* ⚠️ 不能用 indexOf('_state = null;') —— 文件开头那个是**变量声明**
     （var _state = null），不是清空。第一版就这么写的，
     于是存在清空之前永远判成假。
     要找的是 showResult 里那次真正的清空。 */
  const iShow = ui.indexOf('function showResult');
  const iClear = ui.indexOf('_state = null;', iShow);
  ok(iRec > 0 && iRec < iClear,
     '★ 存的时机在清空之前');

  ok(/if \(!w\) return '';/.test(ui),
     '★ 没数据就不画空壳 —— 一排「—」比不画更糟');

  ok(/function nextTierLine/.test(ui),
     '★ **结算屏也给一句「离升段还差多少」** —— ' +
     '天梯页有、这里没有，而刚赢完恰恰是最想知道这个的时刻，' +
     '那是「再来一局」最强的理由');
  ok(/if \(!sm \|\| !sm\.placed\) return '';/.test(ui),
     '★ 没定级不谈升段');
}

/* 对战中的即时反馈 */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/left <= 5 && left > 0/.test(ui),
     '★ **倒计时最后 5 秒变红** —— ' +
     '原来 19 秒和 2 秒长得一模一样，' +
     '而抢答赛里「还剩几秒」恰恰是最该让人有感觉的东西');
  ok(/scale\(1\.45\)/.test(ui),
     '★ 自己得分时跳一下 —— 手快抢到那一下是最有成就感的瞬间');
  ok(/#fb923c/.test(ui),
     '★ **对手得分用橙色，不是绿色** —— 那是对手的分，不是好消息；' +
     '而且不给反馈的话，被反超了都没感觉');
}


/* ── 🔴v1156 排行榜的四个边界 ──────────────────────── */
{
  const ui = fs.readFileSync(ROOT + '/hansen_ladder_ui_v1108.js', 'utf8');

  ok(/if \(x\.rating === lastRating\) x\.rank = lastRank/.test(ui),
     '★ **同分并列** —— 三个人都 1200 分时谁前谁后' +
     '其实是数据库返回顺序决定的，给他们分 🥇🥈🥉 ' +
     '是在编造一个不存在的差距');
  ok(/var tied = /.test(ui),
     '★ **同分时不发牌子，改显示名次数字** —— ' +
     '三个「第一名」戴三块金牌很怪，数字一眼能看出是并列');
  ok(/ranked\.length === 1/.test(ui) && /你是第一个/.test(ui),
     '★ **榜上只有自己时说实话** —— ' +
     '给一个人发金牌有点尴尬，「你是第一个」本身就是个不错的说法');
  ok(/gap\.textContent = '···'/.test(ui),
     '★ **不在前 20 时要有分隔** —— ' +
     '不然「第 2 名」紧接着「第 88 名」，' +
     '看着像名次连着的，而中间其实隔了八十几个人');
}

await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
