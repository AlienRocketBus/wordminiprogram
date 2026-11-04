/* test_manifest_deploy_v1165.mjs —— 图标声明说真话；开发用的 map8/、newboss/ 不进部署
 *
 * 事故（v1163 审计 PH-11 / PH-12）：
 *   · manifest.webmanifest 把 favicon.ico（里面是 16/32/48 的 ICO）声明成 384×384 的 PNG（还写 maskable），首页 <link rel=icon> 也写 image/png；
 *   · cloudbaserc.json 的部署忽略清单没有 map8/、newboss/（开发页面会被 `tcb hosting deploy` 一起传上线）。
 *
 * 合同（静态）：manifest 里每个图标声明的尺寸 / 类型和文件头读出来的一致；首页 icon 的 type 也一致；
 *   cloudbaserc.json 的 ignore 含 map8/** 和 newboss/**，indexPath 仍是 index.html。
 *   真正的 180/192/512 PNG 图标需要老师提供图片（发版说明里写）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };

function iconFacts(file) {
  const d = fs.readFileSync(path.join(ROOT, file));
  if (d.readUInt16LE(0) === 0 && d.readUInt16LE(2) === 1) {
    const n = d.readUInt16LE(4), sizes = [];
    for (let i = 0; i < n; i++) { const w = d[6 + 16 * i] || 256, h = d[7 + 16 * i] || 256; sizes.push(`${w}x${h}`); }
    return { type: 'image/x-icon', sizes };
  }
  if (d.slice(1, 4).toString() === 'PNG') return { type: 'image/png', sizes: [`${d.readUInt32BE(16)}x${d.readUInt32BE(20)}`] };
  return { type: 'unknown', sizes: [] };
}
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
for (const ic of man.icons || []) {
  const f = iconFacts(ic.src);
  const declared = String(ic.sizes || '').split(/\s+/).filter(Boolean).sort().join(' ');
  ok(f.type === ic.type, `${ic.src}：声明类型 ${ic.type}，文件实际是 ${f.type}`);
  ok(declared === f.sizes.slice().sort().join(' '), `${ic.src}：声明尺寸「${ic.sizes}」，文件里实际是「${f.sizes.join(' ')}」`);
  ok(!/maskable/.test(ic.purpose || '') || f.type === 'image/png', `${ic.src}：ICO 不能声明 maskable（${ic.purpose}）`);
}
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const link = idx.match(/<link rel="icon" href="([^"]+)" type="([^"]+)">/);
ok(link && iconFacts(link[1]).type === link[2], `首页 <link rel=icon> 类型和文件一致（${link && link[2]}）`);
const cb = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'));
const inputs = cb.framework.plugins.site.inputs;
for (const dir of ['map8', 'newboss']) {
  const exists = fs.existsSync(path.join(ROOT, dir));
  ok(!exists || inputs.ignore.includes(dir + '/**'), `开发目录 ${dir}/ ${exists ? '存在，' : ''}不进部署（ignore 含 ${dir}/**）`);
}
ok(inputs.indexPath === 'index.html' && inputs.errorPath === 'index.html', 'indexPath / errorPath 仍是 index.html');
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 图标声明说真话、开发目录不进部署');
process.exit(fails ? 1 : 0);
