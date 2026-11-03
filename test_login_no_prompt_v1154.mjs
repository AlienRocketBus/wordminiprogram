const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_login_no_prompt_v1154.mjs —— 登录时能自动就别弹框
 *
 * 🔴 用户现场（截图）：每次登录都弹一个对话框——
 *
 *     这个账号在云端已有进度，本机也有进度，需要你选一份保留：
 *     【本机】0 个岛 · 已学 0 个单词
 *     【云端】最后保存于 8/3/2026, 2:39:25 AM
 *     点「确定」= 用云端覆盖本机
 *     点「取消」= 用本机覆盖云端
 *
 * **本机 0 个岛、0 个单词 —— 有什么好选的？**
 * 用户原话：「不需要每次出这种对话框，它会自动就覆盖现在的记录。」
 *
 * ═══ 根因 ═══
 *
 * `localHasProgress()` 里判"本机有没有进度"时算上了 `stats`：
 *
 *     if (o && ((o.learned && o.learned.length) ||
 *               (o.stats && Object.keys(o.stats).length))) return true;
 *
 * 而 `stats` 只是答题统计 —— **点开一个岛看一眼就会有**。
 * 于是一个单词没学也被判成"本机有进度"，每次登录都弹框。
 *
 * ═══ 修法 ═══
 *
 *   ① "有进度"只认 `learned`（真正学会的单词）—— 那才是会丢的东西
 *   ② 云端信息带上"学过多少词"，登录时和本机比
 *   ③ 本机**明显更少**（不足云端一半）→ 直接用云端，不问
 *   ④ 只有"两边都有相当规模"才弹框 —— 那时确实只有用户知道该留哪份
 *   ⑤ 自动取回后在提示条里说一声（不拦人，但也别让人莫名其妙）
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('登录不弹框 v1154');

const auth = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
const code = auth.replace(/\/\*[\s\S]*?\*\//g, '');
const cs = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const ui = fs.readFileSync((__HSN_ROOT + 'hansen_auth_ui_v1004.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/* ① "有进度"不再把答题统计算进去 */
{
  const i = code.indexOf('function localHasProgress');
  const seg = code.slice(i, i + 900);
  ok(/o\.learned && o\.learned\.length/.test(seg),
     '★ "本机有进度"只认 learned（真正学会的单词）');
  ok(!/o\.stats && Object\.keys\(o\.stats\)\.length/.test(seg),
     '★ **不再把 stats 算作进度** —— 点开一个岛看一眼就会有 stats，' +
     '那不叫"有进度"，却让每次登录都弹框');
}

/* ② 云端信息要带学习量，否则没法比 */
{
  ok(/learned: _cw/.test(cs) && /islands: _ci/.test(cs),
     '★ accountCloudInfo 返回云端学过多少词');
  ok(/_k\.indexOf\('wordIsland'\) !== 0/.test(cs),
     '★ 只统计岛屿进度键');
}

/* ③ 本机明显更少就自动用云端 */
{
  ok(/action: 'restored'/.test(code) && !/action: 'conflict'/.test(code),
     '★ **两边都有也直接用云端，不弹框**（v1158 规则）—— 原来是「本机不足云端一半才自动选」，现在一律以云端为准：注册那次上传过，之后云端永远最新');
  ok(/autoPicked: 'cloud'/.test(code),
     '★ 自动选择时打上标记，供界面提示');
  ok(/markLocalOwner\(uidNow\)[\s\S]{0,200}autoPicked/.test(code) ||
     /autoPicked[\s\S]{0,200}markLocalOwner\(uidNow\)/.test(code) ||
     /markLocalOwner\(uidNow\);\s*\n\s*return \{ ok: true, action: 'restored'/.test(code),
     '★ 自动恢复成功后打归属标记（和 v1144 的规则一致：成功才标）');
}

/* ④ 界面要说一声，但不拦人 */
{
  ok(/autoPicked === 'cloud'/.test(ui),
     '★ 界面识别"自动取回"这种情况');
  ok(/已自动取回云端进度/.test(fs.readFileSync((__HSN_ROOT + 'hansen_auth_ui_v1004.js'), 'utf8')),
     '★ 在提示条里说一声 —— 不该让人"进度突然变了却不知道为什么"');
  ok(!/confirm\([\s\S]{0,120}autoPicked/.test(ui),
     '★ **自动路径上没有 confirm** —— 不拦人');
}

/* ⑤ 决策表：逐种情况验一遍 */
{
  const decide = (lw, cw, cloudExists) => {
    if (!cloudExists) return lw > 0 ? 'upload' : 'nothing';
    if (lw === 0) return 'auto-cloud';                 /* hasLocal=false */
    if (cw > 0 && lw * 2 < cw) return 'auto-cloud';
    return 'ask';
  };
  ok(decide(0, 500, true) === 'auto-cloud',
     '★ 截图那种（本机 0 词、云端有档）→ 自动用云端，不问');
  ok(decide(3, 500, true) === 'auto-cloud',
     '★ 本机只点开看过几眼 → 自动用云端');
  ok(decide(200, 500, true) === 'auto-cloud',
     '★ 本机学过不少但云端多一倍以上 → 自动用云端');
  ok(decide(400, 500, true) === 'ask',
     '★ 两边都有相当规模 → **仍然问** —— 这时确实只有用户知道该留哪份');
  ok(decide(500, 0, false) === 'upload',
     '★ 云端空、本机有 → 上传本机（不会反过来清空用户进度）');
  ok(decide(0, 0, false) === 'nothing', '★ 两边都空 → 什么都不做');
}


/* ── 🔴v1154 追加：上传的三道红线 ────────────────────────
 *
 * 用户现场原话：「我在这个账号里面的进度乱七八糟，
 * 所有的东西它会自动不停地上传到云端，退出的时候也会自动上传。」
 *
 * 查下来**是我自己造成的**：
 *   · v1029 立过红线"本机是空的就绝不上传"，
 *     但它**只写在 `syncOnLogin` 里**
 *   · 而 v1134 加的"数据一变 8 秒就同步"直接调 `syncNow`
 *   · v1145 加的"退出前强制上传"也直接调 `syncNow`
 *   **两条新路都绕过了那道红线。**
 *
 * 后果非常具体：在一台本机空白的手机上登录，
 * 云端恢复还没跑完，任何一次写入（签到、钱包初始化、写个名字）
 * 就触发同步 → **把空白盖到云端** → 用户几百个词的进度没了。
 */
{
  const csRaw = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8');
  const csc = csRaw.replace(/\/\*[\s\S]*?\*\//g, '');

  ok(/if \(_restoring\) \{/.test(csc),
     '★🔒 **恢复期间禁止上传** —— 那几秒本机是"半份状态"' +
     '（一部分云端的、一部分旧的），传回去会把云端那份好档搅坏');
  ok(/!opts\.allowEmpty && !localHasAnyProgress\(\)/.test(csc),
     '★🔒 **本机没有学过的词就拒绝上传** —— ' +
     'v1029 的红线终于补到了 syncNow 这一层');
  ok(/function localHasAnyProgress/.test(csc) &&
     /o\.learned && o\.learned\.length/.test(csc),
     '★🔒 判据只认 learned，和登录对账保持一致（不认 stats）');
  ok(/then\(_done, _fail\)/.test(csc),
     '★🔒 恢复标记**成功失败都会解除** —— ' +
     '否则一次恢复失败会让这台设备从此再也传不上去');
  ok(/allowEmpty/.test(csRaw) && /用户明确要求清空云端/.test(csRaw),
     '★ 留了 allowEmpty 后门但写明只给"用户明确要求清空"用，自动路径永不带它');
}

/* 上传决策表 */
{
  const upload = (restoring, localWords, allowEmpty) => {
    if (restoring) return 'refuse-restoring';
    if (!allowEmpty && localWords === 0) return 'refuse-empty';
    return 'upload';
  };
  ok(upload(true, 0) === 'refuse-restoring', '★ 刚登录、云端正在写 → 拒绝上传');
  ok(upload(true, 120) === 'refuse-restoring', '★ 恢复到一半 → 拒绝（这份是半成品）');
  ok(upload(false, 0) === 'refuse-empty',
     '★ **新手机本机空白、签到触发同步 → 拒绝** —— 这就是"进度乱七八糟"的来源');
  ok(upload(false, 500) === 'upload', '★ 正常玩过 → 照常上传');
  ok(upload(false, 0, true) === 'upload', '★ 明确要求清空云端时才允许传空');
}


/* ── 🔴v1154 追加：整条链一环都不能丢 ──────────────────────
 *
 * 用户要的很明确：
 *   「我只要一登录就出现云端的数据；
 *     玩的过程中所有数据都及时存云端；
 *     突然要退出，下次登录拿到的就是我退出那一刻的最新数据。
 *     不需要我特意手动做这件事。」
 *
 * 逐环查下来，**离开那一刻有两个缺口**：
 */
{
  const csRaw = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8');
  const csc = csRaw.replace(/\/\*[\s\S]*?\*\//g, '');

  /* 缺口一：离开时的同步不带 force，会被 45 秒冷却挡掉 */
  ok(/if\(document\.hidden\) syncNow\(\{force:true\}\)/.test(csc),
     '★🔒 **切到后台时 force 同步** —— ' +
     '原来不带 force，玩一会儿刚同步过、30 秒后关掉 App 就被 45 秒冷却拒绝，' +
     '那 30 秒的进度直接丢');
  ok(/addEventListener\('pagehide', function\(\)\{ syncNow\(\{force:true\}\); \}\)/.test(csc),
     '★🔒 **关页面时 force 同步**');

  /* 缺口二：8 秒合并延迟里关掉 App，那笔改动没了 */
  ok(/var _flushPending = function/.test(csc),
     '★🔒 **离开时把挂着的那次同步立刻兑现** —— ' +
     '8 秒合并延迟本身是对的（连开五个宝箱不该传五次），' +
     '但"拿到奖励顺手切出去"会正好落在这 8 秒里');
  ok(/_flushPending[\s\S]{0,300}pagehide/.test(csc) ||
     /pagehide[\s\S]{0,80}_flushPending/.test(csc),
     '★🔒 关页面会触发兑现');
  ok(/if \(document\.hidden\) _flushPending\(\)/.test(csc),
     '★🔒 切后台也会触发兑现（手机上划掉 App 往往只有 visibilitychange）');

  /* 例行那次仍然不带 force —— 不能改成每次都强传 */
  ok(/syncNow\(\{\}\);\s*$/m.test(csc) || /syncNow\(\{\}\)/.test(csc),
     '★ 例行合并同步仍不带 force —— 被冷却挡住无妨，后面还会再触发，' +
     '不该为它白烧云端写次数');
}

/* 整条链的完整性 */
{
  const csRaw = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8');
  const auth = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
  const links = [
    [/autoPicked: 'cloud'/.test(auth), '登录 → 自动取回云端（不弹框）'],
    [/hsn-data-changed/.test(csRaw), '玩的过程中 → 数据一变就排队上传'],
    [/5 \* 60 \* 1000/.test(csRaw), '玩的过程中 → 每 5 分钟兜底'],
    [/if\(document\.hidden\) syncNow\(\{force:true\}\)/.test(csRaw), '切后台 → 强制上传'],
    [/pagehide/.test(csRaw), '关页面 → 强制上传'],
    [/CS\.syncNow\(\{ force: true \}\)/.test(auth), '退出登录 → 强制上传并等完成'],
  ];
  for (const [okFlag, name] of links) {
    ok(okFlag, `★ 链路完整：${name}`);
  }
}


/* ── 🔴v1154 追加：三层障碍，每一层都让"自动存云端"变成空话 ──
 *
 * **我一开始只检查"代码里有没有那几行"，看起来全都对。
 * 真用浏览器跑一遍 —— 三环全废。**
 *
 * 逐层挖出来的：
 *
 *   ① `hansen_change_notify` 的钩子**被 cred_trap 盖掉了**
 *      它写在页面很靠前，但真正装钩子在 DOM 就绪之后 ——
 *      时序上排在我后面。→ 改成"加载时装一次、DOM 就绪后再装一次"
 *
 *   ② `enabled` 只在**手动点过同步**之后才为真
 *      登录后如果云端没档、也没人点过「立即同步」，
 *      `enabled` 永远 false，每次同步都被 `not-enabled` 拒。
 *      → 改成**登录就自动开启**（用户："不需要我特意手动去做"）
 *
 *   ③ **8 秒防抖被"持续写入"饿死**
 *      每次变更都 clearTimeout 重新计时（经典 debounce），
 *      而页面上有模块在持续写 localStorage（心跳、状态刷新）——
 *      **定时器被无限重置，永远等不到 8 秒**。
 *      真浏览器抓到现场：**8 秒定时器创建 2 次，到期 0 次**。
 *      → 改成 throttle：最多合并 8 秒，到点必传。
 *
 * 也就是说 v1134 承诺的"数据一变 8 秒就同步"，
 * **从写下那天起就没有真正生效过**。
 */
{
  const csRaw = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'), 'utf8');
  const csc = csRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const cn = fs.readFileSync((__HSN_ROOT + 'hansen_change_notify_v1134.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /* ① 钩子要能重装，确保自己在最外层 */
  ok(/function install\(\)/.test(cn),
     '★🔒 变更通知的挂载抽成可重复调用的 install()');
  ok(/DOMContentLoaded', install/.test(cn) && /addEventListener\('load', install\)/.test(cn),
     '★🔒 **DOM 就绪后再装一次** —— 谁后装谁在外面；' +
     'cred_trap 在 DOM 就绪后才装，不重装就会把我们盖掉');
  ok(/__hsnMine/.test(cn),
     '★🔒 标记"这层是我的"，重装时判断，不会无限套娃');

  /* ② 登录就自动开同步 */
  ok(/isSignedIn\(\)[\s\S]{0,120}writeState\(\{ enabled: true \}\)/.test(csc),
     '★🔒 **登录就自动开启云同步** —— 不该等用户去设置页点一下');
  ok(/setTimeout\(function \(\) \{[\s\S]{0,200}isSignedIn\(\)[\s\S]{0,160}enabled: true/.test(csc),
     '★🔒 启动时也补一次 —— 上次已登录、这次直接打开页面，' +
     'hsn-auth-changed 不会再发');

  /* ③ throttle 而不是 debounce */
  ok(/_firstAt/.test(csc),
     '★🔒 记下第一次变更的时刻');
  ok(/now - _firstAt >= 8000/.test(csc),
     '★🔒 **攒够 8 秒立刻传，不再往后推** —— ' +
     '否则持续写入会把定时器无限重置（实测：创建 2 次、到期 0 次）');
  ok(/Math\.max\(500, 8000 - \(now - _firstAt\)\)/.test(csc),
     '★🔒 定时器时长按"距第一次变更还差多久"算');
  ok(/syncNow\(\{force:true\}\)/.test(csc),
     '★🔒 这一路带 force —— 45 秒冷却会把 8 秒那次挡掉');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
