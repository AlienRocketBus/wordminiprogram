import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./hansen_coin_wallet.js',import.meta.url),'utf8');
const JOURNAL='hansen_coin_migration_journal_v942';
const COMMIT='hansen_coin_migration_commit_v942';
const WALLET='hansen_wallet_coins';
const EARNED='hansen_wallet_coins_earned';

class FixedDate extends Date{
  constructor(...args){super(args.length?args[0]:'2026-07-14T12:00:00-06:00');}
  static now(){return new FixedDate().getTime();}
}
class FaultStorage{
  constructor(seed={}){this.data={...seed};this.rule=null;}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null;}
  setItem(k,v){if(this.rule&&this.rule.op==='set'&&this.rule.key===k&&--this.rule.nth===0){this.rule=null;throw new Error(`hard-crash:set:${k}`);}this.data[k]=String(v);}
  removeItem(k){if(this.rule&&this.rule.op==='remove'&&this.rule.key===k&&--this.rule.nth===0){this.rule=null;throw new Error(`hard-crash:remove:${k}`);}delete this.data[k];}
  arm(op,key,nth=1){this.rule={op,key,nth};}
  disarm(){this.rule=null;}
}
const save=(coins,label)=>JSON.stringify({coins,label,totalXP:10,learned:[],stats:{}});
const starter=JSON.stringify({'starter:global':{amount:0,at:FixedDate.now(),migrated:true}});
function seed(){return {
  [WALLET]:'100',[EARNED]:'100',hansen_starter_coins_given:'1',hansen_coin_awards_v942:starter,
  wordIslandAnimal:save(40,'animal-main'),wordIslandAnimal_bak:save(35,'animal-bak'),
  wordIslandFood:save(60,'food-main'),wordIslandFood_bak:save(55,'food-bak')
};}
function boot(storage){
  const notices=[];const c={console:{log(){},warn(){},error(){}},JSON,Math,Date:FixedDate,Number,isFinite,
    localStorage:storage,__hsnSaveNotice(msg){notices.push(msg);},dispatchEvent(){},CustomEvent:class {}};
  c.window=c;vm.createContext(c);vm.runInContext(source,c,{filename:'hansen_coin_wallet.js'});return {c,notices};
}
const coin=(storage,key)=>JSON.parse(storage.getItem(key)).coins;
function assertCommitted(storage,wallet=200){
  assert.equal(storage.getItem(WALLET),String(wallet));
  assert.equal(storage.getItem(EARNED),'200');
  for(const key of ['wordIslandAnimal','wordIslandAnimal_bak','wordIslandFood','wordIslandFood_bak'])assert.equal(coin(storage,key),0,`${key} 必须清零`);
  assert.equal(storage.getItem(JOURNAL),null);
  assert.match(storage.getItem(COMMIT)||'',/^[0-9a-f]{8}$/);
}

// 1) 清到一半硬崩：已清副本与未清副本都由不可变 journal 识别，重载只补剩余步骤。
{
  const s=new FaultStorage(seed());s.arm('set','wordIslandFood');boot(s);
  assert.ok(s.getItem(JOURNAL));assert.equal(coin(s,'wordIslandAnimal'),0);assert.equal(coin(s,'wordIslandFood'),60);
  assert.equal(s.getItem(WALLET),'100');assert.equal(s.getItem(EARNED),'100');
  s.disarm();boot(s);assertCommitted(s);boot(s);assertCommitted(s);
}

// 2) 所有旧岛已清、wallet 写入点硬崩：不得丢币，也不得重新累计来源金额。
{
  const s=new FaultStorage(seed());s.arm('set',WALLET);boot(s);
  assert.ok(s.getItem(JOURNAL));assert.equal(coin(s,'wordIslandFood'),0);assert.equal(s.getItem(WALLET),'100');
  s.disarm();boot(s);assertCommitted(s);boot(s);assertCommitted(s);
}

// 3) wallet 已写、earned 尚未写即硬崩：重载收口到同一个 target，不会再加 100。
{
  const s=new FaultStorage(seed());s.arm('set',EARNED);boot(s);
  assert.ok(s.getItem(JOURNAL));assert.equal(s.getItem(WALLET),'200');assert.equal(s.getItem(EARNED),'100');
  s.disarm();boot(s);assertCommitted(s);boot(s);assertCommitted(s);
}

// 4) earned 与 commit 都已写，仅 journal cleanup 失败。随后合法消费 30，重载只能清日志，绝不能抬回 200。
{
  const s=new FaultStorage(seed());s.arm('remove',JOURNAL);boot(s);
  assert.ok(s.getItem(JOURNAL));assert.match(s.getItem(COMMIT)||'',/^[0-9a-f]{8}$/);
  assert.equal(s.getItem(WALLET),'200');assert.equal(s.getItem(EARNED),'200');
  s.setItem(WALLET,'170');s.disarm();boot(s);assertCommitted(s,170);boot(s);assertCommitted(s,170);
}

function checksum(j){
  const payload=JSON.stringify([j.schema,j.createdAt,j.beforeWalletRaw,j.beforeEarnedRaw,j.beforeWallet,j.beforeEarned,j.amount,j.targetWallet,j.targetEarned,j.entries]);
  let h=2166136261>>>0;for(let i=0;i<payload.length;i++){h^=payload.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return (`00000000${h.toString(16)}`).slice(-8);
}
function prepared(){const s=new FaultStorage(seed());s.arm('set','wordIslandAnimal');boot(s);s.disarm();return s;}

// 5) 损坏 JSON 必须 fail-closed：不覆盖 journal、不清旧岛、不改 wallet/earned，旧 v1 flag 也不能掩盖它。
{
  const data=seed();data[JOURNAL]='{broken';data.hansen_coins_migrated_v1='1';const s=new FaultStorage(data),before={...s.data};
  const {c,notices}=boot(s);assert.deepEqual(s.data,before);assert.equal(c.__hansenCoinMigrationBlocked,true);
  assert.equal(c.HansenCoins.add(5),100);assert.equal(c.HansenCoins.spend(5),false);assert.equal(c.HansenCoins.award('blocked:test',5),false);
  assert.deepEqual(s.data,before,'损坏 journal 存在时所有金币写 API 都必须冻结');
  assert.ok(notices.some(x=>x.includes('迁移日志已损坏')));
}

// 6) 即使重算 checksum，伪造 amount 或 old/new raw 也过不了语义校验，并完整保留取证现场。
for(const kind of ['amount','raw']){
  const s=prepared(),j=JSON.parse(s.getItem(JOURNAL));
  if(kind==='amount'){j.amount+=1;j.targetWallet+=1;j.targetEarned+=1;}
  else{j.entries[0].newRaw=JSON.stringify({...JSON.parse(j.entries[0].newRaw),coins:1});}
  j.checksum=checksum(j);s.data[JOURNAL]=JSON.stringify(j);const before={...s.data};
  const {c}=boot(s);assert.deepEqual(s.data,before,`${kind} 篡改不得触发任何写入`);assert.equal(c.__hansenCoinMigrationBlocked,true);
}

console.log('coin migration crash v942: half-clear/wallet/earned/commit-cleanup hard crashes + corrupt journal fail-closed ✅');
