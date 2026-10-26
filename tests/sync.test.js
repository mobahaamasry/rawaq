// Sync between his own devices through one encrypted file in his Google Drive.
// Merge: newest change wins per record, deletions spread as tombstones, both devices end up the same.
// Envelope: passphrase -> PBKDF2 -> AES-GCM; a wrong passphrase or a changed file must fail loudly, never half-open.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/sync.js');
const subtle = globalThis.crypto.subtle;
const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const DAY = 86400000;
const NOW = Date.parse('2026-10-26T12:00:00Z');
const T0 = 10000; // "now" for the small hand-made timestamps below (pruning has its own test)
const rec = (id, u, extra) => ({ id, _u: u, text: id + '@' + u, ...extra });
const side = (tables, tomb, settings) => ({ tables, tomb: tomb || {}, settings: settings || { id: 'settings', _u: 0 } });
const ids = (st, t) => (st.tables[t] || []).map((r) => r.id).sort();
const find = (st, t, id) => (st.tables[t] || []).find((r) => r.id === id);

test('newest change wins per record, in both directions', () => {
  const a = side({ items: [rec('x', 200), rec('y', 100)] });
  const b = side({ items: [rec('x', 150), rec('y', 300)] });
  const m = S.merge(a, b, { now: T0 });
  assert.equal(find(m.state, 'items', 'x')._u, 200);
  assert.equal(find(m.state, 'items', 'y')._u, 300);
  // this device takes y from the file, and the file needs x from this device
  assert.deepEqual(m.apply.puts.map(([t, r]) => t + '/' + r.id + '@' + r._u), ['items/y@300']);
  assert.equal(m.upload, true);
});

test('new records on each side are both kept', () => {
  const m = S.merge(side({ wins: [rec('a', 1)] }), side({ wins: [rec('b', 2)] }), { now: T0 });
  assert.deepEqual(ids(m.state, 'wins'), ['a', 'b']);
});

test('a deletion spreads; an edit made after the deletion brings the record back', () => {
  // deleted here at 500, the other device still has the old version from 400
  let m = S.merge(side({ items: [] }, { 'items/x': 500 }), side({ items: [rec('x', 400)] }), { now: T0 });
  assert.deepEqual(ids(m.state, 'items'), []);
  assert.equal(m.state.tomb['items/x'], 500);
  assert.equal(m.upload, true);
  // the other device receives the tombstone and drops its copy
  m = S.merge(side({ items: [rec('x', 400)] }), side({ items: [] }, { 'items/x': 500 }), { now: T0 });
  assert.deepEqual(m.apply.dels, [['items', 'x']]);
  // but if it was edited later (600) than the deletion, the edit wins
  m = S.merge(side({ items: [rec('x', 600)] }), side({ items: [] }, { 'items/x': 500 }), { now: T0 });
  assert.deepEqual(ids(m.state, 'items'), ['x']);
  assert.equal(m.state.tomb['items/x'], undefined);
});

test('both devices converge: merging either way gives the same file, and a second merge changes nothing', () => {
  const a = side({ items: [rec('1', 10), rec('2', 50), rec('3', 70, { text: 'A' })], wins: [rec('w', 5)] }, { 'items/4': 90 });
  const b = side({ items: [rec('1', 20), rec('2', 40), rec('3', 70, { text: 'B' }), rec('4', 80)] }, { 'wins/w': 3 });
  const ab = S.merge(a, b, { now: T0 }).state, ba = S.merge(b, a, { now: T0 }).state;
  assert.deepEqual(S.canonical(ab), S.canonical(ba));
  // same timestamp, different content: a fixed rule picks one, on both devices
  assert.equal(find(ab, 'items', '3').text, find(ba, 'items', '3').text);
  const again = S.merge(ab, ab, { now: T0 });
  assert.equal(again.upload, false);
  assert.deepEqual(again.apply, { puts: [], dels: [], settings: null });
});

test('records from before sync existed (no stamp) lose to any stamped change', () => {
  const m = S.merge(side({ items: [{ id: 'x', text: 'old' }] }), side({ items: [rec('x', 1, { text: 'new' })] }), { now: T0 });
  assert.equal(find(m.state, 'items', 'x').text, 'new');
});

test('private corners stay off the file unless he turns them on, and nothing of the other device is dropped', () => {
  const snap = { meta: [{ id: 'install' }], integrations: [{ id: 'google', token: { access: 'SECRET-TOKEN' } }], items: [rec('i', 1)],
    questions: [rec('q', 1, { text: 'SECRET-QUESTION' })], dayLogs: [rec('d', 1)], resetUses: [rec('r', 1)], prayers: [rec('p', 1)], faithNotes: [rec('f', 1)], decisions: [rec('c', 1)] };
  const off = S.collect({ snapshot: snap, tomb: { 'questions/old': 5, 'items/z': 5 }, settings: { id: 'settings', _u: 1 } }, { includePrivate: false });
  const json = JSON.stringify(off);
  for (const t of S.PRIVATE) assert.equal(off.tables[t], undefined, t);
  assert.ok(!json.includes('SECRET-QUESTION'));
  assert.ok(!json.includes('SECRET-TOKEN'), 'sign-in tokens never sync');
  assert.equal(off.tables.meta, undefined);
  assert.equal(off.tomb['questions/old'], undefined);
  assert.equal(off.tomb['items/z'], 5);
  assert.deepEqual(S.PRIVATE.slice().sort(), ['dayLogs', 'decisions', 'faithNotes', 'prayers', 'questions', 'resetUses']);

  const on = S.collect({ snapshot: snap, tomb: {}, settings: { id: 'settings', _u: 1 } }, { includePrivate: true });
  assert.ok(JSON.stringify(on).includes('SECRET-QUESTION'));
  assert.ok(!JSON.stringify(on).includes('SECRET-TOKEN'));

  // phone has private sync off; the file holds the laptop's private tables: they pass through untouched
  const remote = side({ items: [], questions: [rec('q2', 9)] }, { 'faithNotes/f9': 9 });
  const m = S.merge(off, remote, { now: T0, includePrivate: false });
  assert.deepEqual(ids(m.state, 'questions'), ['q2']);
  assert.equal(m.state.tomb['faithNotes/f9'], 9);
  assert.ok(!m.apply.puts.some(([t]) => S.PRIVATE.includes(t)));
});

test('settings: the newer copy wins, but text size and calm motion stay per device', () => {
  const a = side({}, {}, { id: 'settings', _u: 100, lang: 'en', textSize: 'large', calmMotion: true });
  const b = side({}, {}, { id: 'settings', _u: 200, lang: 'ar', textSize: 'normal', calmMotion: false });
  const m = S.merge(a, b, { now: T0 });
  assert.equal(m.apply.settings.lang, 'ar');
  assert.equal(m.apply.settings.textSize, 'large');
  assert.equal(m.apply.settings.calmMotion, true);
  assert.equal(m.state.settings.textSize, undefined, 'device-only settings are not written to the file');
  // older settings on the file do not overwrite newer ones here
  assert.equal(S.merge(b, a, { now: T0 }).apply.settings, null);
});

test('old tombstones are let go after half a year', () => {
  const m = S.merge(side({}, { 'items/old': NOW - 200 * DAY, 'items/new': NOW - 10 * DAY }), side({}), { now: NOW });
  assert.deepEqual(Object.keys(m.state.tomb), ['items/new']);
});

test('no upload when the file already has everything', () => {
  const st = side({ items: [rec('x', 5)] }, { 'items/y': 7 }, { id: 'settings', _u: 3, lang: 'ar' });
  const m = S.merge(st, JSON.parse(JSON.stringify(st)), { now: T0 });
  assert.equal(m.upload, false);
});

test('first sync with an empty Drive uploads this device', () => {
  const m = S.merge(side({ items: [rec('x', 5)] }), null, { now: T0 });
  assert.equal(m.upload, true);
  assert.deepEqual(ids(m.state, 'items'), ['x']);
});

/* ---------- envelope ---------- */

test('envelope: right passphrase opens it; the file never shows the content', async () => {
  const salt = rand(16);
  const key = await S.deriveKey(subtle, 'ياسمين الشام 2026', salt, S.ITER);
  const data = { v: 1, tables: { items: [rec('x', 1, { text: 'SECRET-MARKER-سر' })] } };
  const env = await S.seal(subtle, key, salt, S.ITER, data, rand);
  const raw = JSON.stringify(env);
  assert.ok(!raw.includes('SECRET-MARKER'));
  assert.equal(env.kdf.iter, S.ITER);
  assert.ok(S.ITER >= 300000);
  const key2 = await S.deriveKey(subtle, 'ياسمين الشام 2026', S.b64d(env.kdf.salt), env.kdf.iter);
  assert.deepEqual(await S.open(subtle, key2, env), data);
  // a fresh IV every time: the same data never encrypts the same way twice
  const env2 = await S.seal(subtle, key, salt, S.ITER, data, rand);
  assert.notEqual(env2.ct, env.ct);
  assert.notEqual(env2.iv, env.iv);
});

test('negative control: a wrong passphrase or a changed file fails, it never opens to garbage', async () => {
  const salt = rand(16);
  const key = await S.deriveKey(subtle, 'right one', salt, 1000);
  const env = await S.seal(subtle, key, salt, 1000, { v: 1, tables: {} }, rand);
  const wrong = await S.deriveKey(subtle, 'right onE', salt, 1000);
  await assert.rejects(S.open(subtle, wrong, env), (e) => e.kind === 'passphrase');
  const ct = S.b64d(env.ct); ct[5] ^= 1;
  await assert.rejects(S.open(subtle, key, { ...env, ct: S.b64e(ct) }), (e) => e.kind === 'passphrase');
  await assert.rejects(S.open(subtle, key, { v: 99 }), (e) => e.kind === 'format');
});

test('base64 helpers round-trip every byte value', () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(S.b64d(S.b64e(all)), all);
});
