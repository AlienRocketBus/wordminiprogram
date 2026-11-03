export const meta = {
  name: 'opt-learning-perf',
  description: 'In an isolated worktree (from main/v1163): learning-effect fixes then performance fixes, then an adversarial review + fix pass',
  phases: [
    { title: 'Learning', detail: 'SRS keeps missed words, mistakes become mini-lessons, no answers printed in picture prompts, copy QA' },
    { title: 'Performance', detail: 'gate room warming, lazy Boss engine/portraits, idle animation budget, first-visit data budget' },
    { title: 'Review', detail: 'adversarial review of both batches, then fixes' },
  ],
}
const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const WT = SCR + '/wt-opt'
const COMMON = `
You work in an ISOLATED git worktree: ${WT} (branch opt/learning-perf, starting from main = v1163) of the H5 kids' vocabulary game "单词大冒险". Another team is rewriting the online battle/ladder/friends/login code in a different checkout (/home/user/wordminiprogram) — NEVER read from, write to or run anything there, and NEVER touch the symlink /home/claude/work/repo (it points at that other checkout and other agents depend on it).
Do NOT touch these battle/login files in your worktree either: hansen_pk_room*, hansen_ladder*, hansen_friends*, hansen_auth*, hansen_sb_pk*, hansen_sb_profile*, hansen_cloud_*, hansen_backup*, hansen_cred_*, hansen_signup_gate*, spelling_pk.html.
Source of the work: ${SCR}/optimize/REPORT.md (product optimization review with evidence; its scripts/screenshots are in ${SCR}/optimize/). Read the snapshot docs in your worktree: 交接_必读_给下一个对话.md (§6–§8, §13–§15), BUG图鉴_v1156.md, 下结论之前.md.
RULES:
- Island pages island_*.html are GENERATED from template.html / land_template.html by generate.py — edit the templates and run \`python3 generate.py\` in ${WT}; never hand-edit generated pages. Do not change version stamps (?v=1163), VERSION, hansen_audio_lock.json, hansen_bug_registry.py, vendor_*.js. Do not run package_release.py or jarvis_gate.py. Do not git push. Commit your work in the worktree when a coherent piece passes its checks: \`git -C ${WT} -c user.name="BAT MAN" -c user.email="batman@users.noreply.github.com" commit -q -am "<中文说明>"\` (add new files with git add first). End each commit message with the two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BA1TPEBFEsrC3tPwS8yPSx
- TESTS: 89 test files hardcode /home/claude/work/repo. To run such a test against YOUR worktree, make a temporary copy with the path replaced, run it, delete it: \`cd ${WT} && sed 's#/home/claude/work/repo#${WT}#g' test_x.mjs > _wt_test_x.mjs && HANSEN_PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs timeout 600 node _wt_test_x.mjs; rm -f _wt_test_x.mjs\`. New tests you write must locate the repo from import.meta.url (no hardcoded absolute paths) and be named test_*_v1165.mjs. Guards: \`cd ${WT} && python3 hansen_guards_v1068.py\` must stay green; resources: \`python3 check_resources.py\` 0 problems. Keep CPU moderate: one browser at a time; do NOT run the whole suite (分批跑测试.py) — run the tests relevant to what you changed (grep for the functions/modules you touched).
- If an existing guard encodes the old behaviour you are deliberately changing, update the guard and its jarvis_selftest.py sample consistently and explain why in the guard text. For every behaviour you fix, add a test that fails on the old code and passes on the new (prove it by running it against the old code via git stash or a copy).
- Never weaken or skip a test. Chinese user-facing copy at a 7–10-year-old reading level; short Chinese code comments that say why.
- Final output is data for the orchestrator.
`
const REPORT = { type: 'object', properties: {
  summary: { type: 'string' },
  commits: { type: 'array', items: { type: 'string' } },
  changes: { type: 'array', items: { type: 'string' }, description: 'each item: what changed, file:function, why, evidence before/after' },
  tests: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, result: { type: 'string' } }, required: ['name', 'result'] } },
  guards: { type: 'string' },
  deferred: { type: 'array', items: { type: 'string' }, description: 'items not done and why' },
  risks: { type: 'array', items: { type: 'string' } },
  needs_real_phone: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'commits', 'changes', 'tests', 'guards', 'deferred', 'risks', 'needs_real_phone'] }

phase('Learning')
const learning = await agent(`${COMMON}
YOUR BATCH: learning effectiveness (REPORT.md items 2, 3, 10, 17).
2) Spaced review: a missed word must stay in the review plan (S.srs) until it graduates through correct answers on due days (SRS_GAP [1,2,4,7,15]); the 错题本 count may still decrement on correct answers, but plan membership must not be deleted just because wrongs reached 0 (template.html markAnswer ~L4567; hansen_review.js _ensureSrs/_absorbRealAnswer ~L258-270, ~L370-376). Keep the v963 "real evidence before graduation" rule and the review-reward rules (hansen_review_rewards_v963.js) consistent; reproduce the old bug first (${SCR}/optimize/s33_srs_check.mjs shows how) and prove the fix with a new test.
3) Mistakes become mini-lessons in every mini-game that has a wrong-answer path: show the same reveal card the correct path uses (emoji/picture, English word, IPA, Chinese) and replay the word audio (respect the global mute/volume rules), for about 2.5 s or until tapped; re-queue the missed word once at the end of the current round; on result screens list the missed words with 🔊 and a 「练这 N 个词」 button feeding the existing review/错题 practice; replace 「💔 连胜被中断」 with gentle wording (e.g. 「再听一遍 👂」). Keep game flow/timers/rewards consistent (no extra coins for the re-queued retry beyond existing rules — check the economy guards). Apply in template.html AND land_template.html, regenerate.
10) Spelling-type prompts must not print the answer: when a picture prompt is used in a spelling/typing/scramble/spell-by-Chinese context, render it without its <text> labels (or fall back to emoji/Chinese only) — check island DATA in the templates and vocab_all.js (114/240 SVGs contain the English word; ${SCR}/optimize/svg_giveaway.mjs). Do not change recognition games where showing the word is the point.
17) Copy/number QA: the 「还差 1 个! undefined」 quest banner (template.html ~L4029 reads q.text, global quests use title), inconsistent island/word/mode counts (compute from data or use wording that stays true), duplicated <title> in index.html, the 「5 大动物岛屿」 wording inside an island (call groups 小组), unreachable achievement 「万词王者 1500 词」 (rescale to a reachable target computed from the real word count).
Verify each change in a real browser on several islands (classic and 单词大陆) and both themes.`, { label: 'learning', phase: 'Learning', schema: REPORT })

phase('Performance')
const perf = await agent(`${COMMON}
The learning batch was just committed in this worktree by another agent (report below); build on top of it, don't undo it.
YOUR BATCH: performance & data budget (REPORT.md items 4, 5, 11, 14), measured before/after with the same method as the report (${SCR}/optimize/server.mjs with gzip, CDP 4G 9 Mbps/1.5 Mbps/80 ms + CPU 4×, see s29_warm_cpu.mjs, s14_warm_ab.mjs, s31_anim_ab.mjs, s01gz_firstrun.mjs).
4) hansen_room_warm_v1023.js: never warm inside a warm frame (no nesting), never when window !== top inside a room/warm context, gate on HansenPreloadPolicy (same policy the Boss prefetch uses), and warm 星海 pages only for kids who have opened 星海 before (otherwise warm on touchstart of the 星海 entry, which hansen_season.js already does on home). Make sure a warmed page never writes progress that makes 「我的学习」 claim the kid visited an island they never opened.
5) Boss engine hansen_boss_attack.js (1.23 MB) and its sprites load only when a Boss fight (or the admin/settings panel that truly needs it) is opened — fix the eager path hansen_boss_lock.js armSettings → refresh → ensureLoaded → __hansenBossFXReady (template.html ~L8301) and keep the idle <link rel=prefetch> path; boss portraits lv01–lv20 (hansen_preload.js ~L228, hansen_cards.js ~L1240) preloaded only after the Boss wall was opened once, or only the next 1–2 unlocked. Verify every Boss flow still works (open wall, fight, win, lose, 大满贯, free pass period).
11) Idle animation budget on the island menu and home: decorative loops run a few cycles then stop (or only on interaction), remove the no-op twinkle keyframes, animate only transform/opacity, add a prefers-reduced-motion block to the island templates. Measure main-thread busy before/after.
14) First-visit data budget for brand-new kids: prefetch only the recommended first island (not 6) until the kid has played; skip 星海 warm until a basic island is finished; move land_map.html's inline base64 images (~650 KB) to separate lazy files ONLY if that is clean and safe for the deploy package and the release contract (check check_resources.py / package_release.py rules) — otherwise defer and explain; font subsetting of cartoon_font.woff2 only if fonttools is available offline and the subset covers every glyph actually rendered with that font (verify by scanning all strings that use it) — otherwise defer.
Report measured numbers before/after for each item.

LEARNING BATCH REPORT:
${JSON.stringify(learning, null, 1)}`, { label: 'performance', phase: 'Performance', schema: REPORT })

phase('Review')
const review = await agent(`${COMMON}
You are an adversarial REVIEWER + fixer for the two batches committed in this worktree (reports below). Review \`git -C ${WT} diff origin/main...HEAD\` completely. Look for: behaviour regressions in any of the 14 mini-games on classic and 单词大陆 islands, broken generated pages (run generate.py and confirm a clean diff), economy/reward double-counting or lost rewards, SRS edge cases (graduation, due dates across midnight, words in several islands, review rewards), audio/mute violations, timers left running, overlays left behind, a11y/contrast regressions in both themes, Boss flows broken by lazy loading, warm/prefetch changes that slow the first island or break 星海 entry, guard/self-test inconsistencies, tests that would pass on the old code (prove each new test fails on origin/main). Fix every real problem you find (commit), and re-run the relevant tests and guards. Report what you verified, what you fixed, and anything still risky.

LEARNING REPORT:
${JSON.stringify(learning, null, 1)}

PERFORMANCE REPORT:
${JSON.stringify(perf, null, 1)}`, { label: 'review+fix', phase: 'Review', schema: REPORT })
return { learning, perf, review }
