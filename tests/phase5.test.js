// Ground truth for Phase 5: honest pattern notes, exam season + rest week, decisions, share type guessing.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const TZ = 'Asia/Damascus';
const at = (day, hm) => Date.parse(day + 'T' + hm + ':00+03:00');
const W3 = '2026-10-17', W2 = '2026-10-10', W1 = '2026-10-03'; // three Saturday-start weeks; W3 is the reviewed one
const cfg = (over) => ({ tz: TZ, dayEndHour: 5, now: { day: '2026-10-24', lm: 600 }, quiet: {}, ...over });

const morning = { id: 'm', weekday: 1, start: '09:00', end: '10:00', type: 'study', protected: false, from: W1 }; // Mondays
const evening = { id: 'e', weekday: 3, start: '20:00', end: '21:00', type: 'study', protected: false, from: W1 }; // Wednesdays
const monday = (w) => C.addDays(w, 2), wednesday = (w) => C.addDays(w, 4);
const sess = (day, hm, extra) => ({ id: day + hm, day, category: 'study', minutes: 30, startedAt: at(day, hm), ...extra });

function st(over) {
  return { slots: [morning, evening], sessions: [], reviews: [], goals: [], ...over };
}

/* ---------- pattern notes ---------- */
test('pattern notes negative control: a week where both slots are used says nothing', () => {
  const sessions = [W1, W2, W3].flatMap((w) => [sess(monday(w), '09:05'), sess(wednesday(w), '20:10')]);
  assert.deepEqual(C.patternNotes(st({ sessions }), W3, cfg()), []);
});

test('evening sessions not happening for the third week, mornings are → suggest mornings', () => {
  const sessions = [W1, W2, W3].map((w) => sess(monday(w), '09:05'));
  const notes = C.patternNotes(st({ sessions }), W3, cfg());
  assert.equal(notes[0].kind, 'timeOfDay');
  assert.equal(notes[0].bucket, 'evening');
  assert.equal(notes[0].better, 'morning');
  assert.equal(notes[0].weeks, 3);
  assert.ok(!notes.some((n) => n.kind === 'slot' && n.slotId === 'e'), 'no duplicate note for the same evening slot');
});

test('two weeks are not a pattern', () => {
  const sessions = [sess(monday(W1), '09:05'), sess(wednesday(W1), '20:10'), sess(monday(W2), '09:05'), sess(monday(W3), '09:05')];
  assert.deepEqual(C.patternNotes(st({ sessions }), W3, cfg()), []);
});

test('a session started inside the slot counts even without a link to it', () => {
  const sessions = [W1, W2, W3].flatMap((w) => [sess(monday(w), '09:05'), sess(wednesday(w), '19:45')]); // 15 min early is fine
  assert.deepEqual(C.patternNotes(st({ sessions }), W3, cfg()), []);
});

test('slots still ahead in the reviewed week are not judged', () => {
  const fri = { ...evening, weekday: 5 }; // Fridays; reviewing on Thursday evening, before Friday
  const sessions = [W1, W2, W3].map((w) => sess(monday(w), '09:05'));
  const notes = C.patternNotes(st({ slots: [morning, fri], sessions }), W3, cfg({ now: { day: '2026-10-22', lm: C.toLogical(20 * 60, 5) } }));
  assert.deepEqual(notes, [], 'only two weeks of Fridays have happened yet');
});

test('a single slot that never happens, when the rest of its time of day does', () => {
  const tue = { id: 't', weekday: 2, start: '10:00', end: '11:00', type: 'study', protected: false, from: '2026-09-26' };
  const sessions = [W1, W2, W3].flatMap((w) => [sess(monday(w), '09:05'), sess(wednesday(w), '20:10')]);
  const notes = C.patternNotes(st({ slots: [morning, evening, tue], sessions }), W3, cfg());
  assert.deepEqual(notes.map((n) => n.kind + ':' + (n.slotId || '')), ['slot:t']);
});

test('ceiling overrides, repeated blockers, "few" sessions, not sharing, a body goal', () => {
  const both = [W1, W2, W3].flatMap((w) => [sess(monday(w), '09:05', { overrideCeiling: true }), sess(wednesday(w), '20:10')]);
  const reviews = [W1, W2, W3].map((w) => ({ id: w, sessions: 'few', blockers: ['sleep', 'none'], shared: 'no', body: { g1: 'no' }, doneAt: 'x' }));
  const notes = C.patternNotes(st({ sessions: both, reviews, goals: [{ id: 'g1', text: 'cardio' }] }), W3, cfg());
  assert.deepEqual(notes.map((n) => n.kind), ['fewSessions', 'overrides', 'blocker', 'bodyGoal', 'notShared']);
  assert.equal(notes.find((n) => n.kind === 'blocker').blocker, 'sleep');
});

test('«خليها هيك» keeps a note quiet for a while', () => {
  const sessions = [W1, W2, W3].map((w) => sess(monday(w), '09:05'));
  assert.deepEqual(C.patternNotes(st({ sessions }), W3, cfg({ quiet: { 'tod:evening': '2026-11-07' } })), []);
  assert.equal(C.patternNotes(st({ sessions }), W3, cfg({ quiet: { 'tod:evening': '2026-10-10' } }))[0].kind, 'timeOfDay', 'quiet period over');
});

/* ---------- exam season ---------- */
const exam = { id: 'x', name: 'امتحانات الفصل', date: '2027-01-25' };

test('exam season: two weeks before, through the exam; then one rest week', () => {
  const m = (d, o) => (C.examSeason([exam], d, o) || {}).mode || null;
  assert.equal(m('2027-01-10'), null);
  assert.equal(m('2027-01-11'), 'season');
  assert.equal(C.examSeason([exam], '2027-01-11').stage, 'twoWeeks');
  assert.equal(C.examSeason([exam], '2027-01-20').stage, 'lastWeek');
  assert.equal(m('2027-01-25'), 'season');
  assert.equal(C.examSeason([exam], '2027-01-25').stage, 'examDays');
  assert.equal(m('2027-01-26'), 'rest');
  assert.equal(m('2027-02-01'), 'rest');
  assert.equal(m('2027-02-02'), null);
  assert.equal(m('2027-01-15', { auto: false, restWeek: true }), null, 'switched off');
  assert.equal(m('2027-01-27', { auto: true, restWeek: false }), null, 'no rest week if he turned it off');
});

test('exam season runs to the last exam day when there is one', () => {
  const multi = { ...exam, endDate: '2027-02-05' };
  assert.equal(C.examSeason([multi], '2027-01-30').mode, 'season');
  assert.equal(C.examSeason([multi], '2027-01-30').stage, 'examDays');
  assert.equal(C.examSeason([multi], '2027-02-06').mode, 'rest');
});

const planBase = (over) => ({
  day: '2027-01-15', lm: 0, energy: 4, weekKey: '2027-01-09', dayEndHour: 5, focusKey: null,
  projects: [{ id: 'ex', name: 'exam prep', tier: 'main', status: 'active', examId: 'x' }, { id: 'tm', name: 'team', tier: 'main', status: 'active' },
    { id: 'bg', name: 'reading', tier: 'background', status: 'active', nextStep: 'open a paper' }],
  items: [
    { id: 'i1', title: 'email the team', projectId: 'tm', pinnedDate: '2027-01-15', status: 'open' },
    { id: 'i2', title: 'cardiology chapter', projectId: 'ex', pinnedDate: '2027-01-15', status: 'open' },
  ],
  slots: [
    { id: 's1', weekday: 5, start: '16:00', end: '17:00', type: 'study', protected: false },
    { id: 's2', weekday: 5, start: '18:00', end: '19:00', type: 'team', protected: false },
  ],
  ...over,
});

test('Today in exam season: studying only; everything else waits; background paused', () => {
  const plain = C.todayPlan(planBase());
  assert.equal(plain.main.length, 3);
  assert.equal(plain.background.length, 1);
  const season = C.todayPlan(planBase({ season: 'season' }));
  assert.deepEqual(season.main.map((c) => c.key), ['i:i2', 's:s1']);
  assert.equal(season.heldBack, true);
  assert.deepEqual(season.background, []);
});

test('Today in the rest week: nothing to do', () => {
  const rest = C.todayPlan(planBase({ season: 'rest' }));
  assert.deepEqual(rest.main, []);
  assert.deepEqual(rest.background, []);
  assert.equal(rest.restWeek, true);
});

/* ---------- decisions ---------- */
test('decisions: locked until "not before", then due once', () => {
  const d = { id: 'd', status: 'open', notBefore: '2026-11-20' };
  assert.equal(C.decisionLocked(d, '2026-11-19'), true);
  assert.equal(C.decisionLocked(d, '2026-11-20'), false);
  assert.equal(C.decisionLocked({ ...d, notBefore: null }, '2026-11-19'), false);
  assert.deepEqual(C.decisionsDue([d], '2026-11-19'), []);
  assert.deepEqual(C.decisionsDue([d], '2026-11-21').map((x) => x.id), ['d']);
  assert.deepEqual(C.decisionsDue([{ ...d, dueSeen: true }], '2026-11-21'), []);
  assert.deepEqual(C.decisionsDue([{ ...d, status: 'decided' }], '2026-11-21'), []);
});

/* ---------- share: what kind of thing is this link? ---------- */
test('shared links: videos, papers, films, books; anything else is a topic', () => {
  const g = (u) => C.guessCurioType(u, '');
  assert.equal(g('https://www.youtube.com/watch?v=abc'), 'video');
  assert.equal(g('https://youtu.be/abc'), 'video');
  assert.equal(g('https://www.instagram.com/reel/xyz/'), 'video');
  assert.equal(g('https://www.tiktok.com/@a/video/1'), 'video');
  assert.equal(g('https://doi.org/10.1038/s41586-020-1'), 'paper');
  assert.equal(g('https://pubmed.ncbi.nlm.nih.gov/12345/'), 'paper');
  assert.equal(g('https://www.biorxiv.org/content/10.1101/2024'), 'paper');
  assert.equal(g('https://arxiv.org/abs/2401.0001'), 'paper');
  assert.equal(g('https://www.imdb.com/title/tt0119217/'), 'film');
  assert.equal(g('https://www.goodreads.com/book/show/1'), 'book');
  assert.equal(g('https://example.org/blog'), 'topic');
  assert.equal(C.guessCurioType(null, 'check this https://youtu.be/q'), 'video');
  assert.equal(C.guessCurioType(null, ''), 'topic');
});
