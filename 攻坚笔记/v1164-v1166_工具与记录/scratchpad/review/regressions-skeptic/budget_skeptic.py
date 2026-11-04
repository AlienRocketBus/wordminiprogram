# Skeptic budget: my own measured rates (real SDK + emulator, 80 ms latency), 20 school days a month.
# Every rate below comes from a log in this folder; assumptions are marked ASSUME.
DAYS = 20
# --- measured (match_A/B/C.log) ---
BATTLE_RW = (2.98 + 3.10 + 3.10) / 3 + 0.30   # reads+writes per phone per second in battle (A 2.96-3.01 r, B/C 3.05-3.14 r; w 0.23-0.35)
MATCH = 1.55          # reads/s, ladder matching (34 reads in 22 s, 33 of them where)
HOSTWAIT = 1.0 + 0.15 # reads+writes/s, ladder host alone (first 20 s)
JOIN = 22 + 17        # guest find+join+ack + host side while guest joins (match_A.log)
RESULT = 6 + 6        # both phones, result screen + 20 s
# --- measured idle (idle*.log, idle2*.log, cs_*.log, home_after*.log) ---
PRES_ISLAND = 9       # presence writes/min, island page or home map after an island (3 module instances)
PRES_PK = 3           # presence writes/min, spelling_pk.html
SAVE_ISLAND = 9       # cloud-save uploads/min on a visible island page with progress, even when the kid does nothing (6 in 40 s)
SAVE_HIDE = 9         # uploads per backgrounding on an island page
LOAD = 10             # reads per island page load (reviewer's figure; my idle logs show 6-11 hansen_saves reads at load)
# --- ASSUME ---
BATTLE_S = 100; MATCH_S = 20; WAIT_S = 20
ISL_MIN, PK_MIN, HIDES, LOADS = 30, 10, 4, 5

def game():
    return 2 * BATTLE_S * BATTLE_RW + MATCH_S * MATCH + 0.5 * WAIT_S * HOSTWAIT + JOIN + RESULT
def idle(v1164=True):
    pres = (ISL_MIN * PRES_ISLAND + PK_MIN * PRES_PK) if v1164 else 0
    return pres + ISL_MIN * SAVE_ISLAND + HIDES * SAVE_HIDE + LOADS * LOAD

g = game()
print(f'per ranked game (both phones): {g:.0f} calls')
print(f'per kid per day idle: v1164 {idle():.0f}  (v1163 {idle(False):.0f}; difference = presence beat {idle()-idle(False):.0f})')
print()
print('kids games/kid/day | calls/day | calls/month | old 200k plan lasts | resource points for DB (of 40,000)')
for kids, gpk in [(30, 0), (30, 1), (30, 3), (30, 5), (30, 10), (60, 5)]:
    day = kids * gpk / 2 * g + kids * idle()
    month = day * DAYS
    print(f'{kids:4d} {gpk:5d}            | {day:9,.0f} | {month:11,.0f} | {200000/day:5.1f} school days     | {month*0.02:8,.0f} ({month*0.02/400:.0f}%)')
print()
day63 = 30 * idle(False)
print(f'v1163 same class, battles never worked: {day63:,.0f}/day, {day63*DAYS:,.0f}/month -> old plan {200000/day63:.1f} school days; points {day63*DAYS*0.02:,.0f} ({day63*DAYS*0.02/400:.0f}%)')
# break-even on the resource-point plan (keep ~3,000 points for static hosting + storage)
avail = (40000 - 3000) / 0.02 / DAYS
gpk = (avail - 30 * idle()) / (30 / 2 * g)
print(f'resource-point plan break-even for 30 kids: {gpk:.1f} ranked games per kid per day')
