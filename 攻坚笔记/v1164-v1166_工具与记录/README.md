# v1164–v1166 工具与记录 · 目录说明

这里保存 2026-11-03 那一轮「天梯 / 房间对战重做 + 全站检查 + 优化」用到的**全部工具脚本、检查报告和原始数据**。
总说明见上一级的 [`v1164-v1166_升级总记录.md`](../v1164-v1166_升级总记录.md)。

- 这个文件夹**不部署**（`cloudbaserc.json` 忽略 `攻坚笔记/**`）。
- 脚本里的绝对路径 `/tmp/claude-0/.../scratchpad/...` 是当时云端工作机上的临时目录，**照原样保留，方便对照记录**；
  重新跑时把路径换成这里的对应目录即可（大部分脚本把仓库目录当参数，或者用 `REPO` 环境变量，默认 `/home/claude/work/repo`）。
- 没有收进来的：整份仓库的副本（对照测试用）、超过 400 KB 的日志、截图（只留了 `关键截图/` 里几张）、第三方程序包、Python 虚拟环境。
- 检查过：没有密码、令牌、老师的邮箱或手机号。

## 文件夹 → 是什么

| 文件夹 | 是什么 |
|---|---|
| `scratchpad/emulator-poc/` | **本地模拟腾讯云**的第一版（真 SDK 2.30.0 + 真页面，网络全部由本地回答）：`emulator.mjs`、`harness.mjs`、`SPEC.md`（云开发通信协议，带 SDK 源码偏移量）、`poc.mjs`、`poc_app.mjs`、`exp*.mjs` 实验。仓库里正式版是根目录的 `cloudbase_emulator.mjs` + `cloudbase_e2e_harness.mjs` |
| `scratchpad/sdkauth/`、`skeptic-sdkauth/` | 登录会话取证：`getLoginState` 何时为空、用户 ID 从哪来、凭证何时被删、用户名注册为什么建不出账号（t1–t9、sk1–sk3） |
| `scratchpad/sdkdb/`、`skeptic-sdkdb/` | 数据库取证：SDK 遇到数据库报错**不抛出、当正常结果返回**；权限拒绝在两种模式下的表现（p1、p2、probe_throw） |
| `scratchpad/ownership/`、`skeptic-ownership/` | 「谁写了谁的记录」审计：证明 v1163 的客人每一步都要改房主的记录，在「读取全部数据，修改本人数据」下全部悄悄失败 |
| `scratchpad/ladder-logic/`、`skeptic-ladder/` | 天梯流程审计：两人同时开始互等、岛屿里天梯被压在下面、关天梯误弹救援框、超时留僵尸房等（two_player*.mjs、island_entry.mjs、watchdog_close.mjs、wd2.mjs） |
| `scratchpad/u1/` | 新联机数据层（每人只写自己的记录）的真 SDK 双人/四人验证：`e2e_room.mjs`（两种权限模式 × 两种网速，46/46） |
| `scratchpad/u2/` | 登录会话新逻辑的真 SDK 验证：`validate_auth.mjs`（19/19） |
| `scratchpad/u4/` | 好友 / 排行榜的真 SDK 验证：`friends_board_e2e.mjs`（34/34） |
| `scratchpad/u5ui/` | 天梯 / 房间界面的真 SDK 双人界面验证：`ui_e2e.mjs`（48/48，四种组合） |
| `scratchpad/e2e/` | 正式端到端测试（`test_*_cloud_v1164.mjs`）的运行日志，含拿 v1163 跑全部失败的对照 |
| `scratchpad/integ/` | 整合阶段：守卫「会不会咬人」的内存注入验证 `bite_real.py`、全量测试日志 |
| `scratchpad/review/` | 第一轮最高强度审查（7 个方向）的实验脚本和结果 |
| `scratchpad/audit/` | 全站检查（8 个方面 + 每方面的反驳复核）：脚本、输出、`consolidated.json`（113 条确认 + 26 条补报 + 8 条待定） |
| `scratchpad/optimize/` | 整体优化审查：测量脚本（4G + 4 倍慢 CPU）、`REPORT.md`（17 项） |
| `scratchpad/ux-audit/` | 对战界面体检：截图脚本、对比度/点击区测量、`REPORT.md` |
| `scratchpad/allround/content-qa/` | 教学内容校对：全部词数据抽取（`data/master.*`）、247 条标记（`flagged_entries.*`）、语音识别核对录音 |
| `scratchpad/allround/privacy-safety/` | 孩子隐私与安全审查：`keyderiv.mjs`（证明云存档钥匙可由手机号推出）等 |
| `scratchpad/allround/theme-visual/` | 主题与画面审查：逐像素对比度扫描、待机/事件 CPU 测量、主题 2.0 样稿（`mockups/`） |
| `scratchpad/mp-research/` | 「改原生小程序」可行性研究（老师后来决定不做，保留记录） |
| `scratchpad/b3perf/`、`laneA*/`、`laneB/`、`rev/`、`fix1/`、`triage/` | v1165 优化和全站修复各阶段的测量和验证脚本 |
| `scratchpad/soak/` | 随机模拟上万局的联机协议压力测试（`fuzz.mjs`，仍在完善） |
| `scratchpad/*.txt / *.md` | 取证汇总 `verdicts.txt`、实现报告 `impl_reports.txt`、整合报告 `integ_report.txt`、第一轮审查发现 `review_r1_findings.txt`、设计规格 `SPEC_v1164.md` |
| `workflows/` | 每一轮多路并行工作的「编排脚本」（谁做什么、怎么交叉复核），可以照着复现整个过程 |
| `关键截图/` | 对战界面体检、主题 2.0 改前改后对比的几张关键截图 |
