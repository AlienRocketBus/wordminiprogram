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

function textNodes(fragment) {
  return [...fragment.matchAll(/>([^<>]+)</g)]
    .map(match => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function visibleText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[a-z][a-z0-9]+|#\d+|#x[\da-f]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attributes(tag) {
  const result = new Map();
  for (const match of tag.matchAll(/([:\w-]+)="([^"]*)"/g)) result.set(match[1], match[2]);
  return result;
}

const guideHtml = renderGuide(guideSource);
assert.ok(guideHtml, '设置页必须真正生成攻略内容');

const cards = [...guideHtml.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map(match => ({
  attrs: attributes(match[1]),
  html: match[2]
}));
assert.equal(cards.length, 4, '设置页必须恰好有四张攻略卡');
assert.deepEqual(cards.map(card => card.attrs.get('data-eg-card')), ['Coin', 'Diamond', 'Pet', 'PetExp']);

const expectedTitles = ['金币怎么得', '钻石怎么得', '宠物怎么升级', '宠物经验怎么得'];
const actualTitles = [];
const panelIds = new Set();
for (const card of cards) {
  const buttonTag = card.html.match(/<button\b([^>]*)>/);
  assert.ok(buttonTag, '每张卡必须用按钮控制展开');
  const buttonAttrs = attributes(buttonTag[1]);
  assert.equal(buttonAttrs.get('type'), 'button');
  assert.equal(buttonAttrs.get('aria-expanded'), 'false', '四张卡默认必须折叠');
  const controls = buttonAttrs.get('aria-controls');
  assert.ok(controls, '折叠按钮必须用 aria-controls 指向正文');
  assert.ok(!panelIds.has(controls), '每张卡的正文编号必须唯一');
  panelIds.add(controls);

  const panelTag = card.html.match(/<div\b([^>]*class="hsn-eg-panel"[^>]*)>/);
  assert.ok(panelTag, '每张卡必须有对应正文');
  const panelAttrs = attributes(panelTag[1]);
  assert.equal(panelAttrs.get('id'), controls, 'aria-controls 必须与正文编号一致');
  assert.match(panelTag[1], /(?:^|\s)hidden(?:\s|$)/, '四张卡正文默认必须带 hidden');

  const title = card.html.match(/class="hsn-eg-title">([^<]+)</)?.[1]?.trim();
  assert.ok(title, '每张卡必须有简短标题');
  actualTitles.push(title);
}
assert.deepEqual(actualTitles, expectedTitles, '四张卡标题必须一眼能懂');

const allVisible = visibleText(guideHtml);
assert.doesNotMatch(allVisible.replaceAll('Boss', ''), /[A-Za-z]/,
  '玩家可见攻略除用户指定名称 Boss 外，不得夹杂其他英文字母');
assert.doesNotMatch(allVisible, /旧版|老版|旧版本|老版本|历史|迁移|兼容|补差|账本|协议|源码|数据源|来源标识|结算公式|取整|舍入/, '玩家可见攻略不得解释旧版本或内部技术细节');

const nodes = textNodes(guideHtml);
for (const node of nodes) {
  assert.ok([...node].length <= 32, `攻略必须使用短句，当前过长（${[...node].length} 字）：${node}`);
}
assert.ok([...allVisible.replace(/\s/g, '')].length <= 1050, '四张攻略总字数必须保持精简');
const cardLengthLimits = { Coin: 330, Diamond: 300, Pet: 185, PetExp: 250 };
for (const card of cards) {
  const id = card.attrs.get('data-eg-card');
  const count = [...visibleText(card.html).replace(/\s/g, '')].length;
  assert.ok(count <= cardLengthLimits[id], `${id} 攻略过长：${count} 字`);
}

assert.doesNotMatch(guideHtml, /<(?:table|thead|tbody|tfoot|tr|th|td)\b/i, '攻略不得使用横向表格');
assert.doesNotMatch(guideSource, /overflow-x\s*:\s*(?:auto|scroll)/i, '攻略不得依赖横向滚动');
assert.match(guideSource, /@media\(max-width:350px\)\{\.hsn-eg-row\{grid-template-columns:1fr\}/, '窄屏必须把奖励行改成单列');

const cardsById = new Map(cards.map(card => [card.attrs.get('data-eg-card'), card.html]));
for (const [id, cardHtml] of cardsById) {
  const rowTexts = [...cardHtml.matchAll(/<div class="hsn-eg-row">([\s\S]*?)<\/div>/g)].map(match => visibleText(match[1]));
  assert.equal(new Set(rowTexts).size, rowTexts.length, `${id} 攻略不得出现重复奖励行`);
}

const diamondHtml = cardsById.get('Diamond');
const diamondFacts = [
  '单词达到五星 得到 4 钻石',
  '全岛单词五星 得到 50 钻石',
  '五星词达到段位 依次得 20、40、80、150、300 钻石',
  '完成一轮 Boss 得到 88 钻石',
  '战胜星海女帝 得到 100 钻石',
  '钻石新贵成就 得到 20 钻石'
];
const diamondVisible = visibleText(diamondHtml);
for (const fact of diamondFacts) {
  const count = diamondVisible.split(fact).length - 1;
  assert.equal(count, 1, `钻石关键奖励必须恰好出现一次：${fact}`);
}
assert.doesNotMatch(diamondVisible, /每天首胜|历史全通后|任意首胜/, 'HF6 攻略不得复活旧 Boss 领奖漏洞文案');

for (const fact of ['300 金币', '每题得到 1 金币', '每天最多 3 次', '全天最多 2000', '10～930 金币']) {
  assert.ok(visibleText(cardsById.get('Coin')).includes(fact), `金币卡缺少关键数字：${fact}`);
}
for (const fact of ['还差 3 个', '任选 3 个未掌握单词', '不会清零']) {
  assert.ok(visibleText(cardsById.get('Pet')).includes(fact), `宠物卡缺少关键说明：${fact}`);
}
for (const fact of ['10 经验', '再得到 30 经验', '每题得 5 经验', '65、80 或 95', '2、4 或 6 经验', '20～200 经验', '20～440 经验']) {
  assert.ok(visibleText(cardsById.get('PetExp')).includes(fact), `宠物经验卡缺少关键数字：${fact}`);
}

console.log('settings guides v946 HF4: four folded Chinese cards + concise mobile-safe copy ✅');
