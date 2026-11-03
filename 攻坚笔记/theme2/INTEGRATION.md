# 主题 2.0 接入指南（给以后接手的开发者）

> 这份文件说明：主题 2.0 的地基（本分支新加的文件）以后怎么一步一步接进游戏。
> **按顺序做，每一步都能单独发布、单独回退。** 每一步都写了：改哪里、为什么、用什么测试兜底、有什么风险。
> 地基本身只有新文件，没有改任何老文件，所以合并进主线时不会冲突。

---

## 0. 地基里有什么

| 文件 | 会不会上线 | 是什么 |
|---|---|---|
| `hansen_theme2_registry_v1166.js` | ✅ 上线 | **唯一真源**：47 个颜色角色、12 套基础角色、44 个主题、全部老主题 → 2.0 的映射、读老存档决定显示哪个主题、季节窗口、颜色算法 |
| `theme2_tokens.css` | ✅ 上线 | 由 registry **自动生成**的 CSS 变量（`--t2-*`），19.8 KB / gzip 3.6 KB。**不许手改** |
| `theme2_base.css` | ✅ 上线 | 基础组件（`.t2-*`）：顶栏、底栏、卡片、按钮、彩色玩法卡+标签底板、对错卡、角标、进度条、丝带、遮罩、背景层、3 个季节静态场景 |
| `hansen_theme2_icons_v1166.js` | ✅ 上线 | 14 个 SVG 小图标（金币、钻石、经验、星、火、对、错、喇叭…），代替会变空框的新 emoji |
| `hansen_theme2_fonts_v1166.js` | ✅ 上线 | 字体计划：标题卡通字在 DOMContentLoaded 注入（以前要等 window.load） |
| `hansen_fx_v1166.js` | ✅ 上线 | 庆祝特效引擎 + 庆祝队列（红线由代码保证） |
| `攻坚笔记/theme2/tools/*.mjs` | ❌ 不上线 | 构建、对比度门禁、测试小工具、样张页、补丁计数 |
| `test_theme2_*_v1166.mjs`、`test_fx_*_v1166.mjs` | ❌ 不上线 | 7 个测试 |

**为什么能确定上线/不上线：**
- `package_release.py` 打包所有根目录的 `.js/.css`（`DEPLOY_ALLOWED_EXT`），不打包 `.mjs` 和 `.md`；
- `cloudbaserc.json`（`tcb hosting deploy` 用）忽略 `test_*.mjs`、`_*.mjs`、`攻坚笔记/**`；
- 工具不能用 `_` 开头：`.gitignore` 忽略 `_*.mjs`（会提交不上去）；也不能放根目录不带前缀：`tcb` 会把它传上去。所以工具放在 `攻坚笔记/theme2/tools/`，两条部署路都不碰它。

**命名决定（重要）：**
- 所有变量 `--t2-` 开头、所有类名 `t2-` 开头、属性 `data-t2-*`。
  原因：样稿用的 `--hi`、`--line` 在 `spelling_bee.html` 里已经有了，`--font-body` 在 `index.html`/`template.html` 里已经有了；
  `body[data-theme]` 被金币主题和拼写蜂占用。加前缀 = 零冲突，而且 `grep -c "var(--t2-"` 就是迁移进度。
- 样稿 → 2.0 的对照：样稿的 `--ink-1` 就是 `--t2-ink-1`，`.tile .lab` 就是 `.t2-tile .t2-plate`，`FX.burst` 就是 `HansenFX.burst`（参数一样）。

---

## 1. 每次改颜色的规矩（永远适用）

1. 只改 `hansen_theme2_registry_v1166.js` 里的数据。
2. `node 攻坚笔记/theme2/tools/theme2_build.mjs` 重新生成 `theme2_tokens.css`。
3. `node 攻坚笔记/theme2/tools/theme2_contrast.mjs` —— 有一对不达标就退出码 1，**不许发布**。
   会顺手写报告：`--json 攻坚笔记/theme2/contrast_report.json`（同时生成 `.md` 表格）。
4. `node test_theme2_contrast_v1166.mjs`（门禁 + 自证 + CSS 与 registry 一致 + 浏览器取值一致）。

门禁查什么（每个主题 97–127 对，共 4,842 对）：
- 四级文字（ink-1/2/3、hi）压在两种卡面上、ink-1 压在凹槽上；
- 页面上直接压在背景上的字：背景三段 × **每团星云最浓处**（样稿没算星云，这里算了 —— 第一次跑就抓出了 4 个主题顶部标题看不清）；
- 场景主题：遮罩叠在**场景的每个取样色**上；
- 顶栏、底栏（含选中）、金色/靛蓝按钮、对/错底、角标、首页大卡；
- 标签底板叠在 **9 种玩法卡的 18 个渐变端点**上（最坏情况）；
- 图标/边框/焦点框 ≥ 3：对、错、提醒、焦点、输入框边、钻石、经验条，在两种卡面上；金币/星星（填充和描边取好的那个）在卡面和顶栏上；
- 可选主题两两之间背景差 ΔE ≥ 10（TV-13：暗夜紫≈深空蓝的问题不会再出现）。

---

## 2. 接入顺序

### 第 1 步 · 只挂上，不改画面（S，半天）

**改哪里：** 所有运行时页面的 `<head>`：`index.html`、`template.html`、`land_template.html`、8 个 `island_land*.html`（手工维护，**generate.py 不管它们**，见交接文件 §13「页面接线」）、`spelling_pk.html`、`spelling_bee.html`、`boss_hall.html`、`land_map.html`、`season_showcase.html`。

在现有的 v856 配色防闪内联脚本（`index.html` 第 77 行附近、`template.html` 同位置）**后面**加：

```html
<link rel="stylesheet" href="theme2_tokens.css?v=NNNN">
<link rel="stylesheet" href="theme2_base.css?v=NNNN">
<script src="hansen_theme2_registry_v1166.js?v=NNNN"></script>
```

- registry 是**同步**脚本：放在 head 里，首帧前就写好 `<html data-t2-theme data-t2-base data-t2-mode>`，不闪（测试 `test_theme2_registry` ⑤ 证明了“下一行代码执行时属性已在”）。
- 它只写 `data-t2-*` 三个属性，不碰老类名 `hsn-pal-*`、不碰 `body[data-theme]`、不写任何存档、不开任何定时器（同一测试逐项证明）。
- `theme2_tokens.css` 只定义 `--t2-*` 变量；`theme2_base.css` 只有 `.t2-*` 类 → 老画面**一个像素都不变**。
- `hansen_theme2_fonts`、`hansen_theme2_icons`、`hansen_fx` 放在 body 末尾（或 defer），哪个页面用到哪个页面挂。

**然后：**
- `python3 generate.py`（19 个常规岛）、`python3 generate_land.py --verify`（8 个大陆岛）重新生成。
- 升版本号**用 `python3 bump_version.py <新版本>`**。⚠️ 别用交接文件 §8 里那段“全仓字符串替换”的脚本：从 v1166 升到 v1167 时，它会把 `hansen_fx_v1166.js` 的引用一起改成 `_v1167.js`，文件就找不到了（守卫「引用不存在」会拦下，但要回头修）。如果一定要用那段脚本，把 `hansen_theme2_*_v1166.js`、`hansen_fx_v1166.js` 加进它的 `SKIP`，并且只替换 `?v=` 戳。
  新文件内容里**没有写任何版本号字面量**（测试检查），所以被批量替换也只会影响文件名引用。

**加的守卫（`hansen_guards_v1068.py` + `jarvis_selftest.py` 各加一条，规矩见交接文件 §13）：**
1. 「主题 2.0 接线」：上面每个页面都引用了 `theme2_tokens.css`、`theme2_base.css`、`hansen_theme2_registry`，且 registry 在 `</head>` 前（同步）。自证样本：删掉某页 registry 的 `<script>` 标签（认 `<script ... hansen_theme2_registry`，别只认文件名 —— 注释里也会提到它）。
2. 「主题 2.0 tokens 同步」：调 `node 攻坚笔记/theme2/tools/theme2_build.mjs --check`，非 0 就报红。自证样本：往 `theme2_tokens.css` 末尾加一行注释。
3. 「主题 2.0 对比度」：调 `node 攻坚笔记/theme2/tools/theme2_contrast.mjs --quiet`，非 0 就报红。自证样本：把 registry 里 cosmos 的 `on_accent` 改成 `#FFFFFF`（金色按钮白字，TV-04 原样复现）。

**兜底测试：** 全部 7 个新测试（`python3 跑测试.py test_theme2_contrast_v1166 test_theme2_registry_v1166 test_theme2_scene_art_v1166 test_theme2_specimen_v1166 test_theme2_icons_v1166 test_theme2_fonts_v1166 test_fx_rules_v1166 test_fx_idle_cost_v1166`）+ 现有 `light_guard.py`、`test_light_readability_v1016.mjs`（证明画面没变）。

---

### 第 2 步 · 小修（不动架构，按审查报告第 0 阶段，每条 S）

都改成用 `--t2-*`，每条单独提交：

| # | 改什么 | 在哪 | 2.0 写法 |
|---|---|---|---|
| 1 | 玩法卡、每日卡标签白字压亮色（听音辨义 2.08） | `template.html` `.mode-card .m-title`（约 807 行）、`.d-label`（768/775）；`land_template.html` 同步 | 标签包一层 `.t2-plate`，或者直接 `background:var(--t2-plate);color:var(--t2-on-plate)` |
| 2 | 金色按钮白字（“再来一轮” 2.61） | `template.html` `.game-btn.gold`（约 1293/1298）、商店 `.dia-btn.buy` | `color:var(--t2-on-accent)`（深紫） |
| 3 | 打Boss 主题选择器标签（“晨曦” 1.24） | `hansen_boss_theme.js` 选择器 | 标签放 `.t2-plate` |
| 4 | 亮色下听音辨义回合栏 1.04、Boss 列表顶栏、宝箱奖励数字 14px | `template.html` 6505 一带（行内 `color:#fff`）、`hansen_cards.js`、`template.html` 1207-1211 | 字改 `var(--t2-chrome-ink)`；奖励数字 `.t2-num.t2-fs-6`（24px Baloo2） |
| 5 | 进岛加载页写死深蓝（亮—暗—亮跳一下） | `index.html` 2410-2416 | `background:var(--t2-bg-1);color:var(--t2-ink-2)` |
| 6 | 首页视差 rAF 空转、主题 1.5 秒轮询 | `index.html` 3895-3912、4234-4257 | 删视差；主题改听 `hansen:theme2` 事件（registry 在 storage/pageshow/visibilitychange 时会发） |
| 7 | 'Bowlby One' + serif 兜底（11 处） | `index.html` 161/171/253/365/1373/1412/1526/1658/1684，`template.html` 325/335 | 换成 `var(--t2-font-latin)`；卡通字改由 `hansen_theme2_fonts` 在 DOMContentLoaded 注入，删掉 `template.html` 的 `__hsnLateFont`（约 8590 行）—— fonts 模块发现已有声明就不重复，所以两者短期共存也安全 |
| 8 | 顶栏 🪙/💎、开箱飞出的 🪙 | `template.html` 1474、`hansen_checkin_global.js` 385-420 | `HansenIcons.svg('coin')` / `HansenIcons.swapEmoji(顶栏元素)` |
| 9 | 单词大陆副标题全一样 | `land_template.html` 1464 + `generate_land.py` | 从 land_data 生成 |
| 10 | 奖杯无限弹跳 | `template.html` 5071 | `HansenFX.pop(奖杯, 1.15)` 一次 |
| 11 | 金币主题首页、岛内两份定义（樱花粉首页浅粉、岛内深紫） | `index.html` 284-333 ⇄ `template.html` 612-656 | 两边都删掉自己的定义，改用 registry 的 `coin_*`（首页、岛内同一份，各自声明亮/暗） |

**要同步改的守卫：** `check_resources.py` 里写死原文的断言（例如 2551、2805、3994 行的 `color:var(--pal-ink,#fff)`、5447/5450 行的 `.pet-stage{…}`），改哪条组件就在**同一个提交**里改对应断言（审查报告风险 2）。

---

### 第 3 步 · 组件迁移 + 删补丁层（L，1.5–2 周）

**补丁层是什么：** `hansen_palette.js` 在亮色配色下注入的 `<style id="hsnPaletteCSS">`。
**当前基线（本分支实测，云端白）：123,164 字节、815 条规则、2,295 个选择器，其中 `[style*=…]` 640 个、`!important` 1,372 个。**
用 `node 攻坚笔记/theme2/tools/patch_count.mjs` 随时重测。**目标：640 → 0。**

**顺序（按覆盖面从大到小）：** 顶栏 → 底栏 → 玩法卡/每日卡 → 按钮 → 卡片和面板 → toast → 结算页 → 宝箱 → 设置页。

**每个组件都走这 5 步（一个组件一个提交）：**
1. 组件 CSS 改成只用 `var(--t2-*)`。第一版可以写 `var(--t2-ink-1, var(--pal-ink, #fff))`，保留老变量作兜底一版。
2. 组件里 JS 拼的行内颜色（`style="color:#fff"` 这类）改成类名（`.t2-ink-1` 等）—— 行内颜色正是补丁层存在的原因。
3. 删掉 `hansen_palette.js` 里**只为这个组件**写的 `[style*=…]` 规则。判断方法：删之前在 4 个亮色配色下用 `light_probe.mjs` 截这个组件的画面，删之后再截，逐段对比度不能变差。
4. 跑安全网（下面）。
5. `patch_count.mjs` 记下新数字，写进提交信息（进度一目了然）。

**安全网（每个组件都要跑）：**
- `python3 light_guard.py`（4 亮色 × 真实界面逐像素）；
- `node test_light_readability_v1016.mjs`（基线会抖，交接文件 §9 第 7 条）；
- `node test_theme2_specimen_v1166.mjs`（44 主题 × 组件逐像素）；
- `node 攻坚笔记/theme2/tools/theme2_contrast.mjs`；
- 建议新增一个测试：把审查报告的 `scripts/s10_matrix.mjs` 改成“2.0 主题 × 10 个关键画面”，每迁移一个组件跑一次，**只许不达标数变少**。

**结算页合并：** `listenComplete`（约 6543）、`matchComplete`（6597）、`typeComplete`（6789）、`clozeComplete`（6987）、`scrComplete`（6290）、`molesComplete`（5324）、`fishComplete`（5763）、`bubbleComplete`（6102）、`eagleComplete`（8180）、`reviewComplete`（7304）、`bossVictory`（4983）合并成一个 `renderRoundResult()`，用 `HansenFX.roundResult()`。

**加两条“只许减少”的守卫：**
- `template.html` 里十六进制颜色的个数（审查报告基线 1,319 种）；
- `[style*=` 的个数（`hansen_palette.js` 源码里现在 111 处，生成后 640 个）。

---

### 第 4 步 · 庆祝系统接入（M，3–5 天）

`hansen_fx` 已经把红线写进代码（测试 `test_fx_rules` 逐项证明），接入时只需要在对的地方调用：

| 时机 | 调用 | 现在在哪 |
|---|---|---|
| 每个玩法开始一轮 | `HansenFX.roundStart()` | 各 `startXxxLevel` |
| 答对 | `HansenFX.answerRight(选项元素, {xp: 经验条, streak: 连对数字})` | `listenAnswer` 等（`template.html` 6519 一带） |
| 答错 | `HansenFX.answerWrong(选项元素)` + 揭晓卡 `.t2-bad` 写“正确答案”和 `HansenFX.COPY.again` | `template.html` 6513 的 else 分支 |
| 连对 5 / 10 | `HansenFX.ribbon(HansenFX.COPY.streak5)` | 现在的文字 toast |
| 升级 | `HansenFX.celebrate('levelUp', {lv}, 播放函数)` —— **做题中会自动攒着**（v321：升级不挡做题） | `template.html` 2781-2791 |
| 宠物进化 | `HansenFX.celebrate('evolve', …)` | `template.html` 2995-3001 |
| 成就 | `HansenFX.celebrate('achievement', …)` | `template.html` 1318-1323 |
| 一轮结束 | `HansenFX.roundEnd()`；结算页里 `HansenFX.flushDeferred()` 拿到“升级 → 进化 → 成就（多个合成一条）”，画成结算页上的卡片 | 各 `xxxComplete` |
| 开宝箱 | `HansenFX.chestOpen({chest, target: 顶栏金币, countEl, from, to, reward})` | `hansen_checkin_global.js` 385-420（删掉 brightness(2.7) 和 644px 白光） |
| 打赢 Boss | `HansenFX.celebrate('boss', …)`；“新 Boss 解锁”改成页内卡片排在胜利之后 | `hansen_boss_progress.js` 208-216 |
| 切页 | `HansenFX.stopAll()` | `showScreen` |

播放函数可以返回 Promise（比如“等孩子点了收下”），队列会等它结束再播下一个。

**守卫：**「动效红线」—— 新代码里不许出现 `infinite`（白名单只留加载转圈）、`@keyframes` 里不许 `rotate`、不许对 `filter`/`box-shadow` 做动画。自证样本：往 `template.html` 加一条 `animation:x 1s infinite`。

**性能证明：** `test_fx_idle_cost_v1166`：CPU 降速 4 倍，答对 / 结算 / 开宝箱 触发后 3 秒主线程忙 4.4–5.2% / 7.2–9.0% / 11.8–15.8%（报告里样稿是 9.6 / 20.7 / 25.1），播完 0 动画，之后空闲 ≤0.05%。

---

### 第 5 步 · 统一主题入口（M–L，约 1 周）

- 设置页只留一个“主题”入口，分四区：免费配色 / 场景（金币）/ 典藏（钻石）/ 季节。
  预览卡用局部属性：`<div data-t2-base="cloud" data-t2-theme="coin_peach">`（测试证明局部覆盖可用）。
- 老的 4 个选择器（配色、金币主题、钻石商店、打Boss）继续写各自的老键 —— registry 只读它们，`resolve()` 决定显示哪个：
  **钻石场景 > 季节选择 > 非默认配色 > 已买的金币主题 > 深空蓝**（和现在画面上谁压谁完全一致）。
- 季节主题：`HansenTheme2.seasonal()` 给出当前可选的（新春：春节前 21 天到元宵；雪国：12–2 月；六一：5/25–6/7）。孩子选了 → `HansenTheme2.pickSeason(id)`（只写新键 `hansen_theme2_season_pick`）。
  **决定：** 季节过了不强制换掉（孩子不喜欢东西“自己消失”）；而孩子之后在老设置里换配色/金币主题，季节选择会**自动失效**（registry 记下了选的时候的配色，不一样就不认），所以老界面不用改也不会“换了没反应”。
- IMAX：默认只画一帧（`hansen_cinema_themes` 已有 `drawStatic`），进首页 / 过关时播 ≤6 秒再停。2.0 给 IMAX 配了亮/暗角色（亮场景配亮角色，TV-03 的 35% 不达标从根上没了）。
- 画廊：`<div class="t2-scene">` + `data-t2-scene`（CSS 已生成 18 条，只有装备的那张图会下载），粒子静态化，漂移层（`hansen_diamond_shop.js` 209-211 的 blur(48px) 无限漂移）改静态。
- 打Boss 舞台：`HansenTheme2.bossStage()`（没选过跟随全局明暗 —— 和 v1010 一样；选“电影场景”= 当前装备的 IMAX）。
- 卡册底色 / 殿堂卡面：底色画面保留，卡上的字用 `HansenTheme2.cardBg(id)` / `bossHallBg(i)` 给的主题角色。
- 拼写蜂：`HansenTheme2.spellingBee()`，6 个老选择照样生效；**没选过的人从“默认晴空亮色”改为“跟随全局”** —— 这是有意的行为变化（TV-12），需要老师真机看一眼再发。
- **已买的东西一个不丢：** 测试逐个对过商店源码：26 个钻石主题、6 个金币主题都有映射；已下架的 5 个老钻石 id（theme_storm 等）的购买记录照样算数；没付钱的金币主题不会被显示（和 `hansen_theme_lock` 一致）。

---

## 3. 风险

1. **动效要老师先在真机上点头。** 宝箱光环、头像光环、翻面彩纸算不算“闪”，样稿可以直接拿给老师看（`攻坚笔记/next_inputs/theme_mockups/`）。
2. **字符串守卫写死原文。** `check_resources.py`、`fx_guard.py` 有很多原文/像素基线，每迁移一个组件都要在同一个提交里更新（审查报告风险 2）。
3. **大陆页手工改过。** 8 个 Land 页不是 generate.py 生成的，接线要逐页加，用 `generate_land.py --verify` 和守卫「页面接线」把关。
4. **旧内核。** 运行时文件全部 ES5 写法（测试检查）；WAAPI 线上 `hansen_boss_attack.js` 已有 538 处在用；`clip-path` 只用在星星粒子上（不支持时是方块，不影响功能）；`contain:strict` 不支持时只是少一点优化。
5. **升版脚本误改文件名。** 见第 1 步。用 `bump_version.py`。
6. **门禁算的是“设计值”。** 真画面里组件如果没用对角色（比如写死 `#fff`），门禁看不见 —— 所以还有 `test_theme2_specimen`（组件逐像素）和第 3 步建议的“真画面矩阵扫描”。
7. **拼写蜂默认值变化**（见第 5 步）和**季节主题过季不撤**是两个产品决定，已写明理由，老师可以推翻：改 registry 的 `spellingBee()` / `readSeasonPick()` 各一行即可。
8. **春节日期表写到 2035 年。** 之后要补（`test_theme2_registry` 会检查表是连续的；过了 2035 年这个测试会提醒）。
9. **需要真机确认：** 旧安卓上 🪙/🫧/🪼 是否空框（`HansenIcons.emojiOk()` 可以在真机上直接测）；IMAX / 画廊在低端机上的发热；加载页颜色在微信里是否还跳。
