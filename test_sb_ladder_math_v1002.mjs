const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_sb_ladder_math_v1002.mjs —— 天梯分数算法单测（纯函数，无需浏览器/云端）
 * 验证：段位映射 / 期望胜率 / K值递减 / 输分阻尼 / 段位地板 / 定级预估 / 赛季重置 / 匹配带 */
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync((__HSN_ROOT + 'hansen_sb_ladder_v1002.js'), 'utf8'), ctx);
const L = ctx.window.HansenSbLadder;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };

console.log('天梯分数算法 v1002');

/* ── 段位映射 ── */
ok(L.tierOf(0).name === '幼蜂', '0分→幼蜂');
ok(L.tierOf(999).name === '幼蜂', '999分→幼蜂');
ok(L.tierOf(1000).name === '工蜂', '1000分→工蜂');
ok(L.tierOf(1250).name === '侦察蜂', '1250分→侦察蜂');
ok(L.tierOf(1450).name === '守卫蜂', '1450分→守卫蜂');
ok(L.tierOf(1650).name === '蜂王', '1650分→蜂王');
ok(L.tierOf(2000).name === '传奇蜂王' && L.tierOf(2000).isTop, '2000分→传奇蜂王(封顶)');
ok(L.tierOf(1100).progress > 0 && L.tierOf(1100).progress < 1, '段内进度在0~1之间');

/* ── 期望胜率 ── */
ok(Math.abs(L.expectedScore(1000, 1000) - 0.5) < 1e-9, '同分期望胜率=50%');
ok(L.expectedScore(1400, 1000) > 0.9, '高400分期望胜率>90%');
ok(L.expectedScore(1000, 1400) < 0.1, '低400分期望胜率<10%');

/* ── K 值递减 ── */
ok(L.kFactor(0, true) === 40 && L.kFactor(2, true) === 40, '定级期(<3局) K=40');
ok(L.kFactor(10, true) === 32, '前20局 K=32');
ok(L.kFactor(50, true) === 24, '20局后 K=24');
ok(L.kFactor(99, false) === 40, '未定级恒为 K=40');

/* ── 胜负基本方向 ── */
/* 注意: 取段位中段分数(1300), 避免正好落在段位地板上被保护机制吃掉扣分 */
const win = L.nextRating({ myRating: 1300, oppRating: 1300, won: true, gamesPlayed: 50, placed: true });
const los = L.nextRating({ myRating: 1300, oppRating: 1300, won: false, gamesPlayed: 50, placed: true });
ok(win.delta > 0, '赢了加分(+' + win.delta + ')');
ok(los.delta < 0, '输了扣分(' + los.delta + ')');

/* ── ① 输分阻尼 0.6：同等条件下扣分明显少于加分 ── */
ok(Math.abs(los.delta) < win.delta, '输分少于赢分(阻尼生效): 赢+' + win.delta + ' vs 输' + los.delta);
ok(Math.abs(Math.abs(los.delta) / win.delta - L.LOSS_DAMPING) < 0.2, '阻尼比例≈0.6');

/* ── ② 段位地板：输分不得跌破当前段位下限 ── */
/* 输给明显更弱的对手 → 扣分大 → 才会撞上地板 */
const floorCase = L.nextRating({ myRating: 1205, oppRating: 900, won: false, gamesPlayed: 50, placed: true });
ok(floorCase.rating >= 1200, '侦察蜂(1205)爆冷输后不跌破1200: 实得' + floorCase.rating);
ok(floorCase.floorSaved === true, '地板保护标记已置位');
ok(L.tierOf(floorCase.rating).name === '侦察蜂', '仍留在侦察蜂, 未掉段');

/* 地板不影响赢分 */
const upFromFloor = L.nextRating({ myRating: 1200, oppRating: 1600, won: true, gamesPlayed: 50, placed: true });
ok(upFromFloor.rating > 1200, '地板不阻碍涨分');

/* ── 升段识别 ── */
const promo = L.nextRating({ myRating: 1195, oppRating: 1400, won: true, gamesPlayed: 50, placed: true });
ok(promo.rating >= 1200 && promo.promoted === true, '跨过1200触发升段标记');

/* ── 至少变动1分 ── */
const tiny = L.nextRating({ myRating: 400, oppRating: 2000, won: true, gamesPlayed: 50, placed: true });
ok(Math.abs(tiny.delta) >= 1, '再悬殊也至少变动1分');

/* ── 以弱胜强 vs 以强胜弱 ── */
const upset = L.nextRating({ myRating: 1000, oppRating: 1600, won: true, gamesPlayed: 50, placed: true });
const easy = L.nextRating({ myRating: 1600, oppRating: 1000, won: true, gamesPlayed: 50, placed: true });
ok(upset.delta > easy.delta, '爆冷赢加分更多(' + upset.delta + ' > ' + easy.delta + ')');

/* ── ③ 定级预估 ── */
ok(L.placementEstimate(0) === 1000, '无CPM记录→1000(工蜂)');
ok(L.placementEstimate(30) === 1000, '30 CPM→1000');
ok(L.placementEstimate(60) === 1300, '60 CPM→1300(侦察蜂)');
ok(L.placementEstimate(500) === 1600, '超高CPM夹到上限1600');
ok(L.placementEstimate(1) >= 800, '极低CPM夹到下限800');

/* ── 赛季软重置 ── */
ok(L.seasonReset(1800) === 1400, '赛季重置: 1800→1400(保留一半优势)');
ok(L.seasonReset(1000) === 1000, '赛季重置: 1000→1000(不动)');
ok(L.seasonReset(600) === 800, '赛季重置: 低分回升至800');

/* ── 匹配分数带 ── */
ok(L.matchBand(0) === 100, '刚入队 ±100');
ok(L.matchBand(10) === 200, '等10秒 ±200');
ok(L.matchBand(999) === 400, '等再久也封顶 ±400');

/* ── 输入健壮性 ── */
ok(L.tierOf(undefined).name === '工蜂', 'undefined→默认工蜂');
ok(L.nextRating({}).rating >= 0, '空参数不崩');
ok(L.nextRating({ myRating: NaN, oppRating: 'x', won: true }).rating > 0, '脏输入不崩');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
