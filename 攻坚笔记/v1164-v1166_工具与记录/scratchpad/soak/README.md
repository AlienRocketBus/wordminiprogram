# 联机对战压力测试（fuzz）工具

在虚拟时钟上把几百上千局「天梯 / 房间」对战一口气跑完：每部手机是一个 vm，里面跑**真的** `hansen_pk_room_v1065.js`，
网络和云数据库是模拟的（主从延迟、_id 唯一、谁建的文档只有谁能改、断网、卡住、手机钟不准、切后台、刷新、捣乱的人）。
界面那一层（对战屏、等人屏、结算等待、天梯）是照代码手抄的模型（`lib/ui_r1.mjs`，按 56b8146 写的）——
**界面问题以真页面测试为准**：仓库里的 `test_room_fuzz_regress_cloud_v1164.mjs`。

## 常用命令（在本目录下，`<repo>` 是放着那几个 hansen_*.js 的目录）

| 做什么 | 命令 |
|---|---|
| 跑一档（ci / lag / faults / skew / ladder / adversary / disrupt / chaos / sweep） | `node fuzz.mjs <repo> --profile ci` |
| 只跑回归场景（每个对应一个查实的 bug） | `node fuzz.mjs <repo> --seeds 0 --regress specs/regress` |
| 看一个种子的完整经过 | `node fuzz.mjs <repo> --profile disrupt --seed 509` |
| 重放一个场景文件 | `node fuzz.mjs <repo> --spec specs/regress/R03_abandon_win_shown_when_claim_failed.json` |
| 某几条文档的读写记录 | `node oplog.mjs <repo> disrupt 509 <房间号前缀> [起] [止]` |
| 全部档一次跑完（后台，约 17 分钟） | `./soak_all.sh <repo> out_xxx` |
| 把失败的种子缩到最小 | `node fuzz.mjs <repo> --profile P --seed-list S --only '^签名$' --shrink --max-clusters 1 --out shrink/X` |
| 「把修复改回去就变红」检查 | `python3 mutants.py <修好的目录> <修之前的目录> <输出目录>`，再对每个 `M_*` 跑回归场景 |
| 哪个 bug 解释了哪个失败种子 | `node attribute.mjs <修之前跑出来的out目录> out.json <修好的目录> <mutants输出目录>` |
| 生成仓库里的测试文件 | `node bundle.mjs` → `dist/test_pk_room_fuzz_v1164.mjs`（放仓库根目录） |

## 文件

- `fuzz.mjs` 命令行；`lib/world.mjs` 模拟云端 + 手机；`lib/run.mjs` 剧本执行（切后台、冻结、刷新、断网…）；
  `lib/scenario.mjs` 各档的随机剧本；`lib/checks.mjs` 不变量 I1–I10（谁赢、比分、离场判定、等待时长、说法对不对…）；
  `lib/ui_r1.mjs` 界面模型（新协议），`lib/ui.mjs` 老协议（47a97f9）的界面模型。
- `specs/regress/` 回归场景（`{name, bug, spec}`），`bundle.mjs` 会把它们嵌进测试文件；`specs/targeted/` 手写的定点场景。
- `mutants.py` 去掉一个修复的变体；`mk_r1b.mjs` / `mk_r11b.mjs` / `mk_t8.mjs` / `mkspecs.mjs` 是当时找定点场景用的脚本（结果已经在 `specs/` 里，不用再跑）。
- `out_v1164/`：R1–R12 修好以后全部档跑一遍的结果（`progress.txt` 每档一行 SUMMARY）。5 局出问题：faults 101（对手冻住一分多钟、回来交卷 → 两边都赢）
  随后修好、成了回归场景 R03c（修好以后 faults 档重跑只剩 28）；faults 28、sweep 663 / 939 / 942 都是「交卷前后断网超过 1 分钟」那条已知限制。

## 改界面以后

`node fuzz.mjs <repo> --profile ci` 会打一行 `WARNING: ported UI functions differ from the version the port was checked against …`，列出变了的界面函数：
回 `lib/ui_r1.mjs` 对一遍手抄的控制流（`lib/world.mjs` 的 `UI_FP_BASE` 是「56b8146 + 这次 R1–R12 的修复」的指纹，对完一遍以后用 `uiFingerprints(<repo>)` 重新生成）。
