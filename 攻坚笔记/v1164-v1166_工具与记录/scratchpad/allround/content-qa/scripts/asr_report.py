# Summarise the ASR pass: sentence WER distribution, possible swapped/mismatched sentence audio
# (hypothesis matches ANOTHER corpus sentence better than its own), and audio level/duration outliers.
import json, re, statistics, collections
B = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
rows = [json.loads(l) for l in open(B + 'out/asr.jsonl')]
def toks(s):
    s = s.lower().replace('’', "'")
    s = re.sub(r"[^a-z0-9' ]", ' ', s)
    return [t.strip("'") for t in s.split() if t.strip("'")]
def wer(r, h):
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]; d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1])); prev = cur
    return d[len(h)] / max(1, len(r))
sents = [r for r in rows if r['kind'] == 'sent']
words = [r for r in rows if r['kind'] == 'word']
corpus = sorted(set(e for r in sents for e in r['expected']))
ct = {c: toks(c) for c in corpus}
res = {'n_sent_clips': len(sents), 'n_word_clips': len(words)}
w = [r['wer'] for r in sents]
res['sent_wer_median'] = statistics.median(w)
res['sent_wer_mean'] = round(sum(w) / len(w), 3)
res['sent_wer_buckets'] = {k: sum(1 for x in w if lo <= x < hi) for k, lo, hi in [('0', 0, 1e-9), ('(0,0.25)', 1e-9, .25), ('[0.25,0.5)', .25, .5), ('[0.5,0.75)', .5, .75), ('>=0.75', .75, 99)]}
swaps = []
for r in sents:
    h = toks(r['hyp'])
    own = min(wer(ct[e], h) for e in r['expected'])
    best = min(corpus, key=lambda c: wer(ct[c], h))
    bw = wer(ct[best], h)
    if best not in r['expected'] and bw + 0.2 < own:
        swaps.append(dict(file=r['file'], expected=r['expected'][0], hyp=r['hyp'], own_wer=round(own, 2), better_match=best, better_wer=round(bw, 2)))
res['possible_swapped_sentence_audio'] = swaps
res['worst_sentences'] = [dict(file=r['file'], expected=r['expected'][0], hyp=r['hyp'], wer=r['wer'], dur=r['dur']) for r in sorted(sents, key=lambda r: -r['wer'])[:25]]
# words per second for sentences (speech rate outliers -> truncated / padded / wrong file)
rate = []
for r in sents:
    n = len(toks(r['expected'][0]))
    voiced = max(r['voiced'], 0.01)
    rate.append((n / voiced, r))
rs = sorted(x for x, _ in rate)
med = statistics.median(rs)
res['sent_words_per_voiced_sec_median'] = round(med, 2)
res['sent_rate_outliers'] = [dict(file=r['file'], expected=r['expected'][0], words_per_sec=round(x, 2), dur=r['dur'], voiced=r['voiced']) for x, r in rate if x > med * 1.8 or x < med / 1.8]
# levels
def lv(rs):
    v = [r['rms_db'] for r in rs]; return dict(median=statistics.median(v), p5=sorted(v)[int(.05 * len(v))], p95=sorted(v)[int(.95 * len(v))], min=min(v), max=max(v))
res['rms_words'] = lv(words)
res['rms_sentences'] = lv(sents)
res['rms_ex_season'] = lv([r for r in sents if r['file'].startswith('words/')])
res['rms_sentence_files'] = lv([r for r in sents if r['file'].startswith('sentences/')])
res['quiet_sentences'] = [dict(file=r['file'], rms=r['rms_db'], expected=r['expected'][0]) for r in sents if r['rms_db'] < res['rms_sentences']['median'] - 6]
res['long_lead_or_trail_sentences'] = [dict(file=r['file'], lead=r['lead'], trail=r['trail'], dur=r['dur']) for r in sents if r['lead'] > 0.6 or r['trail'] > 1.0]
res['empty_or_tiny'] = [dict(file=r['file'], dur=r['dur'], voiced=r['voiced']) for r in rows if r['dur'] < 0.3 or r['voiced'] < 0.2]
res['ffmpeg_errors'] = [dict(file=r['file'], err=r['ffmpeg_err']) for r in rows if r['ffmpeg_err']]
res['clipped'] = [dict(file=r['file'], peak=r['peak_db']) for r in rows if r['peak_db'] is not None and r['peak_db'] > -0.3]
# word ASR (closed 1,200-word grammar) – reported only as a noisy screen
res['word_grammar_match_rate'] = round(sum(1 for r in words if r['ok']) / len(words), 3)
json.dump(res, open(B + 'out/asr_report.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ('worst_sentences',)}, ensure_ascii=False, indent=1)[:6000])
