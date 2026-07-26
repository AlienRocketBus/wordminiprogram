/* test_key_roundtrip_v1033.mjs —— 密钥「写入 ↔ 读取」必须指向同一文档
 * 事故（用户实测定位）：自检面板点「立刻上传」显示成功，
 *   紧接着点「从云端拉取」却报「云端没有这把密钥对应的存档」。
 * 根因：写入走 docIdOf(ensureKey())——**原始密钥**；
 *   读取走 docIdOf(normalizeKey(key))——**归一化密钥**。
 *   而 normalizeKey 会做 U→V / I,L→1 / O→0 并去掉连字符。
 *   v1017 生成账号密钥用的字符集恰含 L 与 U，于是两条路径算出**不同的文档地址**：
 *   东西真的写进去了，只是写在 A、读的是 B。
 * 合同：① 生成的密钥经归一化后必须与自身一致(即不含会被改写的字符)；
 *       ② 任意账号 uid 都成立；③ 生成字符集与 normalizeKey 接受的字符集必须同一份。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('密钥写读一致性 v1033');
const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');

/* 源码层：两处字符集必须是同一份 */
ok(/var CH = ALPHABET;/.test(src), '生成密钥直接复用 ALPHABET(不再另写一份)');
ok(/normalizeKey\(ensureKey\(\)\)/.test(src), '写入路径也先归一化, 与读取对齐');
const alpha = (src.match(/ALPHABET\s*=\s*'([^']+)'/)||[])[1] || '';
ok(alpha.length>0, 'ALPHABET 可解析: '+alpha);
ok(!/[ILOU]/.test(alpha), 'ALPHABET 不含会被归一化改写的 I/L/O/U');

/* 运行时：任意 uid 生成的密钥, 归一化后必须与自身一致 */
const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
const win={ HANSEN_CLOUD_CONFIG:{envId:'e'}, localStorage:store,
  document:{addEventListener(){},documentElement:{classList:{contains:()=>false}},getElementById:()=>null,querySelector:()=>null},
  crypto:{getRandomValues:(a)=>a,subtle:{digest:()=>Promise.resolve(new ArrayBuffer(32))}},
  addEventListener(){}, setTimeout:(f)=>{f&&f();return 0;}, setInterval:()=>0,
  TextEncoder, TextDecoder, btoa:(s)=>Buffer.from(s,'binary').toString('base64'), atob:(s)=>Buffer.from(s,'base64').toString('binary') };
win.window=win; const ctx={...win, window:win}; vm.createContext(ctx);
try{ vm.runInContext(src, ctx); }catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const CS=win.HansenCloudSave;
ok(!!CS, '模块已加载');

/* 复刻 normalizeKey 用于校验 */
function norm(s){ s=String(s||'').toUpperCase().replace(/[^0-9A-Z]/g,'')
  .replace(/O/g,'0').replace(/[IL]/g,'1').replace(/U/g,'V');
  return s.length===16 ? s : null; }

let bad=[], n=0;
for(const uid of ['U1','abc-123','UID-TEST-777','用户xyz','ambitious-d0g1d26xm740dc3d6','A','zzzzzzzzzzzz','9f8e7d6c5b4a']){
  win.HansenAuth={ isSignedIn:()=>true, currentUser:()=>({uid}), readLocal:()=>({uid}) };
  const k=CS.ensureKey(); n++;
  const stripped=k.replace(/-/g,'');
  const nk=norm(k);
  if(!nk || nk!==stripped) bad.push(uid+': '+k+' → '+nk);
}
ok(bad.length===0, `${n} 个不同账号生成的密钥, 归一化后均与自身一致`+(bad.length?'；异常: '+bad.slice(0,2).join(' | '):''));

/* 回归重现：若用旧字符集会怎样(证明这条断言真的抓得住问题) */
const OLD='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
ok(/[LU]/.test(OLD) && !/[LU]/.test(alpha), '旧字符集含 L/U 而新的不含(确认修复方向正确)');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
