/* sb_race.mjs — 拼写蜂"念完再开跑"验证
 *
 * Hansen: "我希望他念完单词之后我再拼写, 有时候单词还没念, 对面的机器人它已经开始拼写了。"
 *
 * ★ 判据(真机时间轴): 在【听读音模式】下
 *     t_speakStart  = 音频真的开始播的时刻
 *     t_speakEnd    = 音频播完的时刻
 *     t_botFirstKey = 机器人打出第一个字母的时刻
 *   必须满足: t_botFirstKey > t_speakEnd   (机器人绝不能在单词念完之前动手)
 * ★ 顺带验: 玩家计时(timer)也必须从【念完】才开始, 否则"听的时候就在被计时"不公平。
 * ★ 顺带验: 音频全坏(404)时, 3.5 秒兜底一定开赛, 绝不卡死。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8877';
let pass = 0, fail = 0;
const chk = (n, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${n}${note ? '  ' + note : ''}`); };

async function openBee(b, { killAudio } = {}) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  if (killAudio) await p.route('**/*.mp3', r => r.abort());
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });
  await p.evaluate(() => { try { window.HansenSpellBee.open('land1'); } catch (e) { } });
  await p.waitForTimeout(2600);
  const fr = p.frames().find(f => /spelling_bee\.html/.test(f.url()));
  return { c, p, fr };
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  // ══ ① 正常音频: 机器人必须等念完 ══
  console.log('  ══ ① 听读音模式: 机器人必须【等单词念完】才动手 ══');
  {
    const { c, fr } = await openBee(b);
    if (!fr) { chk('打开拼写蜂', false, '(iframe 没找到)'); await c.close(); }
    else {
      // 在 iframe 里装时间轴探针, 然后开一局
      const tl = await fr.evaluate(async () => {
        const T = { speakStart: -1, speakEnd: -1, botFirstKey: -1, timerStart: -1, t0: 0 };
        // 拦音频
        const A = window._ensureSbAudio ? window._ensureSbAudio() : null;
        // 拦 botStep 的第一次落键
        const origBotStep = window.botStep;
        let botKeyed = false;
        window.botStep = function () {
          if (!botKeyed) { botKeyed = true; T.botFirstKey = Date.now() - T.t0; }
          return origBotStep.apply(this, arguments);
        };
        // 拦 Audio.play / ended
        const AP = HTMLAudioElement.prototype.play;
        HTMLAudioElement.prototype.play = function () {
          if (T.speakStart < 0) T.speakStart = Date.now() - T.t0;
          const self = this;
          const onEnd = () => { if (T.speakEnd < 0) T.speakEnd = Date.now() - T.t0; self.removeEventListener('ended', onEnd); };
          self.addEventListener('ended', onEnd);
          return AP.apply(this, arguments);
        };
        // 拦 startTimer(玩家计时开始)
        const origST = window.startTimer;
        window.startTimer = function () { if (T.timerStart < 0) T.timerStart = Date.now() - T.t0; return origST.apply(this, arguments); };

        // 设成听读音模式, 开一局
        window.S.mode = 'listen';
        window.S.diff = 'all';
        T.t0 = Date.now();
        window.startMatch();
        await new Promise(r => setTimeout(r, 6000));
        return T;
      });
      console.log(`     时间轴: 开始念 ${tl.speakStart}ms · 念完 ${tl.speakEnd}ms · 机器人第一次落键 ${tl.botFirstKey}ms · 玩家计时开始 ${tl.timerStart}ms`);
      chk('单词真的被念了', tl.speakStart >= 0);
      chk('★机器人在【念完之后】才动手', tl.speakEnd >= 0 && tl.botFirstKey > tl.speakEnd,
          `念完 ${tl.speakEnd}ms → 机器人 ${tl.botFirstKey}ms (领先 ${tl.botFirstKey - tl.speakEnd}ms)`);
      chk('★玩家计时也从【念完】才开始', tl.timerStart >= tl.speakEnd - 50,
          `念完 ${tl.speakEnd}ms · 计时开始 ${tl.timerStart}ms`);
      await c.close();
    }
  }

  // ══ ② 音频全坏: 3.5 秒兜底必须开赛(不能卡死) ══
  console.log('\n  ══ ② 音频全部 404(线上偶发): 3.5 秒兜底必须开赛, 不能卡死 ══');
  {
    const { c, fr } = await openBee(b, { killAudio: true });
    if (!fr) { chk('打开拼写蜂(无音频)', false); await c.close(); }
    else {
      const r = await fr.evaluate(async () => {
        const T = { botFirstKey: -1, t0: 0 };
        const origBotStep = window.botStep;
        let k = false;
        window.botStep = function () { if (!k) { k = true; T.botFirstKey = Date.now() - T.t0; } return origBotStep.apply(this, arguments); };
        window.S.mode = 'listen'; window.S.diff = 'all';
        T.t0 = Date.now();
        window.startMatch();
        await new Promise(r => setTimeout(r, 7000));
        return T;
      });
      chk('音频全坏时仍会开赛(兜底生效, 不卡死)', r.botFirstKey > 0 && r.botFirstKey < 6000, `机器人 ${r.botFirstKey}ms 开始(兜底 3.5s + 反应 0.5~1s)`);
      await c.close();
    }
  }

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
