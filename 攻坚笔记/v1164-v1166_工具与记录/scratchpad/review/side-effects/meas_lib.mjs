/* 计数工具：按「手机(uid) × 操作类型 × 集合」数模拟云端收到的请求 */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
export { H };

export function classify(e) {
  if (e.method === 'OPTIONS') return null;
  if (e.path && e.path.startsWith('/auth/')) return 'AUTH ' + e.method + ' ' + e.path.replace('/auth/v1/', '');
  if (e.path === '/web') {
    const a = String(e.action || '').replace('database.', '');
    let op = a;
    if (a === 'queryDocument') op = e.docId ? 'get(id)' : 'where';
    else if (a === 'countDocument') op = 'count';
    else if (a === 'addDocument') op = 'add';
    else if (a === 'updateDocument') op = e.docId ? 'update(id)' : 'updateWhere';
    else if (a === 'deleteDocument') op = e.docId ? 'remove(id)' : 'removeWhere';
    return op + ' ' + (e.collection || '?');
  }
  return 'OTHER ' + e.method + ' ' + e.host + e.path;
}
export const isRead = (k) => /^(get\(id\)|where|count) /.test(k);
export const isWrite = (k) => /^(add|update\(id\)|updateWhere|remove\(id\)|removeWhere) /.test(k);
export const isAuth = (k) => /^AUTH /.test(k);

/* 窗口内某个 uid 的请求统计 */
export function tally(emu, { uid, t0, t1, filter } = {}) {
  const out = { total: 0, reads: 0, writes: 0, auth: 0, other: 0, by: {} };
  for (const e of emu.log) {
    if (uid && e.uid !== uid) continue;
    if (t0 && e.t < t0) continue;
    if (t1 && e.t >= t1) continue;
    const k = classify(e);
    if (!k) continue;
    if (filter && !filter(k, e)) continue;
    out.total++;
    out.by[k] = (out.by[k] || 0) + 1;
    if (isRead(k)) out.reads++; else if (isWrite(k)) out.writes++; else if (isAuth(k)) out.auth++; else out.other++;
  }
  return out;
}
export function fmt(t, secs) {
  const per = (n) => secs ? ` (${(n / secs * 60).toFixed(1)}/min, ${(n / secs).toFixed(2)}/s)` : '';
  const lines = [`  total=${t.total} reads=${t.reads}${per(t.reads)} writes=${t.writes}${per(t.writes)} auth=${t.auth} other=${t.other}`];
  for (const [k, v] of Object.entries(t.by).sort((a, b) => b[1] - a[1])) lines.push(`     ${String(v).padStart(5)}  ${k}`);
  return lines.join('\n');
}
/* 时间线：每 10 秒一格 */
export function timeline(emu, uid, t0, t1, bucketMs = 10000) {
  const n = Math.ceil((t1 - t0) / bucketMs);
  const r = new Array(n).fill(0), w = new Array(n).fill(0);
  for (const e of emu.log) {
    if (e.uid !== uid || e.t < t0 || e.t >= t1) continue;
    const k = classify(e); if (!k) continue;
    const i = Math.floor((e.t - t0) / bucketMs);
    if (isRead(k)) r[i]++; else if (isWrite(k)) w[i]++;
  }
  return { r, w };
}
