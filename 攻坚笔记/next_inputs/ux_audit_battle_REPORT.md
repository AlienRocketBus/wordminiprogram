# 单词大冒险: online battle screens UX / visual audit (v1163 snapshot)

Audited copy: `scratchpad/v1163_snapshot` (VERSION 1163). Every finding below was rendered and measured in a real browser. Where a finding comes from reading code alone, it says so.

All paths are under `/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/ux-audit/`:
- `shots/`: 144 PNGs (iPhone-like 390×844 @2x, `isMobile`, `hasTouch`, WeChat UA). The 360/320 shots are in `shots/6x_*`.
- `metrics/`: JSON for each screenshot with text, failing WCAG contrast pairs, tap-target sizes, overflow at the current width and script errors. Also `_s0X_summary*.json`.
- `scripts/`: the harness (`lib.mjs`: static server with correct MIME types, `serviceWorkers:'block'`, every non-local request aborted, signed-in presets, fake transport) and one script per area (`s01`…`s10`). To re-run: `node scripts/s05b_battle_fixed.mjs` (env `W=360`, `THEMES=dark`).

### Caveats
- **Fonts.** The container has WenQuanYi Zen Hei and Noto Color Emoji instead of PingFang and Apple emoji. Glyph widths and emoji art differ a little from an iPhone. Every layout bug reported here is caused by flexbox and positioning, not by glyph width.
- **Themes.** "Dark" is the default 深空蓝 palette. "Light" is 云端白 (`hansen_palette_global='cloud'`). The other light palettes (樱花粉 / 奶油杏 / 薄荷绿) use the same `hsn-pal-light` code path.
- **Focus rings.** The blue or black rectangle around `×` / `←` in some ladder and friends shots comes from opening the overlay with a script. After a real `tap()` on the entry card, `:focus-visible` is false (`shots/67_…`, `metrics/_s07_summary.json → focus_after_tap`). **It is not a device bug.** Ignore it in those shots.
- **Backend.** The cloud is faked through `HansenPkRoom._setTransportForTest`, and `fetchTop` / `HansenFriends.*` are monkey-patched. Every screen shown is a state the real code renders.

---

## 0. Executive summary: top problems by severity

Severity scale: **S1** = broken or unusable · **S2** = major friction, misleading, or off-brand · **S3** = minor · **S4** = polish.

| # | Sev | Problem | Evidence |
|---|-----|---------|----------|
| 1 | S1 | **Light theme makes the room and battle UI unreadable.** Typed letters in the battle input have contrast **1.05**. Room cards are **1.22** (name) and **1.94** (meta). The `← 返回` / `← 关掉房间` button is **1.22**. The selected 出题 card is **1.12**. The private room code is **1.99**. | Hard-coded dark hexes bypass the module's own `--pk-*` variables: `.pr_back`/`.pr_room` `#1e293b`, `.pr_in` `#0b1220`, ask card `#1e1b4b`, code `#a5b4fc` (hansen_pk_room_ui_v1065.js L90, L96, L113–114, L512, L574). Shots `21_lobby_rooms_light`, `30_battle_A_midround_light`, `39_…standalone_light`, `23b_…light`, `25_…light`. |
| 2 | S1 | **On island pages, 天梯排位 opens *behind* the 拼写大PK screen.** The tap appears to do nothing, while an invisible focus-trapped dialog with a body scroll lock is now active underneath. | Ladder `z-index:2147482000` < `#hsn_pk_screen` `2147483400`. At (195,400) `elementFromPoint` returns `hsn_pk_screen` while the ladder `.on` is true (`03b_pk_inpage_tap_ladder_*`). `closePeers()` does not include `HansenSbPK` (ladder L205–213). |
| 3 | S1 | **The battle header breaks.** Once my score is ≥100 the mode chip covers my score (`你 1⚡`). The timer is the last fragment of an unstyled line: it wraps to 2 lines at 390px, becomes a 25×124px column at 360px with a 10-character opponent name, and sits at x=324 (off-screen) at 320px. | `.pr_sub` is never defined; `.pr_top` is a flex row, so the score row (159px wide) and "第 n / N 词 · ⏱" compete. Geometry in `metrics/_s05_summary.json → geom_*` and `_s07_summary.json → 66_geom_*`. Shots `32_battle_A_i_scored_dark`, `66_battle_longname_360/320`. |
| 4 | S2 | **In real matches the opponent's name is never shown.** Score bar, result and history all say "对手". | `oppName` is set only in `_startMatchForTest` (L1998). `doCreate` (L559) and `doJoin` (L737) never set it, although the room doc has `hostName`/`guestName`. Found by code reading; consistent with the `负 对手` rows in history. |
| 5 | S2 | **Modes B and C do not do what the chooser promises.** "后拼对 80 / 60 分" and "两个人都答完才进下一个词" never happen: when the opponent answers, the client force-ends my word with 0. | `pollOpponent`: `if (oppGot && !_rt.answered) submitRound(idx,false,true)` for every mode (L1386–1400). Shots `31_battle_B_opp_scored_*` and `31_battle_C_…` show "对手抢先了" and a move to the next word with my score still 0. |
| 6 | S2 | **Waiting states feel dead or jumpy, and hide how long they last.** The matching screen rebuilds its whole DOM every ~2.5 s: the counter jumps 0→3→5→8→10, the 🔍 animation restarts and focus jumps to `×`. The ladder then hands off to a different-looking "等对手进来" screen whose counter restarts at 0 and says "别人在列表里就能看到你". The 2-minute auto-close is never shown. "📨 交卷了" is static text with no exit for up to 45 s. | `metrics/_s03_summary.json → matching_timeline_*` and `_s04_summary.json → ladder_autocreate_seq_*`. Code: ladder L636–664 (paint per tick), room UI L685 (120 s), L1591 (22×2 s). |
| 7 | S2 | **The battle screens do not look like the game.** They use a flat slate "settings" style (system-ui headings, 12–14px grey text, indigo-only buttons, no avatars, no illustration, no sound, no motion between screens). Home and islands use illustrated saturated cards, a cartoon heavy font and gold CTAs. The in-island **Spelling Bee vs-robot** screen already has the right battle layout (VS bar with avatars, 50px docked keys, big answer reveal, gold 下一题). | Compare `02_island_dark` and `05_sibling_spellbee_dark` / `05b_sibling_spellbee_round_dark` with `30_battle_*`, `21_lobby_*`, `11_ladder_*`. |
| 8 | S2 | **Friends:** (a) whatever you are typing in 加好友 is wiped every 15 s and focus jumps to `×`. (b) Quick messages are sent but **no UI ever shows received messages** (`HansenFriends.inbox()` has no caller). (c) "⚔️ 开个房间叫他来打" opens the public lobby, not a private room. (d) The island 拼写大PK hub has no 好友 entry. | (a) `typing_after_15s: {value:"", focused:"frX"}` (`_s06_summary.json`). (b) grep finds `inbox(` only in hansen_friends_v1106.js L412/L468. (c) `detail_pk_dest_*`. (d) `hasFriends:false` for `#hsn_pk_screen`. |
| 9 | S2 | **The result screen buries the score.** "你 100 分 · 对手 0 分" is 14px dim grey, the weakest text on the screen. For room games, "再来一局" and "← 回到房间列表" do the same thing. "总战绩 1 胜 1 负 · 胜率 33%" is wrong-looking because draws are counted in the rate but not shown. A loss is a 20px red "-13 天梯分". There is no celebration on a win. | Shots `40_result_*`. Code L1803–1847. |
| 10 | S3 | **The mode chooser's strongest button is "← 返回"** (a full-width indigo gradient, because `.pr_ghost` is undefined). The three cards hold 12 rule bullets, have no affordance that they are tappable, and offer no default. | `23_mode_chooser_dark_tall`. |
| 11 | S3 | **Native `alert`/`confirm` dialogs still sit inside the battle flows.** Ladder when not signed in: `confirm("排位要先登录…")`. Room taken: `alert(E(r))`. Hub 公开房间 when not signed in: `alert`. Friend delete: `confirm`. | Ladder L625; room UI L722; sb_pk L256/L260; friends UI L480. Captured as `DIALOG(confirm)` in `_s03_summary.json`. |
| 12 | S3 | **Mixed typography inside one overlay.** The island's global `button{font-family:CartoonBlack!important;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,.3)}` hits overlay buttons, while overlay headings use `system-ui`. In light mode the dark shadow under dark labels looks blurry (`先不弄`, `私密房`, `← 回到房间列表`). | island_food.html L316–321; computed styles in `metrics/_s08_tokens.json`. |

**What is already good and should be kept:**
- Plain-Chinese copy that says what happened and what to do next ("这间房刚被别人抢走了 / 排位时大家都在抢空房，慢一步就没了。再找一次就好。").
- Empty and error states are separate on the leaderboard.
- The unranked empty state explains the metrics instead of showing "0%".
- The last 5 seconds turn red.
- Score "pop" on both sides.
- The answer is revealed after every word.
- Instant "📨 已提交，正在和对手比…" feedback.
- Inline (non-alert) errors for room code and add-friend.
- A copy-code fallback for WeChat.
- Tied leaderboard ranks are shown as tied.
- No horizontal page scroll at 390, 360 or 320 on any screen.
- Dark-theme text contrast passes AA almost everywhere.
- Ladder tap targets are ≥44px.

---

## 1. The app's visual language (reference)

Shots: `01_home_dark/light`, `01c_home_island_cards_crop_dark`, `02_island_dark/light`, `02c_island_mode_grid_crop_dark`, `05_sibling_spellbee_*`, `05b_sibling_spellbee_round_dark`, `06_sibling_speed60_*`.

- **Home:** a cosmic gradient background (`--th-bg-deep/mid/glow` + nebula blobs, index.html L274–282) and a rainbow 3-D logo. Stat tiles sit on dark glass with gold numerals. Island cards are tall, saturated gradients with big emoji and a dark "进入冒险 →" pill.
- **Island page:**
  - A sticky top bar (avatar, level, XP bar, 💎 and 🪙 pills).
  - **Illustrated square mode cards** (`.mode-card`, radius 16, saturated `--c1/--c2` gradient, white 13–16px heavy label; island_food.html L801/L807). The 拼写大PK card is purple `#4f46e5→#4338ca` with crossed swords.
  - Gold primary CTAs (`.game-btn.gold`, L1298) and a fixed bottom nav.
- **Typography:**
  - Headings and buttons use `--font-cartoon` (CartoonBlack 900, index.html L106 and the same in island pages).
  - Body text uses `--font-body`.
  - Numbers use Bowlby One with a gold glow (`.stat-num`, island_food.html L323).
- **Spelling Bee (vs robot)**, the closest sibling to an online battle:
  - Numbered setup steps with **selectable illustrated cards** (gold ✓ on the selected one), and a 64px gold "🚀 开始比赛" (`.startbtn`, spelling_bee.html L254).
  - In a round: top bar `✕ | 第 1/16 题 | ⏱ 4.1s | 🔊`, a prompt card, a **VS bar with avatars** (`你 0 VS 1 机器人`, `.vsbar`, L306), and a result card with a **large correct answer** ("food /fu:d/ 食物") plus a gold 下一题.
  - A **full-width keyboard docked at the bottom** (`.key` 50px tall, 24px font, L359–363) with key-tap sound (L1896).
- **Light themes** turn chrome and cards into white glass (palette ⑫/⑯) but keep saturated mode cards and gold or indigo CTAs.

The battle overlays share none of this. They are a separate, flat "dark admin panel" style (`#0f172a`/`#111827` slabs, `#1e293b` cards, 1px `#334155` borders, indigo `#4f46e5` everywhere, system-ui). The jump is most visible on the island path: tap a lush purple illustrated card, then land on a plain slate list (`02c` → `03_pk_inpage_dark` → `21_lobby_rooms_dark`).

---

## 2. 拼写大PK hub (in-page `#hsn_pk_screen` + standalone `spelling_pk.html`)

Shots: `03_pk_inpage_{dark,light}`, `03_pk_inpage_{dark,light}_tall`, `03b_pk_inpage_tap_ladder_{dark,light}`, `04_pk_standalone_{dark,light}` (+`_full`), `60_pk_inpage_360/320`.

**Good, keep:**
- The identity card (avatar, name, 竞赛 ID in a large mono font, tier).
- Two big gradient entry cards with emoji, which is the closest of all the battle screens to the island style.
- "登录后自动分配" instead of `No.---`.

**Problems:**
1. **S1. 天梯排位 is invisible on island pages** (see summary #2). The ladder opens under the hub. On top of that, `a11yOn` locks body scroll and moves focus into the invisible ladder. Tapping `← 返回` on the hub then "reveals" the ladder, which looks like a random page.
2. **S2. The two hubs disagree.**
   - Standalone order: account → 公开房间 → **我的好友** → 天梯 → stats.
   - In-page order: account → **☁️ 从云端恢复进度** (full-width primary) → 切换 / 退出 → 公开房间 → 天梯 → stats → **🩺 云同步自检（把结果截图发给开发者）**. It has **no 好友 entry**.
   - Same feature, two information architectures.
3. **S2. Account management sits above the game.** On the in-page hub the first full-width primary button is "从云端恢复进度" (`03_pk_inpage_dark`, y≈212 css). The first game entry starts at y≈313, and 天梯 is half below the fold. A child came here to play.
4. **S1 (light). The in-page primary button "☁️ 从云端恢复进度" is invisible:** white text on `rgba(15,23,42,.06)`, **1.18**. The palette sets the `.k_ab` background for all `.k_ab` (including `.primary`) and forces `color:#fff` for `.k_ab.primary` (hansen_palette.js L522/L528). See `03_pk_inpage_light`.
5. **S3. 天梯 card contrast.** White on `#0ea5e9` (the light end of the gradient, where the title sits) is **2.77**. The 12.5px description is **2.51** in both themes.
6. **S3. Jargon and noise for kids:**
   - "最快速度(字符/分)" (a raw CPM).
   - "对战胜率 —".
   - "✅ 已登录 xiaoming　进度已跟随账号，换设备登录即可找回。"
   - The developer self-check button.
   - The 天梯 card copy lists six tier names in a row.
7. **S3. Back button is 40–42px tall** (`← 返回` 77–80×40/42). Measured below 44.

**Redesign:**
- **One hub for both pages**, built from the island's `.mode-card` language. Three big illustrated tiles in a 2+1 grid: **⚡ 快速对战 / 🏆 天梯排位 / 👥 好友约战**. Each gets a one-line kid label ("找个人马上开打", "赢了升段", "和同学一起玩"). A live sub-line comes from data (ladder: "🐝 工蜂 · 1108 分 · 还差 92 分升段"; friends: "2 个好友在线").
- Move 云端恢复, 切换账号, 退出 and 自检 into a small "⚙️ 账号" row at the bottom, or into the profile page reached from the identity card. Replace the stats grid with three kid-readable chips (胜 6 · 连胜 🔥3 · 最快 1.9 秒).
- **Fix stacking:** give all battle overlays one z-index layer above the hub, and make `closePeers()` include `HansenSbPK`. Either hide the hub when a child overlay opens, or let the hub become the overlay's "back" target (see §14 navigation).

---

## 3. Ladder home (`#hsn_ladder_screen`)

Shots: `10_ladder_home_unranked_emptyboard_{dark,light}` (+`_bottom`), `11_ladder_home_ranked_board_{dark,light}` (+`_tall`), `12_ladder_home_boardfail_{dark,light}`, `61_ladder_home_360/320`.

**Good, keep:**
- Tier hero (emoji + name).
- The placement progress bar "定级赛 0 / 3".
- The unranked "还没打过排位" state, which explains the metrics instead of showing zeros.
- "🌱 还没有人上榜 / 你可能是第一个" (empty) is separate from "暂时看不到排行榜 / 可能是网络不太顺" (error).
- The tier-progress bar with "大约再赢 5 局".
- Medals, with tied ranks shown as numbers.
- Truncated long names. At 320px long names ellipsize (75/149px), which is intended.
- The primary CTA is 362×56. All targets are ≥44px.

**Problems:**
1. **S1 (light). "Me" row on the leaderboard: 1.86.** Text `#f5f7ff` sits on `rgba(79,70,229,.42)` over white, which resolves to `#b5b1f4` (ladder L532). Dark theme is fine at 11.45. This is the row the screen exists for (`11_…light_tall`).
2. **S2. Long scroll with the board last.** The ranked page is 1,940px tall at 390 (`11_…_tall`):
   - The 6-tile "我的实力" grid (胜率 / 抢先率 / 平均用时 / 最快 / 正确率 / 连胜, each with a sub-caption) comes before the leaderboard.
   - Six metrics plus captions is a teacher's dashboard, not a kid's.
   - The tier-progress card, the most motivating item, is fourth.
3. **S3. Light-theme faint text sits on the AA edge.** `--hpk-faint` `#6b7280` on `#f4f6fb` is 4.47. The CTA caption "排位固定用「抢答赛」…" is 4.47. Board rank digits are 4.03 (`opacity:.6`). "打满 3 局定级赛就能上榜…" is 4.0 (`opacity:.75`).
4. **S3. The progress track is invisible in light mode.** The track is hard-coded `rgba(255,255,255,.12)` (L427), so it is white on white and only the inset shadow shows.
5. **S3. Title copy.** "⚡ 开始排位（找实力差不多的对手）" is long, wraps at 320, and explains instead of inviting.
6. **S4. History shows "刚刚 / 不计分"** and identical-looking rows. Opponent names in real games are always "对手" (summary #4).

**Redesign:**
- Order the page as: **(1)** hero card with tier badge art (reuse the 🐝 / 🔍 / 🛡️ / 👑 icons at 64px on a gold-rimmed medal), rating, and an **inline progress bar to the next tier** ("还差 92 分 → 🔍 侦察蜂"); **(2)** one big gold CTA "⚡ 开始排位" with the subline "找和你差不多厉害的人"; **(3)** leaderboard (top 5 + "你" pinned, expandable); **(4)** three headline stats (胜场 / 🔥连胜 / ⚡最快); **(5)** "最近 5 局" collapsed by default.
- "Me" row: solid `--pal-accent-text` (light) or `#312e81` (dark) background with white text, plus a 3px gold left border. Do not use translucent tints.
- Unranked: replace the stats card with the 0/3 placement path ("3 局定级赛 · 打完就知道你是哪一段"), shown as three empty medal slots that fill in.

---

## 4. Matching / searching (ladder `startMatching`)

Shots: `13_ladder_matching_1s_{dark,light}`, `13_ladder_matching_10s_{dark,light}`, `62_ladder_matching_360/320`.

**Good, keep:**
- A moving 🔍.
- "已等 N 秒".
- An honest note ("没人的时候会自动开一间等着 / 有人进来就立刻开打").
- A clear cancel button.

**Problems:**
1. **S2. The screen visibly "reboots" every ~2.5 s.** `tick()` calls `paint()` (full `innerHTML`) and `a11yOn()` each poll (L642–664). Measured timeline: the counter shows 0 → 3 → 5 → 8 → 10, so it does not count seconds. The DOM is rebuilt and the swing animation restarts each time. **Focus moves to `×` every tick** (`matching_timeline_*`). On a screen reader that re-announces "取消匹配" every 2.5 s.
2. **S2. What is happening is described in ratings, not words.** "正在找 800 ~ 1200 分的对手" means nothing to an unranked 8-year-old, and the range widens without explanation.
3. **S2. It never says how long the wait is.** After 20 s it silently becomes a self-hosted room (§6). There is no "最多等 20 秒" and no progress indicator.
4. **S3. Header layout.** `×` is on the **left** here, while the ladder home has it on the right (L643 vs L246). About 70% of the screen is empty below the card. There is no avatar or sense of "who might I meet".
5. **S4. Copy.** "等得越久范围放得越宽" is engineer-speak.

**Redesign:**
- Build the screen once and update only text nodes on a 1 s interval, the same way `waiting()` already does for "已等 N 秒" (room UI L636–648).
- Layout: centered "radar", meaning my avatar in a ring with 3 pulsing circles (CSS `@keyframes`, matching the island's `slideIn`/`chestBounce` vocabulary), with "正在找对手…" (20px heavy) under it. Below that, a **20 s progress ring or bar** with the caption "最多等 20 秒，没人就自动开房等别人".
- Rotate fun tips under the radar ("小贴士：抢答赛里，谁先拼对谁得 100 分").
- Keep one bottom ghost button "取消".
- Replace the rating range with "找和你差不多厉害的对手"; show the range only in a small expandable "?" for the teacher.
- When the 20 s handoff happens, **stay on the same screen** and change the caption to "已经帮你开好房，等对手进来… 再等 1:40". Do not switch overlays (see §6).

---

## 5. 连不上网络 and 排位要先登录

Shots: `14_ladder_offline_{dark,light}`, `15_ladder_needlogin_{dark,light}`. Native dialog text is in `metrics/_s03_summary.json → needlogin_native_*`.

**Good, keep:**
- Both screens state what happened and give one clear next step (重新找对手 / 去登录).
- The login screen explains why ("排位要跟别人比，所以得先有个账号记住你的分数").
- The expired-session variant says progress is safe ("你的段位和战绩都还在").

**Problems:**
1. **S2. Two different "need login" experiences.** When the local state says signed out, the ladder uses a **native `confirm()`** ("排位要先登录（进度和段位才能跟着账号走）。现在去登录吗？" with 确定/取消; L625). The nice in-app screen (`15_…`) only appears when the cloud rejects the session. The hub's 公开房间 uses `alert()` (sb_pk L260).
2. **S3. "技术信息：Failed to fetch"** is shown to children in English (4.08 dark / **3.38 light**, 11px). The intent, a screenshot for the developer, is valid, but it should be hidden behind a tap.
3. **S3.** Offline is detected only after 4 failed polls (**13.1 s measured**). During those 13 s the user sees "正在找对手…", which looks like a normal search.
4. **S3 (light).** "先不弄" is a 73×47 text button whose border `rgba(255,255,255,.22)` is invisible on a light background (L812). With the island's text-shadow it looks blurred.
5. **S4.** The header changes to "🏆 天梯排位" with `×` on the left, which differs from the screen it replaced.

**Redesign:**
- One shared **"blocking state" component** for offline, login, expired session and module-not-ready:
  - illustration 72px (use the existing `ui/brain_alarm.webp` / `brain_rest.webp` art rather than plain emoji);
  - title 20px heavy;
  - one-sentence reason;
  - one gold primary button and one text button;
  - an optional "给老师看的信息 ›" disclosure for the raw reason.
- Copy:
  - Offline: "网络断了 📡 / 排位要联网才能找到对手。连上 Wi-Fi 或打开流量，再点一下。 [再试一次]".
  - Login: "先登录，分数才能记住 🔑 / [去登录] 先不了".
- Replace the native `confirm()` with this screen. Show the offline state as soon as `navigator.onLine === false` or the first failure, and keep retrying in the background with a small spinner.

---

## 6. Ladder handoffs: room taken, and the auto-created waiting room

Shots: `16_ladder_room_taken_{dark,light}`, `17_ladder_autocreated_waiting_{dark,light}`. Sequence: `_s04_summary.json → ladder_autocreate_seq_*`.

**Good, keep:** the "这间房刚被别人抢走了" screen: friendly 💨 icon, explanation, one CTA "⚡ 再找一次对手".

**Problems:**
1. **S2. The handoff after 20 s switches overlays and resets the clock.** The ladder overlay ("⚡ 正在找对手… 已等 20 秒") is replaced by the room overlay with header "← 关掉房间 ⏳ 等对手进来", "已等 0 秒", and "房间已经开好了，**别人在列表里就能看到你**。你开的是 ⚡抢答赛 · 10 个词". A ladder player never opened a room or chose 抢答赛, so this reads as "something else happened".
2. **S2. After 2 more minutes the user is dumped into the public room list** with a red error "等了两分钟没人来，先散了吧" (room UI L685). They are not returned to the ladder, even though `_cameFromLadder` is known.
3. **S3 (light).** `← 返回` / `← 关掉房间` contrast is **1.22** (same root cause as summary #1).

**Redesign:** keep ranked searching inside a single "matchmaking" screen (§4) whose state machine is **searching → hosting → found → countdown**. The timeout lands back on the ladder home with a toast: "这会儿人有点少，过一会儿再来试试 🙂 [再找一次]".

---

## 7. Room lobby (大PK · 公开房间)

Shots: `20_lobby_empty_{dark,light}`, `20b_lobby_code_empty_submit_{dark,light}`, `21_lobby_rooms_{dark,light}`, `22_lobby_error_offline_{dark,light}`, `63_lobby_360/320`.

**Good, keep:**
- The re-ordering in v1156 (actions on top, rooms visible immediately, the room code collapsed).
- A mode chip on every room card.
- Tier, word count and age on every card.
- A 44px "进去打" button.
- Room-code errors appear inline under the input ("先输入好友给你的 4 位房间码").
- The list is capped at 30 with "还有 N 间房没显示".
- The empty state tells you what to do.

**Problems:**
1. **S1 (light).** Room cards stay `#1e293b` with `--pk-txt` dark text: names **1.22**, meta lines **1.94**. `← 返回` is **1.22**. The 私密房 and 刷新 ghost buttons lose their borders (`rgba(255,255,255,.22)`) and look like loose words (`21_lobby_rooms_light`).
2. **S2. Cards are dense and text-only.**
   - Each card is three facts in 12px dim grey ("🛡️ 守卫蜂 · 1450 分 · 5 个词 · 12 秒前") that wrap to a second line on 3 of 6 cards at 390.
   - There is no avatar, and nothing shows whether the host is stronger or weaker than me.
   - The mode chip text is 11.5px.
3. **S2. The offline error is a dark red slab** (`#7f1d1d`) that does not change with the theme, and it has no retry next to it. The primary action stays "➕ 开一间", which will also fail.
4. **S3. Three equal-width actions** (开一间 / 私密房 / 刷新) where only one is primary. 刷新 is a manual chore; the list should refresh itself.
5. **S3.** The "有朋友给的房间码？点这里输入" `<summary>` is a **34px**-tall tap target. The input keeps `letter-spacing:6px`, so the placeholder "四 位 房 间 码" looks spaced out.
6. **S3. A room taken in the lobby still uses `alert()`** (L722).
7. **S4.** The "未定级" label for unrated hosts is fine, but "王小明同学的超长名字啊" style long names push the meta onto two lines.

**Redesign:**
- A header bar reused across all battle screens (§15): `‹ 返回` pill on the left, title in the center ("🏠 公开房间"), and a live dot with "3 间" on the right.
- A hero row with **two** tiles:
  - **[➕ 开一间房]**: primary, gold.
  - **[🔑 输入房间码]**: secondary, opens a bottom sheet with a 4-box code input (like an OTP), each box ≥48px.
  - 私密房 becomes a toggle inside the "开一间" flow ("只让好友进 🔒"), not a sibling button.
- Room card, 76px tall:
  - host avatar (44px) with a tier badge overlay;
  - name (16px heavy);
  - one line "⚡ 抢答赛 · 5 个词";
  - right side: an "开打 ›" pill (gold if the host is within ±100 of me, otherwise indigo);
  - a small "比你强 💪 / 差不多 / 新手" tag computed from ratings.
  - Hide ages under 1 min ("刚开"), and drop rooms older than 10 min from the top.
- Auto-refresh every 5 s with a subtle "刚刚更新" label. Pull-to-refresh is optional.
- Errors: an inline themed card with an icon and **[再试一次]** inside the card. Disable "开一间" while offline and show the reason.

---

## 8. Mode chooser (选个玩法)

Shots: `23_mode_chooser_{dark,light}` (+`_tall`), `23b_mode_chooser_tts_selected_{dark,light}`, `64_chooser_360/320`.

**Good, keep:**
- 出题方式 (看中文 / 听发音) is presented as two big choice cards with emoji, and it is the first decision.
- "⭐ 计天梯" marks the ranked mode.
- The cards are now real `role="button"` elements with keyboard support.

**Problems:**
1. **S2. The full-width primary-gradient "← 返回" is the most prominent control** (`.pr_ghost` is undefined; L523). There is no back control at the top. The cards themselves have no "select" affordance (no chevron, no button, no hover or pressed state).
2. **S2. Rules overload.** 3 cards × 4 bullets = 12 rule lines (12.5px) plus taglines. Bold rules are hard-coded `color:#fff` (L500), which the palette remaps in light mode (it works, but by accident).
3. **S2. The B/C rules are false in practice** (summary #5).
4. **S1 (light). The selected 出题 card** stays `#1e1b4b` with dark text: **1.12** for the title and **2.12** for the tip (`23b_…light`).
5. **S3.** "三种规则差别很大，选你喜欢的" sits inline next to the title in an undefined `.pr_sub` and wraps. The mode names 回合赛 and 同步赛 cannot be told apart by a child.
6. **S3.** Picking a card **immediately creates the room**. There is no confirm or summary step, so a mis-tap means "关掉房间" and starting again.

**Redesign:** reuse the Spelling Bee setup pattern (`05_sibling_spellbee_*`), as one screen with numbered steps:
- **① 怎么出题**: two illustrated cards (📖 看中文 / 🔊 听发音), with a gold ✓ on the selected one.
- **② 玩法**: three compact cards, each with a big emoji, a name and **one** line:
  - ⚡ **抢答赛**: "谁先拼对谁得分 · 计天梯";
  - 🎯 **慢慢拼** (rename B): "两人都拼完再下一个";
  - 🔥 **同步赛**: "先拼对多得分".
  - Mark C (or whichever the teacher prefers) as "推荐".
  - Put the full rules behind a "ⓘ 规则" link that opens a sheet.
- **③ (only for 开一间) 谁能进**: 公开 / 🔒 只给好友（发房间码）.
- A 64px gold **[开房！]** CTA at the bottom, with `‹ 返回` in the header.
- **Make the rules true first:** either implement waitAll for B/C (don't force-end the word; show "对手已拼对 +100，你还有 8 秒") or delete the 80/60 claims.

---

## 9. Waiting for an opponent (public and private code)

Shots: `24_waiting_public_{dark,light}`, `25_waiting_private_code_{dark,light}`, `25b_waiting_private_copy_tapped_{dark,light}`, `65_waiting_private_360/320`.

**Good, keep:**
- A spinning ⏳ and a 1 s "已等 N 秒" counter (this is the one place it is done right).
- "你开的是 🔥同步赛 · 10 个词".
- For private rooms, a **huge code** with tap-to-copy and a fallback "长按上面的码复制" when the clipboard is blocked (which is what happened headless, and what often happens in WeChat).
- "私密房不出现在公开列表…".

**Problems:**
1. **S2. The hidden 2-minute limit.** After 120 s the room closes and the user lands in the lobby with an error (L685). Nothing on screen says so.
2. **S2. No social signal.** It does not show who the user is waiting for or how many people are browsing rooms, and there is no "invite" action for public rooms. Below y≈700 (css 350) the screen is empty.
3. **S2 (light). The room code `#a5b4fc` on white is 1.99** (needs 3.0 at 44px). `← 关掉房间` is 1.22.
4. **S3.** The only exit is the top-left "← 关掉房间", a destructive label in the back position. "（关掉这一页，房间也会一起关掉）" adds anxiety.
5. **S3.** No WeChat share. Copying the code and switching apps is the whole invite flow, and nothing says what to paste.

**Redesign:**
- Center: my avatar in a "seat", plus an empty "?" seat with a pulsing dashed ring, "VS" between them. The empty seat fills with the opponent's avatar and name when they join, followed by a 3-2-1 countdown (see §10).
- Under the seats, a **2:00 countdown ring** ("还会等你 1:42") and the line "朋友进来就自动开打".
- Private rooms:
  - a code card (4 boxes, dark ink on light, ≥7:1);
  - **[📋 复制邀请]**, which copies a full message ("来单词大冒险和我PK！房间码 45XF，打开 拼写大PK → 输入房间码");
  - a secondary **[发给好友]** that opens the in-app friends picker.
- Exit: a bottom ghost button "不等了" with a confirm toast. Avoid the word "关掉".
- On timeout: "这会儿没人来 😴 [再等 2 分钟] [回去]" on the same screen.

---

## 10. Battle screen (modes A / B / C, `.pr_*` round UI)

Shots (all modes, both themes):
- `30_battle_{A,B,C}_midround_*`
- `31_battle_{A,B,C}_opp_scored_*`
- `32_battle_{A,B,C}_i_scored_*`
- `33_battle_{A,B,C}_last5s_*`
- `34_battle_{A,B,C}_timeout_*`
- `36_battle_A_tts_*`
- `37_battle_netwarn_*`
- `38_battle_opp_idle_*`
- `39_battle_A_midround_standalone_*`
- `66_battle_longname_360/320`

Geometry: `metrics/_s05_summary.json → geom_*`.

**Good, keep:**
- One word per round.
- The Chinese prompt is 34px.
- A first-letter hint with letter slots ("a _ _ _ _").
- Typing a correct answer auto-submits.
- An in-app QWERTY keyboard so the system keyboard never appears.
- The keyboard dims while the round result shows.
- Immediate "📨 已提交…".
- "🔥 你抢先拼对！ +100 分 · 0.7s 〔banana 香蕉〕" with a green pop on my score; the opponent's score pops orange.
- A red, scaled timer in the last 5 s.
- The answer is revealed when time runs out.
- The TTS mode shows no clue.
- Network and opponent-idle warnings exist.
- The 3 s background grace period.

**Problems:**
1. **S1. Header layout bug** (summary #3). At 390 with both scores ≥100, the chip covers my score and the timer wraps (`32_battle_A_i_scored_dark`: "第 2 / 3 词 · ⏱" / "20s"). At 360 with a 10-character opponent name the progress/timer is a 25px column 124px tall. At 320 it is **off-screen** (x=324). The timer, the most important number in a speed game, is 16px regular weight at the far right.
2. **S1 (light). The input is `#0b1220`** with `--pk-txt #0f172a`, so typed letters have contrast **1.05**: you cannot see what you typed (`30_battle_A_midround_light`, island and standalone). The placeholder reads only because it is a lighter grey.
3. **S2. The opponent is a word, not a person.** "对手：正在拼…" is 14px dim text under the input. There is no avatar or name (summary #4), and nothing like "typing" dots. The duel feeling the code comments call "对战感的来源" is the weakest element on screen.
4. **S2. Modes B and C force-end my word as soon as the opponent is right** (`31_battle_B/C_opp_scored_*`). The children who most need "拼对就有分" lose the chance.
5. **S2. The keyboard floats mid-screen.** The keys end at y=432 of 844 css px, which leaves **≈47% of the screen empty below** (all `30_*`). Keys are 32×46 (27–30px wide at 360/320). The Spelling Bee sibling docks a full-width keyboard at the bottom with 50px keys and 24px glyphs, and plays a tap sound. At 320 the first key row pokes past the keyboard panel edge (`66_battle_longname_320`).
6. **S2. Round feedback is a one-line 14px caption.** "⏱ 超时了 〔noodles 面条〕" / "对手抢先了 〔apple 苹果〕" lasts 1.4 s. The correct spelling, the learning moment, is not shown in the letter slots and is not read aloud. No sound plays for a correct answer, a miss or the opponent scoring.
7. **S2. The network warning covers the score and timer.** The orange bar is `position:absolute; top:0` over the header (`37_battle_netwarn_*`). In light mode the palette remaps its inline `color:#fff` to dark ink, giving **2.89** on `#b45309` (hansen_palette.js L99). "（进度不会丢）" is a promise the code does not keep: the round timer keeps running.
8. **S3. Opponent-idle copy.** "对手：对手掉线了…26 秒后判他负" doubles "对手" and uses "判他负" (harsh, gendered). The orange is fine.
9. **S3.** The TTS 🔊 is a bare emoji button (44px glyph, no button chrome) labelled "点喇叭再听一次". It does not look like the Spelling Bee's big round 🔊 plus "🔁 再听一次" button.
10. **S3.** The mode chip in the score row repeats information the user just chose and costs the space the scores need.
11. **S4. Copy bug, masked by later code.** When the opponent wins a word the code first writes "🔥 你抢先拼对！" into the opponent-status element (L1366), then immediately overwrites it. Fix the string anyway.

**Redesign** (anatomy, top to bottom, mirroring the Spelling Bee round in `05b_sibling_spellbee_round_dark`):
- **Top bar (56px):**
  - `✕` (44px) on the left; it confirms "退出就算输哦".
  - Center pill "第 3 / 10 词" plus a 10-dot progress row.
  - Right: a **timer pill 20px heavy** (gold → red in the last 5 s, with a thin depleting ring).
- **VS scoreboard (72px):**
  - `[🐝 avatar 你]` with a **28px Bowlby-style score** on the left;
  - a "VS" badge in the center;
  - the score, then `[对手名 avatar]` on the right.
  - Name ellipsis with `max-width:30%`, and `flex:0` on the scores so they never shrink.
  - Opponent status lives **on the opponent's avatar**: three "typing" dots while live, a ✅ burst when they score, 💤 when idle.
- **Prompt card:** 34–40px Chinese (or a big round 🔊 button in TTS mode), then the letter slots as **boxes** that fill as you type, replacing the separate input line. That removes the input's contrast problem and makes progress visible.
- **Round result overlay** (on the prompt card, 1.6 s):
  - correct: "✅ +100" fly-up toward my score, slots flash green, key-tap "叮";
  - opponent first: "小红 抢先了！" with their avatar bump;
  - always: **the correct word in the slots, large**, plus TTS of the word once.
- **Keyboard:** docked to the bottom with safe-area padding, full width, keys ≥34×50, a 24px glyph, the Spelling Bee colors (`--keyboard-bg` / `--key-bg`, spelling_bee.html L81/L105), and the same tap sound (`kbTap`, L1896).
- **Network or idle notices:** a slim pill **under** the VS bar ("📶 网络有点慢，正在重连…" / "小红 好像掉线了，再等 26 秒"). Never cover the timer.
- **Modes B and C:** after the opponent answers, show their ✅ but keep my input live until the timer ends, and say "对手拼对了！你拼对还能拿 60 分".

---

## 11. Submitted / waiting for the opponent's result (📨 交卷了)

Shots: `35_battle_{A,B,C}_submitted_waiting_{dark,light}`.

**Problems:**
1. **S2. A dead screen.** One title and two lines of 14px grey text, no animation, **no button**. It can last up to 45 s (22 polls × 2 s, L1591). After that it declares "🏆 对手已离场，本局你胜", which may be untrue (for example, the opponent was simply slow on bad Wi-Fi).
2. **S3. Robustness.** `pollResult` does not check `stillLive()` on its success path (L1573–1600), and `_waitResult` is module-global. In the harness, a stale chain from a previous game painted a result or lobby screen over a new game (that is why §10's TTS / net / idle shots were recaptured on fresh pages). In real use the screen has no exit, so this is unlikely, but it should be tied to the game.

**Redesign:**
- Keep the battle layout. Freeze the scoreboard and show "你答完了！等 小红 拼完最后一个词…" with the opponent's avatar "typing", plus a 45 s ring.
- Offer "先看我的成绩" (show my half of the result) and "不等了".
- On timeout say what we know: "小红 一直没交卷，按规则算你赢 🏆".

---

## 12. Result (win / lose / draw)

Shots: `40_result_win_A_{dark,light}`, `40_result_lose_A_{dark,light}`, `40_result_draw_C_{dark,light}`.

**Good, keep:**
- A clear headline with emoji (🎉 你赢了！ / 💪 这局输了 / 🤝 打平).
- The "这一局" 4-stat block (答对 / 抢先 / 平均 / 最快).
- Rating delta.
- "段位保护" messaging (code).
- "距离 🔍 侦察蜂 还差 N 分 · 约 N 局", which is very motivating.
- "再来一局" goes back into the ladder search for ranked games.

**Problems:**
1. **S2. Hierarchy is inverted.** The actual score "你 100 分 · 对手 0 分" is `.pr_empty` (14px, `--pk-dim`). "+20 天梯分" is 20px colored. Tier and total record are **left-aligned** body text in an otherwise centered layout. There is no avatar or opponent name, and no confetti or sound.
2. **S2.** For room games **"再来一局" and "← 回到房间列表" both call `lobby()`** (L1826–1847). There is no rematch with the same person and no "回到岛屿" exit.
3. **S2 (kids' emotion).** A loss shows "-13 天梯分" in 20px red as the second-largest element. For 7–10 year olds, lead with what went well (their fastest word, words learned) and soften the delta.
4. **S3.** "总战绩 1 胜 1 负 · 胜率 33%" (`40_result_draw_C_*`) appears wrong because draws are excluded from the label but included in the rate.
5. **S3 (light).** The accent number in "还差 **174** 分" is `--pk-accent #c4b5fd` on a pale pill: **1.41** (L1684; `--pk-accent` has no light override). The "← 回到房间列表" ghost button has no visible border and a blurry shadow.
6. **S3.** "这一局" captions are 10.5–11px ("每个词", "这局最快").

**Redesign:**
- **Hero:**
  - Win: a trophy or medal illustration with a confetti burst (reuse `chestBounce`) and a 32px heavy title.
  - Lose: "差一点点！" with 💪 and a gentle wobble.
  - Draw: 🤝.
- **Big VS score row:** `[avatar 你] 300 : 200 [avatar 小红]` at 40px, with the winner's side glowing gold.
- A **"这一局你学会了"** strip: the words of the match as chips (✅ green or ❌ grey). Tapping a chip replays the TTS. This turns PK back into learning.
- **Reward band:** a "+20 ⭐ 天梯分" pill (gold) **or** "-13" in neutral grey with "段位保护还剩 26 分"; a progress bar to the next tier.
- **Actions:** gold **[再来一局]** (same opponent if both accept, otherwise a new match of the same type), secondary [换个对手], and a text link [回到岛屿].
- Show 平局 explicitly: "1 胜 1 平 1 负".

---

## 13. Friends (`#hsn_friends_screen`)

Shots: `50_friends_list_{dark,light}`, `51_friends_add_error_{dark,light}`, `52_friends_detail_{dark,light}`, `53_friends_empty_{dark,light}`, `54_friends_not_logged_in_{dark,light}`.

**Good, keep:**
- Online friends first.
- A ringed avatar with a green dot for online friends; offline friends greyed out.
- "刚才还在" (honest wording).
- A pending state ("等他也加你为好友").
- No free-text box (a deliberate safety choice).
- The add-friend error appears inline.
- The not-logged-in card explains why (竞赛 ID comes with login).

**Problems:**
1. **S2.** The 15 s auto-refresh **re-renders the whole screen**, wiping the 竞赛 ID being typed and moving focus to `×` (`typing_after_15s`; L230 + L233–317).
2. **S2. Quick messages go nowhere visible.** There is no inbox, badge or toast for the receiver (`inbox()` has no caller). Yet the sender sees "已发出：⚔️ 来一局？".
3. **S2.** "⚔️ 开个房间叫他来打" opens the **public** lobby (`detail_pk_dest_*`). Nothing invites the friend.
4. **S3.** Offline rows use `opacity:.45`: name **4.01 dark / 2.93 light**, sub-line **2.72 / 2.11**. The pending row looks identical to offline.
5. **S3. Tap targets under 44px:** 在线 / 隐身 toggles 162×38; ID input 251×40; 加好友 73×40; quick chips 63–161×38; detail buttons 362×39. 去登录 in the not-logged-in card is 73×39.
6. **S3.** Not logged in: the login card **and** a still-tappable status toggle **and** a disabled form **and** a second "先登录才能加好友" in the list. Three cards for one message.
7. **S3.** The status explanation "（网页不能像 App 那样一直挂着，所以这只表示你最近开着页面）" is accurate but too technical for kids. "删除好友" sits right under the primary button with equal weight and uses a native `confirm`.
8. **S4.** Every avatar is 🐝 (there are profile avatars elsewhere: `hansen_avatar.js`, `avatars/`).

**Redesign:**
- Only update the list node on refresh, and skip the refresh while the input has focus.
- Order: **好友列表 first** (online at the top with a big "⚔️ 约战" pill on each online row), then "加好友" as a compact row with an `[+]` that opens a bottom sheet (with numeric keypad) and shows "你的竞赛 ID：No.007 · 复制" so kids can exchange IDs. Put the status toggle in the header as a small switch ("🟢 在线 / 🌙 隐身").
- Offline: keep names at full contrast; dim only the avatar and the dot, and use "25 分钟前来过".
- **约战 flow:** create a private room with the default mode, then send a quick message containing the room code to that friend, then go to the waiting screen with the friend's avatar in the empty seat.
- **Inbox:** a badge on the hub's 好友 tile and on the island's 拼写大PK card, plus a toast "小红：⚔️ 来一局？ [去应战]" that deep-links into the room.
- Move 删除好友 into a "⋯" menu with the in-app `HansenToast.ask` dialog.

---

## 14. Cross-screen issues: is it one product?

- **Five different back/close patterns:**
  - "← 返回" text button (hub, lobby, room-taken);
  - "← 关掉房间" (waiting);
  - "×" on the right (ladder home, friends);
  - "×" on the left (matching, offline, login);
  - "←" icon box (friend detail).
  - The mode chooser has its back button only at the bottom.
  - Island pages use `.back-btn` (a 44px rounded glass pill, island_food.html L724) and the Spelling Bee uses a white "‹ 返回" pill.
- **Three overlay roots with unrelated z-indexes:** `#hsn_pk_screen` 2147483400, `#hsn_pkroom_screen` 2147483600, `#hsn_ladder_screen` / `#hsn_friends_screen` 2147482000 (hence summary #2). Toasts are 2147483645–7.
- **No motion between screens.** Every state change is `innerHTML` replacement with `display:none→block`: hard cuts, the scroll position resets, nothing slides. The island already defines `slideIn` (L723), `chestBounce` (L532), `comboToastIn` (L106) and `fire` (L718).
- **Three colour systems for one feature:** `--pk-*` (room UI L42–58), `--hpk-*` (copied verbatim in ladder L55–71 **and** friends L49–65), and hard-coded `k_*` colours in the hub (sb_pk L54–88), patched for light mode by palette rules (hansen_palette.js L519–528). Each is separate from the site palette (`--pal-*`, `--th-*`). Every light-mode bug in this report comes from a hex that skipped its system.
- **Typography:** headings use `system-ui` 19–20px 700–900; buttons use CartoonBlack 900 (forced by the island's global rule); body text is 11–14px. The rest of the app uses CartoonBlack for titles and Bowlby One for numbers.
- **Native dialogs remain** in 5 places (summary #11), although `HansenToast.say/ask/notReady` exists (hansen_toast_v1156.js) and is used for account switching.
- **Copy tone:** mostly kind and concrete. Exceptions: "判他负", "慢的一方 0 分", "先散了吧", "技术信息：Failed to fetch", "最快速度(字符/分)", "等得越久范围放得越宽", "进度已跟随账号".

### Navigation map, proposed

```
Island card 拼写大PK ──► PK Hub (one design, both pages)
  ├─ ⚡ 快速对战 ──► Setup (mode/ask/privacy) ──► Waiting (seats + 2:00 ring) ──► Countdown 3-2-1 ──► Battle ──► Result
  │                                                    ▲                                              │ 再来一局 (same type / rematch)
  ├─ 🏠 公开房间列表 ──► (tap room) ───────────────────┘                                              ▼
  ├─ 🏆 天梯 ──► Ladder home ──► Matchmaking (search→host, one screen) ──► Countdown ──► Battle ──► Result ──► (再来一局 → Matchmaking)
  └─ 👥 好友 ──► Friends ──► 约战 (private room + auto invite) ──► Waiting (friend in seat)
Back always returns one level; ✕ in battle = forfeit confirm.
```

Add a **"对手来了！" handoff** (avatar slides in, 3-2-1, word 1). Today the host jumps straight into the first word with no warning (`startMatch` → `askRound(0)` within ≤1.2 s).

---

## 15. Design system the battle screens should share with the rest of the app

The aim is to retire `--pk-*`, `--hpk-*` and the `k_*` literals in favour of one alias layer on top of the existing site tokens, so light and dark mode come free.

### Tokens (already defined in the codebase)

| Role | Use this | Defined in |
|------|----------|------------|
| Page background (dark) | `--th-bg-deep/mid/glow` + `--th-cosmos-1..4` nebula | index.html L274–282 (per-theme blocks follow); overridden per palette in hansen_palette.js `buildCSS()` (L118–121) |
| Surfaces | `--pal-surf-1..4`, `--pal-glass-a/b` (fallbacks `#0f172a/#1e293b/#334155/#475569`) | hansen_palette.js L18–75 (palette defs), L113–117 (inline-style takeover map shows the dark fallbacks) |
| Text | `--pal-ink`, `--pal-ink-hi`, `--pal-ink-2`, `--pal-ink-3`, `--pal-accent-text` | hansen_palette.js L21–75; light deepening at L176 (`--pal-ink-2:#475569;--pal-ink-3:#64748b`) |
| Lines | `rgba(var(--pal-line-rgb), .28)` | hansen_palette.js |
| Accent / reward | `--th-accent` (gold `#fbbf24` default), gold CTA gradient `#f59e0b→#d97706` | index.html L282; island_food.html L1298 (`.game-btn.gold`) |
| Feature colour for PK | `#4f46e5→#4338ca` (the 拼写大PK mode card) | island 拼写大PK `.mode-card` (`--c1:#4f46e5;--c2:#4338ca`, island_food.html L1552) |
| Semantic | good `#22c55e` / light `#15803d` (palette remaps `color:#22c55e`), warn amber, bad red | hansen_palette.js L188 (`[style*="color:#22c55e"]`→`#15803d`) |
| Fonts | `--font-cartoon` (titles, buttons, big numbers), `--font-body` (text), Bowlby One for scores (`.stat-num`) | index.html L105–107; island_food.html L316–330 |
| Radius | 16 cards (`.mode-card`), 12 buttons (`.game-btn`), 18 hero CTA (`.startbtn`), 999 pills, 5–6 keys | island_food.html L801/L1293; spelling_bee.html L254/L363 |
| Tap targets | `min-height:44px` (already on `.game-btn`, `.back-btn`, `.k_ab`) | island_food.html L1293/L724 |

**Proposed alias layer** (one file, e.g. `hansen_battle_tokens.css`; names illustrative):

```css
:root{
  --b-bg:var(--th-bg-deep,#0c1538); --b-card:var(--pal-surf-2,#1e293b); --b-card-2:var(--pal-surf-3,#334155);
  --b-ink:var(--pal-ink,#fff); --b-ink-2:var(--pal-ink-2,#cbd5e1); --b-ink-3:var(--pal-ink-3,#94a3b8);
  --b-line:rgba(var(--pal-line-rgb,99,102,241),.28); --b-feature:#4f46e5; --b-gold-a:#f59e0b; --b-gold-b:#d97706;
  --b-good:#22c55e; --b-warn:#f59e0b; --b-bad:#ef4444; --b-r-card:16px; --b-r-btn:12px; --b-r-cta:18px;
}
html.hsn-pal-light{ --b-good:#15803d; --b-warn:#b45309; --b-bad:#b91c1c; }
```

Rule: **every colour in the battle modules is `var(--b-*)`.** A hex anywhere else fails review. The ladder already has the kind of contrast test (test_ladder_contrast_v1156.mjs) that could enforce this for all overlays in both themes.

### Components to share

| Component | Reuse from | Notes |
|-----------|-----------|-------|
| Overlay shell | new `HansenOverlay.open(id)` with one z-index (e.g. 2147483500) and mutual exclusion that includes `HansenSbPK` | Replaces 3 `host()` / `paint()` / `closePeers()` copies (room UI L120–136; ladder L170–213; friends L177–222). Do not re-run `a11yOn` on every repaint; update in place. |
| Header bar | island `.back-btn` glass pill (island_food.html L724) / Spelling Bee "‹ 返回" | Always top-left back, centered title, optional right slot (timer / live dot). |
| Feature tile | `.mode-card` (island_food.html L801–807) | Hub tiles: illustration, title, live subline. |
| Choice card with ✓ | Spelling Bee setup cards (`05_sibling_spellbee_*`) | Mode chooser, 出题方式, privacy. |
| Primary CTA | `.game-btn.gold` / `.startbtn` | One per screen; indigo `.game-btn` for secondary. |
| VS scoreboard | Spelling Bee `.vsbar` (spelling_bee.html L306) | Avatars, names, Bowlby numbers, opponent status on the avatar. |
| Letter slots + keyboard | Spelling Bee `.keyboard` / `.key` + `kbTap` (spelling_bee.html L359–363, L1896); room UI `pkKeyboard()` (L855) | Dock to the bottom, 50px keys, shared theme vars (L81/L105). |
| Timer pill | Spelling Bee top bar timer, island `typeTimerPulse` (island_food.html L680) | 20px heavy; gold → red in the last 5 s. |
| Blocking state | new: illustration (`ui/brain_*.webp`) + title + reason + gold CTA + text link + "给老师看的信息" disclosure | Offline, login, expired, not-ready, room gone. |
| Toast / confirm | `HansenToast.say/ask/notReady` (hansen_toast_v1156.js) | Replace every `alert`/`confirm` in the battle flows. |
| Avatar | `hansen_avatar.js` / `avatars/` | Use everywhere a person appears (lists, VS bar, results, friends). |
| Motion | `slideIn` (island L723), `chestBounce` (L532), `comboToastIn` (L106), `fire` (L718) | Screen enter, score fly-up, result confetti, streak flame. |

---

## Appendix A: contrast measurements (WCAG 2.x)

Computed from the theme tokens; the same pairs appear in `metrics/*.json → contrastFails`.

| Pair | Ratio | Need |
|------|------:|-----:|
| LIGHT battle input text `#0f172a` on `#0b1220` | **1.05** | 4.5 |
| LIGHT selected 出题 card text on `#1e1b4b` | **1.12** | 4.5 |
| LIGHT hub "从云端恢复进度" `#fff` on `rgba(15,23,42,.06)` | **1.18** | 4.5 |
| LIGHT `.pr_back` / room name `#0f172a` on `#1e293b` | **1.22** | 4.5 |
| LIGHT result accent `#c4b5fd` on pill | **1.41** | 4.5 |
| LIGHT leaderboard "me" row `#f5f7ff` on `#b5b1f4` | **1.86** | 4.5 |
| LIGHT room meta `#4b5563` on `#1e293b` | **1.94** | 4.5 |
| LIGHT private code `#a5b4fc` on `#fff` (44px) | **1.99** | 3.0 |
| LIGHT offline friend sub-line (opacity .45) | **2.11** | 4.5 |
| DARK/LIGHT 天梯 card text `#fff` on `#0ea5e9` | **2.77** | 3.0 / 4.5 |
| DARK offline friend sub-line (opacity .45) | **2.72** | 4.5 |
| LIGHT net-warning text (remapped ink) on `#b45309` | **2.89** | 4.5 |
| LIGHT "技术信息" faint 11px | **3.38** | 4.5 |
| DARK `--pk-faint` `#7c879b` on `#0f172a` | 4.93 | 4.5 ✓ |
| DARK `--pk-dim` `#a9b4c7` on `#0f172a` | 8.54 | ✓ |
| DARK chip `#e8eefc` on `#3730a3` | 8.55 | ✓ |
| DARK white on `.pr_btn` end `#6366f1` | 4.47 | 4.5 (edge) |

## Appendix B: tap targets under 44px (measured)

- Hub `← 返回` 77–80×40/42.
- Lobby "🔑 有朋友给的房间码？" summary 362×34.
- Friends: status toggles 162×38, ID input 251×40, 加好友 73×40, quick chips ×38, detail buttons 362×39, 去登录 73×39.
- Battle keys 32×46 at 390, 30×46 at 360, 27×46 at 320. These are keyboard keys; follow Spelling Bee's 50px height and the bottom dock rather than the 44px rule.
- Everything on the ladder, matching and result screens is ≥44.

## Appendix C: width checks

- **390 / 360 / 320:** no horizontal page scroll on any screen (`overflow.scrollW == vw` everywhere).
- **Clipping and off-screen content:**
  - Battle timer column is 25px wide at 360 and off-screen at 320 (`66_battle_longname_*`).
  - The first keyboard row overflows its panel at 320.
  - Leaderboard and room names ellipsize as intended.
