/* ════════════════════════════════════════════════════════════════════════
 *  hansen_boss_lock.js  ——  本游戏最核心文件 (boss 战全部逻辑)
 * ════════════════════════════════════════════════════════════════════════
 *
 *  【这个文件干嘛的】
 *  负责"打 boss 背单词"的全部玩法: 出题 / 答题判定 / 倒计时 / 扣血 /
 *  特效 / boss 嘲讽台词 / 章节题型递增 / 运行时版本自检。
 *  它通过"拦截 island.html 里原版的 startBoss / bossAnswer"来注入难度,
 *  因为 island.html 里的 boss 变量是 let 闭包, 外部改不到, 只能拦截+延迟生效。
 *
 *  【整体结构 (从上到下)】
 *    1. 顶部版本号导出   : window.__HBU_VERSION__ 等 (诊断页 check.html 读它)
 *    2. __HBU_BOSS_CONFIG__: 20 个 boss 的倒计时配置 (只读副本, 给诊断页)
 *    3. _r() / _w()      : 跨闭包读写 island.html 的 let 全局变量 (核心黑科技)
 *    4. BOSS_QUOTES/TAUNTS: boss 开场白 + 嘲讽台词库 (260 句)
 *    5. setBossMsg 等     : boss 对话气泡显示
 *    6. 题型函数群        : applySpellFill / SpellPick / SentTrans / Typing
 *    7. startTimer        : 倒计时引擎 (含 token 三道闸防误触发)
 *    8. init()            : 主入口, 拦截 startBoss/bossAnswer, 注入全部逻辑
 *    9. 底部              : 运行时版本一致性自检 (RUNTIME 防 bug 层)
 *
 *  【★这个文件里修过的 BUG (改代码时千万别改回去! 详见 README BUG 档案)】
 *    🔴 BUG #4  : Lv17 能量剑被切 → 图片处理禁阈值法 (图在 bosses/, 非本文件)
 *    🔴 BUG #7  : 复仇厅出错题型 → pickChapterMode 用 boss 实际等级 (见 322 行附近)
 *    🔴 BUG #8  : 20连击全屏动画挡题 → 改 boss 身上爆炸 (见 758 / 1111 行附近)
 *    🔴 BUG #9  : boss 返回键乱跳 → DOM 检测而非 let 变量 (返回键逻辑)
 *    🔴 BUG #10 : 版本号打架 → __HBU_VERSION__ 由 build.py 自动同步 (见第 3、~1277 行)
 *
 *  【改这个文件的铁律】
 *    - 改完必须 node --check + python3 build.py (8 项检查全过才打包)
 *    - 版本号 (__HBU_VERSION__ / HBU_RUNTIME_VERSION / banner) 不要手改,
 *      build.py 会自动同步; 手改会造成 BUG #10 那样的"版本号打架"
 *    - 题型必须按"正在打的 boss 等级"决定, 不是玩家 island 进度 (BUG #7)
 *    - 特效绝不能用 position:fixed;inset:0 全屏盖住题目区 (BUG #8)
 * ════════════════════════════════════════════════════════════════════════ */

// hansen_boss_upgrade.js v152 (双保险覆盖原 cFall/lvlIn keyframes, 防止旧动画名残留)
// v143v: 顶部立即导出版本号到 window, 不依赖 init() (诊断页面用)
window.__HBU_VERSION__ = 'v1078';
window.__HBU_LOADED_AT__ = Date.now();

// Boss 战升级: 难度递增 (答错伤害 + 倒计时) + 最后 Boss 全词覆盖 + 半血惩罚 + 高奖励
// 由于 boss 内部变量是 let 闭包, 无法直接拦截 nextBossQ
// 采取: 拦截 startBoss (调原版后, 修改 bossPool 通过 setTimeout 延迟生效)
//      拦截 bossAnswer (调原版后, 答错时额外扣血)
//      在 startBoss 内 setInterval 定时检查 bossActive 状态, 实施倒计时
(function(){
  'use strict';
  
  // 顶部也暴露 bossConfig 给诊断页面 (普通运行时它在 IIFE 内, 但我们用 window 暴露一份只读副本)
  window.__HBU_BOSS_CONFIG__ = [
    {lv:1,  timeLimit:60}, {lv:2,  timeLimit:55}, {lv:3,  timeLimit:50}, {lv:4,  timeLimit:45},
    {lv:5,  timeLimit:40}, {lv:6,  timeLimit:35}, {lv:7,  timeLimit:32}, {lv:8,  timeLimit:28},
    {lv:9,  timeLimit:25}, {lv:10, timeLimit:22}, {lv:11, timeLimit:20}, {lv:12, timeLimit:18},
    {lv:13, timeLimit:16}, {lv:14, timeLimit:15}, {lv:15, timeLimit:14}, {lv:16, timeLimit:13},
    {lv:17, timeLimit:12}, {lv:18, timeLimit:11}, {lv:19, timeLimit:10}, {lv:20, timeLimit:8}
  ];
  

  // ─── 跨闭包读写: 访问 island.html 里的已知 let 全局变量 ───
  // 经典脚本共享全局词法环境；显式白名单引用替代 new Function/eval。
  // ⚠️ 注意 (关联 BUG #9): 不要假设 island 的 let 变量一定读得到; 涉及 boss 状态判断
  //    优先用 DOM 检测 (querySelector) 更可靠, 这就是 BUG #9 返回键修复的教训。
  function _r(name){
    try {
      switch(name){
        case 'bossCurrent': return typeof bossCurrent !== 'undefined' ? bossCurrent : window.bossCurrent;
        case 'bossActive': return typeof bossActive !== 'undefined' ? bossActive : window.bossActive;
        case 'bossPhase': return typeof bossPhase !== 'undefined' ? bossPhase : window.bossPhase;
        case 'bossHP': return typeof bossHP !== 'undefined' ? bossHP : window.bossHP;
        case 'bossMaxHP': return typeof bossMaxHP !== 'undefined' ? bossMaxHP : window.bossMaxHP;
        case 'bossRageMode': return typeof bossRageMode !== 'undefined' ? bossRageMode : window.bossRageMode;
        case '_bossCorrectIdx': return typeof _bossCorrectIdx !== 'undefined' ? _bossCorrectIdx : window._bossCorrectIdx;
        case 'heroHP': return typeof heroHP !== 'undefined' ? heroHP : window.heroHP;
        case 'heroMaxHP': return typeof heroMaxHP !== 'undefined' ? heroMaxHP : window.heroMaxHP;
        case 'bossCombo': return typeof bossCombo !== 'undefined' ? bossCombo : window.bossCombo;
      }
    } catch(e){}
    return window[name];
  }
  function _w(name, val){
    try {
      if(name === 'bossHP'){
        if(typeof bossHP !== 'undefined') bossHP = val; else window.bossHP = val;
      } else if(name === 'heroHP'){
        if(typeof heroHP !== 'undefined') heroHP = val; else window.heroHP = val;
      }
    } catch(e){}
  }

  // ─── Boss 经典开场白 (战斗开始时, ≤12 字, 一行) ──────────
  var BOSS_QUOTES = {
    '淘气小幽灵': '嘻嘻~ 抓不到我哦!',
    '暗影忍者':   '影舞步, 你看不见我!',
    '百战兽人':   '百战兽人在此, 拿出你的真本事!',
    '史前霸王龙': '远古巨兽苏醒, 颤抖吧!',
    '千年僵尸':   '沉睡在永恒诅咒中吧...',
    '暗夜吸血鬼': '今夜的血... 格外香甜~',
    '蒙面大魔王': '黑暗降临, 凡人颤抖!',
    '地狱犬王':   '三头之吼, 灵魂撕裂!',
    '黑森林巫婆': '尝尝老婆子的毒苹果吧, 嘿嘿嘿!',
    '异次元巫师': '维度崩塌! 异次元降临!',
    '龙骑士统帅': '巨龙之翼, 遮天蔽日!',
    '暗黑灯神':   '灵魂, 即是代价!',
    '海底巨怪':   '深渊呼唤, 沉入海底!',
    '寒冰女王':   '冬天是我的领域!',
    '烈焰魔神':   '焚尽万物, 化为灰烬!',
    '雷电之主':   '天雷怒吼, 闪电贯穿!',
    '机械泰坦':   '目标锁定, 执行清除!',
    '外星霸主':   '弱小地球人, 已被征服!',
    '混沌魔尊':   '深渊审判, 地狱之门开!',
    '上古太阳神':   '吾即万物之始, 臣服吧!'
  };
  
  // ─── 每 boss 的扩展 taunts (Hansen v143p 要求: 多+性格+健康) ──────────
  // 平均 13 句/boss, 共 260 句. 取代 bossCurrent.taunts (原版仅 3 句)
  var BOSS_TAUNTS = {

    // 第 1 章 Lv1-4 · 每 boss 5 句 (调皮入门感)
    '淘气小幽灵': [
      '嘻嘻嘻~ 抓我啊~', '我躲到云里啦!', '看不见我看不见我~', '想抓我? 没那么容易!',
      '捉迷藏开始啦~'
    ],
    '暗影忍者': [
      '影舞步, 现身!', '忍法, 隐身术!', '速度即是一切.', '看准时机, 一击!',
      '影分身之术!'
    ],
    '百战兽人': [
      '吼——! 又一个挑战者!', '我的战锤渴望胜利!', '为部落而战!', '百战不败, 岂会输你!',
      '让你见识真正的勇士!'
    ],
    '史前霸王龙': [
      '吼!!! 远古霸主驾到!', '化石才是你归宿!', '感受远古之力!', '巨齿撕裂万物!',
      '颤抖吧, 小生灵!'
    ],

    // 第 2 章 Lv5-8 · 每 boss 7 句
    '千年僵尸': [
      '千年沉睡...', '古老咒语启动...', '永恒诅咒...', '腐烂气息缭绕...',
      '我已等候千年...', '古墓在呼唤...', '醒来吧, 沉睡者...'
    ],
    '暗夜吸血鬼': [
      '今夜月色真美~', '黑夜永恒, 我喜欢.', '请允许我尝一口~', '城堡欢迎你做客.',
      '你听见夜莺歌吗?', '古老伯爵向你问好.', '夜永远属于我.'
    ],
    '蒙面大魔王': [
      '哈哈哈... 凡人.', '面具下是谁? 猜啊!', '黑暗之力降临!', '你以为能赢?',
      '向魔王臣服吧!', '无人能识我面目.', '魔王的游戏开始!'
    ],
    '地狱犬王': [
      '嗷呜~ 三头之吼!', '三个头颅一齐袭!', '地狱的看门犬!', '颤抖吧, 小英雄!',
      '我能闻到你的恐惧.', '我守的是地狱之门!', '三头联攻无可挡!'
    ],

    // 第 3 章 Lv9-12 · 每 boss 9 句
    '黑森林巫婆': [
      '老婆子的毒苹果, 尝一口吧!', '咕噜咕噜, 魔药煮沸啦!', '骑上扫帚, 看你往哪逃!', '黑森林的诅咒降临!',
      '我的小蝙蝠, 咬他!', '紫色魔焰, 烧成灰!', '熬了百年的毒药, 香吧?', '哈哈, 小娃娃也敢闯我森林?',
      '吃我一记魔法棒!'
    ],
    '异次元巫师': [
      '空间撕裂!', '维度崩塌!', '禁忌魔法吟唱!', '时空在我手中!',
      '异次元正打开!', '你将穿越虚空!', '维度法则被改写!', '我超越了三维!',
      '你看到的不是真实!'
    ],
    '龙骑士统帅': [
      '巨龙之翼遮天!', '龙焰焚天!', '跪下吧, 渺小者!', '龙骑士的荣耀!',
      '我的龙听我号令!', '战旗正在飘扬!', '千年传承的力量!', '战场上无人能敌!',
      '巨龙的怒火!'
    ],
    '暗黑灯神': [
      '三个愿望? 不可能!', '黑暗烟雾笼罩!', '你的灵魂归我!', '我是黑色的灯神!',
      '贪婪是你的代价!', '瓶中我蛰伏太久!', '金色烟雾在卷起!', '我已重获自由!',
      '命运由我玩弄!'
    ],

    // 第 4 章 Lv13-16 · 每 boss 11 句
    '海底巨怪': [
      '八爪缠绕无处逃!', '深渊呼唤着你!', '海底千年之宿!', '触手无所不能!',
      '海水会淹没你!', '深渊之眼盯着你!', '回不去地面了!', '海洋是我的领地!',
      '波涛在咆哮!', '潜入更深处!', '张开大口吞噬!'
    ],
    '寒冰女王': [
      '冻结一切包括你!', '冰封万古之力!', '哈哈, 瑟瑟发抖了?', '冬天是我的领域!',
      '冰晶在飞舞!', '我冷若雪山顶!', '感受冰之吻!', '心已开始结冰!',
      '永冻之地, 欢迎!', '冰柱破空而来!', '我冰封一切色彩!'
    ],
    '烈焰魔神': [
      '焚尽世间一切!', '烈火地狱降临!', '我即火焰本身!', '感受灼烧之力!',
      '燃烧吧, 一切!', '火山在脚下苏醒!', '我的怒火无可挡!', '炎之印记!',
      '热浪滚滚而来!', '我从地心而来!', '焰之裁决!'
    ],
    '雷电之主': [
      '天雷轰顶!', '闪电之力无敌!', '颤抖吧, 凡人!', '雷神降临!',
      '电光在我指尖!', '雷霆万钧!', '听这天雷怒吼!', '云端是我的宝座!',
      '霹雳! 一击!', '我是九天之主!', '暴雷即将袭来!'
    ],

    // 第 5 章 Lv17-20 · 每 boss 13 句 (终极)
    '机械泰坦': [
      '系统在线!', '目标已锁定!', '清除程序启动...', '执行: 清除程序.',
      '系统启动 100%.', '你的算法太弱.', '运算速度无限.', '钢铁不会疲倦.',
      '警告: 检测到人类!', '数据采集中...', '防御系统激活.', '漏洞已锁定.',
      '终极协议启动!'
    ],
    '外星霸主': [
      '你的星球归我了!', '宇宙最强生物!', '弱小地球人!', '我穿越光年而来!',
      '你们科技真原始!', '母舰已就位!', '扫描你!', '投降吧, 地球人!',
      '宇宙的征服者!', '你的智商太低!', '我曾征服七大星系!', '你这生物真有趣!',
      '银河尽在我掌!'
    ],
    '混沌魔尊': [
      '深渊审判!', '地狱之门已开启!', '我即黑暗本身!', '千年王座的主人!',
      '万物归我支配!', '黑色火焰燃尽一切!', '听这绝望的呼啸!', '终焉降临!',
      '我曾撼动神祇!', '无人能逃我之掌!', '审判的钟声敲响!', '一切化为虚无!',
      '黑暗将吞噬光明!'
    ],
    '上古太阳神': [
      '吾即是万物之始!', '宇宙在我掌中!', '凡人终须臣服!', '我先于时间而存!',
      '我即是法则!', '群星向我朝拜!', '在我面前神也卑微!', '我观看了万古更替!',
      '时空因我而存!', '我创造亦能毁灭!', '原初之力!', '凡人勿与我对视!',
      '我即是开端与终结!'
    ]
  };
  
  // 取一句 taunt (优先用扩展字典)
  function getRandomTaunt(b){
    if(!b) return '';
    var arr = (b.name && BOSS_TAUNTS[b.name]) ? BOSS_TAUNTS[b.name] : (b.taunts || []);
    if(!arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  // v143x: 3 秒最小间隔门控 (Hansen 要求: 3 秒内不能连说两句)
  // 距上次 < 3 秒, 黄框保留上一句; >= 3 秒才抽新句
  var lastTauntTime = 0;
  var lastTauntText = '';
  function getThrottledTaunt(b){
    var now = Date.now();
    if(now - lastTauntTime < 3000 && lastTauntText){
      // 3 秒内, 重用上一句, 黄框不空
      return lastTauntText;
    }
    // >= 3 秒, 抽新一句
    var taunt = getRandomTaunt(b);
    if(taunt){
      lastTauntText = '💬 ' + taunt;
      lastTauntTime = now;
    }
    return lastTauntText;
  }
  // 提供给 startBoss 钩子重置时间 (新 boss 战开始, 时间窗清零)
  function resetTauntThrottle(text){
    lastTauntTime = Date.now();
    lastTauntText = text || '';
  }
  
  // 🔴 BUG#56 (v480): boss 台词一行显示 + 绝不出屏 + 绝不换两行。
  //   把台词包进 .boss-msg-inner; 量内层内容宽, 超出屏宽就给【内层】transform:scale 缩到正好一行装进屏(短台词不缩)。
  //   缩内层(不缩 #bossMsg)→ 不触发那个清 #bossMsg inline style 的 MutationObserver; 框宽由 CSS width:max-content 随台词加长(上限屏宽)。
  function fitBossMsg(){
    var el = document.getElementById('bossMsg');
    if(!el || el.__fittingMsg) return;
    el.__fittingMsg = true;
    try {
      var inner = el.firstElementChild;
      var wrapped = !!(inner && inner.classList && inner.classList.contains('boss-msg-inner') && el.childNodes.length === 1);
      if(!wrapped){
        if(el.innerHTML.indexOf('boss-msg-inner') === -1){
          el.innerHTML = '<span class="boss-msg-inner">' + el.innerHTML + '</span>';
        }
        inner = el.firstElementChild;
      }
      if(inner){
        inner.style.transform = 'none';
        var content = inner.scrollWidth || inner.offsetWidth;
        var vw = window.innerWidth || document.documentElement.clientWidth || 360;
        var avail = vw - 52;   // 屏宽 - 气泡两侧(margin+padding+border) → 缩后整框含边框装进屏、不贴边
        if(avail > 40 && content > avail){
          inner.style.transform = 'scale(' + (avail / content).toFixed(4) + ')';
        }
      }
    } catch(e){}
    el.__fittingMsg = false;
  }
  window.HansenFitBossMsg = fitBossMsg;

  // 统一设置 bossMsg (v143p: 仅改 innerHTML, 外壳由 CSS 注入锁定, 不再重设 cssText)
  function setBossMsg(content){
    var msgEl = document.getElementById('bossMsg');
    if(!msgEl) return;
    msgEl.innerHTML = content;
    msgEl.className = 'boss-msg';  // 重置为中性 class, 清掉 .hit/.miss/.crit 的颜色
    fitBossMsg();                  // 🔴 BUG#56: 长台词缩到一行装进屏(不裁切/不换行/不出屏)
  }
  
  // 标识 startBoss 刚刚启动 (第一题前不要被 taunt 覆盖 quote)
  var isStartingBoss = false;

    var bossConfig = [
    // v143v: 全 20 级 boss 倒计时严格单调递减 60s → 10s, 每级都不同
    // Lv1 淘气小幽灵
    {wrongExtra:0,   timeLimit:60, askAll:false, rewardMult:1.0, intro:'⏰ 60 秒 入门小怪 ✏️'},
    // Lv2 百战兽人
    {wrongExtra:5,   timeLimit:55, askAll:false, rewardMult:1.0, intro:'⏰ 55 秒 英汉互译 🔁'},
    // Lv3 黑衣忍者
    {wrongExtra:10,  timeLimit:50, askAll:false, rewardMult:1.2, intro:'⏰ 50 秒 忍者出招 🥷'},
    // Lv9 黑森林巫婆
    {wrongExtra:15,  timeLimit:45, askAll:false, rewardMult:1.3, intro:'⏰ 45 秒 黑魔法登场 🧙'},
    // Lv5 暗黑灯神
    {wrongExtra:20,  timeLimit:40, askAll:false, rewardMult:1.4, intro:'⏰ 40 秒 灯神召唤!'},
    // Lv6 史前霸王龙
    {wrongExtra:25,  timeLimit:35, askAll:false, rewardMult:1.6, intro:'⏰ 35 秒 史前霸主!'},
    // Lv7 蒙面大魔王
    {wrongExtra:30,  timeLimit:32, askAll:false, rewardMult:1.8, intro:'⏰ 32 秒 神秘大魔王!'},
    // Lv8 地狱犬王
    {wrongExtra:35,  timeLimit:28, askAll:false, rewardMult:2.0, intro:'⏰ 28 秒 三头犬王!'},
    // Lv9 寒冰女王
    {wrongExtra:40,  timeLimit:25, askAll:false, rewardMult:2.2, intro:'⏰ 25 秒 冰冻全场!'},
    // Lv10 烈焰魔神
    {wrongExtra:45,  timeLimit:22, askAll:false, rewardMult:2.4, intro:'⏰ 22 秒 烈焰焚身!'},
    // Lv11 雷电之主
    {wrongExtra:50,  timeLimit:20, askAll:false, rewardMult:2.6, intro:'⏰ 20 秒 雷霆万钧!'},
    // Lv12 海底巨怪
    {wrongExtra:55,  timeLimit:18, askAll:false, rewardMult:2.8, intro:'⏰ 18 秒 深渊降临!'},
    // Lv13 暗夜吸血鬼
    {wrongExtra:60,  timeLimit:16, askAll:false, rewardMult:3.0, intro:'⏰ 16 秒 鲜血诅咒!'},
    // Lv14 千年僵尸
    {wrongExtra:65,  timeLimit:15, askAll:false, rewardMult:3.2, intro:'⏰ 15 秒 古老恐惧!'},
    // Lv15 异次元巫师
    {wrongExtra:70,  timeLimit:14, askAll:false, rewardMult:3.5, intro:'⏰ 14 秒 维度崩塌!'},
    // Lv16 机械泰坦
    {wrongExtra:75,  timeLimit:13, askAll:false, rewardMult:3.8, intro:'⏰ 13 秒 钢铁洪流!'},
    // Lv17 外星霸主
    {wrongExtra:80,  timeLimit:12, askAll:false, rewardMult:4.0, intro:'⏰ 12 秒 星际侵略!'},
    // Lv18 龙骑士统帅
    {wrongExtra:85,  timeLimit:11, askAll:false, rewardMult:4.3, intro:'⏰ 11 秒 龙翼蔽天!'},
    // Lv19 混沌魔尊
    {wrongExtra:90,  timeLimit:10, askAll:true,  rewardMult:4.6, intro:'⏰ 10 秒 + 全岛词覆盖!'},
    // Lv20 上古太阳神 - 终极
    {wrongExtra:99,  timeLimit:8,  askAll:true,  rewardMult:5.0, intro:'⚠️ 终极: 全岛词 + 8 秒 + 答错半血!'},
  ];
  
  // 当前 boss 等级 (用 window.S.level 算)
  function getBossLevel(){
    try {
      var lvl = Math.max(0, (window.S && window.S.level || 1) - 1);
      return Math.min(lvl, bossConfig.length - 1);
    } catch(e){ return 0; }
  }
  function getBossCfg(){
    //🔴v814 赛季岛: 不套常规岛难度(神秘大魔王/灯神召唤 intro + 跟玩家 XP 走的递进计时)。
    //   赛季是"记住词"的考验·不是拼手速 → timeLimit:0(不启动计时器·想多久都行·绝不会因超时被判答错而毁掉完美战)·intro 用赛季自己的文案。常规岛一行不碰。
    try {
      if(/island_season\.html/.test(location.pathname||'')){
        var _sN814 = (window._hansenRebattleLv>=1) ? Math.min(6, window._hansenRebattleLv|0) : 1;
        var _si814 = (_sN814>=6) ? '赛尔娅终极 · 240 词总复习!' : '星海词汇守关挑战!';
        return { wrongExtra:0, timeLimit:0, askAll:false, rewardMult:1.5, intro:_si814 };
      }
    } catch(e){}
    return bossConfig[getBossLevel()] || bossConfig[0];
  }
  
  var timerInterval = null;
  var timerToken = 0;  // v165: 每次 clearTimer/startTimer 自增, 验证 fire 时 token 匹配, 防上题 timer 在新题面误触发
  var pollInterval = null;
  // 🛡️ HOLE #1/#2 修复 (v235): 给每场 boss 战一个唯一 token, 战斗结束后 token++
  // 所有延迟触发 bossVictory/bossDefeat 的 setTimeout 都要先检查 token, 战斗已结束就不触发
  var bossSessionToken = 0;
  // 🛡️ BUG #14 修复 (v236): nextBossQ 去重锁 — 防多个 setTimeout 并发覆盖题面
  var lastNextBossQAt = 0;
  // 🔴 BUG#62 修复 (v490): "boss 题目区空白卡死"看门狗的周期句柄(每场 startBoss 装, stopBoss 清)
  var _bossQWdInterval = null;
  // 🔴 BUG#62 加强 (v491): 记录【最近一次答题时刻】—— 看门狗据此判断"答完后下一题是否超时未来"
  //   (答完→下一题原版靠 setTimeout 1500/2000ms; 用答题时刻而非出题时刻算超时, 玩家想多久都不会误判)。
  var _lastAnswerAt = 0;
  
  // v946 HF5: 这根彩虹条是功能性倒计时，不能被“减少动态效果”的全局
  // transition-duration:.001ms!important 压成 0。它只在本元素上用行内 !important
  // 覆盖该时长；原有 token、超时回调和答题状态机全部保持不变。
  // v143u: 答完题 fill 立即平滑回弹到 100% 满格, 停在那里, 直到下一题 startTimer 开始新倒计时
  function clearTimer(){
    timerToken++;  // v165: 让任何已 fired 但未处理的 setTimeout 回调失效
    if(timerInterval){ clearTimeout(timerInterval); timerInterval = null; }
    var fill = document.getElementById('bossTimerFill');
    if(fill){
      fill.style.setProperty('transition', 'transform 0.3s ease-out', 'important');
      fill.style.transform = 'scaleX(1)';
    }
  }
  
  // v143p 新增: 真正隐藏时间条 (仅 boss 战结束时调用)
  function hideTimer(){
    timerToken++;
    if(timerInterval){ clearTimeout(timerInterval); timerInterval = null; }
    var el = document.getElementById('bossTimerEl');
    if(el) el.style.display = 'none';
  }
  
  // ════════════════════════════════════════════════════════════
  // v154: 章节难度梯度 — 5 章每章新增 1 种题型, 30% 概率出新模式
  // Ch1 (Lv1-4):   现有 4 模式
  // Ch2 (Lv5-8):   30% 拼写补全 (中文+缺字母英文, 4 选 1 字母组合)
  // Ch3 (Lv9-12):  30% 拼字辨认 (中文+乱序字母, 6 选 1 正确拼法)
  // Ch4 (Lv13-16): 30% 句子翻译 (中文整句, 4 选 1 英文翻译)
  // Ch5 (Lv17-20): 30% 打字模式 (中文, 输入框直接打英文, 无选项)
  // ════════════════════════════════════════════════════════════
  
  var NEW_MODE_PROB = 0.30;
  // 允许外部覆盖 (调试或 Hansen 自定义难度)
  function getNewModeProb(){
    if(typeof window.__hbuNewModeProb === 'number') return window.__hbuNewModeProb;
    return NEW_MODE_PROB;
  }
  
  // v160: 累加池 (递进式) — 后章节包含前面所有新题型
  // Ch1 (Lv 1-4):   pool = []                                  (100% 原 4 种基础题)
  // Ch2 (Lv 5-8):   pool = [spellFill]                         (30% 出 spellFill, 70% 原)
  // Ch3 (Lv 9-12):  pool = [spellFill, spellPick]              (30% 二选一, 70% 原)
  // Ch4 (Lv 13-16): pool = [spellFill, spellPick, sentTrans]   (30% 三选一, 70% 原)
  // Ch5 (Lv 17-20): v301 Hansen 要求"看中文拼单词(typing)约占一半". 实现: typing 独立 50% 概率;
  //                 剩下 50% 里再按老逻辑(70%原题 / 30%四选一特殊池)分, 保证仍有多样性。
  var CH5_TYPING_PROB = 0.50;  // Lv17-20 直接出 typing 的概率
  function pickChapterMode(level){
    // v301: 最后章节 typing 提频 — 先掷 typing
    if(level >= 17 && Math.random() < CH5_TYPING_PROB) return 'typing';

    if(Math.random() >= getNewModeProb()) return null;  // 70% 走原 nextBossQ 的 4 种基础题
    
    var pool = [];
    if(level >= 5)  pool.push('spellFill');
    if(level >= 9)  pool.push('spellPick');
    if(level >= 13) pool.push('sentTrans');
    if(level >= 17) pool.push('typing');
    
    if(pool.length === 0) return null;  // Lv1-4 永远走原模式
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  function applyChapterMode(){
    var w = window._bossWord;
    if(!w || !w.en) return;
    // v293/v315: 默认移除打字紧凑布局 + 重置 bossOpts 内联样式 (打字模式给 bo 设过 display:block/grid, 切回普通题必须清掉, 否则原选择题的 .boss-opts grid 失效 → 错位)
    try { var _ar = document.querySelector('.boss-arena'); if(_ar) { _ar.classList.remove('bts-typing'); _ar.classList.remove('bts-compact'); } } catch(e){}
    try { var _bo = document.getElementById('bossOpts'); if(_bo){ _bo.style.display=''; _bo.style.gridTemplateColumns=''; _bo.style.width=''; _bo.style.maxWidth=''; _bo.style.marginLeft=''; _bo.style.marginRight=''; _bo.style.gap=''; } } catch(e){}
    if(window._btsKeyHandler){ try { document.removeEventListener('keydown', window._btsKeyHandler); } catch(e){} window._btsKeyHandler = null; }
    // 🔴 BUG #7 修复 (v204→v208 落地): rebattle 时用 boss 实际等级 (_hansenRebattleLv), 而不是玩家当前 island 进度
    // 现象: 玩家进度 Lv15 回去打 Lv2 boss, 却出现 sentTrans 等高级题型 (题型穿透章节边界)
    // 根因: 旧代码读 S.level (玩家进度) 来决定题型池. 改成优先读正在打的 boss 实际等级.
    var level;
    //🔴v877(Hansen): 单词大陆(land)boss战复用正片这套现成拼写机制(spellFill/spellPick/typing自绘键盘)——
    //  大陆用 _s1Idx(关卡序0基)而非 _hansenRebattleLv/S.level, 故这里把关卡序映射成题型等级(关序×4, Lv越高题型越丰富)。
    //  仅影响【题型选择】·不碰 bossVictory 的关卡判断(那仍走大陆 _s1Idx 进度)。
    if(/island_land[1-8]\.html/.test(location.pathname||'') && window._s1Idx != null){
      level = Math.max(1, Math.min(20, ((window._s1Idx|0)+1)*4));  // 关1→4, 关2→8 … 关5→20
    } else if(window._hansenRebattleLv != null && window._hansenRebattleLv >= 1){
      level = window._hansenRebattleLv;  // rebattle: 用 boss 实际等级
    } else {
      level = (window.S && window.S.level) || 1;  // 正常: 用玩家进度
    }
    var mode = pickChapterMode(level);
    if(!mode) return;
    
    // 各模式的可用性预检查 (失败则保持原模式)
    if(mode === 'spellFill'  && w.en.length < 5) return;
    if(mode === 'spellPick'  && w.en.length < 4) return;
    if(mode === 'sentTrans'  && (!w.ex || !w.exCn || w.exCn.length < 4)) return;
    if(mode === 'typing'     && w.en.length < 3) return;  // v171: 1-2 字母词打字没意思
    
    if(mode === 'spellFill') applySpellFill(w);
    else if(mode === 'spellPick') applySpellPick(w);
    else if(mode === 'sentTrans') applySentTrans(w);
    else if(mode === 'typing')    applyTyping(w);
  }
  
  function shuffleArr(a){
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  
  // v167: HTML 转义, 防句子里的 <>& 破坏 innerHTML
  // esc(s): HTML 转义, 把 & < > " ' 转成实体, 防止单词/例句里的特殊字符破坏页面结构
  // (v167 修过: 不转义会导致含 <> & 的内容把题目 DOM 弄乱)
  function esc(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // v308: 3D 立体对号/叉号 (SVG, 跨手机一致, 渐变+高光+投影) 替代系统 emoji ✓/❌
  var _bts3dSeq = 0;
  function icon3dCheck(size){
    var s = size || 30; var id = 'btsck' + (_bts3dSeq++);
    return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 48 48" style="vertical-align:middle;display:inline-block;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.45))">' +
      '<defs>' +
        '<radialGradient id="'+id+'g" cx="38%" cy="32%" r="75%">' +
          '<stop offset="0%" stop-color="#86efac"/><stop offset="45%" stop-color="#22c55e"/><stop offset="100%" stop-color="#15803d"/>' +
        '</radialGradient>' +
        '<linearGradient id="'+id+'h" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="24" cy="24" r="22" fill="url(#'+id+'g)" stroke="#0a5a2a" stroke-width="1.2"/>' +
      '<ellipse cx="24" cy="16" rx="16" ry="9" fill="url(#'+id+'h)"/>' +
      '<path d="M14 25 l7 7 l14 -16" fill="none" stroke="#0a4d23" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" transform="translate(0,1.5)"/>' +
      '<path d="M14 25 l7 7 l14 -16" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }
  function icon3dCross(size){
    var s = size || 30; var id = 'btsx' + (_bts3dSeq++);
    return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 48 48" style="vertical-align:middle;display:inline-block;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.45))">' +
      '<defs>' +
        '<radialGradient id="'+id+'g" cx="38%" cy="32%" r="75%">' +
          '<stop offset="0%" stop-color="#fca5a5"/><stop offset="45%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/>' +
        '</radialGradient>' +
        '<linearGradient id="'+id+'h" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="24" cy="24" r="22" fill="url(#'+id+'g)" stroke="#7a1414" stroke-width="1.2"/>' +
      '<ellipse cx="24" cy="16" rx="16" ry="9" fill="url(#'+id+'h)"/>' +
      '<path d="M16 16 l16 16 M32 16 l-16 16" fill="none" stroke="#6e1010" stroke-width="6.5" stroke-linecap="round" opacity="0.35" transform="translate(0,1.5)"/>' +
      '<path d="M16 16 l16 16 M32 16 l-16 16" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>' +
      '</svg>';
  }
  
  // ─── Ch2: 拼写补全 ───────────────────────────────────────────
  function applySpellFill(w){
    var en = w.en.toLowerCase();
    var holeLen = en.length >= 7 ? 3 : 2;  // 长词挖 3, 短词挖 2
    var maxStart = en.length - holeLen - 1;
    if(maxStart < 1) return;
    var holeStart = 1 + Math.floor(Math.random() * maxStart);
    
    var prefix = en.substring(0, holeStart);
    var hole = en.substring(holeStart, holeStart + holeLen);
    var suffix = en.substring(holeStart + holeLen);
    
    // 4 选项: 正确 + 3 干扰
    var choices = [hole];
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    var attempts = 0;
    while(choices.length < 4 && attempts < 30){
      attempts++;
      var d = '';
      for(var i = 0; i < holeLen; i++){
        d += letters.charAt(Math.floor(Math.random() * 26));
      }
      if(choices.indexOf(d) < 0) choices.push(d);
    }
    // v168 兜底: 用同长度字符串 (前面 30 次没凑齐时, 用顺序变化的字母组合)
    var fbi = 0;
    while(choices.length < 4){
      var fallback = '';
      for(var fi = 0; fi < holeLen; fi++){
        fallback += letters.charAt((fbi + fi) % 26);
      }
      fbi++;
      if(choices.indexOf(fallback) < 0) choices.push(fallback);
      if(fbi > 50) break;  // 极端保护
    }
    
    shuffleArr(choices);
    var correctIdx = choices.indexOf(hole);
    
    var bq = document.getElementById('bossQ');
    var bs = document.getElementById('bossQSub');
    var bo = document.getElementById('bossOpts');
    var bqt = document.getElementById('bossQType');
    if(!bq || !bs || !bo) return;
    
    if(bqt) bqt.textContent = '🎯 拼写补全';
    bq.innerHTML = 
      '<div class="boss-answer-primary" style="font-size:18px;font-weight:900;color:#fbbf24;margin-bottom:5px;text-shadow:0 0 12px rgba(251,191,36,0.4)">' + esc(w.cn || '') + '</div>' +
      '<div class="boss-answer-kicker" style="font-size:10px;color:#cbd5e1;margin-bottom:2px">补全英文 (缺 ' + holeLen + ' 个字母):</div>' +
      '<div id="bsfBox" class="boss-answer-box" style="font-size:18px;font-weight:900;letter-spacing:2px;color:#fff;font-family:Consolas,monospace;background:rgba(15,23,42,0.85);padding:5px 12px;border-radius:9px;border:2px solid #6366f1;display:inline-block">' + 
      prefix + 
      '<span id="bsfHole" class="boss-answer-hole" style="color:#1e293b;background:#fbbf24;padding:0 5px;border-radius:4px;margin:0 2px">' + new Array(holeLen + 1).join('_') + '</span>' + 
      suffix + '</div>';
    bs.innerHTML = '';
    // v324: 存下来, 答完后在框里把空缺补成正确字母 (对=白色 / 错=红色)
    window._bsfPrefix = prefix; window._bsfHole = hole; window._bsfSuffix = suffix;
    
    // 🔴 BUG#58 (v483): Hansen 要求 spellFill 不缩 boss 立绘——"完全没有缩小的必要, 只会影响 boss 画质"。
    //   实测(真机 startBoss 量): 全尺寸(立绘 190px)布局内容高 739px, 在手机视口(~747)一屏放得下、不出滚动条。
    //   故移除 bts-compact(它把立绘缩成 118px), 用正常全尺寸布局。applyChapterMode 开头也会 remove, 这里再显式移除兜底。
    try { var _ar3 = document.querySelector('.boss-arena'); if(_ar3) _ar3.classList.remove('bts-compact'); } catch(e){}
    
    bo.style.display = '';
    bo.style.gridTemplateColumns = 'repeat(2, 1fr)';
    bo.style.gap = '5px';
    bo.innerHTML = choices.map(function(c, i){
      return '<div class="boss-opt boss-answer-choice" onclick="bossAnswer(' + i + ')" style="font-size:15px;font-weight:900;letter-spacing:2px;font-family:Consolas,monospace;color:#fbbf24;text-align:center;padding:7px 6px">' + c + '</div>';
    }).join('');
    bo.dataset.done = '';
    
    window._bossCorrectIdx = correctIdx;
    window._bossQType = 'spellFill';
  }
  
  // ─── Ch3: 拼字辨认 (6 选 1) ──────────────────────────────────
  function applySpellPick(w){
    var en = w.en.toLowerCase();
    
    // v167: 确保乱序结果 !== en (短词重排可能巧合不变)
    var scrambled = en;
    var sAtt = 0;
    while(scrambled === en && sAtt < 30){
      scrambled = shuffleArr(en.split('')).join('');
      sAtt++;
    }
    // 极端兜底: 还是 == en (例如 'a' 单字母), 反转
    if(scrambled === en) scrambled = en.split('').reverse().join('');
    
    // 6 个选项
    var choices = [en];
    var att = 0;
    while(choices.length < 6 && att < 80){
      att++;
      var d = shuffleArr(en.split('')).join('');
      if(d !== en && choices.indexOf(d) < 0) choices.push(d);
    }
    // 兜底: 短词重排不够 6 种, 用字母替换填充
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    while(choices.length < 6){
      var arr = en.split('');
      arr[Math.floor(Math.random() * arr.length)] = letters.charAt(Math.floor(Math.random() * 26));
      var d2 = arr.join('');
      if(d2 !== en && choices.indexOf(d2) < 0) choices.push(d2);
      if(choices.length === 5 && d2 === en) choices.push(letters.charAt(0));  // 极端保险
    }
    
    shuffleArr(choices);
    var correctIdx = choices.indexOf(en);
    
    var bq = document.getElementById('bossQ');
    var bs = document.getElementById('bossQSub');
    var bo = document.getElementById('bossOpts');
    var bqt = document.getElementById('bossQType');
    if(!bq || !bs || !bo) return;
    
    if(bqt) bqt.textContent = '🔤 拼字辨认 · 6 选 1';
    bq.innerHTML = 
      '<div class="boss-answer-kicker" style="font-size:11px;color:#cbd5e1;margin-bottom:1px">中文意思:</div>' +
      '<div class="boss-answer-primary" style="font-size:18px;font-weight:900;color:#fbbf24;margin-bottom:2px;text-shadow:0 0 12px rgba(251,191,36,0.4)">' + esc(w.cn || '') + '</div>' +
      '<div class="boss-answer-kicker" style="font-size:11px;color:#cbd5e1;margin-bottom:1px">乱序字母 (选出正确拼写):</div>' +
      '<div class="boss-answer-secondary boss-answer-box" style="font-size:18px;font-weight:900;letter-spacing:3px;color:#fbbf24;font-family:Consolas,monospace;background:rgba(15,23,42,0.85);padding:3px 12px;border-radius:9px;border:2px dashed #a855f7;display:inline-block">' + scrambled + '</div>';
    bs.innerHTML = '';   // 🔴 BUG#58(v483): 去掉冗余副标题(题型标签已写"6 选 1"), 省一行高度

    // 🔴 BUG#58 (v483): Hansen 要求 boss 做题页除打字外都【不缩立绘】(缩小只伤 boss 画质)。
    //   spellPick 有 6 个选项(比 spellFill 多一行), 全尺寸 2 列布局内容高 807px → 手机会超屏出滚动条;
    //   之前用 bts-compact 把立绘从 190px 缩成 118px 顶掉高度(画质差)。
    //   新方案(不缩立绘): 6 个短字母选项排【3 列 2 行】(省一行) + 收紧选项内边距 + 去掉冗余副标题,
    //   把约 60px 高度抠回来, 使全尺寸立绘(190px)也一屏放得下、不出滚动条。移除 bts-compact。
    try { var _ar2 = document.querySelector('.boss-arena'); if(_ar2) _ar2.classList.remove('bts-compact'); } catch(e){}
    
    bo.style.display = '';
    bo.style.gridTemplateColumns = 'repeat(3, 1fr)';   // 6 选项 → 3 列 2 行 (省一行高度, 短字母组合 3 列够宽)
    bo.style.gap = '5px';
    bo.innerHTML = choices.map(function(c, i){
      return '<div class="boss-opt boss-answer-choice" onclick="bossAnswer(' + i + ')" style="font-size:14px;font-weight:800;font-family:Consolas,monospace;color:#fbbf24;text-align:center;padding:6px 3px">' + c + '</div>';
    }).join('');
    bo.dataset.done = '';
    
    window._bossCorrectIdx = correctIdx;
    window._bossQType = 'spellPick';
  }
  
  // ─── Ch4: 句子翻译 ───────────────────────────────────────────
  function applySentTrans(w){
    var allW = window.allW || window.WORDS || [];
    if(!Array.isArray(allW) || allW.length < 10) return;
    
    // 选 3 个有 ex 的其他 word 做干扰句 (v167: 按句子文本去重, 不只按 en, 防词库存在共用例句)
    var distractors = [];
    var seenText = {};
    seenText[w.ex] = true;
    var att = 0;
    while(distractors.length < 3 && att < 80){
      att++;
      var other = allW[Math.floor(Math.random() * allW.length)];
      if(other && other.ex && other.ex.length > 10 && !seenText[other.ex]){
        distractors.push(other.ex);
        seenText[other.ex] = true;
      }
    }
    if(distractors.length < 3) return;  // 备选不够
    
    var choices = [w.ex].concat(distractors);
    shuffleArr(choices);
    var correctIdx = choices.indexOf(w.ex);
    
    var bq = document.getElementById('bossQ');
    var bs = document.getElementById('bossQSub');
    var bo = document.getElementById('bossOpts');
    var bqt = document.getElementById('bossQType');
    if(!bq || !bs || !bo) return;
    
    if(bqt) bqt.textContent = '📜 句子翻译';
    // v232: 红框收紧 - 只包裹文字本身, 不撑满宽度 (display:inline-block + 居中容器)
    // v238: Hansen 反馈仍有点厚, 再瘦 (上下 padding 6→3, line-height 1.45→1.3)
    // v323: 删掉多余的"中文句子:"标签 (Hansen: 谁都看得出下面是中文句子, 冗余)
    bq.innerHTML = 
      '<div style="text-align:center"><div class="boss-answer-primary boss-answer-box" style="display:inline-block;font-size:16px;font-weight:700;color:#fbbf24;background:rgba(15,23,42,0.85);padding:3px 14px;border-radius:8px;border:2px solid #ef4444;line-height:1.3;max-width:100%">' + esc(w.exCn) + '</div></div>';
    bs.innerHTML = '选出正确的英文翻译';
    
    bo.style.display = '';
    bo.style.gridTemplateColumns = '1fr';
    bo.style.gap = '5px';
    bo.innerHTML = choices.map(function(c, i){
      return '<div class="boss-opt boss-answer-choice" onclick="bossAnswer(' + i + ')" style="padding:9px 12px;text-align:left;font-size:12.5px;line-height:1.4">' +
        '<span class="boss-answer-choice-label" style="color:#fbbf24;font-weight:900;margin-right:6px">' + 'ABCD'.charAt(i) + '.</span>' +
        '<span class="boss-answer-choice-text" style="color:#fff">' + esc(c) + '</span></div>';
    }).join('');
    bo.dataset.done = '';
    
    window._bossCorrectIdx = correctIdx;
    window._bossQType = 'sentTrans';
  }
  
  // ─── Ch5: 打字模式 (v293: 改用游戏内屏幕键盘, 不再用系统输入框/外接键盘; 紧凑一屏) ───
  var _btsTyped = '';   // 当前打字题已输入的字母 (不含空格)

  function bossKeyboardHtml(){
    var rows = [['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['z','x','c','v','b','n','m']];
    var k = '<div class="keyboard" id="btsKbd">';
    k += '<div class="keyboard-row">'; rows[0].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '</div>';
    k += '<div class="keyboard-row indent">'; rows[1].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '</div>';
    k += '<div class="keyboard-row">'; rows[2].forEach(function(l){ k += '<button class="key" data-k="'+l+'" type="button">'+l+'</button>'; }); k += '<button class="key delete" data-act="del" type="button">&#9003;</button></div>';
    k += '</div>';
    return k;
  }

  function applyTyping(w){
    var bq = document.getElementById('bossQ');
    var bs = document.getElementById('bossQSub');
    var bo = document.getElementById('bossOpts');
    var bqt = document.getElementById('bossQType');
    if(!bq || !bs || !bo) return;

    window._hansenTypingSubmitting = false;
    _btsTyped = '';

    // 紧凑布局: 给 arena 加 class (缩小 boss 图 + 收紧间距, 让 slot+键盘 一屏放下)
    try { var ar = document.querySelector('.boss-arena'); if(ar) ar.classList.add('bts-typing'); } catch(e){}

    // v300: 不再显示"打字模式"标签 (Hansen 要删, 省空间); 标签由 .bts-typing CSS 隐藏
    bq.innerHTML =
      '<div class="boss-answer-kicker" style="font-size:10px;color:#cbd5e1;margin-bottom:2px">\u770b\u4e2d\u6587\u610f\u601d, \u62fc\u51fa\u82f1\u6587:</div>' +
      '<div class="boss-answer-primary" style="font-size:18px;font-weight:900;color:#fbbf24;line-height:1.05;text-shadow:0 0 12px rgba(251,191,36,0.5)">' + esc(w.cn || '') + '</div>';
    bs.innerHTML = '';

    var target = (w.en || '').toLowerCase();
    var targetLetters = target.replace(/ /g, '').length;

    var slotsHtml = '';
    target.split('').forEach(function(ch, i){
      if(ch === ' ') slotsHtml += '<div class="bts-slot space" id="btsSlot'+i+'"></div>';
      else slotsHtml += '<div class="bts-slot" id="btsSlot'+i+'"></div>';
    });

    bo.style.display = 'block';
    bo.style.gridTemplateColumns = '';
    bo.innerHTML =
      '<div class="boss-opt" style="display:none"></div>' +
      '<div class="bts-row">' +
        '<div class="bts-slots" id="btsSlots">' + slotsHtml + '</div>' +
      '</div>' +
      '<div id="btsHint" class="bts-hint-below"></div>' +
      bossKeyboardHtml();
    bo.dataset.done = '';
    window._bossQType = 'typing';

    function fillSlots(){
      var idx = 0;
      for(var i = 0; i < target.length; i++){
        var el = document.getElementById('btsSlot'+i);
        if(!el) continue;
        if(target[i] === ' '){ el.textContent = ' '; continue; }
        if(idx < _btsTyped.length){ el.textContent = _btsTyped[idx]; el.classList.add('filled'); }
        else { el.textContent = ''; el.classList.remove('filled'); }
        idx++;
      }
    }
    function btsKey(l){
      if(bo.dataset.done) return;
      if(_btsTyped.length >= targetLetters) return;
      _btsTyped += l;
      fillSlots();
      try { if(window.playBeep) window.playBeep(700 + _btsTyped.length * 40, 0.04); } catch(e){}
      if(_btsTyped.length >= targetLetters){ setTimeout(function(){ submitTyping(); }, 220); }
    }
    function btsDel(){
      if(bo.dataset.done) return;
      if(_btsTyped.length === 0) return;
      _btsTyped = _btsTyped.slice(0, -1);
      fillSlots();
    }
    function btsHint(){
      if(bo.dataset.done) return;
      var ns = target.replace(/ /g, '');
      if(_btsTyped.length < ns.length){
        _btsTyped += ns[_btsTyped.length];
        fillSlots();
        var h = document.getElementById('btsHint');
        if(h){ h.textContent = '\ud83d\udca1 \u5df2\u586b\u5165\u4e00\u4e2a\u5b57\u6bcd'; setTimeout(function(){ if(h) h.textContent = ''; }, 1200); }
        if(_btsTyped.length >= targetLetters){ setTimeout(function(){ submitTyping(); }, 220); }
      }
    }

    var kbd = document.getElementById('btsKbd');
    if(kbd){
      kbd.addEventListener('click', function(e){
        var btn = e.target;
        if(!btn || !btn.classList || !btn.classList.contains('key')) return;
        if(btn.dataset.k) btsKey(btn.dataset.k);
        else if(btn.dataset.act === 'del') btsDel();
        else if(btn.dataset.act === 'hint') btsHint();
      });
    }

    // 物理键盘 (电脑端) 支持; 切题前移除旧 handler 防泄漏
    if(window._btsKeyHandler){ try { document.removeEventListener('keydown', window._btsKeyHandler); } catch(e){} window._btsKeyHandler = null; }
    window._btsKeyHandler = function(e){
      if(bo.dataset.done) return;
      if(e.key === 'Backspace'){ e.preventDefault(); btsDel(); }
      else if(e.key === 'Enter'){ e.preventDefault(); if(_btsTyped.length >= targetLetters) submitTyping(); }
      else if(/^[a-zA-Z]$/.test(e.key)){ btsKey(e.key.toLowerCase()); }
    };
    document.addEventListener('keydown', window._btsKeyHandler);
  }

  function submitTyping(){
    var w = window._bossWord;
    if(!w) return;
    var bo = document.getElementById('bossOpts');
    if(bo && bo.dataset.done) return;
    if(window._hansenTypingSubmitting) return;
    window._hansenTypingSubmitting = true;

    var userInput = (_btsTyped || '').toLowerCase().trim();
    var correctEn = (w.en || '').toLowerCase().replace(/ /g, '').trim();
    var isRight = userInput === correctEn;

    // 让原 bossAnswer 走通: 假装"点了第 0 个", _bossCorrectIdx 决定对错
    window._bossCorrectIdx = isRight ? 0 : 1;

    try {
      var slots = document.querySelectorAll('.bts-slot');
      var col = isRight ? '#22c55e' : '#ef4444';
      for(var i = 0; i < slots.length; i++){
        if(!slots[i].classList.contains('space')){
          slots[i].style.borderBottomColor = col;
          slots[i].style.color = col;
          slots[i].classList.remove('boss-answer-result-correct', 'boss-answer-result-wrong');
          slots[i].classList.add(isRight ? 'boss-answer-result-correct' : 'boss-answer-result-wrong');
        }
      }
    } catch(e){}
    var hint = document.getElementById('btsHint');
    if(hint){
      hint.classList.remove('boss-answer-result-correct', 'boss-answer-result-wrong');
      hint.classList.add(isRight ? 'boss-answer-result-correct' : 'boss-answer-result-wrong');
      if(isRight) hint.innerHTML = icon3dCheck(30) + ' <span style="color:#22c55e;font-family:Consolas,monospace;letter-spacing:1px;vertical-align:middle">' + esc(w.en) + '</span>';
      else hint.innerHTML = icon3dCross(30) + ' <span style="color:#ef4444;font-family:Consolas,monospace;letter-spacing:1px;vertical-align:middle">' + esc(w.en) + '</span>';
    }

    // 移除物理键盘 handler
    if(window._btsKeyHandler){ try { document.removeEventListener('keydown', window._btsKeyHandler); } catch(e){} window._btsKeyHandler = null; }

    if(typeof window.bossAnswer === 'function'){ window.bossAnswer(0); }
    setTimeout(function(){ window._hansenTypingSubmitting = false; }, 100);
  }
  window.hansenSubmitTyping = submitTyping;

  // v293: 注入 boss 打字模式紧凑布局 CSS (缩小 boss 图 + 收紧间距, 让 slot+键盘 一屏放下)
  (function injectBtsCss(){
    function doInject(){
      try {
        if(document.getElementById('bts-typing-css')) return;
        var st = document.createElement('style');
        st.id = 'bts-typing-css';
        st.textContent =
          // 🔴 v496 (Hansen 要求): 进 boss 战【藏底部导航条】(主页/错题/宠物/成就) + 去掉 #app 给导航的 90px 留白 + 锁滚动(不出滚动条) → 整屏只给 boss 战。
          'body.hsn-boss-battle{overflow:hidden!important}' +
          'body.hsn-boss-battle .bottom-nav{display:none!important}' +
          'body.hsn-boss-battle .app{padding-bottom:0!important}' +
          'body.hsn-boss-battle #bossScreen{padding-bottom:0!important}' +
          'body.hsn-boss-battle #bossScreen .screen-title{display:none!important}' +  // 🔴 v496: 战斗中隐藏"Boss战"标题, 省~35px 高度给内容
          'body.hsn-boss-noheader .top-bar{display:none!important}' +  // 🔴 v855 (Hansen 要求·修正v854): 进打Boss页【全程】(介绍页/选关/战斗)彻底去掉最上面整条状态栏(头像/等级/打卡天数/💎钻石/🪙金币/经验条/藏宝图)·不只战斗中·不许它先冒出来一下。季节hub宇宙地图(island_season.html·选星域非打Boss)例外保留顶栏。
          'body.hsn-boss-noheader .app{padding-top:0!important}' +
          'body.hsn-boss-noheader .world-map-btn{display:none!important}' +  // 🔴 v857 (Hansen): 打Boss顶部彻底清空·回大地图藏宝图浮标在boss屏整程隐藏(和v855顶栏同口径)  // 🔴 v855: 顶栏去掉后去掉其占位·boss内容自然上移
          '.boss-arena.bts-typing .boss-sprite,.boss-arena.bts-typing .boss-sprite-wrap{width:230px!important;height:230px!important;font-size:230px!important}' +  /* 🔴 v857: 恒定盒230(全题型统一·题型切换零位移·BUG#59口径升级) */
          '.boss-arena.bts-typing .boss-sprite svg{width:230px!important;height:230px!important;transform:scale(.9304)!important;transform-origin:50% 100%!important}' +  /* 🔴 v878(Hansen重大: boss尺寸全题型一致·绝不变化): 打字题立绘视觉214px = 与选择/拼字题完全相同(旧scale.717=165px导致打字时boss变小·Hansen真机发现). 底边锚定. 键盘空间靠下方收紧hero+键盘键高腾出. */
          '#bossScreen .boss-arena.bts-typing .boss-sprite-wrap{margin:34px 0 0!important}' /* 🔴v859: 加#bossScreen压过基座margin68(ID特异性)·拼写布局钉死v857原位盒底268 */ +
          '.boss-arena.bts-typing .boss-q-type{display:none!important}' +
          '.boss-arena.bts-typing .boss-name{font-size:13px;margin:1px 0}' +
          '.boss-arena.bts-typing .boss-hp-bar{margin:2px auto}' +
          '.boss-arena.bts-typing .boss-hp-text{font-size:11px}' +
          '.boss-arena.bts-typing .boss-divider{margin:2px 0}' +
          '.boss-arena.bts-typing .hero-section{margin:1px -11px!important;padding:1px 2px!important}' +  /* v878: 打字题勇者区更扁·省空间给放大立绘 */
          '.boss-arena.bts-typing .boss-msg{display:none}' +
          // 🔴 v496: 打字模式下把顶部三标签(连击/阶段/狂怒)缩小+强制不换行——否则狂怒时"🔥狂怒"标签在窄屏换行多占一行(+18px), 把键盘顶出屏。缩小后三标签一行排得下, 狂怒不再长高。
          '.boss-arena.bts-typing .boss-stats-bar{flex-wrap:nowrap!important;height:24px;overflow:hidden;font-size:10px;margin-bottom:1px}' +
          '.boss-arena.bts-typing .boss-combo,.boss-arena.bts-typing .boss-phase-tag,.boss-arena.bts-typing .boss-rage-tag{padding:2px 6px!important;font-size:10px!important;white-space:nowrap}' +
          '.boss-arena.bts-typing .boss-q-type{margin:2px auto}' +
          '.bts-row{position:relative;display:flex;align-items:center;justify-content:center;margin:2px 0 1px}' +
          '.bts-slots{display:flex;gap:5px;justify-content:center;margin:0}' +
          '.bts-hint-below{text-align:center;font-size:22px;font-weight:900;min-height:12px;margin:2px 0;line-height:1.15}' +  /* v878: 提示区更扁·消除打字题最后超屏 */
          '.bts-slot{min-width:24px;height:32px;padding:0 4px;border-bottom:4px solid #475569;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;text-transform:lowercase;transition:border-color .15s,color .15s}' +
          '.bts-slot.filled{border-bottom-color:#fbbf24;color:#fbbf24}' +
          '.bts-slot.space{border-bottom-color:transparent;min-width:12px}' +
          // v315 修复键盘错位 BUG: boss打字键盘原来复用打字大师的 .keyboard(用100vw+负margin做全屏突破),
          //   但它被放进 .boss-opts(grid + max-width:360px + margin:auto)里, 100vw/calc(-50vw+50%) 算错 → 键盘错位/字母歪斜.
          //   修复: 打字模式时让 #bossOpts 自己全屏突破, 并给 #btsKbd 自包含布局(不再依赖父容器宽度)
          '.boss-arena.bts-typing #bossOpts{display:block!important;max-width:none!important;width:100vw!important;margin-left:calc(-50vw + 50%)!important;margin-right:0!important;grid-template-columns:none!important}' +
          '#btsKbd{--kg:3px;--kw:calc((100vw - 4px - 9*var(--kg)) / 10);width:100vw;max-width:100vw;margin:8px 0 0;background:#d1d5db;padding:6px 2px 8px;box-sizing:border-box}' +  /* v878: 键盘上移+padding收紧·给放大立绘腾空间 */
          '#btsKbd .keyboard-row{display:flex;gap:var(--kg);justify-content:center;margin-bottom:3px}' +
          '#btsKbd .keyboard-row.indent{padding:0}' +
          '#btsKbd .key{flex:0 0 auto;width:var(--kw);height:46px;background:#fff;border:none;border-radius:5px;color:#1c1c1e;font-size:23px;font-weight:500;box-shadow:0 1px 0 rgba(0,0,0,.3);padding:0;text-transform:lowercase}' +  /* v878: 键46(省18px)·配合放大立绘 */
          '#btsKbd .key.delete{width:calc(var(--kw) * 1.5 + var(--kg) * 0.5);background:#aeb3bd;font-size:19px}' +
          '.bts-row,.bts-hint-below{max-width:100vw}' +
          // 🔴 v496: 高屏(如 Hansen 设备 ~730px)把打字立绘从 112px 放大到 140px, 填满空间更好看; 矮屏(<700px)保持 112px 不缩, 保证一屏放下不裁键盘。绝不低于现状 112px (尊重 BUG#58 不缩立绘伤画质)。
          /* v610: 删typing高视口140px覆盖·统一150px(BUG#59) */ '' +
          // 🔴 v496: 仅【极矮屏 ≤659px】(明显小于常见设备)把打字立绘缩到 96px + 键盘键 46px, 保证小屏也一屏放下、键盘整排可见、不出滚动条。常见设备(670px+)不受影响。
          '@media (max-height:729px){#btsKbd .key{height:34px!important;font-size:19px!important}#btsKbd{margin-top:4px!important;padding:4px 2px 5px!important}#btsKbd .keyboard-row{margin-bottom:3px!important}.boss-arena.bts-typing .hero-section{margin:0 -11px!important;padding:0 2px!important}.boss-arena.bts-typing .bts-hint-below{min-height:10px!important;margin:1px 0!important}.boss-arena.bts-typing .boss-hp-bar{margin:1px auto!important}}' + '@media (max-height:679px){#btsKbd .key{height:28px!important;font-size:17px!important}#btsKbd{margin-top:1px!important;padding:2px 2px 3px!important}#btsKbd .keyboard-row{margin-bottom:2px!important}.boss-arena.bts-typing .bts-slot{height:24px!important;font-size:18px!important}.boss-arena.bts-typing .bts-hint-below{min-height:8px!important;margin:0!important}.boss-arena.bts-typing .hero-section{margin:0 -11px!important;padding:0!important}}' +  /* 🔴 v878(Hansen: boss尺寸全题型绝对一致): 矮屏【只压键盘+间距·立绘恒214不缩】——放不下宁可键盘更紧也绝不缩boss(旧v610矮屏立绘还会变·现统一214). 729px键40/679px键34, hero/hint/slot逐级收紧腾键盘空间. */
          // v306: spellPick(6选1)紧凑布局 — 缩小 boss 图 + 收紧间距, 让题目框+6选项一屏放下
          '.boss-arena.bts-compact .boss-sprite,.boss-arena.bts-compact .boss-sprite-wrap{width:230px!important;height:230px!important;font-size:230px!important}' +  /* 🔴 v857: compact死代码也对齐恒定盒(防复活翻车) */
          '.boss-arena.bts-compact .boss-sprite svg{width:230px!important;height:230px!important;transform:scale(.9304)!important;transform-origin:50% 100%!important}' +  /* v878: compact死代码scale也对齐214·防未来激活时boss变小 */
          '#bossScreen .boss-arena.bts-compact .boss-sprite-wrap{margin:34px 0 0!important}' /* 🔴v859: 同上 */ +
          '.boss-arena.bts-compact .boss-name{font-size:14px;margin:1px 0}' +
          '.boss-arena.bts-compact .boss-hp-bar{margin:2px auto}' +
          '.boss-arena.bts-compact .boss-hp-text{font-size:11px}' +
          '.boss-arena.bts-compact .boss-divider{margin:2px 0}' +
          '.boss-arena.bts-compact .hero-section{margin:2px -11px;padding:3px 2px}' +
          '.boss-arena.bts-compact .boss-msg{display:none}' +
          '.boss-arena.bts-compact .boss-q-type{margin:2px auto}';
        (document.head || document.documentElement).appendChild(st);
      } catch(e){}
    }
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doInject);
    else doInject();
  })();
  
  
  // startTimer(seconds, onTimeout): boss 战倒计时引擎
  //   seconds   倒计时秒数 (由 getBossCfg().timeLimit 决定, Lv 越高越短)
  //   onTimeout 时间到的回调 (通常 = 答错扣血)
  // ⚠️ token 三道闸 (v165 修): 切到下一题时 clearTimer() 会自增 timerToken,
  //    每次启动记住 myToken, 触发时校验 myToken === 当前 timerToken,
  //    防止"上一题的倒计时回调"在新题面上误触发 (打字模式尤其容易踩)。
  function startTimer(seconds, onTimeout){
    clearTimer();  // 内部会自增 timerToken
    var myToken = timerToken;  // v165: 记住这次启动的 token, 触发时验证 (token 闸 1)
    var subEl = document.getElementById('bossQSub');
    if(!subEl) return;
    
    var el = document.getElementById('bossTimerEl');
    if(!el){
      el = document.createElement('div');
      el.id = 'bossTimerEl';
      // 容器: 几乎不占空间 (3px 高), 100% 宽, 暗底
      el.style.cssText = 'height:3px;width:100%;max-width:360px;margin:3px auto;background:rgba(15,23,42,0.85);border-radius:2px;overflow:hidden;position:relative;box-shadow:inset 0 0 2px rgba(0,0,0,0.5)';
      // 进度条本身: 右端不断向左缩短
      el.innerHTML = '<div id="bossTimerFill" style="position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:left center;background:linear-gradient(90deg,#22c55e 0%,#fbbf24 50%,#ef4444 100%);box-shadow:0 0 6px rgba(251,191,36,0.5);border-radius:1px"></div>';
      subEl.parentNode.insertBefore(el, subEl.nextSibling);
    }
    el.style.display = 'block';
    
    var fill = document.getElementById('bossTimerFill');
    // 先重置到满 (无 transition)。行内 !important 精准覆盖 reduced-motion 的通配规则。
    fill.style.setProperty('transition', 'none', 'important');
    fill.style.transform = 'scaleX(1)';

    // 强制 reflow, 然后启动线性过渡；transform 由浏览器合成层推进，页面滑动时继续缩短。
    void fill.offsetWidth;
    fill.style.setProperty('transition', 'transform ' + seconds + 's linear', 'important');
    fill.style.transform = 'scaleX(0)';
    
    // 到时间触发 timeout (v165: 验证 token, 防上题 timer 在新题面 fire)
    timerInterval = setTimeout(function(){
      timerInterval = null;
      if(myToken !== timerToken) return;  // 旧 timer, 静默丢弃, 不触发 onTimeout
      // v165 第二道闸: 选项已答 (有 dataset.done) 也不触发
      var bo = document.getElementById('bossOpts');
      if(bo && bo.dataset.done) return;
      if(onTimeout) onTimeout();
    }, seconds * 1000);
  }
  
  // 等 startBoss 等存在
  function init(){

    // 给 SVG 类型的 boss emoji 设尺寸
    if(!document.getElementById('hansenBossCss')){
      var s = document.createElement('style');
      s.id = 'hansenBossCss';
      s.textContent = [
        // ─── v143r: 黄框外壳硬锁 (Hansen 反复反馈头晕, 这次彻底锁死) ───
        // height/min-height/max-height 全部 32px 死锁, font-size 13px 死锁, padding 死锁
        // 子选择器 (.hit/.miss/.crit/.rage/.phase) 只能改 color, 别的全不行
        '#bossScreen #bossMsg{background:linear-gradient(135deg,rgba(251,191,36,.25),rgba(239,68,68,.15)) !important;border:2px solid #fbbf24 !important;padding:5px 14px !important;border-radius:10px !important;width:max-content !important;max-width:calc(100vw - 20px) !important;min-width:48px !important;margin:3px auto !important;min-height:32px !important;box-sizing:border-box !important;display:block !important;color:#fef3c7 !important;font-size:13px !important;font-weight:700 !important;line-height:18px !important;white-space:normal !important;overflow:visible !important;animation:none !important;transform:none !important;transition:color .25s !important;text-align:center !important}',
        // 🔴 BUG#56 (v480): boss 台词框原锁死 max-width:320px + overflow:hidden + text-overflow:ellipsis → 长台词(尤其赛季 boss 星海女帝)被截成"…"。
        //   改: 宽度 width:max-content 随台词长度横向加长(上限 calc(100vw-20px) 不出屏)、overflow:visible 不裁切; 高度仍死锁 32px(永不换两行/不抖动)。
        //   台词包进 .boss-msg-inner, JS fitBossMsg 量内层超出屏宽就给【内层】transform:scale 缩到一行装进屏(短台词不缩)。check_resources 检查19 守卫。
        '#bossScreen #bossMsg .boss-msg-inner{display:inline-block !important;transform-origin:center center !important;white-space:normal !important;line-height:18px !important;vertical-align:middle !important}',
        // .hit/.miss/.crit/.rage 上的 color 仍然有效 (绿/红/金反馈), 仅屏蔽外壳尺寸抖动
        // v143r: 删 .crit/.rage 的 font-size 修改 (它们之前 15/14px 让高度跳 2-3px, Hansen 还能看到)
        '#bossScreen #bossMsg.hit{color:#86efac !important}',
        '#bossScreen #bossMsg.miss{color:#fca5a5 !important}',
        '#bossScreen #bossMsg.crit{color:#fde68a !important}',
        '#bossScreen #bossMsg.rage{color:#fde68a !important}',
        '#bossScreen #bossMsg.phase{color:#fca5a5 !important}',
        // ─── boss-sprite 尺寸 ───
        // boss-sprite 尺寸 (Hansen 要求放大 2/3)
        '.boss-sprite svg{width:230px;height:230px;display:block;margin:0 auto;transform:scale(.9304);transform-origin:50% 100%;transition:transform .45s ease}',  // 🔴 v859 (Hansen: boss更大更高清): 盒230不变·普通scale.9304=视觉214(比190再大13%)·origin底部中心=下方零位移·狂怒scale(1.1217)长到258
        // boss 战 screen 紧凑布局 - 整体上移
        '#bossScreen{padding:4px 12px 14px !important}',
        //🔴BUG#76 //🔴BUG#79 //🔴BUG#80 (Hansen·v632彻底版): boss战可读性遮罩 = 固定全屏层(position:fixed;inset:0), 物理上永远铺满整个视口——不管战斗内容多高、什么手机, 都不可能在下方留空(根治BUG#80横向分割; 替代v630靠 #bossScreen min-height 撑高的不稳做法, 那个在真机上没站住)。仅战斗中(body.hsn-boss-battle = bossActive=true)生效 → 战败/胜利/开始/选关页无此类=无遮罩=不分割(BUG#79)。z-index:0 在影院画布(z-index:-1)之上(压暗亮主题让boss名/题目跳出)、在boss内容(.app是定位元素·其子树整体在::before之上)之下(不挡boss立绘/题目/选项); pointer-events:none 不挡点击。
        'body.hsn-boss-battle::before{content:"" !important;position:fixed !important;inset:0 !important;z-index:0 !important;background:linear-gradient(180deg,rgba(8,11,22,.50) 0%,rgba(8,11,22,.30) 14%,rgba(8,11,22,.28) 34%,rgba(8,11,22,.48) 45%,rgba(8,11,22,.50) 58%,rgba(8,11,22,.60) 72%,rgba(8,11,22,.66) 100%) !important;pointer-events:none !important}',
        //🔴BUG#76: 最吃亏的3处文字加深色描影(提示字并提亮), 用 #bossScreen .x 高优先级覆盖各岛同名 class
        '#bossScreen .boss-name{text-shadow:0 1px 3px rgba(0,0,0,.92),0 0 14px rgba(0,0,0,.7),0 0 20px rgba(239,68,68,.45) !important}',
        '#bossScreen .boss-question{text-shadow:0 1px 3px rgba(0,0,0,.92),0 0 12px rgba(0,0,0,.6),0 0 14px rgba(251,191,36,.35) !important}',
        '#bossScreen .boss-q-sub{color:#eef2f7 !important;font-weight:600 !important;text-shadow:0 1px 3px rgba(0,0,0,.95),0 1px 9px rgba(0,0,0,.7) !important}',
        /* ══════════════════════════════════════════════════════════════════════════
           ⭐ v930 打Boss 题面/HUD 可读性总修
           (Hansen: "打boss做拼写题的时候, 这个中文字颜色根本就看不清楚。我背后用了一个主题,
                     然后这个字他现在根本就看不清楚, 你帮我彻底解决")
           根因: 上面那几条只加了【描影】。描影在【深色 boss 背景】上够用(实测金字 11.55:1),
                 但 boss 的电影主题(HansenCinema 九款: 糖果乐园/云端气球/云端梦境/彩虹甜心…)
                 全是【明亮高饱和的糖果风背景】—— 金字/浅灰字直接【裸压】在这种花哨亮底上,
                 实测暴跌到 2.07~2.93:1(WCAG AA 要 4.5:1)= 根本看不清。描影救不了。
           修法: 给这些【裸字】垫一层【半透明深色底板】—— 和 boss 台词气泡 / 选项卡 / 题型标签
                 完全同一套视觉语言(它们本来就有底板, 所以一直很清楚)。
                 底板不挑背景: 深底/亮底/花底 一律稳读。
           注意: 这是【所有配色统一】的基础样式(不随调色板变), 不违反"打Boss任何配色都不动"的铁律。
           ══════════════════════════════════════════════════════════════════════════ */
        '#bossScreen .boss-name{display:table !important;margin:2px auto !important;color:#f87171 !important;background:rgba(6,10,20,.93) !important;padding:2px 12px !important;border-radius:9px !important;border:1px solid rgba(248,113,113,.35) !important}',
        '#bossScreen .boss-hp-text{display:table !important;margin:1px auto 0 !important;background:rgba(8,12,26,.82) !important;padding:1px 10px !important;border-radius:8px !important}',
        '#bossScreen .boss-q-sub{display:table !important;margin:0 auto 4px !important;background:rgba(8,12,26,.82) !important;padding:3px 12px !important;border-radius:9px !important}',
        '#bossScreen .boss-question{display:table !important;margin:2px auto 1px !important;background:rgba(8,12,26,.86) !important;padding:4px 16px !important;border-radius:11px !important;border:1px solid rgba(251,191,36,.42) !important}',
        '#bossScreen .hero-hp-text{text-shadow:0 1px 3px rgba(0,0,0,.9) !important}',
        //🔴BUG#81(v633·Hansen): boss战败/胜利【结算页】在亮主题(糖果乐园等)下文字发虚看不清 — 战败/胜利页无遮罩(遮罩仅战斗中·见BUG#79/#80), 亮主题直接透上来, 而结算文案("战败…"/"VICTORY!"/"别灰心…"/评分/奖励)是直接浮在主题背景上、无面板衬底→发虚。修复(对齐v629文字可读性思路): .boss-victory 纯色字加深色光晕text-shadow(继承给所有子文字); 渐变标题h2(背景裁剪文字)必须排除继承的text-shadow(否则渐变字会被压黑·v629铁律)改用drop-shadow滤镜。对任何主题都生效(暗主题下光晕几乎不可见·无副作用)。
        '.boss-victory{text-shadow:0 1px 3px rgba(0,0,0,.92),0 1px 2px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.55) !important}',
        '.boss-victory h2{text-shadow:none !important;filter:drop-shadow(0 2px 4px rgba(0,0,0,.88)) drop-shadow(0 0 10px rgba(0,0,0,.5)) !important}',
        //🔴BUG#81(v633·Hansen·统一): 各游戏模式的【结算/通关页】(打地鼠/钓鱼/连连看/听音/打字/完形/拼字/泡泡/老鹰/复习等)文字也直接浮在主题背景上(和 boss 结算同一情况·都是居中纯色字无面板衬底), 亮主题下同样发虚。统一给各模式内容容器加深色光晕(继承给结算页所有文字)。结算注入文字全是纯色(#fbbf24/#fff/#cbd5e1/#22c55e 无渐变)→text-shadow 安全不会变黑。唯一例外: #speedContent 里的 .speed-timer 是渐变裁剪文字→排除继承的 text-shadow 防变黑(它自带 drop-shadow 已够亮)。.screen-title 是容器外的兄弟节点(不在 #xxxContent 内)不受影响; .levelup 升级浮层也不在容器内。
        '#molesContent,#fishContent,#matchContent,#listenContent,#typingContent,#clozeContent,#scrambleContent,#bubbleContent,#eagleContent,#reviewContent,#exploreContent,#speedContent,#petContent,#chestContent{text-shadow:0 1px 3px rgba(0,0,0,.9),0 1px 2px rgba(0,0,0,.8),0 0 8px rgba(0,0,0,.5)}',
        '#speedContent .speed-timer{text-shadow:none !important}',
        '#bossScreen > .back-btn{position:absolute !important;top:8px !important;left:10px !important;width:36px !important;height:36px !important;min-width:0 !important;padding:0 !important;margin:0 !important;border-radius:50% !important;font-size:19px !important;line-height:33px !important;text-align:center !important;background:rgba(15,23,42,.28) !important;border:1.5px solid rgba(255,255,255,.30) !important;color:rgba(255,255,255,.92) !important;box-shadow:0 2px 8px rgba(0,0,0,.22) !important;z-index:9 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}',  // 🔴 v857 (Hansen·推翻v854大胶囊): 返回键改极小半透明圆钮·只一个←箭头·绝对定位脱流(顶部空间全让给boss)·36px保证按得到·背景融合存在感极低·禁backdrop-filter守铁律
        // 隐藏 Boss战 标题 (冗余, 返回按钮+boss名字已表明)
        '#bossScreen > .screen-title{display:none !important}',
        // boss-arena 极致紧凑
        '#bossScreen .boss-arena{padding:0 !important;line-height:1.1}',
        // v151: stats-bar 改成 2 列 grid — 左列=连击, 右列=阶段(上)/狂怒(下), 不再 flex 平分
        // 修复: 狂怒出现时阶段标签被挤到 boss 头顶上的问题
        '#bossScreen .boss-stats-bar{position:absolute !important;top:8px !important;right:10px !important;display:flex !important;flex-direction:column !important;align-items:flex-end !important;gap:6px !important;margin:0 !important;padding:0 !important;z-index:8 !important;width:auto !important}',  // 🔴 v857 (Hansen): 顶部清空·阶段/狂怒改绝对定位右上竖排脱流(留下·Hansen点名保)·顶部空间全让给boss
        '#bossScreen .boss-combo{display:none !important}',  // 🔴 v857 (Hansen): 战斗左上'连击N'徽章不要了(绿色提示框已有连击信息)·只藏不删DOM: template 4183/4246直写textContent+boss_anim读值·删了会崩
        '#bossScreen .boss-arena{position:relative !important}',  // 🔴 v857: stats-bar/返回键绝对定位锚点
        // boss-sprite 周围空间清零
        '#bossScreen .boss-sprite-wrap{width:230px;height:230px;margin:34px 0 0 !important;line-height:0 !important;vertical-align:top}',  // 🔴 v891(Hansen: 所有题型对齐打字题高位·boss整体上移): 选择题margin 68→34与打字题(bts-typing)完全一致→全题型boss/血条/对话框同高度平行。盒底264·狂怒缩到R=1.0(230px)最坏顶边≈26px离天花板安全·彻底锁死不溢出
        '#bossScreen .boss-sprite{width:230px;height:230px;margin:0 !important}',
        '.boss-sprite.boss-rage svg, .boss-arena.bts-typing .boss-sprite.boss-rage svg{transform:scale(1.0) !important}',  // 🔴 v891(Hansen: boss整体上移到打字题高位后·狂怒坚决不溢出天花板·彻底锁死): 狂怒scale 1.1217→1.0=视觉230px(比普通214大7.5%·仍明显变大)·origin底部下方零位移·margin34盒底264→狂怒静止顶边34·最坏叠加(漂浮-3+命中div1.02≈-2.6)顶边≈26px≥安全距离25·绝不溢出屏幕顶
        '.boss-sprite.boss-rage.boss-hit-anim{animation:hansenHitFxRage .35s !important}',  // 🔴 v857: 狂怒态命中缩放上限收紧(230×1.12会瞬间顶进绿框)
        '@keyframes hansenHitFxRage{0%{transform:scale(1);filter:brightness(1)}30%{transform:scale(1.02);filter:brightness(2.2) saturate(1.5)}60%{transform:scale(.99);filter:brightness(1.4)}100%{transform:scale(1);filter:brightness(1)}}',
        'body.hsn-boss-battle .combo-badge{top:6px !important;padding:4px 11px !important;font-size:12px !important}',  // 🔴 v857 (Hansen): 战斗中绿色连击+金币提示框压到最顶(顶部已清空·中央无遮挡)·紧凑不占boss空间
        // boss 信息区紧凑
        '#bossScreen .boss-name{margin:2px auto !important;font-size:15px !important}'   /* v930: 横向 0→auto, 配合 display:table 让底板贴合文字并居中 */,
        '#bossScreen .boss-hp-bar{margin:2px auto !important}',
        '#bossScreen .boss-hp-text{margin:0 auto !important;font-size:11px !important}'   /* v930: 同上 */,
        '#bossScreen .boss-divider{margin:2px 0 !important}',
        // hero 区紧凑
        '#bossScreen .hero-section{padding:5px 2px !important;margin:3px -11px !important}',
        // 答题区放大字号 + 紧凑
        '#bossScreen .boss-q-type{margin-top:4px !important;font-size:11px !important}',
        '#bossScreen .boss-question{font-size:20px !important;margin:4px auto 2px !important;min-height:26px !important;line-height:1.2 !important}',
        '#bossScreen .boss-q-sub{font-size:12px !important;margin:0 auto 4px !important}'   /* v930: 同上 */,
        '#bossScreen .boss-opts{margin-top:2px !important}',
        // ─── 命中特效 (Hansen 反馈: 去掉晃动, 改刀斩/炮轰) ───
        // 覆盖原 boss-hit-anim 的旋转 (晃来晃去看头晕) → 只保留缩放+亮度
        '.boss-sprite.boss-hit-anim{animation:hansenHitFx .35s !important}',
        '@keyframes hansenHitFx{0%{transform:scale(1);filter:brightness(1)}30%{transform:scale(1.12);filter:brightness(2.2) saturate(1.5)}60%{transform:scale(.96);filter:brightness(1.4)}100%{transform:scale(1);filter:brightness(1)}}',
        // 刀斩特效 (普通命中)
        // v148: 忍者刀双刀十字 ╳ 切水果效果 (Hansen 反复细化)
        // 细 (2.5px) + 银白金属感 (#e5e7eb) + 双刀交叉 + 出刀极快 (35ms)
        '.hansen-slash{position:absolute;top:50%;left:50%;width:150px;height:2.5px;background:linear-gradient(90deg,transparent 0%,rgba(229,231,235,0.3) 10%,rgba(229,231,235,0.85) 30%,#fff 50%,rgba(229,231,235,0.85) 70%,rgba(229,231,235,0.3) 90%,transparent 100%);box-shadow:0 0 4px rgba(255,255,255,0.9),0 0 9px rgba(203,213,225,0.4);transform:translate(-50%,-50%) rotate(-28deg) scaleX(0);transform-origin:center center;animation:hansenSlashCut 0.7s ease-out forwards;pointer-events:none;z-index:10;border-radius:2px}',
        // 第二刀: 反方向 +28deg, 延迟 80ms 触发, 形成 ╳ 交叉
        '.hansen-slash.slash-2{animation:hansenSlashCutR 0.7s ease-out 0.08s forwards}',
        // 出刀极快 keyframe: 5% scaleX 1.05 → 12% scaleX 1.0 → 100% 淡出
        '@keyframes hansenSlashCut{0%{opacity:0;transform:translate(-50%,-50%) rotate(-28deg) scaleX(0)}5%{opacity:1;transform:translate(-50%,-50%) rotate(-28deg) scaleX(1.05)}12%{opacity:1;transform:translate(-50%,-50%) rotate(-28deg) scaleX(1)}55%{opacity:0.9;transform:translate(-50%,-50%) rotate(-28deg) scaleX(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(-28deg) scaleX(1)}}',
        '@keyframes hansenSlashCutR{0%{opacity:0;transform:translate(-50%,-50%) rotate(28deg) scaleX(0)}5%{opacity:1;transform:translate(-50%,-50%) rotate(28deg) scaleX(1.05)}12%{opacity:1;transform:translate(-50%,-50%) rotate(28deg) scaleX(1)}55%{opacity:0.9;transform:translate(-50%,-50%) rotate(28deg) scaleX(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(28deg) scaleX(1)}}',
        // 炮轰特效 (连击 5 暴击) - 全屏短暂泛白 + 大字冲击 (overlay 方案, 绝对可见)
        '.hansen-cannon-flash{position:fixed;inset:0;background:radial-gradient(circle at center,rgba(255,255,255,0.85) 0%,rgba(251,191,36,0.4) 25%,rgba(239,68,68,0.2) 50%,transparent 80%);z-index:99998;pointer-events:none;animation:hansenFlash 0.55s ease-out forwards}',
        '@keyframes hansenFlash{0%{opacity:0}15%{opacity:1}55%{opacity:0.7}100%{opacity:0}}',
        '.hansen-cannon-text{position:fixed;top:35%;left:50%;transform:translate(-50%,-50%) scale(0.5);font-size:60px;font-weight:900;color:#fff;text-shadow:0 0 20px #fbbf24,0 0 40px #ef4444,3px 3px 0 #000;z-index:99999;pointer-events:none;animation:hansenCannonText 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards;white-space:nowrap;font-family:Microsoft YaHei,sans-serif}',
        '@keyframes hansenCannonText{0%{transform:translate(-50%,-50%) scale(0);opacity:0}30%{transform:translate(-50%,-50%) scale(1.2);opacity:1}70%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-80%) scale(0.9);opacity:0}}',
        // ─── v144: boss 视觉舒缓化 (Hansen 反馈眼睛累) ───
        // 1) 命中无 brightness 爆闪 — 只保留温和缩放反馈
        '.boss-sprite.boss-hit-anim{animation:hansenHitNoFlash 0.35s ease-out !important;transform-origin:center bottom !important}',
        '@keyframes hansenHitNoFlash{0%{transform:scale(1) translateY(0)}35%{transform:scale(1.08) translateY(-3px)}65%{transform:scale(0.97) translateY(0)}100%{transform:scale(1) translateY(0)}}',
        // 2) boss 上下浮动: 缓慢 (3s→6s, 慢一倍) + 小幅 (10px→3px) + 底部为缩放锚点
        '.boss-sprite, .boss-sprite.boss-float{animation:bossFloatSlow 6s ease-in-out infinite !important;transform-origin:center bottom !important}',
        '@keyframes bossFloatSlow{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1) translateY(-3px)}}',
        // 3) 狂暴模式: 一次性放大 12% 保持 (transform-origin:bottom → 向上扩展, 不挤压下方答题)
        '.boss-sprite.boss-rage{animation:bossRageStatic 6s ease-in-out infinite !important;filter:drop-shadow(0 0 30px #ef4444) drop-shadow(0 0 58px rgba(239,68,68,.5)) hue-rotate(-12deg) !important;transform-origin:center bottom !important}',  // 🔴 v857: 狂怒体积改由svg层scale(1)=230承担·sprite层只留6s慢漂±3px(缓慢非闪·顶38-3=35仍在绿框下)+双层烈焰红光
        '@keyframes bossRageStatic{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1) translateY(-3px)}}',
        // 3b) v158: 终极 boss (Lv20 上古太阳神) 狂暴时 scale 1.30, 视觉更震撼; 红光晕也更强
        '.boss-sprite.boss-rage.boss-rage-final{animation:bossRageFinal 6s ease-in-out infinite !important;filter:drop-shadow(0 0 35px #ef4444) drop-shadow(0 0 18px #fbbf24) hue-rotate(-15deg) saturate(1.15) !important}',
        '@keyframes bossRageFinal{0%,100%{transform:scale(1.30) translateY(0)}50%{transform:scale(1.30) translateY(-4px)}}',
        // 4) v147: 刀痕样式已在上方重写为"原地划开"模式, 此处不再覆盖宽厚
        // 5) 血溅粒子 (切水果时的果汁飞溅效果)
        '.hansen-blood{position:absolute;top:50%;left:50%;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#ef4444 30%,#991b1b 75%);box-shadow:0 0 8px rgba(239,68,68,.85);pointer-events:none;z-index:9}',
        '@keyframes hansenBloodSplat{0%{transform:translate(-50%,-50%) scale(0.4);opacity:1}30%{opacity:1}100%{transform:translate(calc(-50% + var(--bx,40px)),calc(-50% + var(--by,-30px))) scale(0.3);opacity:0}}',
        // v150: 加农炮冲击光环 (10 倍数连击专属) — 从 boss 中心扩散的金色圆环, 像炮弹冲击波
        '.hansen-cannon-ring{position:absolute;top:50%;left:50%;width:30px;height:30px;border-radius:50%;border:3px solid #fbbf24;box-shadow:0 0 18px rgba(251,191,36,0.7),inset 0 0 10px rgba(251,191,36,0.4);transform:translate(-50%,-50%) scale(0);animation:hansenCannonRing 0.7s ease-out forwards;pointer-events:none;z-index:9}',
        '@keyframes hansenCannonRing{0%{transform:translate(-50%,-50%) scale(0);opacity:1;border-width:5px}50%{transform:translate(-50%,-50%) scale(4);opacity:0.7;border-width:2px}100%{transform:translate(-50%,-50%) scale(7);opacity:0;border-width:1px}}',
        // 🔴 BUG #8 修复 (v207→v208): 20 连击 super crit 改为"boss 身上爆炸"特效, 替代旧的全屏 flash 大字
        // 现象: 旧版 20 连击弹出 position:fixed;inset:0 的全屏"⚡超级暴击⚡"大字, 盖住正在做的题, 感觉像跳题
        // 根因+修复: 特效全部画在 boss-sprite-wrap 内部 (中心强光+双层冲击波 ring+25粒子), 不再覆盖全屏
        '@keyframes hansenSuperCoreFlash{0%{transform:scale(0.3);opacity:0}15%{transform:scale(1.2);opacity:1}40%{transform:scale(1.5);opacity:0.85}100%{transform:scale(1.8);opacity:0}}',
        '@keyframes hansenSuperRing{0%{transform:scale(0);opacity:1;border-width:5px}40%{transform:scale(3.5);opacity:0.85;border-width:3px}100%{transform:scale(6);opacity:0;border-width:1px}}',
        '@keyframes hansenSuperRing2{0%{transform:scale(0.4);opacity:0;border-width:4px}30%{transform:scale(2.8);opacity:0.8;border-width:2px}100%{transform:scale(5.5);opacity:0;border-width:1px}}',
        // ─── v146: 升级 banner 不再弹晃 (Hansen 反馈头晕) ───
        // 原 lvlIn keyframes: scale .3 → 1.2 → 1 (弹性反弹, 晃眼)
        // 改为纯淡入淡出, 尺寸全程 1, 不再缩放
        '.levelup{animation:hansenLevelUpFade 2s ease-out forwards !important}',
        '@keyframes hansenLevelUpFade{0%{opacity:0;transform:translate(-50%,-50%) scale(1)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-75%) scale(1)}}',
        // 同样把全屏 flash (.flash-screen 闪一下背景) 也舒缓化 — 仅 80% 透明度峰值, 不再剧烈闪
        '.flash-screen{animation:hansenSoftFlash 0.5s ease-out !important}',
        '@keyframes hansenSoftFlash{0%{background:rgba(34,197,94,0.08)}100%{background:transparent}}',
        // ─── v149: 升级 confetti 烟花碎片不再旋转 720° (Hansen 反馈头晕) ───
        // 原 cFall: translateY(0) rotate(0) → translateY(100vh) rotate(720deg) — 两圈旋转令人晕
        // 新: 只 translateY 下落, 完全不旋转, 安静飘落
        '.confetti{animation:hansenConfettiFall 1.8s ease-out forwards !important}',
        '@keyframes hansenConfettiFall{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(100vh)}}',
        // v152: 双保险 — 直接同名覆盖原 cFall 和 lvlIn (后定义优先), 即使有未捕获的元素调用也无旋转/弹跳
        '@keyframes cFall{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(100vh)}}',
        '@keyframes lvlIn{0%{opacity:0;transform:translate(-50%,-50%) scale(1)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}',
        // 也覆盖 popIn / rewardPop / bubblePop 等"弹出类"动画, 改成纯淡入
        '@keyframes popIn{from{opacity:0;transform:scale(1)}to{opacity:1;transform:scale(1)}}',
        '@keyframes rewardPop{from{opacity:0;transform:scale(1)}to{opacity:1;transform:scale(1)}}',
        // ─── v143w: 全局禁用屏幕晃动 (Hansen 反馈头晕) ───
        // 屏蔽 .shake-screen (整屏抖) + .shake (按钮抖) + chestShake (宝箱抖)
        // 仍保留: 答错颜色变红 / 答对颜色变绿 (颜色变化不头晕)
        'body.shake-screen, .shake-screen{animation:none !important;transform:none !important}',
        '.boss-opt.wrong, .cloze-opt.wrong, .typing-slot.wrong, .scramble-word.shake-screen{animation:none !important;transform:none !important}',
        '.chest-box.shake{animation:none !important;transform:none !important}',
        // 全局兜底: 任何 element 含 shake 类名都不抖
        '[class*="shake"]{animation:none !important;transform:none !important}',
        // 把 keyframes 本体也降级到无效, 双保险
        '@keyframes shk{0%,100%{transform:none}}',
        '@keyframes shake{0%,100%{transform:none}}',
        '@keyframes chestShake{0%,100%{transform:none}}',
        // ─── 🔴 v573: 藏宝图去框直贴版 (Hansen 验收反馈: 金属框太丑直接去掉) — 60px 图标贴 66px 顶栏, 凹坑按压在岛内 :active 实现 ───
        // 金光呼吸改挂 .wmb-img 的 drop-shadow(wmbGlowD, 贴图形轮廓无矩形感); 按钮本体仅保留 worldMapFloat 轻浮动
        '.world-map-btn{position:fixed !important;top:calc(env(safe-area-inset-top,0px) + 2px) !important;right:max(6px,env(safe-area-inset-right,0px)) !important;width:58px !important;height:58px !important;border-radius:16px !important;border:none !important;background:transparent !important;padding:0 !important;box-shadow:none !important;animation:worldMapFloat 3.5s ease-in-out infinite !important;z-index:101 !important;filter:none !important}',
        '.world-map-btn:active{transform:translateY(2px) scale(.97) !important;animation:none !important}',
        // 弹窗打开时仍然隐藏地图按钮 (避免和 ✕ 重叠) — 覆盖原版 transform: scale(.4) 残留
        'body.modal-open .world-map-btn{opacity:0 !important;pointer-events:none !important;transform:none !important;animation:none !important}',
        // 🔴 v573: 顶栏压回原高度(上下 10px → 约66px, 比 v571 的 70px 更矮) + 给 60px 按钮腾右侧 74px
        '.top-bar{padding:calc(10px + env(safe-area-inset-top,0px)) calc(70px + env(safe-area-inset-right,0px)) 10px max(14px,env(safe-area-inset-left,0px)) !important;gap:6px !important}',
        // 🔴 v573: 头像 46→42 — 顶栏地板降到约62px(比 v571 的 70px 更矮), 同时给名字行释放 4px 横向空间
        '.avatar{width:42px !important;height:42px !important}',
        // 顶部内容紧凑化, 缩小一些让出空间, 包括 XP 条/数字/钻石金币 badge
        '.top-stats{gap:3px !important}',
        '.stat-row{gap:4px !important}',
        '.stat-badge{padding:2px 5px !important;font-size:11px !important}',
        '.xp-bar{height:6px !important;margin-top:3px !important}',
        '.top-name{font-size:12px !important}',
        '.xp-text{font-size:10px !important;margin-top:1px !important}'
      ].join('');
      document.head.appendChild(s);
    }
    
    // v143w: 在 boss screen 加载时直接禁用 shake 类的添加 (兜底拦截)
    // 拦截 body.classList.add('shake-screen') — 让它直接无效化
    if(!window.__hbuShakeBlocked__){
      window.__hbuShakeBlocked__ = true;
      var origAdd = DOMTokenList.prototype.add;
      DOMTokenList.prototype.add = function(){
        var blockedClasses = ['shake-screen', 'shake'];
        var args = [];
        for(var i = 0; i < arguments.length; i++){
          if(blockedClasses.indexOf(arguments[i]) === -1) args.push(arguments[i]);
        }
        return origAdd.apply(this, args);
      };
    }
    
    if(typeof window.startBoss === 'undefined' || typeof window.bossAnswer === 'undefined'){
      setTimeout(init, 100);
      return;
    }
    
    var origStartBoss = window.startBoss;
    var origBossAnswer = window.bossAnswer;
    var origStopBoss = window.stopBoss;
    var origNextBossQ = window.nextBossQ;  // v143p
    var origTriggerBossRage = window.triggerBossRage;  // v158
    
    // v158: Lv20 终极 boss 狂暴时 scale 1.30 (其他 boss 默认 1.12)
    if(typeof origTriggerBossRage === 'function'){
      window.triggerBossRage = function(){
        var ret = origTriggerBossRage.apply(this, arguments);
        var level = (window.S && window.S.level) || 0;
        if(level >= 20){
          // 多次尝试 (origTriggerBossRage 可能延迟给 sprite 加 boss-rage 类)
          var tries = 0;
          var ensureFinal = function(){
            var sp = document.getElementById('bossSprite');
            if(sp && sp.classList.contains('boss-rage')){
              sp.classList.add('boss-rage-final');
              return;
            }
            tries++;
            if(tries < 20) setTimeout(ensureFinal, 100);
          };
          ensureFinal();
        }
        return ret;
      };
    }
    
    window.startBoss = function(){
      var cfg = getBossCfg();
      isStartingBoss = true;  // 标记: 第一题 nextBossQ 走 quote 分支
      // 🔴 BUG#62 修复 (v490) 第①层 —— 开场先把【跨场状态】清成干净起点(一处兜全部入口, 同 BUG#61 思路)。
      //   根因背景: 复仇/重战入口 hansenStartRebattle【不走 stopBoss】(打完→返回选关→点别的 boss 同样不走),
      //   而 lastNextBossQAt / window._bossQType / bossSessionToken 这些跨场状态【只有 stopBoss 会清】。
      //   于是上一场遗留可能让本场第一题 nextBossQ 走偏:
      //     · lastNextBossQAt 残留 → 快速复仇时本场第一题撞 800ms 去重锁(BUG#14)被静默忽略 → 题不出;
      //     · _bossQType 残留 + 某延迟回调清空 bossOpts 后 → 撞 dataset.done==''&&_bossQType 闸门(BUG#16)被挡 → 题不出;
      //     · 上一场延迟胜负/延迟 nextBossQ 的 setTimeout 未失效 → 回来踩本场状态。
      //   修法: 每次 startBoss 开场无条件清干净, 不依赖调用方是否走过 stopBoss。第一题必走通。
      bossSessionToken++;            // 作废上一场任何延迟胜负 / 延迟 nextBossQ 的 setTimeout
      try { lastNextBossQAt = 0; } catch(e){}   // 解除 800ms 去重锁, 本场第一题不被拦
      window._bossQType = null;      // 清残留题型, 不触发 BUG#16 phase 二次触发误拦
      // 🔴 BUG#61 修复 (v489): 钉死"要打哪个 boss"——任何入口调 startBoss 都不得跳到与上下文无关 / 未解锁的 boss。
      //   根因: 原版 startBoss 用 bossCurrent = BOSSES[S.level-1], 按【玩家XP等级 S.level】选 boss。
      //   ① 复仇胜利/战败页的原生按钮 onclick="startBoss()" 在被 hansen_cards 改写成 hansenStartRebattle 之前的窗口里
      //      (或极速狂点时)会直接触发原版 startBoss → 按 XP 选到一个与正在复仇的 boss 无关、甚至【未解锁】的高级 boss
      //      (实测: 复仇 Lv11 龙骑士 + 玩家XP15 → 跳到 BOSSES[14] 烈焰魔神 Lv15, 完全绕过 hansenStartRebattle 的解锁校验)。
      //   ② "选其他 boss"/返回时短暂露出的"开始挑战"按钮也是 startBoss(), 同样会按 XP 跳关。
      //   修法(一处兜全部入口): 进 origStartBoss 前确定目标关 = 复仇关(_hansenRebattleLv)否则玩家XP等级,
      //      再【夹进解锁上限内】(绝不超过已解锁最高关 bossUnlocked), 临时钉到 S.level 让原版选对 boss, 调完即还原。
      var _S61 = window.S, _restoreLv61 = null;
      if(_S61 && typeof _S61.level === 'number'){
        var _tgt61 = (window._hansenRebattleLv != null && window._hansenRebattleLv >= 1)
                       ? (window._hansenRebattleLv | 0)
                       : (_S61.level | 0);
        var _cap61 = 20;
        try {
          if(window.HansenBossProgress && typeof window.HansenBossProgress.getUnlockedBossLv === 'function'){
            _cap61 = window.HansenBossProgress.getUnlockedBossLv() | 0;
          } else if(typeof _S61.bossUnlocked === 'number'){
            _cap61 = _S61.bossUnlocked | 0;
          }
        } catch(e){ _cap61 = 20; }
        if(!_cap61 || _cap61 < 1) _cap61 = 1;
        _tgt61 = Math.max(1, Math.min(_tgt61, _cap61, 20));   // 夹到 [1, 解锁上限]
        if(_S61.level !== _tgt61){ _restoreLv61 = _S61.level; _S61.level = _tgt61; }
      }
      try {
        origStartBoss.apply(this, arguments);
      } finally {
        if(_restoreLv61 != null && _S61){ _S61.level = _restoreLv61; }   // 还原玩家真实 XP 等级, 绝不污染进度
      }
      // 🔴 v498 (BUG#66 修复): 战斗真正开始(bossActive=true)→加 hsn-boss-battle 类, 触发锁滚动+藏底部导航+打字一屏布局。
      //   关键教训: 这个类【绝不】能绑在 showScreen('boss') 上(v496 旧做法 hsn-boss-noheader 就是这么绑的)——
      //   因为 boss 屏【既是选 boss 列表页、又是打 boss 战斗页】, 绑 showScreen 会把【选 boss 列表】一起锁死,
      //   导致列表滑不动、够不到屏幕外下面的 boss(Lv10+)→无法进入(BUG#66 Hansen 实测重大 bug)。
      //   修法: 只在 startBoss(战斗激活·bossActive=true)加; 选 boss 列表(bossActive=false)不加→列表恢复正常上下滚动。
      //   移除: showScreen(离开/重回列表)+ 看门狗(胜负/停止时 bossActive=false)双重负责。
      try{ document.body.classList.add('hsn-boss-battle'); }catch(e){}
      
      // v143r 双保险: 装 MutationObserver, 任何代码给 #bossMsg 设了 inline style 立即清掉
      // 让 CSS !important 重新接管. 这样即使有未知 path 改了 inline style 也不会破坏锁定.
      var msg = document.getElementById('bossMsg');
      if(msg){
        if(msg.getAttribute('style')) msg.removeAttribute('style');
        if(window.MutationObserver && !msg.__hbu_obs){
          var obs = new MutationObserver(function(){
            if(msg.getAttribute('style')){
              msg.removeAttribute('style');
            }
          });
          obs.observe(msg, {attributes: true, attributeFilter: ['style']});
          msg.__hbu_obs = obs;
        }
        // 🔴 BUG#56 (v480): 内容观察器 —— 任何代码(含各岛直接设 bossMsg.innerHTML 的伤害台词, 如 '💥 '+长台词)改了内容,
        //   都自动 fitBossMsg 包内层+超屏缩放(微任务里先于绘制执行, 无闪烁)。只看 childList/字符变化, 缩内层不触发它(不死循环)。
        if(window.MutationObserver && !msg.__hbu_cobs){
          var cobs = new MutationObserver(function(){ fitBossMsg(); });
          cobs.observe(msg, {childList: true, subtree: true, characterData: true});
          msg.__hbu_cobs = cobs;
          fitBossMsg();
        }
      }
      
      // 立即显示 quote 开场白 (origStartBoss 内 setTimeout(nextBossQ,400), 那 400ms 黄框先显示 quote)
      var b = _r('bossCurrent');
      if(b){
        var quote = BOSS_QUOTES[b.name] || ('🎯 ' + cfg.intro);
        setBossMsg('💬 ' + quote);
      }
      
      // v143p: polling 简化为仅检测 boss 战结束 (timer 启动改在 nextBossQ hook 内)
      if(pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(function(){
        var content = document.getElementById('bossContent');
        if(content && (content.innerHTML.indexOf('boss-victory') >= 0 || content.innerHTML.indexOf('开始挑战') >= 0)){
          clearInterval(pollInterval); pollInterval = null;
          hideTimer();
        }
      }, 200);
      
      // 🔴 BUG#62 修复 (v490) 第②层 —— "boss 题目区空白卡死"看门狗(保证永不卡空白, 是本 bug 的兜底护栏)。
      //   真根因: 开场第一题只靠岛内一发 setTimeout(nextBossQ,400)【零重试】。这一发一旦失效, 第一题永不出,
      //   boss 立绘/血条/台词都在但题目区整片空白、玩家永久卡死(实测 Hansen"后台点击再次复仇"即此)。
      //   失效诱因: (a) 页面切后台 → 该 setTimeout 被浏览器节流/冻结而丢失(最常见生产触发);
      //             (b) 与上一场遗留延迟回调/800ms 锁相撞被静默忽略。
      //   护栏: 周期(每 1200ms)+ visibilitychange(回前台即查)检测"卡空白"——还在战斗(bossActive) &&
      //     boss 屏激活 && 不在胜利/战败/挑战页 && #bossOpts 无任何 .boss-opt 且无打字输入 && #bossQ 空 →
      //     再等 250ms 复查仍空 → 解锁闸门(lastNextBossQAt=0; _bossQType=null)后强制 nextBossQ() 恢复出题。
      //   安全性: 正常答题 / phase / rage 期间 bossOpts 始终保留(已答)选项不为空 → 看门狗不误扰;
      //     仅 rage 结尾同步 innerHTML='' 后立刻重渲染的瞬间会短暂为空, 250ms 二次确认规避之; 800ms 锁防双渲染。
      if(_bossQWdInterval){ clearInterval(_bossQWdInterval); _bossQWdInterval = null; }
      _bossQWdInterval = setInterval(ensureBossQuestion, 1200);
      if(!window.__hbuVisWd){
        window.__hbuVisWd = true;
        try {
          document.addEventListener('visibilitychange', function(){
            // 回到前台立即补查(后台节流丢了开场/下一题定时器的核心补救)
            if(document.visibilityState === 'visible'){
              setTimeout(ensureBossQuestion, 60);
              setTimeout(ensureBossQuestion, 500);
            }
          });
        } catch(e){}
      }
    };
    
    // 🔴 BUG#62 (v490) / 加强 (v491): 看门狗核心 —— 检测"还在战斗却卡死(题目区空白 / 卡在已答题)"并强制恢复出题。
    // 是否有【一道还没答的活题】在显示(打字输入框, 或有选项且尚未答 dataset.done 为空)——有则一切正常(含玩家慢慢想), 看门狗不动。
    function _bossQWdHasLiveQ(){
      var bo = document.getElementById('bossOpts');
      if(bo){
        if(bo.querySelector('input, textarea')) return true;                 // boss 区内输入框(当前 boss 全是选择题·无打字, 防御性保留)
        // ⚠️ 不可全文档搜 .typing-slots: 打字小游戏退出后 #typingContent 里的 .typing-slots 会残留(stopTyping 不清空),
        //    全文档搜会把它误判成"有活题"→ 玩家"先玩打字练习再打 boss"时看门狗整个失灵(v490 隐藏坑, v491 修正)。boss 题只看 .boss-opt。
        if(bo.querySelectorAll('.boss-opt').length >= 1 && bo.dataset && !bo.dataset.done) return true; // 有选项且未答 = 活题
      }
      return false;
    }
    // 是否显示着一道【已答】的题(有选项但 dataset.done 真值)—— 正常它会在 1.5-2s 内被下一题替换。
    function _bossQWdAnsweredShowing(){
      var bo = document.getElementById('bossOpts');
      return !!(bo && bo.dataset && bo.dataset.done && bo.querySelectorAll('.boss-opt').length >= 1);
    }
    function _bossQWdOnEndPage(){
      var c = document.getElementById('bossContent');
      if(!c) return false;
      var h = c.innerHTML;
      return h.indexOf('boss-victory') >= 0 || h.indexOf('boss-defeat') >= 0 || h.indexOf('开始挑战') >= 0;
    }
    function _bossQWdStuck(){
      // 🔴 BUG#71 修复 (v605): 阶段/狂怒过渡期豁免看门狗 — enterNewPhase(1.5s)+triggerBossRage(2s)连续过渡共 3.5s, 恰撞下方"已答题显示"3500ms 阈值; 过渡期 island 会设 window._bossTransUntil(阶段+2200/狂怒+2700, 连续触发无缝覆盖), 看门狗在此窗口内一律不救场——否则误判卡死强制 nextBossQ, 与狂怒定时器到点的 nextBossQ 双双出题 → 当前题被冲掉 + 选项空窗 + 跳题(Hansen 实拍: 青蛙题选项不加载然后跳过)。过渡结束(窗口过)看门狗恢复正常监控, 真卡死仍能救。
      try{ if(window._bossTransUntil && Date.now() < window._bossTransUntil) return false; }catch(e){}
      if(_r('bossActive') !== true) return false;            // 不在战斗
      var s = document.getElementById('bossScreen');
      if(!(s && s.classList.contains('active'))) return false; // 不在 boss 屏
      if(_bossQWdOnEndPage()) return false;                  // 在胜利/战败/挑战页
      if(_bossQWdHasLiveQ()) return false;                   // 有未答活题 → 正常(含玩家慢慢想, 绝不误判)
      // 到这: 没有"未答的活题"。两类卡死都要救:
      // (1) 卡在【已答的题】上不动 —— 答完后下一题的 setTimeout(1500/2000ms)被后台节流丢了永远不来
      //     (也含"答了致命一击但胜利页没弹出": 届时强制 nextBossQ 会看到 bossHP<=0 直接走胜利, 同样救活)。
      //     用【答题时刻】算超时, 阈值 3500ms 远超原版最长 2000ms 延迟+phase/rage, 不会撞正常答题间隙。
      if(_bossQWdAnsweredShowing()){
        if(_lastAnswerAt && (Date.now() - _lastAnswerAt) > 3500) return true;
        return false;                                        // 还在正常的"答完→下一题"间隙
      }
      // (2) 🔴 BUG#63 修复 (v600): 选项区无任何可点选项 → 玩家无法答题 = 卡死, 必救。
      //   原逻辑"题干非空(qLen>0)就当渲染过渡中不救"会漏掉关键死锁: triggerBossRage 清空了 bossOpts 选项
      //   但题干(bossQ)还残留着(cloze/listen 题干很长), nextBossQ 又被 800ms 去重锁拦掉没补题 →
      //   题干在、选项空、永久卡死, 而旧看门狗因"题干非空"放过它 → 玩家彻底卡住无法过关。
      //   改判据: 不看题干, 只看"有没有可点选项"。无 .boss-opt = 无法答题 = 必救(配合 250ms 二次确认排除同步过渡瞬间)。
      var _boWd = document.getElementById('bossOpts');
      if(_boWd && _boWd.querySelectorAll('.boss-opt').length > 0) return false; // 有可点选项 = 正常(渲染过渡 或 玩家在看题)
      return true;                                           // 选项区无任何可点选项 → 还在战斗但卡死, 强制补题
    }
    function ensureBossQuestion(){
      if(!_bossQWdStuck()) return;
      // 二次确认: 250ms 后仍空才强制(规避 rage 结尾同步清空→重渲染的瞬间, 及任何渲染中的过渡态)
      setTimeout(function(){
        if(!_bossQWdStuck()) return;
        try { lastNextBossQAt = 0; } catch(e){}   // 解锁 800ms 去重锁, 强制出题不被拦
        window._bossQType = null;                  // 清残留题型, 不触发 BUG#16 闸门
        try { console.warn('[HBU] 🔴 BUG#62 看门狗: 检测到 boss 题目区空白卡死, 强制恢复出题'); } catch(e){}
        if(typeof window.nextBossQ === 'function'){
          try { window.nextBossQ(); } catch(e){ try { console.warn('[HBU] BUG#62 看门狗恢复失败:', e); } catch(_e){} }
        }
      }, 250);
    }
    if(typeof origNextBossQ === 'function'){
      // 🔴 BUG #14 修复 (v236): 防 nextBossQ 重复触发覆盖题面
      // 根因: 原版 island 代码里有 4 处 setTimeout(nextBossQ, 1500/2000) 调用 — 答题后/phase切换/rage触发
      // 高 Lv boss 中, 一次答题可能同时触发 [答对延迟] + [phase 切换延迟] + [rage 触发延迟] 多个 setTimeout
      // 多个 setTimeout 先后 fire, 第一个渲染题面后, 后到的会无情覆盖! Hansen 看到的"题刚出就被换"就是这个.
      // 修复: 800ms 去重锁 (lastNextBossQAt 在外层声明)
      window.nextBossQ = function(){
        // v168: 如果用户已切走 boss 战屏幕, 完全跳过 (防 stopBoss 后还在跑的 setTimeout 回来踩状态)
        var bossScr = document.getElementById('bossScreen');
        if(!bossScr || !bossScr.classList.contains('active')){
          return;
        }
        
        // 🛡️ BUG #14: 800ms 去重锁 — 上次调用 < 800ms 内的重复触发, 静默忽略
        // 保证一道题至少能稳定显示 800ms, 不会被瞬间覆盖
        var now = Date.now();
        if(now - lastNextBossQAt < 800){
          // 🔴 BUG#63 修复 (v600): 去重锁不能拦"选项已被清空"的补题调用。
          //   死锁链(Hansen 报"boss快死时最后一题卡住"): 玩家答对一题同时跨过 phase 阈值(66/33)+rage 阈值(50)时,
          //   triggerBossRage 的延迟 setTimeout 会先 bossOpts.innerHTML='' 清空选项再 nextBossQ; 若此前 800ms 内
          //   刚有过一次 nextBossQ(出过题, lastNextBossQAt 很近), 这次"清空+补题"的 nextBossQ 就被 800ms 去重锁拦掉,
          //   结果: 选项被清空了但新题没出 → 题干残留+选项空+dataset.done='' → 永久卡死, 玩家无法答题过关。
          //   修复: 锁只在"选项还在"(正常防覆盖)时生效; 一旦选项已空(被某延迟回调清掉), 必须放行补题。
          var _boLk = document.getElementById('bossOpts');
          if(_boLk && _boLk.querySelectorAll('.boss-opt').length > 0){
            return;  // 选项还在 = 正常的重复触发, 锁住防一道题刚出就被覆盖
          }
          // 选项已被清空(optN=0) → 不锁, 放行继续往下出题, 补回被清掉的题面
        }
        
        // 🔴 BUG #16 修复 (v242): 真正根因 — triggerBossRage 和 enterNewPhase 内部都有
        //   setTimeout(2000ms 或 1500ms, function(){ bossOpts.innerHTML=''; nextBossQ(); })
        //   这些 setTimeout 间隔 > 800ms, 绕过 v236 的 800ms 时间去重锁.
        //   结果: 当用户跨过 phase/rage 阈值时, 第一次 nextBossQ 渲染了打字题, 但 1.5-2 秒后
        //   triggerBossRage/enterNewPhase 的 setTimeout 又被 fire 一次, 它会清空 innerHTML 再切下一题!
        //   现象: 打字题刚出现就消失 + 没扣分没判错 (因为根本没走 bossAnswer/submitTyping).
        // 
        // 修复策略: 不再用时间间隔, 改用 "题面是否已被答" 来判断
        //   如果 bossOpts.dataset.done 是空 (没人答过), 且当前有题面在显示 (题型已设置),
        //   说明上一题还没人答, 不应该被切走. 直接 return.
        var boCheck = document.getElementById('bossOpts');
        if(boCheck && boCheck.dataset && boCheck.dataset.done === '' && window._bossQType){
          // 上一题已经渲染了 (有 _bossQType), 但还没人答 (dataset.done 是空字符串)
          // 这是 triggerBossRage/enterNewPhase 的二次触发, 直接忽略
          return;
        }
        lastNextBossQAt = now;
        
        // v165 三道闸第三道: nextBossQ 最一开始, 强制清掉上一题任何残留 timer
        clearTimer();
        
        // v167: 重置题型标记, 防上一题 (尤其 typing) 的 _bossQType 残留导致 timer 超时分支走错
        window._bossQType = null;
        
        // v159 修 bug 1: 清掉上一题的 inline style 残留 (句子翻译/打字模式留下的单列/block 布局)
        // 让 CSS 默认 2 列 grid 重新接管, 由 applyXxx 函数按需重设
        var boReset = document.getElementById('bossOpts');
        if(boReset){
          boReset.style.gridTemplateColumns = '';
          boReset.style.gap = '';
          boReset.style.display = '';
        }
        
        // 🔴 BUG #18 修复 (v249): 真正彻底根除"打字题闪一下消失"
        // 
        // 根因 (比 BUG #16 更深一层): 原版 nextBossQ 内部, 如果检测到 phase 切换 (33%/66%)
        //   或 rage 触发 (50%), 会调 enterNewPhase()/triggerBossRage() 然后 return (不出题).
        //   这俩函数内部各有一个 setTimeout (1.5s/2s 后) 会"清空 bossOpts.innerHTML + 再 nextBossQ".
        //   原版的设计意图: phase/rage 切换时, 先放动画, 等 1.5-2 秒再出下一题.
        //
        //   但是! 我的 hook 在 origNextBossQ.apply() 之后【无条件】执行 applyChapterMode() 出题.
        //   于是: origNextBossQ 因 rage 切换 return 了 (没出题), 但我的 hook 抢先渲染了打字题!
        //   2 秒后 triggerBossRage 的 setTimeout fire → bossOpts.innerHTML='' → 打字题被清空!
        //   → 现象: 打字题刚出现就消失, 没扣分没判错 (因为根本没人答, 是被 innerHTML='' 抹掉的).
        //
        //   v242 的"题面状态锁"只拦了那个延迟的 nextBossQ, 但【拦不住 innerHTML='' 清空动作】.
        //   所以打字题还是被清空了 → bug 没根除.
        //
        // 修复: 记录 origNextBossQ 调用【前后】的 bossPhase / bossRageMode.
        //   如果调用后发生了 phase 切换或 rage 触发, 说明原版进了"延迟出题"分支, 自己 return 没出题,
        //   那我的 hook 就【不要】抢先出题 — 让原版的延迟 setTimeout 去出下一题.
        //
        // 防御: _r('bossPhase') 万一读不到 (返回 undefined), 用 bossHP 百分比自己算 phase 兜底.
        function calcPhase(){
          var p = _r('bossPhase');
          if(typeof p === 'number') return p;
          // 兜底: 用 HP 百分比算 (和原版 nextBossQ 行 3529-3531 同逻辑)
          var bhp = _r('bossHP'), bmax = _r('bossMaxHP');
          if(typeof bhp === 'number' && typeof bmax === 'number' && bmax > 0){
            var pct = bhp / bmax;
            if(pct <= 0.33) return 3;
            if(pct <= 0.66) return 2;
            return 1;
          }
          return 1;  // 实在读不到, 当 phase 1 (不会误拦)
        }
        var phaseBefore = calcPhase();
        var rageBefore = _r('bossRageMode') === true;
        
        origNextBossQ.apply(this, arguments);
        
        var phaseAfter = calcPhase();
        var rageAfter = _r('bossRageMode') === true;
        var justSwitchedPhaseOrRage = (phaseAfter !== phaseBefore) || (rageAfter && !rageBefore);
        
        if(justSwitchedPhaseOrRage){
          // 原版进了 phase/rage 切换分支, 自己 return 没出题, 会在 1.5-2 秒后用延迟 setTimeout 出题.
          // 我们【不抢先出题】, 直接返回. 等那个延迟 setTimeout 再次调 nextBossQ 时, 
          // phaseAfter === phaseBefore 了 (已经切换完), 就会正常走出题流程.
          // 注意: 此时也不启动 timer (没题目可计时)
          return;
        }
        
        // ⭐ v154: 章节难度梯度 — 按 S.level 决定是否替换为新模式
        try { applyChapterMode(); } catch(e){ console.warn('[HBU] chapter mode failed:', e); }
        
        var b = _r('bossCurrent');
        if(!b) return;
        var cfg = getBossCfg();
        
        // 原版 nextBossQ 末尾已经把 bossMsg.textContent 清空了, 我们同步填回去
        if(isStartingBoss){
          var quote = BOSS_QUOTES[b.name] || ('🎯 ' + cfg.intro);
          setBossMsg('💬 ' + quote);
          // v143x: 把 quote 也记入 lastTaunt, 这样 3 秒内不会立刻换 taunt
          resetTauntThrottle('💬 ' + quote);
          isStartingBoss = false;
        } else {
          // v143x: 走 3 秒门控. 距上次 < 3s, 重用上一句 (黄框不空); >= 3s 才换新
          var display = getThrottledTaunt(b);
          if(display) setBossMsg(display);
        }
        
        // 启动倒计时
        if(cfg.timeLimit > 0){
          // 🔴 BUG #12 修复 (v234): 之前只 typing 模式有宽限时间, 其他 3 种新题型 (sentTrans 句子翻译,
          // spellFill 填字母, spellPick 选字母) 都用默认 cfg.timeLimit. Lv20 cfg.timeLimit = 8s, 
          // 句子翻译要读 4 个长英文句子 8 秒根本不够 → 题刚出现就被判超时自动跳到下一题, 玩家完全没法应对.
          // 修复: 按"题型实际需要的认知负载"分级给时间.
          var actualLimit = cfg.timeLimit;
          var lv = (window.S && window.S.level) || 17;
          if(window._bossQType === 'typing'){
            // 打字模式: 需要逐字手打英文单词, 给最长时间
            // v332: Hansen 反馈最后四关打字题偏紧(长词如 grandmother/watermelon 手机上打不完), 各加 2 秒
            var typingMap = {17: 18, 18: 16, 19: 14, 20: 12};  // v234: Lv20 8→10; v332: 17-20 各 +2 → 18/16/14/12
            actualLimit = typingMap[lv] || cfg.timeLimit;
          } else if(window._bossQType === 'sentTrans'){
            // 句子翻译: 要读 4 个英文长句, 给充足时间
            var sentMap = {13: 22, 14: 20, 15: 18, 16: 17, 17: 16, 18: 15, 19: 14, 20: 13};
            actualLimit = Math.max(cfg.timeLimit, sentMap[lv] || cfg.timeLimit);
          } else if(window._bossQType === 'spellFill' || window._bossQType === 'spellPick'){
            // 填字母/选字母: 要看清单词位置, 给适度宽限
            var spellMap = {17: 14, 18: 13, 19: 12, 20: 11};
            actualLimit = Math.max(cfg.timeLimit, spellMap[lv] || cfg.timeLimit);
          }
          startTimer(actualLimit, function(){
            var opts = document.getElementById('bossOpts');
            if(opts && opts.dataset.done) return;
            
            // v159 修 bug 2: 打字模式特殊处理 — 不能调 bossAnswer(wrongIdx)
            // 因为 typing 模式下只有 1 个隐藏 .boss-opt 占位, wrongIdx > 0 时 allOpts[i] = undefined → 崩溃卡死
            // 正确做法: 调 submitTyping, input 空字符串 ≠ 正确答案, 自动判错 + 显示正确答案
            if(window._bossQType === 'typing'){
              if(typeof window.hansenSubmitTyping === 'function'){
                window.hansenSubmitTyping();
              }
              return;
            }
            
            // 🔴 BUG #13 修复 (v235): 原代码 wrongIdx=(correctIdx+1)%4 硬编码 %4, 但 spellPick 是 6 选 1,
            // 万一以后加新题型选项数 <4 (比如 2 选 1 判断题) 必崩溃 (allOpts[3]=undefined). 
            // 修复: 用实际选项数算 wrongIdx, 防患于未然.
            var allOpts = document.querySelectorAll('#bossOpts .boss-opt');
            var optCount = allOpts.length || 4;
            var correctIdx = _r('_bossCorrectIdx');
            var wrongIdx = (correctIdx + 1) % optCount;
            if(typeof window.bossAnswer === 'function'){
              window.bossAnswer(wrongIdx);
            }
          });
        }
      };
    }
    
    window.bossAnswer = function(i){
      // 🔴 BUG#60 修复 (v488): 选择题答完后再点其他选项, 本 wrapper 的"难度加成"额外伤害(after 段)会重复扣给勇者。
      //   原版 island bossAnswer 有 #bossOpts dataset.done 闸门会提前返回(不扣基础血/不放特效), 但 wrapper 的额外伤害/特效
      //   在调原版【之后】的 after 段、不受其约束 → 重复点错误选项时 origBossAnswer 提前返回, 但额外伤害仍被再扣一遍。
      //   修法: 在 wrapper 最外层加【同一道闸门】—— 本题已答(dataset.done)则任何重复点击直接 return, 不扣血/不特效/不反应。
      var _bo60 = document.getElementById('bossOpts');
      if(_bo60 && _bo60.dataset.done){ return; }
      _lastAnswerAt = Date.now();   // 🔴 BUG#62 加强 (v491): 记录答题时刻, 供看门狗判"下一题超时未来"
      clearTimer();
      
      var cfg = getBossCfg();
      var correctIdx = _r('_bossCorrectIdx');
      var isCorrect = (i === correctIdx);
      
      // 记录 hero HP 前
      var heroBefore = _r('heroHP');
      
      // 调原函数
      origBossAnswer.apply(this, arguments);

      // v953: 给原版完形/拼写结果补上稳定的语义状态类。
      // 以前只靠 style.color=#22c55e/#ef4444，全局配色会改写行内色，
      // 而且浏览器可能把 hex 序列化成 rgb，属性选择器不可靠。
      // 状态类只用于颜色语义，不改答题、伤害、倒计时或奖励逻辑。
      try {
        var resultClass = isCorrect ? 'boss-answer-result-correct' : 'boss-answer-result-wrong';
        var oppositeClass = isCorrect ? 'boss-answer-result-wrong' : 'boss-answer-result-correct';
        var resultNode = null;
        if(window._bossQType === 'spellFill'){
          resultNode = document.getElementById('bsfHole');
        } else if(window._bossQType === 'cloze'){
          var qResultNodes = document.querySelectorAll('#bossQ span[style*="border-bottom"]');
          if(qResultNodes.length) resultNode = qResultNodes[qResultNodes.length - 1];
        }
        if(resultNode && resultNode.classList){
          resultNode.classList.remove(oppositeClass);
          resultNode.classList.add(resultClass);
        }
      } catch(e){}
      
      // v150: 命中特效新规则 (Hansen 反馈每次出特效太累眼)
      //   普通命中 (1-4 / 6-9 / 11-14 ...): 完全无视觉特效, 只保留 boss 自身 hit-anim 轻缩放
      //   5 倍数连击 (5/15/25/...): 双刀 ╳ 斩击 + 8 粒子血溅
      //   10 倍数连击 (10/30/50/...): 加农炮 = 加大双刀 + 金色冲击光环 + 15 粒子
      //   20 倍数连击 (20/40/60/...): 超级暴击 (3x 伤害 + 吸血 + 屏幕大字, 保留)
      if(isCorrect){
        var wrap = document.querySelector('.boss-sprite-wrap');
        var combo = _r('bossCombo') || 0;
        var isSuperCrit = (combo > 0 && combo % 20 === 0);
        var isCannon = (combo > 0 && combo % 10 === 0 && !isSuperCrit);
        var isSlash = (combo > 0 && combo % 5 === 0 && !isSuperCrit && !isCannon);
        window.__hbuLastCombo = combo;
        window.__hbuLastTier = isSuperCrit ? 'SUPER' : (isCannon ? 'CANNON' : (isSlash ? 'SLASH' : 'NORMAL'));
        
        if(wrap && (isSlash || isCannon)){
          wrap.style.position = 'relative';
          
          // 双刀 ╳ (5/10 连击都有, 10 连击的更大)
          var slashScale = isCannon ? 1.4 : 1;  // 加农炮: 刀痕放大 40%
          var slash = document.createElement('div');
          slash.className = 'hansen-slash';
          if(isCannon){
            slash.style.width = '210px';
            slash.style.height = '3.5px';
          }
          wrap.appendChild(slash);
          
          var slash2 = document.createElement('div');
          slash2.className = 'hansen-slash slash-2';
          if(isCannon){
            slash2.style.width = '210px';
            slash2.style.height = '3.5px';
          }
          wrap.appendChild(slash2);
          
          setTimeout(function(){ 
            if(slash.parentNode) slash.parentNode.removeChild(slash); 
            if(slash2.parentNode) slash2.parentNode.removeChild(slash2); 
          }, 900);
          
          // 加农炮: 加一个金色冲击光环
          if(isCannon){
            var ring = document.createElement('div');
            ring.className = 'hansen-cannon-ring';
            wrap.appendChild(ring);
            setTimeout(function(){ if(ring.parentNode) ring.parentNode.removeChild(ring); }, 800);
          }
          
          // 粒子: 5 连 8 个 / 10 连 15 个
          var pCount = isCannon ? 15 : 8;
          for(var bi = 0; bi < pCount; bi++){
            var bd = document.createElement('div');
            bd.className = 'hansen-blood';
            var ang = Math.random() * Math.PI * 2;
            var dist = isCannon ? (38 + Math.random() * 38) : (28 + Math.random() * 32);
            var dx = Math.round(Math.cos(ang) * dist);
            var dy = Math.round(Math.sin(ang) * dist);
            bd.style.setProperty('--bx', dx + 'px');
            bd.style.setProperty('--by', dy + 'px');
            bd.style.animation = 'hansenBloodSplat 0.6s ease-out forwards';
            // 颜色分布: 5 连击 = 2 白 + 6 红; 10 连击 = 3 白 + 2 金 + 10 红
            if(bi < (isCannon ? 3 : 2)){
              // 白色火花
              var sz = 4 + Math.floor(Math.random() * 3);
              bd.style.width = sz + 'px';
              bd.style.height = sz + 'px';
              bd.style.background = 'radial-gradient(circle,#fff 30%,#e5e7eb 70%)';
              bd.style.boxShadow = '0 0 6px rgba(255,255,255,0.9)';
            } else if(isCannon && bi < 5){
              // 加农炮专属: 金色火星
              var sz = 5 + Math.floor(Math.random() * 3);
              bd.style.width = sz + 'px';
              bd.style.height = sz + 'px';
              bd.style.background = 'radial-gradient(circle,#fef3c7 25%,#fbbf24 70%)';
              bd.style.boxShadow = '0 0 8px rgba(251,191,36,0.9)';
            } else {
              // 红色血点
              var sz = 5 + Math.floor(Math.random() * 4);
              bd.style.width = sz + 'px';
              bd.style.height = sz + 'px';
            }
            wrap.appendChild(bd);
            (function(el){ setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 700); })(bd);
          }
        }
        
        // v150: 删除 5/10/15 小角字 (现在那些 combo 都有大特效, 小角字多余)
        
        // 20 连击超级暴击: 3 倍伤害 + 吸血一半 + 屏幕大字 (无 shake, 用 opacity fade 替代 scale)
        if(isSuperCrit){
          var maxBHp = _r('bossMaxHP') || 100;
          var curBHp = _r('bossHP') || 0;
          var baseExtra = Math.floor(maxBHp * 0.05);  // 基础 5% 总血
          var extraDmg = baseExtra * 3;  // 3 倍
          if(extraDmg < 1) extraDmg = 1;
          
          var newBHp = Math.max(0, curBHp - extraDmg);
          _w('bossHP', newBHp);
          
          // 吸血: 一半伤害转化为 hero HP
          var heal = Math.floor(extraDmg / 2);
          var maxHHp = _r('heroMaxHP') || 100;
          var curHHp = _r('heroHP') || 0;
          var newHHp = Math.min(maxHHp, curHHp + heal);
          _w('heroHP', newHHp);
          
          // 更新 boss HP 显示
          var bFill = document.getElementById('bossHPFill');
          var bText = document.getElementById('bossHPText');
          if(bFill) bFill.style.width = (newBHp / maxBHp * 100) + '%';
          if(bText) bText.textContent = 'HP: ' + newBHp + ' / ' + maxBHp;
          
          // 更新 hero HP 显示
          var heroFill2 = document.getElementById('heroHPFill');
          if(heroFill2) heroFill2.style.width = (newHHp / maxHHp * 100) + '%';
          var heroText2 = document.getElementById('heroHPText');
          if(heroText2) heroText2.textContent = newHHp + ' / ' + maxHHp;
          
          // 🔴 BUG #8 修复 (v208): 答对扣血时, 删除全屏 flash + 居中大字 (会盖住题目, 导致跳题感)
          // 改为只在 boss 身上做爆炸特效: 多色粒子 + 冲击波 ring + 强光高亮 (全部在 wrap 内, 不挡题)
          if(wrap){
            wrap.style.position = 'relative';
            
            // 1. 中心强光闪 (短暂, 不挡屏)
            var coreFlash = document.createElement('div');
            coreFlash.style.cssText = 'position:absolute;left:50%;top:50%;width:90px;height:90px;margin:-45px 0 0 -45px;background:radial-gradient(circle,#fff 0%,#fbbf24 35%,rgba(239,68,68,0.6) 65%,transparent 90%);border-radius:50%;z-index:5;pointer-events:none;animation:hansenSuperCoreFlash .55s ease-out forwards';
            wrap.appendChild(coreFlash);
            
            // 2. 双层冲击波 ring (扩散)
            var ring1 = document.createElement('div');
            ring1.style.cssText = 'position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border:4px solid #fbbf24;border-radius:50%;z-index:4;pointer-events:none;box-shadow:0 0 20px #fbbf24;animation:hansenSuperRing .7s ease-out forwards';
            wrap.appendChild(ring1);
            
            var ring2 = document.createElement('div');
            ring2.style.cssText = 'position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border:3px solid #ef4444;border-radius:50%;z-index:4;pointer-events:none;box-shadow:0 0 16px #ef4444;animation:hansenSuperRing2 .9s ease-out forwards';
            wrap.appendChild(ring2);
            
            // 3. 25 个金红粒子 4 向爆炸
            for(var sci = 0; sci < 25; sci++){
              var sp = document.createElement('div');
              sp.className = 'hansen-blood';
              var ang2 = (sci / 25) * Math.PI * 2 + Math.random() * 0.3;
              var dist2 = 50 + Math.random() * 50;
              var dx2 = Math.round(Math.cos(ang2) * dist2);
              var dy2 = Math.round(Math.sin(ang2) * dist2);
              sp.style.setProperty('--bx', dx2 + 'px');
              sp.style.setProperty('--by', dy2 + 'px');
              sp.style.animation = 'hansenBloodSplat 0.8s ease-out forwards';
              if(sci < 8){ sp.style.background = '#fbbf24'; sp.style.boxShadow = '0 0 8px #fbbf24'; }
              else if(sci < 16){ sp.style.background = '#ef4444'; }
              else { sp.style.background = '#fff'; sp.style.boxShadow = '0 0 6px #fbbf24'; }
              wrap.appendChild(sp);
            }
            
            setTimeout(function(){
              if(coreFlash.parentNode) coreFlash.remove();
              if(ring1.parentNode) ring1.remove();
              if(ring2.parentNode) ring2.remove();
              // 粒子自己 0.8s 后由 animation 移除 (forwards 后不会, 但 wrap remove 会清)
              var blobs = wrap.querySelectorAll('.hansen-blood');
              blobs.forEach(function(b){ if(b.parentNode) b.remove(); });
            }, 950);
          }
          
          // 更新黄框
          setBossMsg('⚡ <b>' + combo + ' 超级暴击!</b> -' + extraDmg + ' · 吸血 +' + heal);
          
          // boss 被打死? 触发胜利
          if(newBHp <= 0 && typeof window.bossVictory === 'function'){
            // 🛡️ v235: 加 token 保护, 玩家中途返回时不触发胜利
            var sessTok = bossSessionToken;
            setTimeout(function(){ 
              if(sessTok !== bossSessionToken) return;  // boss 战已结束, 不触发
              window.bossVictory(); 
            }, 1000);
          }
        }
      }
      
      // 🔴BUG 答错伤害已由 island 两段制(固定/百分比+护甲)独立处理, 这里只做战败判断;
      //   不再叠加 wrongExtra 额外伤害(与两段制叠加会过难/秒杀, 违反"绝不一击毙命/防碾压"设计)。
      if(!isCorrect){
        var maxHp = _r('heroMaxHP') || 100;
        if(_r('heroHP') <= 0 && typeof window.bossDefeat === 'function'){
          var sessTok2 = bossSessionToken;
          setTimeout(function(){
            if(sessTok2 !== bossSessionToken) return;
            window.bossDefeat();
          }, 1200);
        }
      }
    };
    
    window.stopBoss = function(){
      hideTimer();
      // 🛡️ v235: token 自增, 让所有"延迟胜利/失败"的 setTimeout 失效
      bossSessionToken++;
      // 🛡️ v236: 重置 nextBossQ 去重锁 (下场 boss 战要能立即开第一题)
      try { lastNextBossQAt = 0; } catch(e){}
      // v167: 清掉 boss 战全局状态, 防止下次进 boss 战时残留旧值
      window._bossQType = null;
      window._bossWord = null;
      window._bossCorrectIdx = null;
      // v167: 清掉 200ms 轮询, 防止切换岛/回主页后还在跑
      if(pollInterval){ clearInterval(pollInterval); pollInterval = null; }
      if(pollInterval){ clearInterval(pollInterval); pollInterval = null; }
      // 🔴 BUG#62 (v490): 清掉空白看门狗周期(切岛/回主页/战斗结束后不再空跑)
      if(_bossQWdInterval){ clearInterval(_bossQWdInterval); _bossQWdInterval = null; }
      if(origStopBoss) origStopBoss.apply(this, arguments);
    };
    
    // 最后 Boss: 全词覆盖
    // 思路: 在 startBoss 后 (经过 origStartBoss), bossPool 已经初始化但只是闭包内
    // 我没法读它. 但我可以从 nextBossQ 入手 — 看 bossQuestionsAsked
    // 实际上 boss 默认 bossPool 用了 allW.length 个, 已经包含全部词
    // Hansen 的"全词覆盖"需求其实当 boss HP 足够 + 题目数量足够 时自然满足
    // 
    // 但最后 boss HP=230, 每题伤害 12-40 平均 20, 大概 12 题左右就打死了
    // food 岛 56 词, 12 题远不够覆盖全部
    // 
    // 解决: 把最后 Boss HP 大幅提升, 让题目数 >= 词数
    // 通过 bossMaxHP 反推: 题数 = HP / 平均伤害20 -> 词数=56, HP需要 1120 才能保证全词
    // 但这样难度太高
    // 
    // 简化: 用一个标记, 最后 boss 时 hero 伤害减半, 让 boss 多撑题
    // 或者: 显式告诉用户"全岛 56 词都会考到一遍" - 但需要保证 bossPool 不重复
    // 现有 bossPool 用 allW.length 打乱, 用 pop() 取出 — 已经不重复!
    // 当 pool 空时会重置. 也就是说前 56 题都不重复, 这已经够了
    // 
    // 我把最后 boss HP 通过外部直接修改 (在 origStartBoss 后)
    if(getBossCfg().askAll){
      // 用 hookBossStarted 后修改 bossMaxHP
      // 通过 DOM 文本反推 HP, 或者用 _r('bossMaxHP') (如果有的话)
    }
    
    // v143q: 全局拦截原版 milestone 大字 toast (Hansen 反馈: 每次连击的紫色大字让人头晕)
    // 屏蔽所有 milestone-* 类型 (5/10/20/30/50/100 连击大字), 保留护盾/宝箱/宠物进化等其他 toast
    if(typeof window.showComboToast === 'function'){
      var origShowComboToast = window.showComboToast;
      window.showComboToast = function(html, type, duration){
        if(typeof type === 'string' && type.indexOf('milestone-') === 0){
          return;  // 屏蔽连击里程碑大字
        }
        return origShowComboToast.call(this, html, type, duration);
      };
    }
    
    // v143q: 屏蔽 hansen_upgrade.js 的"⚡ N 连击!" 大字 + "+N XP" 浮动 (Hansen 反馈: 抖动头晕)
    // 保留 showLevelUp (升级稀有事件, 不头晕)
    if(window.HansenUpgrade){
      window.HansenUpgrade.showCombo = function(){};
      window.HansenUpgrade.showXpGain = function(){};
    }
    // 屏蔽原版 markAnswer 里的 "+N COMBO XP" 飘字 (top:200px 屏幕中央)
    if(typeof window.floatText === 'function' && !window.__hbu_floatText_patched){
      var origFloatText = window.floatText;
      window.floatText = function(x, y, text, color){
        if(typeof text === 'string' && text.indexOf('COMBO XP') !== -1) return;
        return origFloatText.apply(this, arguments);
      };
      window.__hbu_floatText_patched = true;
    }
    
    // ━━━ 勇者受击特效 (Hansen 选: 浮动伤害数字 + 血条受击动画 · 全平滑·零眩晕·不闪不抖不旋转不脉动) ━━━
    if(!document.getElementById('hansen-hero-hit-css')){
      var _hhc = document.createElement('style');
      _hhc.id = 'hansen-hero-hit-css';
      _hhc.textContent =
        // 掉血段拖尾: 浅红段比主血条【慢且延迟】地平滑下沉, 露出的就是本次掉的血(平滑过渡, 不闪)
        '#bossScreen .hero-hp-bar{position:relative}' +
        '#bossScreen .hero-hp-fill{position:relative;z-index:2}' +
        '#bossScreen .hero-hp-trail{position:absolute;left:0;top:0;height:100%;z-index:1;border-radius:5px;background:linear-gradient(90deg,#fb7185,#fecaca);box-shadow:0 0 6px rgba(251,113,133,.45);transition:width .55s cubic-bezier(.4,0,.2,1) .12s}' +
        // 浮动伤害数字: 上浮 + 轻微放大入场 + 淡出(一次性入场动画, 不脉动不闪烁)
        '.hero-dmg-float{position:fixed;pointer-events:none;z-index:10000;font-weight:900;color:#f87171;font-family:Microsoft YaHei,sans-serif;text-shadow:0 2px 8px rgba(0,0,0,.6),0 0 14px rgba(248,113,113,.55);white-space:nowrap;will-change:transform,opacity;animation:hansenHeroDmg 1s cubic-bezier(.2,.7,.3,1) forwards}' +
        '@keyframes hansenHeroDmg{0%{transform:translate(-50%,0) scale(.5);opacity:0}18%{transform:translate(-50%,-9px) scale(1.18);opacity:1}46%{transform:translate(-50%,-20px) scale(1);opacity:1}100%{transform:translate(-50%,-46px) scale(.92);opacity:0}}';
      (document.head || document.documentElement).appendChild(_hhc);
    }
    // 勇者受击: dmg=本次伤害, newHP=扣后血量, maxHP=最大血量 (各岛扣血后调用)
    window.HansenHeroHit = function(dmg, newHP, maxHP){
      try {
        dmg = Math.round(dmg || 0); if(dmg <= 0) return;
        maxHP = maxHP || 100;
        if(typeof newHP !== 'number') newHP = maxHP;
        var newPct = Math.max(0, Math.min(100, (newHP / maxHP) * 100));
        var oldPct = Math.max(0, Math.min(100, ((newHP + dmg) / maxHP) * 100));
        // ① 血条掉血段拖尾(平滑下沉, 不闪)
        var bar = document.querySelector('#bossScreen .hero-hp-bar');
        if(bar){
          var trail = bar.querySelector('.hero-hp-trail');
          if(!trail){
            trail = document.createElement('div');
            trail.className = 'hero-hp-trail';
            bar.insertBefore(trail, bar.firstChild);
          }
          trail.style.transition = 'none';
          trail.style.width = oldPct + '%';
          void trail.offsetWidth;        // 强制 reflow, 让过渡从 oldPct 起步
          trail.style.transition = '';    // 恢复 CSS 的 .55s 延迟过渡
          requestAnimationFrame(function(){ trail.style.width = newPct + '%'; });
        }
        // ② 浮动伤害数字(勇者血条区上方上浮淡出)
        var anchor = document.querySelector('#bossScreen .hero-section') || document.getElementById('heroHPText') || bar;
        var x = window.innerWidth / 2, y = window.innerHeight / 2;
        if(anchor){ var r = anchor.getBoundingClientRect(); y = r.top + r.height / 2; }  // y用hero区中心
        var _bspr614 = document.getElementById('bossSprite') || document.querySelector('.boss-sprite');  // 🔴 v614(Hansen): 浮动伤害x锁boss自己中线(boss立绘水平中心·与大招命中中心统一以boss自身为中心展示·而非血条中央/屏幕中心)
        if(_bspr614){ var _br614 = _bspr614.getBoundingClientRect(); if(_br614.width>0) x = _br614.left + _br614.width/2; }
        // 🔴BUG#72(Hansen): 命中点覆盖(一次性)——外星霸主歼星光束右移后伤害数字落在光束命中点而非boss中线; 读后即清, 其他boss/普通受击仍走上面v614 boss中线。
        try{ if(typeof window.__hsnDmgX==='number'){ x=window.__hsnDmgX; window.__hsnDmgX=null; } }catch(_e){}
        var f = document.createElement('div');
        f.className = 'hero-dmg-float';
        f.textContent = '-' + dmg;
        f.style.left = x + 'px';
        f.style.top = y + 'px';
        f.style.fontSize = (dmg >= 18 ? 30 : 25) + 'px';
        document.body.appendChild(f);
        setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 1050);
      } catch(e){}
    };
    
    console.log('%c[HansenBossUpgrade]%c v391 加载: boss战返回键智能跳转 (战斗中→boss选择, picker→主菜单)',
                'color:#dc2626;font-weight:bold', 'color:#94a3b8');
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔴 BUG #1 防护 (RUNTIME 第3层, v209 起强制): 运行时版本一致性自检
    // 三层防 bug 的第 3 层 (前两层是 build.py 和 check_resources.py)。
    // 即使 build.py 没跑, 用户打开页面后这段 JS 立刻检查所有 script src +
    // img src + SVG image 的 ?v= 是否同版本; 不一致就在屏幕顶部弹红色警告条。
    // 目的: 永远不会再出现"图片传上去看不到新图却毫不知情"(BUG #1)。
    //
    // 🔴 BUG #10 关联: 下面这行 HBU_RUNTIME_VERSION 由 build.py 自动同步, 不要手改!
    // 手改会和 __HBU_VERSION__ / cache buster 形成"版本号打架"(check.html 误报)。
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    window.HBU_RUNTIME_VERSION = 'v1078';
    setTimeout(function(){
      try {
        var versions = new Set();
        document.querySelectorAll('script[src*="?v="], img[src*="?v="]').forEach(function(el){
          var src = el.getAttribute('src') || '';
          var m = src.match(/\?v=([a-zA-Z0-9_]+)/);
          if(m) versions.add(m[1]);
        });
        // 检查 SVG image (xlink:href / href)
        document.querySelectorAll('image').forEach(function(el){
          var href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
          var m = href.match(/\?v=([a-zA-Z0-9_]+)/);
          if(m) versions.add(m[1]);
        });
        
        if(versions.size > 1){
          var vs = Array.from(versions).join(', ');
          console.error('%c⚠️ 版本不一致! 发现多个 ?v= 版本:', 'color:#dc2626;font-weight:bold;font-size:14px', vs);
          // 屏幕顶部红色警告条
          var w = document.createElement('div');
          w.id = '__hansen_version_mismatch_warning';
          w.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;padding:10px;font-weight:900;z-index:100000;text-align:center;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,.5);border-bottom:2px solid #fbbf24;cursor:pointer';
          w.innerHTML = '⚠️ 版本不一致! 发现 ?v=' + vs + ' &nbsp; (点击关闭) &nbsp; 请重新部署最新 zip';
          w.onclick = function(){ w.remove(); };
          document.body.appendChild(w);
          setTimeout(function(){ if(w.parentNode) w.remove(); }, 15000);
        } else if(versions.size === 1) {
          var v = Array.from(versions)[0];
          console.log('%c✅ 版本一致性自检通过: ?v=' + v, 'color:#22c55e;font-weight:bold');
        }
      } catch(e){ console.warn('版本自检失败:', e); }
    }, 500);
    
    // v143y: 移除右上角的 v143x 绿色徽章. 部署链路已稳定, 无需可见 marker.
    // 版本号仍然挂在 console (banner) + window.__HBU_VERSION__ + check.html 自检页面
    // 玩家界面保持干净
  }
  
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ════════════════════════════════════════════════════════════════
   v953 · Boss 管理入口可达性桥

   v929 把 1MB+ 的 hansen_boss_attack.js 改成真正战斗时才解析，首屏因此更快；
   但设置页的公开调节入口、底部秘密密码入口也在那个重文件里，fresh session
   尚未打 Boss 时就完全不可达。本桥只常驻极少量监听代码：
   - 平时绝不主动加载攻击引擎；
   - 设置内容真正出现后才按需加载，恢复公开入口；
   - 用户先点“进度自动保存到本设备”时，启动同一个单例 loader，重文件一导出
     密码门就直接调用；不等待特效图、不伪造 click、不重复弹窗；
   - 网络失败会清掉桥自己的 pending，下一次打开设置/点击可以重试。
   原 SHA-256/djb2 密码校验、三次错误永久锁和 IndexedDB 镜像全部仍由重文件负责。
   ════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.__hansenBossAdminBridgeV953) return;
  window.__hansenBossAdminBridgeV953=true;

  var pending=null;
  var openPending=null;
  var watcher=null;

  function exportedGate(){
    return typeof window.__hsnOpenBossAdminGate==='function'
      ? window.__hsnOpenBossAdminGate : null;
  }

  function exportedRefresh(){
    return typeof window.__hsnEnsureBossFxSettingsEntry==='function'
      ? window.__hsnEnsureBossFxSettingsEntry : null;
  }

  function waitForLoader(){
    return new Promise(function(resolve){
      var tries=0;
      (function poll(){
        if(typeof window.__hansenBossFXReady==='function'){
          resolve(window.__hansenBossFXReady);
          return;
        }
        tries++;
        if(tries>=120){ resolve(null); return; }
        setTimeout(poll,25);
      })();
    });
  }

  /* 管理密码门只依赖脚本本身，不依赖 6 张 Boss 特效图。
     正式 loader 为了保证战斗一帧不丢，会等图片全部 onload/onerror 后才 resolve；
     管理入口若也等它，极端弱网图片悬挂时就会看起来再次“消失”。这里仅轮询
     重文件已经导出的窄 gate，最多等 6 秒；战斗仍继续遵守原完整 ready Promise。 */
  function waitForExportedGate(){
    return new Promise(function(resolve){
      var tries=0;
      (function poll(){
        if(exportedGate()){ resolve(true); return; }
        tries++;
        if(tries>=240){ resolve(false); return; }
        setTimeout(poll,25);
      })();
    });
  }

  function ensureLoaded(){
    if(exportedGate()) return Promise.resolve(true);
    if(pending) return pending;
    pending=waitForLoader().then(function(ready){
      if(!ready) return false;
      var started;
      try{ started=ready(); }catch(e){ return false; }
      var gateReady=waitForExportedGate();
      if(started&&typeof started.then==='function'){
        return Promise.race([
          gateReady,
          Promise.resolve(started).then(function(){
            return !!exportedGate();
          },function(){ return false; })
        ]);
      }
      return gateReady;
    }).then(function(ok){
      if(!ok) pending=null;
      return ok;
    },function(){
      pending=null;
      return false;
    });
    return pending;
  }

  function refresh(){
    return ensureLoaded().then(function(ok){
      var fn=exportedRefresh();
      if(ok&&fn){ try{fn();}catch(e){} }
      return ok;
    });
  }

  function open(){
    if(openPending) return openPending;
    openPending=ensureLoaded().then(function(ok){
      var fn=exportedGate();
      if(ok&&fn){ fn(); return true; }
      return false;
    }).then(function(ok){
      openPending=null;
      return ok;
    },function(){
      openPending=null;
      return false;
    });
    return openPending;
  }

  function isSecretFooter(target){
    if(!target||target.nodeType!==1) return false;
    if(target.children&&target.children.length>0) return false;
    var text=target.textContent||'';
    return text.length<40&&text.indexOf('进度自动保存到本设备')>=0;
  }

  /* 本监听比重文件先注册。命中秘密行后由桥独占这一次事件，避免重文件加载完成后
     自己的捕获监听又处理同一次 click，造成两个密码框。 */
  try{
    document.addEventListener('click',function(event){
      var target=event&&event.target;
      if(!isSecretFooter(target)) return;
      try{ if(event.preventDefault)event.preventDefault(); }catch(e){}
      try{ if(event.stopImmediatePropagation)event.stopImmediatePropagation(); }catch(e){}
      open();
    },true);
  }catch(e){}

  function armSettings(){
    var settings=document.getElementById('settingsContent');
    /* boss_lock 在所有岛页都位于 #settingsContent 之后；诊断页没有设置容器时直接退出，
       不能为不存在的入口永久轮询。 */
    if(!settings) return;
    function onSettingsContent(){
      if(settings.firstChild) refresh();
    }
    onSettingsContent();
    try{
      watcher=new MutationObserver(onSettingsContent);
      watcher.observe(settings,{childList:true});
    }catch(e){
      setInterval(onSettingsContent,1200);
    }
  }

  window.HansenBossAdminBridge={
    ensureLoaded:ensureLoaded,
    open:open,
    refresh:refresh
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',armSettings,{once:true});
  }else{
    armSettings();
  }
})();
