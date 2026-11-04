# WeChat platform constraints — research notes (2026-11-03)

Access: curl/WebFetch to developers.weixin.qq.com, mp.weixin.qq.com, docs.cloudbase.net,
cloud.tencent.com, servicewechat.com, api.weixin.qq.com, tcb-api.tencentcloudapi.com -> proxy 403 / ENOTFOUND.
Only WebSearch (summarised snippets) worked. npm registry reachable.

## Measured (sandbox)
- npm: miniprogram-ci latest 2.1.31 (2026-03-12); @cloudbase/js-sdk latest 3.11.0, v2 line 2.32.0;
  @cloudbase/adapter-wx_mp 1.4.1 (2026-10-20).
- @cloudbase/js-sdk@2.30.0 ships `miniprogram_dist/` (2.3 MB) and depends on @cloudbase/adapter-wx_mp ^1.3.1;
  auth.js contains `signInWithOpenId` (wx.login code -> grantProviderToken(provider_id = appId)) and
  `signInWithPhoneAuth`; API hosts: `<env>.api.tcloudbasegateway.com`, `tcb-api.tencentcloudapi.com`.
  adapter getAppSign() returns wx.getAccountInfoSync().miniProgram.appId; captcha path "need to impl captcha data".
- snapshot v1163: 87 hansen_*.js = 53,073 lines; `document.` refs 1,635; `localStorage` refs 3,514 (js+html);
  `iframe` refs 112; eval/new Function in 3 files; 1,915 mp3 = 33.5 MB; 455 images = 113 MB (whole snapshot 190 MB);
  index.html 4,359 lines; template.html 8,469; land_template.html 8,274.
- H5 features with platform impact: 抽卡(hansen_gacha.js, coins), 排行榜, PK rooms (CloudBase DB polling),
  friends with fixed quick-phrases only (hansen_friends_v1106.js:8), 宠物, 签到, 金币, 付费主题(coins).
  Auth: phone SMS + username/password (hansen_auth_v1004.js:4, 311-347, 451).

See StructuredOutput for the full sourced list.
