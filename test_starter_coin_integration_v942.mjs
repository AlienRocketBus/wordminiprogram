#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const coinSource=fs.readFileSync(new URL('./hansen_coin_wallet.js',import.meta.url),'utf8');
const upgradeSource=fs.readFileSync(new URL('./hansen_island_upgrade.js',import.meta.url),'utf8');

class Storage{
  constructor(){this.data={};this.failKey=null;}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){return Object.hasOwn(this.data,String(k))?this.data[String(k)]:null;}
  setItem(k,v){k=String(k);if(k===this.failKey)throw new Error('QuotaExceededError:'+k);this.data[k]=String(v);}
  removeItem(k){delete this.data[String(k)];}
}
function functionSource(src,name){
  const start=src.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const open=src.indexOf('{',start);let depth=0,quote='',esc=false,line=false,block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(`unclosed ${name}`);
}

assert.doesNotMatch(upgradeSource,/HansenCoins\.add\(300\)/,
  '升级层绝不能保留第二条非幂等启动金路径');
assert.match(upgradeSource,/HansenCoins\.award\('starter:global',300\)/,
  '升级层只能复用钱包的永久 starter sourceId');

const storage=new Storage();storage.failKey='hansen_starter_coins_given';
const ctx={console:{log(){},warn(){},error(){}},localStorage:storage,Date,JSON,Math,Number,isFinite,
  CustomEvent:class{},dispatchEvent(){},location:{pathname:'/island_animal.html'},
  S:{bossWon:[],learned:[],stats:{},coinWordCount:{},totalAnswers:0},setTimeout(){},clearTimeout(){}};
ctx.window=ctx;vm.createContext(ctx);

// 钱包已经完成 300 金币及 source ledger，但最后的兼容 flag 写入失败。
vm.runInContext(coinSource,ctx,{filename:'hansen_coin_wallet.js'});
assert.equal(ctx.HansenCoins.get(),300);
assert.equal(ctx.HansenCoins.getEarned(),300);
assert.equal(storage.getItem('hansen_starter_coins_given'),null);
assert.equal(ctx.HansenCoins.hasAward('starter:global'),true);

// 随后加载岛升级层：必须只重放同一 source，再补 flag，余额不能变成 600。
storage.failKey=null;
vm.runInContext(functionSource(upgradeSource,'upgradeCoins'),ctx,{filename:'upgradeCoins.js'});
ctx.upgradeCoins();
assert.equal(ctx.HansenCoins.get(),300);
assert.equal(ctx.HansenCoins.getEarned(),300);
assert.equal(storage.getItem('hansen_starter_coins_given'),'1');

// 完整重载钱包和升级层仍是 exactly-once。
ctx.__hansenCoinWalletLoaded=false;ctx.__hsnCoinsUpgraded=false;
vm.runInContext(coinSource,ctx,{filename:'hansen_coin_wallet.reload.js'});
ctx.upgradeCoins();
assert.equal(ctx.HansenCoins.get(),300);
assert.equal(ctx.HansenCoins.getEarned(),300);

console.log('starter coin integration v942: wallet commit → flag failure → upgrade/reload exactly-once ✅');
