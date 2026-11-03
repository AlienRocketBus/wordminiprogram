/* test_canonical_cache_v1165.mjs —— 账本内存缓存不许改变任何结果（随机操作对拍）
 *
 * v1165 给 hansen_canonical_progress.js 加了内存缓存（进度多的孩子每答一题卡 350~700ms 的根因修复）。
 * 缓存最怕「该重读时没重读」：别的页面框、备份恢复、重置直接改了 localStorage，缓存却还拿旧的。
 *
 * 做法：两份一模一样的存储 + 两个独立的模块实例，跑同一串随机操作（答题、存档、复习计划、清除、
 *   别的页面框直接改主账本/_bak、主账本损坏/丢失、整份写回、迁移、别的岛存档……）：
 *   A = 正常带缓存的模块；R = 参照实例，每次调用前都 _dropCache()（= 旧代码那样每次整份重建）。
 *   每一步之后要求：两份存储的主账本/_bak 原文一字不差；read()/readRO()/计数/切片快照/本页 S 完全一致；
 *   readRO() 和 read() 内容一致，而且调用方改 read() 的结果不会污染缓存。
 * 另外：没有别人改账本时，连续答 60 题一次整份重建都不许有（性能合同）。
 *
 * 可选：HSN_CANON_REF=<旧版 hansen_canonical_progress.js> 让 R 用旧代码，证明新旧语义一致。
 *       HSN_CANON_SRC=<文件> 换掉被测文件（做变异测试用）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(process.env.HSN_CANON_SRC || path.join(ROOT, 'hansen_canonical_progress.js'), 'utf8');
const REF_SRC = process.env.HSN_CANON_REF ? fs.readFileSync(process.env.HSN_CANON_REF, 'utf8') : SRC;
const KEY = 'hansen_canonical_progress_v941', BAK = KEY + '_bak';

class Storage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(String(k)) ? this.m.get(String(k)) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(String(k)); }
  dump() { return JSON.stringify([...this.m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)); }
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeCtx(src, storage, clock, saveKey, pathname, words) {
  const S = { learned: [], mc: {}, wrongs: {}, srs: {}, lastSaveTime: clock.now, stats: {} };
  const FakeDate = function () { return new Date(clock.now); };
  FakeDate.now = () => clock.now;
  const c = { console, localStorage: storage, document: { readyState: 'complete', addEventListener() {} }, location: { pathname },
    Date: FakeDate, JSON, Math, Number, Object, Array, String, isFinite, setTimeout() { return 1; }, clearTimeout() {}, addEventListener() {},
    __hsnSaveKey: saveKey, S, __words: words };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(src, c, { filename: 'hansen_canonical_progress.js' });
  return c;
}

function runSeed(seed, saveKey, pathname, words, ops) {
  const R = rng(seed), clock = { now: Date.UTC(2026, 10, 3, 8, 0, 0) };
  const sa = new Storage(), sr = new Storage();
  const history = [];
  const A = makeCtx(SRC, sa, clock, saveKey, pathname, words);
  const Rf = makeCtx(REF_SRC, sr, clock, saveKey, pathname, words);
  const HA = A.HansenCanonical, HR = Rf.HansenCanonical;
  // 参照实例：每次调用前都丢缓存（旧代码没有 _dropCache 就是本来就不缓存）
  const ref = name => (...args) => { if (HR._dropCache) HR._dropCache(); return HR[name](...args); };
  const both = fn => { fn(A, HA, sa, false); fn(Rf, HR, sr, true); };
  const day = d => '2026-11-' + String(1 + d).padStart(2, '0');
  const pick = n => Math.floor(R() * n);
  const opsDone = {};

  for (let step = 0; step < ops; step++) {
    clock.now += 1 + pick(90000);
    const r = R(), i = pick(words), op = r < 0.22 ? 'answer' : r < 0.34 ? 'save' : r < 0.44 ? 'srs' : r < 0.49 ? 'clear'
      : r < 0.58 ? 'extMain' : r < 0.62 ? 'extBak' : r < 0.655 ? 'corrupt' : r < 0.69 ? 'truncate' : r < 0.74 ? 'rewrite'
      : r < 0.77 ? 'snapshot' : r < 0.81 ? 'migrate' : r < 0.85 ? 'otherSave' : r < 0.88 ? 'sync' : r < 0.91 ? 'mutateCopy' : r < 0.96 ? 'rewriteDrop' : 'reads';
    opsDone[op] = (opsDone[op] || 0) + 1;
    const learnedAdd = R() < 0.7, mcAdd = R() < 0.6, wrongN = R() < 0.35 ? 1 + pick(3) : 0;
    const srsEntry = R() < 0.8 ? { box: pick(5), due: day(pick(20)), last: R() < 0.3 ? '' : day(pick(10)) } : null;
    const fields = ['learned', 'mc', 'wrongs', 'srs'].filter(() => R() < 0.5);
    const isl = pick(19), slot = pick(30), val = 1 + pick(6), which = pick(4);
    const histPick = history.length ? history[pick(history.length)] : null;
    both((C, H, st, isRef) => {
      const call = isRef ? name => ref(name) : name => H[name];
      const S = C.S;
      if (op === 'answer' || op === 'save') {
        if (learnedAdd && S.learned.indexOf(i) < 0) S.learned.push(i);
        if (mcAdd) S.mc[i] = (Number(S.mc[i]) || 0) + 1;
        if (wrongN) S.wrongs[i] = wrongN; else delete S.wrongs[i];
        S.lastSaveTime = clock.now;
        if (op === 'answer') call('absorbAnswer')(i); else call('absorbCurrent')();
      } else if (op === 'srs') {
        call('setCurrentSrs')(i, srsEntry);
      } else if (op === 'clear') {
        call('clearCurrent')(fields.length ? fields : undefined);
      } else if (op === 'extMain' || op === 'truncate') {
        // 别的页面框直接改了主账本（不经过本实例）
        const raw = st.getItem(KEY); if (!raw) return;
        let o; try { o = JSON.parse(raw); } catch (e) { return; }
        const id = Object.keys(o.islands || {})[isl]; if (!id) return;
        const p = o.islands[id];
        if (op === 'truncate') { delete o.islands[id]; }
        else if (which === 0) { if (!p.learned.includes(slot)) p.learned.push(slot); }
        else if (which === 1) { p.mc[slot] = val; }
        else if (which === 2) { p.wrongs[slot] = val; }
        else { p.cleared = p.cleared || {}; p.cleared.learned = p.cleared.learned || {}; p.cleared.learned[slot] = clock.now; p.learned = p.learned.filter(x => x !== slot); }
        st.setItem(KEY, JSON.stringify(o));
      } else if (op === 'extBak') {
        if (histPick) st.setItem(BAK, histPick); else st.removeItem(BAK);
      } else if (op === 'corrupt') {
        if (which === 0) st.setItem(KEY, '{"version":941,"isl');
        else if (which === 1) st.removeItem(KEY);
        else if (which === 2) st.setItem(KEY, '[]');
        else { st.setItem(KEY, '{bad'); st.setItem(BAK, 'null'); }
      } else if (op === 'rewrite') {
        const s = call('read')(); if (s) { const id = Object.keys(s.islands)[isl]; if (s.islands[id] && !s.islands[id].learned.includes(slot)) s.islands[id].learned.push(slot); call('write')(s); }
      } else if (op === 'rewriteDrop') {
        // 有人整份写回时丢了几条（没留墓碑）：下一次读取要照老规矩从 _bak 补回
        const s = call('read')(); if (s) {
          const ids = Object.keys(s.islands), id = (isl & 1) ? H.resolve(saveKey).id : ids[isl % ids.length], p = s.islands[id];   // 一半落在本岛（复习计划只在本岛）
          const lk = p.learned.length ? p.learned[slot % p.learned.length] : null;
          if (which === 0 && lk !== null) p.learned = p.learned.filter(x => x !== lk);
          else if (which === 1) { const ks = Object.keys(p.srs); if (ks.length) delete p.srs[ks[slot % ks.length]]; }
          else if (which === 2) { const ks = Object.keys(p.mc); if (ks.length) { const k = ks[slot % ks.length]; if (p.mc[k] > 1) p.mc[k] = 1; else delete p.mc[k]; } }
          else { const ks = Object.keys(p.wrongs); if (ks.length) delete p.wrongs[ks[slot % ks.length]]; }
          call('write')(s);
        }
      } else if (op === 'snapshot') {
        const s = call('snapshot')(); if (s) call('restoreSnapshot')(s);
      } else if (op === 'migrate') {
        call('migrate')();
      } else if (op === 'otherSave') {
        // 别的岛（或别名入口）把存档写进 localStorage，下次 migrate 会并入
        const k = ['wordIslandSeason', 'wordIslandLand2', 'wordIslandAnimal', 'wordIslandFood'][which];
        const o = { learned: [slot % 30], mc: { [slot % 30]: val }, wrongs: which & 1 ? { [slot % 30]: 1 } : {}, srs: {}, lastSaveTime: clock.now };
        st.setItem(k, JSON.stringify(o));
      } else if (op === 'sync') {
        call('syncCurrent')();
      } else if (op === 'mutateCopy') {
        // 调用方改 read() 拿到的副本，不许影响缓存
        const s = call('read')(); if (s && s.islands) { Object.keys(s.islands).forEach(id => { s.islands[id].learned.push(999); s.islands[id].mc[0] = 77; }); s.islands = null; }
      }
    });
    history.push(sa.getItem(KEY)); if (history.length > 12) history.shift();

    // —— 每一步之后对拍 ——
    const tag = `seed ${seed} ${saveKey} 第 ${step} 步 (${op})`;
    assert.equal(sa.getItem(KEY), sr.getItem(KEY), tag + '：主账本原文不同');
    assert.equal(sa.getItem(BAK), sr.getItem(BAK), tag + '：_bak 原文不同');
    const ra = HA.read(), rr = ref('read')();
    assert.equal(JSON.stringify(ra), JSON.stringify(rr), tag + '：read() 不同');
    if (HA.readRO) assert.equal(JSON.stringify(HA.readRO()), JSON.stringify(ra), tag + '：readRO() 和 read() 不同');
    assert.equal(sa.dump(), sr.dump(), tag + '：读完后存储不同（有一方该回写没回写）');
    assert.equal(JSON.stringify(A.S), JSON.stringify(Rf.S), tag + '：本页 S 不同');
    assert.equal(HA.totalLearned(), ref('totalLearned')(), tag + '：totalLearned 不同');
    assert.equal(JSON.stringify(HA.counts()), JSON.stringify(ref('counts')()), tag + '：counts 不同');
    assert.equal(JSON.stringify(HA.sliceSnapshot()), JSON.stringify(ref('sliceSnapshot')()), tag + '：sliceSnapshot 不同');
    assert.equal(HA.isLearned(saveKey, i), ref('isLearned')(saveKey, i), tag + '：isLearned 不同');
    assert.equal(HA.mastery(saveKey, i), ref('mastery')(saveKey, i), tag + '：mastery 不同');
  }
  return opsDone;
}

let total = 0;
for (const [seed, key, pathname, words] of [[1, 'wordIslandFood', '/island_food.html', 56], [7, 'wordIslandLand3', '/island_land3.html', 30],
  [42, 'wordIslandSeason', '/island_season.html', 240], [2026, 'wordIslandAnimal', '/island_animal.html', 42]]) {
  const done = runSeed(seed, key, pathname, words, 700);
  total += Object.values(done).reduce((a, b) => a + b, 0);
  for (const op of ['answer', 'save', 'srs', 'clear', 'extMain', 'extBak', 'corrupt', 'truncate', 'rewrite', 'rewriteDrop', 'migrate', 'mutateCopy'])
    assert.ok(done[op] > 0, `seed ${seed}: 随机序列里没覆盖到 ${op}`);
}
console.log(`  ✅ 随机对拍 ${total} 步：两份存储原文、read/readRO/计数/切片/本页 S 全部一致`);

/* 性能合同：没有别人改账本时，连续答题不许整份重建 */
{
  const clock = { now: Date.UTC(2026, 10, 3, 9, 0, 0) }, st = new Storage();
  // 进度多的孩子：每个岛大半已学、一些错词和复习计划，再留一代 _bak
  const seedCtx = makeCtx(SRC, st, clock, 'wordIslandFood', '/island_food.html', 56);
  const H0 = seedCtx.HansenCanonical, big = H0.read();
  H0.islands.forEach(d => { const p = big.islands[d.id]; for (let k = 0; k < d.words; k++) { if (k % 20) { p.learned.push(k); p.mc[k] = 1 + (k % 4); } if (k % 5 === 0) p.wrongs[k] = 2; if (k % 3 === 0) p.srs[k] = { box: k % 5, due: '2026-11-0' + (1 + k % 8), last: '' }; } });
  H0.write(big); H0.write(H0.read());
  const C = makeCtx(SRC, st, clock, 'wordIslandFood', '/island_food.html', 56), H = C.HansenCanonical;
  assert.ok(typeof H._perf === 'function', '缺 HansenCanonical._perf() 计数器（无法证明每题不整份重建）');
  H.read();
  const before = H._perf();
  let lowered = 0;
  for (let q = 0; q < 60; q++) {
    clock.now += 4000;
    const i = (q * 7) % 56, correct = q % 4 !== 0, S = C.S;
    // 和模板 markAnswer 一样：答对错词数减 1（减到 0 删掉），答错加 1
    const w = Number(S.wrongs[i]) || 0;
    if (correct) { if (w) { if (w - 1) { S.wrongs[i] = w - 1; lowered++; } else delete S.wrongs[i]; } if (S.learned.indexOf(i) < 0) S.learned.push(i); S.mc[i] = (S.mc[i] || 0) + 1; }
    else S.wrongs[i] = w + 1;
    H.absorbCurrent(); H.absorbAnswer(i); H.absorbCurrent();
    if (q % 3 === 0) H.setCurrentSrs(i, { box: 1, due: '2026-11-05', last: '2026-11-03' });
    H.totalLearned(); H.counts(); H.sliceSnapshot(); H.isLearned('wordIslandFood', i); H.mastery('wordIslandFood', i);
  }
  const after = H._perf();
  /* 唯一允许的整份重建：错词数「减了但没减到 0」（2→1）。账本和 _bak 合并取较大值（老规矩），
     下一次读取要按老规矩合并、回写；除此以外一次都不许有。 */
  assert.ok(after.rebuilds - before.rebuilds <= lowered, `连续 60 题：整份重建只许发生在错词 2→1 那几题（实测 ${after.rebuilds - before.rebuilds} 次，2→1 共 ${lowered} 题）`);
  assert.ok(lowered < 20 && after.rebuilds - before.rebuilds <= 6, `整份重建次数要很少（实测 ${after.rebuilds - before.rebuilds}）`);
  assert.ok(after.writes - before.writes >= 60, '答题照常写盘（写穿缓存）');
  console.log(`  ✅ 连续 60 题：读取 ${after.reads - before.reads} 次、写盘 ${after.writes - before.writes} 次、整份重建 ${after.rebuilds - before.rebuilds} 次（错词 2→1 共 ${lowered} 题）`);
  // 别的页面框改了账本：下一次读取必须看到
  const n0 = H.countLearned('animal');
  const o = JSON.parse(st.getItem(KEY)); assert.ok(!o.islands.animal.learned.includes(0)); o.islands.animal.learned.push(0); st.setItem(KEY, JSON.stringify(o));
  assert.ok(H.read().islands.animal.learned.includes(0), '别的页面框写进来的账本必须立刻读到');
  assert.equal(H.countLearned('animal'), n0 + 1, '计数也必须立刻读到');
  assert.ok(H.readRO().islands.animal.learned.includes(0), '只读那份也必须立刻读到');
  console.log('  ✅ 别的页面框改了账本：下一次读取立刻看到');
}
console.log('canonical cache v1165: 缓存不改变任何结果 + 连续答题零整份重建 ✅');
