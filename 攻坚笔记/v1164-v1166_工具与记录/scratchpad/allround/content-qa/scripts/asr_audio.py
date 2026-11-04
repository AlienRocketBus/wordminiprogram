# Offline audio QA for the v1163 snapshot (read-only):
#  - decode every referenced mp3 to 16 kHz mono PCM with ffmpeg
#  - measure duration / peak / RMS / leading+trailing silence
#  - word clips: closed-vocabulary grammar recognition (all headwords) -> does the clip say the expected word?
#  - sentence clips: free LM recognition -> word error rate vs the expected example sentence
# Usage: venv/bin/python -I asr_audio.py <out.jsonl>
import json, os, re, subprocess, sys, time
import numpy as np
from pocketsphinx import Decoder, get_model_path

S = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
OUT = sys.argv[1]
MP = get_model_path()
EXTRA = {'pe': 'P IY IY', 'maths': 'M AE TH S', 'snowmen': 'S N OW M EH N', 'km': 'K EY EH M'}

res = json.load(open(B + 'out/audio_resolution.json'))

def norm_word(en):
    t = en.lower().replace('-', ' ')
    t = re.sub(r"[^a-z' ]", ' ', t)
    return re.sub(r'\s+', ' ', t).strip()

def toks(s):
    s = s.lower().replace('’', "'")
    s = re.sub(r"[^a-z0-9' ]", ' ', s)
    return [t.strip("'") for t in s.split() if t.strip("'")]

# clip lists
words = {}
for r in res:
    if r['w']:
        words.setdefault(r['w'], set()).add(norm_word(r['en']))
sents = {}
for r in res:
    if r['s']:
        sents.setdefault(r['s'], set()).add(r['ex'])
vocab = sorted(set(v for vs in words.values() for v in vs))

def pcm(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', S + path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return p.stdout, p.stderr.decode('utf-8', 'replace')[:300]

def stats(buf):
    a = np.frombuffer(buf, dtype=np.int16).astype(np.float32) / 32768.0
    if a.size == 0:
        return dict(dur=0, peak_db=None, rms_db=None, lead=None, trail=None, voiced=0)
    dur = a.size / 16000.0
    peak = float(np.max(np.abs(a)))
    rms = float(np.sqrt(np.mean(a * a)))
    fr = 160  # 10 ms frames
    n = a.size // fr
    e = np.sqrt(np.mean(a[:n * fr].reshape(n, fr) ** 2, axis=1)) if n else np.array([0.0])
    thr = 10 ** (-45 / 20)
    idx = np.where(e > thr)[0]
    if idx.size:
        lead = idx[0] * 0.01
        trail = (n - 1 - idx[-1]) * 0.01
        voiced = idx.size * 0.01
    else:
        lead = trail = dur
        voiced = 0.0
    db = lambda x: round(20 * np.log10(x), 1) if x > 0 else -999
    return dict(dur=round(dur, 3), peak_db=db(peak), rms_db=db(rms), lead=round(float(lead), 2), trail=round(float(trail), 2), voiced=round(float(voiced), 2))

def mkdec(**kw):
    d = Decoder(hmm=MP + '/en-us/en-us', dict=MP + '/en-us/cmudict-en-us.dict', loglevel='FATAL', **kw)
    for w, ph in EXTRA.items():
        try:
            d.add_word(w, ph, True)
        except Exception:
            pass
    return d

# grammar decoder for words
gram = '#JSGF V1.0;\ngrammar words;\npublic <w> = ' + ' | '.join(vocab) + ' ;\n'
gpath = B + 'out/words.gram'
open(gpath, 'w').write(gram)
wdec = mkdec(lm=MP + '/en-us/en-us.lm.bin')
wdec.add_jsgf_string('vocab', gram)
wdec.activate_search('vocab')
sdec = mkdec(lm=MP + '/en-us/en-us.lm.bin')

def decode(dec, buf):
    dec.start_utt()
    dec.process_raw(buf, False, True)
    dec.end_utt()
    h = dec.hyp()
    return (h.hypstr if h else ''), (h.score if h else None)

def wer(ref, hyp):
    r, h = ref, hyp
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(1, len(r))

t0 = time.time()
done = set()
if os.path.exists(OUT):
    for ln in open(OUT):
        try:
            done.add(json.loads(ln)['file'])
        except Exception:
            pass
with open(OUT, 'a') as fo:
    n = 0
    for f, exp in sorted(words.items()):
        if f in done:
            continue
        buf, err = pcm(f)
        st = stats(buf)
        hyp, sc = decode(wdec, buf) if buf else ('', None)
        fo.write(json.dumps(dict(kind='word', file=f, expected=sorted(exp), hyp=hyp, score=sc, ok=hyp in exp, ffmpeg_err=err, **st), ensure_ascii=False) + '\n')
        n += 1
        if n % 100 == 0:
            fo.flush(); print('words', n, round(time.time() - t0, 1), flush=True)
    for f, exp in sorted(sents.items()):
        if f in done:
            continue
        buf, err = pcm(f)
        st = stats(buf)
        hyp, sc = decode(sdec, buf) if buf else ('', None)
        e = sorted(exp)[0]
        fo.write(json.dumps(dict(kind='sent', file=f, expected=sorted(exp), hyp=hyp, score=sc, wer=round(wer(toks(e), toks(hyp)), 3), ffmpeg_err=err, **st), ensure_ascii=False) + '\n')
        n += 1
        if n % 100 == 0:
            fo.flush(); print('all', n, round(time.time() - t0, 1), flush=True)
print('DONE', n, round(time.time() - t0, 1), flush=True)
