import json, re, os, subprocess, collections, hashlib
S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
isl=json.load(open(B+'data/island_entries.json'))
meta=json.load(open(B+'data/islands_meta.json'))
wm_raw=open(S+'word_map.js',encoding='utf-8').read()
WM=dict(re.findall(r'"([^"]+)"\s*:\s*"(words/[^"]+\.mp3)"',wm_raw))
# duplicates keys in WORD_MAP (later wins in JS)
keys=re.findall(r'"([^"]+)"\s*:\s*"words/',wm_raw)
dupk=[k for k,c in collections.Counter(keys).items() if c>1]
sm_raw=open(S+'sentence_map.js',encoding='utf-8').read()
SM=json.loads(sm_raw[sm_raw.index('{'):sm_raw.rindex('}')+1])
ex_raw=open(S+'hansen_ex_audio.js',encoding='utf-8').read()
EX=dict(re.findall(r'"([^"]+)":\s*"(words/[^"]+\.mp3)"',ex_raw.split('__HANSEN_EX_AUDIO_BY_WORD')[0]))
EXBW=dict(re.findall(r'"([^"]+)":\s*"(words/[^"]+\.mp3)"',ex_raw.split('__HANSEN_EX_AUDIO_BY_WORD')[1])) if '__HANSEN_EX_AUDIO_BY_WORD' in ex_raw else {}
lock=json.load(open(S+'hansen_audio_lock.json'))
def norm(t):
  t=t.replace('’',"'"); t=re.sub(r'[^A-Za-z ]','',t); return re.sub(r'\s+',' ',t).strip().lower()
def is_sentence(t): return bool(re.search(r'[.!?;:]',t)) or len(t)>20
rows=[]
for e in isl:
  la=meta[e['src']]['localAudio'] or {}
  en=e['en']; lo=en.lower()
  w=la.get(lo) or WM.get(lo) or WM.get(en)
  wsrc='local' if la.get(lo) else ('word_map' if (WM.get(lo) or WM.get(en)) else None)
  # word path: speak(w.en) -> but if _isSentence(en) it'd go sentence path (never for headwords)
  ex=e['ex']; s=None; ssrc=None
  if is_sentence(ex):
    k=norm(ex)
    if EX.get(k): s=EX[k]; ssrc='ex_audio'
    elif ex in SM: s='sentences/sentence_%04d.mp3'%SM[ex]; ssrc='sentence_map'
  else:
    ssrc='NOT_SENTENCE(word chain)'
  lk=lock['resolution'].get(e['src'],{}).get(en,{})
  rows.append(dict(src=e['src'],line=e['line'],en=en,ex=ex,w=w,wsrc=wsrc,s=s,ssrc=ssrc,lock_w=lk.get('w'),lock_s=lk.get('s'),
                   w_exists=bool(w and os.path.isfile(S+w)), s_exists=bool(s and os.path.isfile(S+s))))
json.dump(rows,open(B+'out/audio_resolution.json','w'),ensure_ascii=False,indent=1)
print('WORD_MAP entries',len(WM),'dup keys',dupk)
print('SENTENCE_MAP',len(SM),'EX_AUDIO',len(EX),'EX_BY_WORD',len(EXBW))
print('entries',len(rows))
print('word audio missing:',[ (r['src'],r['en']) for r in rows if not r['w']])
print('word file missing:',[ (r['src'],r['en'],r['w']) for r in rows if r['w'] and not r['w_exists']])
print('sentence audio missing:',[ (r['src'],r['en'],r['ex'],r['ssrc']) for r in rows if not r['s']])
print('sentence file missing:',[ (r['src'],r['en'],r['s']) for r in rows if r['s'] and not r['s_exists']])
print('lock disagreement:',[(r['src'],r['en'],r['w'],r['lock_w'],r['s'],r['lock_s']) for r in rows if r['w']!=r['lock_w'] or r['s']!=r['lock_s']][:30])
# filename vs word
def base(p): return os.path.basename(p)[:-4]
mism=[]
for r in rows:
  if not r['w']: continue
  b=base(r['w']); exp=re.sub(r'[^a-z0-9]+','_',r['en'].lower()).strip('_')
  b2=re.sub(r'_(season|home|land\d|v\d+)$','',b)
  if b2!=exp: mism.append((r['src'],r['en'],r['w']))
print('word filename != word (%d):'%len(mism))
for m in mism: print('   ',m)
# same word file used for different words
fw=collections.defaultdict(set)
for r in rows:
  if r['w']: fw[r['w']].add(r['en'].lower())
print('word files shared by different words:',{k:v for k,v in fw.items() if len(v)>1})
fs_=collections.defaultdict(set)
for r in rows:
  if r['s']: fs_[r['s']].add(r['ex'])
print('sentence files shared by different sentences:',{k:v for k,v in fs_.items() if len(v)>1})
# identical bytes for different words
h=collections.defaultdict(set)
for f,meta_ in lock['files'].items(): h[meta_['sha256']].add(f)
dups={k:v for k,v in h.items() if len(v)>1}
print('identical-content audio files (sha256):',len(dups))
for k,v in dups.items(): print('   ',sorted(v))
# unreferenced audio files
ref=set(r['w'] for r in rows if r['w'])|set(r['s'] for r in rows if r['s'])
allw=set('words/'+f for f in os.listdir(S+'words'))|set('sentences/'+f for f in os.listdir(S+'sentences'))
print('audio files on disk',len(allw),'referenced',len(ref),'unreferenced',len(allw-ref))
print('unreferenced sample',sorted(allw-ref)[:60])
