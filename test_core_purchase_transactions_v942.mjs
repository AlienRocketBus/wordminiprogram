import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = {
  cardbook: fs.readFileSync(new URL('./hansen_cardbook_wallet.js', import.meta.url), 'utf8'),
  gacha: fs.readFileSync(new URL('./hansen_gacha.js', import.meta.url), 'utf8'),
  diamond: fs.readFileSync(new URL('./hansen_diamond_shop.js', import.meta.url), 'utf8'),
  backup: fs.readFileSync(new URL('./hansen_backup_v944.js', import.meta.url), 'utf8')
};
const CARD_KEY = 'hansen_wallet_cardbook';
const SHOP_KEY = 'hansen_diamond_shop';
const SHARE_KEY = 'hansen_share_draw';
const CARD_PROOF = 'hansen_cardbook_purchase_transaction_v942';
const DIAMOND_PROOF = 'hansen_diamond_purchase_transaction_v942';

class FaultStorage {
  constructor(seed = {}) { this.data = {...seed}; this.rule = null; }
  get length() { return Object.keys(this.data).length; }
  key(i) { return Object.keys(this.data)[i] ?? null; }
  getItem(k) {
    if (this.rule?.op === 'get' && this.rule.key === k && --this.rule.nth === 0) {
      this.rule = null; throw new Error(`fault:get:${k}`);
    }
    return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null;
  }
  setItem(k, v) {
    if (this.rule?.op === 'set' && this.rule.key === k && --this.rule.nth === 0) {
      this.rule = null; throw new Error(`fault:set:${k}`);
    }
    this.data[k] = String(v);
  }
  removeItem(k) {
    if (this.rule?.op === 'remove' && this.rule.key === k && --this.rule.nth === 0) {
      this.rule = null; throw new Error(`fault:remove:${k}`);
    }
    delete this.data[k];
  }
  arm(key, nth = 1, op = 'set') { this.rule = {key, nth, op}; }
  put(key, value) { this.data[key] = String(value); }
}

function object(storage, key, fallback = {}) {
  try { return JSON.parse(storage.getItem(key) ?? JSON.stringify(fallback)); }
  catch { return fallback; }
}
function node() {
  const n = {
    id:'', className:'', textContent:'', innerHTML:'', children:[], parentNode:null, parentElement:null,
    dataset:{}, style:{setProperty(){}, removeProperty(){}},
    classList:{add(){}, remove(){}, toggle(){}, contains(){return false;}},
    appendChild(x){x.parentNode=this;x.parentElement=this;this.children.push(x);return x;},
    removeChild(x){this.children=this.children.filter(y=>y!==x);x.parentNode=null;x.parentElement=null;},
    remove(){if(this.parentNode)this.parentNode.removeChild(this);},
    contains(x){return x===this||this.children.some(c=>typeof c.contains==='function'&&c.contains(x));},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){return '';},
    querySelector(){return null;}, querySelectorAll(){return [];}, closest(){return null;}
  };
  return n;
}
function documentStub() {
  const body=node(), head=node();
  return {
    readyState:'loading', visibilityState:'visible', body, head,
    createElement(){return node();}, getElementById(){return null;}, querySelector(){return null;}, querySelectorAll(){return [];},
    addEventListener(){}, removeEventListener(){}
  };
}
function mathWith(seq = []) {
  const out=Object.create(Math); let i=0;
  out.random=()=>i<seq.length?seq[i++]:0.25;
  return out;
}
function context(storage, extras = {}, seq = []) {
  const c={console, JSON, Number, Date, parseInt, isFinite, Math:mathWith(seq), localStorage:storage,
    sessionStorage:new FaultStorage(), document:documentStub(), navigator:{}, location:{pathname:'/island_food.html'},
    MutationObserver:class{observe(){}disconnect(){}}, CustomEvent:class{}, Uint32Array,
    setTimeout(){return 1;}, clearTimeout(){}, setInterval(){return 1;}, clearInterval(){},
    requestAnimationFrame(fn){if(typeof fn==='function')fn();return 1;}, cancelAnimationFrame(){},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){}, confirm(){return true;}, alert(){},
    innerWidth:390, innerHeight:844, ...extras};
  c.window=c; c.parent=c; return c;
}
function wallet(storage, key, behavior='normal') {
  return {
    get(){return Number(storage.getItem(key) || 0);},
    spend(n){
      const before=this.get(); if(before<n)return false;
      if(behavior==='lie')return true;
      if(behavior==='false-after-spend'){storage.setItem(key,String(before-n));return false;}
      if(behavior==='wrong-target'){storage.setItem(key,String(before-n+1));return true;}
      storage.setItem(key,String(before-n)); return storage.getItem(key)===String(before-n);
    }
  };
}
function loadGacha(storage, behavior='normal', seq=[0.1,0,0], extras={}) {
  const coins=wallet(storage,'hansen_wallet_coins',behavior), c=context(storage,{HansenCoins:coins,...extras},seq);
  vm.createContext(c);
  vm.runInContext(SRC.cardbook,c,{filename:'hansen_cardbook_wallet.js'});
  vm.runInContext(SRC.gacha,c,{filename:'hansen_gacha.js'});
  return c;
}
function loadDiamond(storage, gemBehavior='normal', coinBehavior='normal') {
  const c=context(storage,{
    HansenGems:wallet(storage,'hansen_wallet_gems',gemBehavior),
    HansenCoins:wallet(storage,'hansen_wallet_coins',coinBehavior)
  });
  vm.createContext(c); vm.runInContext(SRC.diamond,c,{filename:'hansen_diamond_shop.js'}); return c;
}
function loadBackup(storage) { const c=context(storage);vm.createContext(c);vm.runInContext(SRC.backup,c,{filename:'hansen_backup_v944.js'});return c; }

// 分享免费抽：一个平台请求的重复成功回调只能落一张卡、占一个每日槽位。
{
  const storage=new FaultStorage({hansen_wallet_coins:'0'});let requests=0;
  const c=loadGacha(storage,'normal',[0.1,0,0],{wxShareForGacha(){requests++;}});
  c.__hsnShareForDraw(); assert.equal(requests,1); assert.ok(object(storage,SHARE_KEY).pending);
  assert.equal(c.onShareSuccess(),true); assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,SHARE_KEY).count,1); assert.equal(object(storage,CARD_KEY).totalDraws,1);
}

// 分享计划或卡册交付任一写入失败都不占槽、不丢请求；解除故障后同一计划可恢复。
{
  let storage=new FaultStorage({hansen_wallet_coins:'0'}),requests=0;
  let c=loadGacha(storage,'normal',[],{wxShareForGacha(){requests++;}});
  storage.arm(SHARE_KEY);c.__hsnShareForDraw();
  assert.equal(requests,0);assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);assert.equal(storage.getItem(SHARE_KEY),null);

  storage=new FaultStorage({hansen_wallet_coins:'0'});c=loadGacha(storage,'normal',[0.1,0,0],{wxShareForGacha(){}});
  c.__hsnShareForDraw();storage.arm(CARD_KEY);
  assert.equal(c.onShareSuccess(),false);assert.equal(object(storage,SHARE_KEY).count,0);assert.ok(object(storage,SHARE_KEY).pending);
  assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);
  c=loadGacha(storage,'normal',[0.99,0.99,0.99],{wxShareForGacha(){}});
  assert.equal(c.onShareSuccess(),true);assert.equal(object(storage,SHARE_KEY).count,1);assert.equal(object(storage,CARD_KEY).totalDraws,1);
}

// 卡已交付但 share count 写失败：即使其间又付费抽卡覆盖 lastReceipt，重载也凭收据恢复而不再发卡。
{
  const storage=new FaultStorage({hansen_wallet_coins:'2000'});
  let c=loadGacha(storage,'normal',[0.1,0,0,0.1,0,0],{wxShareForGacha(){}});
  storage.arm(SHARE_KEY,2); // pending 计划写成功；卡落盘后的每日槽位提交失败。
  c.__hsnShareForDraw(); assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,CARD_KEY).totalDraws,1); assert.equal(object(storage,SHARE_KEY).count,0);
  assert.ok(object(storage,SHARE_KEY).pending);
  assert.equal(c.onShareFailure(),false,'卡已交付的 pending 不能被失败回调清除');
  c.__hsnDoDraw(); // 覆盖 lastReceipt，分享幂等性必须依靠有界 receipts 账本。
  assert.equal(object(storage,CARD_KEY).totalDraws,2); assert.equal(storage.getItem('hansen_wallet_coins'),'1000');

  c=loadGacha(storage,'normal',[0.99,0.99,0.99],{wxShareForGacha(){}});
  assert.equal(c.onShareSuccess(),true);
  assert.equal(object(storage,SHARE_KEY).count,1); assert.equal(object(storage,CARD_KEY).totalDraws,2);
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
}

// 每日三个槽位精确封顶；第四次点击和额外平台回调都不发卡。
{
  const storage=new FaultStorage({hansen_wallet_coins:'0'}),c=loadGacha(storage,'normal',[0.1,0,0, 0.2,0,0, 0.3,0,0],{wxShareForGacha(){}});
  for(let i=0;i<3;i++){c.__hsnShareForDraw();assert.equal(c.onShareSuccess(),true);}
  assert.equal(object(storage,SHARE_KEY).count,3);assert.equal(object(storage,CARD_KEY).totalDraws,3);
  c.__hsnShareForDraw();assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,SHARE_KEY).count,3);assert.equal(object(storage,CARD_KEY).totalDraws,3);
}

// 可直接网页部署时若没有真实分享桥，不能把“不支持分享”当成功，更不能创建免费抽计划。
{
  const storage=new FaultStorage({hansen_wallet_coins:'0'}),c=loadGacha(storage);
  c.__hsnShareForDraw();assert.equal(storage.getItem(SHARE_KEY),null);assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,CARD_KEY).totalDraws??0,0);assert.equal(storage.getItem(SHARE_KEY),null);
}

// 伪造或过期 pending 不得触发免费卡；展示/卡牌/槽位均由当日内部计划决定。
{
  const storage=new FaultStorage({hansen_wallet_coins:'0'});let c=loadGacha(storage,'normal',[],{wxShareForGacha(){}});
  c.__hsnShareForDraw();const day=object(storage,SHARE_KEY).day;
  storage.put(SHARE_KEY,JSON.stringify({version:942,day,count:0,pending:{id:'share_forged',slot:1,lv:20,gotLegendary:true}}));
  c=loadGacha(storage,'normal',[],{wxShareForGacha(){}});assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);

  storage.put(SHARE_KEY,JSON.stringify({version:942,day:'Mon Jan 01 2001',count:0,pending:{id:'share_Mon_Jan_01_2001_1',slot:1,lv:20,gotLegendary:true}}));
  c=loadGacha(storage,'normal',[],{wxShareForGacha(){}});assert.equal(c.onShareSuccess(),false);
  assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);
}

// 正片抽卡：spend 谎报成功不得免费发卡；spend 假失败但余额已扣必须交付。
{
  let storage=new FaultStorage({hansen_wallet_coins:'2000'}),c=loadGacha(storage);
  storage.arm(CARD_KEY);c.__hsnDoDraw();
  assert.equal(storage.getItem('hansen_wallet_coins'),'2000');assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);

  storage=new FaultStorage({hansen_wallet_coins:'2000'});c=loadGacha(storage,'lie');
  c.__hsnDoDraw();
  assert.equal(storage.getItem('hansen_wallet_coins'),'2000');
  assert.equal(object(storage,CARD_KEY).totalDraws ?? 0,0);
  assert.equal(object(storage,CARD_KEY).pending ?? null,null);

  storage=new FaultStorage({hansen_wallet_coins:'2000'}); c=loadGacha(storage,'false-after-spend');
  c.__hsnDoDraw();
  const book=object(storage,CARD_KEY);
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  assert.equal(book.totalDraws,1); assert.equal(Object.keys(book.owned).length,1); assert.equal(book.pending,null);

  storage=new FaultStorage({hansen_wallet_coins:'2000'});c=loadGacha(storage,'wrong-target');
  c.__hsnDoDraw();assert.equal(storage.getItem('hansen_wallet_coins'),'1001');assert.ok(object(storage,CARD_KEY).pending);
  assert.equal(object(storage,CARD_KEY).totalDraws,0);
  c.__hsnDoDraw();assert.equal(storage.getItem('hansen_wallet_coins'),'1001','非预期余额下重复点击不得二扣');
}

// 正片抽卡：扣款后卡册落盘失败，重载只交付最初确定的一张且不二扣。
{
  let storage=new FaultStorage({hansen_wallet_coins:'2000'}),c=loadGacha(storage);
  storage.arm(CARD_KEY,2);c.__hsnDoDraw(); // spent 标记失败，target 余额仍是可靠事实。
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');assert.equal(object(storage,CARD_KEY).totalDraws,1);assert.equal(object(storage,CARD_KEY).pending,null);

  storage=new FaultStorage({hansen_wallet_coins:'2000'});c=loadGacha(storage);
  storage.arm(CARD_KEY,3); // begin、spent 成功；资产+收据写入失败。
  c.__hsnDoDraw();
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  assert.ok(object(storage,CARD_KEY).pending);
  const reload=loadGacha(storage,'normal',[0.99,0.99,0.99]);
  assert.equal(reload.HansenGacha.recoverPending().status,'committed');
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  assert.equal(object(storage,CARD_KEY).totalDraws,1);
  assert.equal(reload.HansenGacha.recoverPending().status,'none');
  assert.equal(object(storage,CARD_KEY).totalDraws,1);
}

// 正片 pending 的价格来自当前正式模块，篡改备份中的 cost/stage 不得发卡。
{
  const storage=new FaultStorage({hansen_wallet_coins:'1999'});
  storage.put(CARD_KEY,JSON.stringify({owned:{},frags:{},pity:0,totalDraws:0,pending:{
    type:'paid_draw',id:'gacha_forged',cost:1,beforeCoins:2000,lv:20,gotLegendary:true,stage:'spent',createdAt:1
  },lastReceipt:null}));
  const c=loadGacha(storage);
  assert.equal(c.HansenGacha.recoverPending().status,'invalid');
  assert.equal(c.HansenCardbook.has(20),false); assert.equal(c.HansenCardbook.getTotalDraws(),0);

  // 稀有度也从卡号重建；common 卡伪装成 legendary 不能借机清空保底。
  storage.put(CARD_KEY,JSON.stringify({owned:{},frags:{},pity:79,totalDraws:0,pending:{
    type:'paid_draw',id:'gacha_forged2',cost:1000,beforeCoins:2000,lv:1,gotLegendary:true,stage:'spent',createdAt:1
  },lastReceipt:null,receipts:{}}));
  const corruptBook=storage.getItem(CARD_KEY),again=loadGacha(storage);assert.equal(again.HansenGacha.recoverPending().status,'pending');
  assert.equal(again.HansenCardbook.has(1),false);assert.equal(storage.getItem(CARD_KEY),corruptBook,'语义损坏存档必须原样保留，不能按空卡册覆写');

  storage.put(CARD_KEY,'{"owned":{},"frags":{},"pity":9,"totalDraws":0,"pending":{"type":"paid_draw","id":"constructor","cost":1000,"beforeCoins":2000,"lv":1,"gotLegendary":false,"stage":"spent"},"receipts":{"__proto__":{"id":"__proto__","result":{"lv":20}}}}');
  const hostileRaw=storage.getItem(CARD_KEY),hostile=loadGacha(storage);assert.equal(hostile.HansenGacha.recoverPending().status,'pending');
  assert.equal(hostile.HansenCardbook.getTotalDraws(),0);assert.equal(storage.getItem(CARD_KEY),hostileRaw);assert.equal({}.polluted,undefined);
}

// stage:'spent' 即使字段、价格、target 余额全部一致也不是付款证明；无 proof/坏 proof 均不得交付。
{
  const validBook=pending=>JSON.stringify({owned:{},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0,pending,lastReceipt:null,receipts:{}});
  let pending={type:'paid_draw',id:'gacha_forged_spent',cost:1000,beforeCoins:2000,lv:1,gotLegendary:false,stage:'spent',createdAt:1};
  let storage=new FaultStorage({hansen_wallet_coins:'1000',[CARD_KEY]:validBook(pending)}),c=loadGacha(storage);
  assert.equal(c.HansenGacha.recoverPending().status,'pending');assert.equal(c.HansenCardbook.has(1),false);assert.equal(c.HansenCardbook.getTotalDraws(),0);assert.ok(object(storage,CARD_KEY).pending);

  storage=new FaultStorage({hansen_wallet_coins:'1000',[CARD_KEY]:validBook(pending),[CARD_PROOF]:JSON.stringify({version:942,id:pending.id,cost:1000,beforeCoins:2000,targetCoins:999,lv:1,state:'paid'})});c=loadGacha(storage);
  assert.equal(c.HansenGacha.recoverPending().status,'pending');assert.equal(c.HansenCardbook.has(1),false);assert.equal(c.HansenCardbook.getTotalDraws(),0);

  const diaPending={type:'diamond',id:'theme_fireworks',txid:'diamond_forged123',price:380,before:1000,stage:'spent',createdAt:1};
  storage=new FaultStorage({hansen_wallet_gems:'620',[SHOP_KEY]:JSON.stringify({owned:{},equipped:null,pending:diaPending,lastReceipt:null})});c=loadDiamond(storage);
  assert.equal(c.HansenDiamondShop.recoverPending().status,'pending');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);assert.ok(object(storage,SHOP_KEY).pending);

  storage.put(DIAMOND_PROOF,JSON.stringify({version:942,type:'diamond',id:'theme_fireworks',txid:'diamond_forged123',price:1,before:1000,target:999,state:'paid'}));c=loadDiamond(storage);
  assert.equal(c.HansenDiamondShop.recoverPending().status,'pending');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);

  storage=new FaultStorage({hansen_wallet_coins:'2000',[CARD_KEY]:validBook(pending)});c=loadGacha(storage);
  assert.equal(c.HansenGacha.recoverPending().status,'cancelled');assert.equal(c.HansenCardbook.has(1),false);assert.equal(object(storage,CARD_KEY).pending,null);

  storage=new FaultStorage({hansen_wallet_gems:'1000',[SHOP_KEY]:JSON.stringify({owned:{},equipped:null,pending:diaPending,lastReceipt:null})});c=loadDiamond(storage);
  assert.equal(c.HansenDiamondShop.recoverPending().status,'cancelled');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);assert.equal(object(storage,SHOP_KEY).pending,null);
}

// 钻石主题：假成功不交付；实际扣款但返回 false 仍交付。
{
  let storage=new FaultStorage({hansen_wallet_gems:'1000'}),c=loadDiamond(storage);
  storage.arm(SHOP_KEY);c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'1000');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);

  storage=new FaultStorage({hansen_wallet_gems:'1000'});c=loadDiamond(storage,'lie');
  c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'1000'); assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);

  storage=new FaultStorage({hansen_wallet_gems:'1000'}); c=loadDiamond(storage,'false-after-spend');
  c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'620'); assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),true);

  storage=new FaultStorage({hansen_wallet_gems:'1000'});c=loadDiamond(storage,'wrong-target');
  c.__hsnDiaBuy('theme_fireworks');assert.equal(storage.getItem('hansen_wallet_gems'),'621');
  assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);assert.ok(object(storage,SHOP_KEY).pending);
  c.__hsnDiaBuy('theme_fireworks');assert.equal(storage.getItem('hansen_wallet_gems'),'621','非预期余额下重复点击不得二扣');
}

// 钻石主题：扣款后资产写失败可重载恢复，始终只扣一次。
{
  let storage=new FaultStorage({hansen_wallet_gems:'1000'}),c=loadDiamond(storage);
  storage.arm(SHOP_KEY,2);c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'620');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);
  c=loadDiamond(storage);assert.equal(c.HansenDiamondShop.recoverPending().status,'committed');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),true);

  storage=new FaultStorage({hansen_wallet_gems:'1000'});c=loadDiamond(storage);
  storage.arm(SHOP_KEY,3); // prepared、spent 成功；owned+receipt 原子写失败。
  c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'620'); assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),false);
  const reload=loadDiamond(storage);
  assert.equal(reload.HansenDiamondShop.recoverPending().status,'committed');
  assert.equal(storage.getItem('hansen_wallet_gems'),'620'); assert.equal(reload.HansenDiamondShop.isOwned('theme_fireworks'),true);
}

// DiamondShop 内置金币主题入口也必须按余额判真。
{
  let storage=new FaultStorage({hansen_wallet_coins:'1000',hansen_wallet_gems:'0'}), c=loadDiamond(storage,'normal','lie');
  c.__hsnBuyBasic('ocean');
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000'); assert.equal(JSON.stringify(object(storage,'hansen_unlocked_themes',[])).includes('ocean'),false);

  storage=new FaultStorage({hansen_wallet_coins:'1000',hansen_wallet_gems:'0'}); c=loadDiamond(storage,'normal','false-after-spend');
  c.__hsnBuyBasic('ocean');
  assert.equal(storage.getItem('hansen_wallet_coins'),'700');
  assert.equal(JSON.parse(storage.getItem('hansen_unlocked_themes')).includes('ocean'),true);
}

// 篡改商品 id/价格/owned/equipped 不得进入资产真相；价格始终由 ITEMS/BASIC_THEMES 重建。
{
  const storage=new FaultStorage({hansen_wallet_gems:'1'});
  storage.put(SHOP_KEY,JSON.stringify({
    owned:{theme_forged:true},equipped:'theme_forged',
    pending:{type:'diamond',id:'theme_spacepark',txid:'forged',price:1,before:1,stage:'spent',createdAt:1},
    lastReceipt:{type:'diamond',id:'theme_forged',txid:'forged',stage:'delivered'}
  }));
  const c=loadDiamond(storage);
  const forgedRaw=storage.getItem(SHOP_KEY);assert.equal(c.HansenDiamondShop.recoverPending().status,'pending');
  assert.equal(storage.getItem(SHOP_KEY),forgedRaw);
  assert.equal(c.HansenDiamondShop.isOwned('theme_forged'),false);
  assert.equal(c.HansenDiamondShop.isOwned('theme_spacepark'),false);
  assert.equal(c.HansenDiamondShop.getEquipped(),null);

  storage.put(SHOP_KEY,JSON.stringify({owned:{},equipped:null,pending:{
    type:'basic',id:'ocean',txid:'forged-basic',price:1,before:1,stage:'spent',createdAt:1
  },lastReceipt:null}));
  const basicRaw=storage.getItem(SHOP_KEY),basic=loadDiamond(storage);assert.equal(basic.HansenDiamondShop.recoverPending().status,'pending');
  assert.equal(storage.getItem(SHOP_KEY),basicRaw);
  assert.equal(JSON.parse(storage.getItem('hansen_unlocked_themes')||'[]').includes('ocean'),false);
}

// 安全白名单不能误删历史已购 IMAX：旧 id 必须无损映射到同价位现商品。
{
  const storage=new FaultStorage({hansen_wallet_gems:'0'});
  storage.put(SHOP_KEY,JSON.stringify({owned:{theme_storm:true},equipped:'theme_storm',pending:null,lastReceipt:null}));
  const c=loadDiamond(storage);
  assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),true);
  assert.equal(c.HansenDiamondShop.getEquipped(),'theme_fireworks');
  assert.equal(c.HansenDiamondShop.isOwned('theme_storm'),false);
}

// 卡册/钻石资产读取 SecurityError 或损坏 JSON 时 fail closed：购买入口必须零写入、零扣款。
{
  let storage=new FaultStorage({hansen_wallet_coins:'2000',[CARD_KEY]:JSON.stringify({owned:{1:true},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0,pending:null,lastReceipt:null,receipts:{}})}),c=loadGacha(storage);
  let before=JSON.stringify(storage.data);storage.arm(CARD_KEY,1,'get');c.__hsnDoDraw();assert.equal(JSON.stringify(storage.data),before);

  storage=new FaultStorage({hansen_wallet_coins:'2000',[CARD_KEY]:'{"broken"'});c=loadGacha(storage);before=JSON.stringify(storage.data);c.__hsnDoDraw();assert.equal(JSON.stringify(storage.data),before);

  storage=new FaultStorage({hansen_wallet_gems:'1000',[SHOP_KEY]:JSON.stringify({owned:{theme_spacepark:true},equipped:null,pending:null,lastReceipt:null})});c=loadDiamond(storage);
  before=JSON.stringify(storage.data);storage.arm(SHOP_KEY,1,'get');c.__hsnDiaBuy('theme_fireworks');assert.equal(JSON.stringify(storage.data),before);

  storage=new FaultStorage({hansen_wallet_gems:'1000',[SHOP_KEY]:'{"broken"'});c=loadDiamond(storage);before=JSON.stringify(storage.data);c.__hsnDiaBuy('theme_fireworks');assert.equal(JSON.stringify(storage.data),before);
}

// nested pending 消费者也必须 proof-first：资产/收据落盘后 proof remove 失败，重载清理并允许严格备份。
{
  let storage=new FaultStorage({hansen_wallet_coins:'2000'}),c=loadGacha(storage);
  storage.arm(CARD_PROOF,1,'remove');c.__hsnDoDraw();let book=object(storage,CARD_KEY);
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');assert.equal(book.totalDraws,1);assert.ok(book.pending);assert.ok(storage.getItem(CARD_PROOF));
  c=loadGacha(storage);assert.equal(c.HansenGacha.recoverPending().status,'committed');book=object(storage,CARD_KEY);assert.equal(book.pending,null);assert.equal(book.totalDraws,1);assert.equal(storage.getItem(CARD_PROOF),null);assert.doesNotThrow(()=>loadBackup(storage).HansenBackup.build());

  storage=new FaultStorage({hansen_wallet_gems:'1000'});c=loadDiamond(storage);storage.arm(DIAMOND_PROOF,1,'remove');c.__hsnDiaBuy('theme_fireworks');
  assert.equal(storage.getItem('hansen_wallet_gems'),'620');assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),true);assert.ok(object(storage,SHOP_KEY).pending);assert.ok(storage.getItem(DIAMOND_PROOF));
  c=loadDiamond(storage);assert.equal(c.HansenDiamondShop.recoverPending().status,'committed');assert.equal(object(storage,SHOP_KEY).pending,null);assert.equal(storage.getItem(DIAMOND_PROOF),null);assert.equal(c.HansenDiamondShop.isOwned('theme_fireworks'),true);assert.doesNotThrow(()=>loadBackup(storage).HansenBackup.build());
}

console.log('✅ v942 核心购买红队：正片抽卡/分享幂等/钻石商店的假成功、假失败、崩溃恢复与篡改输入均通过');
