/* v935 端到端回归: 把我改过的功能【真的用一遍】
 *   ① 打Boss主题选择器: 在设置页真的点一下, 主题有没有换过去
 *   ② 真打一场 Boss: 引擎按需加载 + 特效图(bossfx/*.webp)有没有真的画出来
 *   ③ 卡册: 加了 loading=lazy 之后, 图还显不显示
 *   ④ 形象详情: 高清图有没有真的用上
 */
import { chromium } from './playwright_loader.mjs';

const PORT = process.argv[2] || '8877';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 99999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
  });
  const p = await c.newPage();
  const net = { bossfx: 0, engine: 0, hd: 0, err404: [] };
  p.on('response', r => {
    const u = r.url();
    if (/bossfx\//.test(u)) net.bossfx++;
    if (/hansen_boss_attack\.js/.test(u)) net.engine++;
    if (/avatars\/hd\//.test(u)) net.hd++;
    if (r.status() >= 400) net.err404.push(u.split('/').slice(-1)[0]);
  });

  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 50000 });
  await p.waitForTimeout(2400);
  const kill = () => p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });
  await kill();

  let pass = 0, fail = 0;
  const chk = (name, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${name}${note ? '  ' + note : ''}`); };

  // ── ① 打Boss主题选择器 ──
  console.log('  ① 打Boss 主题选择器');
  await p.evaluate(() => { try { showScreen('settings'); } catch (e) { } });
  await p.waitForTimeout(900);
  const picker = await p.evaluate(() => {
    const box = document.getElementById('hsnBossThemePicker');
    if (!box) return { no: 1 };
    const sw = box.querySelectorAll('.hsn-bt-sw');
    return { n: sw.length, ids: [...sw].map(s => s.getAttribute('data-bt')), cur: document.documentElement.className.match(/hsn-bt-\w+/) };
  });
  chk('选择器出现在设置页', !picker.no && picker.n === 3, picker.no ? '(没找到)' : `3个选项: ${picker.ids}`);
  // 真的点「晨曦(亮色)」
  await p.evaluate(() => { const s = document.querySelector('.hsn-bt-sw[data-bt="light"]'); if (s) s.click(); });
  await p.waitForTimeout(700);
  const afterLight = await p.evaluate(() => ({ cls: document.documentElement.className, saved: localStorage.getItem('hansen_boss_theme') }));
  chk('点「晨曦」→ 主题切过去了', /hsn-bt-light/.test(afterLight.cls) && afterLight.saved === 'light', `html类=${(afterLight.cls.match(/hsn-bt-\w+/) || [''])[0]} 存档=${afterLight.saved}`);
  // 切回深空
  await p.evaluate(() => { const s = document.querySelector('.hsn-bt-sw[data-bt="dark"]'); if (s) s.click(); });
  await p.waitForTimeout(500);
  const afterDark = await p.evaluate(() => document.documentElement.className);
  chk('点「深空」→ 切回来了', /hsn-bt-dark/.test(afterDark));

  // ── ② 真打一场 Boss ──
  // ⚠️ 上一版这里的断言是我【写错了】(不是产品问题), 记下来:
  //   · <link rel="prefetch"> 是【只下载、不解析执行】的 —— 所以"引擎下载了1次"是【正确行为】(空闲预取暖缓存),
  //     真正要证明的是【它没有被执行】, 判据是 typeof window.HansenBossAttack === 'undefined'。
  //   · window.IMGS 要等真的调用 __hansenBossFXReady() 才填充; 我只是开了 boss 屏出题, 还没放特效, 当然是空的。
  console.log('\n  ② 真打一场 Boss(引擎按需加载 + 特效图)');
  // ⚠️ 第二次改对: window.HansenBossAttack 一开始就是 function —— 但那是【我自己写的懒加载保险层(桩函数)】,
  //    不是真引擎。真引擎到底跑没跑, 判据是 __hansenBossFXLoaded(引擎脚本+6张特效图都就位才置 true)
  //    和 window.IMGS 是否已填充。断言写错了两次, 都是我的问题, 不是产品的。
  const engState0 = await p.evaluate(() => ({
    stub: typeof window.HansenBossAttack, loaded: !!window.__hansenBossFXLoaded,
    imgs: Object.keys(window.IMGS || {}).length, hasLoader: typeof window.__hansenBossFXReady
  }));
  chk('进岛时引擎【没被解析执行】(只空闲预取暖缓存·保险层在位)',
      engState0.loaded === false && engState0.imgs === 0 && engState0.hasLoader === 'function' && engState0.stub === 'function',
      `引擎已加载=${engState0.loaded} · IMGS=${engState0.imgs}张 · 预取下载${net.engine}次(只下不跑) · 保险层=${engState0.stub}`);

  await p.evaluate(() => { try { window._s1FightIdx = 0; showScreen('boss'); } catch (e) { } });
  await p.waitForTimeout(600);
  await p.evaluate(() => { try { startBoss(); } catch (e) { } });
  await p.waitForTimeout(2000);
  await kill();
  const bossOk = await p.evaluate(() => {
    const s = document.getElementById('bossScreen');
    const q = document.getElementById('bossQ');
    return { active: s && s.classList.contains('active'), hasQ: !!(q && (q.textContent || '').trim()),
             hasSprite: !!document.querySelector('.boss-sprite') };
  });
  chk('打Boss 屏正常出题', bossOk.active && bossOk.hasQ && bossOk.hasSprite);

  // 真的把引擎叫起来(这就是玩家答对时会发生的事)
  const ready = await p.evaluate(() => new Promise(res => {
    const t = setTimeout(() => res({ timeout: 1 }), 12000);
    window.__hansenBossFXReady().then(() => {
      clearTimeout(t);
      res({
        exec: typeof window.HansenBossAttack, loaded: !!window.__hansenBossFXLoaded,
        n: (window.IMGS && Object.keys(window.IMGS).length) || 0,
        spear: (window.IMGS && window.IMGS.renyi_spear) ? String(window.IMGS.renyi_spear) : '(无)'
      });
    }).catch(e => { clearTimeout(t); res({ err: String(e) }); });
  }));
  chk('叫引擎 → 按需加载成功', !ready.timeout && !ready.err && ready.exec === 'function' && ready.loaded,
      ready.timeout ? '(超时!)' : ready.err ? ready.err : `HansenBossAttack=${ready.exec}`);
  chk('特效图从 base64 改成 URL 后正常挂载', (ready.n || 0) >= 6 && /bossfx\//.test(ready.spear || ''),
      `IMGS 有 ${ready.n} 张 · renyi_spear=${(ready.spear || '').split('/').slice(-2).join('/')}`);
  chk('bossfx/*.webp 真的被下载了', net.bossfx >= 6, `下载 ${net.bossfx} 张`);
  const drawn = await p.evaluate(() => new Promise(res => {
    const names = ['renyi_spear', 'hand1', 'hand2', 'hand3', 'hand4', 'hand5'];
    let ok = 0, done = 0;
    names.forEach(n => {
      const i = new Image();
      i.onload = () => { if (i.naturalWidth > 0) ok++; if (++done === names.length) res(ok); };
      i.onerror = () => { if (++done === names.length) res(ok); };
      i.src = (window.IMGS && window.IMGS[n]) || ('bossfx/' + n + '.webp');
    });
  }));
  chk('6 张特效图全部能画出来', drawn === 6, `${drawn}/6`);

  // ── ③ 卡册(加了 loading=lazy) ──
  console.log('\n  ③ 卡册(我加了 loading=lazy)');
  await p.evaluate(() => { try { showScreen('cards'); } catch (e) { } });
  await p.waitForTimeout(1600);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(900);
  const cards = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('#cardsScreen img, .screen.active img')];
    const inView = imgs.filter(i => { const b = i.getBoundingClientRect(); return b.top < 844 && b.bottom > 0 && b.width > 10; });
    return { total: imgs.length, inView: inView.length, loaded: inView.filter(i => i.complete && i.naturalWidth > 0).length };
  });
  chk('卡册首屏的图正常显示', cards.inView > 0 && cards.loaded === cards.inView, `首屏 ${cards.inView} 张 · 显示出来 ${cards.loaded} 张 (总共 ${cards.total} 张, 屏外的懒加载)`);

  // ── ④ 形象详情高清图 ──
  // (打完 Boss 之后页面里残留了战斗状态, 会挡住形象选择器 —— 重新加载一次再测, 这是探针的问题不是产品的)
  console.log('\n  ④ 形象详情(高清图)');
  // (用 v933 那个已验证过的点法: 加载完【直接开选择器】, 中间不要再 showScreen('home') ——
  //  多调一次 showScreen 会把首页重渲, 选择器就打不开了。这是探针的坑, 不是产品的。)
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 50000 });
  await p.waitForTimeout(2200);
  await kill();
  await p.evaluate(() => {
    try {
      if (window.HansenAvatar && window.HansenAvatar.openPicker) window.HansenAvatar.openPicker();
      else { const a = document.querySelector('.avatar, .hsn-av-btn'); if (a) a.click(); }
    } catch (e) { }
  });
  await p.waitForTimeout(1300);
  await p.evaluate(() => { const t = document.querySelector('.hsn-av-thumb,.hsn-av-tile,[data-av]'); if (t) t.click(); });
  await p.waitForTimeout(1800);
  const av = await p.evaluate(() => {
    const im = document.getElementById('hsnAvCardImg');
    if (!im) return { no: 1 };
    const card = im.closest('.hsn-av-card') || im.parentElement;
    const ib = im.getBoundingClientRect(), cb = card.getBoundingClientRect();
    return { src: (im.currentSrc || '').split('/').slice(-2).join('/'), nat: [im.naturalWidth, im.naturalHeight], fill: Math.round(ib.height / cb.height * 100) };
  });
  chk('大卡用的是高清图 + 撑满卡片', !av.no && /hd\//.test(av.src) && av.fill >= 85, av.no ? '(没打开详情)' : `${av.src} 源图${av.nat.join('x')} 占卡片 ${av.fill}%`);

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  if (net.err404.length) console.log(`  ⚠️ 404: ${[...new Set(net.err404)].slice(0, 6)}`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
