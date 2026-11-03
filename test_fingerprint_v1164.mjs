#!/usr/bin/env node
/* test_fingerprint_v1164.mjs —— 「代码一改，旧的全绿自动作废」对模拟云端、测试公共件、SDK 也要成立（审查 TI-6）
 *
 * 分批跑测试.py / jarvis_gate.py 用一个「指纹」判断上次的测试结果还算不算数。
 * 以前指纹只看 hansen_*.js、sw_*.js、test_*.mjs —— 模拟云端（cloudbase_emulator.mjs）放宽了、
 * 测试公共件（cloudbase_e2e_harness.mjs）改了、发给手机的 SDK（vendor_*.js）换了，指纹都不变，
 * 旧的「187 条全过」照样作数，闸门照样放行。
 *
 * 这里在一个临时目录里放一份 分批跑测试.py 和几个小文件，真的算指纹：改哪一个都必须变。
 * 再看两份文件里的文件清单是不是同一份（两边不一致，闸门就不认跑测试留下的存档）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('测试结果指纹（审查 TI-6）');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn-fp-'));
try {
  fs.copyFileSync(path.join(ROOT, '分批跑测试.py'), path.join(tmp, '分批跑测试.py'));
  const files = {
    'hansen_demo.js': 'var a = 1;',
    'sw_demo.js': 'var s = 1;',
    'test_demo.mjs': 'console.log(1);',
    'cloudbase_emulator.mjs': 'export const strict = true;',
    'cloudbase_e2e_harness.mjs': 'export const errorsChecked = true;',
    'playwright_loader.mjs': 'export const x = 1;',
    'vendor_cloudbase_esm_v965.js': 'export const sdk = "2.30.0";',
  };
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(tmp, f), c);
  const fp = () => execFileSync('python3', ['-I', '-c',
    'import importlib.util,sys\nspec=importlib.util.spec_from_file_location("runner", sys.argv[1])\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\nprint(m.fingerprint())',
    path.join(tmp, '分批跑测试.py')], { encoding: 'utf8' }).trim();
  const base = fp();
  ok(/^[0-9a-f]{16}$/.test(base), `算得出指纹（${base}）`);
  for (const [f, change] of [
    ['cloudbase_emulator.mjs', 'export const strict = false;   // 模拟云端放宽了'],
    ['cloudbase_e2e_harness.mjs', 'export const errorsChecked = false;'],
    ['vendor_cloudbase_esm_v965.js', 'export const sdk = "2.31.0";'],
    ['playwright_loader.mjs', 'export const x = 2;'],
    ['hansen_demo.js', 'var a = 2;'],
  ]) {
    const before = fp();
    fs.writeFileSync(path.join(tmp, f), change);
    const after = fp();
    ok(after !== before, `★ 改了 ${f} → 指纹变了（${before} → ${after}），旧的「全绿」不再作数`);
  }
  /* 两份文件的文件清单必须一模一样（闸门和跑测试的人对「哪些文件算代码」要说同一句话） */
  const pats = (src) => {
    const m = /for\s+\w+\s+in\s+\(([^)]*template\.html[^)]*)\)/.exec(src);
    return m ? m[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort().join(' ') : '';
  };
  const a = pats(fs.readFileSync(path.join(ROOT, '分批跑测试.py'), 'utf8'));
  const b = pats(fs.readFileSync(path.join(ROOT, 'jarvis_gate.py'), 'utf8'));
  ok(a && a === b, `★ 分批跑测试.py 和 jarvis_gate.py 的文件清单一致（${a} ｜ ${b}）`);
  ok(/\*\.mjs/.test(a) && /\*\.js/.test(a), `★ 清单盖住所有 .js / .mjs（${a}）`);
} finally {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 清不掉也无所谓 */ }
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
