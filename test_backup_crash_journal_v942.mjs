import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const JOURNAL='hansen_backup_restore_journal_v942';
const CACHE_VERSION=fs.readFileSync(new URL('./VERSION',import.meta.url),'utf8').trim();
const stable=items=>items.map(x=>x.key+'\u0000'+x.value).join('\u0001');
function checksum(s){let h=2166136261;s=String(s||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a32-'+(h>>>0).toString(16).padStart(8,'0');}
function journal(phase,beforeRaw,appVersion=942){return JSON.stringify({schema:1,appVersion,phase,beforeRaw,checksum:checksum(stable(beforeRaw))});}

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.history=[];}
  get length(){return Object.keys(this.d).length;}
  key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){k=String(k);this.d[k]=String(v);if(k===JOURNAL)this.history.push({op:'set',value:String(v)});}
  removeItem(k){k=String(k);delete this.d[k];if(k===JOURNAL)this.history.push({op:'remove'});}
}
function context(storage,{blockedDocument=false}={}){
  const writes=[];
  class FakeNode{
    constructor(tag){this.tagName=String(tag||'').toUpperCase();this.children=[];this.parentNode=null;this.textContent='';this.className='';this.id='';this.style={};}
    get firstChild(){return this.children[0]||null;}
    appendChild(node){node.parentNode=this;this.children.push(node);return node;}
    removeChild(node){const i=this.children.indexOf(node);if(i>=0)this.children.splice(i,1);node.parentNode=null;return node;}
    replaceChildren(...nodes){for(const old of this.children)old.parentNode=null;this.children=[];for(const node of nodes)this.appendChild(node);}
    setAttribute(name,value){this[String(name)]=String(value);}
    remove(){if(this.parentNode&&this.parentNode.removeChild)this.parentNode.removeChild(this);}
    click(){}
  }
  const html=new FakeNode('html');
  const document={
    readyState:'loading',documentElement:html,body:null,addEventListener(){},
    createElement(tag){return new FakeNode(tag);},
    getElementById(id){const walk=n=>n.id===id?n:n.children.map(walk).find(Boolean);return walk(html)||null;},
    appendChild(node){node.parentNode=this;this.documentElement=node;return node;}
  };
  html.parentNode=document;
  const nativeReplace=html.replaceChildren.bind(html);html.replaceChildren=(...nodes)=>{nativeReplace(...nodes);document.body=nodes.find(n=>n.tagName==='BODY')||null;};
  const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},location:{reload(){}},stop(){},Blob,URL,alert(){},confirm(){return false;}};
  c.window=c;c.globalThis=c;vm.createContext(c);return {c,writes};
}
function runBootstrap(storage,options){const out=context(storage,options);vm.runInContext(fs.readFileSync(new URL('./hansen_backup_bootstrap_v944.js',import.meta.url),'utf8'),out.c,{filename:'hansen_backup_bootstrap_v944.js'});return out;}

const bootstrapSource=fs.readFileSync(new URL('./hansen_backup_bootstrap_v944.js',import.meta.url),'utf8');
assert.ok(!bootstrapSource.includes('document.write('),'损坏日志安全页禁止恢复 document.write');
assert.ok(bootstrapSource.includes("html.replaceChildren(head,body)"),'安全页必须用 DOM 原子替换原文档');
assert.ok(bootstrapSource.includes("n.textContent=text"),'安全页文字必须通过 textContent 写入');
assert.ok(
  bootstrapSource.includes("a.download='wordminiprogram_v960_restore_journal.json'"),
  '损坏恢复日志下载名必须标记当前 v960，不能继续误写旧版本'
);

// prepared 日志代表上次恢复在交易中途关页：启动第一步必须回到 raw 旧快照。
const before=[
  {key:'hansen_coin_award_pending_v942',value:'live-proof'},
  {key:'hansen_old_owned',value:'old'},
  {key:'hansen_wallet_coins',value:'42'},
  {key:'wordIslandAnimal',value:'{"learned":[1]}'}
];
let storage=new Storage({
  unrelated:'keep',hansen_wallet_coins:'999',hansen_new_owned:'half-target',wordIslandAnimal:'{"learned":[]}',
  [JOURNAL]:journal('prepared',before)
});
let {c}=runBootstrap(storage);
assert.equal(storage.getItem('hansen_wallet_coins'),'42');
assert.equal(storage.getItem('hansen_old_owned'),'old');
assert.equal(storage.getItem('hansen_coin_award_pending_v942'),'live-proof','raw pending 必须精确回来');
assert.equal(storage.getItem('hansen_new_owned'),null,'半恢复目标不得残留');
assert.equal(storage.getItem('unrelated'),'keep','同源非本应用键不得触碰');
assert.equal(storage.getItem(JOURNAL),null);
assert.equal(c.__hansenBackupBootstrap.result.rolledBack,true);
assert.equal(c.__hansenBackupBootstrap.journalKey,JOURNAL,'升级不能改名 v942 恢复日志键');
// 这一行模拟游戏 load()：它只能看见已回滚的完整状态，不能看见 999 的半恢复值。
assert.equal(JSON.parse(storage.getItem('wordIslandAnimal')).learned[0],1);

// committed 日志只是收尾清理中断：已发布兼容版本应保留目标；跳过的 v947-v949 不得混入。
for(const appVersion of [942,943,944,945,946,950,951,952,953,954,955,956,957,958,959,960]){
  storage=new Storage({unrelated:'keep',hansen_wallet_coins:'999',wordIslandAnimal:'{"learned":[]}',[JOURNAL]:journal('committed',before,appVersion)});
  ({c}=runBootstrap(storage));
  assert.equal(storage.getItem('hansen_wallet_coins'),'999');
  assert.equal(storage.getItem('hansen_old_owned'),null);
  assert.equal(storage.getItem(JOURNAL),null);
  assert.equal(c.__hansenBackupBootstrap.result.committed,true,`bootstrap 必须接管 v${appVersion} committed journal`);
}

// 完整备份模块自身也必须能接管兼容 journal；键名保持 v942。
for(const appVersion of [942,943,944,945,946,950,951,952,953,954,955,956,957,958,959,960]){
  storage=new Storage({unrelated:'keep',hansen_wallet_coins:'999',[JOURNAL]:journal('prepared',before,appVersion)});
  const direct=context(storage);c=direct.c;
  vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});
  assert.equal(storage.getItem('hansen_wallet_coins'),'42',`主模块必须恢复 v${appVersion} prepared journal`);
  assert.equal(storage.getItem(JOURNAL),null);
  assert.equal(c.HansenBackup.startupRecovery.rolledBack,true);
  assert.equal(c.HansenBackup._journalKey,JOURNAL);
}

// 损坏/伪造日志不能驱动任何玩家数据写入，也不能静默删除唯一证据。
const bad='{"schema":1,"appVersion":942,"phase":"prepared","beforeRaw":[],"checksum":"wrong"}';
storage=new Storage({unrelated:'keep',hansen_wallet_coins:'777',[JOURNAL]:bad});
let blocked=runBootstrap(storage,{blockedDocument:true});
assert.equal(storage.getItem('hansen_wallet_coins'),'777');
assert.equal(storage.getItem('unrelated'),'keep');
assert.equal(storage.getItem(JOURNAL),bad,'非法日志必须保留供导出/诊断');
assert.equal(blocked.c.__hansenBackupBootstrap.result.blocked,true);
assert.match(blocked.c.__hansenBackupRecoveryBlocked,/校验和/,'应 fail-closed 记录安全页原因');

// 范围外、非整数或伪装成字符串的 journal 版本即使校验和正确也必须 fail-closed，并保留证据。
for(const unsupportedVersion of [941,943.5,'946',947,948,949,961]){
  const unsupported=journal('prepared',before,unsupportedVersion);
  storage=new Storage({hansen_wallet_coins:'777',[JOURNAL]:unsupported});
  blocked=runBootstrap(storage,{blockedDocument:true});
  assert.equal(storage.getItem('hansen_wallet_coins'),'777');
  assert.equal(storage.getItem(JOURNAL),unsupported,`不支持的版本 ${unsupportedVersion} 必须保留证据`);
  assert.equal(blocked.c.__hansenBackupBootstrap.result.blocked,true);
  assert.match(blocked.c.__hansenBackupRecoveryBlocked,/结构无效/);

  storage=new Storage({hansen_wallet_coins:'777',[JOURNAL]:unsupported});
  const direct=context(storage);c=direct.c;
  vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});
  assert.equal(storage.getItem('hansen_wallet_coins'),'777');
  assert.equal(storage.getItem(JOURNAL),unsupported,`主模块也必须保留不支持版本 ${unsupportedVersion} 的证据`);
  assert.match(c.HansenBackup.startupRecovery.error,/结构无效/);
}

// 正常恢复事务必须依次落盘 prepared 和 committed，最后才删日志。
storage=new Storage({hansen_wallet_coins:'42',hansen_old_owned:'old',unrelated:'keep'});
({c}=runBootstrap(storage));
vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});
c.HansenBackup._replaceAll([{key:'hansen_wallet_coins',value:'999'}]);
const journalWrites=storage.history.filter(x=>x.op==='set').map(x=>JSON.parse(x.value));
assert.deepEqual(journalWrites.map(x=>x.phase),['prepared','committed']);
assert.deepEqual(journalWrites.map(x=>x.appVersion),[960,960],'v960 新写 journal 必须标记当前应用版本');
assert.equal(storage.history.at(-1).op,'remove');
assert.equal(storage.getItem('hansen_wallet_coins'),'999');
assert.equal(storage.getItem('hansen_old_owned'),null);
assert.equal(storage.getItem('unrelated'),'keep');

// 所有发布运行页都必须在第一次 localStorage 读取和主 load() 之前同步加载 bootstrap。
const runtime=['index.html','_frame.html','boss_hall.html','land_map.html','season_showcase.html','spelling_bee.html',...fs.readdirSync('.').filter(x=>/^island_[a-z0-9]+\.html$/.test(x)).sort()];
for(const file of runtime){
  const html=fs.readFileSync(file,'utf8'),boot=html.indexOf('hansen_backup_bootstrap_v944.js?v='+CACHE_VERSION),firstStorage=html.indexOf('localStorage');
  assert.ok(boot>=0,`${file}: 缺恢复 bootstrap`);
  assert.ok(firstStorage<0||boot<firstStorage,`${file}: bootstrap 必须早于首次 localStorage`);
  const mainLoad=html.indexOf('load();');assert.ok(mainLoad<0||boot<mainLoad,`${file}: bootstrap 必须早于 load()`);
}

console.log('backup crash journal v960: prepared rollback + committed cleanup + skipped-version fail-closed + pre-load ordering ✅');
