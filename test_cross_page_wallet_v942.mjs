import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const INDEX=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const SW=fs.readFileSync(new URL('./sw_v944.js',import.meta.url),'utf8');
const COIN=fs.readFileSync(new URL('./hansen_coin_wallet.js',import.meta.url),'utf8');
const SHOP=fs.readFileSync(new URL('./hansen_theme_shop.js',import.meta.url),'utf8');
const CACHE_VERSION=fs.readFileSync(new URL('./VERSION',import.meta.url),'utf8').trim();
const PENDING='hansen_coin_award_pending_v942';
const AWARDS='hansen_coin_awards_v942';

class Storage{
  constructor(seed={}){this.data={...seed};}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null;}
  setItem(k,v){this.data[k]=String(v);}
  removeItem(k){delete this.data[k];}
}
function node(){return {style:{setProperty(){}},dataset:{},children:[],parentNode:null,parentElement:null,classList:{add(){},remove(){}},appendChild(x){x.parentNode=this;this.children.push(x);return x;},removeChild(x){this.children=this.children.filter(y=>y!==x);},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};}
function context(storage){
  const body=node(),head=node(),document={readyState:'complete',body,head,createElement:node,getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}};
  const c={console,JSON,Number,Date,Math,isFinite,parseInt,localStorage:storage,document,CustomEvent:class{},MutationObserver:class{observe(){}disconnect(){}},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},dispatchEvent(){},addEventListener(){},removeEventListener(){}};
  c.window=c;return c;
}
function load(src,storage,filename){const c=context(storage);vm.createContext(c);vm.runInContext(src,c,{filename});return c;}

// 静态合同：备份崩溃恢复最早，金币钱包紧随其后且是同步 classic script；所有首页消费商店都只能排在它之后。
{
  const backup=INDEX.indexOf('<script src="hansen_backup_bootstrap_v944.js?v='+CACHE_VERSION+'"></script>');
  const wallet=INDEX.indexOf('<script src="hansen_coin_wallet.js?v='+CACHE_VERSION+'"></script>');
  const body=INDEX.indexOf('<body');
  assert.ok(backup>=0&&wallet>backup&&wallet<body,'coin_wallet 必须在 body/任何金币 UI 之前同步加载');
  assert.equal(INDEX.split('<script src="hansen_coin_wallet.js?v='+CACHE_VERSION+'"></script>').length-1,1);
  for(const [consumer,version] of [['hansen_theme_shop.js',CACHE_VERSION],['hansen_diamond_shop.js',CACHE_VERSION]])assert.ok(wallet<INDEX.indexOf(`<script src="${consumer}?v=${version}"></script>`),`${consumer} 必须晚于 coin_wallet`);
  const shell=SW.match(/const SHELL = \[([\s\S]*?)\];/)?.[1]||'',shellBackup=shell.indexOf("'./hansen_backup_bootstrap_v944.js'"),shellWallet=shell.indexOf("'./hansen_coin_wallet.js'");
  assert.ok(shellBackup>=0&&shellWallet>shellBackup&&shellWallet<shell.indexOf("'./hansen_theme_shop.js'"),'离线 SHELL 也必须按恢复→钱包→商店顺序缓存关键脚本');
}

// 岛页崩溃点：余额/累计已写到 target，但 award ledger 与 pending 尚未收尾。
// 打开首页必须先补 ledger+清 pending，再允许主题消费；回岛重载不能把消费掉的 300 抬回形成免费购买。
{
  const pending={id:'island:food:round:award',amount:300,beforeWallet:1000,beforeEarned:1000,targetWallet:1300,targetEarned:1300,at:1700000000000};
  const storage=new Storage({
    hansen_wallet_coins:'1300',hansen_wallet_coins_earned:'1300',
    [AWARDS]:'{}',[PENDING]:JSON.stringify(pending),hansen_starter_coins_given:'1'
  });
  const home=load(COIN,storage,'hansen_coin_wallet.js');
  assert.equal(storage.getItem(PENDING),null,'首页钱包加载阶段必须先恢复并清理跨页 pending');
  assert.equal(JSON.parse(storage.getItem(AWARDS))[pending.id].amount,300);
  assert.equal(home.HansenCoins.get(),1300);

  const originalSpend=home.HansenCoins.spend;
  home.HansenCoins.spend=function(n){assert.equal(storage.getItem(PENDING),null,'消费发生时 award pending 必须已收尾');return originalSpend.call(this,n);};
  vm.runInContext(SHOP,home,{filename:'hansen_theme_shop.js'});
  assert.equal(home.HansenThemeShopV942.purchase('ocean'),true);
  assert.equal(storage.getItem('hansen_wallet_coins'),'1000');
  assert.equal(JSON.parse(storage.getItem('hansen_unlocked_themes')).includes('ocean'),true);

  const islandReload=load(COIN,storage,'hansen_coin_wallet.js');
  assert.equal(islandReload.HansenCoins.get(),1000,'回岛恢复不得把已消费余额抬回 target');
  assert.equal(storage.getItem(PENDING),null);assert.equal(JSON.parse(storage.getItem(AWARDS))[pending.id].amount,300);
}

console.log('cross-page wallet v942: index sync order + award recovery before immediate home spend + no balance resurrection ✅');
