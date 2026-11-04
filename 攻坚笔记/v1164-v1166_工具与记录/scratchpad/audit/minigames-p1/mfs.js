function makeFakeSpelling(word){
  const ops=[];
  const len=word.length;
  // 1. 替换一个字母 (常见错位)
  const subMap={'a':['e','o','u'],'e':['a','i'],'i':['e','y'],'o':['a','u'],'u':['o','a'],
    'b':['p','d'],'d':['b','t'],'p':['b','q'],'q':['p','g'],'g':['q','j'],
    'm':['n'],'n':['m','h'],'s':['z','c'],'z':['s'],'c':['k','s'],'k':['c','q'],
    'f':['v'],'v':['f','b'],'r':['l'],'l':['r'],'t':['d','c'],'h':['n'],'w':['v']};
  for(let i=0;i<len;i++){
    const ch=word[i].toLowerCase();
    const subs=subMap[ch]||[];
    subs.forEach(s=>{
      const fake=word.slice(0,i)+s+word.slice(i+1);
      if(fake.toLowerCase()!==word.toLowerCase())ops.push(fake);
    });
  }
  // 2. 多写一个字母 (重复)
  for(let i=0;i<len;i++){
    ops.push(word.slice(0,i+1)+word[i]+word.slice(i+1));
  }
  // 3. 漏一个字母 (单词太短就跳过)
  if(len>3){
    for(let i=0;i<len;i++){
      ops.push(word.slice(0,i)+word.slice(i+1));
    }
  }
  // 4. 交换相邻字母
  for(let i=0;i<len-1;i++){
    if(word[i]!==word[i+1])ops.push(word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2));
  }
  // 去重 + 排除等于原词的
  const uniq=[];const seen=new Set([word.toLowerCase()]);
  ops.forEach(o=>{
    if(!o)return;
    const lo=o.toLowerCase();
    if(!seen.has(lo)){seen.add(lo);uniq.push(o)}
  });
  return uniq;
}
