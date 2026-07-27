/* ============================================================
 * hansen_cloud_save_v965.js — 匿名云存档 + 恢复码（v965）
 * ============================================================
 * 用户 2026-07-22 决策：零注册云存档。身份=一串恢复码（记忆水晶密钥），
 * 不是账号；换手机输入密钥即可完整回档。企业主体已备，未来微信登录可无缝合并。
 *
 * 架构（全部复用既有系统，零新造轮子）：
 *   载荷   = HansenBackup.exportCode()（现成三重校验的官方备份串）
 *   恢复   = HansenBackup.parse() + restore()（现成日志式原子恢复链路）
 *   身份   = 16位 Crockford Base32 密钥（本机生成，永不上传原文）
 *   文档ID = SHA-256('hansen-doc-v1:'+密钥) —— 服务器只见哈希，无法枚举
 *   加密   = AES-GCM，密钥派生自 SHA-256('hansen-aes-v1:'+密钥)
 *            —— 服务器全程零知识：只存密文，丢库也读不出孩子的存档
 *   后端   = 腾讯云开发 CloudBase（内嵌 ESM SDK 按需动态 import，全离线打包）
 *            未配置 envId 时优雅降级为"待开通"引导态，游戏零影响。
 *
 * 存储键：hansen_cloud_state_v965 = {key, createdAt, lastUpAt, lastHash}
 * 测试缝：window.__HSN_CLOUD_MOCK_PROVIDER 优先于真实后端（Node 回归用）
 * ============================================================ */
(function(){
  'use strict';

  var K_STATE = 'hansen_cloud_state_v965';
  var COLLECTION = 'hansen_saves';
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford：无 I L O U
  var SYNC_MIN_GAP = 45 * 1000;                          // 防抖：两次上云至少间隔45s
  var enc = new TextEncoder(), dec = new TextDecoder();

  /* ---------- 小工具 ---------- */
  function cfg(){ return (window.HANSEN_CLOUD_CONFIG && typeof HANSEN_CLOUD_CONFIG === 'object') ? HANSEN_CLOUD_CONFIG : {}; }
  function readState(){
    try{ var o = JSON.parse(localStorage.getItem(K_STATE) || 'null');
      return (o && typeof o === 'object') ? o : {}; }catch(e){ return {}; }
  }
  function writeState(patch){
    var s = readState();
    Object.keys(patch || {}).forEach(function(k){ s[k] = patch[k]; });
    try{ localStorage.setItem(K_STATE, JSON.stringify(s)); }catch(e){}
    return s;
  }
  function b64(buf){ var u = new Uint8Array(buf), s=''; for(var i=0;i<u.length;i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(str){ var s = atob(str), u = new Uint8Array(s.length); for(var i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
  function sha256(str){ return crypto.subtle.digest('SHA-256', enc.encode(str)); }
  function hex(buf){ var u=new Uint8Array(buf), s=''; for(var i=0;i<u.length;i++) s+=('0'+u[i].toString(16)).slice(-2); return s; }
  function fnv(str){ var h=0x811c9dc5; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h*0x01000193)>>>0; } return ('0000000'+h.toString(16)).slice(-8); }

  /* ---------- 密钥：生成 / 规范化 / 展示 ---------- */
  function genKey(){
    var bytes = new Uint8Array(10); crypto.getRandomValues(bytes);
    var bits = 0, acc = 0, out = '';
    for(var i=0;i<bytes.length;i++){
      acc = (acc << 8) | bytes[i]; bits += 8;
      while(bits >= 5){ out += ALPHABET[(acc >>> (bits-5)) & 31]; bits -= 5; }
    }
    return out.slice(0,16);
  }
  function normalizeKey(input){
    var s = String(input||'').toUpperCase().replace(/[^0-9A-Z]/g,'')
      .replace(/O/g,'0').replace(/[IL]/g,'1').replace(/U/g,'V');
    if(s.length !== 16) return null;
    for(var i=0;i<16;i++) if(ALPHABET.indexOf(s[i]) < 0) return null;
    return s;
  }
  function prettyKey(k){ return k ? (k.slice(0,4)+'-'+k.slice(4,8)+'-'+k.slice(8,12)+'-'+k.slice(12,16)) : ''; }
  /* 🔴v1017 账号即存档：
     原先密钥是**每台设备本地随机生成**的，既决定存档位置(docId)又决定加解密。
     结果换设备即便登录同一账号也找不回来——这是"登录了却没用"的根因。
     改为：已登录时用**账号 uid 确定性推导**出同一把密钥，
     任何设备登录同一账号 → 同一 docId + 同一解密钥 → 进度自然跟着账号走。
     未登录时仍用本机密钥，行为不变。
     说明：uid 推导的密钥并非"秘密"，真正的隔离靠 hansen_saves 集合的
     「仅创建者可读写」权限；此处加密是纵深防御。 */
  var ACCT_PREFIX = 'HSNACCT';
  /* 🔴v1047 决定性修正：改用**手机号**作为账号标识，uid 仅作兜底。
     两台设备登录同一账号却算出不同密钥 —— 因为密钥原本由 uid 推导，
     而 uid 存在各自的 localStorage 里：
       · 一台可能存着登录前匿名会话留下的旧 uid；
       · 云端会话重建时 uid 也可能与上次不同。
     结果就是手机A ⑩ 显示"有存档"、手机B 却"没有" —— 两台各开各的柜子。
     手机号是这个账号**唯一在所有设备上都相同、且永不变**的标识，
     用它推导密钥，两台设备必然算出同一把钥匙。
     兜底顺序：手机号 → 用户名 → uid（老账号或异常情况仍可工作）。 */
  function accountIdent(){
    try {
      var A = window.HansenAuth;
      if (!(A && typeof A.isSignedIn === 'function' && A.isSignedIn())) return '';
      var lc = (typeof A.readLocal === 'function') ? A.readLocal() : null;
      /* 手机号归一：去掉空格与 +86 等前缀差异，保证两端拼出的字符串完全一致 */
      if (lc && lc.phone) {
        var ph = String(lc.phone).replace(/[\s\-()]/g, '');
        ph = ph.replace(/^\+?86/, '');
        if (/^\d{6,15}$/.test(ph)) return 'p:' + ph;
      }
      if (lc && lc.username) return 'n:' + String(lc.username).trim().toLowerCase();
      var u = (typeof A.currentUser === 'function') ? A.currentUser() : null;
      if (u && u.uid) return 'u:' + String(u.uid);
      if (lc && lc.uid) return 'u:' + String(lc.uid);
    } catch (e) {}
    return '';
  }
  /* 保留原名供外部与自检面板使用；语义已变为"账号标识" */
  function accountUid(){ return accountIdent(); }
  /* 由 uid 推出 16 位大写密钥(与本机密钥同格式, 复用全部加解密与 docId 管线) */
  /* 🔴v1036: v1033 之前 keyFromUid 用的字符集含 L/U，会算出另一把钥匙。
     兼容读取时需要能重算那把旧钥匙，才能把旧地址上的存档取回来。 */
  function legacyKeyFromUid(uid){
    var CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    var s = ACCT_PREFIX + ':' + uid;
    for (var i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) >>> 0) * 16777619 >>> 0;
      h2 = ((h2 + s.charCodeAt(i) * (i + 7)) >>> 0) * 2654435761 >>> 0;
    }
    var out = '';
    for (var j = 0; j < 16; j++) {
      h1 = (h1 * 1664525 + 1013904223) >>> 0;
      h2 = (h2 ^ (h1 >>> 13)) >>> 0;
      out += CH.charAt(((h1 ^ h2) >>> 0) % CH.length);
    }
    return out.slice(0,4)+'-'+out.slice(4,8)+'-'+out.slice(8,12)+'-'+out.slice(12,16);
  }
  function keyFromUid(uid){
    /* 🔴v1033 决定性修复：这里原本用的字符集含 L 和 U，
       而 normalizeKey 会把 U→V、L→1、I→1、O→0 做归一化。
       于是写入用原始密钥算 docId、读取用归一化密钥算 docId，
       两者指向**不同的文档地址** ——
       表现就是"上传显示成功，拉取却说云端没有这把密钥对应的存档"。
       改为直接复用 ALPHABET，从源头保证生成的密钥不会被归一化改写。 */
    var CH = ALPHABET;
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    var s = ACCT_PREFIX + ':' + uid;
    for (var i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) >>> 0) * 16777619 >>> 0;
      h2 = ((h2 + s.charCodeAt(i) * (i + 7)) >>> 0) * 2654435761 >>> 0;
    }
    var out = '';
    for (var j = 0; j < 16; j++) {
      h1 = (h1 * 1664525 + 1013904223) >>> 0;
      h2 = (h2 ^ (h1 >>> 13)) >>> 0;
      out += CH.charAt(((h1 ^ h2) >>> 0) % CH.length);   /* >>>0 保证非负, 否则 charAt(负数) 返回空串导致密钥变短 */
    }
    return out.slice(0,4)+'-'+out.slice(4,8)+'-'+out.slice(8,12)+'-'+out.slice(12,16);
  }
  function ensureKey(){
    var uid = accountUid();
    if (uid) return keyFromUid(uid);      /* 已登录 → 账号密钥 */
    var s = readState();
    if(s.key && normalizeKey(s.key)) return s.key;
    var k = genKey();
    writeState({ key: k, createdAt: Date.now() });
    return k;
  }
  /* 供登录流程调用：账号是否已有云端存档 */
  function accountHasCloudSave(){
    return accountCloudInfo().then(function(i){ return !!(i && i.exists); });
  }
  /* 🔴v1029 取云端存档的**元信息**，用于让用户看着真实数字做取舍，
     而不是面对一句干巴巴的「两边都有进度」盲选。
     返回 {exists, updatedAt, appVersion}；出错时 exists=null 表示**查不到**，
     调用方必须把"查不到"与"确认没有"区别对待——绝不能把查不到当成没有而覆盖云端。 */
  function accountCloudInfo(){
    var uid = accountUid();
    if (!uid) return Promise.resolve({ exists:false, reason:'not-signed-in' });
    var p = provider();
    if (!p) return Promise.resolve({ exists:null, reason:'not-configured' });
    /* 🔴v1046 决定性修复：这里原本用 keyFromUid(uid) 直接算地址——
       那是**带连字符**的原始密钥；而上传与拉取都用 normalizeKey() 去掉连字符后再算。
       三处只有这一处没归一化，于是查的是另一个地址：
         · 自检 ⑩ 谎报"云端还没有你的存档"（其实有）；
         · 更致命的是 syncOnLogin 以它为依据 →
           判定"云端是空的" → 走上传分支 → **从来没执行过恢复**
           → 新设备登录后等级永远停在 Lv.1。
       这也解释了为什么"上传成功、拉取成功、往返自检成功"却唯独 ⑩ 说没有。 */
    var accKey = normalizeKey(keyFromUid(uid)) || keyFromUid(uid);
    return docIdOf(accKey)
      .then(function(id){ return p.get(id); })
      .then(function(row){
        if (!row || !row.payload) return { exists:false };
        var pl = row.payload || {};
        return { exists:true, updatedAt: row.updatedAt || pl.ts || 0, appVersion: pl.appVersion || '' };
      })
      .catch(function(e){ return { exists:null, reason:String(e && e.message || e) }; });
  }

  /* ---------- 加密信封（零知识） ---------- */
  function aesKeyOf(saveKey){
    return sha256('hansen-aes-v1:'+saveKey).then(function(d){
      return crypto.subtle.importKey('raw', d, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
    });
  }
  function docIdOf(saveKey){ return sha256('hansen-doc-v1:'+saveKey).then(hex); }
  function sealPayload(saveKey, plainText){
    var iv = new Uint8Array(12); crypto.getRandomValues(iv);
    return aesKeyOf(saveKey).then(function(key){
      return crypto.subtle.encrypt({name:'AES-GCM', iv: iv}, key, enc.encode(plainText));
    }).then(function(ct){
      return { v:1, iv:b64(iv.buffer), ct:b64(ct),
               app:'wordadventure', appVersion: currentAppVersion(), ts: Date.now() };
    });
  }
  function openPayload(saveKey, envelope){
    if(!envelope || envelope.v !== 1 || !envelope.iv || !envelope.ct)
      return Promise.reject(new Error('云端数据格式无法识别'));
    return aesKeyOf(saveKey).then(function(key){
      return crypto.subtle.decrypt({name:'AES-GCM', iv: unb64(envelope.iv)}, key, unb64(envelope.ct));
    }).then(function(pt){ return dec.decode(pt); },
      function(){ throw new Error('密钥不对，或数据已损坏（解不开这份记忆水晶）'); });
  }
  function currentAppVersion(){
    try{ if(window.HansenBackup && typeof HansenBackup.build === 'function'){
      var b = HansenBackup.build(); if(b && b.appVersion) return b.appVersion; } }catch(e){}
    return 0;
  }

  /* ---------- 后端提供者 ---------- */
  var _cb = null;
  function cloudbaseProvider(){
    var envId = String(cfg().envId || '').trim();
    if(!envId) return null;
    return {
      name: 'cloudbase',
      _app: function(){
        if(_cb) return Promise.resolve(_cb);
        /* 🔴v1028 关键修复：已登录时**复用账号会话**，绝不再另开匿名身份。
           原逻辑无论是否登录都自建实例并 signInAnonymously()，
           而 hansen_saves 权限是「仅创建者可读写」——
           设备A(匿名身份X)写的存档，设备B(匿名身份Y)根本读不到，
           于是出现「刚上传成功、立刻拉取却说云端没有这把密钥对应的存档」。
           手机号账号从头到尾没被用上，这才是跨设备找不回进度的真正原因。 */
        try {
          var A = window.HansenAuth;
          if (A && typeof A.isSignedIn === 'function' && A.isSignedIn() && typeof A._app === 'function') {
            return Promise.resolve(A._app()).then(function (app) {
              if (!app) throw new Error('账号会话不可用');
              _cb = app;      /* 与账号同一个实例、同一个身份 */
              return app;
            });
          }
        } catch (e) {}
        return import('./vendor_cloudbase_esm_v965.js?v=1052').then(function(m){
          var cloudbase = m.default || m;
          var initOpt = { env: envId };
          if(cfg().region) initOpt.region = String(cfg().region);
          var app = cloudbase.init(initOpt);
          var auth = app.auth({ persistence: 'local' });
          var signed;
          try{
            if(auth && typeof auth.anonymousAuthProvider === 'function')
              signed = auth.anonymousAuthProvider().signIn();
            else if(auth && typeof auth.signInAnonymously === 'function')
              signed = auth.signInAnonymously();
            else signed = Promise.resolve();
          }catch(e){ signed = Promise.reject(e); }
          return Promise.resolve(signed).catch(function(err){
            // 已有登录态时部分版本会抛错，探测后放行
            if(auth && typeof auth.getLoginState === 'function')
              return Promise.resolve(auth.getLoginState()).then(function(st){ if(!st) throw err; });
            throw err;
          }).then(function(){ _cb = app; return app; });
        });
      },
      put: function(docId, data){
        return this._app().then(function(app){
          return app.database().collection(COLLECTION).doc(docId).set(data);
        });
      },
      get: function(docId){
        /* 🔴v1041 双路读取 + 明确区分「没有」与「读不到」。
           用户往返自检结果：写入成功、读回失败 —— 说明文档确实建出来了，
           但 doc().get() 在权限规则下被判定"不是你的数据"，于是返回**空结果而非报错**。
           这里补两件事：
             ① doc(id).get() 返回空时，改用 where({_id:id}).get() 再试一次
                （两种查询在权限规则下的表现有时并不一致）；
             ② 把"取到了空"与"抛异常"区分开，供诊断面板定位。 */
        var self = this;
        return self._app().then(function(app){
          var col = app.database().collection(COLLECTION);
          return col.doc(docId).get().then(function(res){
            var row = res && res.data;
            if(Array.isArray(row)) row = row[0];
            if(row) return row;
            /* 主路取空 → 走 where 兜底 */
            return col.where({ _id: docId }).limit(1).get().then(function(r2){
              var rows = r2 && r2.data;
              var one = Array.isArray(rows) ? rows[0] : rows;
              return one || null;
            }).catch(function(){ return null; });
          }).catch(function(e){
            /* 主路抛错 → 同样尝试 where，全失败才把原始错误抛出 */
            return col.where({ _id: docId }).limit(1).get().then(function(r2){
              var rows = r2 && r2.data;
              var one = Array.isArray(rows) ? rows[0] : rows;
              if(one) return one;
              throw e;
            }).catch(function(){ throw e; });
          });
        });
      }
    };
  }
  function provider(){
    if(window.__HSN_CLOUD_MOCK_PROVIDER) return window.__HSN_CLOUD_MOCK_PROVIDER;  // 测试缝
    return cloudbaseProvider();
  }
  function friendly(err){
    var m = String(err && err.message || err || '');
    if(/env|Env|ENV_ID|invalid env/i.test(m)) return '云环境 ID 无效，请核对配置';
    if(/domain|origin|refer|非法来源|whitelist/i.test(m)) return '当前网址还没加进云端安全域名（见开通指南第3步）';
    if(/anonymous|ANONYMOUS|登录|auth/i.test(m)) return '云端匿名登录未开通（见开通指南第2步）';
    if(/permission|denied|security|规则/i.test(m)) return '数据库安全规则未放行（见开通指南第4步）';
    if(/network|fetch|timeout|Failed to fetch/i.test(m)) return '网络不通，稍后再试';
    return m.slice(0, 120) || '未知错误';
  }

  /* ---------- 上云 / 回档 ---------- */
  var _busy = false;
  function syncNow(opts){
    opts = opts || {};
    var p = provider();
    if(!p) return Promise.resolve({ ok:false, reason:'not-configured' });
    /* 🔴v1003: 云存档改为**用户主动开启**才联网。
       未开启时一个网络请求都不发——既避免在用户不知情时上传存档，
       也避免 envId 已填但控制台未配完时页面报 net::ERR_FAILED。
       用户点「立即同步」走 force 分支，成功后自动置 enabled。 */
    if(!opts.force && !readState().enabled)
      return Promise.resolve({ ok:false, reason:'not-enabled' });
    if(_busy) return Promise.resolve({ ok:false, reason:'busy' });
    var st = readState();
    if(!opts.force && st.lastUpAt && (Date.now() - st.lastUpAt) < SYNC_MIN_GAP)
      return Promise.resolve({ ok:false, reason:'cooldown' });
    if(!(window.HansenBackup && typeof HansenBackup.exportCode === 'function'))
      return Promise.resolve({ ok:false, reason:'backup-unavailable' });
    var code;
    try{ code = HansenBackup.exportCode(); }
    catch(e){ return Promise.resolve({ ok:false, reason:'export-failed', error: friendly(e) }); }
    var h = fnv(code);
    /* 内容未变→无条件跳过(force 只绕过冷却,不制造重复流量) */
    /* 🔴v1039 关键修复：原判据只看"内容有没有变"，**连 force 也照样跳过**，
       于是出现最致命的一种假象——
         早先上传过一次(写到旧地址)并记下内容指纹；
         此后地址算法或账号变了，用户点「立刻上传」→ 内容没变 → 指纹相同 → 直接跳过
         → 返回 ok:true，界面显示「上传成功 ✔」，而**新地址上一个字都没写**。
       前六版反复失败正是因为此：每次改完地址算法，重新上传都被这条跳过，
       数据从未搬到新地址，读取自然永远找不到。
       改为：① force 一律真写（这才是 force 的语义）；
             ② 非 force 时，除内容指纹外还要比对**上次写入的地址**，
                地址变了(算法变更/换账号)必须重写。 */
    var key = normalizeKey(ensureKey()) || ensureKey();
    _busy = true;
    return docIdOf(key).then(function(targetId){
      if (!opts.force && st.lastHash === h && st.lastDocId === targetId) {
        _busy = false;
        return { ok:true, skipped:true, reason:'unchanged' };
      }
      return doUpload(key, code, h, targetId);
    }).catch(function(e){
      _busy = false;
      return { ok:false, reason:'upload-failed', error: friendly(e) };
    });
  }

  /* 真正的写入（从 syncNow 抽出，便于上面先算地址再决定是否要写） */
  function doUpload(key, code, h, targetId){
    var p = provider();
    return sealPayload(key, code).then(function(envelope){
      return p.put(targetId, { payload: envelope, updatedAt: Date.now(), app: 'wordadventure' });
    }).then(function(){
      writeState({ lastUpAt: Date.now(), lastHash: h, lastDocId: targetId, enabled: true });  /* 🔴v1039: 记下写到哪儿, 地址变了下次必重写 */  /* 🔴v1003: 首次成功即开启自动同步 */
      _busy = false; renderCard();
      return { ok:true, bytes: code.length };
    }, function(err){
      _busy = false; renderCard();
      return { ok:false, reason:'upload-failed', error: friendly(err) };
    });
  }
  function fetchWithKey(inputKey){
    var key = normalizeKey(inputKey);
    if(!key) return Promise.reject(new Error('密钥格式不对：应为 16 位字母数字（可带横线）'));
    var p = provider();
    if(!p) return Promise.reject(new Error('云端尚未开通配置'));
    /* 🔴v1036 兼容读取：历史上存档地址算法变过两代，
       旧版本上传的存档躺在**旧地址**，新代码只查新地址就会报
       「云端没有这把密钥对应的存档」——数据其实还在，只是找错了门。
       这里把历史地址依次试一遍，任一命中即可；命中旧地址后**顺手搬到新地址**，
       此后不再依赖兼容路径。
       候选地址（按可能性排序）：
         ① 归一化密钥（v1033 起的写入方式，也是当前标准）
         ② 原始密钥（含连字符，v1033 之前的写入方式）
         ③ 旧字符集推导的账号密钥（v1033 之前 keyFromUid 含 L/U，会算出另一把钥匙） */
    var cands = [key];
    var raw = String(inputKey || '');
    if (raw && raw !== key) cands.push(raw);
    try {
      var uid = accountUid();
      if (uid) {
        /* 🔴v1047: v1047 之前用 uid 推导密钥, 存档可能落在那个地址上;
           把 uid 形态的候选也加进来, 老存档才不至于丢。 */
        try {
          var A2 = window.HansenAuth;
          var lc2 = (A2 && typeof A2.readLocal === 'function') ? A2.readLocal() : null;
          var rawUid = (lc2 && lc2.uid) ? String(lc2.uid) : '';
          if (rawUid) {
            [keyFromUid(rawUid), legacyKeyFromUid(rawUid)].forEach(function(k){
              if (k && cands.indexOf(k) < 0) cands.push(k);
              var nk2 = normalizeKey(k);
              if (nk2 && cands.indexOf(nk2) < 0) cands.push(nk2);
            });
          }
        } catch (e) {}
        var legacy = legacyKeyFromUid(uid);
        if (legacy && cands.indexOf(legacy) < 0) cands.push(legacy);
        var legacyN = normalizeKey(legacy);
        if (legacyN && cands.indexOf(legacyN) < 0) cands.push(legacyN);
      }
    } catch (e) {}

    var tried = [];
    function attempt(i) {
      if (i >= cands.length) {
        throw new Error('云端没有这把密钥对应的存档（已尝试 ' + tried.length + ' 个历史地址）');
      }
      var cand = cands[i];
      return docIdOf(cand).then(function (id) {
        tried.push(id.slice(0, 8));
        return p.get(id);
      }).then(function (row) {
        if (!row || !row.payload) return attempt(i + 1);
        /* 解密要用写入时的那把钥匙，与地址一一对应 */
        return openPayload(cand, row.payload).then(function (code) {
          if (i > 0) {
            /* 命中旧地址 → 迁移到新地址，之后就走标准路径 */
            try {
              sealPayload(key, code).then(function (env) {
                return docIdOf(key).then(function (nid) {
                  return p.put(nid, { payload: env, updatedAt: Date.now(), app: 'wordadventure' });
                });
              }).catch(function () {});
            } catch (e) {}
          }
          return { key: cand, code: code, updatedAt: row.updatedAt || (row.payload && row.payload.ts) || 0,
                   migratedFrom: i > 0 ? i : 0 };
        }).catch(function () { return attempt(i + 1); });
      }).catch(function (e) {
        if (i + 1 < cands.length) return attempt(i + 1);
        throw e;
      });
    }
    return attempt(0);
  }
  function restoreWithKey(inputKey){
    return fetchWithKey(inputKey).then(function(got){
      if(!(window.HansenBackup && typeof HansenBackup.parse === 'function'))
        throw new Error('备份模块不可用');
      var parsed = HansenBackup.parse(got.code);
      var when = got.updatedAt ? new Date(got.updatedAt).toLocaleString() : '未知时间';
      var msg = '找到云端存档（上传于 '+when+'，版本 v'+(parsed && parsed.appVersion || '?')+'）。\n\n'
              + '恢复会用它覆盖本机当前进度，确定吗？';
      if(!window.confirm(msg)) return { ok:false, reason:'cancelled' };
      var r;
      try{ r = HansenBackup.restore(parsed); }
      catch(e1){ r = HansenBackup.restore(got.code); }   // 兼容字符串签名
      writeState({ key: got.key, lastHash: fnv(got.code), lastUpAt: Date.now(), enabled: true });
      renderCard();
      return { ok:true, result:r };
    });
  }
  function selfTest(){
    var p = provider();
    if(!p) return Promise.resolve({ ok:false, msg:'未配置：请按《云存档开通指南》完成 4 步后填入 envId' });
    var probe = 'probe-'+Date.now();
    return sealPayload(ensureKey(), probe).then(function(env0){
      return docIdOf(ensureKey()+':selftest').then(function(id){
        return p.put(id, { payload: env0, updatedAt: Date.now(), app:'selftest' })
          .then(function(){ return p.get(id); })
          .then(function(row){ return openPayload(ensureKey(), row.payload); })
          .then(function(txt){
            return { ok: txt === probe, msg: txt === probe ? '云端读写与加解密全部正常 ✅' : '回读不一致' };
          });
      });
    }).catch(function(err){ return { ok:false, msg: friendly(err) }; });
  }

  /* ---------- 自动同步节律 ---------- */
  function autoHooks(){
    try{
      document.addEventListener('visibilitychange', function(){
        if(document.hidden) syncNow({});
      });
      window.addEventListener('pagehide', function(){ syncNow({}); });
      setInterval(function(){ syncNow({}); }, 5 * 60 * 1000);
    }catch(e){}
  }

  /* ---------- 设置页 ☁️ 卡片 ---------- */
  var _revealed = false;
  function renderCard(){
    try{
      var host = document.getElementById('hsnBackupSection');
      if(!host) return;
      var el = document.getElementById('hsnCloudCard');
      /* 🔴v966修复：孩子正在输入恢复密钥时后台同步触发重绘会清空输入框——
       * 输入框有内容或持焦时只更新状态行，绝不整卡重建 */
      var _inp0 = document.getElementById('hsnCloudRestoreKey');
      if(el && _inp0 && (_inp0.value || document.activeElement === _inp0)){
        var _st0 = document.getElementById('hsnCloudStatus');
        if(_st0) _st0.innerHTML = statusHtml();
        return;
      }
      if(!el){
        el = document.createElement('div');
        el.id = 'hsnCloudCard';
        el.style.cssText = 'margin:0 0 14px;padding:12px 14px;border-radius:14px;border:1px solid #38bdf855;background:linear-gradient(135deg,#0c4a6e33,#07304a33);color:#e2e8f0;font-size:13px;line-height:1.9';
        host.insertBefore(el, host.firstChild);
      }
      var st = readState(), key = st.key ? prettyKey(st.key) : '';
      function statusHtml(){
        var p2 = provider(), s2 = readState();
        if(!p2) return '<span style="color:#fbbf24">待开通</span> · 按《云存档开通指南》4 步完成后自动点亮';
        if(s2.lastUpAt) return '<span style="color:#34d399">已同步</span> · '+new Date(s2.lastUpAt).toLocaleString();
        /* 🔴v1003: 云存档改为主动开启制, 文案必须与行为一致——
           在用户点过「立即同步」之前不会自动上云, 不能再说"玩一会儿会自动上云" */
        return '<span style="color:#93c5fd">已就绪</span> · 点「立即同步」开启云存档';
      }
      var status = statusHtml();
      el.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<b>☁️ 云存档（换手机不丢档）</b><span id="hsnCloudStatus" style="font-size:12px">'+status+'</span></div>'
        + '<div style="margin-top:6px;font-size:12px;color:#94a3b8">你的记忆水晶密钥（拍照保存，换手机就靠它）：</div>'
        + '<div id="hsnCloudKey" role="button" tabindex="0" style="margin:4px 0 8px;padding:8px 10px;border-radius:10px;background:#0f172a;border:1px dashed #38bdf866;font-family:monospace;font-size:16px;letter-spacing:1px;cursor:pointer;user-select:all;min-height:24px">'
        + (key ? (_revealed ? key : '••••-••••-••••-•••• （点一下显示）') : '（进入游戏后自动生成）') + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        + '<button id="hsnCloudSync" class="btn" style="min-height:44px;padding:8px 14px;border-radius:10px;border:0;background:#0ea5e9;color:#fff;font-weight:700;cursor:pointer">立即同步</button>'
        + '<button id="hsnCloudTest" class="btn" style="min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid #38bdf866;background:transparent;color:#7dd3fc;cursor:pointer">自检</button>'
        + '</div>'
        + '<div style="margin-top:10px;font-size:12px;color:#94a3b8">换新手机？输入旧密钥恢复：</div>'
        + '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">'
        + '<input id="hsnCloudRestoreKey" placeholder="ABCD-EFGH-JKLM-NPQR" style="flex:1;min-width:180px;min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-family:monospace;letter-spacing:1px" />'
        + '<button id="hsnCloudRestore" class="btn" style="min-height:44px;padding:8px 14px;border-radius:10px;border:0;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer">恢复到此设备</button>'
        + '</div>'
        + '<div id="hsnCloudMsg" style="margin-top:6px;font-size:12px;color:#94a3b8;min-height:16px"></div>';
      function msg(t, ok){ var m=document.getElementById('hsnCloudMsg'); if(m){ m.textContent=t; m.style.color = ok===false?'#f87171':(ok?'#34d399':'#94a3b8'); } }
      var kEl = document.getElementById('hsnCloudKey');
      function reveal(){ _revealed = true; ensureKey(); renderCard();
        try{ navigator.clipboard && navigator.clipboard.writeText(prettyKey(readState().key)); }catch(e){} }
      kEl.onclick = reveal;
      kEl.onkeydown = function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); reveal(); } };
      document.getElementById('hsnCloudSync').onclick = function(){
        msg('同步中…');
        syncNow({force:true}).then(function(r){
          if(r.ok) msg(r.skipped ? '内容没变化，无需上传 ✅' : '已上云 ✅', true);
          else msg(r.reason==='not-configured' ? '云端待开通（见指南）' : ('同步失败：'+(r.error||r.reason)), false);
        });
      };
      document.getElementById('hsnCloudTest').onclick = function(){
        msg('自检中…');
        selfTest().then(function(r){ msg(r.msg, r.ok); });
      };
      document.getElementById('hsnCloudRestore').onclick = function(){
        var v = document.getElementById('hsnCloudRestoreKey').value;
        msg('查找云端存档…');
        restoreWithKey(v).then(function(r){
          if(r.ok) msg('恢复成功！页面即将刷新加载新存档…', true), setTimeout(function(){ location.reload(); }, 1200);
          else if(r.reason==='cancelled') msg('已取消');
        }).catch(function(err){ msg(String(err.message||err), false); });
      };
    }catch(e){}
  }
  function watchSettings(){
    try{
      var mo = new MutationObserver(function(){
        if(document.getElementById('hsnBackupSection') && !document.getElementById('hsnCloudCard')) renderCard();
      });
      mo.observe(document.body, { childList:true, subtree:true });
    }catch(e){ }
    renderCard();
  }

  function boot(){ ensureKey(); autoHooks(); watchSettings(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  try {
    document.addEventListener('hsn-auth-changed', function () {
      _cb = null;   /* 🔴v1028: 账号变了, 云端身份也必须跟着变 */
    });
  } catch (e) {}

  window.HansenCloudSave = {
    syncNow: syncNow, restoreWithKey: restoreWithKey, fetchWithKey: fetchWithKey,
    /* 🔴v1028: 登录/登出后必须作废已缓存的实例——
       否则先匿名初始化、后登录的场景下, 仍会拿着匿名身份读写, 跨设备依旧找不回。 */
    resetApp: function(){ _cb = null; },
    selfTest: selfTest, ensureKey: ensureKey,
    /* 🔴v1037 往返自检：不再靠推理。
       在用户设备上一次跑完「写→立刻读回」，把每一步的原始结果都带出来，
       从而把问题精确定位到**地址 / 身份 / 权限**其中之一：
         · 写失败            → 权限或会话问题(错误原文会说)
         · 写成功但读不回     → 归属(_openid)不匹配，即"仅创建者可读写"挡住了
         · 写成功且读得回     → 通道完全正常，那么真正的存档是"从来没写进去过"
       这三种情况的修法完全不同，此前六版之所以反复失败，
       正是因为始终没有办法区分它们。 */
    roundTrip: function(){
      var out = { step:'start', envId:'', sessionUid:'', key:'', docId:'',
                  wrote:null, readBack:null, ownerMatch:null, error:'' };
      try { out.envId = (window.HANSEN_CLOUD_CONFIG||{}).envId || ''; } catch(e){}
      var pv = provider();
      if (!pv) { out.step='no-provider'; out.error='云服务未配置'; return Promise.resolve(out); }
      var probeKey = normalizeKey(ensureKey()) || ensureKey();
      out.key = probeKey;
      var pid = null;
      /* 探针文档独立于真实存档，绝不覆盖用户数据 */
      /* 🔴v1041: 探针地址改为**每次随机**。
         此前用固定地址，若该地址上已躺着「别的身份创建的文档」，
         `set` 可能看似成功而 `get` 被「仅创建者可读写」挡住 →
         诊断结论会误报成"通道有问题"。随机地址保证测的是纯净的新建路径。
         两台手机结果不同（一台绿、一台"写进去读不回"）正是这个原因。 */
      var probeSalt = 'probe:' + probeKey + ':' + Date.now() + ':' + Math.random().toString(36).slice(2,8);
      return docIdOf(probeSalt).then(function(id){
        pid = id; out.docId = id.slice(0,12) + '…';
        out.step = 'writing';
        return pv.put(id, { payload:{ v:1, probe:true, ts:Date.now() }, updatedAt:Date.now(), app:'wordadventure' });
      }).then(function(){
        out.wrote = true; out.step = 'reading-back';
        return pv.get(pid);
      }).then(function(row){
        out.readBack = !!(row && row.payload);
        if (row) {
          out.ownerMatch = true;
          try { out.sessionUid = row._openid || row._uid || ''; } catch(e){}
        }
        out.step = out.readBack ? 'ok' : 'wrote-but-cannot-read';
        /* 🔴v1041: 随机地址下仍"写成功却读不回"，只可能是集合权限模型的问题：
           「仅创建者可读写」会按 _openid 过滤，写入时注入的身份与读取时的会话
           一旦不同（匿名 ↔ 账号、或会话中途重建），读取就会拿到空结果而非报错。 */
        if (!out.readBack) out.hint = 'permission-model';
        return out;
      }).catch(function(e){
        out.error = String((e && (e.message || e.errMsg || e.code)) || e).slice(0,200);
        if (out.wrote === null) out.step = 'write-failed';
        else if (out.readBack === null) out.step = 'read-failed';
        return out;
      });
    },
    accountHasCloudSave: accountHasCloudSave, accountCloudInfo: accountCloudInfo, accountUid: accountUid,
    getKey: function(){ return readState().key || ''; },
    _debug: { genKey: genKey, normalizeKey: normalizeKey, prettyKey: prettyKey,
              docIdOf: docIdOf, sealPayload: sealPayload, openPayload: openPayload,
              fnv: fnv, readState: readState, renderCard: renderCard }
  };
})();
