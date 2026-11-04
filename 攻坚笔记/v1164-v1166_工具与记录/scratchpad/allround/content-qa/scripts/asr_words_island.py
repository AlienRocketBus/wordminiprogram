# Second, more reliable word-audio screen: recognise each word clip against a grammar made only of the
# words of the island(s) that use it. A clip that is recognised as a DIFFERENT word of its own island
# is a candidate for a wrong file mapping (to be confirmed by listening).
import json, re, subprocess, sys
from pocketsphinx import Decoder, get_model_path
S = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
MP = get_model_path()
res = json.load(open(B + 'out/audio_resolution.json'))
def nw(en):
    t = en.lower().replace('-', ' '); t = re.sub(r"[^a-z' ]", ' ', t); return re.sub(r'\s+', ' ', t).strip()
by_isl = {}
for r in res:
    by_isl.setdefault(r['src'], set()).add(nw(r['en']))
clips = {}
for r in res:
    if r['w']:
        c = clips.setdefault(r['w'], {'exp': set(), 'isl': set()})
        c['exp'].add(nw(r['en'])); c['isl'].add(r['src'])
dec = Decoder(hmm=MP + '/en-us/en-us', dict=MP + '/en-us/cmudict-en-us.dict', lm=MP + '/en-us/en-us.lm.bin', loglevel='FATAL')
dec.add_word('pe', 'P IY IY', True)
searches = {}
def search_for(isls):
    key = '|'.join(sorted(isls))
    if key not in searches:
        vocab = sorted(set().union(*[by_isl[i] for i in isls]))
        g = '#JSGF V1.0;\ngrammar g;\npublic <w> = ' + ' | '.join(vocab) + ' ;\n'
        name = 's%d' % len(searches)
        dec.add_jsgf_string(name, g)
        searches[key] = name
    return searches[key]
out = []
for f, c in sorted(clips.items()):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', S + f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], stdout=subprocess.PIPE).stdout
    dec.activate_search(search_for(c['isl']))
    dec.start_utt(); dec.process_raw(b, False, True); dec.end_utt()
    h = dec.hyp(); hyp = h.hypstr if h else ''
    out.append(dict(file=f, expected=sorted(c['exp']), islands=sorted(c['isl']), hyp=hyp, ok=hyp in c['exp']))
json.dump(out, open(B + 'out/asr_words_island.json', 'w'), ensure_ascii=False, indent=1)
bad = [o for o in out if not o['ok']]
print('clips', len(out), 'recognised as expected', len(out) - len(bad), 'other word', len(bad))
for o in bad:
    print(o['file'], o['expected'], '->', repr(o['hyp']), o['islands'])
