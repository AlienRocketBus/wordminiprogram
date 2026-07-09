// 完形填空中文高亮辅助 - 智能算法 + 手工映射
window.HIGHLIGHT_MANUAL = {"wake|起床啦,已经天亮了!": "起床", "sing|她嗓音很好听。": "嗓", "read|我喜欢在床上看书。": "看书", "think|我也这么觉得。": "觉得", "give|你能帮我一下吗?": "帮", "take|慢慢来,不着急。": "慢慢来", "get|我每天早上七点起床。": "起床", "make|能给我泡杯茶吗?": "泡", "catch|我赶早班公交。": "赶", "push|按按钮开始。": "按", "pick|我六点来接你。": "接", "help|随便吃饼干。": "随便", "stop|请别说话了。": "别", "long|今天工作一天好累。": "一天", "soft|她声音很轻。": "轻", "old|我爷爷虽然年纪大,但身体硬朗。": "年纪大", "good|祝你今天愉快!": "愉快", "bad|真遗憾。": "遗憾", "nice|很高兴认识你!": "高兴", "beautiful|今天天气真好!": "真好", "happy|我替你高兴!": "高兴", "loud|音乐太吵了。": "吵", "easy|简单!": "简单", "same|我们想到一块儿去了。": "一块儿", "free|你这周末有空吗?": "有空", "sick|我感觉不舒服。": "不舒服", "hair|她有一头乌黑的长发。": "发", "thumb|给我点个赞!": "赞", "zero|我考试一个错也没有。": "一个", "two|我有两只眼睛两只耳朵。": "两", "brother|我哥哥喜欢踢足球。": "哥哥", "sister|我姐姐比我大。": "姐姐", "cousin|我表哥住在另一个城市。": "表哥", "baby|宝宝睡熟了。": "宝宝", "food|意大利菜是我的最爱。": "意大利菜", "breakfast|早餐是最重要的一餐。": "早餐", "meal|一顿好饭让我感到开心。": "一顿好饭", "window|开窗透透气吧。": "窗", "house|我们去我家吧。": "家", "bathroom|请问洗手间在哪里?": "洗手间", "police|快报警!": "报警", "dancer|她是一名专业舞者。": "舞者", "field|农民们在田里劳作。": "田", "beach|这周末我们去海边吧。": "海边", "how|怎么样?": "怎么", "how many|你想要几个苹果?": "几个", "how much|这个包多少钱?": "多少", "how old|你多大了?": "多大", "how long|需要多长时间?": "多长", "your|你最喜欢什么颜色?": "你", "their|他们的房子是新的。": "他们的", "here|请过来。": "过来", "there|椅子上有一只猫。": "上有", "it|外面在下雨。": "外面", "yes|好,我很乐意。": "好", "no|不用,谢谢。": "不用", "OK|好,我们开始吧。": "好", "and|我喜欢茶和咖啡。": "和", "or|你想要茶还是咖啡?": "还是", "very|非常感谢。": "非常", "too|我也是!": "也", "again|能再说一遍吗?": "再", "then|先吃饭,然后再玩。": "然后", "most|你最喜欢他什么?": "最", "more|能再来点米饭吗?": "再来点", "about|这本书是关于什么的?": "关于", "without|别不穿外套就出门。": "不", "please|能把盐递给我吗?": "能", "so|我太累了。": "太", "often|你多久运动一次?": "多久", "story|说来话长。": "说来话长", "idea|这主意真棒!": "主意", "way|你能告诉我怎么走吗?": "怎么走", "cooking|妈妈喜欢在周日做饭。": "做饭", "gym|我每周去三次健身房。": "健身房", "second|请稍等一下。": "稍等", "minute|一会儿见。": "一会儿", "date|今天几号?": "几号", "be|我想当一名医生。": "当", "T-shirt|这件 T 恤现在我穿太小了。": "T 恤", "van|校车七点接我们。": "校车", "always|他老是迟到。": "老是", "angry|别生我气。": "生我气", "kind|你真好。": "真好", "centre|喷泉在广场的中央。": "中央", "bus|我每天坐公交车去上学。": "公交车", "when|我小时候住在北京。": "小时候"};

window.smartHighlight = function(cn, excn, en){
  if(!cn || !excn) return excn || '';
  
  // 0. 手工映射优先 (覆盖算法默认行为)
  if(en && window.HIGHLIGHT_MANUAL){
    var key = en + '|' + excn;
    if(window.HIGHLIGHT_MANUAL[key]){
      var hl = window.HIGHLIGHT_MANUAL[key];
      if(excn.indexOf(hl) !== -1){
        return excn.replace(hl, '<span style="color:#fbbf24;font-weight:900">' + hl + '</span>');
      }
    }
  }
  
  // 1. cn 直接在 excn 中
  if(excn.indexOf(cn) !== -1){
    return excn.replace(cn, '<span style="color:#fbbf24;font-weight:900">' + cn + '</span>');
  }
  
  // 2. 智能算法 - 拆分 / + 去后缀 + 拆字
  var candidates = [cn];
  if(cn.indexOf('/') !== -1){
    candidates = candidates.concat(cn.split('/'));
  }
  
  var suffixes = ['的', '地', '得', '者', '（复数）', '（可数）', '（钱/不可数）', '（年龄）'];
  var newCands = [];
  for(var i = 0; i < candidates.length; i++){
    var c = candidates[i];
    newCands.push(c);
    for(var j = 0; j < suffixes.length; j++){
      var sfx = suffixes[j];
      if(c.length > sfx.length && c.lastIndexOf(sfx) === c.length - sfx.length){
        newCands.push(c.slice(0, c.length - sfx.length));
      }
    }
  }
  
  // 去括号
  var newCands2 = [];
  for(var i = 0; i < newCands.length; i++){
    var c = newCands[i];
    newCands2.push(c);
    var cleaned = c.replace(/[（(].*?[）)]/g, '').trim();
    if(cleaned && cleaned !== c) newCands2.push(cleaned);
  }
  
  // 多字词拆分: 二字 + 单字
  var newCands3 = newCands2.slice();
  for(var i = 0; i < newCands2.length; i++){
    var c = newCands2[i];
    if(c.length >= 2){
      for(var k = 0; k < c.length - 1; k++){
        newCands3.push(c.substr(k, 2));
      }
      for(var k = 0; k < c.length; k++){
        newCands3.push(c.charAt(k));
      }
    }
  }
  
  // 去重保序
  var seen = {};
  var unique = [];
  for(var i = 0; i < newCands3.length; i++){
    var c = newCands3[i];
    if(c && !seen[c]){ seen[c] = 1; unique.push(c); }
  }
  
  // 按长度排序 (优先匹配长的)
  unique.sort(function(a, b){ return b.length - a.length; });
  
  for(var i = 0; i < unique.length; i++){
    if(excn.indexOf(unique[i]) !== -1){
      return excn.replace(unique[i], '<span style="color:#fbbf24;font-weight:900">' + unique[i] + '</span>');
    }
  }
  
  // 3. 手工映射 (兜底)
  var key = (en || '') + '|' + excn;
  if(window.HIGHLIGHT_MANUAL[key]){
    var hl = window.HIGHLIGHT_MANUAL[key];
    if(excn.indexOf(hl) !== -1){
      return excn.replace(hl, '<span style="color:#fbbf24;font-weight:900">' + hl + '</span>');
    }
  }
  
  // 4. 完全找不到 - 保留原样
  return excn;
};
