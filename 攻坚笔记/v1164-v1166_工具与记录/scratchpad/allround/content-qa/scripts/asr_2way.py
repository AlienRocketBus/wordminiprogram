import json, subprocess
from pocketsphinx import Decoder, get_model_path
S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
MP=get_model_path()
d=Decoder(hmm=MP+'/en-us/en-us',dict=MP+'/en-us/cmudict-en-us.dict',lm=MP+'/en-us/en-us.lm.bin',loglevel='FATAL')
d.add_word('pe','P IY IY',True)
res=json.load(open(B+'out/asr_words_island.json'))
out=[]
for i,o in enumerate([o for o in res if not o['ok'] and o['hyp']]):
  exp=o['expected'][0]
  g='#JSGF V1.0;\ngrammar g;\npublic <w> = %s | %s ;\n'%(exp,o['hyp'])
  d.add_jsgf_string('t%d'%i,g); d.activate_search('t%d'%i)
  b=subprocess.run(['ffmpeg','-v','error','-i',S+o['file'],'-ac','1','-ar','16000','-f','s16le','-'],stdout=subprocess.PIPE).stdout
  d.start_utt(); d.process_raw(b,False,True); d.end_utt(); h=d.hyp()
  out.append(dict(file=o['file'],expected=exp,island_hyp=o['hyp'],two_way=h.hypstr if h else ''))
json.dump(out,open(B+'out/asr_2way.json','w'),ensure_ascii=False,indent=1)
keep=[x for x in out if x['two_way']!=x['expected']]
print('two-way tested',len(out),'expected wins',len(out)-len(keep),'other still wins',len(keep))
for x in keep: print(x)
