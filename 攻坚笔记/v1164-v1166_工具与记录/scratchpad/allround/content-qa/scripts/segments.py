import sys, subprocess, numpy as np, json
from pocketsphinx import Decoder, get_model_path
S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
MP=get_model_path()
d=Decoder(hmm=MP+'/en-us/en-us',dict=MP+'/en-us/cmudict-en-us.dict',lm=MP+'/en-us/en-us.lm.bin',loglevel='FATAL')
for f in sys.argv[1:]:
  b=subprocess.run(['ffmpeg','-v','error','-i',S+f,'-ac','1','-ar','16000','-f','s16le','-'],stdout=subprocess.PIPE).stdout
  a=np.frombuffer(b,dtype=np.int16).astype(np.float32)/32768
  n=a.size//160; e=np.sqrt(np.mean(a[:n*160].reshape(n,160)**2,axis=1)); on=e>10**(-40/20)
  segs=[];i=0
  while i<n:
    if on[i]:
      j=i
      while j<n and on[j]: j+=1
      segs.append([i/100,j/100]); i=j
    else: i+=1
  merged=[]
  for s in segs:
    if merged and s[0]-merged[-1][1]<0.12: merged[-1][1]=s[1]
    else: merged.append(s)
  merged=[m for m in merged if m[1]-m[0]>=0.05]
  d.start_utt(); d.process_raw(b,False,True); d.end_utt(); h=d.hyp()
  print(f, 'dur',round(a.size/16000,2),'segments',[(round(x,2),round(y,2)) for x,y in merged],'| free ASR:',h.hypstr if h else '')
