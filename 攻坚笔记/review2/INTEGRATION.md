# 复习系统 2.0 · 接线说明（给之后负责接线的人）

> 本轮只新增了文件，**一个现有文件都没改**。下面是把它接进游戏要做的每一步、为什么、要加哪些守卫和测试、有哪些风险。
> 设计见 `DESIGN.md`，做了什么、怎么验见 `REPORT.md`。行号以 `claude/intelligent-euler-rofqws-next`（v1163 + v1165 工作）为准，接线前先 `grep` 确认。

## 0. 新文件一览

| 文件 | 部署？ | 作用 |
|---|---|---|
| `hansen_review2_words_v1166.js` | ✅ | 星海 240 词只读词表（≈18 KB，gzip ≈6 KB），首页没有星海词时用 |
| `hansen_review2_v1166.js` | ✅ | 核心：跨岛合并、排期、掌握星、出题、写回账本、发奖励、家长报告。`window.HansenReview2` |
| `hansen_review2_ui_v1166.js` | ✅ | 界面：今日复习浮层、结果页、家长面板、报告图、首页入口按钮、学习分钟。`window.HansenReview2UI` |
| `test_review2_words_v1166.mjs` | ❌ | 词表和岛页一致（`--write` 重新生成词表） |
| `test_review2_core_v1166.mjs` | ❌ | 核心逻辑 237 项（node，不起浏览器） |
| `test_review2_ui_v1166.mjs` | ❌ | 真浏览器全流程（四个真岛页、真手指、8 套配色） |
| `test_review2_shell_v1166.mjs` | ❌ | 首页外壳 + iframe 岛页的同步与不重复发钱 |

部署：三个 `hansen_review2_*` 文件名符合 `hansen_*.js`，`package_release.py` 的 `_deploy_allowed()` 放行（已实测返回 True），
`cloudbaserc.json` 的 ignore 只排除 `test_*.mjs`、`*.py`、`_*` 等，不排除它们。测试文件不会进包。
`分批跑测试.py` 按 `test_*.mjs` 自动发现，四个新测试会自动进闸门（合计约 30 秒）。

**加载顺序没有要求**：两个模块所有依赖（`HansenCanonical`、`HansenCoins`、`HANSEN_VOCAB_ALL`、`HansenReviewRewardsV963`、`speak`）
都是用到时才去 `window` 上找，找不到就安静降级（守卫「加载顺序依赖」的教训）。词表文件要在**第一次打开复习前**加载完即可。

---

## 1. 页面上加脚本

### 1a. 岛屿模板（`template.html`、`land_template.html`）
在 `hansen_review_rewards_v963.js` 那一行（template.html:8383 / land_template.html:8189）后面加：
```html
<script defer src="hansen_review2_words_v1166.js?v=⟦当前版本⟧"></script>
<script defer src="hansen_review2_v1166.js?v=⟦当前版本⟧"></script>
<script defer src="hansen_review2_ui_v1166.js?v=⟦当前版本⟧"></script>
```
然后 **`python3 generate.py` + `python3 generate_land.py` 重新生成 27 个岛页**（岛页不要手改，见交接 §3），`--verify` 核对。
- 为什么岛页也要装：①岛页在 iframe 里，外壳里复习写完账本会调岛页的 `HansenCanonical.syncCurrent()`，岛页自己有账本就行；
  但**别的标签页**里开着的岛页只能靠 UI 模块里的 `storage` 监听来重新同步内存（见 §6 风险 3）；②学习分钟要在岛页里数（孩子大部分时间在岛里）；
  ③岛内的「今日复习」入口要换成新复习（§3）。

### 1b. 首页（`index.html`）
首页现在**没有账本模块**。要加（顺序随意，都用 `defer` 即可，金币钱包和 `vocab_all.js` 首页已经有）：
```html
<script defer src="hansen_canonical_progress.js?v=⟦当前版本⟧"></script>
<script defer src="hansen_review_rewards_v963.js?v=⟦当前版本⟧"></script>   <!-- 建议：让 +20 清零奖励和连击由 v963 一处负责 -->
<script defer src="hansen_review2_words_v1166.js?v=⟦当前版本⟧"></script>
<script defer src="hansen_review2_v1166.js?v=⟦当前版本⟧"></script>
<script defer src="hansen_review2_ui_v1166.js?v=⟦当前版本⟧"></script>
```
- 账本在首页开机会跑一次 `migrate()`（把所有 `wordIsland*` 存档并进账本）。这和每个岛页开机做的事一样，是并集合并，不删东西；
  首页没有 `S`，`syncCurrent()` 什么都不做。代价：首页开机多解析一遍各岛存档（进度多的孩子几十毫秒），可以接受；
  介意的话可以等首页首帧后再 `requestIdleCallback` 注入这几个脚本。
- v963 在首页：`installWrapper()` 找不到 `markAnswer`，轮询 10 秒自己停；横幅要 `.daily-row`，首页没有就不画；`autoMaintain()` 保连击照常。安全。
  **不装 v963 也能用**：复习 2.0 会按同一张收据 `rvrw:<日>:todaydone` 自己发 +20，但不打连击（等孩子下次进岛，岛里的 v963 刷新时补打）。

---

## 2. 首页「今天复习 N 个词」入口（优化报告 #1 的一部分）

在首页第一屏放一个容器（比如岛屿列表上方），然后：
```js
// 首页脚本里（DOMContentLoaded 之后）
function hr2Entry(){ try{ if(window.HansenReview2UI) HansenReview2UI.mountEntry(document.getElementById('hr2Entry')); }catch(e){} }
hr2Entry();
window.addEventListener('pageshow', hr2Entry);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) hr2Entry(); });
window.addEventListener('hansen-review2-closed', hr2Entry);
window.addEventListener('hansen-review2-finished', hr2Entry);
// 岛屿 iframe 关掉回到首页时也刷一次（首页关岛的那个函数里调 hr2Entry()）
```
- `mountEntry` 是幂等的：同一个容器只放一个按钮，再调只更新文字（「今天复习 5 个词 · 大约 2 分钟」/「今天的复习做完啦」）。
- 按钮 64px 高、用 `--pal-*` 配色变量；点它打开 `HansenReview2UI.open()`。
- 首页浮层 `z-index:99990`，在岛屿 iframe（首页里）之上；提示条（`HansenToast`）比它高，照样能看到。

---

## 3. 用新复习替换旧的「自评」今日复习

旧的 `hansen_review.js` → `openTodayReview()`（「看答案 → 记住了 / 没记住」）是自评。替换方法（**保留旧代码当兜底**，新模块缺了还能用旧的）：

| 位置 | 现在 | 改成 |
|---|---|---|
| `hansen_review.js` `_openToday`（≈:900） | `openTodayReview()` | `if(window.HansenReview2UI){HansenReview2UI.open();return;}` 再走旧的 |
| `hansen_review_rewards_v963.js` `bannerClick`（≈:588–603） | local→`_openToday`；cross/urgent→错题总览 | 三种状态都先 `HansenReview2UI.open()`（新复习本来就跨岛），没有再走旧路 |
| `hansen_review_rewards_v963.js` `bannerModel` 的数字 | 按**槽位**数（orange 两个岛 = 2） | 改用 `HansenReview2.overview().dueCount`（按词数），否则横幅说 5 个、复习里只有 4 个 |
| `hansen_mylearning.js`（≈:194） | `_openToday` | 同上，先 `HansenReview2UI.open()` |
| 复习中心卡片 `hr_card ... _openToday`（hansen_review.js:648） | 「今日复习」 | 文字改成「今天复习（听一听·拼一拼）」，点击同上 |

- 旧的 `_grade()` 自评里那条「盒 4 没证据不能毕业」的闸门（v963 刺一）在新复习里不需要了：新复习每题都是真答题。
- `hansen_mistake_lesson_v1165.js` 结算页的「练这 N 个词」照旧走本岛复习中心（那是本轮刚错的词，在本岛练最合适），不用改。
- 错题总览 `hansen_wrong_overview.js` 可以在顶部加一个「一键复习全部到期词」按钮 → `HansenReview2UI.open()`。

### 3b. 掌握星显示（优化报告 #6，可分步）
`HansenReview2.wordStars(英文)` 返回 `{stars:0-5, name:'认识', due, plan, wrongs, evidence}`。建议：
1. 探索单词卡片右上角加 ★（`hansen_explore_progress_v945.js` 画卡片的地方），把「Bee 机器人 <50 CPM 需 10 次」之类规则文字挪进「怎么玩」。
2. 「我的学习」面板（`hansen_mylearning.js`）加一行「掌握星分布」，数据用 `HansenReview2.parentReport().counts`。
3. 设置里加「给家长看」→ `HansenReview2UI.openParent()`。

---

## 4. 要加的守卫（`hansen_guards_v1068.py`，每道都要在 `jarvis_selftest.py` 配注入样本并亲手验会咬人）

| 守卫名 | 判据 | 防什么 |
|---|---|---|
| 复习 2.0 三件套齐 | 凡是 `<script ... hansen_review2_ui_v1166` 的页面，也要有 `hansen_review2_v1166` 和 `hansen_review2_words_v1166`；首页还要有 `hansen_canonical_progress` | 只装了界面没装核心 → 按钮点了没反应 |
| 复习 2.0 写账本要 exactBackup | `_code_only(hansen_review2_v1166.js)` 里写账本那一处必须是 `.write(store,true)` | 回到普通写法，错题 2→1 会被 `_bak` 冲回（REPORT §3.1） |
| 复习 2.0 收据号不变 | 核心里 `'rvrw:'+t+':'+slot+':c'`、`':grad'`、`':todaydone'` 三种拼法都在；v963 里同样三种都在 | 两边收据号走散 = 同一件事发两次钱 |
| 复习 2.0 不碰别人的进度 | 核心里不许出现对 `.mc[`、`hsn_crystal_` 的**写**（`setItem('hsn_crystal_` / `mc[...]=`），不许调 `earnCoinOnCorrect` / `HansenGems.award` | 多一条刷宠物、刷钻石的路 |
| 星海词表一致 | 已有测试 `test_review2_words_v1166.mjs`；守卫可以只查「数据文件存在且 240 条」 | 词表走散 → 进度记到别的词上 |

样本注意（交接 §13 的两个大坑）：注入时把守卫查的那个结构**彻底清掉**（比如把 `.write(store,true)` 改成 `.write(store)`，注释里别再出现同一串），样本里不写版本号。

## 5. 要加的测试 / 冒烟

- `test_real_path_smoke_v1163.mjs`（零测试桩冒烟）加一项：首页和任意一个岛页加载后 `HansenReview2`、`HansenReview2UI` 都在，`HansenReview2.overview().ok===true`。
- `hansen_boot_check_v1156.js` 的核心清单可以加 `['HansenReview2','复习','hansen_review2_v1166']`——**只在首页和岛页都装了以后**再加（守卫「启动自检」的误报教训）。
- 接线后把 `test_review2_ui_v1166.mjs` / `test_review2_shell_v1166.mjs` 里 `page.addScriptTag` 注入那三行删掉（页面自己会带），其余断言不变；
  外壳测试可以改成直接开 `index.html`（首页里点入口按钮，岛页开在 `#islandFrame`）。
- 旧的 `test_srs_plan_v1165.mjs` F 段（自评毕业闸门）在旧代码还留着时仍然有效，不用删。

## 6. 风险（按严重程度）

1. **账本「错题 2→1 被 _bak 冲回」是现有问题**（REPORT §3.1）。复习 2.0 已经绕开（exactBackup），但岛里 `absorbAnswer` 还在中招：
   岛里答对一次 2→1，离开岛再回来又是 2。建议单独修 `hansen_canonical_progress.js` 的 `applyAnswer`：错题**变小**（不只是变 0）时也写
   `cleared.wrongs[ci]=ts` 墓碑（合并时有墓碑就不取大，旧存档也提不高），并加测试；修好后复习 2.0 的 `write(store,true)` 可以留着也可以改回普通写。
2. **两套间隔同时存在一阵子**：替换完成前，岛里旧的自评复习还在时，同一个词可能被自评升盒。§3 的替换做完就没有了。
3. **别的标签页**里开着的岛页（不是 iframe）：它的内存 `S` 只能靠 UI 模块的 `storage` 监听同步（监听复习 2.0 自己的存储键，每答一题都会写它）。
   UI 模块没装在那个页面上就同步不了，那页下次 `save()` 会把旧计划冲回账本。所以 §1a 岛页一定要装 UI 模块。
4. **v963 内部函数**：巡检排期、巡检偶遇用的是 `HansenReviewRewardsV963._debug.schedulePatrol / patrolOnAnswer`；建议接线时在 v963 里加正式接口
   （同名转发即可），复习 2.0 再改调正式接口。v963 不在页面时，复习 2.0 按同样格式直接写 `hansen_review_patrol_v963`、`hansen_review_wrong_since_v963`
   （格式见核心 `sinceStamp/schedulePatrol`），v963 的「今日已赚 / 终身战绩」统计（`hansen_review_day_v963` / `_lifetime_`）不跟着加——只是展示数字。
5. **往前拨手机时间**仍能每个「假日子」领一次 +20（要真做完那天的到期词）。往回拨领不了。没有服务器时间就只能做到这样。
6. **首页加账本模块**后首页开机多一次存档合并；进度很多的孩子在低端机上可能多几十毫秒。见 §1b 的延后注入办法。
7. **学习分钟**从接线那天开始数，没有历史；一分钟里有一次点按才算，看视频、发呆不算（宁少勿多）。
8. **报告图**是 750×1200 PNG（≈300 KB 的 data URL），微信里长按保存；没有上传。图里不写真名、手机号、竞赛 ID；称呼输入框会去掉 5 位以上的连续数字。
