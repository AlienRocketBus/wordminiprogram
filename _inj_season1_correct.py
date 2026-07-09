import json, shutil

# ============ 1) island_data.json['season1']['BOSSES'] 加 5 boss ============
shutil.copy('island_data.json','/tmp/island_data_bak.json')
raw=open('island_data.json',encoding='utf-8').read()
d=json.loads(raw)
old_dec=d['season1']['BOSSES']
assert old_dec.startswith('const BOSSES=[\n'), '格式不符: '+repr(old_dec[:40])

SV='<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="bosses/%s?v=868" xlink:href="bosses/%s?v=868" width="100" height="100" preserveAspectRatio="xMidYMid meet"/></svg>'
def svg(fn): return SV%(fn,fn)
T_VAN=['目标锁定。你的每一步，我都算得到。','我不用能量盾——在你扣扳机之前，我会先命中你。','瞄准矩阵已闭环。别眨眼。','躲在掩体后面？等离子匕首，就是留给你这种人的。','枪身上的刻痕，又要添一道了。','慢了。这一枪，你早该躲开的。','精锐和尖兵的区别，你现在应该明白了。','烟雾、闪光、干扰——都挡不住我的目镜。','想清楚下一步再动。我在看着。','你的破绽，写在你的呼吸里。','再快一点，也许你还有机会。','不错。但"不错"，在战场上不够用。']
T_WAR=['我来了——你们，可以开始逃了。','我身上的武器，比一整个步兵班还全。','机枪压不住你？那就尝尝导弹的味道。','弹药箱够我打上几分钟，你撑得住吗？','躲掩体？我的导弹会从你头顶炸下来。','这套装甲，是我一片一片拼出来的。','老兵不靠运气，靠的是清楚每件武器的时机。','军刀出鞘之前，先让机枪跟你打个招呼。','焦土上的每一块碎石，都在为我震颤。','你还站着？那说明我还没认真。','手雷、导弹、军刀……你想先见识哪个？','打得不错，小子。可惜，我的弹链还没打完。']
T_EXI=['一剑之间，已分生死。你只是还没反应过来。','我的剑，不问对错，只问快慢。','银蓝，还是暗紫……你猜，这一刃是什么颜色。','残影未散，剑已归鞘。','星陨之下，无人可挡我一斩。','你的眼睛，跟不上我的剑。','流亡者没有退路，所以我从不后退。','快一点。再快一点。否则你看不到第二刃。','这一斩，我等了很久。','剑光落处，星辰俱裂。','你还在原地？那你已经中了八刀。','有点意思。让我认真用一次居合。']
T_ASM=['扫描完成。你的数据，已录入生产线。','坏了一个，再造十个。你，拦不住流水线。','红光亮起——那是你被标记的信号。','机械臂的冲压，从不失误。','我不需要休息，也不需要理由。','激光切割，误差为零。请保持不动。','你消灭的，只是复制品。原厂，在这里。','全功率复产，已启动。','一切造物，终将归于我的流水线。','你的挣扎，只是又一组待处理的数据。','效率，才是唯一的信仰。','检测到异常算力。提升产能——碾过去。']
T_ANC=['我看着星辰生，看着星辰灭。你，不过一瞬。','我不与你战斗。我只是……让你明白重量。','引力低语，你听见了吗。','亿万年的守望，多你一个，不多。','记忆之环转动，你的名字，也将被记下。','我沉默，不代表我温柔。','星尘向我坠落，如同你终将坠向我。','抬头。你脚下的，是一颗醒着的星球。','你的力量，在引力面前，轻如尘埃。','我从不出手。我只是……收拢。','坍缩之时，万物归一。','走到这里，不容易。但，仅止于此。']
def obj(name,fn,hp,color,taunts):
    tj=','.join("'"+t+"'" for t in taunts)
    return "{name:'%s',emoji:'%s',hp:%d,color:'%s',taunts:[%s]}"%(name,svg(fn),hp,color,tj)
new5=[
 obj('暗影先锋·破阵者','s1_vanguard.png',90,'#ff8a3a',T_VAN),
 obj('武器大师·战争铁砧','s1_waranvil.png',98,'#ff6a2a',T_WAR),
 obj('星陨武士·流亡之刃','s1_exileblade.png',106,'#8ab4ff',T_EXI),
 obj('机械主教·组装者','s1_assembler.png',114,'#ff3a2a',T_ASM),
 obj('活体行星·古老意志','s1_ancientwill.png',120,'#ffcf7a',T_ANC),
]
prefix='const BOSSES=[\n'
rest=old_dec[len(prefix):]   # '{铸星者...}\n]'
new_dec=prefix + ',\n'.join(new5) + ',\n' + rest

# 用 json 转义做精确替换(其余字节不动)
old_esc=json.dumps(old_dec, ensure_ascii=False)[1:-1]
new_esc=json.dumps(new_dec, ensure_ascii=False)[1:-1]
assert old_esc in raw, 'season1 BOSSES 转义值未在原文找到(转义不匹配)'
assert raw.count(old_esc)==1, 'season1 BOSSES 转义值不唯一, 命中 %d'%raw.count(old_esc)
raw2=raw.replace(old_esc, new_esc, 1)
# 校验改后仍是合法JSON且season1 BOSSES正确
d2=json.loads(raw2)
assert d2['season1']['BOSSES']==new_dec, '写回后不一致'
assert d2['action']['BOSSES']==d['action']['BOSSES'], 'action岛被误改!'
open('island_data.json','w',encoding='utf-8').write(raw2)
print('✅ island_data.json[season1][BOSSES] 已加5boss (其余岛未动·仍合法JSON)')

# ============ 2) template.html 两处加 season1 守卫 ============
shutil.copy('template.html','/tmp/template_bak.html')
t=open('template.html',encoding='utf-8').read()
old_sel='  const lvl=Math.min(Math.max(0,S.level-1),BOSSES.length-1);\n  bossCurrent=BOSSES[lvl];'
new_sel=("  var __isS1=/island_season1\\.html/.test(location.pathname||''); var __s1p=0; if(__isS1){try{__s1p=parseInt(localStorage.getItem('season1_prog')||'0',10)||0;}catch(e){}}\n"
         "  const lvl=__isS1?Math.min(Math.max(0,__s1p),BOSSES.length-1):Math.min(Math.max(0,S.level-1),BOSSES.length-1);\n"
         "  if(__isS1)window._s1Idx=lvl;\n"
         "  bossCurrent=BOSSES[lvl];")
assert t.count(old_sel)==1, 'template startBoss选关行命中 %d'%t.count(old_sel)
t=t.replace(old_sel,new_sel)

old_clr="  try{ var _smm=(location.pathname||'').match(/island_season([1-5])\\.html/); if(_smm){ localStorage.setItem('hsn_seasonmap_cleared_'+_smm[1],'1'); } }catch(e){}"
new_clr=("  try{ var _smm=(location.pathname||'').match(/island_season([1-5])\\.html/); if(_smm && (window._s1Idx==null || window._s1Idx===(BOSSES.length-1))){ localStorage.setItem('hsn_seasonmap_cleared_'+_smm[1],'1'); } }catch(e){}\n"
         "  /* 🔴v869 第一星域6关顺序闯关: 打赢当前前沿boss→推进 season1_prog。仅season1(其余季岛单boss·hub·主岛不受影响)。 */\n"
         "  try{ if(/island_season1\\.html/.test(location.pathname||'')){ var __p1=parseInt(localStorage.getItem('season1_prog')||'0',10)||0; if(window._s1Idx===__p1){ localStorage.setItem('season1_prog', String(Math.min(__p1+1, BOSSES.length))); } } }catch(e){}")
assert t.count(old_clr)==1, 'template 通关判定行命中 %d'%t.count(old_clr)
t=t.replace(old_clr,new_clr)
open('template.html','w',encoding='utf-8').write(t)
print('✅ template.html startBoss顺序选关+通关判定守卫 已接(均加island_season1守卫)')
print('下一步: 运行 generate.py 重新盖章所有岛')
