# 单词大冒险 · Claude 对话「无缝交接」总纲（读我 + 读 GitHub）

> **给下一次对话的 Claude**：先从头读完本文（操作总纲），再按需去读本仓库 `AlienRocketBus/wordminiprogram` 的代码 + 提交历史（代码真相）。本文 + 仓库 + Hansen 的记忆三者合一 = 完全无缝接手。**读完本文，你应当能像从没中断过一样继续工作。**
>
> 本文随每次重大变更由 Claude 更新（保持与 README.md / 贾维斯_知识库.md 同步）。最后更新：**v909**（提交 SHA `0a7d5f4`）。

---

## 0. 怎么用这份文档
- 这是「操作总纲 + 血泪教训」，不是代码清单。具体代码去仓库看。
- 优先级：**§1 Hansen 工作风格 → §3 GitHub 铁律 → §4 环境坑 → §8/§9 两大系统深度 → 其余按需**。
- 本仓库是私有仓，Hansen 会在对话里给你 fine-grained PAT。**PAT 只活在对话上下文，绝不写入任何文件 / 仓库 / 交付包 / 记忆。**

---

## 1. Hansen 其人 + 工作风格（★最重要，先读透）
- **身份**：孟庆航，济南初中英语老师（中考方向），带研究生课程；创办「济南市市中区大冒险教育科技工作室」；曾任职新东方；新西兰学位。独立开发这款 H5 词汇游戏一年多。
- **语言**：全程中文。常用**语音转文字** → 所以**同一句话重复多遍 = 最高优先级信号**（他很急/很在意）。
- **标准**：极高审美 + **零 bug 容忍**（小程序要正式上线，「绝不可有 bug」「彻彻底底修复」是口头禅）。
- **沟通**：**deliverable-first**——少废话、少解释、少道歉。被骂/催时**立刻做事**，不卑不亢（accountability without self-abasement，别越骂越谄媚）。
- **受众**：游戏面向学生 → **儿童友好**。
- **回复习惯**：交付后简短说清「改了什么 + 根因 + 怎么验证 + 请他复核哪里」，全中文，不加老师抬头/敬语。

---

## 2. 项目：单词大冒险（H5 词汇游戏）
- **部署**：腾讯云 CloudBase。env ID `word-d6gf7rx2532903425`。桌面域名 `word-d6gf7rx2532903425-1257238499.tcloudbaseapp.com`；**手机端** `d0g1d26xm740dc3d6.webapps.tcloudbase.com`（Hansen 截图里就是这个域名，微信 X5 内核）。
- **规模**：19 常规主题岛 + 8「单词大陆」(land) 岛 + 星海番外季岛（第19座秘境·赛尔娅为专属星系 boss）；20+ boss；12+ 游戏模式；拼写蜂(936词)；宠物进化 36 阶；钻石商店；卡册(20 boss 卡·5 稀有度)；711+ 单词。
- **当前版本 v909**。

---

## 3. GitHub 权威源 + 铁律 2.0（★每次必守）
- **仓库 = `AlienRocketBus/wordminiprogram`（私有·main 分支）= 唯一权威源。**
- **铁律 2.0**：**每次开工及任何下一步操作前，先拿沙盒当前状态与 GitHub HEAD 逐一对照**（`git rev-parse HEAD` vs `git ls-remote main` + `git status --porcelain`），一致 / 无缺失才动手。永远「先对照、后操作」。
- **每版必推 GitHub 并验 SYNCED**（本地 HEAD == remote HEAD）。
- **访问**：用户名 `x-access-token` + Hansen 提供的 PAT。
- **推送语法（POSIX / sh，注意 bash 是 sh）**：
  ```
  cd dev && git add -A && git commit -q -m "..." 2>/tmp/gc.log && \
  timeout 200 git push "https://x-access-token:${TOKEN}@github.com/AlienRocketBus/wordminiprogram.git" main >/tmp/gp.log 2>&1
  ```
  然后 `sed -i "s/${TOKEN}/REDACTED/g" /tmp/gp.log /tmp/gc.log` 脱敏 → python 读日志 + `git rev-parse HEAD` 对 `git ls-remote ... main`(awk '{print $1}') 验 SYNCED。
- **版本 SHA 链**：v905=`19a1626`、v906=`378802f`、v907=`a85cbf8`、v908=`1d478e6`、v909=`0a7d5f4`。

---

## 4. 沙盒环境 + 致命坑（★新对话必读，每个新沙盒都要重来）
- **新对话沙盒是空的**：先让 Hansen 给 PAT → `git clone` 仓库到工作区 → 再开工。
- **工作区固定 = `/home/claude/v846/dev`**；测试脚本放 `/home/claude/_hc/`；交付放 `/mnt/user-data/outputs/`；备份放 `/home/claude/backup_fx/`。
- **Playwright（渲染验证主力）**：`import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'`；`executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`；`args:['--no-sandbox']`；**手机视口 390×844**。
- **环境每几分钟杀 chromium/node/python/http.server** → 每次渲染前先探活：`curl -s -o /dev/null http://localhost:8877/index.html`，失败则 `(nohup setsid python3 -m http.server 8877 --directory /home/claude/v846/dev >/tmp/s.log 2>&1 < /dev/null &)`。
- **bash 实际是 sh**：`${VAR:0:12}` 报 Bad substitution → 用 `echo $VAR|cut -c1-12`。
- **复杂中文一律用 create_file / python 脚本写**（真中文，非 \u 转义；脚本内 print 纯 ASCII；读写 `encoding='utf-8',errors='replace'`）。**bash 直接 grep 中文报 "invalid UTF-8" → 改 python 读文件**。python 脚本里别在赋值行尾写 JS `/* */` 注释（会 SyntaxError）。
- **git commit 含中文会触发工具报错，但 commit/push 其实成功**（python 读日志 + ls-remote 验证即可，别慌）。
- **present_files 必须绝对路径**（中文文件名用 \u 转义）；**每版交付必调 present_files**。
- **⚠️ view 工具偶发只返回 "[image]" 无内容（本次对话几乎全程失败）**。视觉验证靠：① **PIL 逐行/逐区像素分析**（亮度百分比、局部对比跨度、两帧差异逐行定位）——本次对话验证台词位置/溢出/可读性全靠它；② Hansen 截图。装 PIL：`pip install Pillow --break-system-packages -q`。
- pip 装包统一 `--break-system-packages`。

---

## 5. 五大铁律
- **铁律 1.0**：`hansen_health_check.py`（~434 检查）= 打包前强制门禁。
- **铁律 1.1**：定期深度审计。
- **铁律 1.2**：音频归一化 **-16.0 LUFS**，用 `hansen_loudness_audit.py`。
- **铁律 2.0（最新·最高频）**：开工/操作前先对照 GitHub HEAD（见 §3）。

---

## 6. 开发工具链（源码全在仓库；README 有全文备份，可自愈）
- **build.py**：无参 = 读 `VERSION` 文件自增 1（如 907→908）+ 重戳全站 `?v=`（**不碰 mp3 的 `?vNNN` 戳**，如 word `?v215`）；step0 跑 generate.py 重生成 19 岛；node --check 所有 js；跑 check_resources；打部署 zip 到 outputs（**顶层 index.html**·排除 `*.md *.py *.txt` 及 map8/newboss/releases/evolution_reports/`.`开头/`__pycache__`）。**任何一步失败 = 拒绝打包**。用法 `python3 build.py`（自增）或 `python3 build.py 910`（指定）。**不检查 README**（README 手动更）。
- **generate.py**：印章生成——`template.html` + `island_data.json` → 19 常规岛。改母版/数据后必跑（build step0 自动跑）。**绝不直接改 19 常规岛**（v712 守卫会复原）。
- **check_resources.py**：数百守卫，很多 pin 了 **exact CSS 字符串**（改 CSS 可能破守卫 → 需同步守卫钉值或跳过）。全绿才能 build。
- **hansen_health_check.py**：~434 检查，打包前强制门禁（铁律 1.0）。
- **hansen_inspector.py**：副审计。**陈年 v888 知识库格式 WARN 是已知容忍项（非新增，Hansen 容忍不改）**。
- **jarvis.py --apply-safe**：JARVIS 2.0 自动质量系统（16+ 守卫防 bug 复现）。**退出码 0 = 过**。build 后跑。
- **五工具全源码在 README 备份**。

---

## 7. 文件结构（仓库根）
- **index.html** = 主游戏主页。彩 logo(`.logo-char` c1-c5 每字颜色 + **白描边 3px** `-webkit-text-stroke`)、WORD ADVENTURES 副标题(`.subtitle`)、18 主题岛屿等 stat 卡(固定深 navy·亮色下仍深)、最近探险卡(`#recentLbl` 金标题 + `#recentNum` 副标题「岛名·点击继续」)、岛格(`.island-card`/`.island-name`/`.island-en`)、顶部 `.brand` app 标题、`hsnVerStamp` 版本水印(30% 透明金·故意淡)。**有自己的 hsn-pal-light 覆盖块**（本次对话在此加了 subtitle/island-name/island-en/recentNum/logo-char/brand 的亮色覆盖）。
- **template.html** = 19 常规岛母版。经 generate.py + island_data.json 生成 island_action/animal/city/time 等。改岛内游戏逻辑/CSS 改这里再跑 generate.py。含：顶栏(`.top-bar` 用 `--pal-chrome`·`.top-name` 金 #fbbf24·亮色下加了深字覆盖)、难度选择器(初级绿/中级橙/高级红彩卡·**hex 渐变**·卡内奖励盒 `📚N词·经验+X...`)、所有游戏模式、boss 战(`renderBossUI@~4067` 四型 en2cn/cn2en/cloze/listen·`.boss-opt` #eef2ff)、完成屏。
- **island_data.json** = 19 岛数据（keys 无 land：action/adjective/animal/body/city/clothes/color/family/food/home/job/nature/question/school/season/sports/time/traffic/treasure）。含 BOSSES（boss 图 `?v=` 戳，build 一同刷）。
- **island_land1-8.html** = 8 个「单词大陆」岛（**不在 island_data.json**·map8 生成·**冻结 HP 勿 regen**·CSS/逻辑**直接改这 8 文件**）。各有完整 boss 战。**land8 有 5 个 boss(hp1300)**，含新 boss「**星核帝皇·弗沙欧**」（fushaou）。（另注：`克罗诺斯/时之君主`在 island_land3。）
- **hansen_palette.js** = 亮色配色引擎（共享·所有页 load）——见 §8。
- **hansen_boss_attack.js** = boss 攻击特效（九王殿工坊·FXCore·~15500 行）——见 §9。
- **hansen_land_cards.js** = land boss 卡数据(39 land boss 卡)。
- 其它：hansen_theme.js、hansen_boss_lock.js、hansen_cards.js、hansen_preload.js、_frame.html(桌面浏览器包装页) 等。
- **贾维斯_知识库.md** = 版本知识库（每版记根因 + 修法·真中文·按版本倒序·本文档同源）。
- **README.md** = 版本史 + 工具全文备份 + 当前版本声明。**每版更新到新版号·两处**：摘要行(before `- **v9XX**`) + 版本块(before `> **当前版本: v9XX`，把旧「当前版本」降级)。

---

## 8. 配色系统 hansen_palette.js 深度（★整个亮色调 bug 体系的总闸）
- 结构：运行时构建 css 字符串注入 `<style id=hsnPaletteCSS>`。
- `var S='html[class*="hsn-pal-"] '`（任一配色激活）；`var L='html.hsn-pal-light '`（亮色专属）。
- **L99 通杀翻色引擎（关键！）**：`S+'[style*="color:#fff"]{color:var(--pal-ink)!important}'` —— **任何行内 `color:#fff` 在亮色下被强制翻成深墨 `--pal-ink`**（同理 #e2e8f0→ink-hi、#cbd5e1→ink-2、#94a3b8→ink-3）。这是为了让深底白字自动适配浅页，但**对「始终深底」的元素（如深遮罩奖励盒）翻错=深压深看不清**。
  - **教训：给深底元素加行内 `color:#fff` 徒劳，会被翻深。必须在 L 段加更高特异性豁免规则保白。**
- 豁免区（保原色）：`#bossScreen`(L109 电影感·L133 亮色钉深 `#131c3a`)、`#hsnSeasonBar`、`#hsnSeasonEntry`(固定深组件)。
- **L130+ = v863 亮色全面整改 20+ 条**：金字系 inline → 深琥珀 `#92400e`；**L150 白字+黑晕万能疗法** `.mode-card,.mode-card *{color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.55)!important}`（任何底可读·已验证）；L152 金渐变容器内字 → `#3a2400`；等。
- **v907 加的奖励盒豁免**（L 段末·before body 兜底）：`L+'[style*="background:rgba(0,0,0,.5)"][style*="color:#fff"]{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.55)!important}'` —— 两属性特异性 (0,0,3,1) 压过 L99 (0,0,2,1)，保难度卡奖励盒白字。
- **修法总则**：亮底浅字元素 → 加 L 段深字覆盖 或 白字+黑晕；持续深底元素 → 加豁免特异性保浅字。

---

## 9. Boss 攻击特效 hansen_boss_attack.js 深度（★立绘贴顶 boss 上下都易越界）
- 引擎 **FXCore**；入口 `window.HansenBossAttack(bossCurrent,dmg,heroHP,heroMaxHP)`（岛内答错触发）→ `playFx` → `__WFX[t](bs,hx,barL,barW,midY,barBot,fx,deal)`（t=特效名如 `'fushaou'`；`FX` 注册表按 boss 名映射，如 `FX={'星核帝皇·弗沙欧':{t:'fushaou',...}}`；`__WFX={fushaou:fxFushaou,...}`）。
- `F.shell(...)` 建 `st` 状态对象（**关键坐标**）：
  - `st.br` = boss 立绘元素 `getBoundingClientRect`；`st.bx/st.by` = 立绘中心 x/y；
  - **`st.hy = midY = 勇者(hero)血条中心`**（playFx 取 `.hero-hp-bar` 的 `top+height*0.5`·**在立绘下方很远**）；
  - `st.vw=画布宽 st.vh=画布高`（全屏）；`st.barBot`=hero 血条底；
  - **画布 `ctx.clip()` 到 (0,0)~(vw, barBot+18)**（底部答题区保护·顶部 y<0 = 画布外被截 → 看着「溢出」）。
- **实测坐标（弗沙欧·390×844）**：立绘 y=54~268(高214·中心161)、hero 血条中心 357、barBot 361。
- **★两条血泪教训（弗沙欧立绘几乎贴屏顶·特效锚立绘 → 上下都越界）**：
  - **v908 台词落脚底**：`fxFushaou` 的 drawLines 台词原锚 `st.hy-98*sz`（=357-98=259=立绘底部上方 9px=**脚底**）。修：改锚 **`LY=st.by-st.br.height*0.16`**（立绘中心上方胸口≈127）+ 给 line() 加**半透明深色圆角台词框**（`rr()` 用 arcTo 手绘圆角·X5 兼容）。多行台词 LY±16*sz 上下排。**验证**：逐行像素对比（台词帧 vs 干净帧），台词框落 y≈84~172(胸口)、脚底 y248~268 差异归 0。
  - **v909 特效溢出屏顶**：能量汇聚点 `Pnt={x:st.bx,y:st.by-bh*0.60-32*sz}`≈**0.6=屏顶**（白球半径 35+辉光一半在屏外）；手指光束 `topY=lerp(FING.y,-24*sz,grow)`=**-24 屏外**。修：`Pnt.y` 下钳 **`Math.max(...,60*sz)`**；手指束 topY 的 `-24*sz` 改 `20*sz`。**验证**：各相位顶边(y4-10)亮像素 orb 27%→0%、能量球仍完整(y40-100 亮 85%)。
  - **★总则**：**立绘高 + 特效锚立绘 → 向上元素(汇聚点/升腾光束)易冲出屏顶、向下元素(台词)易落脚底**。向上锚点须**下钳**(`Math.max` floor 保元素 + 辉光半径都在 y≥margin)；向下/台词锚点改锚 **st.by**(立绘中心)而非 st.hy。**九王殿其余 8 招若同样贴顶全身立绘，同法处理。**
- **验证特效流程**：渲染 island_land8 → `showScreen('boss')` → `startBoss()` → `HansenBossAttack({name:'星核帝皇·弗沙欧',hp:1300,maxHp:1300,color:'#ffd35a'},145,355,500)` → 各相位截图（charge~2000ms / rise~3800 / orb~4900 / fire~6000；台词峰值 fingerT(760)+150≈1030 / hitT(6160)+120≈6280）→ PIL 分析顶边/脚底/胸口亮度或两帧差异。

---

## 10. 对比度审计器 audit6.mjs（`/home/claude/_hc/`·可靠·本次对话打磨）
- **位置：仓库 `.devtools/audit6_contrast_auditor.mjs`**（点开头 → build.py 打包剪枝·不进部署包·仅供开发）。同目录 `boss_fx_verify_template.mjs` = boss 特效分相位截图模板。
- 用途：亮色配色下逐元素扫**对比度 <3** 的低可读文字。
- **核心：hex 渐变感知**——`pc()` 支持 hex(`#rgb`/`#rrggbb`→`[r,g,b,1]`)；`firstCol()` 从 gradient 抓 rgba **OR** hex 首色。**旧版只抓 rgba，漏 hex 渐变卡首色（如 `linear-gradient(135deg,#f59e0b)` 橙卡）→ 返回错误浅底 → 假读数**，务必用 hex 版。`effBg()` 用 `over()` 合成半透明遮罩，不当不透明黑。
- 触发：`addInitScript` 设 `localStorage.hansen_palette_global='cloud'`（cloud=一种亮色）→ 加载页 → `startEagle()`/`startScramble()` 等 → 每 context 用 `newContext` 隔离。
- **★局限：审计器无法 credit `text-shadow` / `-webkit-text-stroke` / 描边**（只测 color vs bg）。故白字黑晕、logo 深描边审计仍报低，但视觉/像素已修 —— 这类靠 **PIL 像素跨度**(卡内最亮-最暗，>90 即强对比)或视觉判断，**别信审计器报低就乱改**。

---

## 11. 三件套交付流程（★每版）
1. **部署 zip**：build.py 产出到 outputs（顶层 index.html·~74MB·2106 文件）。
2. **交接源码 zip**：`cd dev && zip -qr /mnt/user-data/outputs/单词大冒险_vXXX_交接源码包.zip . -x ".evolution_backups/*" -x "releases/*" -x "evolution_reports/*" -x "*.zip" -x ".git/*" -x "nohup.out" -x "*.pyc" -x "__pycache__/*"`（~149MB）。
3. **README**：`cp README.md /mnt/user-data/outputs/单词大冒险_vXXX_README.md`（~2.4MB）。
4. **present_files 绝对路径**（中文名转义）三件套，**部署包放第一**。
5. 三者版本号一致。
- **图片压字节首选 WEBP q85/q90(RGBA)；绝不 pngquant 转 P 模式**（微信 X5 WebView 不显示透明 P 模式 PNG）。PNG→WEBP 曾把部署从 ~108MB 降到 ~77.6MB。

---

## 12. 近期版本详情
- **v906**：亮色调游戏模式深底深字修复（mole-cn/match-front/eagle-cell/lr-en→白字；moles-prompt/match-back→深底；scramble-cn/typing-cn 深卡；完成屏经验 stat 描边）。正确跳过 combo-badge/boss-listen-btn/fish-word-tag/boss-card-label（有守卫 pin 的 inline 色）。
- **v907**：**亮色调可读性全站大扫除（根治 palette 翻色引擎）**——奖励盒深遮罩(.5)保白字(palette 豁免) + 主页副标题深琥珀 / 岛名·岛英文白字黑晕 / 最近探险浅字 / logo 深描边 / app 标题深字 + 顶栏称号深字 + 审计器补 hex 渐变。
- **v908**：修弗沙欧 boss **台词落脚底**（台词锚 st.hy=hero 血条中心·对全身立绘落脚底 → 改锚 st.by 上移胸口 + 加圆角台词框）。
- **v909**：修弗沙欧大招**特效溢出屏顶**（Pnt.y/topY 因立绘贴顶越界 → 下钳回屏内）。

---

## 13. 长期 PENDING
- GitHub 每版同步（铁律 2.0·开工前对照）。
- 陈年 v888 知识库格式 WARN（inspector·容忍不改）。
- 单词大陆卡册背景图：Hansen「不做了」。
- **九王殿其余 boss 特效若有贴顶溢出 / 脚底台词，同 v908/v909 法处理**。
- 拼写蜂 936 词构建时守卫全解析真音频。
- boss 里 `spellFill` 型（补全缺字母·letter-combo 选项）渲染源较隐蔽；实测 `.boss-opt` 选项已是 #eef2ff 浅字(~14:1 可读)，旧截图橙选项疑为旧版残留。

---

## 14. Hansen 的其它工作（可能穿插·背景知识）
- **教学材料 docx 流水线**：Node.js + docx@9.6.1。PET 阅读分析(Test1-4·50-71页)、IELTS 写作批改、中考模拟卷(历下/市中/槐荫/高新/长清/平阴等区)、语法填空、**TOP20 押题作文册**(作文构思填空册：封面+准备页+8张"想→套→写"卡+串句汇总+示范页+万能句式总结带中译+速查表·作文≤120词)、学生作文批改。**设计系统**：NAVY `#1F4E79`、GOLD `#BF8F00`、RED `#C00000`；微软雅黑 + Calibri/Arial；A4。**铁规：任何地方不出现老师名**（用「重点提醒」非「老师重点提醒」；「读者」非「阅卷老师」）。
- **研究生课程论文**：《基于改进YOLOv8的施工现场安全风险识别方法研究》(24页 docx)。参考文献须**国内无 VPN 可访问**(ScienceDirect/MDPI/PLoS/PMC/arXiv/CNKI·**禁 GitHub**)；图中**不标 AI 贡献**("改进点"/"新增")；技术路线图**纯黑白**；matplotlib 中文需 `addfont NotoSansCJK-Regular.ttc`(family 'Noto Sans CJK JP')；图片段落 `spacing {line:240,lineRule:'auto'}` 防裁切。
- **计算机视觉研究**：YOLOv8 施工现场 PPE 检测 + CBAM 注意力 + P2 检测头（mAP@0.5=0.832）。
- **AIGC 降重**（PaperPass）：只改被标句、不动未标段；**非对称句子节奏**最有效。
- 学术作业(Amity Global Institute·学号 20268770/20268792·MMO/MHRL)、组织行为案例(极越汽车)、供应链韧性、生成式 AI 与内在动机硕论(SDT+GWO)、智能优化算法课程论文等。

---

## 15. 下一次对话开场（★推荐动作）
1. 读完本文 → 请 Hansen 提供 GitHub PAT。
2. `git clone https://x-access-token:${TOKEN}@github.com/AlienRocketBus/wordminiprogram.git /home/claude/v846/dev`（沙盒是空的，必须先拉）。
3. **铁律 2.0**：`git rev-parse HEAD` 对 `git ls-remote main` 确认对齐（应 = `0a7d5f4` 或更新）。
4. 需要时读 `README.md`(版本史 + 工具备份) + `贾维斯_知识库.md`(各版根因修法) + 本文。
5. 按 Hansen 当前需求开工，**全程遵守其工作风格(§1) + 五铁律(§5) + 三件套交付(§11)**；改 CSS/特效先想 §8/§9 的坑；视觉验证靠 PIL 像素(§4·view 常挂)。

> **一句话给下一个你**：这是一个由初中英语老师独立开发、迭代 900+ 版、有完整自动化质量体系 + GitHub 权威源 + 五条铁律的成熟项目。Hansen 要的是「零 bug、极致视觉、少废话、立刻交付」。先对照 GitHub，再动手，每版三件套 + 推同步 + 简洁中文汇报。祝顺利。
