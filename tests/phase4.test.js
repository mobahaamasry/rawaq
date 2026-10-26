// Ground truth for Phase 4: tonight's moon, search, sharing into the inbox.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const near = (phase, target) => Math.min(Math.abs(phase - target), Math.abs(phase - target - 1), Math.abs(phase - target + 1));

/* ---------- moon phase: eclipses are exact new / full moons ---------- */
test('moon phase: solar eclipses are new moons', () => {
  for (const iso of ['2017-08-21T18:26:00Z', '2019-07-02T19:23:00Z', '2024-04-08T18:18:00Z']) {
    const m = C.moonPhase(Date.parse(iso));
    assert.ok(near(m.phase, 0) <= 0.03, iso + ' phase ' + m.phase);
    assert.ok(m.illum < 0.02, iso + ' illum ' + m.illum);
  }
});

test('moon phase: lunar eclipses are full moons', () => {
  for (const iso of ['2022-11-08T10:59:00Z', '2025-03-14T06:59:00Z']) {
    const m = C.moonPhase(Date.parse(iso));
    assert.ok(near(m.phase, 0.5) <= 0.03, iso + ' phase ' + m.phase);
    assert.ok(m.illum > 0.98, iso + ' illum ' + m.illum);
  }
});

test('moon phase: a week after new moon is a waxing half; a week after full is waning', () => {
  const firstQ = C.moonPhase(Date.parse('2024-04-08T18:18:00Z') + 7.38 * C.DAY);
  assert.ok(Math.abs(firstQ.illum - 0.5) < 0.08);
  assert.equal(firstQ.waxing, true);
  assert.equal(firstQ.name, 'firstQuarter');
  const lastQ = C.moonPhase(Date.parse('2025-03-14T06:59:00Z') + 7.38 * C.DAY);
  assert.equal(lastQ.waxing, false);
  assert.equal(lastQ.name, 'lastQuarter');
  assert.equal(C.moonPhase(Date.parse('2025-03-14T06:59:00Z')).name, 'full');
  assert.equal(C.moonPhase(Date.parse('2024-04-08T18:18:00Z')).name, 'new');
});

/* ---------- search ---------- */
test('Arabic normalization: diacritics, alef forms, taa marbuta, digits', () => {
  assert.equal(C.normalizeAr('أَحْمَد'), C.normalizeAr('احمد'));
  assert.equal(C.normalizeAr('مدرسة'), C.normalizeAr('مدرسه'));
  assert.equal(C.normalizeAr('إلى'), C.normalizeAr('الي'));
  assert.equal(C.normalizeAr('ـــرواق'), 'رواق');
  assert.equal(C.normalizeAr('Python ١٣'), 'python 13');
});

function state() {
  return {
    wins: [{ id: 'w1', date: '2026-10-05', text: 'شرحت الموديل للفريق', toldWho: 'ماما' }],
    items: [{ id: 'i1', title: 'Write the abstract', status: 'open' }],
    projects: [{ id: 'p1', name: 'تعديل ورقة البحث', nextStep: 'اقرا تعليق المراجع التاني', status: 'active' }],
    ideas: [{ id: 'd1', text: 'Sleep spindles and memory' }],
    inbox: [{ id: 'x1', text: 'اسأل عن الداتا', createdAt: '2026-10-12T00:00:00Z' }],
    letters: [{ id: 'l1', title: 'For after the exams', body: 'SECRET-LETTER-BODY', openOn: '2027-01-23' }],
    papers: [{ id: 'pa', title: 'Brain simulation', venue: 'Frontiers' }],
    opportunities: [{ id: 'o1', name: 'Summer School 2027', org: 'Example Institute', location: 'Zürich' }],
    curiosity: [{ id: 'c1', title: 'Soul (Pixar)', note: '' }],
    waiting: [{ id: 'wa', what: 'Comments on the draft', who: 'د. سامر' }],
    rawNotes: [{ id: 'r1', body: 'الليلة تعبان', createdAt: '2026-10-09T00:00:00Z' }],
    questions: [{ id: 'q', question: 'SECRET-QUESTION' }],
    dayLogs: [{ id: '2026-10-20', feeling: 'SECRET-FEELING' }],
    resetUses: [{ id: 'z', feeling: 'SECRET-RESET' }],
    prayers: [{ id: '2026-10-20', at: 'SECRET-PRAYER' }],
    faithNotes: [{ id: 'f', text: 'SECRET-FAITH' }],
  };
}

test('search index never holds open questions, feelings, Reset, faith, or letter bodies', () => {
  const idx = C.buildSearchIndex(state());
  const all = JSON.stringify(idx);
  for (const s of ['SECRET-QUESTION', 'SECRET-FEELING', 'SECRET-RESET', 'SECRET-PRAYER', 'SECRET-FAITH', 'SECRET-LETTER-BODY']) assert.ok(!all.includes(s), s);
  assert.deepEqual(C.SEARCH_SKIPS.slice().sort(), ['dayLogs', 'decisions', 'faithNotes', 'prayers', 'questions', 'resetUses']);
});

test('search: all words must match, across Arabic spellings and English case', () => {
  const idx = C.buildSearchIndex(state());
  const ids = (q) => C.search(idx, q).map((r) => r.type + ':' + r.id);
  assert.deepEqual(ids('الفريق'), ['win:w1']);
  assert.deepEqual(ids('ماما'), ['win:w1'], 'who you told is searchable');
  assert.deepEqual(ids('abstract'), ['task:i1']);
  assert.deepEqual(ids('المراجع'), ['project:p1'], 'next tiny step is searchable');
  assert.deepEqual(ids('sleep memory'), ['idea:d1']);
  assert.deepEqual(ids('sleep exams'), [], 'every word has to match');
  assert.deepEqual(ids('zurich'), [], 'ü is not stripped');
  assert.deepEqual(ids('Zürich'), ['opportunity:o1']);
  assert.deepEqual(ids('exams'), ['letter:l1'], 'letter titles are searchable');
  assert.deepEqual(ids('سامر'), ['waiting:wa']);
  assert.deepEqual(ids('تعبان'), ['raw:r1']);
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('  '), []);
  for (const r of C.search(idx, 'a')) assert.ok(r.route.startsWith('#/'), 'every result knows where to go');
});

/* ---------- share into the inbox ---------- */
test('sharing from another app: text, title and link become one inbox line', () => {
  assert.deepEqual(C.shareToInbox({ title: 'Paper', text: 'Look at this https://x.org/a', url: '' }), { text: 'Paper — Look at this https://x.org/a', link: 'https://x.org/a' });
  assert.deepEqual(C.shareToInbox({ url: 'https://x.org' }), { text: 'https://x.org', link: 'https://x.org' });
  assert.deepEqual(C.shareToInbox({ title: 'A', text: 'A' }), { text: 'A', link: null });
  assert.deepEqual(C.shareToInbox({ title: 'Read later', url: 'https://y.org/p' }), { text: 'Read later — https://y.org/p', link: 'https://y.org/p' });
  assert.equal(C.shareToInbox({}), null);
  assert.equal(C.shareToInbox({ title: '  ', text: '' }), null);
});
