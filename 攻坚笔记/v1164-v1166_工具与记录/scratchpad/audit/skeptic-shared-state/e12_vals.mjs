import fs from 'fs';
import {setup,bootHome,tapSel,waitIsland,dismissWelcome,sleep} from './lib.mjs';
const s=await setup({init:fs.readFileSync(new URL('./instr.js',import.meta.url),'utf8')});const log=[];
const page=await bootHome(s,log);
await tapSel(page,'a.island[href="island_food.html"]');
const fr=await waitIsland(page,'island_food.html');await dismissWelcome(fr);
await fr.evaluate(()=>addXP(3000));
await sleep(15000);
const W=(await page.evaluate(()=>window.__W)).filter(w=>/^(hansen_pet_hero_img|theme|hansen_boss_theme|hansen_palette_global|hansen_card_temp_unlock_until|hansen_wallet_totals|hansen_wallet_ach|hsn_crystal_total|hsn_crystal_gems)$/.test(w.k));
const by={};for(const w of W){(by[w.k]=by[w.k]||[]).push(w.f+'='+(w.v||'').slice(0,50));}
for(const [k,v] of Object.entries(by))console.log(k,'\n   ',[...new Set(v)].join('\n    '));
await s.close();
