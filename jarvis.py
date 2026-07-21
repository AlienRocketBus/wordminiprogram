#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
贾维斯 (JARVIS) — 单词大冒险 · 自主进化智能管家 启动器
=========================================================================
「启动贾维斯」= python3 jarvis.py

贾维斯会全面检查【最新版本】游戏, 并【自动查历次所有已知 bug 有没有复发】:
  ① 出厂红线 check_resources.py —— 全部硬守卫每次重跑(含历次所有已修 bug 的
     防复发: 屏幕闪 #50/检查15、滚动条 #51/检查16、做题原子性 #40-47/检查13、
     卡牌经济 #48/检查14、赛季隔离/检查12、宝箱防刷/检查11 …), 任一复活即拦;
  ② 自主进化引擎 hansen_evolve.py(v12.1) —— 健康体检 + 运行时崩溃探测 + 处置建议
     + 三大融合审计(v525起·与 README 彻底融为一体):
       · 四方一致性: 知识库↔守卫↔代码🔴标记↔README/VERSION 任何一方缺位即报;
       · 退役FX守卫过时检测: 老FX退役未改写其历史守卫 = ERROR 拦截(v511教训自动化);
       · 工具备份同步: README《🧰核心开发工具源码备份》与七工具本体逐字比对,
         --apply-safe 自动同步修复(先备份README→重写fence→复验→失败回滚;
         v526起《自主进化引擎·完整说明书.md》嵌入源码同样 --apply-safe 自动同步);
  ③ v941 经济一致性守卫 economy_guard.py —— 金币、钻石、宠物经验与跨岛奖励
     使用同一组不可刷、不可漏、可迁移的规则，任一不一致即拒绝发布；
  ④ 汇报。

贾维斯的「记忆」= 贾维斯_知识库.md(历次全部 bug #1–#101+ 与全部版本记录 + 对应防线 + v746 起的《贾维斯全景认知》总纲: 程序架构全景 + 全 bug 防线总览 + 持续优化原则)。
启动时四方一致性审计会打印「全 bug 知识核验: 缺口 N 个」, N=0 即贾维斯已完整掌握所有要防的 bug。
学习闭环: 每修一个 bug → 加一道 check_resources 守卫 + 记入知识库 + 代码 //🔴BUG#N
        → 贾维斯以后每次启动自动重跑全部守卫、坚决防止再犯。

发现【已知问题复发】时, 贾维斯的处置(从强制到智能):
  ① 红线守卫直接拦下打包(默认、最硬);
  ② --ai        调用 Claude(最强云端引擎)深度分析 + 给修复方案(需 ANTHROPIC_API_KEY);
  ③ --apply-safe 自动修【安全/可逆】类(先备份 → 改 → 重跑 check_resources 验证 → 不过自动回滚);
  ④ 风险类(改游戏逻辑/经济/UI)生成提案交人一键采纳 —— 绝不无监管乱改、保护游戏不被弄坏。

默认即执行 --deep(含真浏览器)。可选参数: --probe / --ai / --apply-safe /
--content / --watch。只有明确诊断时可用 --static-only；其结果不能作为发布放行结论。
"""
import sys, os, subprocess, re

ROOT = os.path.dirname(os.path.abspath(__file__))


def _hr():
    print("=" * 64)


def _banner():
    _hr()
    print("  🤖  贾维斯 (JARVIS) 启动 —— 单词大冒险自主进化智能管家")
    print("      只检查最新版本 · 已学历次全部 bug · 每次自动查复发")
    print("  🔴 最高铁律(凌驾一切·上线安全第一): 每个修复必须①真机Playwright跑起来验证(绝不靠理论)")
    print("     ②用最苛刻极端条件验证(定时器后台丢失/狂点/跨游戏DOM残留/反复切后台/对照组复现)③优化到最佳④完美无误才打包。")
    _hr()


def _count_guards():
    p = os.path.join(ROOT, "check_resources.py")
    if not os.path.exists(p):
        return 0
    try:
        _t = open(p, encoding="utf-8").read()
        n_chk = len(re.findall(r"#\s*----\s*检查\s*\d+\s*[:：]", _t))          # 检查N 式(早期1-31)
        n_bug = len(re.findall(r"#\s*----\s*BUG#\d+", _t))                      # BUG#N 式(检查31之后新增的都用这命名)
        return n_chk + n_bug
    except Exception:
        return 0


def _kb_maxbug():
    p = os.path.join(ROOT, "贾维斯_知识库.md")
    if not os.path.exists(p):
        return 0, False
    try:
        txt = open(p, encoding="utf-8").read()
        nums = [int(m) for m in re.findall(r"^\|\s*\*{0,2}(\d+)\*{0,2}\s*\|", txt, re.M)]
        nums += [int(m) for m in re.findall(r"BUG#(\d+)", txt)]  # 也数 ## vNNN 段落里的 BUG#N(总表只到#68·新bug在段落里·否则横幅永远停在#68)
        return (max(nums) if nums else 0), True
    except Exception:
        return 0, True


def _learn():
    maxbug, kb_ok = _kb_maxbug()
    guards = _count_guards()
    if kb_ok:
        print("  🧠 记忆(贾维斯_知识库.md): 已从 README 编录历次全部 bug(#1–#%d)+ 每个对应防线。" % maxbug)
    else:
        print("  ⚠️ 未找到 贾维斯_知识库.md(记忆); 检查照常进行。")
    print("  🛡️ check_resources 现有 %d 道硬守卫, 每次启动【全部重跑】自动查复发:" % guards)
    print("     做题原子性 #40-47/检查13 · 卡牌经济 #48/检查14 · 屏幕闪/震屏 #50+#52/检查15 ·")
    print("     滚动条 #51/检查16 · 打字一排不换行#53+不溢出#55/检查17 · 键盘触碰即输入 #54/检查18 · boss台词一行全文不出屏#56/检查19 · 游戏失败结算独立美观页#57/检查20 · boss做题页除打字外不缩立绘不滚动#58/检查21 · boss立绘微信内核xlink:href#59/检查22 · 勇者受击特效(浮动伤害数字+血条受击)/检查23 · 无角度旋转歪斜(弹出/UI/装饰特效已扁平)/检查24 · 每个boss专属攻击特效21套(命中接掉血·零眩晕·微信安全SVG; 机械泰坦拳头外部图已预加载+解码+克隆复用·防首次/慢解码时拳头空白不出现 BUG#67; bossAnswer allOpts[i]两处全19岛 if 防护·选项缺失也不抛错跳过FX BUG#68; 机械泰坦拳头 v502 动效=从小变大+砸中原地淡出+0.8s·专属hba-fist类与百战兽人锤子分开; 上古太阳神 v503=太阳火球(外部图)小变大砸击+命中血条火焰燃烧·sunslam分支复用hbaFistSlam·火球同样预加载克隆; 混沌魔尊 v504=光波(外部图)从boss细尖clip揭示逐渐展开+漩涡口命中血条混沌爆炸·wave分支·尺寸按boss→勇者距离动态贴合·光波同样预加载克隆; 外星霸主 v505=同款光束(粉色·beam图)·wave类型泛化支持两图makeWaveImg+每boss可调速度--wdur; v505混沌魔尊+外星霸主展开速度都0.50s; 暗夜吸血鬼 v506=獠牙咬合(用户4颗牙齿图)·上2颗下咬+下2颗上咬·牙尖在勇者血条中线精确相碰·血条泛红+滴血·fangbite分支·70%大小0.5s; 暗影忍者 v507=扔手里剑(用户手里剑图)·边飞边旋转命中勇者血条·血液飞溅12滴+红环+掉血·shuriken分支WAAPI·86%大小0.66s旋转1圈; 机械泰坦 v508=换新拳头图(用户赛博机械拳套)+放大200%(高172)+起点高度300px从天而降+砸下0.5s·定位改top=hc.y-imp指节精确落勇者·--fistdur可配·太阳神复用hbaFistSlam仍0.8s不动; v509机械泰坦砸下0.5s→0.8s放慢; v510机械泰坦大改拳头→导弹散射汇聚(missilestorm·9枚从boss向四面八方喷射→贝塞尔划弧转向→汇聚命中勇者→连环爆炸+大爆炸·等离子配色·SVG导弹内联无需外部图·dealDelay1080对齐汇聚命中·旧拳头变死代码保留勿删因太阳神复用hbaFistSlam·关卡澄清机械泰坦=Lv17非Lv19); v511烈焰魔神(Lv15)单火球→火焰陨石雨(meteorrain·6颗熔岩岩石SVG陨石从天斜射砸勇者+彗尾火星+连环火爆+残留地火+巨型陨石大爆炸·复用导弹wrapper/hbmExplode/拖尾/火星·新增hbmMeteorSVG真实熔岩岩石+hbmGroundFire地火+天空泛光·配色烈焰·SVG内联无需外部图·dealDelay900))/检查25 · boss答完重复点击不再扣血(BUG#60)/检查26 · 复仇/打boss快速点击不跳未解锁boss不崩溃(BUG#61)/检查27 · 打boss题不再卡死·全程永不卡死(BUG#62+v491加强: 后台点复仇→开场题空白死机, 及答完后卡在已答题; startBoss开场清跨场状态+看门狗周期与回前台visibilitychange检测→强制恢复出题, 覆盖打boss全程)/检查28 · 小游戏切后台防卡死看门狗(BUG#63·hansen_game_antifreeze.js·只回前台触发不误伤·已验证全7个: 打字/钓鱼/泡泡/听音/完形/打地鼠/复习)/检查29 · 抽卡翻转揭晓不剧透+防卡死(BUG#64·神秘旋转·停稳揭晓·回前台强制补齐+安全兜底)/检查30 · boss战布局仅【战斗中】生效·选boss列表可滚动: 打boss战藏底部导航(主页/错题/宠物/成就)+键盘整排不被盖+一屏放下不出滚动条+狂怒第3阶段不长高+打字词一行(BUG#65); 锁只绑战斗激活hsn-boss-battle·绝不锁死选boss列表→列表能上下滑选所有boss(BUG#66·Hansen实测重大bug·真机:列表可滚动/战斗锁2.5s不误移除/结束解锁)/检查31 · 赛季隔离/检查12 · 每日宝箱防刷/检查11 · 版本戳/词表/boss图 等。")
    print("     ── 其后新增(BUG#N 式守卫·检查31之后·均已钉死永不复发)──")
    print("     宠物系统(全局统一/掌握制双门槛/进化展示/进岛不闪最高阶) · 装备商店配色+7武器攻击特效 · 影院亮背景可读性遮罩(BUG#76) · boss大招几何(吸血鬼血月回右#74/外星霸主激光完整显示#72) · iPhone静音也出声(BUG#73) · 每日宝箱角标+两态配色 · SPA一体化【spelling bee岛内覆盖层不走网页#83 · 首页与18/19岛iframe彻底融合 · closeIsland健壮性 · 保活岛+宝箱首帧闪根治#84 · 人物等级全局化与宠物经验解耦#85 · 拼写对战图标防触角切#86】 · 进岛体验【黑屏慢根治#87 · 再提速#88 · 闪一下根治#89 · 秒进+图片一次性全出+零闪#90】 · 题闪一下没扣分跳过(BUG#16·phase/狂怒切换不抢先出题·题面时间锁) · 部署包体积翻倍(BUG#49·build.py EXCLUDE_EXT含.zip)。")
    print("  📌 学习闭环: 每修一个 bug → 加守卫 + 记知识库 + 代码 //🔴BUG#N → 以后自动防再犯。")
    print("  ════════════════════════════════════════════════════════════════")
    print("  🚨 最近关键BUG红线总防线(v797·Hansen专项要求·让贾维斯记住最近所有bug·每次build核查·绝不复发):")
    print("     一道【合并总防线】把最近8条最关键红线在一处集中复核(与各版本独立守卫双保险)——")
    print("     ①BOSS卡背景一闪一闪(v790) ②BOSS卡角色不出现只剩背景(v792) ③转场闪一下露主页(v789/v791)")
    print("     ④返回滚动弹回顶部(v793/v794) ⑤头像改色返回不更新(v793) ⑥子界面卡住只播声音(v791)")
    print("     ⑦单词雨已删不复活(v795) ⑧听音循环+死函数已删不复活(v796)。任一复发→立即拒绝打包。")
    print("     完整登记表见 贾维斯_知识库.md 置顶《永不复发·最近关键BUG登记表》。")
    print("  ════════════════════════════════════════════════════════════════")


def _disposal(ai, apply_safe):
    print("\n  ⚙️ 若发现【已知问题复发】, 贾维斯处置(从强制到智能):")
    print("     ① 红线守卫直接拦下打包(出不去)——默认、最硬。")
    print("     ② --ai: 调 Claude(最强云端引擎)深度分析 + 修复方案(需 ANTHROPIC_API_KEY)。")
    print("     ③ --apply-safe: 自动修安全/可逆类(备份→改→重验→不过回滚)。")
    print("     ④ 风险类(动游戏逻辑)生成提案交你采纳——绝不无监管乱改、保护游戏。")
    if ai and not os.environ.get("ANTHROPIC_API_KEY"):
        print("     ⚠️ 你加了 --ai 但未设 ANTHROPIC_API_KEY → AI 层会优雅跳过(仍跑全部确定性守卫)。")


def main():
    raw_args = sys.argv[1:]
    static_only = "--static-only" in raw_args
    args = [a for a in raw_args if a != "--static-only"]
    if not static_only and "--deep" not in args:
        args.append("--deep")
    ai = "--ai" in args
    apply_safe = "--apply-safe" in args

    _banner()
    _learn()
    _disposal(ai, apply_safe)

    engine = os.path.join(ROOT, "hansen_evolve.py")
    cr = os.path.join(ROOT, "check_resources.py")
    extra = (" + Claude深度分析" if ai else "") + (" + 自动修安全类" if apply_safe else "")

    if os.path.exists(engine):
        print("\n  ▶ 全面巡检最新版本(硬守卫 + 健康体检 + 运行时探测%s)…\n" % extra)
        rc = subprocess.run([sys.executable, engine] + args, cwd=ROOT).returncode
    elif os.path.exists(cr):
        print("\n  ❌ 缺少 hansen_evolve.py；仅有静态守卫不足以形成发布结论。\n")
        subprocess.run([sys.executable, cr], cwd=ROOT)
        rc = 1
    else:
        print("\n  ❌ 既无引擎也无 check_resources.py, 无法巡检。")
        rc = 1

    # 🔴 v941: 经济系统属于跨页面共享状态，单页看起来正常仍可能出现
    # "这个岛发奖、另一个岛不发"或重复领取。把独立经济守卫并入 Jarvis
    # 主路径，确保本地、CI、build 前巡检使用同一套判据。
    economy = os.path.join(ROOT, "economy_guard.py")
    if os.path.exists(economy):
        print("\n  ▶ v941 经济一致性体检(金币 · 钻石 · 宠物经验 · 跨岛奖励)…\n")
        economy_rc = subprocess.run([sys.executable, economy], cwd=ROOT).returncode
        if economy_rc != 0:
            rc = rc or economy_rc
    else:
        print("\n  ❌ 缺少 economy_guard.py，无法证明经济系统一致性。")
        rc = rc or 1

    # 🔴 v877(Hansen「全面进化贾维斯」): 巡检后追加【贾维斯 2.0 超级全域体检】——
    #   8 大主动扫描器把整个代码库当陌生系统 X 光(死链/孤儿/缓存戳/重复ID/内存泄漏/危险模式/上线卫生/体积/HTML结构/JS语法),
    #   纯静态秒级·抗环境收割·产出可视化体检报告。与 hansen_evolve(使命体检)+check_resources(防复发) 三足鼎立。
    scan = os.path.join(ROOT, "jarvis_scan.py")
    scan_rc = 0
    if os.path.exists(scan):
        print("\n  ▶ 贾维斯 2.0 · 超级全域体检(8 大主动扫描器 · X 光全库)…\n")
        scan_rc = subprocess.run([sys.executable, scan], cwd=ROOT).returncode
        if scan_rc != 0:
            rc = rc or scan_rc  # 2.0 发现 CRIT/WARN 或报告失败 → 整体不放行
    else:
        print("\n  ❌ 缺少 jarvis_scan.py，主动全域扫描未执行。")
        rc = rc or 1

    _hr()
    limited = static_only and rc == 0
    if limited:
        print("  ⚠️ 静态巡检无阻断项，但 --static-only 未执行浏览器断言，不能作为发布放行结论。")
        rc = 2
    elif rc == 0:
        print("  ✅ 贾维斯巡检完成 —— 已执行深度浏览器断言；无 ERROR/WARN 阻断项。INFO 建议已计入报告健康分。")
    else:
        print("  ⛔ 贾维斯发现问题(见上)。已知 bug 复发会被守卫拦下; 按上面处置修好再打包。")
        print("     每修一个问题就会存入贾维斯, 以后自动防再犯。")
    _blackbox_tip()
    _hr()
    sys.exit(rc)



def _blackbox_tip():
    # 🔴 v571: 稳定性黑匣子读法提示(hansen_stability.js 记录真机崩溃现场到 localStorage)
    print("")
    print("🛰️  黑匣子(真机崩溃现场): 在游戏任意页面控制台执行 HansenBlackbox.read() 可读最近30条")
    print("    (JS异常/Promise拒绝/内存>85%哨兵, key=hansen_blackbox; 清空: HansenBlackbox.clear())")

if __name__ == "__main__":
    main()
