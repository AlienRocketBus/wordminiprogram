/* test_friendly_msg_v1068.mjs —— 报错文案不得被二次改写
 *
 * 事故（用户真机截图）：会话过期时，
 *   上传显示「云端匿名登录未开通（见开通指南第2步）」
 *   拉取显示「云端登录已过期，请重新登录后再同步」
 * 同一时刻、同一个错误，界面上两种互相矛盾的说法，
 * 而前者会把人引去改一个根本不相干的配置。
 *
 * 根因：hansen_cloud_save 的 friendly() 里有一条
 *   if(/anonymous|ANONYMOUS|登录|auth/i.test(m)) return '云端匿名登录未开通…'
 * 正则含 `登录` 两字通配，把 v1059 写好的准确原文
 *   「云端登录已过期，请重新登录后再同步」
 * 整个改写掉。上传路径经过 friendly()、拉取路径不经过，故说法不一。
 *
 * 合同：
 *   ① 我们自己产生的、已经是人话的错误，**原样透出，绝不改写**；
 *   ② 匿名登录规则只认真正的匿名特征词，不得用 `登录` 这种两字通配；
 *   ③ 真正的匿名登录错误仍要被正确识别。
 */
import fs from 'node:fs';
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('报错文案不得被二次改写 v1068');

const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');

/* 把 friendly() 抠出来单独跑 */
const i = code.indexOf('function friendly(err){');
const j = code.indexOf('\n  }', i)+4;
/* friendly() 内部会用 window.HBErrText，测试里补一个同实现的桩 */
const HBErrText = (e) => {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  const pick = ['error_description','errMsg','message','error','code','errCode','reason'];
  const parts = [];
  for (const k of pick) { const v = e[k]; if (v != null && typeof v !== 'object' && String(v)) { const s=String(v); if(!parts.includes(s)) parts.push(s); } }
  if (parts.length) return parts.join(' | ');
  try { const j = JSON.stringify(e); if (j && j !== '{}') return j; } catch (_) {}
  return '(无法解析的错误对象)';
};
const friendly = new Function('window', 'return ' + code.slice(i, j).replace('function friendly','function'))({ HBErrText });

/* ① 我们自己的人话必须原样透出 */
{
  const e1 = new Error('云端登录已过期，请重新登录后再同步'); e1.friendly = true; e1.sessionDead = true;
  ok(friendly(e1) === '云端登录已过期，请重新登录后再同步',
     `★ 带 friendly 标记的错误原样透出 → "${friendly(e1)}"`);
  const e2 = new Error('云端登录已过期，请重新登录后再同步');   /* 连标记都没有也得认出来 */
  ok(friendly(e2) === '云端登录已过期，请重新登录后再同步',
     `★ 已是人话的文案不被改写 → "${friendly(e2)}"`);
  const e3 = new Error('云端会话已失效');
  ok(/会话已失效/.test(friendly(e3)), '「会话已失效」同样原样透出');
  ok(!/匿名/.test(friendly(e1)) && !/匿名/.test(friendly(e2)),
     '★ 会话过期绝不能被说成「匿名登录未开通」（会把人引去改错配置）');
}

/* ② 正则不得再用 `登录` 两字通配 */
{
  ok(!/anonymous\|ANONYMOUS\|登录\|auth/.test(code),
     '★ 已去掉 `登录` 两字通配（它会吞掉一切含"登录"的准确文案）');
}

/* ③ 真正的匿名登录错误仍要被认出来 */
{
  ok(/匿名登录未开通/.test(friendly(new Error('signInAnonymously failed: not enabled'))),
     '真正的匿名登录错误仍被正确识别');
  ok(/匿名登录未开通/.test(friendly(new Error('anonymous sign-in disabled'))),
     'anonymous 关键字仍被识别');
}

/* ④ 其余映射不受影响 */
{
  ok(/安全域名/.test(friendly(new Error('invalid origin / whitelist'))), '安全域名映射仍在');
  ok(/安全规则/.test(friendly(new Error('permission denied'))), '安全规则映射仍在');
  ok(/网络不通/.test(friendly(new Error('Failed to fetch'))), '网络映射仍在');
  ok(!/\[object Object\]/.test(friendly({error:'x',error_description:'y'})), '不吐 [object Object]');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
