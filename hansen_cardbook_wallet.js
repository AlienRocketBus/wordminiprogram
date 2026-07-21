// hansen_cardbook_wallet.js v942 — 全局卡册钱包 + 抽卡交易日志
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
  var PROOF_KEY = 'hansen_cardbook_purchase_transaction_v942';

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

  function _readState(){
    try{
      var raw = localStorage.getItem(KEY);
      if(raw===null) return {ok:true,value:_blank()};
      var o = JSON.parse(raw);if(!o||typeof o!=='object'||Array.isArray(o))return {ok:false,value:_blank()};
      if(o.owned!=null&&(typeof o.owned!=='object'||Array.isArray(o.owned)||Object.keys(o.owned).some(function(k){var lv=Number(k);return !Number.isInteger(lv)||lv<1||lv>20||(o.owned[k]!==true&&o.owned[k]!==false);})))return {ok:false,value:_blank()};
      var fragNames={common:1,uncommon:1,rare:1,epic:1,legendary:1};
      if(o.frags!=null&&(typeof o.frags!=='object'||Array.isArray(o.frags)||Object.keys(o.frags).some(function(k){return !fragNames[k]||!_isNN(o.frags[k]);})))return {ok:false,value:_blank()};
      if(o.pity!=null&&!_isNN(o.pity)||o.totalDraws!=null&&!_isNN(o.totalDraws))return {ok:false,value:_blank()};
      var pending=_normPending(o.pending),last=_normReceipt(o.lastReceipt),receipts=_normReceipts(o.receipts);
      if(o.pending!=null&&!pending)return {ok:false,value:_blank()};
      if(o.lastReceipt!=null&&!last)return {ok:false,value:_blank()};
      if(o.receipts!=null&&(typeof o.receipts!=='object'||Array.isArray(o.receipts)))return {ok:false,value:_blank()};
      var allKeys=Object.keys(o.receipts||{});for(var i=0;i<allKeys.length;i++){if(!_validId(allKeys[i])||!_normReceipt(o.receipts[allKeys[i]]))return {ok:false,value:_blank()};}
      var value={
        owned: _normOwned(o.owned),
        frags: _normFrags(o.frags),
        pity: _nn(o.pity),
        totalDraws: _nn(o.totalDraws),
        pending: pending,
        lastReceipt: last,
        receipts: receipts
      };
      if(last&&!value.owned[last.result.lv])return {ok:false,value:_blank()};
      var keys=Object.keys(receipts);for(i=0;i<keys.length;i++){if(!value.owned[receipts[keys[i]].result.lv])return {ok:false,value:_blank()};}
      return {ok:true,value:value};
    }catch(e){ return {ok:false,value:_blank()}; }
  }
  function _read(){return _readState().value;}
  function _blank(){ return {owned:{}, frags:_normFrags(null), pity:0, totalDraws:0, pending:null, lastReceipt:null, receipts:{}}; }
  function _isNN(n){n=Number(n);return isFinite(n)&&Math.floor(n)===n&&n>=0;}
  function _nn(n){ n=Number(n); return isFinite(n)&&n>=0?Math.floor(n):0; }
  function _validId(id){return typeof id==='string'&&id.length>0&&id.length<=160&&/^[a-z0-9:_-]+$/i.test(id)&&!Object.prototype.hasOwnProperty.call(Object.prototype,id)&&id!=='prototype'&&id!=='constructor';}
  function _normOwned(src){
    var out={};
    if(!src||typeof src!=='object'||Array.isArray(src)) return out;
    for(var lv=1;lv<=20;lv++){ if(src[lv]===true) out[lv]=true; }
    return out;
  }
  function _normFrags(f){
    f = (f&&typeof f==='object')?f:{};
    return {
      common: _nn(f.common), uncommon: _nn(f.uncommon), rare: _nn(f.rare),
      epic: _nn(f.epic), legendary: _nn(f.legendary)
    };
  }
  function _normPending(p){
    if(!p||typeof p!=='object'||p.type!=='paid_draw') return null;
    var id=String(p.id||''),cost=_nn(p.cost),before=_nn(p.beforeCoins),lv=Number(p.lv)|0;
    if(!_validId(id)||cost<=0||before<cost||lv<1||lv>20||p.gotLegendary!==(lv>=17)||(p.stage!=='prepared'&&p.stage!=='spent')) return null;
    return {type:'paid_draw',id:id,cost:cost,beforeCoins:before,lv:lv,gotLegendary:lv>=17,stage:p.stage,createdAt:_nn(p.createdAt)};
  }
  function _normReceipt(r){
    if(!r||typeof r!=='object'||r.stage!=='delivered'||!_validId(String(r.id||''))||!r.result) return null;
    var x=r.result,lv=Number(x.lv)|0;
    if(lv<1||lv>20||typeof x.dup!=='boolean'||x.rarity!==rarityOfLv(lv)||!_isNN(x.frag)||(x.dup?x.frag<=0:x.frag!==0)) return null;
    return {id:String(r.id),stage:'delivered',result:{dup:x.dup,lv:lv,rarity:x.rarity,frag:Number(x.frag)},at:_nn(r.at)};
  }
  function _normReceipts(src){
    var out={};
    if(!src||typeof src!=='object'||Array.isArray(src))return out;
    Object.keys(src).slice(-100).forEach(function(id){
      var r=_normReceipt(src[id]);
      if(r&&r.id===id&&_validId(id))out[id]=r;
    });
    return out;
  }
  function _write(o){
    try{
      var raw=JSON.stringify(o);
      localStorage.setItem(KEY, raw);
      return localStorage.getItem(KEY)===raw;
    }catch(e){ return false; }
  }

  function _applyObtained(o,lv){
    var r=rarityOfLv(lv),result;
    if(o.owned[lv]){
      var DUP={common:10, uncommon:20, rare:40, epic:80, legendary:200};
      var add=DUP[r]||10;
      o.frags[r]=(o.frags[r]||0)+add;
      result={dup:true,lv:lv,rarity:r,frag:add};
    }else{
      o.owned[lv]=true;
      result={dup:false,lv:lv,rarity:r,frag:0};
    }
    return result;
  }
  function _applyDraw(o,lv,gotLegendary){
    o.pity=gotLegendary?0:(o.pity||0)+1;
    o.totalDraws=(o.totalDraws||0)+1;
    return _applyObtained(o,lv);
  }
  function _receiptAfterUncertainWrite(id){
    var check=_readState();
    return check.ok?_storedReceipt(check.value,id):null;
  }
  function _storedReceipt(o,id){
    if(!_validId(id))return null;
    if(o.lastReceipt&&o.lastReceipt.id===id&&o.owned[o.lastReceipt.result.lv])return o.lastReceipt.result;
    return o.receipts&&o.receipts[id]&&o.owned[o.receipts[id].result.lv]?o.receipts[id].result:null;
  }
  function _rememberReceipt(o,r){
    o.receipts=o.receipts||{};o.receipts[r.id]=r;
    var ids=Object.keys(o.receipts);while(ids.length>100){delete o.receipts[ids.shift()];}
  }
  function _walletState(wallet){
    try{if(!wallet||typeof wallet.get!=='function')return {ok:false,value:NaN};var raw=localStorage.getItem('hansen_wallet_coins'),stored=raw===null?0:Number(raw),api=Number(wallet.get());return isFinite(stored)&&Math.floor(stored)===stored&&stored>=0&&api===stored?{ok:true,value:stored}:{ok:false,value:NaN};}catch(e){return {ok:false,value:NaN};}
  }
  function _proofFor(p,state){return {version:942,id:p.id,cost:p.cost,beforeCoins:p.beforeCoins,targetCoins:p.beforeCoins-p.cost,lv:p.lv,state:state};}
  function _readProof(p){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return {ok:true,value:null};var x=JSON.parse(raw);if(!x||x.version!==942||x.id!==p.id||x.cost!==p.cost||x.beforeCoins!==p.beforeCoins||x.targetCoins!==p.beforeCoins-p.cost||x.lv!==p.lv||(x.state!=='prepared'&&x.state!=='paid'))return {ok:false,value:null};return {ok:true,value:x};}catch(e){return {ok:false,value:null};}}
  function _writeProof(p,state){try{var raw=JSON.stringify(_proofFor(p,state));localStorage.setItem(PROOF_KEY,raw);return localStorage.getItem(PROOF_KEY)===raw;}catch(e){return false;}}
  function _clearProof(p){try{var r=_readProof(p);if(!r.ok)return false;if(!r.value)return true;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function _clearOrphanProof(){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return true;var x=JSON.parse(raw),cost=Number(x&&x.cost),before=Number(x&&x.beforeCoins),lv=Number(x&&x.lv);if(!x||x.version!==942||!_validId(String(x.id||''))||!Number.isInteger(cost)||cost<=0||!Number.isInteger(before)||before<cost||x.targetCoins!==before-cost||!Number.isInteger(lv)||lv<1||lv>20||(x.state!=='prepared'&&x.state!=='paid'))return false;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function _finishPaidDelivery(p){
    if(!_clearProof(p))return false;var rs=_readState();if(!rs.ok)return false;var o=rs.value;
    if(!o.pending)return true;if(o.pending.id!==p.id||!_storedReceipt(o,p.id))return false;
    o.pending=null;return _write(o);
  }
  function _confirmProof(p,wallet,expectedCost){var ws=_walletState(wallet),r=_readProof(p);if(!ws.ok||p.cost!==expectedCost||ws.value!==p.beforeCoins-p.cost||!r.ok||!r.value)return false;return r.value.state==='paid'||_writeProof(p,'paid');}
  function _paymentVerified(p,wallet,expectedCost){var ws=_walletState(wallet),r=_readProof(p);return !!(ws.ok&&p.cost===expectedCost&&ws.value===p.beforeCoins-p.cost&&r.ok&&r.value&&r.value.state==='paid');}

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

    // 付费抽卡采用 write-ahead 日志：先持久化将要获得的卡，再扣币，最后把
    // 卡牌+pity+总抽数+收据一次写入。任意断点后都可据扣款前后余额精确恢复。
    beginPaidDraw: function(tx){
      tx=tx||{};
      var rs=_readState();if(!rs.ok)return false;var o=rs.value,id=String(tx.id||''),lv=Number(tx.lv)|0,cost=_nn(tx.cost),before=_nn(tx.beforeCoins);
      if(_storedReceipt(o,id)) return true;
      if(o.pending){var proof=_readProof(o.pending);return o.pending.id===id&&proof.ok&&!!proof.value;}
      if(!_validId(id)||lv<1||lv>20||cost<=0||before<cost) return false;
      o.pending={type:'paid_draw',id:id,cost:cost,beforeCoins:before,lv:lv,gotLegendary:lv>=17,stage:'prepared',createdAt:Date.now()};
      if(!_write(o))return false;if(_writeProof(o.pending,'prepared'))return true;if(!_clearProof(o.pending))return false;o.pending=null;_write(o);return false;
    },
    markPaidDrawSpent: function(id){
      id=String(id||''); var rs=_readState();if(!rs.ok)return false;var o=rs.value;
      if(o.lastReceipt&&o.lastReceipt.id===id) return true;
      if(!o.pending||o.pending.id!==id) return false;
      o.pending.stage='spent'; return _write(o);
    },
    confirmPaidDraw: function(id,wallet,expectedCost){
      id=String(id||'');var rs=_readState();if(!rs.ok||!rs.value.pending||rs.value.pending.id!==id)return false;
      expectedCost=Math.floor(Number(expectedCost));return isFinite(expectedCost)&&expectedCost>0&&_confirmProof(rs.value.pending,wallet,expectedCost);
    },
    finalizePaidDraw: function(id,wallet,expectedCost){
      id=String(id||''); var rs=_readState();if(!rs.ok)return null;var o=rs.value;
      if(o.lastReceipt&&o.lastReceipt.id===id) return o.lastReceipt.result;
      expectedCost=Math.floor(Number(expectedCost));if(!o.pending||o.pending.id!==id||!isFinite(expectedCost)||expectedCost<=0||!_paymentVerified(o.pending,wallet,expectedCost)) return null;
      var p=o.pending,result=_applyDraw(o,p.lv,p.gotLegendary);
      o.lastReceipt={id:id,stage:'delivered',result:result,at:Date.now()};_rememberReceipt(o,o.lastReceipt);
      if(_write(o)){_finishPaidDelivery(p);return result;}
      var uncertain=_receiptAfterUncertainWrite(id);if(uncertain)_finishPaidDelivery(p);return uncertain;
    },
    cancelPaidDraw: function(id){
      id=String(id||''); var rs=_readState();if(!rs.ok)return false;var o=rs.value;
      if(!o.pending) return true;
      if(o.pending.id!==id) return false;
      var pf=_readProof(o.pending);if(!pf.ok||(pf.value&&pf.value.state==='paid')||(pf.value&&!_clearProof(o.pending)))return false;
      o.pending=null; return _write(o);
    },
    recoverPaidDraw: function(wallet,expectedCost){
      var rs=_readState();if(!rs.ok)return {status:'pending',reason:'storage'};var o=rs.value,p=o.pending;
      if(!p) return {status:_clearOrphanProof()?'none':'pending',reason:'proof'};
      var already=_storedReceipt(o,p.id);if(already)return {status:_finishPaidDelivery(p)?'committed':'pending',id:p.id,result:already};
      if(expectedCost!=null){
        expectedCost=Math.floor(Number(expectedCost));
        if(!isFinite(expectedCost)||expectedCost<=0||p.cost!==expectedCost){
          /* 价格只由当前正式抽卡模块决定；备份里的 cost 不能决定发什么、扣多少。 */
          return {status:this.cancelPaidDraw(p.id)?'invalid':'pending',id:p.id};
        }
      }
      var ws=_walletState(wallet);if(!ws.ok)return {status:'pending',id:p.id};var balance=ws.value,pf=_readProof(p);if(!pf.ok)return {status:'pending',id:p.id};
      if(balance===p.beforeCoins-p.cost&&pf.value&&_confirmProof(p,wallet,expectedCost)){
        var result=this.finalizePaidDraw(p.id,wallet,expectedCost);
        return result?{status:'committed',id:p.id,result:result}:{status:'pending',id:p.id};
      }
      if(balance===p.beforeCoins){
        if(pf.value&&pf.value.state==='paid')return {status:'pending',id:p.id};
        return {status:this.cancelPaidDraw(p.id)?'cancelled':'pending',id:p.id};
      }
      // 余额被其它行为改动时不猜测、不补发，保留日志供下一次明确处理。
      return {status:'pending',id:p.id};
    },
    pendingPaidDraw: function(){ var p=_read().pending; return p?Object.assign({},p):null; },
    receipt: function(id){ var o=_read(),r=_storedReceipt(o,String(id||''));return r?Object.assign({},r):null; },

    // 免费抽卡也把 pity 与卡牌放进同一个严格写入，杜绝只涨保底却没拿到卡。
    commitFreeDraw: function(id,lv,gotLegendary){
      id=String(id||''); lv=Number(lv)|0; var rs=_readState();if(!rs.ok)return null;var o=rs.value;
      var prior=_storedReceipt(o,id);if(prior)return prior;
      if(!_validId(id)||lv<1||lv>20||o.pending) return null;
      var result=_applyDraw(o,lv,lv>=17);
      o.lastReceipt={id:id,stage:'delivered',result:result,at:Date.now()};_rememberReceipt(o,o.lastReceipt);
      if(_write(o)) return result;
      return _receiptAfterUncertainWrite(id);
    },

    // 获得一张卡。若已拥有 → 转碎片(返回 {dup:true, rarity, frag});若新卡 → 收入(返回 {dup:false, lv, rarity})
    // dupFrag: 重复卡给的碎片数(由调用方按稀有度传, 或这里默认表)
    obtain: function(lv){
      var rs=_readState();if(!rs.ok)return null;var o=rs.value;
      lv=Number(lv)|0; if(lv<1||lv>20||o.pending) return null;
      var result=_applyObtained(o,lv);
      return _write(o)?result:null;
    },

    // 用碎片兑换该稀有度的一张未拥有的卡。成功返回兑换到的lv, 失败返回null。
    // 至尊(legendary)永远不能兑换。
    exchangeByFrag: function(rarity){
      if(rarity==='legendary') return null;  // 至尊不能换
      var COST={common:50, uncommon:100, rare:200, epic:400};
      var cost=COST[rarity]; if(!cost) return null;
      var rs=_readState();if(!rs.ok)return null;var o=rs.value;
      if((o.frags[rarity]||0) < cost) return null;  // 碎片不够
      // 找一张该稀有度、还没拥有的卡
      var range={common:[1,4],uncommon:[5,8],rare:[9,12],epic:[13,16]}[rarity];
      var pick=null;
      for(var lv=range[0]; lv<=range[1]; lv++){ if(!o.owned[lv]){ pick=lv; break; } }
      if(pick===null) return null;  // 该档已集齐
      o.frags[rarity] -= cost;
      o.owned[pick] = true;
      return _write(o)?pick:null;
    },

    // 抽卡保底: 抽一次后更新pity。出至尊传 true(清零), 否则 false(+1)。
    bumpPity: function(gotLegendary){
      var rs=_readState();if(!rs.ok)return false;var o=rs.value;
      if(gotLegendary) o.pity=0; else o.pity=(o.pity||0)+1;
      o.totalDraws=(o.totalDraws||0)+1;
      return _write(o);
    },
    // 直接设pity(测试/特殊用)
    setPity: function(n){ var rs=_readState();if(!rs.ok)return false;var o=rs.value;o.pity=_nn(n); return _write(o); }
  };
})();
