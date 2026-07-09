// hansen_cardbook_wallet.js — 全局卡册钱包
// ============================================================
// 背景: Hansen 要一套卡册18岛共享(打boss + 抽卡都往里填)。
//   但"boss进度"(各岛打到第几关)必须各岛独立(hansen_card_data_<岛名>, 不能动),
//   否则一个岛打通其它岛boss全解锁(v330修过的bug)。
//   所以分开: boss进度各岛独立(hansen_cards.js 不动) + 【卡册收藏全局共享(本文件)】。
//
// 本钱包只管两样(全局共享, 所有岛读写同一份):
//   - owned : 已拥有的卡(按卡的唯一id, 这里用 boss 的 lv 1-20 当卡id)。{lv: true}
//   - frags : 各稀有度的碎片数量。{common:N, uncommon:N, rare:N, epic:N, legendary:N}
//   - pity  : 抽卡保底计数(距上次出至尊多少抽没出, 用于软硬保底)
//   - totalDraws : 总抽卡次数(统计用)
//
// 卡的稀有度由 lv 决定(1-4普通/5-8稀有/9-12史诗/13-16传说/17-20至尊), 和 BOSS_CARDS 一致。
// 零侵入独立文件。
// ============================================================
(function(){
  if(window.__hansenCardbookLoaded){ return; } window.__hansenCardbookLoaded = true;

  var KEY = 'hansen_wallet_cardbook';

  // 卡的稀有度(按lv) — 和 hansen_cards.js 的 BOSS_CARDS 保持一致
  function rarityOfLv(lv){
    lv = lv|0;
    if(lv>=1&&lv<=4) return 'common';
    if(lv>=5&&lv<=8) return 'uncommon';
    if(lv>=9&&lv<=12) return 'rare';
    if(lv>=13&&lv<=16) return 'epic';
    if(lv>=17&&lv<=20) return 'legendary';
    return 'common';
  }

  function _read(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return _blank();
      var o = JSON.parse(raw);
      return {
        owned: (o.owned&&typeof o.owned==='object')?o.owned:{},
        frags: _normFrags(o.frags),
        pity: (typeof o.pity==='number'&&isFinite(o.pity))?o.pity:0,
        totalDraws: (typeof o.totalDraws==='number'&&isFinite(o.totalDraws))?o.totalDraws:0
      };
    }catch(e){ return _blank(); }
  }
  function _blank(){ return {owned:{}, frags:_normFrags(null), pity:0, totalDraws:0}; }
  function _normFrags(f){
    f = (f&&typeof f==='object')?f:{};
    return {
      common: f.common||0, uncommon: f.uncommon||0, rare: f.rare||0,
      epic: f.epic||0, legendary: f.legendary||0
    };
  }
  function _write(o){
    try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){}
  }

  window.HansenCardbook = {
    rarityOfLv: rarityOfLv,

    // 是否已拥有某张卡(lv)
    has: function(lv){ return !!_read().owned[lv]; },
    // 拥有的卡数量
    ownedCount: function(){ return Object.keys(_read().owned).length; },
    // 拥有的全部卡lv数组
    ownedList: function(){ return Object.keys(_read().owned).map(Number); },
    // 某稀有度拥有几张
    ownedCountByRarity: function(r){
      var o=_read().owned, n=0;
      Object.keys(o).forEach(function(lv){ if(rarityOfLv(lv)===r) n++; });
      return n;
    },
    // 碎片
    getFrags: function(){ return _read().frags; },
    fragsOf: function(r){ return _read().frags[r]||0; },
    // 保底计数
    getPity: function(){ return _read().pity; },
    getTotalDraws: function(){ return _read().totalDraws; },

    // 获得一张卡。若已拥有 → 转碎片(返回 {dup:true, rarity, frag});若新卡 → 收入(返回 {dup:false, lv, rarity})
    // dupFrag: 重复卡给的碎片数(由调用方按稀有度传, 或这里默认表)
    obtain: function(lv){
      var o=_read();
      var r = rarityOfLv(lv);
      if(o.owned[lv]){
        // 重复 → 碎片
        var DUP={common:10, uncommon:20, rare:40, epic:80, legendary:200};
        var add = DUP[r]||10;
        o.frags[r] = (o.frags[r]||0) + add;
        _write(o);
        return {dup:true, lv:lv, rarity:r, frag:add};
      }else{
        o.owned[lv] = true;
        _write(o);
        return {dup:false, lv:lv, rarity:r};
      }
    },

    // 用碎片兑换该稀有度的一张未拥有的卡。成功返回兑换到的lv, 失败返回null。
    // 至尊(legendary)永远不能兑换。
    exchangeByFrag: function(rarity){
      if(rarity==='legendary') return null;  // 至尊不能换
      var COST={common:50, uncommon:100, rare:200, epic:400};
      var cost=COST[rarity]; if(!cost) return null;
      var o=_read();
      if((o.frags[rarity]||0) < cost) return null;  // 碎片不够
      // 找一张该稀有度、还没拥有的卡
      var range={common:[1,4],uncommon:[5,8],rare:[9,12],epic:[13,16]}[rarity];
      var pick=null;
      for(var lv=range[0]; lv<=range[1]; lv++){ if(!o.owned[lv]){ pick=lv; break; } }
      if(pick===null) return null;  // 该档已集齐
      o.frags[rarity] -= cost;
      o.owned[pick] = true;
      _write(o);
      return pick;
    },

    // 抽卡保底: 抽一次后更新pity。出至尊传 true(清零), 否则 false(+1)。
    bumpPity: function(gotLegendary){
      var o=_read();
      if(gotLegendary) o.pity=0; else o.pity=(o.pity||0)+1;
      o.totalDraws=(o.totalDraws||0)+1;
      _write(o);
    },
    // 直接设pity(测试/特殊用)
    setPity: function(n){ var o=_read(); o.pity=n|0; _write(o); }
  };
})();
