// Screenshot + pixel-true contrast matrix: one preset per invocation (PRESET env), all key screens.
import { newCtx, openPage, closeBrowser, sleep, save, tapText, TV } from './lib.mjs';
import { measureContrast } from './contrast_lib.mjs';
import fs from 'node:fs';
const PRESETS = {
  cosmos: { palette: 'cosmos' }, violet: { palette: 'violet' }, aurora: { palette: 'aurora' }, woods: { palette: 'woods' },
  cloud: { palette: 'cloud' }, sakura: { palette: 'sakura' }, cream: { palette: 'cream' }, mint: { palette: 'mint' },
  coin_rainbow: { palette: 'cosmos', coinTheme: 'rainbow' }, coin_pink: { palette: 'cosmos', coinTheme: 'pink' },
  imax_candy: { palette: 'cosmos', dia: 'theme_candyland' }, gallery_fairy: { palette: 'cosmos', dia: 'theme_photo_fairytown' },
};
const name = process.env.PRESET || 'cosmos';
const preset = PRESETS[name];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const FULL = !/^(coin_|imax_|gallery_)/.test(name);
const results = {};
async function step(id, fn) {
  if (ONLY.length && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const pg = await fn();
    const r = await measureContrast(pg, `m_${name}_${id}`);
    results[id] = { ok: true, ms: Date.now() - t0, summary: r.summary, errs: (pg.__errs || []).slice(0, 5) };
    console.log(name, id, 'n', r.summary.n, 'fail', r.summary.fail, 'min', r.summary.minRatio, (Date.now() - t0) + 'ms');
  } catch (e) { results[id] = { ok: false, err: String(e).slice(0, 300) }; console.log(name, id, 'ERR', String(e).slice(0, 200)); }
}
const ctx = await newCtx(preset);
let pg;
async function island(file, wait = 3500) {
  if (pg) await pg.close().catch(() => {});
  pg = await openPage(ctx, file, wait);
  await tapText(pg, /开始冒险/); await sleep(700);
  await pg.evaluate(() => { document.querySelectorAll('.modal-bg.show').forEach(m => m.classList.remove('show')); scrollTo(0, 0); });
  await sleep(400);
  return pg;
}
// ---- Home ----
await step('home_top', async () => { pg = await openPage(ctx, 'index.html', 4500); return pg; });
await step('home_cards', async () => { await pg.evaluate(() => { const a = document.querySelector('a.island'); a && a.scrollIntoView({ block: 'start' }); scrollBy(0, -40); }); await sleep(900); return pg; });
// ---- Classic island menu ----
await step('food_menu', async () => island('island_food.html'));
await step('food_modes', async () => { await pg.evaluate(() => { const l = [...document.querySelectorAll('.section-label')][0]; l && l.scrollIntoView({ block: 'start' }); scrollBy(0, -70); }); await sleep(700); return pg; });
// ---- Mini-game (listen) ----
await step('listen_q', async () => { await island('island_food.html'); await pg.evaluate(() => { showScreen('listen'); startListenLevel('easy'); }); await sleep(1500); return pg; });
await step('listen_right', async () => { await pg.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn === listenQ.word.cn); listenAnswer(i); }); await sleep(700); return pg; });
await step('listen_wrong', async () => { await sleep(5200); await pg.evaluate(() => { const i = listenQ.opts.findIndex(o => o.cn !== listenQ.word.cn); listenAnswer(i); }); await sleep(450); return pg; });
await step('listen_result', async () => { await sleep(1800); await pg.evaluate(() => { listenActive = true; listenRight = 7; listenTotal = 8; listenComplete(); scrollTo(0, 0); document.querySelectorAll('.confetti').forEach(c => c.remove()); }); await sleep(2600); await pg.evaluate(() => document.querySelectorAll('.confetti').forEach(c => c.remove())); return pg; });
if (FULL) {
  // ---- Celebrations / popups ----
  await step('pop_ach', async () => { await island('island_food.html'); await pg.evaluate(() => { showAchPopup(ACHIEVEMENTS[0]); }); await sleep(900); return pg; });
  await step('pop_levelup', async () => { await sleep(3500); await pg.evaluate(() => { showLevelUpBanner(2); }); await sleep(700); return pg; });
  await step('pop_petevolve', async () => { await sleep(3000); await pg.evaluate(() => { document.querySelectorAll('.confetti').forEach(c => c.remove()); showPetEvolve(PET_STAGES[1]); }); await sleep(900); return pg; });
  await step('chest', async () => { await island('island_food.html'); await pg.evaluate(() => openChest()); await sleep(1800); return pg; });
  await step('chest_open', async () => { await pg.evaluate(() => { const b = document.getElementById('chestBox'); if (b) { b.scrollIntoView({ block: 'center' }); } if (typeof doOpenChest === 'function') doOpenChest(); }); await sleep(1400); return pg; });
  // ---- Boss ----
  await step('boss_list', async () => { await island('island_food.html'); await pg.evaluate(() => showScreen('boss')); await sleep(2500); return pg; });
  await step('boss_fight', async () => { await pg.evaluate(() => startBoss()); await sleep(3500); return pg; });
  await step('boss_victory', async () => { await pg.evaluate(() => { try { bossVictory(); } catch (e) { } }); await sleep(2500); await pg.evaluate(() => { document.querySelectorAll('.confetti').forEach(c => c.remove()); scrollTo(0, 0); }); await sleep(300); return pg; });
  // ---- Other classic + land islands ----
  await step('animal_menu', async () => island('island_animal.html'));
  await step('school_menu', async () => island('island_school.html'));
}
await step('land1_menu', async () => island('island_land1.html', 4000));
if (FULL) {
  await step('land1_modes', async () => { await pg.evaluate(() => { const l = [...document.querySelectorAll('.section-label')][0]; l && l.scrollIntoView({ block: 'start' }); scrollBy(0, -70); }); await sleep(700); return pg; });
  await step('land5_menu', async () => island('island_land5.html', 4000));
}
// ---- Settings / shop ----
await step('settings', async () => { await island('island_food.html'); await pg.evaluate(() => showScreen('settings')); await sleep(1200); return pg; });
if (FULL) {
  await step('settings_themes', async () => { await pg.evaluate(() => { const h = [...document.querySelectorAll('#settingsContent h3, #settingsContent div')].find(e => /主题选择/.test(e.textContent) && e.textContent.length < 40); h && h.scrollIntoView({ block: 'start' }); }); await sleep(700); return pg; });
  await step('shop', async () => { await island('island_food.html'); await pg.evaluate(() => HansenDiamondShop.open()); await sleep(1500); return pg; });
  // ---- Standalone pages ----
  await step('boss_hall', async () => { if (pg) await pg.close(); pg = await openPage(ctx, 'boss_hall.html', 4500); return pg; });
  await step('land_map', async () => { if (pg) await pg.close(); pg = await openPage(ctx, 'land_map.html', 4500); return pg; });
  await step('season_showcase', async () => { if (pg) await pg.close(); pg = await openPage(ctx, 'season_showcase.html', 4500); return pg; });
}
save(`matrix_${name}`, results);
await closeBrowser();
