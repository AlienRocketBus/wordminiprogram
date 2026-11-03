/* test_review2_core_v1166.mjs —— 复习 2.0 核心逻辑（node 里跑，真账本模块、真金币钱包、假的 localStorage）
 *
 * 不起浏览器：把 hansen_canonical_progress.js / hansen_coin_wallet.js / vocab_all.js /
 * hansen_review2_words_v1166.js / hansen_review2_v1166.js 原样装进一个 vm 沙盒，localStorage 用内存模拟，
 * 时间用 HansenReview2._setClock 拨（不碰真时钟）。每个场景一个全新沙盒。
 *
 * 查的东西：日期运算 / 午夜 / 时区 / 夏令时 / 很久没来 / 手机时间往回拨 / 离谱的未来到期日 /
 *   排期每一条分支 / 掌握星（只看真实证据 + 封顶）/ 同一个词在两个岛 / 坏数据 / 金币收据不重复 /
 *   不能刷 / 题目确定性 / 题型规则 / 干扰项 / 学习分钟去重 / 家长报告。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES = ['hansen_coin_wallet.js', 'vocab_all.js', 'hansen_canonical_progress.js', 'hansen_review2_words_v1166.js', 'hansen_review2_v1166.js'];
const CODE = Object.fromEntries(FILES.map(f => [f, SRC(f)]));

let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ❌ ' + m); } if (process.env.VERBOSE && c) console.log('  ✅ ' + m); };
const section = t => console.log('\n▶ ' + t);

class MemStorage {
  constructor(init) { this.m = new Map(Object.entries(init || {})); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(String(k)) ? this.m.get(String(k)) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(String(k)); }
  clear() { this.m.clear(); }
  dump() { return Object.fromEntries(this.m); }
}

/* 一个新沙盒。init = 预置的 localStorage；opts.before(win) 可以在模块加载前放 S / 页面变量 */
function env(init, opts = {}) {
  const store = new MemStorage(init);
  const win = { localStorage: store, console: { log() {}, warn() {}, error() {} }, addEventListener() {}, dispatchEvent() {},
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, setTimeout, clearTimeout, Date, Math, JSON };
  win.window = win; win.globalThis = win; win.self = win; win.frames = []; win.parent = win;
  const ctx = vm.createContext(win);
  if (opts.before) opts.before(win);
  for (const f of FILES) { if (opts.skip && opts.skip.includes(f)) continue; vm.runInContext(CODE[f], ctx, { filename: f }); }
  const R = win.HansenReview2, HC = win.HansenCanonical;
  let clock = opts.at || Date.UTC(2026, 10, 3, 4, 0, 0);
  R._setClock(() => clock);
  return { win, store, R, HC, setClock(ms) { clock = ms; }, get clock() { return clock; } };
}
const local = (y, m, d, h = 12, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).getTime();
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/* 往账本里写一个槽位的事实（走账本自己的 read/write，和真实页面一样） */
function seed(E, id, ci, f) {
  const st = E.HC.read(); const p = st.islands[id];
  if (f.wrongs !== undefined) { if (f.wrongs) p.wrongs[ci] = f.wrongs; else delete p.wrongs[ci]; }
  if (f.mc !== undefined) p.mc[ci] = f.mc;
  if (f.learned) p.learned.push(ci);
  if (f.srs !== undefined) { if (f.srs) p.srs[ci] = Object.assign({ last: '' }, f.srs, { updatedAt: f.srs.updatedAt || 1000 }); else delete p.srs[ci]; }
  if (f.clearedSrs) p.cleared.srs[ci] = f.clearedSrs;
  ok(E.HC.write(st) === true, 'seed 写账本 ' + id + ':' + ci);
  E.R._resetMemo();
}
const slot = (E, id, ci) => { const p = E.HC.read().islands[id]; return { wrongs: p.wrongs[ci] || 0, srs: p.srs[ci] ? { box: p.srs[ci].box, due: p.srs[ci].due, last: p.srs[ci].last } : null, clearedSrs: p.cleared.srs[ci] || 0, clearedWrongs: p.cleared.wrongs[ci] || 0 }; };
const coins = E => E.win.HansenCoins.get();
function answerRight(E, s) { const q = E.R.current(s); return E.R.answer(s, q.mode === 'spell' ? { text: q.en } : { choice: q.answerIndex }); }
function answerWrong(E, s) { const q = E.R.current(s); return E.R.answer(s, q.mode === 'spell' ? { text: 'zzz' } : { choice: (q.answerIndex + 1) % q.options.length }); }
/* 每个词在账本里的位置 */
const FOOD = 'food', COLOR = 'color';
const ORANGE_COLOR = 5, ORANGE_FOOD = 2, APPLE = 0;

// ════════════════════════════════════════════════════════════════════
section('A 日期运算（纯函数）');
{
  const E = env(); const P = E.R._pure;
  ok(P.normDay('2026-7-5') === '2026-07-05', '不补零的日期也认 2026-7-5');
  ok(P.normDay('2026-02-30') === '' && P.normDay('2026-13-01') === '' && P.normDay('abc') === '' && P.normDay(null) === '', '假日期一律空串');
  ok(P.normDay('1999-12-31') === '' && P.normDay('2201-01-01') === '', '离谱的年份不认');
  ok(P.addDays('2026-12-31', 1) === '2027-01-01', '跨年 +1');
  ok(P.addDays('2028-02-28', 1) === '2028-02-29' && P.addDays('2027-02-28', 1) === '2027-03-01', '闰年 2 月');
  ok(P.addDays('2026-03-01', -1) === '2026-02-28', '倒退跨月');
  ok(P.diffDays('2026-11-03', '2026-11-18') === 15 && P.diffDays('2026-11-18', '2026-11-03') === -15, '相差天数（有正负）');
  ok(P.effectiveToday('2026-11-10', '') === '2026-11-10', '第一次：今天=真实日期');
  ok(P.effectiveToday('2026-11-11', '2026-11-10') === '2026-11-11', '时间往前走：正常');
  ok(P.effectiveToday('2026-11-09', '2026-11-10') === '2026-11-10', '往回拨 1 天：仍按见过的最晚日期');
  ok(P.effectiveToday('2026-11-08', '2026-11-10') === '2026-11-10', '往回拨 2 天：仍按最晚日期');
  ok(P.effectiveToday('2026-11-07', '2026-11-10') === '2026-11-07', '往回拨 3 天：认为以前的时间是错的，按真实日期');
  ok(P.effectiveToday('2026-11-07', '2030-01-01') === '2026-11-07', '曾被拨到 2030：不会卡在未来');
  ok(P.clampDue('2026-12-03', '2026-11-03') === '2026-12-03', '到期日晚 30 天：照旧');
  ok(P.clampDue('2026-12-04', '2026-11-03') === '2026-11-03', '到期日晚 31 天：当作今天到期');
  ok(P.clampDue('2031-01-01', '2026-11-03') === '2026-11-03', '2031 年的到期日：当作今天到期');
  ok(P.clampDue('坏', '2026-11-03') === '2026-11-03', '坏到期日：今天到期');
}

section('B 午夜、时区、夏令时（本地 0 点算一天）');
for (const tz of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
  process.env.TZ = tz;
  const E = env(); const P = E.R._pure;
  ok(P.dayOfMs(local(2026, 11, 3, 23, 59, 59)) === '2026-11-03', tz + ' 23:59:59 还是今天');
  ok(P.dayOfMs(local(2026, 11, 4, 0, 0, 0)) === '2026-11-04', tz + ' 00:00:00 是明天');
  // 夏令时那天（洛杉矶 3/8、11/1；奥克兰 4/5、9/27）
  for (const [m, d] of [[3, 8], [11, 1], [4, 5], [9, 27]]) {
    ok(P.dayOfMs(local(2026, m, d, 12)) === ymd(2026, m, d) && P.addDays(ymd(2026, m, d), 1) === ymd(2026, m, d + 1), tz + ' 夏令时附近 ' + m + '/' + d + ' 日期不偏');
  }
  // 23:59:50 出题、00:00:10 答：按答题那一刻的「今天」排期
  E.setClock(local(2026, 11, 3, 23, 59, 50));
  seed(E, FOOD, APPLE, { wrongs: 1, srs: { box: 1, due: '2026-11-03', last: '2026-11-01' } });
  const s = E.R.buildSession();
  ok(s.ok && s.queue.length >= 1 && s.queue[0].key === 'apple', tz + ' 23:59:50 apple 到期');
  E.setClock(local(2026, 11, 4, 0, 0, 10));
  const r = answerRight(E, s);
  ok(r.ok && r.change === 'advance', tz + ' 过了午夜再答：照样算到期答对 ' + r.change);
  ok(slot(E, FOOD, APPLE).srs && slot(E, FOOD, APPLE).srs.due === '2026-11-08' && slot(E, FOOD, APPLE).srs.last === '2026-11-04', tz + ' 新到期 = 新的今天 + 4 天 ' + JSON.stringify(slot(E, FOOD, APPLE).srs));
  E.setClock(local(2026, 11, 4, 0, 1, 0));
  ok(E.R.overview().dueCount === 0, tz + ' 同一天不会再到期');
}
process.env.TZ = 'Asia/Shanghai';

section('C 排期每一条分支');
{
  const E = env(); const P = E.R._pure, T = '2026-11-03';
  let n = P.nextPlan(null, false, T);
  ok(n.change === 'demote' && n.plan.box === 0 && n.plan.due === T && n.plan.last === T, '新错词：盒0、今天还算到期（故意答错不能清零领 +20）');
  n = P.nextPlan({ box: 0, due: T, last: '' }, true, T);
  ok(n.change === 'advance' && n.plan.box === 1 && n.plan.due === '2026-11-05', '盒0 到期答对：盒1、2 天后');
  ok(P.nextPlan({ box: 1, due: T, last: '2026-11-01' }, true, T).plan.due === '2026-11-07', '盒1→2：4 天后');
  ok(P.nextPlan({ box: 2, due: T, last: '2026-11-01' }, true, T).plan.due === '2026-11-10', '盒2→3：7 天后');
  ok(P.nextPlan({ box: 3, due: T, last: '2026-11-01' }, true, T).plan.due === '2026-11-18', '盒3→4：15 天后');
  ok(P.nextPlan({ box: 4, due: T, last: '2026-10-19' }, true, T).change === 'graduate', '盒4 到期答对：毕业');
  ok(P.nextPlan({ box: 2, due: '2026-11-05', last: '2026-11-01' }, true, T).change === 'none', '没到期答对：不动');
  ok(P.nextPlan({ box: 2, due: '2026-11-07', last: T }, true, T).reason === 'daily-lock', '今天升过：不再升（每天最多一次）');
  n = P.nextPlan({ box: 3, due: T, last: '2026-10-27' }, false, T);
  ok(n.change === 'demote' && n.plan.box === 2 && n.plan.due === T && n.plan.last === T, '盒3 答错：降一盒、今天还到期');
  ok(P.nextPlan(n.plan, false, T).plan.box === 2, '同一天再答错：不再降（一天只降一次）');
  const re = P.nextPlan(n.plan, true, T);
  ok(re.change === 'relearn' && re.plan.box === 2 && re.plan.due === '2026-11-04', '今天答错过、再答对 = 重新记住：盒子不动、明天见');
  ok(P.nextPlan({ box: 0, due: T, last: '' }, false, T).plan.box === 0, '盒0 答错：还是盒0');
  ok(P.nextPlan({ box: 2, due: '2026-09-01', last: '2026-08-28' }, true, T).plan.box === 3, '过期两个月：答对照常升一盒（不跳级）');
  ok(P.nextPlan({ box: 1, due: '2031-05-05', last: '' }, true, T).change === 'advance', '离谱的未来到期日：当作今天到期，可以升');
  ok(P.nextPlan({ box: 9, due: T, last: '' }, true, T).change === 'graduate' && P.nextPlan({ box: -3, due: T, last: '' }, false, T).plan.box === 0, '坏盒子号被压回 0–4');
}

section('D 掌握星（只看真实证据 + 封顶）');
{
  const E = env(); const S = E.R._pure.computeStars;
  ok(S({}) === 0, '什么证据都没有：0 星');
  ok(S({ crystalP: 1 }) === 1, '答对过一次（结晶进度）：1 星');
  ok(S({ crystalLv: 2 }) === 2, '两个不同日子答对过：2 星');
  ok(S({ crystalLv: 4 }) === 2, '很多天认得、但从没自己拼过：停在 2 星');
  ok(S({ crystalLv: 3, mc: 1 }) === 3, '3 天 + 自己拼过 1 次：3 星');
  ok(S({ r2Days: 4, r2Spell: 2 }) === 4, '4 天 + 拼对 2 天：4 星');
  ok(S({ crystalDone: true, mc: 3 }) === 5, '结晶满 + 宠物掌握：5 星');
  ok(S({ graduated: true, mc: 3 }) === 5, '复习毕业 + 宠物掌握：5 星');
  ok(S({ graduated: true }) === 2, '毕业但从没拼过：2 星');
  ok(S({ crystalLv: 2, boxMax: 1, r2Days: 1 }) === 2, '几样证据取最大，不相加');
  ok(S({ crystalDone: true, mc: 3, wrongs: 1 }) === 2, '错题本里有它（1 次）：最多 2 星');
  ok(S({ crystalDone: true, mc: 3, wrongs: 3 }) === 1, '错了 3 次以上：最多 1 星');
  ok(S({ crystalDone: true, mc: 3, inPlan: true, planBox: 1 }) === 3, '还在计划盒1：最多 3 星');
  ok(S({ crystalDone: true, mc: 3, inPlan: true, planBox: 4 }) === 4, '还在计划盒4：最多 4 星');
  // 账本里的「我认识了」不算星
  seed(E, FOOD, APPLE, { learned: true });
  ok(E.R.wordStars('apple').stars === 0, '只点过「我认识了」：0 星');
  seed(E, FOOD, APPLE, { mc: 3 });
  E.store.setItem('hsn_crystal_food', JSON.stringify({ 0: { lv: 5, p: 0, d: '2026-11-1', done: 1 } }));
  E.R._resetMemo();
  ok(E.R.wordStars('apple').stars === 5, '账本 mc=3 + 结晶 5 星：5 星');
  E.store.setItem('hsn_crystal_food', '{坏掉的');
  E.store.setItem('hsn_crystal_food_bak', JSON.stringify({ 0: { lv: 3, p: 1, d: '2026-11-1', done: 0 } }));
  E.R._resetMemo();
  ok(E.R.wordStars('apple').stars === 3, '结晶主档坏了读 _bak（lv3 + mc3 = 3 星）');
  E.store.setItem('hsn_crystal_food_bak', 'null'); E.R._resetMemo();
  ok(E.R.wordStars('apple').stars === 1, '结晶两份都坏：当没有结晶证据（mc=3 仍是 1 星）');
  // 毕业墓碑 = 毕业证据；「清除进度」留下的最大墓碑不算
  seed(E, FOOD, 1, { clearedSrs: Date.now(), mc: 3 });
  ok(E.R.wordStars('banana').stars === 5, '账本里有毕业墓碑：算毕业过');
  seed(E, FOOD, 3, { clearedSrs: Number.MAX_SAFE_INTEGER, mc: 3 });
  ok(E.R.wordStars('grape').stars === 1, '清除进度的墓碑：不算毕业');
}

section('E 同一个词在两个岛 = 一个复习项');
{
  const E = env();
  const cat = E.R._debug.catalog();
  ok(cat.items.length === 936, '952 个槽位 → 936 个不同拼写 (' + cat.items.length + ')');
  ok(cat.items.filter(i => i.members.length > 1).length === 16, '16 个词在两个岛');
  const o = cat.byKey['orange'];
  ok(o && o.members.map(m => m.slot).join(',') === 'color:5,food:2', 'orange = color:5 + food:2');
  ok(o.cn === '橙色 / 橙子', '两个意思合在一起：' + o.cn);
  ok(cat.byKey['nervous'] && cat.byKey['nervous'].members[0].slot === 'season:0', '星海词从打包词表来（season:0 = nervous）');
  // 两边都有计划：取最该复习的那个；答完两个槽位写成同一个新状态
  seed(E, COLOR, ORANGE_COLOR, { wrongs: 2, srs: { box: 2, due: '2026-11-03', last: '2026-10-30' } });
  seed(E, FOOD, ORANGE_FOOD, { wrongs: 1, srs: { box: 1, due: '2026-11-01', last: '2026-10-30' } });
  E.store.setItem('wordIslandColorNum', JSON.stringify({ learned: [], wrongs: { 5: 2 }, srs: { 5: { box: 2, due: '2026-11-03', last: '2026-10-30' } }, mc: {}, stats: {}, lastSaveTime: 1000 }));
  E.store.setItem('wordIslandFood', JSON.stringify({ learned: [], wrongs: { 2: 1 }, srs: { 2: { box: 1, due: '2026-11-01', last: '2026-10-30' } }, mc: {}, stats: {}, lastSaveTime: 1000 }));
  E.setClock(local(2026, 11, 3, 9));
  const v = E.R._debug.view('orange');
  ok(v.due && v.plan.box === 1 && v.plan.due === '2026-11-01' && v.primary.slot === 'food:2', '合并后取最该复习的（food 盒1 过期 2 天）');
  ok(v.wrongs === 3 && v.wslot.slot === 'color:5', '错题合计 3，付钱看错得最多的槽位 color:5');
  const s = E.R.buildSession();
  ok(s.queue.length === 1 && s.queue[0].key === 'orange', '一轮里 orange 只出现一次');
  E.store.setItem('rvrw_dummy', '1');
  const before = coins(E);
  E.win.localStorage.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'color:5': '2026-10-20', 'food:2': '2026-10-20' }));
  const r = answerRight(E, s);
  ok(r.ok && r.change === 'advance', '答对：升盒');
  const c5 = slot(E, COLOR, ORANGE_COLOR), f2 = slot(E, FOOD, ORANGE_FOOD);
  ok(c5.srs && f2.srs && JSON.stringify(c5.srs) === JSON.stringify(f2.srs) && c5.srs.box === 2 && c5.srs.due === '2026-11-07', '两个槽位写成同一个新计划 ' + JSON.stringify(c5.srs));
  ok(c5.wrongs === 1 && f2.wrongs === 0 && f2.clearedWrongs > 0, '两个岛的错题各减 1（food 清零并立墓碑）');
  E.HC._dropCache();
  ok(slot(E, COLOR, ORANGE_COLOR).wrongs === 1, '错题 2→1 重新读账本后还是 1（没被 _bak 里的 2 冲回去）');
  ok(coins(E) - before === 2, '只付一份纠错金 +2 (' + (coins(E) - before) + ')');
  ok(E.win.HansenCoins.hasAward('rvrw:2026-11-03:color:5:c1') && !E.win.HansenCoins.hasAward('rvrw:2026-11-03:food:2:c1'), '收据记在 color:5 上');
  // 旧存档被同步：重新合并不会把错题加回来
  const savedFood = JSON.parse(E.store.getItem('wordIslandFood')), savedColor = JSON.parse(E.store.getItem('wordIslandColorNum'));
  ok(!savedFood.wrongs[2] && savedColor.wrongs[5] === 1, '各岛旧存档同步成账本的样子');
  ok(savedFood.srs[2].box === 2 && savedColor.srs[5].box === 2, '各岛旧存档里的计划也同步了');
  E.HC.migrate(); E.R._resetMemo();
  ok(slot(E, FOOD, ORANGE_FOOD).wrongs === 0 && slot(E, COLOR, ORANGE_COLOR).wrongs === 1 && slot(E, FOOD, ORANGE_FOOD).srs.box === 2, '再跑一次账本合并（等于开岛）：错题没被加回来、计划没退回');
}

section('F 一轮复习：挑词、上限、确定性、题型');
{
  const E = env(); E.setClock(local(2026, 11, 3, 10));
  const cat = E.R._debug.catalog();
  // 40 个到期词（很久没来）
  const words = cat.byIsland['action'].slice(0, 40);
  const st = E.HC.read();
  words.forEach((it, i) => { const m = it.members.find(x => x.id === 'action'); st.islands.action.srs[m.ci] = { box: i % 5, due: '2026-09-0' + (1 + i % 9), last: '2026-08-20', updatedAt: 1000 }; if (i % 3 === 0) st.islands.action.wrongs[m.ci] = 1 + (i % 4); });
  E.HC.write(st); E.R._resetMemo();
  const ov = E.R.overview();
  ok(ov.dueCount === 40 && ov.sessionSize === 12 && ov.more === 28, '很久没来：40 个到期，一轮 12 个，其余明天继续 ' + JSON.stringify(ov));
  const s1 = E.R.buildSession(), s2 = E.R.buildSession();
  ok(JSON.stringify(s1.queue.map(q => [q.key, q.mode, q.options && q.options.map(o => o.key), q.tiles])) === JSON.stringify(s2.queue.map(q => [q.key, q.mode, q.options && q.options.map(o => o.key), q.tiles])), '同一天建两次：题目一模一样（刷新换不了简单题）');
  ok(s1.queue[0].key && E.R._debug.view(s1.queue[0].key).wrongs >= E.R._debug.view(s1.queue[11].key).wrongs, '错得多的排前面');
  const modes = s1.queue.map(q => q.mode);
  ok(modes.filter(m => m === 'spell').length <= 6, '拼写题不超过一半：' + modes.join(','));
  let run = 1, maxRun = 1; for (let i = 1; i < modes.length; i++) { run = modes[i] === modes[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  ok(maxRun <= 2, '同一题型不连着出 3 道：' + modes.join(','));
  s1.queue.forEach(q => {
    if (q.mode === 'picture') ok(!!q.pic && !/<text\b[^>]*>[^<]*[A-Za-z]/.test(q.pic), '看图题的图上不印英文：' + q.key);
    if (q.mode !== 'spell') {
      ok(q.options.length === 4 && q.options[q.answerIndex].key === q.key, '4 个选项、正确答案在里面：' + q.key);
      ok(new Set(q.options.map(o => o.label)).size === 4, '选项不重样：' + q.key);
    } else {
      const letters = q.en.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
      const pool = [...q.tiles]; ok(letters.split('').every(c => { const i = pool.indexOf(c); if (i < 0) return false; pool.splice(i, 1); return true; }), '字母块够拼出这个词：' + q.key);
    }
  });
  // 次日日期不同，题目顺序/题型可能变（只要求不报错）
  E.setClock(local(2026, 11, 4, 10)); E.R._resetMemo();
  ok(E.R.buildSession().ok, '第二天照样能建');
  // 干扰项避开同意思：orange 的选项里不能有别的「橙…」
  const E2 = env(); E2.setClock(local(2026, 11, 3, 10));
  seed(E2, FOOD, ORANGE_FOOD, { wrongs: 1 });
  for (let d = 3; d <= 20; d++) {
    E2.setClock(local(2026, 11, d, 10)); E2.R._resetMemo();
    const s = E2.R.buildSession(); if (!s.queue.length) continue; const q = s.queue[0];
    if (q.options) ok(q.options.filter(o => o.key !== 'orange').every(o => { const it = E2.R._debug.catalog().byKey[o.key]; return !it.meanings.some(m => ['橙色', '橙子'].includes(m)); }), '干扰项不和 orange 的意思重叠 (第 ' + d + ' 天)');
    break;
  }
  // 题型随星星变难
  const E3 = env(); E3.setClock(local(2026, 11, 3, 10));
  const P = E3.R._pure; const it = E3.R._debug.catalog().byKey['banana'];
  const vv = s => ({ stars: s, item: it, kind: 'due' });
  const pick = s => { const out = new Set(); for (let i = 0; i < 60; i++) out.add(P.chooseMode(vv(s), { modes: [], spell: 0 }, P.rng('x' + i), 12)); return [...out].sort().join(','); };
  ok(pick(0) === 'listen,picture', '0–1 星：听音 / 看图（不拼）' + pick(0));
  ok(pick(2) === 'listen,picture,spell', '2 星：三种都有 ' + pick(2));
  ok(pick(4) === 'listen,spell', '3–5 星：拼写 / 听音 ' + pick(4));
  ok(P.spellable('t-shirt') && P.spellable('ice cream') && !P.spellable('a') && !P.spellable('extraordinarily-long-word'), '能不能出拼写题');
}

section('G 答错、再考、练一练、不能刷');
{
  const E = env(); E.setClock(local(2026, 11, 3, 10));
  seed(E, FOOD, APPLE, { wrongs: 1, srs: { box: 2, due: '2026-11-03', last: '2026-10-30' } });
  E.store.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': '2026-10-25' }));
  const c0 = coins(E);
  let s = E.R.buildSession();
  const w = answerWrong(E, s);
  ok(w.ok && !w.correct && w.change === 'demote', '到期答错：降盒');
  ok(slot(E, FOOD, APPLE).srs.box === 1 && slot(E, FOOD, APPLE).srs.due === '2026-11-03' && slot(E, FOOD, APPLE).wrongs === 2, '盒2→1、今天还到期、错题 +1（2 次，没被 _bak 冲回）');
  ok(s.queue.length === 2 && s.queue[1].retry && s.queue[1].key === 'apple', '本轮最后再考一次');
  const rr = answerRight(E, s);
  ok(rr.change === 'retry' && rr.coins === 0 && slot(E, FOOD, APPLE).wrongs === 2 && slot(E, FOOD, APPLE).srs.box === 1, '再考答对：不算数（不扣错题、不升盒、不给钱）');
  const sum = E.R.finishSession(s);
  ok(sum.reviewed === 1 && sum.correct === 0 && sum.wrong[0] === 'apple', '结果：1 个词、0 个一次答对');
  ok(coins(E) === c0, '这一轮一分钱没有（全答错也拿不到「清零 +20」）');
  ok(sum.more === 1 && E.R.overview().dueCount === 1, '答错的词今天还要再试一次');
  s = E.R.buildSession();
  ok(s.queue.length === 1 && s.queue[0].key === 'apple', '再开一轮：只剩它');
  const rl = answerRight(E, s);
  ok(rl.change === 'relearn' && rl.coins === 0 && slot(E, FOOD, APPLE).srs.box === 1 && slot(E, FOOD, APPLE).srs.due === '2026-11-04' && slot(E, FOOD, APPLE).wrongs === 2, '重新记住：盒子不动、明天见、错题不扣、不给钱');
  const sumB = E.R.finishSession(s);
  ok(sumB.bonus === 20 && coins(E) - c0 === 20, '今天的词都答对过一次：+20 完成奖励 (' + (coins(E) - c0) + ')');
  ok(E.R.buildSession().queue.length === 0, '同一天再开：没有到期词了');
  // 练一练：答对不给钱、不动计划
  const p = E.R.buildSession({ practice: true });
  ok(p.ok && p.kind === 'practice', '可以练一练');
  const before = JSON.stringify(E.HC.read().islands);
  const c1 = coins(E);
  let paid = 0; while (E.R.current(p)) paid += answerRight(E, p).coins || 0;
  ok(paid === 0 && coins(E) === c1, '练一练答对：不给钱');
  ok(JSON.stringify(E.HC.read().islands) === before, '练一练答对：账本一点没动');
  // 练一练答错：真忘了 → 进计划、建档（当天错当天清没有毕业金）
  const E2 = env(); E2.setClock(local(2026, 11, 3, 10));
  seed(E2, FOOD, 5, { mc: 1 });   // watermelon 认识过
  const p2 = E2.R.buildSession({ practice: true });
  const q = E2.R.current(p2);
  ok(q && q.key === 'watermelon', '练一练挑认识过的词');
  answerWrong(E2, p2);
  ok(slot(E2, FOOD, 5).wrongs === 1 && slot(E2, FOOD, 5).srs.box === 0 && slot(E2, FOOD, 5).srs.due === '2026-11-03', '练一练答错：错题 +1、进计划（今天再试一次）');
  ok(JSON.parse(E2.store.getItem('hansen_review_wrong_since_v963'))['food:5'] === '2026-11-03', '新错词按 v963 格式建档（当天错当天清拿不到毕业金）');
  ok(E2.R.overview().dueCount === 1, '刚答错的词进了今天的复习');
}

section('H 金币：和岛里共用收据、毕业、巡检、做完一轮');
{
  const E = env(); E.setClock(local(2026, 11, 3, 10));
  // 岛里今天已经给过 food:0 三次纠错金
  ['c1', 'c2', 'c3'].forEach(c => E.win.HansenCoins.award('rvrw:2026-11-03:food:0:' + c, 2));
  seed(E, FOOD, APPLE, { wrongs: 2, srs: { box: 1, due: '2026-11-03', last: '2026-11-01' } });
  let c0 = coins(E), s = E.R.buildSession();
  answerRight(E, s);
  ok(coins(E) === c0, '岛里今天已领满 3 次：复习里不再给 (' + (coins(E) - c0) + ')');
  // 毕业：盒4 到期答对、错题还剩 1、建档早于今天 → +2 +15，进巡检
  const E2 = env(); E2.setClock(local(2026, 11, 3, 10));
  seed(E2, FOOD, APPLE, { wrongs: 1, srs: { box: 4, due: '2026-11-03', last: '2026-10-19' } });
  E2.store.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': '2026-10-19' }));
  c0 = coins(E2); s = E2.R.buildSession();
  const g = answerRight(E2, s);
  ok(g.graduated && g.coins === 17 && coins(E2) - c0 === 17, '毕业：+2 纠错 +15 毕业金 = 17 (' + g.coins + ')');
  const a = slot(E2, FOOD, APPLE);
  ok(!a.srs && a.wrongs === 0 && a.clearedSrs > 0 && a.clearedSrs < 9e15, '毕业：计划删掉、立墓碑');
  const patrol = JSON.parse(E2.store.getItem('hansen_review_patrol_v963') || '{}');
  ok(patrol['food:0'] && patrol['food:0'].due === '2026-12-03' && patrol['food:0'].stage === 1, '毕业：进 30 天巡检 ' + JSON.stringify(patrol['food:0']));
  ok(!JSON.parse(E2.store.getItem('hansen_review_wrong_since_v963'))['food:0'], '毕业：建档日清掉');
  const sum = E2.R.finishSession(s);
  ok(sum.bonus === 20 && E2.win.HansenCoins.hasAward('rvrw:2026-11-03:todaydone'), '做完一轮、全部清零：+20（v963 不在页面时自己按同一收据发）');
  c0 = coins(E2);
  ok(E2.R.finishSession(s) === sum && coins(E2) === c0, '同一轮结束两次：不会再发');
  // 30 天老大难：毕业金翻倍（v963 同规则）
  const E3 = env(); E3.setClock(local(2026, 11, 3, 10));
  seed(E3, FOOD, APPLE, { wrongs: 1, srs: { box: 0, due: '2026-11-03', last: '' } });
  E3.store.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': '2026-09-01' }));
  c0 = coins(E3); s = E3.R.buildSession();
  const og = answerRight(E3, s);
  ok(og.coins === 32 && !og.graduated, '错题清零（还在计划里）：+2 +15 +15(老大难) = 32 (' + og.coins + ')');
  ok(!JSON.parse(E3.store.getItem('hansen_review_patrol_v963') || '{}')['food:0'], '还在计划里：先不进巡检（等真正毕业）');
  // 当天的错词：当天清零没有毕业金
  const E4 = env(); E4.setClock(local(2026, 11, 3, 10));
  seed(E4, FOOD, APPLE, { wrongs: 1 });
  E4.store.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:0': '2026-11-03' }));
  c0 = coins(E4); s = E4.R.buildSession();
  const td = answerRight(E4, s);
  ok(td.coins === 2, '当天错当天清：只有 +2 (' + td.coins + ')');
  // 改手机时间：往回拨不能重领
  E2.setClock(local(2026, 11, 2, 10)); E2.R._resetMemo();
  ok(E2.R.today() === '2026-11-03', '往回拨 1 天：今天仍是 11-03');
  seed(E2, FOOD, 7, { wrongs: 1, srs: { box: 0, due: '2026-11-02', last: '' } });
  E2.store.setItem('hansen_review_wrong_since_v963', JSON.stringify({ 'food:7': '2026-11-03' }));
  c0 = coins(E2); s = E2.R.buildSession();
  answerRight(E2, s); const sum2 = E2.R.finishSession(s);
  ok(sum2.bonus === 0 && coins(E2) - c0 === 2, '往回拨后做完一轮：+20 不会再领一次（只有纠错 +2）');
  ok(slot(E2, FOOD, 7).srs.last === '2026-11-03', '排期按 11-03 记（计划不会倒退）');
  // 往回拨很多：按真实日期，最晚日期放下来
  E2.setClock(local(2026, 10, 20, 10)); E2.R._resetMemo();
  ok(E2.R.today() === '2026-10-20', '往回拨 2 周：按真实日期 10-20');
  // 金币钱包不在：不报错、不给钱、进度照样记
  const E5 = env({}, { skip: ['hansen_coin_wallet.js'] }); E5.setClock(local(2026, 11, 3, 10));
  seed(E5, FOOD, APPLE, { wrongs: 1, srs: { box: 1, due: '2026-11-03', last: '' } });
  s = E5.R.buildSession(); const nc = answerRight(E5, s);
  ok(nc.ok && nc.coins === 0 && slot(E5, FOOD, APPLE).srs.box === 2, '没有金币模块：进度照记、不给钱、不报错');
}

section('I 坏数据');
{
  // 自己的存档坏了：当作空的，账本不受影响
  const E = env({ hansen_review2_v1166: '{坏', hansen_review2_v1166_bak: '[]' }); E.setClock(local(2026, 11, 3, 10));
  seed(E, FOOD, APPLE, { wrongs: 1 });
  ok(E.R.overview().dueCount === 1, '自己的存档坏了：照样能复习');
  const s = E.R.buildSession(); answerRight(E, s);
  ok(JSON.parse(E.store.getItem('hansen_review2_v1166')).w.apple.c[0] === '2026-11-03', '坏存档被干净的新存档替换');
  // 主档坏、_bak 好：用 _bak
  const E1 = env(); E1.setClock(local(2026, 11, 3, 10));
  const s1 = E1.R.buildSession({ practice: true });
  E1.store.setItem('hansen_review2_v1166_bak', JSON.stringify({ v: 1, hwm: '2026-11-03', lm: 0, w: { apple: { c: ['2026-11-01', '2026-11-02'], s: [], x: '', g: '', n: 2, k: 2 } }, d: {} }));
  E1.store.setItem('hansen_review2_v1166', 'not json'); E1.R._resetMemo();
  ok(E1.R._debug.readStore().w.apple.c.length === 2, '主档坏了：读上一份');
  // 垃圾字段被洗掉
  const clean = E1.R._pure.cleanStore({ v: 1, hwm: '2026-99-99', lm: -5, w: { '__proto__': { c: ['x'] }, 'Apple': { c: [] }, ok: { c: ['2026-11-01', '2026-11-01', 'bad', '2026-10-01'], s: 'x', n: -3, k: 1e99 } }, d: { 'bad': {}, '2026-11-01': { m: 99999, q: 'x' } } });
  ok(clean.hwm === '' && clean.lm === 0 && !clean.w.Apple && JSON.stringify(clean.w.ok.c) === '["2026-10-01","2026-11-01"]' && clean.w.ok.n === 0 && clean.d['2026-11-01'].m === 1440 && !clean.d.bad, '垃圾字段一律洗干净 ' + JSON.stringify(clean));
  // 账本两份都坏：不出题、不写
  const E2 = env(); E2.setClock(local(2026, 11, 3, 10));
  seed(E2, FOOD, APPLE, { wrongs: 1 });
  const key = E2.HC.STORE_KEY;
  E2.store.setItem(key, '{坏'); E2.store.setItem(key + '_bak', '也坏'); E2.HC._dropCache(); E2.R._resetMemo();
  const ov = E2.R.overview();
  ok(!ov.ok && ov.reason === 'ledger-unreadable', '账本两份都坏：说读不到 ' + JSON.stringify(ov));
  ok(!E2.R.buildSession().ok, '账本两份都坏：不建复习');
  ok(E2.store.getItem(key) === '{坏' && E2.store.getItem(key + '_bak') === '也坏', '账本两份都坏：一个字都没改');
  // 主档坏、_bak 好：能读
  const E3 = env(); E3.setClock(local(2026, 11, 3, 10));
  seed(E3, FOOD, APPLE, { wrongs: 1 }); seed(E3, FOOD, 1, { wrongs: 1 });
  E3.store.setItem(E3.HC.STORE_KEY, 'xx'); E3.HC._dropCache(); E3.R._resetMemo();
  ok(E3.R.overview().ok && E3.R.overview().dueCount >= 1, '账本主档坏、备份好：照样能复习');
  // 账本里的怪值：坏计划、巨大错题数、非整数
  const E4 = env(); E4.setClock(local(2026, 11, 3, 10));
  const st = E4.HC.read();
  st.islands.food.srs[0] = { box: 7, due: 'x' }; st.islands.food.wrongs[1] = 'lots'; st.islands.food.wrongs[3] = 1e99; st.islands.food.mc[4] = -1;
  E4.HC.write(st); E4.R._resetMemo();
  ok(E4.R.overview().ok, '账本里有怪值：不崩');
  // 巡检 / 建档 / 连击存档坏了
  const E5 = env({ hansen_review_patrol_v963: '[[[', hansen_review_wrong_since_v963: '5', hansen_review_streak_v963: '"x"' }); E5.setClock(local(2026, 11, 3, 10));
  seed(E5, FOOD, APPLE, { wrongs: 1, srs: { box: 4, due: '2026-11-03', last: '' } });
  const s5 = E5.R.buildSession(); const g5 = answerRight(E5, s5);
  ok(g5.ok && g5.graduated, 'v963 的存档坏了：照样毕业');
  ok(E5.R.parentReport().ok, 'v963 的存档坏了：家长报告照样出');
  // 重置进行中：不写
  const E6 = env({}, { before: w => { w.__hsnHasResetPending = () => true; } }); E6.setClock(local(2026, 11, 3, 10));
  seed(E6, FOOD, APPLE, { wrongs: 1 });
  const s6 = E6.R.buildSession(); const r6 = answerRight(E6, s6);
  ok(!r6.ok && r6.reason === 'save-failed' && slot(E6, FOOD, APPLE).wrongs === 1 && r6.coins === 0, '重置进行中：不写账本、不给钱');
  // 词表缺失 / 词数对不上：那个岛整份不用
  const E7 = env({}, { before: w => { w.HANSEN_REVIEW2_SEASON_WORDS = [{ en: 'x' }]; } });
  ok(!E7.R._debug.catalog().byKey['nervous'] && E7.R._debug.catalog().items.length === 936 - 240 + 0 || !E7.R._debug.catalog().byKey['nervous'], '星海词表词数不对：星海整份不用（不会把进度记错词）');
}

section('J 学习分钟、家长报告');
{
  const E = env(); E.setClock(local(2026, 11, 3, 10, 0, 5));
  ok(E.R.noteActive(local(2026, 11, 3, 10, 0, 5)) === true, '记一分钟');
  ok(E.R.noteActive(local(2026, 11, 3, 10, 0, 40)) === false, '同一分钟两个页面框都在数：只算一次');
  ok(E.R.noteActive(local(2026, 11, 3, 10, 1, 1)) === true, '下一分钟再记');
  ok(E.R.noteActive(local(2026, 11, 3, 9, 59, 0)) === false, '手机时间往回拨一点：不重算');
  ok(E.R.noteActive(local(2026, 10, 30, 9, 0, 0)) === true, '往回拨好几天：重新开始数');
  for (let i = 0; i < 5; i++) E.R.noteActive(local(2026, 11, 3, 11, i, 0));
  const rep0 = E.R.parentReport();
  ok(rep0.todayMinutes === 7 && rep0.week.m >= 7, '今天 7 分钟 ' + rep0.todayMinutes);
  seed(E, FOOD, APPLE, { wrongs: 3, srs: { box: 0, due: '2026-11-03', last: '' } });
  seed(E, FOOD, 1, { mc: 3 });
  E.store.setItem('hsn_crystal_food', JSON.stringify({ 1: { lv: 5, p: 0, done: 1, d: '2026-11-1' } }));
  E.store.setItem('hansen_review_streak_v963', JSON.stringify({ start: '2026-10-30', last: '2026-11-02', count: 4 }));
  E.R._resetMemo();
  const rep = E.R.parentReport();
  ok(rep.ok && rep.totalWords === 936 && rep.mastered === 1 && rep.counts.reduce((a, b) => a + b, 0) === 936, '总数 936、掌握 1 ' + JSON.stringify(rep.counts));
  ok(rep.weakest[0].en === 'apple' && rep.weakest[0].wrongs === 3 && rep.weakest[0].islands[0] === '食物岛', '最弱的词：错得最多的排第一');
  ok(rep.streak.review === 4, '连续复习 4 天（昨天打过卡，今天还算）');
  ok(rep.dueToday === 1 && rep.days.length === 7 && rep.days[6].day === '2026-11-03', '今天要复习 1 个、7 天柱子');
  ok(rep.islands.find(i => i.id === 'food').mastered === 1, '各岛统计');
  E.setClock(local(2026, 11, 5, 10)); E.R._resetMemo();
  ok(E.R.parentReport().streak.review === 0, '断了两天：连击显示 0');
  ok(!/1[3-9]\d{9}/.test(JSON.stringify(E.R.parentReport())), '报告里没有手机号之类的东西');
}

console.log(fails ? `\n❌ ${fails} 项失败（${passes} 项通过）` : `\n✅ 全部通过（${passes} 项）`);
process.exit(fails ? 1 : 0);
