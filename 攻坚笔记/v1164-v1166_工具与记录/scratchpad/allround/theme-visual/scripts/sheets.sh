#!/bin/bash
cd /tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual
S=shots
for P in cosmos violet aurora woods cloud sakura cream mint; do
  python3 scripts/tile.py out/sheet_${P}_a.png 7 0.3 $(for s in home_top home_cards food_menu food_modes animal_menu school_menu land1_menu land1_modes land5_menu listen_q listen_right listen_wrong listen_result pop_ach; do echo "$s=$S/m_${P}_$s.png"; done) >/dev/null
  python3 scripts/tile.py out/sheet_${P}_b.png 7 0.3 $(for s in pop_levelup pop_petevolve chest chest_open boss_list boss_fight boss_victory settings settings_themes shop boss_hall land_map season_showcase; do echo "$s=$S/m_${P}_$s.png"; done) >/dev/null
done
for P in coin_rainbow coin_pink imax_candy gallery_fairy; do
  python3 scripts/tile.py out/sheet_${P}.png 6 0.3 $(for s in home_top home_cards food_menu food_modes listen_q listen_right listen_wrong listen_result land1_menu settings; do echo "$s=$S/m_${P}_$s.png"; done) >/dev/null
done
# one screen across all 12 presets
for s in home_top food_menu listen_right listen_result settings; do
  python3 scripts/tile.py out/across_${s}.png 6 0.3 $(for P in cosmos violet aurora woods cloud sakura cream mint coin_rainbow coin_pink imax_candy gallery_fairy; do echo "$P=$S/m_${P}_$s.png"; done) >/dev/null
done
ls out/sheet_* out/across_* | wc -l
