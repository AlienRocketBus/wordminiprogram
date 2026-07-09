// hansen_econ_guide.js v1 —— 🔴v861 金币/钻石/宠物 三份大白话说明书(Hansen: 写得特别特别具体·可折叠·放设置里)
// 全部数字来自代码实账审计(bossCoinForLevel/earnCoinOnCorrect/sbWinCoins/rolls/MILESTONES/PET_STAGES/GEM_PER_WORD/gear价目/round_reward)。
// 零侵入: 仿 hansen_palette 注入模式, 幂等插入 settingsContent(配色选择器之后)。默认折叠, 点标题展开。
(function(){
  'use strict';
  var CSS_ID='hsnEconGuideCss', BOX_ID='hsnEconGuide';
  function injectCss(){
    if(document.getElementById(CSS_ID)) return;
    var st=document.createElement('style'); st.id=CSS_ID;
    st.textContent=''
      +'.hsn-eg-card{margin-top:12px}'
      +'.hsn-eg-hd{display:flex;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none}'
      +'.hsn-eg-hd h3{margin:0;flex:1}'
      +'.hsn-eg-arrow{font-size:13px;color:var(--pal-ink-3,#94a3b8);transition:transform .18s}'
      +'.hsn-eg-card.open .hsn-eg-arrow{transform:rotate(90deg)}'
      +'.hsn-eg-body{display:none;margin-top:10px;font-size:13.5px;line-height:1.75;color:var(--pal-ink-2,#cbd5e1)}'
      +'.hsn-eg-card.open .hsn-eg-body{display:block}'
      +'.hsn-eg-body b{color:#fbbf24}'
      +'.hsn-eg-body .eg-sec{margin:10px 0 4px;font-weight:800;color:var(--pal-ink,#f1f5f9);font-size:14px}'
      +'.hsn-eg-body .eg-li{margin:6px 0;padding-left:2px}'
      +'.hsn-eg-body .eg-eg{background:rgba(251,191,36,.10);border-left:3px solid #fbbf24;border-radius:6px;padding:7px 10px;margin:8px 0;font-size:13px}'
      +'.hsn-eg-sub{font-size:12px;color:var(--pal-ink-3,#94a3b8);margin:2px 0 0}';
    (document.head||document.documentElement).appendChild(st);
  }
  function card(icon,title,sub,bodyHtml){
    return '<div class="settings-section hsn-eg-card">'
      +'<div class="hsn-eg-hd"><h3 style="margin:0">'+icon+' '+title+'</h3><span class="hsn-eg-arrow">▶</span></div>'
      +'<div class="hsn-eg-sub">'+sub+'</div>'
      +'<div class="hsn-eg-body">'+bodyHtml+'</div>'
      +'</div>';
  }
  var COIN_HTML=''
    +'<div class="eg-eg" style="border-left-color:#22c55e;background:rgba(34,197,94,.10)"><b>💡 一句话版</b>: 每天【签到 + 任务全清 + 推 1 关新 Boss + 打一场 Bee】= 稳稳几百金, 勤快点过千。往下看每条的具体数字。</div>'
    +'<div class="eg-sec">🪙 金币从哪来(赚得多的排前面)</div>'
    +'<div class="eg-li"><b>① 每日任务(最稳的大头)</b>——每完成一条任务, 给你 <b>金币 = 这条任务经验的 60%</b>(凑成 5 的倍数, 最少也给 20 金)+ 经验本身。<b>把当天任务全部清完, 再送一个大奖: 100 + 连签天数×20 金币</b>(连签第 7 天起每天都是封顶的 240 金), 还附送 90 分钟"记忆强化"加速。</div>'
    +'<div class="eg-li"><b>② 答对就有钱</b>——不管在哪个模式(选义/听音/配对/组词/填空/打 Boss 答题/Spelling Bee), <b>每答对 1 题 = 1 金币</b>。每天这条路最多拿 <b>2000 金</b>; 同一个单词一天最多给 3 次(反复刷同一个词不加钱, 换新词才有)。</div>'
    +'<div class="eg-li"><b>③ Spelling Bee 拼词大赛(上限最高的一条路)</b>——赢下一个词 = <b>基础分 ×(1 + 对手系数)</b>。基础分看词长: 4 个字母以内 2 分、5~6 个字母 4 分、7 个字母以上 6 分; 对手打字越快, 系数越高(0.3~1.5)。还有连胜加成(最多算到 5 连胜)。Bee 这条路<b>每天也封顶 2000 金</b>(和②的 2000 是两个口袋, 互不占用)。</div>'
    +'<div class="eg-eg">举例: 挑一个中速对手, 赢一个 7 字母长词 ≈ 6×(1+0.8) ≈ <b>11 金</b>; 一场 20 个词全赢 ≈ 200 金上下。想冲钱, 就选长词 + 快对手。</div>'
    +'<div class="eg-li"><b>④ 每日签到宝箱</b>——70% 开出 10~25 金、25% 开出 30~50 金、5% 开出 60~80 大奖; 再乘<b>连签倍率 = 1 +(连签天数−1)×0.2</b>, 第 7 天起 2.2 倍封顶。开箱还附带 20~40 经验, 同样吃倍率。</div>'
    +'<div class="eg-eg">举例: 连签第 7 天, 抽中 30~50 档 → 实拿 <b>66~110 金</b>。断签就从头算, 所以每天来一下最划算。</div>'
    +'<div class="eg-li"><b>⑤ 打 Boss</b>——<b>第一次</b>打赢某一关按关卡给钱: 第 1~4 关 20 金、5~8 关 30、9~12 关 40、13~20 关 50; <b>重复打赢同一关只给 5 金</b>(但经验照给: 50 + 星数×15)。 想赚钱就去推没赢过的新关。 <b>首胜是每个岛各自算的</b>: 动物岛的第 3 关和食物岛的第 3 关是两回事, 两边都能拿首胜钱。 </div>'
    +'<div class="eg-li"><b>⑥ 一岛通关一轮</b>——某岛 1~20 关全打通 = 额外 <b>+300 金币 + ⚡2 小时记忆强化</b>(复习涨星更快)。 每个岛自己一轮自己的进度, 金币和加速<b>不限每天次数</b>·不受钻石防刷限制。 </div>'
    +'<div class="eg-li"><b>⑥ 连签里程碑</b>——连续签到 14 天 +120 金、30 天 +250 金、100 天 +600 金, 还各送加速时长和限定奖励(头像框/双倍经验/传说宠物皮肤)。</div>'
    +'<div class="eg-li"><b>⑦ 成就</b>——大部分成就完成时直接发金币, 数额在成就页每条都写着。</div>'
    +'<div class="eg-sec">🛒 金币能买什么</div>'
    +'<div class="eg-li">主题商店里的付费配色和背景 · 岛屿升级 · 卡册抽卡 等(价格以商店里的标价为准)。</div>'
    +'<div class="eg-sec">📊 一天正常能赚多少(照着做就行)</div>'
    +'<div class="eg-eg">签到(66~110)+ 任务全清(约 200~400, 含大奖)+ 推 1 关新 Boss(20~50)+ Bee 打半小时(约 200~800)≈ <b>稳稳几百金, 勤快点上千</b>。</div>';
  var GEM_HTML=''
    +'<div class="eg-eg" style="border-left-color:#a855f7;background:rgba(168,85,247,.10)"><b>💡 一句话版</b>: 认真复习单词(每记牢 1 个 = 4💎)+ 每天换着岛打通 Boss(每个岛 88💎·星海 100💎)+ Bee 拼新词(每天最多 8💎)= 一天 100~200 颗钻不难。往下看每条怎么拿。</div>'
    +'<div class="eg-sec">💎 钻石只有四条路来(每条都防刷)</div>'
    +'<div class="eg-li"><b>① 单词彻底记住(核心主路·钻石大头)</b>——一个单词在<b>5 个不同的日子</b>里都答对过 → 永久记住 = <b>+4💎</b>。 <br>为什么必须 5 个不同日子: 一天狂刷同一个词只算 1 星, 第二天再答对才 2 星, 第五天最后一次答对才升到 5 星、变成💎。 这条设计就是逼你隔天回来复习, 记得住才是真记住。</div>'
    +'<div class="eg-eg">🌰 <b>拿 elephant 举例</b>:<br>周一 学会并首次答对 → ★☆☆☆☆<br>周二 复习答对 → ★★☆☆☆<br>周三 复习答对 → ★★★☆☆<br>周四 复习答对 → ★★★★☆<br>周五 复习答对 → ★★★★★ <b>永久掌握</b> · 当场 <b>+4💎</b>入账! <br>照这个节奏一天永久掌握 5 个词 = 20💎 · 10 个词 = 40💎。</div>'
    +'<div class="eg-li">📍 <b>星星在哪看</b>: 每答对一次, 屏幕会飘出这个词现在攒到几颗星; 主页的 <b>💎 知识结晶按钮</b>点开, 每个词几颗星一目了然——按钮上的角标数字 = 已经 4 星、<b>再答对一次就 +4💎</b> 的词有几个, 看到角标就先去复习它们, 最划算。 </div>'
    +'<div class="eg-li"><b>② 一个岛的 Boss 打通一轮 = +88💎(每岛每天限一次)</b>——把一个岛的 20 关 Boss<b> 全部都赢过一次</b>(重复赢同一关只算 1 个), 集齐 20 个当场 +88💎, 然后清零开始这个岛的下一轮。 </div>'
    +'<div class="eg-eg" style="border-left-color:#60a5fa;background:rgba(96,165,250,.12)">🏝️ <b>关键机制: 每个岛的 Boss 进度完全独立、互不相干!</b><br>· 你在<b>动物岛</b>打到第 4 关, 今天不玩了——明天回来, 动物岛还<b>记着这 4 关</b>, 接着打第 5 关就行(进度永久保存, 不清零);<br>· 你转去<b>食物岛</b>, 食物岛从<b>它自己的进度</b>开始算, 跟动物岛一点关系都没有;<br>· 每个岛都有: 自己的一轮进度 · 自己的 88💎 · 自己的"每天一次"。 </div>'
    +'<div class="eg-li">⚠️ <b>每天防刷</b>: 今天在动物岛拿过 88 了, 今天再把动物岛通一轮<b>不再给钻</b>(300 金币和 2 小时加速照给); 想今天再拿钻 → 去食物岛/交通岛/…打它们各自的一轮。 明天动物岛的钻石名额才重置。 </div>'
    +'<div class="eg-li">📍 <b>进度在哪看</b>: 打 Boss 页面<b>最下面的大满贯进度器</b>随时告诉你——本岛第几轮、已打通几关、<b>还差哪几关</b>、今天的钻石领没领。 不用自己记。 </div>'
    +'<div class="eg-eg">🌰 想每天多拿钻: 一天认真推完 3 个岛(动物 88 + 食物 88 + 交通 88)= <b>264💎</b>; 加上记牢 5 个单词 20💎, 一天就是 <b>约 280+ 钻</b>。</div>'
    +'<div class="eg-li"><b>③ 星海大冒险大满贯 = +100💎</b>——星海词更难, 打通一轮给 <b>100💎</b>(比其他岛多 12), 同样每天只发一次。</div>'
    +'<div class="eg-li"><b>④ Spelling Bee 每日新词里程碑(逼你练拼写)</b>——每天在 Bee 里首次完整拼对<b>没永久记住的新词</b>: <br>· 拼对 <b>5 个 → +1💎</b><br>· 累计 <b>10 个 → 再+2💎</b>(当天累计 3)<br>· 累计 <b>20 个 → 再+5💎</b>(当天累计 <b>8</b> 颗封顶)<br><b>防刷</b>: 已经永久记住的词不算(逼你挑战新词), 同一个词一天只算一次。 </div>'
    +'<div class="eg-sec">✨ 一次性小奖</div>'
    +'<div class="eg-li"><b>成就「钻石新贵」</b>: 拿到人生第 1 颗钻石时, 一次性 <b>+20💎</b>。</div>'
    +'<div class="eg-sec">📊 一天正常能拿多少钻?</div>'
    +'<div class="eg-eg">认真学的孩子: 单词掌握 12~20💎 + 打通 1~2 个岛 88~176💎 + Bee 3~8💎 = <b>一天 100~200 颗钻石</b>。 攒 2~3 天可以买最强的光子炮(330💎)。</div>'
    +'<div class="eg-sec">🛍️ 钻石能买什么(全价目)</div>'
    +'<div class="eg-li"><b>🎨 典藏画廊</b>: 18 款手绘场景主题, 每款 <b>30💎</b>。</div>'
    +'<div class="eg-li"><b>⚔️ 武器成长线</b>(打 Boss 更疼): 弓箭免费自带 → 手枪 45 → 机枪 80 → 狙击枪 130 → 加特林 185 → 加农炮 250 → 光子炮 <b>330💎</b>。 </div>'
    +'<div class="eg-li"><b>🛡️ 血量升级</b>(100→500, 共 10 级): 20 / 30 / 45 / 60 / 80 / 105 / 135 / 170 / 210 / 265💎。 </div>'
    +'<div class="eg-li" style="color:#94a3b8"><b>ℹ️ 说明</b>: 护甲系统已下架, 钻石不再用于购买护甲。 想扛更多次答错, 请升级血量。 </div>'
    +'<div class="eg-sec">📍 提示</div>'
    +'<div class="eg-li">打 Boss 页面最下方有一个<b>大满贯进度器</b>, 随时能看到: 本岛第几轮、已打通几关、还差哪几关拿钻、今日是否已领。 一目了然。 </div>';
  var PET_HTML=''
    +'<div class="eg-eg" style="border-left-color:#3b82f6;background:rgba(59,130,246,.10)"><b>💡 一句话版</b>: 宠物吃的是你的经验值——你只管好好玩, 它自己长。主页顶上的宠物横幅随时显示它现在的样子和进度条; 点它进宠物页能看 36 阶全图。</div>'
    +'<div class="eg-sec">🐾 宠物是怎么升级的(机制一句话)</div>'
    +'<div class="eg-li">宠物只认一样东西: <b>经验值(XP)</b>。你在这个岛赚到的<b>每一点经验都会同时喂给宠物</b>, 攒够一档就进化一阶, 一共 <b>36 个阶段</b>(第 2 阶要 25 XP → 第 8 阶 535 → 第 16 阶 1805 → 满级第 36 阶 7000 XP)。不用专门"喂", 好好玩就行。</div>'
    +'<div class="eg-sec">⚡ 干什么经验最多(排行)</div>'
    +'<div class="eg-li"><b>① 每日任务</b>——单条 20 到几百经验, 全清一天轻松几百, 是最大头。</div>'
    +'<div class="eg-li"><b>② 打 Boss</b>——每打赢一场 = <b>50 + 星数×15</b>(三星一场 95 经验), 想打几次打几次, 复胜也照给。</div>'
    +'<div class="eg-li"><b>③ Spelling Bee</b>——赢词给经验, 词越长给得越多。</div>'
    +'<div class="eg-li"><b>④ 每日签到</b>——每天 20~40 经验, 乘连签倍率(第 7 天起 2.2 倍)。</div>'
    +'<div class="eg-li"><b>⑤ 日常答题</b>——每答对 1 题 = 5 经验, 听音/配对/组词/填空所有模式都算, 积少成多的底盘。</div>'
    +'<div class="eg-eg">举例: 一天做完任务 + 打 3 场 Boss + 签到 ≈ <b>500+ 经验</b>, 照这个节奏差不多两个月, 宠物就能从蛋一路进化到满级 36 阶。</div>';
  function ensureGuide(){
    var sc=document.getElementById('settingsContent');
    if(!sc || document.getElementById(BOX_ID)) return;
    injectCss();
    var d=document.createElement('div'); d.id=BOX_ID;
    d.innerHTML=card('💰','金币全攻略','怎么赚 · 哪里赚得多 · 每天规则 · 能买什么 — 点开看',COIN_HTML)
      +card('💎','钻石全攻略','四条来路都防刷 · 举例说透 · 全价目 · elephant全流程 — 点开看',GEM_HTML)
      +card('🐾','宠物升级全攻略','36 阶怎么升 · 干什么经验最多 — 点开看',PET_HTML);
    var pal=document.getElementById('hsnPalPicker');
    if(pal && pal.nextSibling) sc.insertBefore(d, pal.nextSibling);
    else if(pal) sc.appendChild(d);
    else sc.insertBefore(d, sc.firstChild);
    d.addEventListener('click', function(e){
      var hd=e.target.closest('.hsn-eg-hd');
      if(!hd) return;
      hd.parentNode.classList.toggle('open');
    });
  }
  // 注入时机: 与 palette 同款(包 renderSettings + 直插兜底)
  var _t=setInterval(function(){
    if(typeof window.renderSettings==='function' && !window.renderSettings.__hsnEcon){
      var _o=window.renderSettings;
      window.renderSettings=function(){ var r=_o.apply(this,arguments); try{ensureGuide();}catch(e){} return r; };
      window.renderSettings.__hsnEcon=true;
      clearInterval(_t);
    }
  },250);
  setTimeout(function(){clearInterval(_t);},15000);
  if(document.readyState!=='loading') ensureGuide();
  else document.addEventListener('DOMContentLoaded', ensureGuide);
})();
