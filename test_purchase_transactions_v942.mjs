import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FILES={
  land:fs.readFileSync(new URL('./hansen_land_cards.js',import.meta.url),'utf8'),
  shop:fs.readFileSync(new URL('./hansen_theme_shop.js',import.meta.url),'utf8'),
  lock:fs.readFileSync(new URL('./hansen_theme_lock.js',import.meta.url),'utf8'),
  gear:fs.readFileSync(new URL('./hansen_gear.js',import.meta.url),'utf8'),
  backup:fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8')
};
const THEME_PENDING='hansen_theme_purchase_pending_v942';
const THEME_OWNED='hansen_unlocked_themes';
const THEME_PROOF='hansen_theme_purchase_transaction_v942';
const LAND_PENDING='hansen_land_gacha_pending_v942';
const LAND_BOOK='hansen_land_cardbook';
const LAND_PROOF='hansen_land_gacha_transaction_v942';
const GEAR_PENDING='hansen_gear_purchase_pending_v942';
const GEAR_KEY='hansen_gear';
const GEAR_PROOF='hansen_gear_purchase_transaction_v942';

class FaultStorage{
  constructor(seed={}){this.data={...seed};this.rule=null;}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){if(this.rule&&this.rule.op==='get'&&this.rule.key===k&&--this.rule.nth===0){this.rule=null;throw new Error(`fault:get:${k}`);}return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null;}
  setItem(k,v){if(this.rule&&this.rule.op==='set'&&this.rule.key===k&&--this.rule.nth===0){this.rule=null;throw new Error(`fault:set:${k}`);}this.data[k]=String(v);}
  removeItem(k){if(this.rule&&this.rule.op==='remove'&&this.rule.key===k&&--this.rule.nth===0){this.rule=null;throw new Error(`fault:remove:${k}`);}delete this.data[k];}
  arm(key,nth=1,op='set'){this.rule={key,nth,op};}
  disarm(){this.rule=null;}
  put(k,v){this.data[k]=String(v);}
}
function json(storage,key,fallback={}){try{return JSON.parse(storage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
function putJson(storage,key,value){storage.put(key,JSON.stringify(value));}

function fakeNode(){
  const attrs={},qs={};let html='';
  const node={style:{setProperty(){}},dataset:{},className:'',classList:{add(){},remove(){},toggle(){}},children:[],parentNode:null,parentElement:null,textContent:'',disabled:false,inert:false,complete:false,naturalWidth:0,
    appendChild(n){n.parentNode=this;this.children.push(n);return n;},removeChild(n){this.children=this.children.filter(x=>x!==n);n.parentNode=null;},insertBefore(){},remove(){if(this.parentNode)this.parentNode.removeChild(this);},
    addEventListener(){},removeEventListener(){},focus(){},setAttribute(k,v){attrs[k]=String(v);},removeAttribute(k){delete attrs[k];},hasAttribute(k){return Object.prototype.hasOwnProperty.call(attrs,k);},getAttribute(k){return this.hasAttribute(k)?attrs[k]:null;},
    querySelector(sel){return qs[sel]||null;},querySelectorAll(){return [];},contains(target){if(target===this)return true;return this.children.some((c)=>c&&typeof c.contains==='function'&&c.contains(target));}};
  Object.defineProperty(node,'innerHTML',{get(){return html;},set(v){html=String(v);if(html.includes('lgr-rotor')){qs['.lgr-rotor']=fakeNode();qs['.lgr-scroll']=fakeNode();qs['.lgr-hint']=fakeNode();}}});
  return node;
}
function fakeDocument(){const body=fakeNode(),head=fakeNode(),documentElement=fakeNode();documentElement.appendChild(body);return {readyState:'complete',body,head,documentElement,hidden:false,visibilityState:'visible',createElement(){return fakeNode();},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},removeEventListener(){}};}
function mathWith(seq=[]){const m=Object.create(Math);let i=0;m.random=()=>i<seq.length?seq[i++]:0.25;return m;}
function base(storage,seq=[]){
  const document=fakeDocument();
  const context={console,JSON,Math:mathWith(seq),Date,Number,parseInt,isFinite,localStorage:storage,document,
    MutationObserver:class{observe(){}disconnect(){}},CustomEvent:class{},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},requestAnimationFrame(){return 1;},Image:class{constructor(){return fakeNode();}},
    navigator:{vibrate(){}},matchMedia(){return {matches:false}},addEventListener(){},removeEventListener(){},dispatchEvent(){},innerWidth:390,innerHeight:844};
  context.window=context;return context;
}
function runFile(kind,storage,extras={},seq=[]){const context=Object.assign(base(storage,seq),extras);context.window=context;vm.createContext(context);vm.runInContext(FILES[kind],context,{filename:`hansen_${kind}.js`});return context;}
function strictWallet(storage,key,behavior='normal'){
  return {
    get(){return Number(storage.getItem(key)||0);},
    spend(n){
      const before=this.get();if(before<n)return false;
      if(behavior==='lie')return true;
      if(behavior==='false-after-spend'){storage.setItem(key,String(before-n));return false;}
      if(behavior==='wrong-target'){storage.setItem(key,String(before-n+1));return true;}
      storage.setItem(key,String(before-n));return storage.getItem(key)===String(before-n);
    }
  };
}

// 主题首页不得覆盖既有钱包对象。
{
  const storage=new FaultStorage({'hansen_wallet_coins':'1000'}),sentinel={get(){return 77;},spend(){return false;}};
  const c=runFile('shop',storage,{HansenWallet:sentinel});
  assert.equal(c.HansenWallet,sentinel);
}

// 主题购买：pending 写失败不扣；假成功钱包不送货；扣后资产失败可跨页由 lock/shop 同一真相恢复。
{
  let storage=new FaultStorage({'hansen_wallet_coins':'1000'}),c=runFile('shop',storage);
  storage.arm(THEME_PENDING);
  assert.equal(c.HansenThemeShopV942.purchase('ocean'),false);
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),false);

  storage=new FaultStorage({'hansen_wallet_coins':'1000'});
  const lying=strictWallet(storage,'hansen_wallet_coins','lie');
  c=runFile('shop',storage,{HansenCoins:lying});
  assert.equal(c.HansenThemeShopV942.purchase('ocean'),false,'余额没变时不得相信 spend=true');
  assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),false);assert.equal(storage.getItem('hansen_wallet_coins'),'1000');

  storage=new FaultStorage({'hansen_wallet_coins':'1000'});c=runFile('shop',storage);
  storage.arm(THEME_OWNED);
  assert.equal(c.HansenThemeShopV942.purchase('ocean'),false,'交付失败时保留 pending');
  assert.equal(storage.getItem('hansen_wallet_coins'),'700');assert.notEqual(storage.getItem(THEME_PENDING),null);
  const lock=runFile('lock',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins'),applyTheme(){},renderThemeBox(){}});
  assert.equal(lock.HansenThemeLock.recover().status,'none','lock 启动时已恢复同一 pending');
  assert.equal(lock.HansenThemeLock.isUnlocked('ocean'),true);assert.equal(storage.getItem('hansen_wallet_coins'),'700');
  const shopAgain=runFile('shop',storage);assert.equal(shopAgain.HansenThemeShopV942.isUnlocked('ocean'),true);
}

// 主题资产已写但 pending 清理失败：重载只清理，不重复扣款；lock 新购也被 shop 看见。
{
  const storage=new FaultStorage({'hansen_wallet_coins':'5000'});let c=runFile('shop',storage);
  storage.arm(THEME_PENDING,1,'remove');assert.equal(c.HansenThemeShopV942.purchase('forest'),false);
  assert.equal(storage.getItem('hansen_wallet_coins'),'4000');assert.notEqual(storage.getItem(THEME_PENDING),null);
  c=runFile('shop',storage);assert.equal(c.HansenThemeShopV942.isUnlocked('forest'),true);assert.equal(storage.getItem('hansen_wallet_coins'),'4000');assert.equal(storage.getItem(THEME_PENDING),null);
  const lock=runFile('lock',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins'),applyTheme(){},renderThemeBox(){}});
  assert.equal(lock.HansenThemeLock.purchase('rainbow'),true);assert.equal(storage.getItem('hansen_wallet_coins'),'2000');
  c=runFile('shop',storage);assert.equal(c.HansenThemeShopV942.isUnlocked('rainbow'),true);
}

// Land 抽卡：pending 先写；严格余额回读；扣币后交付失败，重载仍交付首次确定的卡而不重新随机。
{
  let storage=new FaultStorage({'hansen_wallet_coins':'2000'}),wallet=strictWallet(storage,'hansen_wallet_coins');
  let c=runFile('land',storage,{HansenCoins:wallet},[0.1,0,0,0.4]);
  storage.arm(LAND_PENDING);assert.equal(c.HansenLandGacha.purchase(),null);assert.equal(storage.getItem('hansen_wallet_coins'),'2000');assert.equal(json(storage,LAND_BOOK).totalDraws??0,0);

  storage=new FaultStorage({'hansen_wallet_coins':'2000'});wallet=strictWallet(storage,'hansen_wallet_coins','lie');
  c=runFile('land',storage,{HansenCoins:wallet},[0.1,0,0,0.4]);assert.equal(c.HansenLandGacha.purchase(),null);assert.equal(Object.keys(json(storage,LAND_BOOK).owned??{}).length,0);

  storage=new FaultStorage({'hansen_wallet_coins':'2000'});wallet=strictWallet(storage,'hansen_wallet_coins');
  c=runFile('land',storage,{HansenCoins:wallet},[0.1,0,0,0.4]);storage.arm(LAND_BOOK);
  assert.equal(c.HansenLandGacha.purchase(),null);assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  const chosen=json(storage,LAND_PENDING).id;assert.equal(chosen,'L11');
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.999,0.999,0.999]);
  const recovered=c.HansenLandGacha.recoverPending();assert.equal(recovered.status,'committed');assert.equal(recovered.id,chosen);
  const book=json(storage,LAND_BOOK);assert.equal(book.owned[chosen],true);assert.equal(book.totalDraws,1);assert.equal(book.pity,1);assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  const pending=c.HansenLandCardbook.peekPendingReveal();assert.equal(pending.id,chosen);assert.equal(pending.version,955);assert.match(pending.txid,/^landdraw-/);
  const replay=c.HansenLandGacha.purchase();assert.equal(replay.status,'reveal-pending','未收下结果时必须补播原卡，不能再次扣币');assert.equal(replay.id,chosen);assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.999,0.999,0.999]);
  assert.equal(c.HansenLandCardbook.peekPendingReveal().txid,pending.txid,'刷新/重载后必须恢复同一张待揭晓卡');
  storage.arm(LAND_BOOK);assert.equal(c.HansenLandCardbook.ackPendingReveal(pending.txid),false,'确认写盘失败时不得误删待揭晓卡');assert.equal(c.HansenLandCardbook.peekPendingReveal().txid,pending.txid);
  assert.equal(c.HansenLandCardbook.ackPendingReveal(pending.txid),true);assert.equal(c.HansenLandCardbook.peekPendingReveal(),null,'只有同一事务号成功落盘后才能解除抽卡锁');
}

// v955 星海揭晓搭台故障：部分背景已 inert 后也必须完整回滚；待揭晓卡保留且第二次只补播、不二扣。
{
  const storage=new FaultStorage({'hansen_wallet_coins':'2000'});
  const c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.1,0,0,0.4]);
  const bg1=fakeNode(),bg2=fakeNode();bg2.setAttribute('aria-hidden','true');bg2.inert=true;c.document.body.appendChild(bg1);c.document.body.appendChild(bg2);
  let injected=true;const normalSet=bg2.setAttribute;
  bg2.setAttribute=function(k,v){if(injected&&k==='aria-hidden'){injected=false;throw new Error('fault:shield-background');}return normalSet.call(this,k,v);};
  c.HansenLandGachaUI.draw();
  const pending=c.HansenLandCardbook.peekPendingReveal();assert.ok(pending,'搭台失败不能丢掉已经入册的待揭晓卡');
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');assert.equal(bg1.inert,false);assert.equal(bg1.hasAttribute('aria-hidden'),false,'原本可交互的背景必须恢复');
  assert.equal(bg2.inert,true);assert.equal(bg2.getAttribute('aria-hidden'),'true','原本已隔离的背景必须保留原状态');
  assert.equal(c.document.body.children.some((n)=>n.className==='lgr-overlay'),false,'搭台失败不得残留不可见遮罩');
  bg2.setAttribute=normalSet;c.HansenLandGachaUI.draw();
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000','故障重试只能补播原卡，不能再次扣金币');
  assert.equal(c.HansenLandCardbook.peekPendingReveal().txid,pending.txid);assert.equal(c.document.body.children.filter((n)=>n.className==='lgr-overlay').length,1,'修复故障后必须只启动一个揭晓层');
}

// Land 重复卡 + cleanup 故障：碎片、保底、总抽数都只能增加一次。
{
  const storage=new FaultStorage({'hansen_wallet_coins':'2000'});putJson(storage,LAND_BOOK,{owned:{L11:true},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0,receipts:{}});
  let c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.1,0,0,0.4]);
  storage.arm(LAND_PENDING,1,'remove');const paid=c.HansenLandGacha.purchase();assert.equal(paid.status,'pending');assert.equal(paid.id,'L11');
  let book=json(storage,LAND_BOOK);assert.equal(book.frags.common,10);assert.equal(book.totalDraws,1);assert.notEqual(storage.getItem(LAND_PENDING),null);
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.9,0.9,0.9]);c.HansenLandGacha.recoverPending();
  book=json(storage,LAND_BOOK);assert.equal(book.frags.common,10);assert.equal(book.totalDraws,1);assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
}

// 装备：pending/假钱包/资产写入/cleanup 四个断点；重载后等级只升一级、钻石只扣一次。
{
  let storage=new FaultStorage({'hansen_wallet_gems':'100'}),gems=strictWallet(storage,'hansen_wallet_gems');
  let c=runFile('gear',storage,{HansenGems:gems});storage.arm(GEAR_PENDING);
  assert.equal(c.HansenGear.buy('weapon').status,'rejected');assert.equal(storage.getItem('hansen_wallet_gems'),'100');assert.equal(c.HansenGear.getWeaponLvl(),0);

  storage=new FaultStorage({'hansen_wallet_gems':'100'});c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems','lie')});
  assert.equal(c.HansenGear.buy('weapon').status,'rejected');assert.equal(c.HansenGear.getWeaponLvl(),0);assert.equal(storage.getItem('hansen_wallet_gems'),'100');

  storage=new FaultStorage({'hansen_wallet_gems':'100'});c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});storage.arm(GEAR_KEY);
  assert.equal(c.HansenGear.buy('weapon').status,'pending');assert.equal(storage.getItem('hansen_wallet_gems'),'55');assert.notEqual(storage.getItem(GEAR_PENDING),null);
  c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});assert.equal(c.HansenGear.recoverPurchase().status,'none','启动已恢复');assert.equal(c.HansenGear.getWeaponLvl(),1);assert.equal(storage.getItem('hansen_wallet_gems'),'55');

  storage=new FaultStorage({'hansen_wallet_gems':'100'});c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});storage.arm(GEAR_PENDING,1,'remove');
  assert.equal(c.HansenGear.buy('weapon').status,'pending');assert.equal(c.HansenGear.getWeaponLvl(),1);assert.notEqual(storage.getItem(GEAR_PENDING),null);
  c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});c.HansenGear.recoverPurchase();assert.equal(c.HansenGear.getWeaponLvl(),1);assert.equal(storage.getItem('hansen_wallet_gems'),'55');assert.equal(storage.getItem(GEAR_PENDING),null);
}

// 余额既不是 before 也不是 target 时，三类购买都必须保留 WAL，不交付、不二扣。
{
  let storage=new FaultStorage({'hansen_wallet_coins':'1000'}),c=runFile('shop',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins','wrong-target')});
  assert.equal(c.HansenThemeShopV942.purchase('ocean'),false);assert.equal(storage.getItem('hansen_wallet_coins'),'701');assert.ok(storage.getItem(THEME_PENDING));assert.ok(storage.getItem(THEME_PROOF));assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),false);
  const themePending=storage.getItem(THEME_PENDING);assert.equal(c.HansenThemeShopV942.purchase('ocean'),false);assert.equal(storage.getItem('hansen_wallet_coins'),'701');assert.equal(storage.getItem(THEME_PENDING),themePending);

  storage=new FaultStorage({'hansen_wallet_coins':'2000'});c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins','wrong-target')},[0.1,0,0]);
  assert.equal(c.HansenLandGacha.purchase(),null);assert.equal(storage.getItem('hansen_wallet_coins'),'1001');assert.ok(storage.getItem(LAND_PENDING));assert.ok(storage.getItem(LAND_PROOF));assert.equal(json(storage,LAND_BOOK).totalDraws??0,0);
  const landPending=storage.getItem(LAND_PENDING);assert.equal(c.HansenLandGacha.purchase(),null);assert.equal(storage.getItem('hansen_wallet_coins'),'1001');assert.equal(storage.getItem(LAND_PENDING),landPending);

  storage=new FaultStorage({'hansen_wallet_gems':'100'});c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems','wrong-target')});
  assert.equal(c.HansenGear.buy('weapon').status,'pending');assert.equal(storage.getItem('hansen_wallet_gems'),'56');assert.ok(storage.getItem(GEAR_PENDING));assert.ok(storage.getItem(GEAR_PROOF));assert.equal(c.HansenGear.getWeaponLvl(),0);
  const gearPending=storage.getItem(GEAR_PENDING);assert.equal(c.HansenGear.buy('weapon').status,'pending');assert.equal(storage.getItem('hansen_wallet_gems'),'56');assert.equal(storage.getItem(GEAR_PENDING),gearPending);
}

// fully-consistent 的 forged stage:'spent' 也不是付款证明：target 余额但没有独立 proof 时绝不免费交付。
{
  let storage=new FaultStorage({'hansen_wallet_coins':'700'});putJson(storage,THEME_PENDING,{version:942,txid:'theme-forged123',theme:'ocean',price:300,before:1000,target:700,stage:'spent'});
  let c=runFile('shop',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')});assert.equal(c.HansenThemeShopV942.recover().status,'pending');assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),false);assert.equal(storage.getItem(THEME_PENDING)!==null,true);

  storage=new FaultStorage({'hansen_wallet_coins':'1000'});putJson(storage,LAND_PENDING,{version:942,txid:'landdraw-forged123',id:'L11',gotLeg:false,cost:1000,before:2000,target:1000,stage:'spent'});
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')});assert.equal(c.HansenLandGacha.recoverPending().status,'pending');assert.equal(c.HansenLandCardbook.has('L11'),false);assert.equal(c.HansenLandCardbook.getTotalDraws(),0);assert.ok(storage.getItem(LAND_PENDING));

  storage=new FaultStorage({'hansen_wallet_gems':'55'});putJson(storage,GEAR_PENDING,{version:942,txid:'gear-forged123',kind:'weapon',level:1,price:45,before:100,after:55,stage:'spent'});
  c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});assert.equal(c.HansenGear.recoverPurchase().status,'pending');assert.equal(c.HansenGear.getWeaponLvl(),0);assert.ok(storage.getItem(GEAR_PENDING));

  storage=new FaultStorage({'hansen_wallet_coins':'1000'});putJson(storage,THEME_PENDING,{version:942,txid:'theme-forged456',theme:'ocean',price:300,before:1000,target:700,stage:'spent'});
  c=runFile('shop',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')});assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),false);assert.equal(storage.getItem(THEME_PENDING),null,'before 余额证明未扣款，可安全取消伪造 spent');

  storage=new FaultStorage({'hansen_wallet_coins':'2000'});putJson(storage,LAND_PENDING,{version:942,txid:'landdraw-forged456',id:'L11',gotLeg:false,cost:1000,before:2000,target:1000,stage:'spent'});
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')});assert.equal(c.HansenLandGacha.recoverPending().status,'cancelled');assert.equal(c.HansenLandCardbook.has('L11'),false);assert.equal(storage.getItem(LAND_PENDING),null);

  storage=new FaultStorage({'hansen_wallet_gems':'100'});putJson(storage,GEAR_PENDING,{version:942,txid:'gear-forged456',kind:'weapon',level:1,price:45,before:100,after:55,stage:'spent'});
  c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});assert.equal(c.HansenGear.getWeaponLvl(),0);assert.equal(storage.getItem(GEAR_PENDING),null);
}

// 资产读取 SecurityError 或损坏 JSON 时 fail closed：购买入口零写入、零扣款，不能按空资产覆写。
{
  const cases=[
    {kind:'shop',asset:THEME_OWNED,wallet:'hansen_wallet_coins',seed:'["forest"]',extras:s=>({HansenCoins:strictWallet(s,'hansen_wallet_coins')}),act:c=>c.HansenThemeShopV942.purchase('ocean')},
    {kind:'land',asset:LAND_BOOK,wallet:'hansen_wallet_coins',seed:JSON.stringify({owned:{L11:true},frags:{common:0,uncommon:0,rare:0,epic:0,legendary:0},pity:0,totalDraws:0,receipts:{}}),extras:s=>({HansenCoins:strictWallet(s,'hansen_wallet_coins')}),act:c=>c.HansenLandGacha.purchase()},
    {kind:'gear',asset:GEAR_KEY,wallet:'hansen_wallet_gems',seed:JSON.stringify({weaponLvl:1,hpLvl:0,armorLvl:0}),extras:s=>({HansenGems:strictWallet(s,'hansen_wallet_gems')}),act:c=>c.HansenGear.buy('weapon')}
  ];
  for(const x of cases){
    let storage=new FaultStorage({[x.wallet]:'5000',[x.asset]:x.seed}),c=runFile(x.kind,storage,x.extras(storage));const before=JSON.stringify(storage.data);storage.arm(x.asset,1,'get');x.act(c);assert.equal(JSON.stringify(storage.data),before,`${x.kind} selective get failure 必须零写入`);
    storage=new FaultStorage({[x.wallet]:'5000',[x.asset]:'{"broken"'});c=runFile(x.kind,storage,x.extras(storage));const corrupt=JSON.stringify(storage.data);x.act(c);assert.equal(JSON.stringify(storage.data),corrupt,`${x.kind} 损坏 JSON 必须原样保留`);
  }
}

// 资产已交付后 proof 删除失败：proof-first 必须保留 pending；重载清净两者且严格备份可生成。
{
  let storage=new FaultStorage({'hansen_wallet_coins':'1000'}),c=runFile('shop',storage);
  storage.arm(THEME_PROOF,1,'remove');assert.equal(c.HansenThemeShopV942.purchase('ocean'),false);assert.equal(c.HansenThemeShopV942.isUnlocked('ocean'),true);assert.equal(storage.getItem('hansen_wallet_coins'),'700');assert.ok(storage.getItem(THEME_PROOF));assert.ok(storage.getItem(THEME_PENDING));
  c=runFile('shop',storage);assert.equal(c.HansenThemeShopV942.recover().status,'none');assert.equal(storage.getItem(THEME_PROOF),null);assert.equal(storage.getItem(THEME_PENDING),null);assert.doesNotThrow(()=>runFile('backup',storage).HansenBackup.build());

  storage=new FaultStorage({'hansen_wallet_coins':'2000'});c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')},[0.1,0,0]);storage.arm(LAND_PROOF,1,'remove');
  const land=c.HansenLandGacha.purchase();assert.equal(land.status,'pending');assert.equal(storage.getItem('hansen_wallet_coins'),'1000');assert.ok(storage.getItem(LAND_PROOF));assert.ok(storage.getItem(LAND_PENDING));assert.equal(json(storage,LAND_BOOK).totalDraws,1);
  c=runFile('land',storage,{HansenCoins:strictWallet(storage,'hansen_wallet_coins')});assert.equal(c.HansenLandGacha.recoverPending().status,'committed');assert.equal(storage.getItem(LAND_PROOF),null);assert.equal(storage.getItem(LAND_PENDING),null);assert.equal(json(storage,LAND_BOOK).totalDraws,1);assert.doesNotThrow(()=>runFile('backup',storage).HansenBackup.build());

  storage=new FaultStorage({'hansen_wallet_gems':'100'});c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});storage.arm(GEAR_PROOF,1,'remove');
  assert.equal(c.HansenGear.buy('weapon').status,'pending');assert.equal(c.HansenGear.getWeaponLvl(),1);assert.equal(storage.getItem('hansen_wallet_gems'),'55');assert.ok(storage.getItem(GEAR_PROOF));assert.ok(storage.getItem(GEAR_PENDING));
  c=runFile('gear',storage,{HansenGems:strictWallet(storage,'hansen_wallet_gems')});assert.equal(c.HansenGear.recoverPurchase().status,'none');assert.equal(storage.getItem(GEAR_PROOF),null);assert.equal(storage.getItem(GEAR_PENDING),null);assert.equal(c.HansenGear.getWeaponLvl(),1);assert.doesNotThrow(()=>runFile('backup',storage).HansenBackup.build());
}

console.log('✅ v942 商店事务：主题同源、钱包不覆盖、Land 确定抽卡、装备交付均通过全断点重载与恰好一次测试');
