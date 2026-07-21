// v942 Bee 跨 iframe 奖励：稳定 receipt、丢包重发、父页幂等结算、ACK 与防伪回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const beeHtml=fs.readFileSync(new URL('./spelling_bee.html',import.meta.url),'utf8');
const parentSource=fs.readFileSync(new URL('./hansen_spellbee.js',import.meta.url),'utf8');
const childStart=beeHtml.indexOf('var SB_STREAK_BONUS_CAP=5, SB_DAILY_COIN_CAP=2000;');
const childEnd=beeHtml.indexOf('var _advTimer=',childStart);
assert.ok(childStart>0&&childEnd>childStart);
const childSource=beeHtml.slice(childStart,childEnd);
const NOW=Date.parse('2026-07-14T12:00:00Z');
class FixedDate extends Date{constructor(...a){super(a.length?a[0]:NOW);}static now(){return NOW;}}

class Storage{
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
}
const object=(s,k,f={})=>{try{return JSON.parse(s.getItem(k)||JSON.stringify(f));}catch{return f;}};

function loadChild(storage){
  const sent=[],parentWindow={postMessage(msg){sent.push(JSON.parse(JSON.stringify(msg)));}};
  const ctx={console,JSON,Math,Date:FixedDate,isFinite,localStorage:storage,_sbEmbed:true,parent:parentWindow,
    document:{hidden:false,addEventListener(){}},setTimeout(){return 1;},setInterval(){return 1;},addEventListener(){}};
  ctx.window=ctx;ctx.window.parent=parentWindow;ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);vm.runInContext(childSource,ctx,{filename:'spelling_bee-reward-child.js'});
  return{ctx,sent,parentWindow};
}

function dom(sourceWindow){
  const nodes=new Map();
  function el(tag){
    const x={tag,style:{},children:[],parentNode:null,contentWindow:tag==='iframe'?sourceWindow:undefined,
      setAttribute(){},appendChild(c){this.children.push(c);c.parentNode=this;},removeChild(c){this.children=this.children.filter(v=>v!==c);c.parentNode=null;}};
    Object.defineProperty(x,'id',{get(){return this._id||'';},set(v){this._id=v;if(v)nodes.set(v,this);}});return x;
  }
  const body=el('body');body.appendChild=function(c){this.children.push(c);c.parentNode=this;if(c.id)nodes.set(c.id,c);};
  body.removeChild=function(c){this.children=this.children.filter(v=>v!==c);if(c.id)nodes.delete(c.id);c.parentNode=null;};
  return{body,createElement:el,getElementById:id=>nodes.get(id)||null};
}

function coinWallet(){
  const awards={},state={balance:0};
  return{state,awards,award(id,n){if(awards[id]!==undefined)return awards[id]===n;awards[id]=n;state.balance+=n;return true;}};
}
function xpEffects(){
  const awards={},state={xp:0,failOnce:true,calls:[]};
  return{state,awards,xpAward(id,n){state.calls.push([id,n]);if(state.failOnce){state.failOnce=false;return false;}if(awards[id]!==undefined)return awards[id]===n;awards[id]=n;state.xp+=n;return true;}};
}
function loadParent(storage,wallet,effects){
  const listeners={},acks=[],sourceWindow={postMessage(msg){acks.push(JSON.parse(JSON.stringify(msg)));}},document=dom(sourceWindow);
  const ctx={console,JSON,Math,isFinite,encodeURIComponent,localStorage:storage,document,history:{pushState(){},back(){}},
    HansenCoins:wallet,HansenRewardEffectsV942:effects,
    addEventListener(type,fn){listeners[type]=fn;},removeEventListener(){}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(parentSource,ctx,{filename:'hansen_spellbee.js'});ctx.HansenSpellBee.open('food');
  return{ctx,listeners,sourceWindow,acks};
}

const storage=new Storage();

// 子页先扣额度并写 receipt；第一次 postMessage 丢失后，reload 仍重发同一 ID/金额。
const first=loadChild(storage);
assert.equal(first.ctx.sbTakeCoin(10),10);
const receipt=first.ctx.sbQueueReward(10,4,'word');assert.ok(receipt);
assert.equal(first.sent.length,1);const original=first.sent[0];
assert.match(original.rewardId,/^sb:2026-7-14:\d+$/);assert.equal(storage.getItem('hsn_sb_coin_today'),'10');
assert.equal(object(storage,'hansen_sb_reward_pending_v942')[original.rewardId].coins,10);

const reloaded=loadChild(storage);reloaded.ctx.sbFlushRewardPending();
assert.deepEqual(reloaded.sent,[original],'reload 必须重发相同 receipt，不能生成新奖励');

// 父页拒绝错误 source、无 pending 的伪造 ID，以及篡改金额/kind。
const wallet=coinWallet(),effects=xpEffects();let parent=loadParent(storage,wallet,effects);
const notify=parent.listeners.message;
notify({source:{},data:original});
notify({source:parent.sourceWindow,data:{...original,rewardId:'sb:2026-7-14:999999'}});
notify({source:parent.sourceWindow,data:{...original,coins:20}});
notify({source:parent.sourceWindow,data:{...original,kind:'match'}});
assert.equal(wallet.state.balance,0);assert.equal(effects.state.xp,0);assert.equal(parent.acks.length,0);

// 金币已入账、XP 第一次失败时不 ACK；父页 reload 后同 ID 续做，金币不二发。
notify({source:parent.sourceWindow,data:original});
assert.equal(wallet.state.balance,10);assert.equal(effects.state.xp,0);assert.equal(parent.acks.length,0);
parent=loadParent(storage,wallet,effects);
parent.listeners.message({source:parent.sourceWindow,data:original});
assert.equal(wallet.state.balance,10);assert.equal(effects.state.xp,4);assert.equal(parent.acks.length,1);
assert.equal(Object.keys(wallet.awards).length,1);assert.equal(Object.keys(effects.awards).length,1);
assert.equal(Object.keys(wallet.awards)[0],'spellbee:'+original.rewardId+':coin');
assert.equal(Object.keys(effects.awards)[0],'spellbee:'+original.rewardId+':xp');

// ACK 丢失导致重复 postMessage：父页仍 exactly-once，并再次 ACK；真正收到 ACK 后 child 才清 pending。
parent.listeners.message({source:parent.sourceWindow,data:original});
assert.equal(wallet.state.balance,10);assert.equal(effects.state.xp,4);assert.equal(parent.acks.length,2);
assert.ok(object(storage,'hansen_sb_reward_pending_v942')[original.rewardId]);
reloaded.ctx.sbRewardAck({source:reloaded.parentWindow,data:parent.acks.at(-1)});
assert.equal(object(storage,'hansen_sb_reward_pending_v942')[original.rewardId],undefined);
reloaded.ctx.sbFlushRewardPending();assert.equal(reloaded.sent.length,1,'ACK 后不得再发送');

// 静态守卫：正式奖励路径禁止 amount-only/addCoin，必须核验 pending 并使用两个幂等 source。
const rewardBlock=parentSource.slice(parentSource.indexOf('var SB_REWARD_PENDING_KEY'),parentSource.indexOf("d.type === 'hsn_sb_mastery'"));
assert.match(parentSource,/HansenCoins\.award\(base\+'\:coin'/);assert.match(parentSource,/HansenRewardEffectsV942\.xpAward\(base\+'\:xp'/);
assert.match(parentSource,/hansen_sb_reward_pending_v942/);assert.doesNotMatch(parentSource.slice(parentSource.indexOf("if\(!d \|\| d.type !== 'hsn_sb_reward'")),/addCoin\(|HansenCoins\.add\(/);
assert.match(beeHtml,/hsn_sb_reward_ack/);assert.match(beeHtml,/rewardId:id,coins:r\.coins,xp:r\.xp/);

console.log('✅ v942 Bee ACK：消息丢失、重复、父/子 reload、XP续做与伪造 ID/金额均 exactly-once');
