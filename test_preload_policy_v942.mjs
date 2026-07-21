import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_preload.js', import.meta.url), 'utf8');

async function scenario({connection, online = true, home = false} = {}) {
  const timers = [];
  const events = {audio:[], images:[], fetch:[], maxAudio:0};
  let activeAudio = 0;

  class Storage {
    constructor() { this.data = {}; }
    get length() { return Object.keys(this.data).length; }
    key(i) { return Object.keys(this.data)[i] ?? null; }
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; }
    setItem(k, v) { this.data[k] = String(v); }
    removeItem(k) { delete this.data[k]; }
  }

  class FakeAudio {
    constructor(src) { this._src = src || ''; this.listeners = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    removeAttribute(name) { if (name === 'src') this._src = ''; }
    set src(value) { this._src = String(value || ''); }
    get src() { return this._src; }
    load() {
      if (!this._src) return;
      events.audio.push(this._src);
      activeAudio++;
      events.maxAudio = Math.max(events.maxAudio, activeAudio);
      timers.push(() => {
        activeAudio--;
        if (this.listeners.loadeddata) this.listeners.loadeddata();
      });
    }
  }

  class FakeImage {
    set src(value) {
      this._src = String(value || '');
      if (this._src) events.images.push(this._src);
      timers.push(() => { if (this.onload) this.onload(); });
    }
    get src() { return this._src || ''; }
  }

  const storage = new Storage();
  const document = {
    readyState:'complete',
    currentScript:{src:'http://local/hansen_preload.js?v=942'},
    addEventListener(){},
    getElementsByTagName(name) { return name === 'script' ? [{src:'http://local/hansen_preload.js?v=942'}] : []; },
    getElementById(id) { return home && id === 'islandFrameWrap' ? {} : null; },
    querySelector(sel) {
      return home && sel === 'a.island[href^="island_"]'
        ? {getAttribute(){ return 'island_animal.html'; }} : null;
    }
  };
  const fetch = async url => {
    events.fetch.push(String(url));
    return {
      async text() { return '<script src="hansen_coin_wallet.js?v=942"></script><img src="icons/a.webp?v=942">'; },
      async blob() { return {}; }
    };
  };
  class FakeDOMParser {
    parseFromString() {
      return {
        querySelectorAll(sel) {
          if (sel === 'script[src]') return [{getAttribute(){ return 'hansen_coin_wallet.js?v=942'; }}];
          if (sel === 'img[src]') return [{getAttribute(){ return 'icons/a.webp?v=942'; }}];
          return [];
        }
      };
    }
  }

  const context = {
    console, JSON, Math, Date, Number, String, Object, RegExp, URL,
    parseInt, isFinite, Promise, Uint32Array,
    document,
    navigator:{connection, onLine:online},
    localStorage:storage,
    sessionStorage:new Storage(),
    location:{href:'http://local/index.html', origin:'http://local'},
    Audio:FakeAudio,
    Image:FakeImage,
    DOMParser:FakeDOMParser,
    AbortController:class { constructor(){ this.signal = {}; } abort(){} },
    fetch,
    allW:[
      {en:'alpha', ex:'Alpha example.'}, {en:'beta', ex:'Beta example.'},
      {en:'gamma', ex:'Gamma example.'}, {en:'delta', ex:'Delta example.'},
      {en:'epsilon', ex:'Epsilon example.'}
    ],
    WORD_MAP:{alpha:'words/alpha.mp3', beta:'words/beta.mp3', gamma:'words/gamma.mp3', delta:'words/delta.mp3', epsilon:'words/epsilon.mp3'},
    SENTENCE_MAP:{'Alpha example.':1},
    speak(){},
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout(){},
    setInterval(fn) { timers.push(fn); return timers.length; },
    clearInterval(){},
    requestIdleCallback(fn) { timers.push(fn); return timers.length; },
    addEventListener(){},
    dispatchEvent(){},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_preload.js'});

  for (let round = 0; round < 80; round++) {
    while (timers.length) {
      const batch = timers.splice(0, timers.length);
      for (const fn of batch) fn();
    }
    await Promise.resolve();
    await Promise.resolve();
    if (!timers.length && round > 4) break;
  }
  return {events, policy:context.HansenPreloadPolicy};
}

for (const [name, options] of [
  ['missing Network Information API', {connection:undefined}],
  ['save-data', {connection:{saveData:true, effectiveType:'4g'}}],
  ['3g', {connection:{saveData:false, effectiveType:'3g'}}],
  ['offline', {connection:{saveData:false, effectiveType:'4g'}, online:false}],
]) {
  const {events, policy} = await scenario(options);
  assert.equal(policy.canBackgroundDownload(), false, `${name}: policy must fail closed`);
  assert.deepEqual(events.audio, [], `${name}: no background audio`);
  assert.deepEqual(events.images, [], `${name}: no background images`);
  assert.deepEqual(events.fetch, [], `${name}: no background fetch`);
}

{
  const {events, policy} = await scenario({connection:{saveData:false, effectiveType:'4g'}});
  assert.equal(policy.canBackgroundDownload(), true);
  assert.equal(events.maxAudio <= 3, true, `audio concurrency ${events.maxAudio} > 3`);
  assert.equal(events.audio.length, 5, 'only the five current-island words should preload');
  assert.equal(events.audio.every(url => /^words\/(?:alpha|beta|gamma|delta|epsilon)\.mp3\?v215$/.test(url)), true);
  assert.equal(events.images.length <= 8, true, `boss image count ${events.images.length} > 8`);
  assert.equal(events.fetch.some(url => url.includes('sentences/')), false, 'sentences must remain on demand');
}

{
  const {events} = await scenario({connection:{saveData:false, effectiveType:'4g'}, home:true});
  const islandHtml = events.fetch.filter(url => /island_[a-z0-9]+\.html/i.test(url));
  assert.equal(islandHtml.length, 1, 'home shell may warm at most one island HTML');
  assert.equal(events.audio.length, 0, 'home shell must not batch-preload word audio');
  assert.equal(events.images.length <= 8, true);
  assert.equal(events.fetch.some(url => url.includes('sentences/')), false);
}

console.log('✅ v942 预载策略：未知/弱网/省流/离线零后台请求，4G仅当前岛且音频并发≤3、Boss≤8、例句按需');
