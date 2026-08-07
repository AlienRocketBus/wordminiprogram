/* test_ladder_v1108.mjs —— 天梯排位：实力匹配 + 战绩页
 *
 * 三件事：
 *   ① 天梯按钮不再是「敬请期待」—— v1103 就把分数/段位/定级赛做出来了，
 *      按钮却一直没接上。**做了功能没入口等于没做。**
 *   ② 点一下就匹配实力差不多的对手（不用挑房间、不用等人开房）
 *   ③ 战绩页要能回答「我到底强在哪」，而不是只给胜负
 *
 * 🔴 实力数据选这几个的理由：
 *   抢先率   —— 手速的**直接**指标（答对的词里有多少抢在对手前面）
 *   平均用时 —— 熟练度
 *   最快一次 —— 巅峰手速，有正反馈价值
 *   正确率   —— 准度（和速度是两回事，快而错没意义）
 *   最高分   —— 掉下来了也看得见自己曾经到过哪
 *
 * 合同：
 *   ① 排位固定用 A 抢答赛，玩家不能选（v1100：排位就该纯竞技）
 *   ② 匹配范围随等待时间放宽，不能一上来就随便配
 *   ③ 战绩数据必须真实累计，不能是假数字
 *   ④ 入口必须接上（PK 页和 sb_pk 两处）
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('天梯排位 v1108');

function mkRecord() {
  const store = {};
  const ctx = { window: {}, document: { addEventListener() {}, dispatchEvent() { return true; } },
    CustomEvent: class { constructor(t, o) { this.type = t; } },
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    console, Date, Math, JSON, Object, Array, String, Number, Error };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_sb_ladder_v1002.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_pk_record_v1103.js', 'utf8'), ctx);
  return ctx.window.HansenPkRecord;
}

/* ① 实力数据真实累计 */
{
  const R = mkRecord();
  R.record({ result: 'win', mode: 'A', words: 10, correct: 9, totalMs: 9 * 2000,
             firstWins: 6, fastestMs: 1200, oppRating: 1000 });
  R.record({ result: 'lose', mode: 'A', words: 10, correct: 6, totalMs: 6 * 3000,
             firstWins: 2, fastestMs: 1500, oppRating: 1000 });
  const s = R.summary();
  ok(s.words === 20, `★ 累计答题数 20（实得 ${s.words}）`);
  ok(s.correct === 15, `★ 累计答对 15（实得 ${s.correct}）`);
  ok(s.accuracy === 75, `★ 正确率 75%（实得 ${s.accuracy}%）`);
  ok(s.firstWins === 8, `★ 抢先次数 8（实得 ${s.firstWins}）`);
  ok(s.firstRate === 53, `★ 抢先率 = 抢先/答对 = 8/15 = 53%（实得 ${s.firstRate}%）`);
  ok(s.avgSecs === '2.4', `★ 平均用时 (18000+18000)/15 = 2.4 秒（实得 ${s.avgSecs}）`);
  ok(s.fastestSecs === '1.2', `★ 最快取两次里更快的 1.2 秒（实得 ${s.fastestSecs}）`);
}

/* ② 历史最高分 */
{
  const R = mkRecord();
  for (let i = 0; i < 6; i++) R.record({ result: 'win', mode: 'A', oppRating: 1000 });
  const peak = R.summary().peakRating;
  for (let i = 0; i < 6; i++) R.record({ result: 'lose', mode: 'A', oppRating: 1000 });
  const s = R.summary();
  ok(s.rating < peak, '连输后当前分下降');
  ok(s.peakRating === peak, `★ 历史最高分保留（${s.peakRating}）—— 掉下来也看得见曾经到过哪`);
}

/* ③ 排位固定 A 模式 */
{
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/_createForLadder/.test(ui) && /_pickedMode = 'A'/.test(ui),
     '★ 排位开房固定 A 抢答赛，玩家不能选（排位就该纯竞技）');
  ok(/hostRating/.test(ui), '★ 开排位房时把自己的分写进房间，供对方匹配');
}

/* ④ 匹配范围随等待放宽 */
{
  const ld = fs.readFileSync('/home/claude/work/repo/hansen_ladder_ui_v1108.js', 'utf8');  /* hansen_ladder_ui_v1108 */
  ok(/matchBand\(waited\)/.test(ld), '★ 用 matchBand 按等待时间算范围');
  ok(/gap <= band/.test(ld), '★ 只匹配范围内的房间');
  /* 🔴v1114：hostRating 是客户端填的，不能全信 */
  ok(/Math\.min\(4000,/.test(ld), '★ 对方分数夹到合理区间（填 1e99 没用）');
  ok(/gap > band \* 2/.test(ld),
     '★ 差太远的房直接跳过 —— 谎报得越离谱越会被自动过滤，也就没有作弊动机');
  /* 🔴v1155：门槛做成可配置了（测试里调到 2 秒，E2E 从 135 秒降下来）——
     产品默认仍是 20 秒。断言改为查"有这个默认值"而不是查写死的 20。 */
  ok(/waited >= \(window\.__hsnLadderWaitSec \|\| 20\)/.test(ld),
     '★ 等满 20 秒还没找到就自己开一间（不让人永远空等）· 门槛可配置但默认 20');
  const svc = fs.readFileSync('/home/claude/work/repo/hansen_sb_ladder_v1002.js', 'utf8');
  const m = svc.match(/function matchBand[\s\S]{0,220}/);
  ok(m && /Math\.floor\(s \/ 5\) \* 50/.test(m[0]), '★ 每等 5 秒放宽 50 分');
}

/* ⑤ 战绩页展示项齐全 */
{
  const ld = fs.readFileSync('/home/claude/work/repo/hansen_ladder_ui_v1108.js', 'utf8');
  for (const k of ['胜率', '抢先率', '平均用时', '最快一次', '正确率', '最高连胜']) {
    ok(ld.includes(k), `★ 战绩页有「${k}」`);
  }
  ok(/最近对局/.test(ld), '★ 有最近对局列表');
  ok(/不计分/.test(ld), '★ 非排位局明确标"不计分"，不混淆');
  ok(/定级赛/.test(ld), '★ 未定级时显示定级赛进度条');
}

/* ⑥ 入口都接上了 */
{
  const sb = fs.readFileSync('/home/claude/work/repo/hansen_sb_pk_v1022.js', 'utf8');
  ok(/kLadder'\)\.onclick = openLadder/.test(sb),
     '★ sb_pk 的天梯按钮接到 HansenLadderUI（不再是 soon 敬请期待）');
  const pk = fs.readFileSync('/home/claude/work/repo/spelling_pk.html', 'utf8');
  ok(/HansenLadderUI/.test(pk), '★ spelling_pk 页的天梯入口也接上了');
}


/* ── 🔴v1154 追加：天梯"自动开房"这条路的界面必须打开 ──────
 *
 * 用户现场：「天梯功能根本用不了。」
 *
 * 真跑一遍抓到的：
 *   点「开始排位」→ 正常显示"正在找 900~1100 分的对手" ✅
 *   等 8/16 秒 → 范围正常放宽 ✅
 *   等 20 秒 → 天梯层 close()、建了房（数据库确实多了一间）
 *            → **屏幕一片空白** ❌
 *
 * 根因：`_createForLadder` 只调了建房，**没先打开对战界面** ——
 * 房建好了，却没有任何界面在等它。
 *
 * 而外层包着 try/catch，**报错被吞掉了**：
 *   控制台零错误 ✅ / 用户看到白屏 ❌
 * 所以从代码看、从日志看都正常，**只有真的点一遍才会发现**。
 */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

  const iCreate = code.indexOf('function _createForLadder');
  const segCreate = code.slice(iCreate, iCreate + 400);
  ok(/lobby\(\)/.test(segCreate) && segCreate.indexOf('lobby()') < segCreate.indexOf('doCreate()'),
     '★ _createForLadder **先打开界面再建房** —— ' +
     '否则房建好了没有界面在等它，用户看到白屏');

  const iJoin = code.indexOf('function _joinForLadder');
  const segJoin = code.slice(iJoin, iJoin + 300);
  ok(/lobby\(\)/.test(segJoin) && segJoin.indexOf('lobby()') < segJoin.indexOf('doJoin('),
     '★ _joinForLadder 同样先打开界面 —— 进去了也得看得见');

  /* 建房成功后必须画等待屏 */
  ok(/waiting\(r\.roomId/.test(code),
     '★ 建房成功后调 waiting() 画「等对手进来」那一屏');
}

/* 天梯 UI 调的那两个方法必须真的存在 */
{
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  const ld = fs.readFileSync('/home/claude/work/repo/hansen_ladder_ui_v1108.js', 'utf8');
  for (const m of ['_createForLadder', '_joinForLadder']) {
    ok(new RegExp(m + '\\s*:').test(ui),
       `★ HansenPkRoomUI 导出了 ${m}（天梯 UI 靠它开房/进房）`);
  }
  ok(/HansenPkRoomUI\._createForLadder|HansenPkRoomUI &&[\s\S]{0,80}_createForLadder/.test(ld),
     '★ 天梯 UI 确实调用了 _createForLadder');
}


/* ── 🔴v1154 追加：对战中的两个真问题 ────────────────────── */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

  /* ① 对手比分从来没更新过 */
  ok(/st\.oppScore = _opp/.test(code),
     '★ **对手比分要跟着 winners 更新** —— ' +
     '两人真机对打实测：A 答对后 B 那边仍显示"对手 0"。' +
     'oppScore 只在开局被设成 0，之后一次都没被赋值 —— ' +
     '"实时比分"这个功能从来只有一半');
  ok(/_ob\.textContent = String\(_opp\)/.test(code),
     '★ 算出来要写回界面');

  /* ② 等对手交卷不能没有上限 */
  ok(/_waitResult > 22/.test(code),
     '★ **等对手交卷有 45 秒上限** —— ' +
     '原来只是每 2 秒重试、没有任何超时：' +
     '对手关掉页面/网断了/结算写入丢一次，这边就永远停在等待屏');
  ok(/byAbandon: true[\s\S]{0,60}mine: score/.test(code),
     '★ 超时按"对手离场"结算 —— 让这一局有个交代，而不是把人吊在那儿');
  ok(/\)\['catch'\]\(function \(\) \{[\s\S]{0,200}_waitResult/.test(code),
     '★ 网络异常也算一次等待 —— 别让异常把这条链断掉');

  /* ③ 对战中断网要提示 */
  ok(/prNetWarn/.test(code) && /_netMiss === 5/.test(code),
     '★ 对战中连续 5 次拿不到房间状态就提示"网络不稳，正在重连" —— ' +
     '不打断对局（网可能马上回来，把人踢出去比卡着更糟）');
  ok(/_netMiss = 0;[\s\S]{0,160}prNetWarn[\s\S]{0,40}remove\(\)/.test(code),
     '★ 网络恢复后提示自动撤掉');
}

/* 天梯的防重入 */
{
  const ld = fs.readFileSync('/home/claude/work/repo/hansen_ladder_ui_v1108.js', 'utf8');
  const c2 = ld.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = c2.indexOf('function startMatching');
  ok(/if \(_cancel\) \{ try \{ _cancel\(\); \}/.test(c2.slice(i, i + 400)),
     '★ **开始排位要防重入** —— ' +
     'stop 是局部变量而 _cancel 是共享的，连点两下会让几个循环互相踩');
  ok(/lr && lr\.ok === false/.test(c2),
     '★ **断网判据看返回值** —— listRooms 失败时返回 {ok:false} 而不抛异常，' +
     '只挂 .catch 永远进不去，界面会一直转圈');
  ok(/function showOffline/.test(c2),
     '★ 连不上时有专门的一屏（📡 连不上网络 + 重新找对手）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
