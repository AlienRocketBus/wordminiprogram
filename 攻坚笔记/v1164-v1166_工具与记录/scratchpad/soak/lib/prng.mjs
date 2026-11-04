/* prng.mjs — seeded randomness. Every concern (one phone's network, the DB lag, one kid's answers …) gets its
 * own stream derived from (run seed, stream name), so removing one element of a scenario does not reshuffle the
 * random draws of all the others (this is what makes shrinking work). */

export function hash32(str) {
  /* FNV-1a + murmur3 finalizer */
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rand {
  constructor(seed, name) { this.f = mulberry32(hash32(String(seed) + '/' + String(name || ''))); }
  float() { return this.f(); }
  range(lo, hi) { return lo + (hi - lo) * this.f(); }
  int(lo, hi) { return Math.floor(lo + (hi - lo + 1) * this.f()); }   /* inclusive */
  chance(p) { return p > 0 && this.f() < p; }
  pick(a) { return a[Math.floor(this.f() * a.length)]; }
  /* weighted pick from {key: weight} */
  pickW(o) {
    const ks = Object.keys(o); let tot = 0;
    for (const k of ks) tot += Math.max(0, o[k]);
    let x = this.f() * tot;
    for (const k of ks) { x -= Math.max(0, o[k]); if (x < 0) return k; }
    return ks[ks.length - 1];
  }
}

export function stream(seed, name) { return new Rand(seed, name); }
