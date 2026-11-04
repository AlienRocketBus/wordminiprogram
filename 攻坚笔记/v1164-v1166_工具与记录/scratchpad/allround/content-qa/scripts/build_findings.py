# Builds the flagged-entry list (CSV + JSON) from the extracted snapshot data.
# Every "current" value is pulled from data/master.json (never typed by hand) so the CSV quotes the snapshot exactly.
import json, csv, re, collections, os
B = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
rows = json.load(open(B + 'data/master.json'))
R = {r['id']: r for r in rows}
isl = json.load(open(B + 'data/island_entries.json'))
voc = json.load(open(B + 'data/vocab_entries.json'))
KEY = {e['src']: e['key'] for e in isl}
VI = {(v['group'], v['en']): v['idx'] for v in voc}
hl = {o['id']: o for o in json.load(open(B + 'out/highlight_eval.json'))}
noform = json.load(open(B + 'out/cloze_noform.json'))

SBL = json.load(open(B + 'data/spelling_bee_lines.json'))
def sb_line(r, land=None):
    want = land if land else r['island']
    for ln, i in SBL.get(r['en'], []):
        if i == want:
            return f"; spelling_bee.html:{ln} (WORDS copy)"
    return ''
def where(r):
    """primary file:line + every other place the same text must be changed"""
    if r['island'] == 'season':
        land = r['also']  # island_landN.html:line
        n = re.search(r'land(\d)', land).group(1)
        return f"{r['src']}:{r['line']}", f"{land}; land_data.json[land{n}] (cat slot); island_data.json[season].DATA; land_map.html:114 (en/pn/cn only)" + sb_line(r, 'land' + n)
    k = KEY[r['src']]
    return f"{r['src']}:{r['line']}", f"vocab_all.js HANSEN_VOCAB_ALL.{k}[{VI[(k, r['en'])]}]; island_data.json[{r['island']}].DATA" + sb_line(r)

AUDIO_NOTE_CLASSIC = 'changing ex breaks SENTENCE_MAP exact-text key -> re-record sentences/*.mp3 + rebuild sentence_map.js/hansen_audio_lock.json'
AUDIO_NOTE_SEASON = 'changing ex breaks __HANSEN_EX_AUDIO normalised key -> re-record words/<w>_ex_season.mp3 + update hansen_ex_audio.js/hansen_audio_lock.json'

out = []
def add(rid, field, problem, proposed, confidence, category, severity, notes=''):
    r = R[rid]
    f, also = where(r)
    cur = r[field] if field in r else ''
    if field == 'emoji':
        cur = r['emojiText'] if r['emojiKind'] == 'emoji' else (r['emojiKind'] + ':' + '|'.join(r['svgText']))
    if field == 'ex' and proposed and not notes:
        notes = AUDIO_NOTE_SEASON if r['island'] == 'season' else AUDIO_NOTE_CLASSIC
    out.append(dict(id=rid, file=f, also_change=also, island=r['island'], word=r['en'], field=field, current=cur,
                    problem=problem, proposed=proposed, confidence=confidence, category=category, severity=severity, notes=notes))

# ---------------- IPA ----------------
add(854, 'pn', 'Wrong IPA: /ɔːˈɡʌst/ is the adjective "august" (威严的, stress on 2nd syllable). The month is stressed on the 1st syllable.', '/ˈɔːɡəst/', 'high', 'ipa_wrong', 'high')
add(826, 'pn', 'Inconsistent convention: every other /aʊə, aɪə/ word carries a stress mark (our /ˈaʊə/, fire /ˈfaɪə/, flower /ˈflaʊə/, tired /ˈtaɪəd/); "hour" (same sound as "our") has none.', '/ˈaʊə/', 'medium', 'ipa_inconsistent', 'low')
add(203, 'pn', 'Compound-noun stress on the wrong element (OALD/Cambridge: ˈpost office). Other compounds in the set (police station, fire station, living room) stress the first element.', '/ˈpəʊst ɒfɪs/', 'low', 'ipa_inconsistent', 'low')
add(410, 'pn', 'Compound-noun stress: dictionaries give the main stress on "air" (OALD /ˈeə kəndɪʃənə(r)/).', '/ˈeə kəndɪʃənə/', 'low', 'ipa_inconsistent', 'low')
add(363, 'pn', 'American stress pattern inside an otherwise British (OALD BrE) IPA set; BrE is /ˌaɪs ˈkriːm/.', '/ˌaɪs ˈkriːm/', 'low', 'ipa_inconsistent', 'low')

# ---------------- spelling convention ----------------
add(420, 'en', 'Same word spelled two ways in the app: "neighbour" (人物岛 headword) vs "neighbor" (星海/land7 headword #739). The app is otherwise mostly American spelling (color, gray, favorite x11, mom x10, math, pajamas, cookie, candy, truck, -ize).', 'neighbor (if the app standardises on American spelling; otherwise change #739 to neighbour)', 'high', 'spelling_inconsistent', 'medium', 'headword change: also rename __ISLAND_LOCAL_AUDIO/WORD_MAP key "neighbour" (audio file words/neighbour.mp3 says the same word), ex "Our neighbour is really friendly." -> "Our neighbor is really friendly." (SENTENCE_MAP key + re-record)')
add(739, 'en', 'Same word spelled two ways in the app (see #420 "neighbour").', 'keep "neighbor" if American spelling is chosen', 'high', 'spelling_inconsistent', 'medium')
add(221, 'en', 'British spelling "centre" while the app is mostly American (color, gray, favorite, mom, math, pajamas...). Also "city centre" in #598.', 'center (ex: "The fountain is at the center of the square.") — only if American spelling is chosen', 'medium', 'spelling_inconsistent', 'low', AUDIO_NOTE_CLASSIC)
add(598, 'ex', 'British "flat ... city centre" in an otherwise American-spelling app.', 'They live in a modern apartment in the city center.', 'low', 'spelling_inconsistent', 'low')
add(581, 'ex', '"maths" (BrE) here and in #671, but "math" (AmE) is the headword (#540) and is used in #84 "Math can be hard for me."', 'Our math teacher is very strict about homework.', 'medium', 'spelling_inconsistent', 'low')
add(671, 'ex', '"maths" (BrE) vs headword "math" (#540).', 'Many students struggle with math at first.', 'medium', 'spelling_inconsistent', 'low')
add(853, 'ex', 'Unnatural ("a month is a vacation") and inconsistent with #631 "summer holiday".', 'Summer vacation starts in July.  (exCn: 暑假从七月开始。)', 'medium', 'example_unnatural', 'low')
add(843, 'ex', '"soccer" here while the sports-island headword for 足球 is "football" (⚽, #794). A child learns two words for 足球 with no explanation.', 'I have football practice on Thursday.', 'low', 'spelling_inconsistent', 'low')
add(787, 'ex', '"hard-working" with a hyphen, but the headword #587 is "hardworking" (no hyphen).', 'He is the most hardworking employee in the company.', 'low', 'spelling_inconsistent', 'low')

# ---------------- Chinese meaning ----------------
add(339, 'cn', 'Picture (icons/food-v958/cabbage.webp) is a round head cabbage = 卷心菜/包菜; 白菜 means Chinese (napa) cabbage, a different vegetable. Example translation repeats 白菜.', '卷心菜  (exCn: 奶奶在花园里种卷心菜。)', 'high', 'cn_wrong', 'medium', 'see shots/food_icons_sheet.png (1st image)')
add(129, 'cn', '"羊" is ambiguous; the same island has goat = 山羊 (#130), so 英译汉/汉译英 cannot tell sheep from goat. The example translation already says 绵羊.', '绵羊', 'high', 'cn_ambiguous', 'medium')
add(234, 'cn', 'skirt is any 裙子/半身裙, not specifically a short skirt; the example translation itself uses 裙子.', '裙子 (or 半身裙, to contrast with dress = 连衣裙)', 'high', 'cn_wrong', 'medium')
add(652, 'cn', 'Meaning shown (假设 = suppose/hypothesise) is not the sense used in the example (想当然地认为 = take for granted). HIGHLIGHT_MANUAL already has to special-case it.', '认为/假定 (想当然地认为)', 'medium', 'cn_sense_conflict', 'medium')
add(182, 'cn', '胸膛 is literary; the example translation says 胸口, and kids say 胸/胸口.', '胸部/胸口', 'medium', 'cn_unnatural', 'low')
add(216, 'cn', '庙宇 is literary; the example translation says 寺庙.', '寺庙', 'medium', 'cn_unnatural', 'low')
add(308, 'cn', 'uncle also = 舅舅/伯伯/姑父/姨父; textbooks gloss "叔叔;舅舅".', '叔叔/舅舅', 'low', 'cn_incomplete', 'low')
add(309, 'cn', 'aunt also = 阿姨/姨妈/舅妈; textbooks gloss "阿姨;姑姑". Example translation word order is also odd (我玛丽姑姑 -> 我的姑姑玛丽).', '阿姨/姑姑  (exCn: 我的姑姑玛丽住在隔壁。)', 'low', 'cn_incomplete', 'low')
add(303, 'cn', 'grandpa is also 外公/姥爷 (mother\'s side); showing only 爷爷 can confuse.', '爷爷/外公', 'low', 'cn_incomplete', 'low')
add(304, 'cn', 'grandma is also 外婆/姥姥.', '奶奶/外婆', 'low', 'cn_incomplete', 'low')

# same-cn pairs (cannot be told apart in 汉译英 / 听音辨义 options in the same island)
same_cn = collections.defaultdict(list)
for r in rows:
    if r['island'] == 'season': same_cn[r['cn']].append(r)
prop = {'invent': '发明(动词)', 'invention': '发明(名词)/发明物', 'succeed': '成功(动词)', 'success': '成功(名词)', 'huge': '巨大的', 'enormous': '庞大的/极大的',
        'amount': '数量/金额', 'quantity': '数量/数目', 'rarely': '很少/极少', 'seldom': '很少/难得', 'besides': '此外/再说', 'moreover': '而且/此外(书面)', 'furthermore': '此外/再者(书面)'}
for cn, lst in same_cn.items():
    if len(lst) > 1:
        names = ', '.join(x['en'] for x in lst)
        for x in lst:
            add(x['id'], 'cn', f'Identical Chinese meaning "{cn}" for {names} in the same island (星海 + its land island): in 汉译英 the prompt "{cn}" has two right answers; in 听音辨义 the same-level distractor loop only de-duplicates by English, so two identical Chinese options can appear.', prop.get(x['en'], cn), 'medium', 'cn_duplicate_in_island', 'medium')

# cn separators ';' vs '/'
for r in rows:
    if ';' in r['cn']:
        add(r['id'], 'cn', 'Sense separator ";" (14 星海 entries) while the 712 classic entries use "/". highlight_helper.js smartHighlight() only splits on "/", so these meanings fall back to single-character guesses (e.g. available -> highlights 的).', r['cn'].replace(';', '/'), 'high', 'cn_format', 'low', 'or teach smartHighlight to split on ";" too')

# ---------------- example translation ----------------
add(396, 'exCn', 'Mistranslation: "set the table" = 摆好餐具/碗筷, not 摆桌子 (move/arrange tables).', '我们摆好碗筷准备吃晚饭吧。', 'high', 'excn_wrong', 'medium', 'exCn is not voiced; no audio impact')
add(619, 'exCn', 'Same mistranslation of "set the table" (摆桌子).', '你来摆碗筷,与此同时我来做晚饭。', 'high', 'excn_wrong', 'medium')
add(619, 'ex', '"cook the dinner" -> natural English is "cook dinner".', "You set the table; meanwhile, I'll cook dinner.", 'medium', 'example_unnatural', 'low')
add(688, 'exCn', 'English says "The test" (这次测试) but the translation says 这道题 (this question).', 'English: This question has multiple correct answers.  (keeps the Chinese 这道题有多个正确答案。)', 'high', 'excn_mismatch', 'medium', AUDIO_NOTE_SEASON)
add(205, 'ex', '"A red truck" is vague; the translation 红色卡车 hides that it is a 消防车.', 'A fire engine pulled out of the fire station.  (exCn: 一辆消防车从消防站开了出来。)', 'medium', 'example_unclear', 'low')
add(87, 'exCn', '年纪很老了 is unnatural Chinese.', '我爷爷年纪很大了。', 'high', 'excn_unnatural', 'low')
add(488, 'exCn', '"How\'s it going?" = 最近怎么样?/近来好吗?; a bare 怎么样? loses the greeting meaning.', '最近怎么样?', 'medium', 'excn_unnatural', 'low')
add(849, 'exCn', '春天三月开始 is ungrammatical Chinese.', '春天从三月开始。', 'high', 'excn_unnatural', 'low')
add(775, 'exCn', '一家小生意 – wrong measure word.', '他在镇上做着一门小生意。', 'medium', 'excn_unnatural', 'low')
add(930, 'exCn', '我想要更多米饭 is translationese.', '我还想再要点米饭。', 'medium', 'excn_unnatural', 'low')
add(754, 'exCn', '为家庭供能 is unnatural.', '我们用电给家里的电器供电。', 'low', 'excn_unnatural', 'low')
add(824, 'ex', 'Example uses the idiom "in a second" (= 马上), not the stated sense 秒; translation 我一秒钟就到 is a literal rendering of an idiom.', "There are sixty seconds in a minute.  (exCn: 一分钟有六十秒。)", 'medium', 'example_sense_conflict', 'medium')

# ---------------- example sentence (English) ----------------
add(825, 'ex', 'Ungrammatical: "wait for me ten minutes" needs "for" before the duration (or reorder).', 'Please wait ten minutes for me.  (exCn: 请等我十分钟。)', 'high', 'example_grammar', 'high')
add(150, 'ex', 'Factually wrong as a generic statement: only the blue whale is the largest animal; many whales are smaller than an elephant. (#766 already says "The blue whale is the largest creature".)', 'The blue whale is the largest animal on Earth.  (exCn: 蓝鲸是地球上最大的动物。)', 'high', 'example_fact', 'medium')
add(274, 'ex', 'Implausible for a child (school starting at 6 o\'clock); #276 already uses "I get up at eight".', 'I get up at six every morning.  (exCn: 我每天早上六点起床。)', 'medium', 'example_unnatural', 'low')
add(538, 'ex', 'Target users are 7–10 (grades 1–4); "grade seven" is a middle-school year.', "I'm in grade three this year.  (exCn: 我今年上三年级。)", 'medium', 'example_age', 'low')
add(698, 'ex', 'Comma splice before "otherwise" (the neighbouring "however" item #693 correctly uses a semicolon).', "Hurry up; otherwise, we'll miss the train.", 'medium', 'example_grammar', 'low')
add(920, 'ex', 'Tense mismatch (eat / we\'ll play).', "First we'll eat, and then we'll play.", 'medium', 'example_grammar', 'low')
add(117, 'ex', 'Awkward tense/coordination.', 'She is sick, so she is staying at home.', 'medium', 'example_unnatural', 'low')
add(288, 'ex', '"the first in her class" is unidiomatic.', 'She came first in the exam.  (exCn: 她考试得了第一名。)', 'medium', 'example_unnatural', 'low')
add(627, 'ex', 'Redundant "previously ... before".', 'He had previously worked as a teacher.  (exCn: 他以前当过老师。)', 'low', 'example_unnatural', 'low')
add(802, 'ex', '"exercise" (activity) is uncountable here; compare #800 "Swimming is great exercise."', 'Jumping is good exercise.', 'medium', 'example_grammar', 'low')
add(874, 'ex', '"out on the sea" -> idiomatic "out at sea".', 'A huge ship is out at sea.', 'medium', 'example_unnatural', 'low')
add(904, 'ex', 'The example teaches "because of" (preposition), not the conjunction "because" that the card teaches (因为 + clause).', "I'm late because the traffic is heavy.  (exCn: 我迟到了,因为路上很堵。)", 'medium', 'example_sense_conflict', 'low')

# ---------------- cloze compatibility ----------------
for n in noform:
    r = R[n['id']]
    add(n['id'], 'ex', 'Example does not contain the headword in its exact form (only an inflected form), so 完形填空 and Boss 完形 silently skip this word (cloze level counter jumps, e.g. 身体岛初级 skips 8 of 20).', 'code: when the exact form is absent, blank the inflected form (s/es/ies/ed/ing + irregular map: flown, drew, got, teaches) and show that form in the options', 'high', 'cloze_skipped', 'medium', 'Fix in code (accept inflections when blanking: s/es/ies/ed/ing + irregulars flown/drew/got/teaches) rather than rewriting 48 recorded sentences')
add(506, 'ex', 'Cloze capitalisation bug: the blank replaces "It" after a full stop but is filled with lowercase "it" -> shows "I have a cat. it is white." (verified in browser: shots/t2_cloze.json afterAnswerSentence "I have a cat. it is white.", question screen shots/t2_question_it_question.png). Also the distractor "she" is grammatical here (pets are often "she").', 'code: copy the case of the matched text into the blank and the option labels', 'high', 'cloze_case', 'medium', 'template.html:6948 / land_template.html:6787 (and Boss cloze template.html:4760): capitalise when the matched text is capitalised (preserve the case of the original match), not only when match.index===0')
add(830, 'ex', 'Cloze capitalisation bug: "Happy New Year!" is filled as "Happy New year!" (verified: shots/t2_cloze.json afterAnswerSentence "Happy New year!").', 'code: same as #506', 'high', 'cloze_case', 'medium', 'same fix as #506')

# synonyms that both fit the sentence and share a cloze level (season island)
syn = [['however', 'nevertheless'], ['therefore', 'consequently'], ['besides', 'moreover', 'furthermore'], ['rarely', 'seldom'], ['immediately', 'instantly'], ['finally', 'eventually'], ['huge', 'enormous']]
en2id = {r['en']: r['id'] for r in rows if r['island'] == 'season'}
for g in syn:
    for w in g:
        others = [x for x in g if x != w]
        if w == 'enormous':
            continue  # "an enormous animal": "huge" would need "a"
        add(en2id[w], 'ex', f'Cloze ambiguity: near-synonym {", ".join(others)} is in the same 星海 cloze level and also fits this sentence, but only "{w}" is accepted (distractors are de-duplicated by English only).', 'code: never offer a listed synonym / same-cn word as a distractor', 'medium', 'cloze_ambiguous', 'medium', 'exclude same-cn / listed synonyms from the distractor pool')

# ---------------- gold highlight ----------------
bad_hl = {560: '吓到', 562: '搞糊涂', 577: '小心', 601: '平常', 610: '还有', 596: '宝贵', 772: '银河系', 622: '不停地', 627: '曾', 20: '坐过', 589: '下定决心', 764: '天然的'}
for rid, good in bad_hl.items():
    o = hl[rid]
    add(rid, 'exCn', f'完形填空 gold highlight marks "{o["hl"]}" in 「{o["exCn"]}」, which is not the target word\'s meaning (smartHighlight fragment fallback).', f'HIGHLIGHT_MANUAL["{o["en"]}|{o["exCn"]}"] = "{good}"', 'high', 'highlight_wrong', 'medium', 'highlight_helper.js; verified shots/t2_season_frightened_question.png, t2_season_available_question.png, t2_season_galaxy_question.png')
partial = {623: '临时', 690: '最高', 696: '而是', 711: '总的来说', 791: '名声', 816: '球员', 846: '星期天', 912: '从没', 773: '事业', 611: '适合', 603: '舒服', 631: '时间', 937: '里', 938: '上', 939: '底下'}
for rid, good in partial.items():
    o = hl[rid]
    add(rid, 'exCn', f'Gold highlight covers only part of the meaning ("{o["hl"]}").', f'HIGHLIGHT_MANUAL["{o["en"]}|{o["exCn"]}"] = "{good}"', 'medium', 'highlight_partial', 'low')

# ---------------- pictures ----------------
add(538, 'emoji', 'Picture shows the score sense of "grade" (GRADE / A+ / stars) while the meaning taught is 年级 (school year).', 'picture of a school year/class (e.g. classroom door with "3" or 🏫)', 'high', 'picture_sense_conflict', 'medium')
add(734, 'emoji', '🎎 = Japanese Hinamatsuri dolls, used for a Chinese Spring Festival tradition (eating dumplings).', '🥟 (dumpling, Emoji 5.0) or 🧧', 'high', 'picture_mismatch', 'low')
add(602, 'emoji', '🗼 is officially TOKYO TOWER (U+1F5FC) but the example is about the Eiffel Tower.', 'neutral 🌟 / ⭐ or an Eiffel-tower image', 'medium', 'picture_mismatch', 'low')
add(433, 'emoji', 'Male scientist emoji 👨‍🔬 next to a sentence about Marie Curie.', '👩‍🔬', 'high', 'picture_mismatch', 'low')
add(435, 'emoji', 'Male singer emoji 👨‍🎤 but the example is "She\'s my favorite singer."', '👩‍🎤', 'high', 'picture_mismatch', 'low')
add(34, 'emoji', 'Male teacher emoji 👨‍🏫 but the example is "My mom teaches me how to cook."', '👩‍🍳 or 👩‍🏫', 'medium', 'picture_mismatch', 'low')
add(943, 'emoji', 'Picture shows the alphabet sense (A) but the example uses letter = 信 (mail). vocab_all.js already uses ✉️.', '✉️', 'medium', 'picture_sense_conflict', 'low')
add(116, 'emoji', 'vocab_all.js picture 🆓 means free-of-charge (免费) but the example is "Birds are free in the sky." (自由).', '🕊️ or 🐦', 'medium', 'picture_sense_conflict', 'low', 'vocab_all.js only (island uses an SVG)')
add(161, 'emoji', '🗣️ is "speaking head", not "head".', '🙂 / 👤', 'low', 'picture_weak', 'low')
add(12, 'emoji', '🚿 shower for "Wash your hands".', '🧼 / 🙌', 'low', 'picture_weak', 'low')
add(170, 'emoji', '💋 is a kiss/lipstick mark, odd for a children\'s "lip" card.', '👄', 'low', 'picture_weak', 'low')
add(319, 'emoji', 'Bald-man emoji used only to differentiate "stepfather"; with stepmother also bald this can read as mocking.', '👨 + 👦 or a neutral family icon', 'low', 'picture_weak', 'low')
add(320, 'emoji', 'Bald-woman emoji for "stepmother".', '👩 + 👧', 'low', 'picture_weak', 'low')
add(431, 'emoji', '👷 construction worker for "software engineer".', '🧑‍💻 (Emoji 12.1) or 💻', 'low', 'picture_weak', 'low')
add(875, 'emoji', '⛵ sailboat for "We rowed a small boat".', '🚣', 'low', 'picture_weak', 'low')
add(887, 'emoji', 'SVG shows ✈ for a bus-passenger sentence.', 'bus icon', 'low', 'picture_weak', 'low')
add(648, 'emoji', '🙊 (speak-no-evil = keep quiet) contradicts "admit" (= say you did it).', '🙋 / 🙇', 'low', 'picture_weak', 'low')
add(339, 'emoji', 'Picture is a round cabbage (卷心菜) – correct for "cabbage", but contradicts cn 白菜 (fix cn, keep picture).', 'keep picture; fix cn', 'high', 'picture_sense_conflict', 'medium')
newemoji = {'🥹': ('14.0', 'sensitive'), '🛝': ('14.0', 'playground'), '🪪': ('14.0', 'citizen'), '🛖': ('13.0', 'village'), '🪖': ('13.0', 'soldier'), '🪞': ('13.0', 'mirror'), '🪟': ('13.0', 'window'), '🪨': ('13.0', 'stone'), '🪴': ('13.0', 'soil'), '🫁': ('13.0', 'oxygen'), '🫂': ('13.0', 'relative')}
for e, (ver, w) in newemoji.items():
    r = next(x for x in rows if x['en'] == w)
    add(r['id'], 'emoji', f'Emoji {e} is Unicode Emoji {ver}; WeChat\'s in-app browser draws emoji with the phone\'s system font, so on phones older than Android 11 / iOS 14.2 (13.0) or Android 12L / iOS 15.4 (14.0) it shows as an empty box – the word card loses its picture.', 'older emoji or the app\'s own WebP icon (like the food icons)', 'medium', 'picture_compat', 'medium', 'needs a real old-phone check; headless Chromium cannot show this')

# ---------------- content / appropriateness ----------------
add(215, 'ex', 'Describes a religious practice as the child\'s own routine; Chinese school materials follow 教育与宗教相分离 — a descriptive sentence avoids the issue.', 'There is an old church in the town.  (exCn: 镇上有一座古老的教堂。)', 'low', 'content_sensitive', 'low', AUDIO_NOTE_CLASSIC)
add(738, 'ex', 'Factually wrong for the audience (children cannot vote; voting is 18+).', 'Every citizen should obey the law.  (exCn: 每个公民都应该遵守法律。)', 'medium', 'example_fact', 'low')
add(505, 'ex', 'Gender stereotype (nurse = she) – the job island also shows 👩‍⚕️ nurse vs 👨‍⚕️ doctor.', "She's a doctor at the hospital.  (exCn: 她是医院的医生。)", 'low', 'content_stereotype', 'low')
add(840, 'ex', 'Teaches a negative attitude to the school week.', 'Monday is the first day of the school week.  (exCn: 星期一是一周上学的第一天。)', 'low', 'content_tone', 'low')
for rid in [421, 422, 423, 425, 428, 429, 437, 441, 442]:
    add(rid, 'emoji', 'Job pictures are almost all male (doctor 👨‍⚕️, teacher 👨‍🏫, firefighter 👨‍🚒, farmer 👨‍🌾, cook 👨‍🍳, artist 👨‍🎨, pilot 👨‍✈️, astronaut 👨‍🚀, scientist 👨‍🔬, singer 👨‍🎤) while nurse is the female one (👩‍⚕️).', 'alternate genders or use 🧑‍ (gender-neutral, Emoji 12.1 – check old phones)', 'medium', 'content_stereotype', 'low')


# ---------------- stale copies in spelling_bee.html ----------------
import subprocess
sbdiff = subprocess.run(['node', B + 'scripts/extra_sources.mjs'], stdout=subprocess.PIPE, text=True).stdout
for ln in sbdiff.splitlines():
    ln = ln.strip()
    if ln.startswith('["') and '"ex"' in ln:
        en, landk, f, sbv, islv = json.loads(ln)
        r = next(x for x in rows if x['en'] == en and x['island'] == 'season')
        line = next(l for l, i in SBL[en] if i == landk)
        out.append(dict(id=r['id'], file=f'spelling_bee.html:{line}', also_change='(Spelling Bee WORDS copy only)', island=landk, word=en, field='ex+exCn',
                        current=sbv, problem=f'Spelling Bee keeps an OLD example for this word; the island card (and its recorded audio) now uses 「{islv}」. The two screens teach different sentences/translations for the same word.',
                        proposed=islv + '  (exCn: ' + r['exCn'] + ')', confidence='high', category='data_mismatch_copy', severity='medium',
                        notes='regenerate spelling_bee.html WORDS from island data instead of keeping a hand copy'))

# ---------------- structural (not one word) ----------------
S_ = []
def st(file, problem, proposed, confidence, category, severity, evidence):
    S_.append(dict(id='S', file=file, also_change='', island='(structure)', word='(many)', field='-', current=evidence, problem=problem, proposed=proposed,
                   confidence=confidence, category=category, severity=severity, notes=''))
st('land_template.html:1906-1910 (shared by island_land1..8.html)', '听音辨义 level lists are hard-coded with 40 words of land1/land2 (情绪/性格) and copied into all 8 land islands. LISTEN_LEVEL_IDX keeps only words found in the island: land1 10/11/9 of 30, land2 3/2/5, land3–land8 0/0/0. In land3–8 the cards say "📚 0 个单词" and tapping a level throws "Cannot read properties of undefined (reading \'en\')" – the game is dead for 180 words.',
   'Build LISTEN_LEVELS from allW by length, exactly like CLOZE_LEVELS already does in the same template (easy ≤7 letters / medium 8 / hard 9+).', 'high', 'level_lists_broken', 'high',
   'shots/t1_land3_listen_levels.png, shots/t1_land_listen.json (land3/land8 errorsAfterTap)')
st('island_land1..8.html category labels + <title> (land_data.json slots 0/3/4)', 'Land islands take consecutive 30-word chunks of the 星海 list, which is grouped in 20-word topics, so island themes/labels do not match their words: land1 "情绪 Ⅱ" holds 10 personality words (polite…selfish); land2 "性格品质" holds 20 descriptive adjectives (important, modern, famous, convenient…); land3 "表达 Ⅱ" starts with 5 time words (seldom, regularly, decade, period, schedule); land4 "思考 Ⅰ" ends with 5 action verbs (attempt, avoid, prevent, provide, produce); land5 "逻辑 Ⅱ" starts with 5 quantity words; land6 "学习 Ⅰ" starts with 10 connectors (especially…fortunately); land7 "社会生活" holds 10 science words (energy…material); land8 "自然科学" holds 20 work/career words (career…colleague).',
   'Re-chunk the 240 words along the 星海 topics (12 topics × 20 = 240 → e.g. 1.5 topics per land, labels "情绪·心情 / 性格·品格 Ⅰ" …) or rename each land category to what it contains. Changing chunks does not touch audio.', 'high', 'theme_assignment', 'medium', 'island_season.html category list vs island_landN.html categories (see data/master.tsv)')
st('hansen_audio_lock.py:_parse_island (regex for __ISLAND_LOCAL_AUDIO)', 'The audio lock only parses unquoted keys (key:\'words/..\'); quoted keys (\'post office\':… / "chair": …) are skipped, so for 8 words the lock records and fingerprints a file the game never plays: post office→word_01.mp3 (game plays post_office.mp3), police station→word_02 (police_station), fire station→word_03 (fire_station), gloves→gloves.mp3 (gloves_clothes), cap→cap.mp3 (cap_clothes), chair→chair.mp3 (chair_home), when→when.mp3 (when_treasure), hard→hard.mp3 (hard_treasure). The guard therefore does not protect the real files of these words.',
   'Evaluate the object literal (e.g. json5 / node) or accept quoted keys in the regex, then --rebuild the lock.', 'high', 'audio_lock_blindspot', 'medium', 'out/audio_resolution.json (lock_w vs w)')
st('words/', '13 audio files are played by nothing (not by any island, not by Spelling Bee): words/bed.mp3, word_04, word_05, word_06, word_07, word_09, word_15, word_19, word_20, word_21, word_23, word_24, word_25 .mp3 – dead weight and a trap for future edits.', 'delete or document; rebuild lock', 'high', 'audio_unused', 'low', 'out/audio_resolution.json + spelling_bee.html speak() resolution + ls words/')
st('spelling_bee.html speak() (line ~1931) vs island __ISLAND_LOCAL_AUDIO', 'Spelling Bee resolves word audio from WORD_MAP / words/<word>.mp3 and ignores the islands\' local overrides, so for 14 words a child hears a different recording in Spelling Bee than on the island: cook (cook.mp3 vs cook_action.mp3), turn, have, stop, fish, post office (word_01.mp3 vs post_office.mp3), police station (word_02), fire station (word_03), gloves, cap, orange, chair, firefighter (word_17.mp3 vs firefighter.mp3), singer (word_18.mp3 vs singer.mp3). All files exist (no TTS fallback).', 'one shared resolver (island map first) for every page; then drop the duplicates', 'high', 'audio_inconsistent', 'low', 'scripts audit: island resolution vs spelling-bee resolution')
st('all exCn (152 of 952 sentences)', 'Chinese translations mix half-width ASCII punctuation (, ? ! ;) with full-width 。 – e.g. 「别懒了,起床!」. Chinese text should use ，？！；. No entry uses full-width ，？！ at all.', 'mechanical replace inside exCn/cn (also update the matching HIGHLIGHT_MANUAL keys, which embed exCn text)', 'high', 'zh_punctuation', 'low', 'counts: exCn "," 79, "?" 58, "!" 22; cn ";" 14')
st('highlight_helper.js HIGHLIGHT_MANUAL', '53 of 107 manual highlight entries point at example translations that no longer exist (e.g. "wake|起床啦,已经天亮了!", "more|能再来点米饭吗?") – leftovers from earlier example rewrites; they hide nothing now but show the examples were rewritten without updating dependants.', 'drop stale keys; add the 12 wrong / 15 partial highlights listed above', 'high', 'highlight_stale', 'low', 'out/highlight_eval.json + scripts/highlight_check.mjs')
st('all word data', 'There is no part-of-speech field anywhere (entries have en/pn/cn/emoji/ex/exCn only). Words that change class across islands (cook v./n., answer v./n., clean v./adj., hard adj./adv., second 第二/秒) or within 星海 (comfort, comment, review, increase, project) are only distinguishable by the Chinese.', 'add pos (v./n./adj./adv./prep./conj./pron.) and show it on the word card', 'high', 'pos_missing', 'low', 'data/master.json')
st('family / food / home example sentences', 'Gender-role pattern: 10 of 16 sentences about mom/grandma are cooking, baking, knitting or gardening (#34 #43 #229 #245 #294 #304 #306 #351 #353 #360 #383 #386); sentences about dad are office/work/tie/car/repair/coffee (#98 #214 #247 #358 #663 #863), with one counter-example (#14 "My dad cooks dinner every Sunday").', 'swap 2–3 roles, e.g. "My dad bakes the best cookies." / "Mom fixed my bike."', 'medium', 'content_stereotype', 'low', 'data/master.tsv')
st('template.html cloze (nextClozeQ) + listen same-level distractor loops', 'Distractors drawn from the same level are de-duplicated by English only (opts.find(o=>o.en===c.en)); the v915 Chinese de-dup is applied only to the random top-up. Result: identical Chinese options (rarely/seldom 很少 …) and grammatical synonyms (however/nevertheless …) can appear together – see the cloze_ambiguous rows.', 'apply the same cn check (and a synonym list) in the same-level loop', 'high', 'distractor_logic', 'medium', 'template.html:6501 (listen) and :6955 (cloze); land_template.html:6314 and :6794')
st('sentences/sentence_0029, 0152, 0207, 0338, 0341, 0606, 0634 .mp3', '7 classic example-sentence files end with a truncated/corrupt last MP3 frame (ffmpeg "Header missing"; packets=N, decoded frames=N-1). Audio content is intact (decoded length = probed length minus one ~24 ms frame); strict decoders may log errors.', 'Re-encode these 7 files (ffmpeg -i in.mp3 -c:a libmp3lame ...) and rebuild hansen_audio_lock.json', 'high', 'audio_file_damage', 'low', 'out/asr_report.json ffmpeg_errors; ffprobe packet/frame counts')
st('sentences/*.mp3 (709) vs words/*_ex_season.mp3 (240) vs words/*.mp3', 'Loudness (RMS, dBFS): classic example sentences median -21.5 (p5 -23.5), 星海 example sentences median -15.5, single words median -17.2. Moving from a classic island to 星海 the example voice jumps ~6 dB louder; classic sentences are ~4 dB quieter than their own words. (Extends optimize/REPORT.md #16.)', 'loudness-normalise all three sets to one target (e.g. -16 LUFS) in one pass', 'high', 'audio_loudness', 'low', 'out/asr_report.json rms_*')
st('words/clean.mp3, words/use.mp3, words/her.mp3, words/house.mp3', 'clean.mp3 is 2.32 s for one syllable: after the word there is a second audible sound at 1.83–2.31 s (RMS -25 dBFS, peak -9 dBFS). use.mp3 contains two separate full-length utterances (0.04–0.72 s and 0.87–1.51 s) – possibly the word said twice. her.mp3 has an extra blip at 0.95–1.09 s. house.mp3 starts only after 0.9 s and is the quietest word file (RMS -23.7 dBFS vs median -17.2).', 'listen; trim / re-record', 'medium', 'audio_artifact', 'low', 'out/extra_sounds.json, out/two_utterances.json, scripts/segdecode.py output')
st('all 945 word + 949 sentence audio files (offline ASR, CMU PocketSphinx US model)', 'Content check by speech recognition: 571/949 sentence clips recognised word-for-word, median WER 0; no sentence clip matches another example better than its own (5 candidates inspected = recogniser confusions like sky/guy, sea/seat). Word clips: 879/945 recognised as the expected word against their island vocabulary; the 66 others are mostly short monosyllables where this recogniser is unreliable – NOT confirmed defects, but they are the list to spot-listen first.', 'human listening pass over out/asr_words_island.json (ok=false rows)', 'medium', 'audio_asr_screen', 'low', 'out/asr.jsonl, out/asr_report.json, out/asr_words_island.json, out/asr_2way.json')
for x in S_: out.append(x)

# write
os.makedirs(B, exist_ok=True)
json.dump(out, open(B + 'flagged_entries.json', 'w'), ensure_ascii=False, indent=1)
with open(B + 'flagged_entries.csv', 'w', newline='', encoding='utf-8-sig') as fo:
    w = csv.DictWriter(fo, fieldnames=list(out[0].keys()))
    w.writeheader()
    for o in out: w.writerow(o)
tot = collections.Counter(o['category'] for o in out)
sev = collections.Counter((o['severity']) for o in out)
conf = collections.Counter(o['confidence'] for o in out)
summary = dict(entries=len(out), by_category=dict(sorted(tot.items(), key=lambda x: -x[1])), by_severity=dict(sev), by_confidence=dict(conf))
json.dump(summary, open(B + 'flagged_summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False, indent=1))
