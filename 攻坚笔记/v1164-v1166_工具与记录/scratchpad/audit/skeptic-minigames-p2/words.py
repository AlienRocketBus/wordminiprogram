import json,re,sys
d=json.load(open('land_data.json'))
easy=['calm','eager','loyal','proud','amazed','humble','lonely','mature','modest','polite','strict','anxious','ashamed']
med=['comfort','curious','furious','jealous','nervous','relaxed','selfish','sincere','cautious','cheerful','confused','grateful','outgoing']
hard=['reliable','stubborn','delighted','energetic','miserable','satisfied','sensitive','talkative','determined','frightened','optimistic','embarrassed','hardworking','disappointed']
for k,v in d.items():
    s=v['slots']
    words=[]
    for sl in s:
        words+=re.findall(r'\{en:"([^"]+)"',sl)
    ws=set(words)
    le=[len(w) for w in words]
    print(k,len(words),'listen',sum(w in ws for w in easy),sum(w in ws for w in med),sum(w in ws for w in hard),
      '<=4:',sum(l<=4 for l in le),'5-6:',sum(5<=l<=6 for l in le),'>=7:',sum(l>=7 for l in le))
