/* hansen_land_scene_manifest_v972.js — 星海大陆殿堂·真实场景交付清单（v972）
 *
 * 用户流程（用户 2026-07-22 裁定：背景图必须自己画，画好交付接线）：
 *   1. 画师按《星海大陆背景图_制作清单》产出场景图（竖版 675×1200 WebP）
 *   2. 图放入 bosses_bg/ 目录，文件名 = 对应立绘同名（如 land_renyi.webp）
 *   3. 在下方数组加入该文件名 → 殿堂立即改用真实场景（清晰直出）
 * 未列入清单的卡：殿堂自动用立绘模糊兜底，不空窗、不发 404 探测。
 */
window.HANSEN_LAND_SCENES = [
  'land_renyi.webp',      // Land1 Boss1 虫群先锋·刃翼领主（2026-07-23 交付）
  'land_wanxing.webp',    // Land1 Boss2 未成形之神·万形之胚
  'land_jingyuan.webp',   // Land1 Boss3 逆相之影·镜渊领主
  'land_hundun.webp',     // Land1 Boss4 混沌之种·万象侵蚀者
  'land_mohuang.webp',    // Land1 守关 魔皇·小丑至尊
  'land_bingwang.webp',   // Land2 Boss1 丛林幽灵·兵王（2026-07-23 交付）
  's1_vanguard.webp',     // Land2 Boss2 暗影先锋·破阵者
  'land_yinyi.webp',      // Land2 Boss3 银翼·麻烦终结者
  'land_juedou.webp',     // Land2 Boss4 决斗大师·千招之约
  's1_waranvil.webp',     // Land2 守关 武器大师·战争铁砧
  'timelord.webp',        // Land3 守关 时之君主·克罗诺斯之影（复用星海觉醒五杰现货场景·2026-07-23 融合）
  'land_huochairen.webp', // Land3 Boss1 火柴人·原初线条（2026-07-23 交付）
  'land_yingshou.webp',   // Land3 Boss2 影守·永夜之壁
  'land_wandian.webp',    // Land3 Boss3 万典之灵·未被写下的故事
  'land_sijilong.webp',   // Land3 Boss4 凋零与新生之龙·四季轮转
];
