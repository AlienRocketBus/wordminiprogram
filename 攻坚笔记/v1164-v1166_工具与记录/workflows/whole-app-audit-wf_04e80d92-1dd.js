export const meta = {
  name: 'whole-app-audit',
  description: 'Whole-app audit on a pristine v1163 snapshot: island/home integration, shared state, per-island game sweep, page health, visuals, offline/update, code bugs; each finding adversarially verified',
  phases: [
    { title: 'Find', detail: '8 finders, each a different audit dimension' },
    { title: 'Verify', detail: 'one skeptic per finder reproduces or refutes every blocker/major finding' },
  ],
}

const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const SNAP = SCR + '/v1163_snapshot'
const CTX = `
CONTEXT: "单词大冒险" — a Chinese kids' English-vocabulary H5 game (also opened inside WeChat's in-app browser on phones). Players: kids; product owner: a non-technical English teacher who tests on a phone. The user asked: "Are all the islands and the main interface truly ONE seamless whole — like rooms of one house with all doors open — and does the whole app have ANY bugs? Find them all."
WORK ONLY ON THE PRISTINE SNAPSHOT: ${SNAP} (full copy of v1163). NEVER read from, write to, or run anything in /home/user/wordminiprogram or /home/claude/work/repo (other agents are editing that checkout right now). Put your scripts/outputs under ${SCR}/audit/<your-dimension>/.
SKIP these subsystems (they are being rewritten separately): online battle rooms / ladder / friends / login-registration-session / cloud save (files hansen_pk_room*, hansen_ladder*, hansen_friends*, hansen_auth*, hansen_cloud_*, hansen_sb_pk*, spelling_pk.html battle flows). You may note a problem there only if it breaks something else.
App structure: index.html = home (island map); tapping an island card opens island_*.html INSIDE iframe#islandFrame (URL does not change — that is intended, v684). 27 island pages are generated from template.html / land_template.html (placeholders ⟦⟦XXX⟧⟧ in templates are normal). Each island has ~14 mini-games (探索单词, 听音辨义, 记忆翻牌, 打字大师, 完形填空, 字母拼拼乐, spelling bee, 拼写大PK, 打地鼠, 钓鱼, 泡泡, 极速60秒, 火眼金睛, 抽卡). Shared state lives in localStorage (wallets: coins/diamonds/crystals, XP/level, pets, quests, achievements, cards, gear, SRS) across the top window and iframes. Other pages: boss_hall.html, land_map.html, season_showcase.html, spelling_bee.html, check.html, _frame.html. New users see onboarding overlays (首页新手引导 → 点「跳过」; 岛屿欢迎弹窗 → 「开始冒险！」). Read 交接_必读_给下一个对话.md §3, §14 and BUG图鉴_v1156.md in the snapshot for known pitfalls and test tricks (e.g. headless swallows alert/confirm → page.on('dialog'); use page.touchscreen.tap after scrollIntoView + elementFromPoint check; spelling bee / 拼写大PK open iframe overlays hsnSbOverlay/hsnPkOverlay).
TOOLS: Playwright: import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'. Serve ${SNAP} with your own tiny static server on an OS-assigned port (listen(0)) with correct MIME types (.html text/html, .js/.mjs text/javascript, .css, .json, .webmanifest, .png, .jpg, .webp, .svg, .gif, .mp3, .m4a, .wav, .woff2, .ico) and make GET /VERSION return 1163. Unless your dimension is about the service worker, use serviceWorkers:'block'. Use phone emulation (390x844, deviceScaleFactor 1, isMobile, hasTouch) and also check 360px width where layout matters. Abort all external network requests (no internet here) and note any page that depends on one. Keep CPU use moderate: at most ONE browser instance at a time, close pages you are done with (other heavy jobs share this 4-core machine).
REPORTING STANDARD: only report what you actually observed or can prove from code; each finding needs exact repro steps (or file:line for code-level ones), observed vs expected, severity, and a concrete fix suggestion. Also list what you checked that is fine (coverage), so gaps are visible. Your final output is data for an orchestrator.
`

const FINDINGS = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    coverage: { type: 'array', items: { type: 'string' }, description: 'what was checked (pages, islands, games, flows) and found OK' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'polish'] },
          area: { type: 'string', description: 'page / module / feature' },
          repro: { type: 'string' },
          observed: { type: 'string' },
          expected: { type: 'string' },
          evidence: { type: 'string', description: 'file:line, console error text, screenshot path, measurement' },
          fix: { type: 'string' },
        },
        required: ['id', 'title', 'severity', 'area', 'repro', 'observed', 'expected', 'evidence', 'fix'],
      },
    },
    not_checked: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'coverage', 'findings', 'not_checked'],
}
const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'uncertain'] },
          reason: { type: 'string' },
          severity_adjusted: { type: 'string', enum: ['blocker', 'major', 'minor', 'polish', 'n/a'] },
        },
        required: ['id', 'verdict', 'reason', 'severity_adjusted'],
      },
    },
    missed: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdicts', 'missed'],
}

const DIMS = [
  { key: 'integration-nav', prompt: `DIMENSION: Home ↔ island integration and navigation ("one house, all doors open").
Check: opening every island from the home map (all 27; time from tap to playable; loading indicator; prefetch hansen_island_prefetch_v1025.js), closing/returning to home (button, Android-style back via history.back(), swipe-back simulation), switching from one island to another, refreshing while inside an island (where do you land? is state lost?), opening an island URL directly (deep link) and how it gets back to home, whether the iframe island feels like part of the same app (header, coins/level display, theme, fonts, music/sound, mute), double-tap / rapid tapping on island cards, opening while another island is loading, memory/timers leaking after opening and closing 20 islands in a row (count intervals/listeners/iframes; performance.memory if available), scroll position restore on home after closing an island, z-index/overlay conflicts between home overlays and the island iframe (onboarding, toasts, version watcher, rescue overlays), boss_hall / land_map / season_showcase / spelling_bee navigation to and from home. Report every seam where it does NOT feel like one app.` },
  { key: 'shared-state', prompt: `DIMENSION: Shared state across home and islands (single source of truth, live sync).
Check by playing (not only reading code): earn coins/XP/crystals/diamonds in an island game (iframe) and verify the home header updates immediately on return without reload; the same for pet growth, daily quests, achievements, check-in, card book, gear; do two writers (top window + iframe, or two island iframes during prefetch/warm-up hansen_room_warm_v1023.js) ever overwrite each other (lost updates)? Look at wallet/transaction modules (hansen_coin_wallet.js, hansen_totals_wallet.js, hansen_ach_wallet.js, hansen_cardbook_wallet.js, hansen_canonical_progress.js, hansen_crystal.js, hansen_gem_system.js, hansen_quest_global.js, hansen_checkin_global.js) for read-modify-write races across frames, storage event handling, cache staleness, double-award / lost-award on fast taps, reload mid-transaction, and numbers that disagree between screens. Verify with real two-frame experiments where possible.` },
  { key: 'island-sweep-1', prompt: `DIMENSION: Functional sweep of every mini-game on islands, PART 1: island_action, island_adjective, island_animal, island_body, island_city, island_clothes, island_color, island_family, island_food, island_home, island_job, island_nature, island_question, island_school.
For each island: open it as a fresh-but-onboarded user (dismiss welcome), then tap each game card with touchscreen.tap, play at least one full round of each game (answer some correctly and some incorrectly; let one timer run out), close it, and move on. Record JS errors (pageerror, console.error), unhandled rejections, failed requests (404/500, missing audio/images), games that cannot start or cannot be closed, overlays left behind, wrong rewards, stuck timers, broken audio calls, text overflow, and anything a kid would find broken or confusing. Skip the online 拼写大PK battle rooms (being rewritten) but do open the 拼写大PK card to see it renders.` },
  { key: 'island-sweep-2', prompt: `DIMENSION: Functional sweep of every mini-game on islands, PART 2: island_season, island_sports, island_time, island_traffic, island_treasure, island_land1 … island_land8 (单词大陆 pages from land_template.html), plus land_map.html, boss_hall.html (boss battle flow, as far as it runs offline), season_showcase.html and spelling_bee.html.
For each: open as a fresh-but-onboarded user, tap each game card / main action with touchscreen.tap, play at least one full round (some right, some wrong, one timeout), close, move on. Record JS errors, unhandled rejections, failed requests (missing audio/images), games that cannot start or close, leftover overlays, wrong rewards, stuck timers, text overflow, and anything a kid would find broken or confusing. Skip online battle rooms/ladder.` },
  { key: 'page-health', prompt: `DIMENSION: Page health of EVERY .html file in the snapshot (list them all; templates may legitimately not run).
For each page: load at 390px and 360px; record console errors, page errors, unhandled rejections, failed/404 requests (scripts, styles, images, audio, fonts), references to files that do not exist in the snapshot (also grep HTML/JS for src/href/import/fetch paths and check existence), horizontal overflow (document.scrollingElement.scrollWidth > innerWidth), elements cut off, time to DOMContentLoaded/load, number and total size of resources loaded (flag pages > a few MB at first load), duplicate script includes, mismatched ?v= version stamps, and scripts loaded twice in iframe + parent. Also run the repo's own static checkers against the snapshot if they can run there read-only (check_resources.py, hansen_guards_v1068.py) — run them with the snapshot as cwd and report their output.` },
  { key: 'visual-consistency', prompt: `DIMENSION: Visual/UX consistency of the whole app (does it look and feel like ONE product?).
Screenshot (390x844, deviceScaleFactor 2) home, at least 8 different islands (classic and 单词大陆), several mini-games mid-play, reward popups, boss hall, land map, season showcase, settings/theme shop, check-in, quests, achievements, pet screens, in both light and dark theme (hansen_theme_*.js). Compare colors, typography (cartoon_font.woff2 / baloo2.woff2 usage), button styles, corner radii, spacing, iconography, header/back-button placement, toasts (hansen_toast_v1156.js vs ad-hoc alerts), modal styles, and motion. Compute WCAG contrast for key text in both themes. List every inconsistency and every place that breaks the "one house" feeling, with screenshot paths, and propose a unified set of tokens/components citing where they are defined. Save screenshots under ${SCR}/audit/visual-consistency/.` },
  { key: 'offline-update', prompt: `DIMENSION: Weak network, offline, caching, updates (service worker sw_v944.js + hansen_sw_upgrade_gate_v944.js, version watcher hansen_version_watch_v1083.js, hansen_preload.js, perf modules).
With service workers ENABLED: first visit, second visit offline (context.setOffline(true)), slow network (route delays), update from version 1163 to a simulated 1164 (serve a modified VERSION and changed ?v= stamps from a temporary COPY of the snapshot, never modifying the snapshot itself) — does the app update cleanly or loop-refresh or mix versions between parent and iframe? Does an island open offline? What does a kid see when audio files fail to load? Check the 「打开变下载」 defenses (Content-Type handling in the SW for navigation responses). Look for infinite reload loops, stale caches, and cache bloat.` },
  { key: 'code-bugs', prompt: `DIMENSION: Code-level bug hunt across the non-battle modules (hansen_*.js except the skipped ones, index.html inline scripts, template.html inline scripts, generate.py output consistency).
Use the bug patterns from BUG图鉴_v1156.md (computed-but-not-shown, change-A-without-updating-references-to-A, new-thing-not-wired-into-existing-chain, comment ≠ code, untrusted input, empty vs error mixed) plus: double event binding (onclick assigned twice; addEventListener added repeatedly per open), timers not cleared, async callbacks touching destroyed state, JSON.parse without try/catch on localStorage, localStorage iteration without snapshot, Promise misuse (sync use of async APIs), postMessage handlers without origin/shape checks, numbers not clamped, division by zero/NaN shown to users, date/timezone bugs around daily resets (check-in, daily quests, streaks: midnight, DST not relevant in China but local vs UTC matters), off-by-one in level/XP thresholds, and generated island pages that differ from the template in unintended ways (diff a couple of generated islands against template.html with placeholders filled). For each suspected bug, try to PROVE it with a small browser or node experiment; report proven ones as findings and unproven suspicions separately in not_checked.` },
]

const verifyPrompt = (d, res) => `${CTX}
You are an adversarial SKEPTIC. Another auditor examined dimension "${d.key}" and reported the findings below. For EVERY finding with severity blocker or major (and up to 10 of the most important minor ones), independently try to REPRODUCE it yourself on the snapshot (re-run the repro steps in your own script, or re-read the cited code). Mark "refuted" when it does not reproduce or the reasoning is wrong (explain), "uncertain" when you cannot tell, "confirmed" only when you reproduced it. Adjust severity if overstated/understated. Also list important problems the auditor missed in this dimension (only ones you observed).

AUDITOR TASK:
${d.prompt}

AUDITOR RESULT:
${JSON.stringify(res, null, 1)}`

const out = await pipeline(
  DIMS,
  d => agent(CTX + '\n' + d.prompt, { label: 'find:' + d.key, phase: 'Find', schema: FINDINGS }),
  (res, d) => res
    ? agent(verifyPrompt(d, res), { label: 'verify:' + d.key, phase: 'Verify', schema: VERDICTS }).then(v => ({ key: d.key, res, verify: v }))
    : null,
)
return out.filter(Boolean)
