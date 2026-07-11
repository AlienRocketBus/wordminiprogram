/* ⭐v917 例句真人音频映射表 (Hansen 录制)
 * key   = 【规范化后的例句】(只留字母和空格·小写) —— 撇号/逗号/句号差异都能命中, 不怕标点变体
 * value = words/<单词>_ex_season.mp3
 * 240 个词共用同一套例句(赛季岛与 8 个星域岛已逐字对齐·v916 守卫钉死), 所以一条音频全岛通用。
 * speak() 里给【句子】加了本地音频优先级: 命中就播真人, 没命中自动回落 TTS —— 所以未配音的词照常能读。
 * 进度: 已配 30 / 240 条。 */
window.__HANSEN_EX_AUDIO = {
  "i always feel nervous before a big exam": "words/nervous_ex_season.mp3",
  "she felt anxious while waiting for the test results": "words/anxious_ex_season.mp3",
  "the children were curious about how the magnet worked": "words/curious_ex_season.mp3",
  "my parents were proud of me when i won the prize": "words/proud_ex_season.mp3",
  "im so grateful for all the help youve given me": "words/grateful_ex_season.mp3",
  "he was disappointed that the trip had been cancelled": "words/disappointed_ex_season.mp3",
  "she felt embarrassed when she forgot his name": "words/embarrassed_ex_season.mp3",
  "the little boy was frightened by the loud thunder": "words/frightened_ex_season.mp3",
  "the customers were satisfied with the quality of the meal": "words/satisfied_ex_season.mp3",
  "i was completely confused by the complicated instructions": "words/confused_ex_season.mp3",
  "he felt lonely after all his friends moved away": "words/lonely_ex_season.mp3",
  "she was jealous of her sisters new bike": "words/jealous_ex_season.mp3",
  "after the exam i finally felt relaxed": "words/relaxed_ex_season.mp3",
  "he was ashamed of having lied to his mother": "words/ashamed_ex_season.mp3",
  "the students were eager to start the new project": "words/eager_ex_season.mp3",
  "i felt miserable when i was sick in bed all week": "words/miserable_ex_season.mp3",
  "she was delighted to hear that she had passed": "words/delighted_ex_season.mp3",
  "dad was furious when he saw the broken window": "words/furious_ex_season.mp3",
  "we were amazed by the beautiful view from the top": "words/amazed_ex_season.mp3",
  "she gave me a hug to comfort me": "words/comfort_ex_season.mp3",
  "its polite to say thank you when someone helps you": "words/polite_ex_season.mp3",
  "even after becoming famous he stayed humble": "words/humble_ex_season.mp3",
  "my little brother is too stubborn to admit hes wrong": "words/stubborn_ex_season.mp3",
  "shes a reliable friend who always keeps her word": "words/reliable_ex_season.mp3",
  "be cautious when you cross this busy road": "words/cautious_ex_season.mp3",
  "despite the setback she remained optimistic about the future": "words/optimistic_ex_season.mp3",
  "please accept my sincere apology for being late": "words/sincere_ex_season.mp3",
  "a dog is a loyal companion that never leaves your side": "words/loyal_ex_season.mp3",
  "our maths teacher is very strict about homework": "words/strict_ex_season.mp3",
  "it was selfish of him to keep all the snacks for himself": "words/selfish_ex_season.mp3"
};
/* 单词 → 例句音频 (备用查法) */
window.__HANSEN_EX_AUDIO_BY_WORD = {
  "nervous": "words/nervous_ex_season.mp3", "anxious": "words/anxious_ex_season.mp3", "curious": "words/curious_ex_season.mp3", "proud": "words/proud_ex_season.mp3", "grateful": "words/grateful_ex_season.mp3", "disappointed": "words/disappointed_ex_season.mp3", "embarrassed": "words/embarrassed_ex_season.mp3", "frightened": "words/frightened_ex_season.mp3", "satisfied": "words/satisfied_ex_season.mp3", "confused": "words/confused_ex_season.mp3", "lonely": "words/lonely_ex_season.mp3", "jealous": "words/jealous_ex_season.mp3", "relaxed": "words/relaxed_ex_season.mp3", "ashamed": "words/ashamed_ex_season.mp3", "eager": "words/eager_ex_season.mp3", "miserable": "words/miserable_ex_season.mp3", "delighted": "words/delighted_ex_season.mp3", "furious": "words/furious_ex_season.mp3", "amazed": "words/amazed_ex_season.mp3", "comfort": "words/comfort_ex_season.mp3", "polite": "words/polite_ex_season.mp3", "humble": "words/humble_ex_season.mp3", "stubborn": "words/stubborn_ex_season.mp3", "reliable": "words/reliable_ex_season.mp3", "cautious": "words/cautious_ex_season.mp3", "optimistic": "words/optimistic_ex_season.mp3", "sincere": "words/sincere_ex_season.mp3", "loyal": "words/loyal_ex_season.mp3", "strict": "words/strict_ex_season.mp3", "selfish": "words/selfish_ex_season.mp3"
};
