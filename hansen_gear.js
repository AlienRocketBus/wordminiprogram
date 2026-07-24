// hansen_gear.js v942 — 攻防成长系统 + 可恢复钻石购买事务
// ============================================================
// 用钻石(HansenGems)解锁三条成长线，对抗越来越强的 Boss：
//   ⚔️ 武器：弓箭→手枪→机枪→狙击枪→加特林→加农炮→光子炮  (提升对Boss攻击)
//   🛡️ 血量：100→500 (扛更多次答错，全20关都有效(v617改全固定后高关也生效))
//   🦺 护甲：0%→50% 减伤 (全20关全效, v617起护甲对所有boss全效·不再高关半效)
// 对外接口供 Boss 战调用：HansenGear.getWeaponAtk()/getMaxHP()/getArmorPct()
// 仿 hansen_diamond_shop 模式：独立 IIFE，自动注入入口，零侵入。
// 🎨 商店多配色(SKINS)：默认"跟随游戏主题"(用 --th-bg-* 变量, 换游戏主题商店自动变色),
//    另有暗夜/暖阳/樱粉/森林/纯净(亮)5 套固定皮肤; 顶部色块切换, 存 localStorage。
// 全程无旋转/闪烁/震动(防晕铁律)。
// ============================================================
(function(){
  if(window.__hansenGearLoaded){ return; } window.__hansenGearLoaded = true;

  var KEY = 'hansen_gear';   // { weaponLvl:0-6, hpLvl:0-10, armorLvl:0-8 }
  var PENDING_KEY = 'hansen_gear_purchase_pending_v942';
  var PROOF_KEY = 'hansen_gear_purchase_transaction_v942';

  // ===== 数值表(与《Boss攻防成长系统设计方案》一致) =====
  var WEAPONS = [
    { name:'弓箭',   min:12, max:19,  price:0,   glow:'#2ec4b6' },   // 0 初始自带
    { name:'手枪',   min:18, max:26,  price:45,  glow:'#f0b429' },   // 1
    { name:'机枪',   min:26, max:36,  price:80,  glow:'#38bdf8' },   // 2
    { name:'狙击枪', min:36, max:48,  price:130, glow:'#ef4444' },   // 3
    { name:'加特林', min:48, max:62,  price:185, glow:'#f59e0b' },   // 4
    { name:'加农炮', min:62, max:80,  price:250, glow:'#fb7c3c' },   // 5
    { name:'光子炮', min:80, max:100, price:330, glow:'#a855f7' }    // 6
  ];
  var HP_BASE = 100, HP_STEP = 40;                                   // 100→500
  var HP_PRICES   = [20,30,45,60,80,105,135,170,210,265];            // 升到 Lv1..Lv10
  var ARMOR_PCTS  = [0,6,12,18,24,30,37,44,50];                      // Lv0..Lv8 减伤%
  var ARMOR_PRICES= [30,45,65,95,130,175,225,290];                   // 升到 Lv1..Lv8

  // ===== 存档 =====
  function readState(){
    try{ var raw=localStorage.getItem(KEY);if(raw===null)return {ok:true,value:{ weaponLvl:0, hpLvl:0, armorLvl:0 }};var o=JSON.parse(raw); if(o&&typeof o==='object'&&!Array.isArray(o)){
      if(o.weaponLvl!=null&&(!Number.isInteger(Number(o.weaponLvl))||Number(o.weaponLvl)<0||Number(o.weaponLvl)>6))return {ok:false,value:null};
      if(o.hpLvl!=null&&(!Number.isInteger(Number(o.hpLvl))||Number(o.hpLvl)<0||Number(o.hpLvl)>10))return {ok:false,value:null};
      if(o.armorLvl!=null&&(!Number.isInteger(Number(o.armorLvl))||Number(o.armorLvl)<0||Number(o.armorLvl)>8))return {ok:false,value:null};
      o.weaponLvl=o.weaponLvl==null?0:Number(o.weaponLvl);
      o.hpLvl=o.hpLvl==null?0:Number(o.hpLvl);
      o.armorLvl=o.armorLvl==null?0:Number(o.armorLvl);
      return {ok:true,value:o};
    }return {ok:false,value:null};}catch(e){return {ok:false,value:null};}
  }
  function read(){var r=readState();return r.ok?r.value:{ weaponLvl:0, hpLvl:0, armorLvl:0 };}
  function write(o){ try{var raw=JSON.stringify(o);localStorage.setItem(KEY,raw);return localStorage.getItem(KEY)===raw;}catch(e){return false;} }

  //🔴v853 武器试用功能完全移除(Hansen·"武器完全没有任何试用功能"): 有效武器等级=真实拥有的武器·不再有试玩临时武器。
  function effWeaponLvl(){ return read().weaponLvl; }

  // ===== 对外接口(供 Boss 战集成调用) =====
  window.HansenGear = {
    getWeaponLvl: function(){ return effWeaponLvl(); },
    getWeaponIcon:function(){ return (WICON[effWeaponLvl()]||WICON[0]); },  // 当前武器图标(<img>) · 勇者血条左侧武器框 + 攻击特效起点用
    getWeaponName:function(){ return WEAPONS[effWeaponLvl()].name; },
    //🔴v853 武器皮肤化(Hansen·"武器只作为皮肤·只增加攻击特效·原来的攻击一模一样·加大伤害完全没必要"): 攻击伤害固定=基础弓箭(所有武器一样·武器只换攻击特效不加战力·新玩家本来就是弓箭伤害·Boss血量早按此调好)。
    getWeaponAtk: function(){ var w=WEAPONS[0]; return w.min + Math.floor(Math.random()*(w.max-w.min+1)); },
    getWeaponRange:function(){ return [WEAPONS[0].min, WEAPONS[0].max]; },
    getMaxHP:     function(){ return HP_BASE + read().hpLvl*HP_STEP; },
    getArmorPct:  function(){ return 0; },   //🔴v853 护甲删除(Hansen·"护甲没什么必要"): 恒0减伤·Boss战护甲项自然失效·商店护甲页签已删。
    open: openShop,
    buy: purchaseGear,
    recoverPurchase: recoverPurchase,
    pendingKey: PENDING_KEY
  };

  // ===== 武器图标 =====
  var WICON = {
    0:'<img src="weapons/bow.webp?v=997" alt="">',
    1:'<img src="weapons/pistol.webp?v=997" alt="">',
    2:'<img src="weapons/machinegun.webp?v=997" alt="">',
    3:'<img src="weapons/sniper.webp?v=997" alt="">',
    4:'<img src="weapons/gatling.webp?v=997" alt="">',
    5:'<img src="weapons/cannon.webp?v=997" alt="">',
    6:'<img src="weapons/photon.webp?v=997" alt="">'
  };

  // ===== 🎨 配色皮肤(12 变量/套) =====
  // auto = 跟随游戏主题(用 --th-bg-* 继承自 body[data-theme], 换主题商店自动变色; 带 fallback 防变量缺失)
  var SKIN_KEY = 'hansen_gear_skin';
  var SKINS = {
    cream:    {label:'🍦 奶油', mask:'rgba(60,45,30,.42)', pa:'#fffaf2', pb:'#faefdc', bd:'#ecd6b4', chip:'#f6e8d4', mute:'#ede2cc', ac:'#e8920a', ac2:'#d97706', bt:'#fff8ec', tx:'#4a3826', sub:'#8a6d4a', sub2:'#b89a6a'},
    mint:     {label:'🌿 薄荷', mask:'rgba(20,50,40,.40)', pa:'#f4fdf9', pb:'#e4f7ee', bd:'#b6e2cc', chip:'#daf2e6', mute:'#cce9d8', ac:'#10b981', ac2:'#059669', bt:'#f0fdf8', tx:'#1a3a2e', sub:'#4d8068', sub2:'#7cb89e'},
    sky:      {label:'☁️ 天空', mask:'rgba(20,40,70,.40)', pa:'#f4f9ff', pb:'#e3effc', bd:'#bad9f1', chip:'#dcecfb', mute:'#cce2f5', ac:'#2563eb', ac2:'#1d4ed8', bt:'#f0f7ff', tx:'#1e3a5f', sub:'#4d6f9c', sub2:'#80a2cc'},
    peach:    {label:'🍑 蜜桃', mask:'rgba(60,30,25,.40)', pa:'#fff6f1', pb:'#ffe8dc', bd:'#f6ccb6', chip:'#ffe0d2', mute:'#f6d4c4', ac:'#f4715f', ac2:'#e54a38', bt:'#fff6f1', tx:'#5a322a', sub:'#9c6858', sub2:'#cc9686'},
    lavender: {label:'💜 薰衣草', mask:'rgba(40,30,60,.40)', pa:'#f8f6ff', pb:'#ece7fd', bd:'#d4caf0', chip:'#e6dffb', mute:'#ddd4f2', ac:'#8b5cf6', ac2:'#7c3aed', bt:'#f8f6ff', tx:'#3a2e5a', sub:'#705c9e', sub2:'#a294c8'},
    light:    {label:'⚪ 纯净', mask:'rgba(40,50,70,.40)', pa:'#ffffff', pb:'#f1f5f9', bd:'#cbd5e1', chip:'#eef2f7', mute:'#e2e8f0', ac:'#e8920a', ac2:'#d97706', bt:'#fff7ed', tx:'#1e293b', sub:'#64748b', sub2:'#94a3b8'}
  };
  var SKIN_ORDER = ['cream','mint','sky','peach','lavender','light'];
  var curSkin = (function(){ try{ var k=localStorage.getItem(SKIN_KEY); return SKINS[k]?k:'cream'; }catch(e){ return 'cream'; } })();
  function applySkin(key){
    if(!SKINS[key]) key='auto';
    curSkin=key;
    try{ localStorage.setItem(SKIN_KEY,key); }catch(e){}
    var mask=document.getElementById('hsnGearMask'); if(!mask) return;
    var s=SKINS[key];
    for(var k in s){ if(k==='label') continue; mask.style.setProperty('--hg-'+k, s[k]); }
  }

  // ===== CSS(全变量化, 支持多皮肤; 无动画, 防晕) =====
  function injectCSS(){
    if(document.getElementById('hsnGearCSS')) return;
    var css = ''
    + '#hsnGearMask{--hg-mask:rgba(6,10,20,.78);--hg-pa:#16203a;--hg-pb:#0f1729;--hg-bd:#2c3b5e;--hg-chip:#0c1428;--hg-mute:#243352;--hg-ac:#fbd24e;--hg-ac2:#f0b429;--hg-bt:#1a1205;--hg-tx:#f7fafc;--hg-sub:#9fb0c8;--hg-sub2:#64789a;position:fixed;inset:0;z-index:99999;background:var(--hg-mask);display:none;align-items:center;justify-content:center;padding:16px}'
    + '#hsnGearMask.show{display:flex}'
    + '.hg-panel{width:100%;max-width:520px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;background:linear-gradient(180deg,var(--hg-pa),var(--hg-pb));border:1px solid var(--hg-bd);border-radius:20px;box-shadow:0 24px 60px -20px rgba(0,0,0,.55);font-family:"PingFang SC","Microsoft YaHei",sans-serif}'
    + '.hg-head{display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--hg-bd)}'
    + '.hg-title{font-size:18px;font-weight:900;color:var(--hg-tx);letter-spacing:.04em}'
    + '.hg-bal{margin-left:auto;font-size:14px;font-weight:800;color:var(--hg-ac);background:var(--hg-chip);border:1px solid var(--hg-bd);border-radius:99px;padding:5px 12px}'
    + '.hg-close{margin-left:6px;width:30px;height:30px;border:0;border-radius:8px;background:var(--hg-mute);color:var(--hg-sub);font-size:18px;cursor:pointer;line-height:1}'
    + '.hg-tabs{display:flex;gap:8px;padding:12px 18px 0}'
    + '.hg-tab{flex:1;text-align:center;padding:9px 4px;border-radius:10px 10px 0 0;background:var(--hg-chip);color:var(--hg-sub);font-size:14px;font-weight:800;cursor:pointer;border:1px solid transparent;border-bottom:none}'
    + '.hg-tab.on{background:var(--hg-pa);color:var(--hg-ac);border-color:var(--hg-bd)}'
    + '.hg-body{padding:14px 18px 18px;overflow-y:auto}'
    + '.hg-skins{display:flex;gap:6px;flex-wrap:wrap;margin:0}'
    + '.hg-skinbar-label{font-size:11px;font-weight:700;color:var(--hg-sub2);text-align:center;margin:8px 0 8px;padding-top:12px;border-top:1px dashed var(--hg-bd)}' /* 🔴BUG#75: 底部配色条的轻量分隔标签 */
    + '.hg-skin{flex:1;min-width:54px;text-align:center;padding:8px 3px;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;border:2px solid transparent}'
    + '.hg-skin.on{box-shadow:0 0 0 2px var(--hg-ac),0 4px 12px -3px rgba(0,0,0,.55)}'
    + '.hg-row{display:flex;align-items:center;gap:12px;background:linear-gradient(165deg,var(--hg-pa),var(--hg-pb));border:1px solid var(--hg-bd);border-radius:14px;padding:11px 13px;margin-bottom:10px}'
    + '.hg-row.cur{border-color:var(--hg-ac);box-shadow:0 0 0 1px var(--hg-ac) inset}'
    + '.hg-row.locked{opacity:.5}'
    + '.hg-ic{width:66px;height:66px;flex:none;display:grid;place-items:center;background:transparent;border:0;border-radius:13px;box-shadow:none}' /* 🔴BUG#75: 原深蓝径向框在亮主题下很违和; 改透明, 让透明武器PNG直接落在亮卡片上融为一体 */
    + '.hg-ic svg{width:54px;height:54px}'
    + '.hg-ic img{width:60px;height:60px;object-fit:contain;display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.22))}' /* 🔴BUG#75: 投影由 .6 深黑改 .22 柔和, 适配亮底 */
    + '.hg-meta{flex:1;min-width:0}'
    + '.hg-nm{font-size:15px;font-weight:800;color:var(--hg-tx)}'
    + '.hg-sub{font-size:12px;color:var(--hg-sub);margin-top:2px}'
    + '.hg-sub b{color:var(--hg-ac)}'
    + '.hg-lvbadge{font-size:11px;font-weight:800;color:var(--hg-sub2);background:var(--hg-chip);border-radius:6px;padding:2px 7px;margin-right:6px}'
    + '.hg-act{flex:none}'
    + '.hg-btn{border:0;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}'
    + '.hg-btn.buy{background:linear-gradient(180deg,var(--hg-ac),var(--hg-ac2));color:var(--hg-bt);box-shadow:0 6px 14px -7px rgba(0,0,0,.5)}'
    + '.hg-btn.poor{background:var(--hg-mute);color:var(--hg-sub2);cursor:not-allowed}'
    + '.hg-tag{font-size:12px;font-weight:800;padding:6px 10px;border-radius:8px}'
    + '.hg-tag.owned{color:#7dd3a8;background:rgba(125,211,168,.14)}'
    + '.hg-tag.cur{color:var(--hg-bt);background:linear-gradient(180deg,var(--hg-ac),var(--hg-ac2))}'
    + '.hg-tag.max{color:var(--hg-sub);background:var(--hg-mute)}'
    + '.hg-toast{position:fixed;left:50%;bottom:14%;transform:translateX(-50%);background:var(--hg-pa,#1a2440);color:var(--hg-tx,#fff);border:1px solid var(--hg-bd,#2c3b5e);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;z-index:100001;box-shadow:0 10px 30px -10px rgba(0,0,0,.6);max-width:80%;text-align:center}'
    + '.hg-hint{font-size:12px;color:var(--hg-sub2);text-align:center;margin:2px 0 12px;line-height:1.5}';
    var st=document.createElement('style'); st.id='hsnGearCSS'; st.textContent=css; document.head.appendChild(st);
  }

  function gemsState(){try{if(!window.HansenGems||typeof HansenGems.get!=='function')return {ok:false,value:NaN};var raw=localStorage.getItem('hansen_wallet_gems'),stored=raw===null?0:Number(raw),api=Number(HansenGems.get());return isFinite(stored)&&Math.floor(stored)===stored&&stored>=0&&api===stored?{ok:true,value:stored}:{ok:false,value:NaN};}catch(e){return {ok:false,value:NaN};}}
  function gems(){var r=gemsState();return r.ok?r.value:NaN;}
  function spendGems(n){ return (window.HansenGems && HansenGems.spend) ? HansenGems.spend(n) : false; }

  function priceFor(kind,level){
    if(kind==='weapon'&&level>=1&&level<WEAPONS.length)return WEAPONS[level].price;
    if(kind==='hp'&&level>=1&&level<=HP_PRICES.length)return HP_PRICES[level-1];
    return 0;
  }
  function readPending(){
    try{var raw=localStorage.getItem(PENDING_KEY);if(raw===null)return {ok:true,value:null};var p=JSON.parse(raw);if(!p||p.version!==942||(p.kind!=='weapon'&&p.kind!=='hp'))return {ok:false,value:null};
      var level=Math.floor(Number(p.level)),price=priceFor(p.kind,level),before=Math.floor(Number(p.before));
      if(!price||p.price!==price||!isFinite(before)||before<price||p.after!==before-price||(p.stage!=='prepared'&&p.stage!=='spent')||!/^gear-[a-z0-9-]{8,160}$/i.test(String(p.txid||'')))return {ok:false,value:null};
      return {ok:true,value:{version:942,txid:String(p.txid),kind:p.kind,level:level,price:price,before:before,after:before-price,stage:p.stage}};
    }catch(e){return {ok:false,value:null};}
  }
  function writePending(p){try{var raw=JSON.stringify(p);localStorage.setItem(PENDING_KEY,raw);return localStorage.getItem(PENDING_KEY)===raw;}catch(e){return false;}}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY);return localStorage.getItem(PENDING_KEY)===null;}catch(e){return false;}}
  function proofFor(p,state){return {version:942,txid:p.txid,kind:p.kind,level:p.level,price:p.price,before:p.before,after:p.after,state:state};}
  function readProof(p){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return {ok:true,value:null};var x=JSON.parse(raw);if(!x||x.version!==942||x.txid!==p.txid||x.kind!==p.kind||x.level!==p.level||x.price!==p.price||x.before!==p.before||x.after!==p.after||(x.state!=='prepared'&&x.state!=='paid'))return {ok:false,value:null};return {ok:true,value:x};}catch(e){return {ok:false,value:null};}}
  function writeProof(p,state){try{var raw=JSON.stringify(proofFor(p,state));localStorage.setItem(PROOF_KEY,raw);return localStorage.getItem(PROOF_KEY)===raw;}catch(e){return false;}}
  function confirmProof(p,balance){var r=readProof(p);if(!r.ok||!r.value||balance!==p.after)return false;return r.value.state==='paid'||writeProof(p,'paid');}
  function clearProof(p){try{var r=readProof(p);if(!r.ok)return false;if(!r.value)return true;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function cleanup(p){return clearProof(p)&&clearPending();}
  function clearOrphanProof(){try{var raw=localStorage.getItem(PROOF_KEY);if(raw===null)return true;var x=JSON.parse(raw),level=Math.floor(Number(x&&x.level)),price=x&&priceFor(x.kind,level),before=Number(x&&x.before);if(!x||x.version!==942||!price||x.price!==price||!isFinite(before)||Math.floor(before)!==before||before<price||x.after!==before-price||(x.state!=='prepared'&&x.state!=='paid')||!/^gear-[a-z0-9-]{8,160}$/i.test(String(x.txid||'')))return false;localStorage.removeItem(PROOF_KEY);return localStorage.getItem(PROOF_KEY)===null;}catch(e){return false;}}
  function assetLevel(p){var r=readState();return r.ok?{ok:true,value:p.kind==='weapon'?r.value.weaponLvl:r.value.hpLvl}:{ok:false,value:0};}
  function deliver(p){
    var r=readState();if(!r.ok)return false;var g=r.value,prop=p.kind==='weapon'?'weaponLvl':'hpLvl',cur=g[prop];if(cur>=p.level)return true;
    var gs=gemsState(),pf=readProof(p);if(cur!==p.level-1||!gs.ok||gs.value!==p.after||!pf.ok||!pf.value||pf.value.state!=='paid')return false;g[prop]=p.level;if(!write(g))return false;var check=readState();return check.ok&&check.value[prop]>=p.level;
  }
  function recoverPurchase(){
    var pr=readPending();if(!pr.ok)return {status:'pending',reason:'storage'};var p=pr.value;if(!p)return {status:clearOrphanProof()?'none':'pending',reason:'proof'};
    var level=assetLevel(p);if(!level.ok)return {status:'pending',kind:p.kind,level:p.level};if(level.value>=p.level){return {status:cleanup(p)?'committed':'pending',kind:p.kind,level:p.level};}
    var gs=gemsState();if(!gs.ok)return {status:'pending',kind:p.kind,level:p.level};var balance=gs.value,pf=readProof(p);if(!pf.ok)return {status:'pending',kind:p.kind,level:p.level};
    if(balance===p.before){if(pf.value&&pf.value.state==='paid')return {status:'pending',kind:p.kind,level:p.level};return {status:cleanup(p)?'cancelled':'pending',kind:p.kind,level:p.level};}
    if(balance!==p.after||!pf.value||!confirmProof(p,balance))return {status:'pending',kind:p.kind,level:p.level};
    if(!deliver(p))return {status:'pending',kind:p.kind,level:p.level};
    return {status:cleanup(p)?'committed':'pending',kind:p.kind,level:p.level};
  }
  function purchaseGear(kind){
    var prior=recoverPurchase();if(prior.status==='pending'||prior.status==='committed')return prior;
    var gr=readState(),gs=gemsState();if(!gr.ok||!gs.ok)return {status:'rejected',kind:kind};var g=gr.value,level=kind==='weapon'?g.weaponLvl+1:(kind==='hp'?g.hpLvl+1:0),price=priceFor(kind,level),before=gs.value;
    if(!price||before<price)return {status:'rejected',kind:kind};
    var p={version:942,txid:'gear-'+Date.now()+'-'+Math.random().toString(36).slice(2,10),kind:kind,level:level,price:price,before:before,after:before-price,stage:'prepared'};
    if(!writePending(p))return {status:'rejected',kind:kind};
    if(!writeProof(p,'prepared')){cleanup(p);return {status:'rejected',kind:kind};}spendGems(price);var as=gemsState();if(!as.ok)return {status:'pending',kind:kind,level:level};var after=as.value;
    if(after===p.before){cleanup(p);return {status:'rejected',kind:kind};}if(after!==p.after||!confirmProof(p,after))return {status:'pending',kind:kind,level:level};
    p.stage='spent';writePending(p);
    if(!deliver(p))return {status:'pending',kind:kind,level:level};
    return {status:cleanup(p)?'committed':'pending',kind:kind,level:level};
  }

  function toast(msg){
    var t=document.createElement('div'); t.className='hg-toast'; t.textContent=msg; document.body.appendChild(t);
    setTimeout(function(){ try{ t.style.transition='opacity .3s'; t.style.opacity='0'; }catch(e){} }, 1400);
    setTimeout(function(){ try{ t.remove(); }catch(e){} }, 1750);
  }

  var curTab = 'weapon';

  function openShop(){
    injectCSS();
    var mask=document.getElementById('hsnGearMask');
    if(!mask){
      mask=document.createElement('div'); mask.id='hsnGearMask';
      mask.innerHTML='<div class="hg-panel">'
        + '<div class="hg-head"><span class="hg-title">⚔️ 装备成长</span><span class="hg-bal" id="hgBal">💎 0</span><button class="hg-close" id="hgClose">×</button></div>'
        + '<div class="hg-tabs">'
          + '<div class="hg-tab" data-tab="weapon">武器皮肤</div>'
          + '<div class="hg-tab" data-tab="hp">血量</div>'
        + '</div>'
        + '<div class="hg-body" id="hgBody"></div>'
      + '</div>';
      document.body.appendChild(mask);
      mask.addEventListener('click', function(e){ if(e.target===mask) closeShop(); });
      mask.querySelector('#hgClose').addEventListener('click', closeShop);
      mask.querySelectorAll('.hg-tab').forEach(function(tb){
        tb.addEventListener('click', function(){ curTab=tb.getAttribute('data-tab'); render(); });
      });
    }
    mask.classList.add('show');
    applySkin(curSkin);   // 🎨 应用当前皮肤(默认跟随游戏主题)
    render();
  }
  function closeShop(){ var m=document.getElementById('hsnGearMask'); if(m) m.classList.remove('show'); }

  function render(){
    var mask=document.getElementById('hsnGearMask'); if(!mask) return;
    mask.querySelector('#hgBal').textContent='💎 '+gems();
    mask.querySelectorAll('.hg-tab').forEach(function(tb){ tb.classList.toggle('on', tb.getAttribute('data-tab')===curTab); });
    var body=mask.querySelector('#hgBody'); var g=read(); var h='';

    if(curTab==='weapon'){
      //🔴v853 武器试用功能完全移除(Hansen·"武器完全没有任何试用功能"): 去掉"全武器试玩24小时"按钮+每把武器的"试用"按钮+试玩期临时切换武器。武器只按真实拥有渲染。
      h+='<div class="hg-hint">武器只是攻击特效皮肤，伤害都一样。按顺序解锁，自动换上最新那把的攻击动画。</div>';
      for(var i=0;i<WEAPONS.length;i++){
        var w=WEAPONS[i], cls='hg-row', act='';
        if(i < g.weaponLvl){ cls+=' '; act='<span class="hg-tag owned">已拥有</span>'; }
        else if(i === g.weaponLvl){ cls+=' cur'; act='<span class="hg-tag cur">使用中</span>'; }
        else if(i === g.weaponLvl+1){ act = gems()>=w.price
            ? '<button class="hg-btn buy" data-act="buyW">解锁 '+w.price+' 💎</button>'
            : '<button class="hg-btn poor">需 '+w.price+' 💎</button>'; }
        else { cls+=' locked'; act='<span class="hg-tag max">未解锁</span>'; }
        h+='<div class="'+cls+'"><div class="hg-ic">'+WICON[i]+'</div><div class="hg-meta"><div class="hg-nm">'+w.name+'</div><div class="hg-sub">🎬 攻击特效皮肤</div></div><div class="hg-act">'+act+'</div></div>'; // 🔴v853 武器皮肤化: 去掉"攻击力X–Y"(所有武器伤害一样·显示战力会误导)·改标"攻击特效皮肤"。BUG#75武器透明PNG直贴亮卡片
      }
    }
    else if(curTab==='hp'){
      h+='<div class="hg-hint">血量上限，能扛更多次答错（全部 Boss 都有效，血越厚扛得越久）。</div>';
      for(var L=0;L<=10;L++){
        var hp=HP_BASE+L*HP_STEP, cls2='hg-row', act2='', price2=HP_PRICES[L-1];
        if(L < g.hpLvl){ act2='<span class="hg-tag owned">已升级</span>'; }
        else if(L === g.hpLvl){ cls2+=' cur'; act2 = (L===10)?'<span class="hg-tag max">已满级</span>':'<span class="hg-tag cur">当前</span>'; }
        else if(L === g.hpLvl+1){ act2 = gems()>=price2
            ? '<button class="hg-btn buy" data-act="buyHP">升级 '+price2+' 💎</button>'
            : '<button class="hg-btn poor">需 '+price2+' 💎</button>'; }
        else { cls2+=' locked'; act2='<span class="hg-tag max">未解锁</span>'; }
        h+='<div class="'+cls2+'"><div class="hg-meta"><div class="hg-nm"><span class="hg-lvbadge">Lv'+L+'</span>血量 '+hp+'</div><div class="hg-sub">'+(L===0?'初始':'+'+(L*HP_STEP)+' 累计')+'</div></div><div class="hg-act">'+act2+'</div></div>';
      }
    }
    //🔴v853 护甲删除(Hansen·"护甲没什么必要"): 删掉整个护甲页签渲染分支。只剩武器皮肤+血量两个页签。

    // 🎨 配色切换条(移到底部·BUG#75 Hansen: 不放最上抢重点, 放底部供用户自由切换)
    h+='<div class="hg-skinbar-label">🎨 面板配色</div>';
    h+='<div class="hg-skins">';
    for(var si=0;si<SKIN_ORDER.length;si++){
      var sk=SKIN_ORDER[si], s=SKINS[sk], on=(sk===curSkin)?' on':'';
      h+='<div class="hg-skin'+on+'" data-skin="'+sk+'" style="background:linear-gradient(135deg,'+s.pa+','+s.pb+');color:'+s.tx+';border-color:'+s.bd+'">'+s.label+'</div>';
    }
    h+='</div>';

    body.innerHTML=h;
    // 绑定配色切换
    body.querySelectorAll('.hg-skin').forEach(function(el){
      el.addEventListener('click', function(){ applySkin(el.getAttribute('data-skin')); render(); });
    });
    // 绑定购买
    body.querySelectorAll('[data-act]').forEach(function(btn){
      btn.addEventListener('click', function(){ buy(btn.getAttribute('data-act'), btn.getAttribute('data-wi')); });
    });
  }

  function buy(type, wi){
    var g=read(), result, label;
    //🔴v853 武器试用功能完全移除(Hansen·"武器完全没有任何试用功能"): 删掉 startTrial(开启全武器试玩) + trialW(试玩期切换武器) 两个处理器。
    if(type==='buyW'){ var nw=WEAPONS[g.weaponLvl+1]; if(!nw) return;label=nw.name;result=purchaseGear('weapon');
      if(result.status!=='committed'){toast(result.status==='pending'?'钻石已扣，皮肤将在重载后自动交付且不会重复扣款':'钻石不够或购买记录无法保存，本次未扣款');return;}
      toast('已解锁皮肤「'+label+'」！打 Boss 换上更酷的攻击特效 🎬'); }  //🔴v853 武器皮肤化: 解锁的是攻击特效皮肤·不加战力
    else if(type==='buyHP'){ if(g.hpLvl>=10) return;result=purchaseGear('hp');
      if(result.status!=='committed'){toast(result.status==='pending'?'钻石已扣，血量升级将在重载后自动交付':'钻石不够或购买记录无法保存，本次未扣款');return;}
      var latest=read();toast('血量上限提升到 '+(HP_BASE+latest.hpLvl*HP_STEP)+'！'); }
    //🔴v853 护甲删除(Hansen·"护甲没什么必要"): 删掉 buyAR 护甲购买处理器。
    render();
  }

  // ===== 自动注入入口(用户菜单，仿主题商店) =====
  function injectEntry(){
    try{
      if(document.getElementById('hsnGearEntry')) return;
      var anyCard=document.querySelector('.util-card'); if(!anyCard||!anyCard.parentElement) return;
      var entry=document.createElement('div');
      entry.className='util-card'; entry.id='hsnGearEntry';
      entry.setAttribute('onclick','HansenGear.open()');
      // 🔴v648 装备菜单图标 emoji⚔️→新3D装备宝箱图(适中48px·高清512源·onerror回退⚔️)
      entry.innerHTML='<span class="u-icon"><img src="icons/ic_equip.webp" alt="" draggable="false" style="width:70px;height:70px;object-fit:contain;vertical-align:middle;display:inline-block;transform:translate(0px,-1px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></span><div class="u-label">装备</div>';
      anyCard.parentElement.insertBefore(entry, anyCard);
    }catch(e){}
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ setTimeout(injectEntry,300); }); }
  else { setTimeout(injectEntry,300); }
  try{recoverPurchase();}catch(e){}
})();
