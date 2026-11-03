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


/* ── 🔴v1156「再来一局」两个 bug ───────────────────── */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(!/\.onclick\s*=\s*lobby\s*;/.test(code),
     '★ **不许把 lobby 直接当 onclick** —— ' +
     '浏览器会把点击事件对象当成 err 传进去，' +
     '于是 errBlock(event) 把 `{"isTrusted":false}` 画到屏上，' +
     '用户打完一局看到一串乱码。' +
     '这类写法只要那个函数有参数就一定中招，必须包一层');

  ok(/_cameFromLadder/.test(code),
     '★ **记住是从哪来的** —— ' +
     '排位打完点「再来一局」原来跳到「公开房间列表」，' +
     '而他刚才是从天梯来的，想要的是再排一局，不是自己去列表里挑');
  ok(/HansenLadderUI\.open\(\)[\s\S]{0,300}ldGo/.test(code),
     '★ 从天梯来的「再来一局」直接开始找下一个对手 —— ' +
     '他点这个按钮就是这个意思');
}


/* ── 🔴v1156 房间列表：房主水平 ─────────────────────── */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/function tierText/.test(code),
     '★ **排位房不能全显示「未定级」** —— ' +
     '列表读的是 hostTier（开房时手填的），' +
     '而天梯自动开的房传的是 hostRating（一个分数），' +
     '于是所有排位房都掉进 `|| 未定级` 那个兜底里。' +
     '用户在列表里看到一排「未定级」，判断不出该进谁的房 —— ' +
     '而"对手大概什么水平"正是他点进去之前最想知道的');
  ok(/hostTier\) return x\.hostTier/.test(code),
     '★ 有 hostTier 优先用它（自由房手填的那种）');
  ok(/L\.tierOf\(r\)/.test(code),
     '★ 只有分数时按分数算段位');
  ok(/return '未定级'/.test(code),
     '★ 两个都没有才说未定级');

  /* 🔴v1156 更新：按钮文字后来又改短成「➕ 开一间」（房间列表重排时），
     而提示又一次忘了跟着改 —— **同一个错犯了两次**。
     现在这件事由守卫「提示对按钮」自动守着：
     它会抠出所有「点上面的『X』」，检查 X 是否真有对应按钮。
     这里只断言那道守卫存在，不再写死具体文字 ——
     **写死文字的断言，正是这个问题的一部分**。 */
  const g = fs.readFileSync(ROOT + '/hansen_guards_v1068.py', 'utf8');
  ok(/def guard_tip_matches_button/.test(g),
     '★ **提示引用的按钮名由守卫自动校验** —— ' +
     '这个错犯过两次：先是提示写「自己开一间」而按钮叫「开一间公开房」，' +
     '后来按钮改短成「开一间」提示又没跟着改。' +
     '改按钮文字时很容易忘掉别处正在引用它');
}


/* ── 🔴v1156 切走再回来，倒计时不该白扣 ──────────────── */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/_rt\.bgLeft = Math\.max\(0, _rt\.deadline - Date\.now\(\)\)/.test(code),
     '★ **切到后台时记下"还剩多少"** —— ' +
     '原来的注释写着"时间不该白扣"，而实际做的是"白扣了但不给你看"：' +
     '只 return 掉不更新显示，而 deadline 是绝对时刻，照样在走。' +
     '实测切走 8 秒回来少了 6 秒');
  ok(/_rt\.deadline = Date\.now\(\) \+ _rt\.bgLeft/.test(code),
     '★ **回来时把时间还回去** —— ' +
     '手机上切出去太常见了（来个消息、看一眼时间），' +
     '回来发现时间被吃掉一大截，人是会恼的 —— ' +
     '尤其抢答赛本来就只有 20 秒');
}


/* ── 🔴v1156 两个真浏览器对打（三项一致性）─────────────
 *
 * 这是最接近真实的测法：开两个独立浏览器上下文，
 * 中间架一个真 HTTP 服务当云端，两边各自跑完整的产品代码，谁也不知道对方存在。
 * 🔴v1164：原子性靠的是「固定 _id 的 add」（同一个 _id 数据库只收第一条），
 *   不再是条件更新 —— 「读取全部数据，修改本人数据」下客人改不了房主的房间记录。
 *
 * 实测结论（本轮人工跑通，这里固化关键契约）：
 *   ① 房主答对 → 房主看 100:0，客人看 0:100，两边都进第 2 题
 *   ② 两人同时抢答 → 云端 winners 只记一个，两边显示一致
 *   ③ 打完整局 → 两边结算一字不差（🤝 打平 100:100 · 答对 1/2）
 *
 * 天梯最核心的性质就是这一条：
 * **两个人在不同设备上看到的是同一场比赛。**
 */
{
  const room = fs.readFileSync(ROOT + '/hansen_pk_room_v1065.js', 'utf8');
  const code = room.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/claim\(/.test(code) && /'_w'/.test(code),
     '★ **判分走 claim：写一条固定 _id 的「这题谁赢」记录（房间号_w题号）** —— ' +
     '两人同时抢答时，数据库保证同一个 _id 只写得进一条，写进去的人赢；' +
     '换成先读后写就会两个人都判赢（v1164 前用的是改房主的房间记录，客人根本改不了）');

  ok(/oppId:/.test(code),
     '★ roundState 带回对手 id —— 两边才能确认在跟同一个人打');

  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/function numOr0/.test(ui) && /function txtOf/.test(ui),
     '★ **云端来的数字和文字都要清洗** —— ' +
     '两边跑同一份代码，一边畸形另一边正常会让两人看到不同的比赛');
}


/* ── 🔴v1156 段位与分数的边界（本轮验证并固化）────────
 *
 * 实测三种极端情况，产品设计都是对的，这里固化成契约：
 *
 *   ① 定级赛第 3 局打完当场定级
 *      1→2 局显示「未定级」，第 3 局结束立刻变「工蜂 1057 分」
 *
 *   ② 连输 25 局也不掉段
 *      1367 分（侦察蜂）→ 掉到 1200 就停住，段位保住，
 *      历史最高 1367 永久保留
 *
 *   ③ 80 连胜分数不会溢出
 *      有 RATING_MAX 上限
 *
 * ②这一条对儿童产品尤其重要：
 * **孩子输一串不该掉段** —— 掉段带来的挫败感会让他直接不玩了，
 * 而"再赢两局就回去了"和"我掉下去了"是完全不同的心理体验。
 */
{
  const L = fs.readFileSync(ROOT + '/hansen_sb_ladder_v1002.js', 'utf8');
  const code = L.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/floor:\s*\d+/.test(code),
     '★ **每个段位有分数地板** —— ' +
     '孩子输一串不该掉段：掉段的挫败感会让他直接不玩了，' +
     '而「再赢两局就回去了」和「我掉下去了」是完全不同的心理体验');
  ok(/RATING_MAX/.test(code),
     '★ 分数有上限 —— 连胜再多也不会溢出成天文数字');
  ok(/RATING_MIN/.test(code),
     '★ 分数有下限 —— 不会掉成负数');
  ok(/PLACEMENT_GAMES\s*=\s*3/.test(code),
     '★ 定级赛 3 局 —— 和界面上写的「再打 3 局定级赛」一致');
}


/* ── 🔴v1156 安全：对手名字和词表不许注入 ─────────────
 *
 * **对手名字是整个天梯里最危险的输入** —— 它来自别人，
 * 而且会直接显示在你的屏幕上。
 * 词表也一样：云端下发的，本地无法保证干净。
 *
 * 真浏览器实测（本轮）：
 *   对手名 = `<img src=x onerror="...">`
 *   词表 cn = 同样的载荷
 *   自己输入框也填同样的载荷并提交
 *
 * 结果：
 *   · 攻击代码没执行 ✅
 *   · 页面里没有被注入的 img 元素 ✅
 *   · 载荷原样当文字显示（转义正确）✅
 *
 * 这里固化转义的调用，防止以后有人图省事改成 innerHTML 直塞。
 */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/function esc\(/.test(code), '★ 有转义函数');
  ok(/esc\(st\.oppName/.test(code) || /esc\(.*oppName/.test(code),
     '★ **对手名字必须转义** —— ' +
     '它来自别人，而且会直接显示在你的屏幕上，' +
     '是整个天梯里最危险的输入');
  ok(/esc\(txtOf\(w\.cn\)\)/.test(code),
     '★ **词表也要转义** —— 云端下发的，本地无法保证干净');
  ok(/replace\(\/\[&<>"\]\/g|&lt;|&amp;/.test(code),
     '★ 转义函数真的在处理尖括号和引号');
}


/* ── 🔴v1156 加减分要看对手水平 ────────────────────────
 *
 * **这是天梯最核心的一条，而它一直是坏的。**
 *
 * 战绩模块算加减分时读 `opts.oppRating || 1000`，
 * 而对战 UI 调 record() 时**根本没传这个字段** ——
 * 于是每一局都按"对手 1000 分"算：
 * 打赢一个 1400 分的高手，和打赢一个新手，加一样的分。
 *
 * > **排位的意义有一半在于"赢强的人涨得多"。**
 * > 这个字段没传，那一半就没了。
 *
 * 而算法本身是对的（v1002 就写好了），只是数据没送到 ——
 * 又一次"算好的东西没送到眼前"。
 *
 * 修完实测（我 1057 分时）：
 *   打赢 800 分  → +7
 *   打赢 1000 分 → +17
 *   打赢 1400 分 → +35     ← 五倍差距
 *   打赢 1800 分 → +39
 */
{
  const room = fs.readFileSync(ROOT + '/hansen_pk_room_v1065.js', 'utf8');
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const rcode = room.replace(/\/\*[\s\S]*?\*\//g, '');
  const ucode = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/oppRating:/.test(rcode),
     '★ **roundState 要带回对手的天梯分** —— ' +
     '没有它，加减分只能按"对手 1000 分"算');
  ok(/hostRating/.test(rcode),
     '★ 取的是房主的分（只有房主的分可信，v1114 做过防谎报）');
  ok(/_oppRating/.test(ucode),
     '★ 对战 UI 轮询时记下对手分数');
  ok(/oppRating: \(_state && _state\._oppRating\)/.test(ucode),
     '★ **结算时把它传给 record()** —— ' +
     '这一步漏了，前面全白做（算法早就写好了，只是数据没送到）');
  ok(!/mode: opts\.mode \|\| 'C'/.test(
       fs.readFileSync(ROOT + '/hansen_pk_record_v1103.js', 'utf8')),
     '★ 历史记录的模式不许默认成 C —— ' +
     '没传就留空，显示一个错的模式是编出来的信息');
}


/* ── 🔴v1156 统计口径自洽（本轮系统性核对）──────────────
 *
 * 用"模块导出了什么 vs 谁在调"和"summary 算了什么 vs 界面显示了什么"
 * 两个角度核对了一遍，结论：
 *
 *   · summary 算的 21 个字段，界面显示了 17 个
 *     没显示的两个是 placed（布尔，用来控分支）
 *     和 avgMs（有 avgSecs 代替）—— 都合理
 *
 *   · tier() / placed() 没人直接调，因为都走 summary()
 *     （里面已含 tier 和 placed）—— 设计合理
 *
 *   · seasonReset() 没人调，因为赛季功能还没做 —— 不是 bug
 *
 * 唯一要守的是**口径自洽**：抢先次数不可能超过答对次数。
 * 真实对战验过：第 1 题我抢先、第 2 题对手先答对
 * → 答对 1、抢先 1，比例正确。
 */
{
  const rec = fs.readFileSync(ROOT + '/hansen_pk_record_v1103.js', 'utf8');
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const ucode = ui.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/if \(first\) st\.st\.firstWins\+\+/.test(ucode),
     '★ **抢先次数只在真的抢先时才加** —— ' +
     '而答对次数无条件加，所以抢先数永远不会超过答对数；' +
     '一旦反过来，抢先率就会超过 100%，那是自相矛盾的');
  ok(/firstRate: pct\(d\.firstWins, d\.correct\)/.test(rec),
     '★ 抢先率的分母是答对数（不是总词数）—— ' +
     '「答对的词里抢在前面几次」才是这个指标的意思');
}


/* ── 🔴v1157 云端缺索引也要能用（真机报的）──────────────
 *
 * 用户截图：天梯排位 → 📡 连不上网络 / 检查 Wi-Fi ——
 * 而他登录了、网也是好的。
 *
 * 根因：`listOpen` 用了 `.orderBy('createdAt','desc')`，
 * 而**云开发的 orderBy 需要在控制台手动建索引，没建就整个查询报错**。
 * v1154 的注释里白纸黑字写过这个坑，而这行 orderBy 一直留着。
 *
 * > **能在代码里兜住的事，不要押在运维配置上。**
 * > 一个功能不该依赖某个人记得去后台点一下 ——
 * > 配置丢了、换环境、新建数据库，天梯就直接不能用，
 * > 而界面只会说"检查网络"，谁也想不到是索引。
 *
 * 修法：orderBy 失败就降级成不带 orderBy 的查询
 * （那个不需要任何索引），排序放本地做。
 *
 * 实测：
 *   云端有索引 → 2 间房，后开的→先开的 ✅
 *   云端缺索引 → 2 间房，后开的→先开的 ✅（自动降级，用户无感）
 */
{
  const room = fs.readFileSync(ROOT + '/hansen_pk_room_v1065.js', 'utf8');
  const code = room.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/\['catch'\]\(function \(indexErr\)/.test(code),
     '★ **orderBy 失败要降级** —— ' +
     '云开发的 orderBy 需要手动建索引，没建就整个查询报错；' +
     '而一个功能不该依赖某个人记得去后台点一下');
  ok(/\.limit\(40\)\.get\(\);/.test(code),
     '★ 降级查询不带 orderBy（那样才不需要索引）');
  ok(/\.sort\(function \(a, b\)/.test(code),
     '★ **排序放本地做** —— 降级路径没有 orderBy，' +
     '而"最近开的排前面"是用户真正在意的顺序');
  ok(/_setDbForTest/.test(code),
     '★ 有注入 db 的口子 —— ' +
     '否则只能读代码，而读代码看不出"缺索引时会不会降级"这种运行时行为');
}

/* ── 🔴v1164 数据层的真行为 ─────────────────────────────
 *
 * 真机上排行榜「从来没好过」，三个原因都是行为问题，读代码看不出：
 *   ① db() 第一次调用必然返回 null（后台才开始预热）→ 页面刚打开拉榜永远是
 *      「登录之后才能看到」，打完排位的上传也静默丢掉
 *   ② 云端出错时 SDK **不抛错**，而是照常返回 {code, message} ——
 *      权限不对被显示成「还没有人上榜」，上传被拒也报 ok:true
 *   ③ 资料那条不在时 update 改了 0 条，也当成功
 *
 * 这里模块本身是真的，只把"云端数据库"换成一个和 SDK 一个脾气的假货：
 * 出错时 resolve {code}（不 reject）、断网时 reject Error('network request error')。
 * （完整的真 SDK + 本地云端模拟在 v1164 的端到端测试里另跑。）
 */
{
  const vm = await import('node:vm');
  const bsrc = fs.readFileSync(ROOT + '/hansen_ladder_board_v1156.js', 'utf8');
  const day = 86400000;
  function fakeDb(o) {
    const log = { updates: [], gets: [], counts: 0, ensured: 0 };
    let upd = (o.updates || []).slice();
    const getRes = (kind) => {
      log.gets.push(kind);
      const g = o.get && o.get[kind];
      if (g === 'net') return Promise.reject(new Error('network request error'));
      if (g && g.code) return Promise.resolve(g);
      return Promise.resolve({ data: JSON.parse(JSON.stringify(o.rows || [])) });
    };
    const chain = (kind) => ({ limit: () => chain(kind), orderBy: () => chain('orderBy'), get: () => getRes(kind),
      count: () => { log.counts++; return Promise.resolve(o.count || { total: 4 }); } });
    const db = {
      command: { gt: (v) => ({ $gt: v }) },
      collection: (name) => ({
        doc: (id) => ({ update: (d) => { log.updates.push({ name, id, d }); return Promise.resolve(upd.length ? upd.shift() : { updated: 1 }); } }),
        orderBy: () => chain('orderBy'),
        where: () => chain('where')
      })
    };
    return { db, log };
  }
  function bootBoard(o) {
    const f = fakeDb(o);
    const store = {};
    const ctx = { console, Date, Math, JSON, Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout,
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
    ctx.window = ctx;
    ctx.HansenAuth = {
      isSignedIn: () => o.signed !== false,
      ensureSession: async () => (o.session || { ok: true, uid: 'U1' }),
      /* _app 是异步的，而且第一次要等一会儿（真 SDK 要动态加载）—— 正是 ① 的现场 */
      _app: () => new Promise((r) => setTimeout(() => r({ database: () => f.db }), 60)),
      ensureProfile: async () => { f.log.ensured++; return { cid: 3 }; }
    };
    ctx.HansenPkRecord = { summary: () => (o.summary || { placed: true, rating: 1100, total: 5 }) };
    ctx.HansenSbProfile = { displayName: () => '小爱' };
    vm.createContext(ctx); vm.runInContext(bsrc, ctx);
    return { B: ctx.window.HansenLadderBoard, log: f.log };
  }
  const now = Date.now();
  const row = (uid, name, r, g, at) => ({ _id: uid, uid, name, cid: 1, ladderRating: r, ladderGames: g, ladderAt: at || now });

  {
    const { B, log } = bootBoard({ rows: [row('A', '小红', 1300, 9), row('U1', '小爱', 1100, 5)], summary: { placed: false } });
    const r = await B.fetchTop();
    ok(r.ok === true && r.list.length === 2,
       '★ **页面刚打开第一次拉榜就成功** —— 以前 db() 第一次必然返回 null，永远显示「登录之后才能看到」（' + JSON.stringify(r).slice(0, 80) + '）');
    ok(r.myRank === 2, '★ 用会话里的 uid 认出自己（第 2 名）');
    ok(log.gets[0] === 'orderBy', '先按分数排序查');
  }
  {
    const { B } = bootBoard({ rows: [], summary: { placed: false } });
    const r = await B.fetchTop();
    ok(r.ok === true && Array.isArray(r.list) && r.list.length === 0, '★ 没人上榜 = ok:true + 空列表（空 ≠ 出错）');
  }
  {
    const denied = { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' };
    const { B } = bootBoard({ get: { orderBy: denied, where: denied }, summary: { placed: false } });
    const r = await B.fetchTop();
    ok(r.ok === false && r.kind === 'config',
       '★ **云端回 {code} 不能当成"还没有人上榜"** —— 以前不查 code，权限不对显示成空榜（' + (r.kind || '') + '）');
    ok(/sb_profile/.test(r.reason) && /读取全部数据，修改本人数据/.test(r.reason) && /DATABASE_PERMISSION_DENIED/.test(r.reason),
       '★ 说清楚是哪个集合、权限该设成什么，原话留在 ⟨⟩ 里');
  }
  {
    const { B, log } = bootBoard({ get: { orderBy: { code: 'INVALID_PARAM', message: 'index not found' } },
      rows: [row('A', '小红', 1000, 9), row('B', '阿强', 1400, 9), row('C', '老号', 1500, 9, now - 40 * day), row('D', '新手', 1600, 2)],
      summary: { placed: false } });
    const r = await B.fetchTop();
    ok(r.ok && log.gets.join(',') === 'orderBy,where', '★ 排序被拒（没建索引）→ 退回不排序的查询');
    ok(r.ok && r.list.map((x) => x.name).join(',') === '阿强,小红',
       '★ 退回后本地排序，并照样滤掉 30 天没打的和没打满定级赛的');
  }
  {
    const { B } = bootBoard({ get: { orderBy: 'net' }, summary: { placed: false } });
    const r = await B.fetchTop();
    ok(r.ok === false && r.kind === 'network', '★ 断网 → kind=network（界面才能说「连不上网络」）');
  }
  {
    const { B } = bootBoard({ signed: false });
    const r = await B.fetchTop();
    ok(r.ok === false && r.reason === 'not-signed-in', '真没登录才说 not-signed-in（天梯页据此显示「登录之后就能看到」）');
  }
  {
    const { B, log } = bootBoard({ updates: [{ code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied' }] });
    const r = await B.push();
    ok(r.ok === false && r.kind === 'config', '★ **上传被拒要报出来** —— 以前 SDK 回 {code} 也报 ok:true');
    ok(B.lastPushError() && B.lastPushError().kind === 'config', '★ 失败原因留着（lastPushError），排查时看得到');
    ok(log.updates[0] && log.updates[0].id === 'U1' && log.updates[0].name === 'sb_profile',
       '★ 只写自己那条 sb_profile（_id = 自己的 uid）');
    ok(log.updates[0] && log.updates[0].d.name === '小爱', '★ 名字跟着资料走（榜上不再全是「无名蜂」）');
  }
  {
    const { B, log } = bootBoard({ updates: [{ updated: 0 }, { updated: 1 }] });
    const r = await B.push();
    ok(r.ok === true && log.ensured === 1 && log.updates.length === 2,
       '★ 资料那条不在（改了 0 条）→ 先建档再写一次，而不是当成功');
  }
  {
    const { B } = bootBoard({ updates: [{ updated: 0 }, { updated: 0 }] });
    const r = await B.push();
    ok(r.ok === false && r.kind === 'config', '★ 建档后还是写不进 → 报配置问题（不是 ok:true）');
  }
  {
    const { B, log } = bootBoard({ updates: [{ updated: 1 }], rows: [row('U1', '小爱', 1100, 5)] });
    await B.fetchTop();
    ok(log.updates.length === 1, '★ 这次打开页面后还没传过分 → 拉榜前先补传一次（上次没传上的分不会一直丢着）');
    B._clearCacheForTest();
    await B.fetchTop();
    ok(log.updates.length === 1, '传成功之后不再重复传');
  }
  {
    const { B } = bootBoard({ count: { code: 'DATABASE_PERMISSION_DENIED' } });
    const r = await B.myRoughRank();
    ok(r.ok === false, '★ count 出错不能当成"0 个人比我高"（以前会显示第 1 名）');
  }
}

await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
