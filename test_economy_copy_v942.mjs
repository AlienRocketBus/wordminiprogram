import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const guideSource = fs.readFileSync(new URL('./hansen_econ_guide.js', import.meta.url), 'utf8');

function renderGuide(source) {
  let guideHtml = '';
  const nodes = {
    settingsContent: {
      firstChild: null,
      insertBefore(node) {
        guideHtml = node.innerHTML;
        nodes[node.id] = node;
      },
      appendChild(node) {
        guideHtml = node.innerHTML;
        nodes[node.id] = node;
      }
    }
  };
  const head = {
    appendChild(node) {
      if (node.id) nodes[node.id] = node;
    }
  };
  const document = {
    readyState: 'complete',
    head,
    documentElement: head,
    getElementById(id) {
      return nodes[id] || null;
    },
    createElement(tagName) {
      return { tagName, id: '', textContent: '', innerHTML: '', addEventListener() {} };
    }
  };

  vm.runInNewContext(source, {
    document,
    window: {},
    setInterval() { return 1; },
    clearInterval() {}
  }, { filename: 'hansen_econ_guide.js' });
  return guideHtml;
}

function visibleText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[a-z][a-z0-9]+|#\d+|#x[\da-f]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cardMap(html) {
  const cards = new Map();
  for (const match of html.matchAll(/<section\b[^>]*data-eg-card="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
    cards.set(match[1], match[2]);
  }
  return cards;
}

function rows(cardHtml) {
  return [...cardHtml.matchAll(/<div class="hsn-eg-row">([\s\S]*?)<\/div>/g)].map(match => {
    const rowHtml = match[1];
    const action = rowHtml.match(/class="hsn-eg-do">([^<]+)</)?.[1]?.trim();
    const reward = rowHtml.match(/class="hsn-eg-get">([^<]+)</)?.[1]?.trim();
    assert.ok(action && reward, '每一行都必须同时写清“做什么”和“得多少”');
    return { action, reward, text: visibleText(rowHtml) };
  });
}

function assertRow(cardRows, action, reward) {
  const count = cardRows.filter(row => row.action === action && row.reward === reward).length;
  assert.equal(count, 1, `“${action} → ${reward}”必须恰好出现一次`);
}

const guideHtml = renderGuide(guideSource);
assert.ok(guideHtml, '设置页必须生成攻略内容');
const cards = cardMap(guideHtml);
assert.deepEqual([...cards.keys()], ['Coin', 'Diamond', 'Pet', 'PetExp']);

const coinRows = rows(cards.get('Coin'));
assertRow(coinRows, '第一次进入', '得到 300 金币');
assertRow(coinRows, '答对普通题', '每题得到 1 金币');
assertRow(coinRows, '复习错题', '答对也得 1 金币');
assertRow(coinRows, '完成每日任务', '每项 20～120 金币');
assertRow(coinRows, '每日签到', '每天得到 10～930 金币');
assertRow(coinRows, '连续签到', '另得 120、250、600');
assertRow(coinRows, '打赢 Boss', '首次 20～50；重打 5');
assertRow(coinRows, '参加拼写蜂', '每赢一词得 3～15');
assertRow(coinRows, '战胜星海女帝', '另得 300 金币');
const coinText = visibleText(cards.get('Coin'));
for (const fact of ['同一单词每天最多 3 次', '全天最多 2000', '七项全领，再得到 100～240', '宝箱每天只能开一次', '当天最多 2000']) {
  assert.ok(coinText.includes(fact), `金币攻略缺少：${fact}`);
}

const diamondRows = rows(cards.get('Diamond'));
assertRow(diamondRows, '单词达到五星', '得到 4 钻石');
assertRow(diamondRows, '完成一组拼写', '慢速 10 次；中速 7 次；快速 5 次');
assertRow(diamondRows, '记忆强化生效', '一组增加 2 颗星');
assertRow(diamondRows, '全岛单词五星', '得到 50 钻石');
assertRow(diamondRows, '五星词达到段位', '依次得 20、40、80、150、300 钻石');
assertRow(diamondRows, '完成一轮 Boss', '得到 88 钻石');
assertRow(diamondRows, '战胜星海女帝', '得到 100 钻石');
assertRow(diamondRows, '钻石新贵成就', '得到 20 钻石');
const diamondText = visibleText(cards.get('Diamond'));
for (const fact of ['同一单词每天最多完成一组', '一座岛只领一次', '30、100、250、500、800', '每个 Boss 各胜一次', '重复同一关不多算', '八片单词大陆全通后挑战']) {
  assert.ok(diamondText.includes(fact), `钻石攻略缺少：${fact}`);
}
assert.doesNotMatch(diamondText, /每天首胜|历史全通后|任意首胜/, 'HF6 钻石攻略不得复活旧 Boss 漏洞规则');

const petRows = rows(cards.get('Pet'));
assertRow(petRows, '找练习单词', '看爪印没亮的单词');
assertRow(petRows, '开始冲刺', '点“冲刺宠物掌握”');
assertRow(petRows, '完成拼写', '新词连续完整拼对 3 次');
assertRow(petRows, '显示“还差 3 个”', '任选 3 个未掌握单词');
assertRow(petRows, '宠物升级后', '经验和单词全部保留');
const petText = visibleText(cards.get('Pet'));
for (const fact of ['经验要够，已掌握单词也要够', '进入打字大师', '不是三个隐藏单词', '不会清零']) {
  assert.ok(petText.includes(fact), `宠物升级攻略缺少：${fact}`);
}

const petExpRows = rows(cards.get('PetExp'));
assertRow(petExpRows, '学会一个新单词', '得到 10 经验');
assertRow(petExpRows, '真正改对错题', '每次得到 10 经验');
assertRow(petExpRows, '救回一个错词', '再得到 30 经验');
assertRow(petExpRows, '挑战 Boss', '答对每题得 5 经验');
assertRow(petExpRows, '普通拼写对战', '每赢一词得 2、4 或 6 经验');
assertRow(petExpRows, '完成每日任务', '每项得到 20～200 经验');
assertRow(petExpRows, '每日签到', '得到 20～440 经验');
assertRow(petExpRows, '完成小游戏', '答对和通关都会给经验');
const petExpText = visibleText(cards.get('PetExp'));
for (const fact of ['所有岛屿的经验，都加给同一只宠物', '胜利再得 65、80 或 95']) {
  assert.ok(petExpText.includes(fact), `宠物经验攻略缺少：${fact}`);
}

const allVisibleText = visibleText(guideHtml);
assert.doesNotMatch(allVisibleText.replaceAll('Boss', ''), /[A-Za-z]/,
  '玩家可见攻略除用户指定名称 Boss 外，不得夹杂其他英文字母');
assert.doesNotMatch(allVisibleText, /旧版|老版|旧版本|老版本|历史|迁移|兼容|补差|账本|协议|源码|数据源|取整|舍入/, '玩家可见攻略不得出现旧版或内部技术说明');

console.log('economy copy v942: four concise Chinese guides + current reward facts ✅');
