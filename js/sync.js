/* Sync between his own devices: pure logic, no network (also runs in Node for the tests).
   Every record carries `_u`, the time it last changed on any device. Deleting leaves a tombstone ("table/id": time).
   Merging keeps, for each record, whichever is newest: a version or its deletion. Both devices end up with the same file.
   The file is sealed on the device: passphrase -> PBKDF2-SHA256 -> AES-GCM-256, a fresh IV on every write.
   Google only ever holds the sealed file; the passphrase never leaves his devices. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Sync = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The private corners. They stay on the device unless he turns on "include private corners too".
  const PRIVATE = ['resetUses', 'dayLogs', 'questions', 'prayers', 'faithNotes', 'decisions'];
  // Never synced: settings travel separately; integrations hold sign-in tokens and per-device links.
  const LOCAL_ONLY = ['meta', 'integrations'];
  // Settings that belong to one screen, not to him.
  const DEVICE_KEYS = ['textSize', 'calmMotion'];
  const TOMB_DAYS = 180;
  const ITER = 310000;
  const DAY = 86400000;

  const tkey = (t, id) => t + '/' + id;
  const tableOf = (k) => k.slice(0, k.indexOf('/'));
  const inScope = (t, includePrivate) => !LOCAL_ONLY.includes(t) && (includePrivate || !PRIVATE.includes(t));
  const stamp = (r) => (r && typeof r._u === 'number' ? r._u : 0);

  // Stable JSON (sorted keys) so both devices compare and break ties the same way.
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  function stripDevice(s) {
    if (!s) return null;
    const out = { ...s };
    for (const k of DEVICE_KEYS) delete out[k];
    return out;
  }

  // What this device puts into the file.
  function collect(src, opts) {
    const inc = !!(opts && opts.includePrivate);
    const tables = {};
    for (const t of Object.keys(src.snapshot || {})) if (inScope(t, inc)) tables[t] = src.snapshot[t].slice();
    const tomb = {};
    for (const k of Object.keys(src.tomb || {})) if (inScope(tableOf(k), inc)) tomb[k] = src.tomb[k];
    return { v: 1, tables, tomb, settings: stripDevice(src.settings) };
  }

  // A newer version beats an older one; a deletion beats a version from the same moment or earlier.
  // Same moment, different content: the larger stable form wins, on every device alike.
  function newer(a, b) {
    const ua = stamp(a), ub = stamp(b);
    if (ua !== ub) return ua > ub ? a : b;
    return stable(a) >= stable(b) ? a : b;
  }

  function canonical(st) {
    if (!st) return '';
    const tables = {};
    for (const t of Object.keys(st.tables || {}).sort()) {
      const rows = st.tables[t].slice().sort((x, y) => (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0));
      if (rows.length) tables[t] = rows;
    }
    return stable({ tables, tomb: st.tomb || {}, settings: st.settings || null });
  }

  function merge(local, remote, opts) {
    const inc = !!(opts && opts.includePrivate);
    const now = (opts && opts.now) || Date.now();
    const oldest = now - TOMB_DAYS * DAY;
    const L = local || { tables: {}, tomb: {} };
    const R = remote || { tables: {}, tomb: {} };
    const out = { v: 1, tables: {}, tomb: {}, settings: null };
    const apply = { puts: [], dels: [], settings: null };

    const index = (st) => {
      const m = new Map();
      for (const t of Object.keys(st.tables || {})) for (const r of st.tables[t]) m.set(tkey(t, r.id), r);
      return m;
    };
    const lRec = index(L), rRec = index(R);
    const lTomb = L.tomb || {}, rTomb = R.tomb || {};
    const keys = new Set([...lRec.keys(), ...rRec.keys(), ...Object.keys(lTomb), ...Object.keys(rTomb)]);

    for (const k of keys) {
      const t = tableOf(k);
      if (!inScope(t, inc)) {
        // Not this device's to judge: keep the file's copy exactly as it is.
        if (rRec.has(k)) (out.tables[t] = out.tables[t] || []).push(rRec.get(k));
        if (rTomb[k] != null) out.tomb[k] = rTomb[k];
        continue;
      }
      const a = lRec.get(k), b = rRec.get(k);
      const rec = a && b ? newer(a, b) : a || b || null;
      const del = Math.max(lTomb[k] || 0, rTomb[k] || 0);
      const deleted = (lTomb[k] != null || rTomb[k] != null) && (!rec || del >= stamp(rec));
      if (deleted) {
        if (del >= oldest) out.tomb[k] = del;
        if (a) apply.dels.push([t, a.id]);
      } else {
        (out.tables[t] = out.tables[t] || []).push(rec);
        if (rec !== a && (!a || stable(a) !== stable(rec))) apply.puts.push([t, rec]);
      }
    }

    // Settings: one record, the newer copy wins; the device-only ones never move.
    const ls = L.settings || null, rs = R.settings || null;
    const win = ls && rs ? newer(stripDevice(ls), stripDevice(rs)) : stripDevice(ls || rs);
    out.settings = win;
    if (rs && ls && stable(stripDevice(ls)) !== stable(win)) {
      const keep = {};
      for (const k of DEVICE_KEYS) if (k in ls) keep[k] = ls[k];
      apply.settings = { ...win, ...keep };
    } else if (rs && !ls) apply.settings = win;

    apply.puts.sort((x, y) => (tkey(x[0], x[1].id) < tkey(y[0], y[1].id) ? -1 : 1));
    return { state: out, apply, upload: !remote || canonical(out) !== canonical(R) };
  }

  /* ---------- sealing the file ---------- */

  function b64e(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64d(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function deriveKey(subtle, passphrase, salt, iter) {
    const base = await subtle.importKey('raw', new TextEncoder().encode(String(passphrase).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function seal(subtle, key, salt, iter, obj, randomBytes) {
    const iv = randomBytes(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { v: 1, app: 'rawaq', kdf: { name: 'PBKDF2', hash: 'SHA-256', iter, salt: b64e(salt) }, alg: 'AES-GCM', iv: b64e(iv), ct: b64e(ct) };
  }

  const fail = (kind) => Object.assign(new Error(kind), { kind });

  async function open(subtle, key, env) {
    if (!env || env.v !== 1 || env.alg !== 'AES-GCM' || !env.iv || !env.ct || !env.kdf) throw fail('format');
    let plain;
    try { plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.ct)); } catch (e) { throw fail('passphrase'); }
    return JSON.parse(new TextDecoder().decode(plain));
  }

  return { PRIVATE, LOCAL_ONLY, DEVICE_KEYS, ITER, TOMB_DAYS, tkey, inScope, collect, merge, canonical, stable, b64e, b64d, deriveKey, seal, open };
});
