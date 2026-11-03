export const meta = {
  name: 'miniprogram-feasibility-and-optimization',
  description: 'Research: can the H5 game become a native WeChat Mini Program (constraints, options, effort, risks) + product-level optimization review; synthesized recommendation with critic',
  phases: [
    { title: 'Research', detail: 'codebase portability metrics, WeChat platform constraints, product optimization review' },
    { title: 'Synthesize', detail: 'recommendation + effort estimate, then a critic pass' },
  ],
}
const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad'
const SNAP = SCR + '/v1163_snapshot'
const CTX = `
CONTEXT: "单词大冒险" is a Chinese kids' English-vocabulary game built as a plain H5 web app (vanilla JS, no framework): 41 HTML pages (home index.html; 27 island pages generated from template.html/land_template.html, opened inside an iframe of the home page), ~87 hansen_*.js modules, Tencent CloudBase web SDK 2.30.0 (env ambitious-d0g1d26xm740dc3d6, 个人版, static website hosting at a *.tcloudbase.com / *.tcloudbaseapp.com default domain), localStorage for all game state, a service worker, audio files, images, fonts; the deploy package is ~79 MB. Players are kids on phones, mostly opening it inside WeChat's in-app browser. The owner is a non-technical English teacher. The owner now asks: "Can you convert this into a NATIVE WeChat Mini Program (原生微信小程序)? How much work? Can it be done perfectly?" and "What in the whole app can still be optimized so it is perfect?"
A pristine copy of the app is at ${SNAP} (read-only for you; never touch /home/user/wordminiprogram). Notes/scripts go under ${SCR}/mp-research/<topic>/.
Internet: general web search may work (WebSearch / WebFetch); many Tencent/WeChat doc domains may be blocked from this sandbox — if blocked, say so and rely on search snippets + your knowledge, marking confidence and the date your knowledge is from. Do not invent policy details; flag uncertain ones as "to confirm in the WeChat admin console".
Your output is data for an orchestrator; be precise and cite sources (URLs, file:line, measured numbers).
`
const OUT = { type: 'object', properties: {
  summary: { type: 'string' },
  facts: { type: 'array', items: { type: 'object', properties: {
    claim: { type: 'string' }, source: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['claim', 'source', 'confidence'] } },
  details: { type: 'string', description: 'full analysis in markdown' },
  open_questions: { type: 'array', items: { type: 'string' } },
}, required: ['summary', 'facts', 'details', 'open_questions'] }

const TOPICS = [
  { key: 'portability', prompt: `TOPIC: Measure how portable this codebase is to a native WeChat Mini Program, with numbers.
Measure in ${SNAP}: lines of JS (modules + inline <script> in HTML), number of distinct screens/games, DOM API usage counts (document.*, innerHTML, createElement, querySelector, addEventListener, style manipulation, getBoundingClientRect, elementFromPoint), iframe usage (islands in iframe#islandFrame, overlays), window.top/parent/postMessage, localStorage usage (keys, total typical size; mini program storage limit is 10 MB total per user and per-key 1 MB), service worker, Web Audio / HTMLAudioElement / speechSynthesis (TTS), canvas, CSS features (animations, filters, backdrop-filter, vh units, fixed positioning), fonts (woff2 files), dynamic import(), eval/new Function, ES module usage, external CDNs. Total asset sizes by type (audio, images, fonts, js, html), and which assets are needed at first launch. Map each subsystem to its mini-program equivalent (WXML/WXSS/JS pages & components, wx.setStorage, wx.createInnerAudioContext, wx.cloud / CloudBase mini-program SDK, canvas 2d, subpackages) and rate porting difficulty. Estimate the effort for a full native rewrite in engineer-days per subsystem with a range, and identify what CANNOT be ported 1:1. Also assess the alternative of a mini program that is only a <web-view> shell around the existing H5 (what changes in the H5 would be required, e.g. wx JSSDK, navigation, audio autoplay, storage isolation between web-view and the mini program, login).` },
  { key: 'platform', prompt: `TOPIC: WeChat platform constraints and options as of your latest knowledge (state the date), with sources.
Research and report precisely: (1) Mini Program account subject types (个人 / 企业 / 个体工商户 / 政府 / 媒体 / 其他组织) and what a 个人主体 mini program can and cannot do: <web-view> availability (业务域名) for personal subjects, allowed service categories for kids' education content (教育 → 在线教育 / 早教 etc.) and which require qualifications, whether 个人主体 can publish an education / game-like app, payment, ads; (2) 小程序 vs 小游戏 (mini game) — which fits a vocabulary game with mini-games, their account/category/qualification rules (e.g. 小游戏 may need 软件著作权 / 版号 for paid or certain categories; check current rules), and their tech stacks; (3) package size limits (main package, subpackages, total; independent subpackages; 小游戏 limits), and rules for remote assets (audio/images loaded from CDN need request/downloadFile legal domains configured; domains must have ICP 备案 and HTTPS); (4) whether CloudBase (腾讯云开发 / 微信云开发) can be linked to a mini program, whether an existing Tencent Cloud CloudBase env (个人版) can be used from a mini program, and how auth works there (wx.cloud gives openid automatically; the current H5 uses phone SMS + username login); (5) 业务域名 / web-view requirements (domain ownership verification file, ICP 备案, whether CloudBase static hosting default domains are allowed); (6) review/audit process, privacy policy & 用户隐私保护指引, 未成年人 protection rules relevant to a kids' app, and typical review rejections for such apps; (7) development tooling: WeChat DevTools requires the owner to log in by scanning a QR code; who must do which steps (I, an AI in a cloud sandbox, cannot scan QR codes or log into WeChat; the owner can't use a terminal). Make the human steps explicit.` },
  { key: 'optimize', prompt: `TOPIC: Product-level optimization review of the WHOLE app (beyond bug-hunting, which another team is doing): what would make this kids' vocabulary game clearly better and more "one seamless product".
Use the running app in ${SNAP} (serve it locally with correct MIME types, Playwright at '/opt/node22/lib/node_modules/playwright/index.mjs', phone viewport 390x844, serviceWorkers:'block', abort external requests; at most one browser at a time) plus code reading. Evaluate: first-run onboarding (time to first fun moment), learning effectiveness (spaced repetition hansen_review.js / SRS, difficulty progression, feedback on mistakes, pronunciation/TTS quality and fallback), motivation loops (coins, diamonds, crystals, pets, cards, achievements, quests — are there too many currencies? are rewards understandable to a 7–10 year old?), navigation clarity and depth, consistency of interactions across the 14 mini-games, accessibility for young kids (reading level of Chinese text, tap targets, contrast), performance (first load size, time to interactive on a mid-range phone with 4G throttling via CDP Network.emulateNetworkConditions, number of requests, memory), offline behaviour, parent/teacher needs (progress visibility, class use), sound design, and anything confusing. Give a prioritized list (impact × effort) of concrete improvements with evidence (screenshots under ${SCR}/mp-research/optimize/, measurements), and say clearly what is already good and should be kept.` },
]

phase('Research')
const res = await parallel(TOPICS.map(t => () => agent(CTX + '\n' + t.prompt, { label: 'research:' + t.key, phase: 'Research', schema: OUT }).then(r => ({ key: t.key, r }))))
const ok = res.filter(Boolean)
phase('Synthesize')
const draft = await agent(`${CTX}
You are the synthesizer. Using ONLY the research below (do not invent facts), write the answer the owner needs, in two parts, in Simple Chinese suitable for a non-technical teacher (short sentences, explain why), but precise:
PART A — 原生微信小程序: can it be done, and how? Compare the realistic options (e.g. web-view shell; native rewrite as a 小程序; rewrite as a 小游戏; keep H5 and improve WeChat-browser experience), each with: what the owner must have/do (account subject, category, 备案, AppID, DevTools QR login, review), what I (the AI developer) can do, size/asset strategy, cloud/login changes, effort range, main risks, and what "perfect" would realistically mean. Give ONE clear recommendation with a phased plan and the decisions/information needed from the owner (e.g. 主体类型). Be honest about what cannot be done 1:1.
PART B — 整体优化: the top improvements, prioritized, each with why it matters and rough effort; what to keep.
Also return a short English 'summary'. Put the full Chinese text in 'details' (markdown). List the facts you relied on with their confidence.

RESEARCH:
${JSON.stringify(ok, null, 1)}`, { label: 'synthesize', phase: 'Synthesize', schema: OUT })
const critic = await agent(`${CTX}
You are a critic. Check the synthesized answer below against the research it was based on: flag any claim not supported by the research, any overstated certainty about WeChat policy, any missing option or risk, any effort estimate that looks unrealistic, and anything the owner would misunderstand. Return corrections as facts (claim = correction) and put a corrected full Chinese text in 'details' only if changes are needed (otherwise repeat it unchanged).

RESEARCH:
${JSON.stringify(ok, null, 1)}

SYNTHESIS:
${JSON.stringify(draft, null, 1)}`, { label: 'critic', phase: 'Synthesize', schema: OUT })
return { research: ok, draft, critic }
