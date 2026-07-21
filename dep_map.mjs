/* dep_map.mjs (v937) — 依赖图提取器: 真机渲染, 把【谁用了谁】全部抓出来
 *
 * Hansen: "这么容易出bug, 能不能做一个机制, 防止每次更新内容的时候出现bug?"
 *
 * ★ 这次会话每一个 bug 的结构【完全一样】:
 *     我改了 X, X 被 {A,B,C} 用着, 我只验了 A。
 *   · 头像压小   → 我只量了顶栏(46px), 忘了网格(110px)和详情大卡(331px)
 *   · 字体子集化 → 我只留了想到的字, 砍掉了 562 个真的会显示的
 *   · 飞行装饰改 transform → 我没看到那些元素【还挂着第二条自转动画】(两条都动 transform, 后者赢)
 *
 * ★ 所以要防住, 必须能【自动回答】: 我改的这个东西, 到底被哪些地方用着?
 *   grep 回答不了 —— 图片可能是 <img>/SVG image/CSS 背景图, 尺寸只有渲染出来才知道;
 *   元素挂了几条动画、每条动画动的是哪个属性, 也只有渲染出来才知道。
 *   所以必须【真机渲染】, 把依赖图抓出来存成 JSON, 给 impact_guard 用。
 *
 * ★ 抓三类依赖:
 *   ① 资源 → 使用方: 每张图/每个字体, 出现在哪些界面、每处的【展示位尺寸】是多少
 *   ② 动画 → 挂在哪些元素: 每个元素挂了几条动画、每条动画动的是哪些属性
 *      ★特别标出【同一个元素上两条动画都在动 transform】—— 后声明的会把前面的整个覆盖掉(飞行装饰就是这么废的)
 *   ③ 字体 → 真的画出来的字: 每个字体元素实际渲染了哪些字符
 */
import { chromium } from './playwright_loader.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const SCREENS = ['home', 'explore', 'listen', 'match', 'typing', 'cloze', 'scramble',
  'bubble', 'chest', 'eagle', 'fish', 'moles', 'speed', 'cards',
  'review', 'stats', 'pet', 'quests', 'ach', 'settings', 'boss'];

const assets = {};      // "avatars/01.webp" -> [{where, kind, slot:[w,h], nat:[w,h]}]
const animConflicts = []; // 同一元素两条动画都动 transform
const animMap = {};     // "flyWand" -> [{where, sel, alsoHas:[...]}]
const fontChars = {};   // "cartoon" -> Set(chars)

function addAsset(src, rec) {
  if (!src) return;
  const key = src.split('?')[0].replace(/^https?:\/\/[^/]+\//, '');
  (assets[key] = assets[key] || []).push(rec);
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });

  for (const PAGE of ['index.html', 'island_land1.html', 'island_season.html']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try {
        localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 99999, diamonds: 9999, stats: { maxCombo: 3 }, wrongs: { 0: 1 } }));
        for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
      } catch (e) { }
    });
    const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 50000 });
    await p.waitForTimeout(2400);
    const kill = () => p.evaluate(() => {
      ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      document.body.classList.remove('modal-open');
    });
    await kill();

    // 地图页要把 6 个主题都切一遍(装饰是按主题显示的, 默认主题下看不到 = 会漏掉)
    const themes = PAGE === 'index.html' ? ['cosmos', 'pink', 'ocean', 'forest', 'rainbow', 'peach'] : [null];
    const screens = PAGE === 'index.html' ? [null] : SCREENS;

    for (const th of themes) {
      if (th) {
        await p.evaluate((t) => { document.body.classList.remove('hsn-dia-on'); document.body.setAttribute('data-theme', t); }, th);
        await p.waitForTimeout(600);
      }
      for (const sc of screens) {
        if (sc) {
          await p.evaluate((id) => { try { showScreen(id); } catch (e) { } }, sc);
          await p.waitForTimeout(sc === 'boss' ? 1200 : 480);
          if (sc === 'boss') { await p.evaluate(() => { try { startBoss(); } catch (e) { } }); await p.waitForTimeout(1200); }
          await kill();
        }
        const tag = PAGE.replace('island_', '').replace('.html', '') + (th ? '/' + th : '') + (sc ? '/' + sc : '');

        const dump = await p.evaluate(() => {
          const out = { imgs: [], anims: [], fonts: [] };
          // ── ① 资源 ──
          document.querySelectorAll('img').forEach(im => {
            const bb = im.getBoundingClientRect();
            if (bb.width < 8 || bb.height < 8) return;
            out.imgs.push({ kind: 'img', src: im.currentSrc || im.getAttribute('src') || '',
              slot: [Math.round(bb.width), Math.round(bb.height)],
              nat: [im.naturalWidth || 0, im.naturalHeight || 0] });
          });
          document.querySelectorAll('svg image').forEach(im => {
            const bb = im.getBoundingClientRect();
            if (bb.width < 8 || bb.height < 8) return;
            const h = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
            if (h && !h.startsWith('data:')) out.imgs.push({ kind: 'svg', src: h, slot: [Math.round(bb.width), Math.round(bb.height)], nat: [0, 0] });
          });
          document.querySelectorAll('*').forEach(el => {
            const cs = getComputedStyle(el);
            const bg = cs.backgroundImage;
            if (bg && bg !== 'none' && /url\(/.test(bg)) {
              const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
              if (m && !m[1].startsWith('data:')) {
                const bb = el.getBoundingClientRect();
                if (bb.width > 20 && bb.height > 20)
                  out.imgs.push({ kind: 'cssbg', src: m[1], slot: [Math.round(bb.width), Math.round(bb.height)], nat: [0, 0] });
              }
            }
            // ── ② 动画 ──
            const an = cs.animationName;
            if (an && an !== 'none') {
              const names = an.split(',').map(x => x.trim()).filter(x => x && x !== 'none');
              if (names.length) {
                const bb = el.getBoundingClientRect();
                out.anims.push({
                  names,
                  sel: (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : el.tagName),
                  visible: cs.display !== 'none' && cs.visibility !== 'hidden' && bb.width > 0
                });
              }
            }
            // ── ③ 字体 ──
            const ff = (cs.fontFamily || '').toLowerCase();
            if (/cartoon|bowlby/.test(ff)) {
              const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
              if (t.trim()) out.fonts.push({ font: 'cartoon', text: t });
            }
          });
          // 每条 @keyframes 动的是哪些属性(从样式表里读)
          const kf = {};
          for (const sh of document.styleSheets) {
            let rules; try { rules = sh.cssRules; } catch (e) { continue; }
            if (!rules) continue;
            for (const r of rules) {
              if (r.type === 7 /* KEYFRAMES */) {
                const props = new Set();
                for (const k of r.cssRules || []) {
                  for (let i = 0; i < k.style.length; i++) props.add(k.style[i]);
                }
                kf[r.name] = [...props];
              }
            }
          }
          out.kf = kf;
          return out;
        });

        dump.imgs.forEach(r => addAsset(r.src, { where: tag, kind: r.kind, slot: r.slot, nat: r.nat }));
        dump.fonts.forEach(f => { (fontChars[f.font] = fontChars[f.font] || new Set()); for (const ch of f.text) fontChars[f.font].add(ch); });

        // 动画冲突: 同一元素 ≥2 条动画, 且 ≥2 条都在动 transform
        dump.anims.forEach(a => {
          a.names.forEach(n => { (animMap[n] = animMap[n] || []).push({ where: tag, sel: a.sel, together: a.names }); });
          if (a.names.length >= 2) {
            const tf = a.names.filter(n => (dump.kf[n] || []).some(pp => pp === 'transform' || pp === 'translate' || pp === 'rotate' || pp === 'scale'));
            if (tf.length >= 2) {
              animConflicts.push({ where: tag, sel: a.sel, anims: a.names, transformAnims: tf, visible: a.visible });
            }
          }
        });
      }
      // ⚠️ 只走 21 个屏是【不够的】—— 形象选择器/详情、单词弹窗、商店/扭蛋/展柜里的图
      //    根本不在那 21 个屏里。第一版依赖图就漏了"形象详情大卡(331px)", 结果头像压小的 bug 它抓不到 ——
      //    我建的依赖图自己犯了同一个错误(只覆盖我想到的地方)。必须把这些界面也走一遍。
    }
    if (PAGE !== 'index.html') {
      const extra = async (tag, fn, wait) => {
        await p.evaluate(fn).catch(() => {});
        await p.waitForTimeout(wait || 1200);
        const dump = await p.evaluate(() => {
          const out = [];
          document.querySelectorAll('img').forEach(im => {
            const bb = im.getBoundingClientRect();
            if (bb.width < 8 || bb.height < 8) return;
            out.push({ kind: 'img', src: im.currentSrc || im.getAttribute('src') || '',
              slot: [Math.round(bb.width), Math.round(bb.height)], nat: [im.naturalWidth || 0, im.naturalHeight || 0] });
          });
          return out;
        });
        const t = PAGE.replace('island_', '').replace('.html', '') + '/' + tag;
        dump.forEach(r => addAsset(r.src, { where: t, kind: r.kind, slot: r.slot, nat: r.nat }));
      };
      await p.evaluate(() => { try { showScreen('home'); } catch (e) {} });
      await p.waitForTimeout(600);
      await extra('形象选择器', () => {
        try {
          if (window.HansenAvatar && window.HansenAvatar.openPicker) window.HansenAvatar.openPicker();
          else { const a = document.querySelector('.avatar, .hsn-av-btn'); if (a) a.click(); }
        } catch (e) {}
      }, 1400);
      await extra('形象详情', () => { const t = document.querySelector('.hsn-av-thumb,.hsn-av-tile,[data-av]'); if (t) t.click(); }, 1800);
      await p.evaluate(() => { try { showScreen('explore'); } catch (e) {} });
      await p.waitForTimeout(700);
      await extra('单词弹窗', () => { try { showWord(0); } catch (e) {} }, 1100);
      await p.evaluate(() => { const m = document.getElementById('wordModal'); if (m) { m.classList.remove('show'); m.style.display = 'none'; } document.body.classList.remove('modal-open'); });
      for (const [nm, mod] of [['钻石商店','HansenDiamondShop'],['扭蛋','HansenGacha'],['宠物展柜','HansenPetShowcase']]) {
        await p.evaluate(() => { try { showScreen('home'); } catch (e) {} });
        await p.waitForTimeout(450);
        await extra(nm, new Function('try{const M=window["' + mod + '"];if(M&&M.open)M.open();}catch(e){}'), 1200);
      }
    }
    await c.close();
  }
  await b.close();

  const out = {
    assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => {
      // 每个资源只保留【不重复的展示位】
      const seen = new Set(); const uniq = [];
      v.forEach(r => { const k2 = r.where + '|' + r.slot.join('x'); if (!seen.has(k2)) { seen.add(k2); uniq.push(r); } });
      return [k, uniq];
    })),
    animConflicts,
    animMap: Object.fromEntries(Object.entries(animMap).map(([k, v]) => {
      const seen = new Set(); const uniq = [];
      v.forEach(r => { const k2 = r.where + '|' + r.sel; if (!seen.has(k2)) { seen.add(k2); uniq.push(r); } });
      return [k, uniq];
    })),
    fontChars: Object.fromEntries(Object.entries(fontChars).map(([k, v]) => [k, [...v]])),
  };
  fs.writeFileSync('/tmp/dep_map.json', JSON.stringify(out));
  const nAsset = Object.keys(out.assets).length;
  const nAnim = Object.keys(out.animMap).length;
  console.log(`  依赖图抓取完成: 资源 ${nAsset} 个 · 动画 ${nAnim} 条 · 字体字符 ${(out.fontChars.cartoon || []).length} 个`);
  console.log(`  ⚠️ 【同一元素上两条动画都在动 transform】的冲突: ${animConflicts.length} 处`);
  animConflicts.slice(0, 8).forEach(c =>
    console.log(`     ${c.visible ? '❌可见' : '·隐藏'} ${c.sel.padEnd(20)} 挂了 [${c.anims}] 其中动 transform 的: [${c.transformAnims}]  @${c.where}`));
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
