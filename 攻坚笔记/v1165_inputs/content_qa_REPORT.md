# 单词大冒险 v1163 · Teaching-content correctness audit (content-qa)

## 给老师看的大白话总结

- **查了什么**：27 个岛上所有的词（1192 条，其中不同的内容 952 条：普通岛 712 条，星海/单词大陆 240 条），首页复习用的 vocab_all.js，拼写蜂页面和星域地图里的两份副本，还有 1894 个读音和例句录音。
- **大部分内容是好的**：
  - 没有发现拼错的英文单词。
  - 音标统一用英式（牛津词典那一套）。
  - 每个词都有音标、中文、例句和例句翻译。
  - 没有暴力和成人内容。
  - 所有读音都是本地录音，一个不缺。
  - 用语音识别回听了 949 条例句录音，说的都是对应的那句话，没有发现放错句子的情况。

### 必须改的 3 个
1. **单词大陆 ③–⑧ 号岛的「听音辨义」完全不能玩。**
   - 三个难度都显示「0 个单词」，孩子一点就没反应（程序报错）。
   - ① 号岛 30 个词只能练到 10/11/9 个，② 号岛只有 3/2/5 个。
   - 原因：8 个岛共用一张写死的词表，表里只有 ①② 号岛的词。
2. **August（八月）的音标写错了。** 写成了 /ɔːˈɡʌst/，这是形容词「庄严的」的读法。八月应该是 /ˈɔːɡəst/。
3. **例句语法错。** 「Wait for me ten minutes.」应改为「Please wait ten minutes for me.」，这句要重新录音。

### 应该改的（会让孩子学错或困惑）
- **中文意思不对或有歧义**：
  - cabbage 写「白菜」，但图片是卷心菜。
  - sheep 只写「羊」，而同一个岛里 goat 是「山羊」，孩子分不清。
  - skirt 写「短裙」，其实就是「裙子」。
  - assume 写「假设」，但例句的意思是「想当然地认为」。
- **翻译错**：「set the table」两次被翻成「摆桌子」，正确是「摆好碗筷/餐具」。
- **完形填空的金色高亮标错 12 处**：
  - frightened、available 高亮的都是「的」。
  - galaxy 高亮的是「太阳系」的「系」。
- **48 个词永远出不了完形填空题**：例句里用的是 cooks、grapes、flown 这类变形，程序只认原形。身体岛初级 20 个词里有 8 个被跳过。
- **完形填空大小写错**：显示成「I have a cat. it is white.」和「Happy New year!」。
- **近义词会同时当选项**（星海岛）：比如 however/nevertheless、rarely/seldom。孩子选了同样正确的近义词，会被判错。
- **同一个岛里 6 组词中文完全一样**：比如 rarely/seldom 都是「很少」，invent/invention 都是「发明」。汉译英时等于有两个正确答案。
- **单词大陆 8 个岛的主题和词对不上**：
  - ⑧号「自然科学」岛里有 20 个是职场词（career、salary、colleague…）。
  - ⑦号「社会生活」岛里有 10 个科学词。
  - ②号「性格品质」岛里有 20 个形容事物的词（modern、famous…）。
- **拼写蜂页面里 25 个词的例句还是旧版本**，和岛上的不一样。
- **同一个词两种拼法**：人物岛写 neighbour（英式），星海写 neighbor（美式）。
  - 全游戏大多是美式拼写（color、favorite、mom、math），但也夹着 centre、maths 这样的英式拼写。
  - 需要老师定一个标准。
- **例句不合常识或不合年龄**：
  - 「A whale is the largest animal on Earth.」——只有蓝鲸是最大的。
  - 「School starts at six.」——学校六点上课不合常理。
  - 「I'm in grade seven」——孩子才 7–10 岁。
  - 「Every citizen has the right to vote.」——未成年人没有选举权。
- **11 个比较新的 emoji 在旧手机的微信里可能显示成空方框**，单词卡就没有图了。比如 playground 🛝、window 🪟、mirror 🪞、soldier 🪖。这一条需要真机确认。

### 可以顺手改的
- **几张图和意思不符**：
  - grade 的图画的是「A+ 成绩」，不是「年级」。
  - 春节传统的例句配的是日本人偶 🎎。
  - 居里夫人的例句配的是男科学家 👨‍🔬。
- **职业 emoji 几乎全是男性**，只有护士是女性。
- **妈妈和奶奶的例句大多是做饭、织毛衣。**
- **152 句中文翻译用了英文半角标点**（, ? !）。
- **录音方面**：
  - 8 个词的「发音锁」锁错了文件，游戏实际播放的文件没有被保护。
  - 拼写蜂页面里有 14 个词播的录音和岛上不是同一个。
  - 7 个例句 mp3 最后一帧损坏，听不出来。
  - 普通岛的例句比星海的例句轻大约 6 分贝。
  - clean、use、her、house 这 4 个单词录音里有多余的声音或开头空白，建议人工听一下。

**详细清单**：每条问题的位置（文件:行号）、现在的内容、建议改成什么、把握程度，都在 `/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/flagged_entries.csv`（247 行，Excel 可以直接打开）。

---

## 1. Scope and method

### Data sources and cross-checks

| Source | Entries | Cross-check result |
|---|---|---|
| island_*.html `DATA` (27 pages) | 1192 = 712 classic (18 islands) + 240 星海 + 8×30 land | land1–8 match 星海 **field for field** (0 diffs) |
| vocab_all.js | 712 entries in 18 groups | en/pn/cn/ex/exCn identical for all 712; only the pictures differ (143, already known) |
| island_data.json / land_data.json (generator sources) | 1192 | 0 diffs, so **fixes must be made here** or generate.py will revert them |
| spelling_bee.html `var WORDS` (line 662) | 936 | **25 stale ex/exCn**; pn and cn identical |
| land_map.html:114 | 240 (en/pn/cn) | identical |
| word_map.js, sentence_map.js, hansen_ex_audio.js, island `__ISLAND_LOCAL_AUDIO`, hansen_audio_lock.json | 945 word files + 949 sentence files | 0 missing files; lock blind spot (see 3.12) |

- **Duplicate words**: 16 classic words appear in two islands with different senses, all of them legitimate: clean, cook, answer, turn, stop, hard, right, fish, chicken, orange, second, chair, teacher, driver, when, map.

### Methods
- **IPA**
  - Character inventory check: proper ɡ U+0261, ː, ˈ ˌ; no ASCII substitutes.
  - Automatic comparison with the CMU Pronouncing Dictionary: syllable count, primary-stress position, consonant skeleton and vowel classes.
  - Manual read of all 952 records.
  - Conclusion: the IPA follows the British OALD convention.
- **Spelling**
  - Every English token was checked against a 160k-word list plus the CMU dictionary. Only "km" and "maths" were unknown.
  - A US/UK variant scan with about 150 word pairs.
- **Manual review** of every record: en, pn, cn, ex, exCn and picture.
- **Runtime-faithful checks**
  - The exact cloze regex run over every example.
  - smartHighlight() run over every entry.
  - Level word lists compared with each island's DATA.
  - Playwright at 390×844 (isMobile, hasTouch, service workers blocked, external requests aborted) for land 听音辨义 and cloze rendering.
- **Audio**
  - Resolution identical to `speak()`, and to the Spelling Bee `speak()`.
  - Full ffmpeg decode of 1894 files: duration, RMS, peak, silence, decode errors, extra segments.
  - Offline speech recognition with CMU PocketSphinx 5.1.1 and its bundled US model:
    - free decoding of each sentence, scored by WER;
    - per-island closed-grammar recognition of each word clip.

## 2. Totals per problem type (247 rows)

| Category | Rows |
|---|---:|
| cloze_skipped | 48 |
| data_mismatch_copy (Spelling Bee) | 25 |
| highlight_partial | 15 |
| cn_format | 14 |
| cloze_ambiguous | 14 |
| cn_duplicate_in_island | 13 |
| highlight_wrong | 12 |
| picture_compat | 11 |
| content_stereotype | 11 |
| picture_weak | 9 |
| spelling_inconsistent | 8 |
| example_unnatural | 7 |
| excn_unnatural | 6 |
| picture_mismatch | 5 |
| ipa_inconsistent, cn_incomplete, example_grammar, picture_sense_conflict | 4 each |
| cn_wrong, cn_unnatural, excn_wrong, example_sense_conflict, example_fact, cloze_case | 2 each |
| ipa_wrong, cn_ambiguous, cn_sense_conflict, excn_mismatch, example_unclear, example_age, content_sensitive, content_tone | 1 each |
| Structural rows (level_lists_broken, theme_assignment, audio_lock_blindspot, audio_unused, audio_inconsistent, zh_punctuation, highlight_stale, pos_missing, distractor_logic, audio_file_damage, audio_loudness, audio_artifact, audio_asr_screen) | 13 |

- **By severity**: 3 high, 141 medium, 103 low.
- **By confidence**: 130 high, 93 medium, 24 low.

## 3. Top issues

### 3.1 [HIGH] 单词大陆 ③–⑧ 听音辨义 is dead; ①② only partly covered
- **Cause**: `land_template.html:1906-1910` hard-codes 40 land1/land2 words for all 8 land pages.
- **Measured coverage**:
  - land1: 10/11/9 of 30 words.
  - land2: 3/2/5.
  - land3–8: 0/0/0.
- **What the child sees** (verified in land3 and land8): the cards say 「📚 0 个单词」, and tapping a level throws `Cannot read properties of undefined (reading 'en')`.
- **Evidence**: `shots/t1_land_listen.json`, `shots/t1_land3_listen_levels.png`.
- **Fix**: build the levels from `allW` by word length, the same way `CLOZE_LEVELS` already does at land_template.html:6746.

### 3.2 [HIGH] August IPA
- **Where**: `island_time.html:1954`. The same value is in vocab_all.js `wordIslandTime[31]`, spelling_bee.html:1268 and island_data.json[time].
- **Now**: `/ɔːˈɡʌst/` (the adjective *august*).
- **Fix**: **`/ˈɔːɡəst/`**.

### 3.3 [HIGH] Ungrammatical example
- **Where**: `island_time.html:1919`.
- **Now**: "Wait for me ten minutes."
- **Fix**: **"Please wait ten minutes for me."** / 请等我十分钟。
- **Note**: this needs a new recording, because SENTENCE_MAP is keyed by the exact text.

### 3.4 [MED] 48 words never reach 完形填空 or Boss 完形
- **Cause**: the example contains only an inflected form. Full list:
  - Verbs: cooks, flown, drew, teaches, got, started, drives, snows.
  - Animals: cows, pigs, ducks, eagles.
  - Body: eyes, ears, lips, arms, elbows, hands, legs, heels, bones.
  - Food: grapes, strawberries, vegetables, tomatoes, potatoes, carrots, onions, cookies.
  - Other: sleeves, thousands, siblings, relatives, firefighters, farmers, artists, stars, clouds, flowers, computers, sports, minutes, hours, Saturdays, holidays, tickets, passengers, things.
- **Code path**: `nextClozeQ` (template.html:6931) skips them silently. For example, 身体岛初级 asks 12 of the 20 words it counts.
- **Fix**: blank the inflected form in code, rather than re-recording 48 sentences.

### 3.5 [MED] Wrong gold highlight (12) and partial highlight (15)
- **Wrong highlights**:
  - frightened → 的
  - confused → 的
  - cautious → 的
  - ordinary → 的
  - available → 的
  - valuable → 有
  - galaxy → 系 (from 太阳系)
  - constantly → 不
  - previously → 前 (from 之前)
  - fly → 飞机
  - determined → 定
  - natural → 然的
- **Evidence**: `shots/t2_season_frightened_question.png`, `shots/t2_cloze.json`.
- **Also affected**: Boss 完形 uses the same function (template.html:4764).
- **Fix**: add exact HIGHLIGHT_MANUAL values (listed in the CSV), e.g. `"frightened|小男孩被巨大的雷声吓到了。":"吓到"`.
- **Stale data**: 53 of the 107 existing HIGHLIGHT_MANUAL keys point at example translations that no longer exist.

### 3.6 [MED] Chinese meaning and translation errors

| Word | Where | Now | Fix |
|---|---|---|---|
| cabbage | island_food.html:1936 | 白菜 (the photo is a round cabbage; `shots/food_icons_sheet.png`) | **卷心菜**; exCn 奶奶在花园里种卷心菜。 |
| sheep | island_animal.html:1929 | 羊 (goat = 山羊 on the same island) | **绵羊** |
| skirt | island_clothes.html:1927 | 短裙 | **裙子** |
| assume | island_season.html:2024 | 假设 | 认为/假定 |
| table | island_home.html:1939 | 我们摆桌子吃晚饭吧。 | **我们摆好碗筷准备吃晚饭吧。** |
| meanwhile | island_season.html:1989 | 你摆桌子,与此同时我来做晚饭。 | 你来摆碗筷,与此同时我来做晚饭。 |
| multiple | island_season.html:2064 | "The test has…" vs 这道题有… | ex "This question has multiple correct answers." |
| old | island_adjective.html:1940 | 年纪很老了 | 我爷爷年纪很大了。 |
| March | island_time.html:1949 | 春天三月开始 | 春天从三月开始。 |
| business, more, how, electricity | see CSV | unnatural Chinese | see CSV |

### 3.7 [MED] Land island themes don't match their words
- **Cause**: the land pages are consecutive 30-word chunks of the 星海 list, whose topics are 20 words each.
- **Mismatches**:
  - land1 「情绪 Ⅱ」 holds polite…selfish (personality words).
  - land2 「性格品质」 holds 20 descriptive adjectives.
  - land3 Ⅱ starts with 5 time words; land4 Ⅰ ends with 5 action verbs; land5 Ⅱ starts with 5 quantity words.
  - land6 「学习 Ⅰ」 holds 10 connectors.
  - land7 「社会生活」 holds 10 science words.
  - land8 「自然科学」 holds 20 career words.
- **Fix**: re-chunk along the 12 星海 topics, or rename the categories. There is no audio impact.

### 3.8 [MED] Spelling Bee copy has 25 stale examples
- **Where**: spelling_bee.html WORDS (line 662+), shown in the review overlay at :2263.
- **Words**: describe, realize, mention, admit, indicate, comment, debate, provide, produce, invent, destroy, repair, establish, manage, handle, perform, examine, calculate, stranger, customer, chemical, creature, particle, employee, colleague.
- **Fix**: generate WORDS from the island data instead of keeping a hand copy.

### 3.9 [MED] Cloze logic
- **Capitalisation bug**: only `index===0` gets a capital letter (template.html:6948, land_template.html:6787, Boss :4760). Captured results: "I have a cat. it is white." and "Happy New year!" (`shots/t2_cloze.json`).
- **Distractors are de-duplicated by English only** (template.html:6501, :6955; land_template.html:6314, :6794). So in 星海 these synonyms can be offered together, and a correct choice is marked wrong: however/nevertheless, therefore/consequently, besides/moreover/furthermore, rarely/seldom, immediately/instantly, finally/eventually, huge/enormous.
- **Identical Chinese inside one island**: rarely/seldom 很少, invent/invention 发明, succeed/success 成功, enormous/huge 巨大的, amount/quantity 数量, besides/moreover/furthermore 此外. Distinct glosses are proposed in the CSV.

### 3.10 [MED] US/UK spelling inconsistency
- **Convention in use**: American spelling and vocabulary with British IPA. American forms counted: color ×4, favorite ×11, mom ×10, math ×3, gray, pajamas, pants, sneakers, cookie, candy, truck, eraser, yogurt, -ize.
- **Exceptions**:
  - **neighbour (island_job.html:1926) vs neighbor (island_season.html:2121)**: the same word spelled two ways.
  - centre (island_city.html:1950, and "city centre").
  - maths ×2 vs headword math.
  - soccer vs football ⚽.
  - vacation vs holiday.
  - hard-working vs hardworking.

### 3.11 [MED] Example facts, age fit and naturalness
- whale (island_animal.html:1956) → "The blue whale is the largest animal on Earth."
- "School starts at six." → "I get up at six every morning."
- "grade seven" → "grade three".
- "July is summer vacation." → "Summer vacation starts in July."
- second: "in a second" is an idiom, not 秒 → "There are sixty seconds in a minute."
- citizen: "Every citizen has the right to vote." → "Every citizen should obey the law."
- Plus 9 low-severity grammar and naturalness items (listed in the CSV).
- Each changed sentence needs re-recording.

### 3.12 [MED] Audio lock guards the wrong files
- **Cause**: the `_parse_island` regex in hansen_audio_lock.py ignores quoted keys.
- **Effect**: for 8 words the lock fingerprints a file the game never plays: word_01/02/03.mp3, gloves.mp3, cap.mp3, chair.mp3, when.mp3, hard.mp3.
- **What the game actually plays**: post_office, police_station, fire_station, gloves_clothes, cap_clothes, chair_home, when_treasure, hard_treasure. None of these is in `lock.files`.

### 3.13 [MED] Emoji 13/14 pictures may show as empty boxes on older phones
- **Emoji 14.0**: sensitive 🥹, playground 🛝, citizen 🪪.
- **Emoji 13.0**: village 🛖, soldier 🪖, mirror 🪞, window 🪟, stone 🪨, soil 🪴, oxygen 🫁, relative 🫂.
- Needs a real-device check.

### 3.14 [LOW] Pictures and stereotypes
- **Pictures that conflict with the word or example**:
  - grade SVG shows "GRADE A+" (a score), not 年级.
  - tradition 🎎 (Japanese dolls) for a Spring Festival sentence.
  - famous 🗼 (Tokyo Tower) for the Eiffel Tower.
  - 👨‍🔬 next to Marie Curie; 👨‍🎤 with "She's…"; 👨‍🏫 with "My mom teaches…".
  - letter "A" with a mail example; 🆓 with "Birds are free".
- **Gender stereotypes**:
  - Job emojis are almost all male.
  - Mom and grandma sentences are mostly about cooking and knitting.
  - "She's a nurse".
- **Other**:
  - "We go to church every Sunday." (low-confidence judgement).
  - "I hate Monday mornings."
  - dinner.webp shows red wine.
  - yogurt.webp prints "YOGURT" (a spelling-game giveaway).

### 3.15 [LOW] Audio files
- **ASR**: 571 of 949 sentence clips were recognised word for word (median WER 0), and no clip matches another sentence better than its own. 879 of 945 word clips were confirmed; the 66 unconfirmed clips are a listening list, not defects (`out/asr_words_island.json`).
- **Damaged files**: 7 sentence mp3 files have a corrupt last frame.
- **Loudness** (RMS median): classic sentences −21.5 dBFS, 星海 examples −15.5, words −17.2.
- **Odd clips**: clean.mp3, use.mp3, her.mp3, house.mp3.
- **Spelling Bee** plays different recordings than the islands for 14 words.
- **Unused**: 13 files are played by nothing.

### 3.16 [LOW] Typography and IPA consistency
- **Punctuation**: 152 exCn use half-width punctuation.
- **Separators**: 14 cn use ";" while the classic set uses "/".
- **IPA**:
  - hour should be /ˈaʊə/ (with a stress mark, like "our").
  - post office should be /ˈpəʊst ɒfɪs/.
  - air conditioner should be /ˈeə kəndɪʃənə/.
  - ice cream should be /ˌaɪs ˈkriːm/.
- **Part of speech**: there is no POS field anywhere.

## 4. Verified OK (keep)
- No misspellings.
- The IPA symbol set is clean and consistent.
- Every entry is complete.
- The four data copies agree, except Spelling Bee's 25 stale examples.
- 0 audio fallbacks to network or TTS.
- Sentence audio matches its text.
- No violent or adult content.

## 5. How to apply fixes
1. Edit the generator sources (island_data.json, land_data.json) and regenerate the pages.
2. Mirror the same change into vocab_all.js, spelling_bee.html WORDS and land_map.html.
3. If you change an `ex` sentence:
   - re-record its audio, because the SENTENCE_MAP / `__HANSEN_EX_AUDIO` key is the sentence text;
   - then rebuild hansen_audio_lock.json.
4. If you change an exCn, update the matching HIGHLIGHT_MANUAL keys.
5. If you change a headword (neighbour, centre), also rename its audio-map key.

## 6. Files
- **Main outputs**: `flagged_entries.csv` / `flagged_entries.json` (247 rows: id, file:line, also_change, word, field, current, problem, proposed, confidence, category, severity, notes), `flagged_summary.json`.
- **Data**: `data/master.tsv` (all 952 records), `data/*.json`.
- **Results**: `out/`.
- **Screenshots**: `shots/`.
- **Scripts**: `scripts/`, `pw/`.
