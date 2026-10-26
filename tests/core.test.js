// Ground truth for Rawaq's pure logic. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const TZ = 'Asia/Damascus';
// Damascus is UTC+3 all year since 2022, so wall time = UTC + 3h.
const at = (iso) => Date.parse(iso + '+03:00');
const cfg = { tz: TZ, dayEndHour: 5 };

test('Damascus offset is +03:00 in winter and summer', () => {
  assert.deepEqual(C.wallParts(Date.parse('2026-01-15T09:00:00Z'), TZ).hh, 12);
  assert.deepEqual(C.wallParts(Date.parse('2026-07-15T09:00:00Z'), TZ).hh, 12);
});

test('day boundary: 2 AM still counts as the previous day (default 5:00)', () => {
  assert.equal(C.clockOf(at('2026-10-24T02:00'), cfg).day, '2026-10-23');
  assert.equal(C.clockOf(at('2026-10-24T04:59'), cfg).day, '2026-10-23');
  assert.equal(C.clockOf(at('2026-10-24T05:00'), cfg).day, '2026-10-24');
  assert.equal(C.clockOf(at('2026-10-24T23:59'), cfg).day, '2026-10-24');
});

test('day boundary follows the setting', () => {
  assert.equal(C.clockOf(at('2026-10-24T02:00'), { tz: TZ, dayEndHour: 0 }).day, '2026-10-24');
  assert.equal(C.clockOf(at('2026-10-24T03:30'), { tz: TZ, dayEndHour: 3 }).day, '2026-10-24');
  assert.equal(C.clockOf(at('2026-10-24T02:59'), { tz: TZ, dayEndHour: 3 }).day, '2026-10-23');
});

test('logical minutes start at the day-end hour', () => {
  assert.equal(C.clockOf(at('2026-10-24T05:00'), cfg).lm, 0);
  assert.equal(C.clockOf(at('2026-10-24T04:59'), cfg).lm, 1439);
  assert.equal(C.toLogical(C.hmToMin('18:00'), 5), 13 * 60);
});

test('date keys and weekdays', () => {
  assert.equal(C.weekdayOf('2026-10-24'), 6); // Saturday
  assert.equal(C.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(C.addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(C.diffDays('2026-10-24', '2027-01-25'), 93);
  assert.equal(C.addMonths('2026-10-24', 3), '2027-01-24');
  assert.equal(C.addMonths('2026-11-30', 3), '2027-02-28');
});

test('weeks start on Saturday by default', () => {
  assert.equal(C.weekStartOf('2026-10-24', 6), '2026-10-24');
  assert.equal(C.weekStartOf('2026-10-30', 6), '2026-10-24'); // Friday
  assert.equal(C.weekStartOf('2026-10-31', 6), '2026-10-31');
  assert.equal(C.weekStartOf('2026-10-28', 0), '2026-10-25'); // Sunday start
  assert.equal(C.weekDays('2026-10-24').length, 7);
});

test('exam countdown is in whole weeks', () => {
  assert.equal(C.weeksLeft('2026-10-24', '2027-01-25'), 13);
  assert.equal(C.weeksLeft('2027-01-20', '2027-01-25'), 0);
  assert.equal(C.weeksLeft('2027-01-26', '2027-01-25'), null);
});

const S = {
  weekStart: 6, dayEndHour: 5, tz: TZ,
  review: { openDay: 4, openHour: 18, closeDay: 6 },
  ceilings: {
    study: { session: 90, daily: null }, research: { session: 90, daily: 240 },
    team: { session: 90, daily: 120 }, free: { session: 90, daily: null },
  },
  lighterWeek: null,
};

test('weekly review opens Thursday 18:00 and closes after Saturday', () => {
  const tgt = (iso) => C.reviewTarget(C.clockOf(at(iso), cfg), S);
  assert.equal(tgt('2026-10-29T17:59'), null);
  assert.equal(tgt('2026-10-29T18:00'), '2026-10-24');
  assert.equal(tgt('2026-10-30T12:00'), '2026-10-24');
  assert.equal(tgt('2026-10-31T14:00'), '2026-10-24');
  assert.equal(tgt('2026-11-01T03:00'), '2026-10-24'); // 3 AM Sunday is still Saturday night
  assert.equal(tgt('2026-11-01T12:00'), null);
  assert.equal(tgt('2026-10-26T12:00'), null);
});

test('ceilings: daily ceiling blocks a new session, lighter week lowers it', () => {
  const c = C.ceilingFor('research', S, '2026-10-24');
  assert.deepEqual(c, { session: 90, daily: 240 });
  assert.equal(C.startCheck(240, c).ok, false);
  assert.equal(C.startCheck(239, c).ok, true);
  const light = C.ceilingFor('research', { ...S, lighterWeek: '2026-10-24' }, '2026-10-24');
  assert.equal(light.daily, 180);
  const otherWeek = C.ceilingFor('research', { ...S, lighterWeek: '2026-10-24' }, '2026-10-31');
  assert.equal(otherWeek.daily, 240);
  assert.equal(C.ceilingFor('unknown-cat', S, '2026-10-24').session, 90);
});

test('timer: default start is 10 minutes, then a gentle check-in', () => {
  const t0 = 1_000_000;
  const t = C.newTimer({ now: t0, category: 'study', usedToday: 0, ceil: { session: 90, daily: null } });
  assert.equal(t.plannedMin, 10);
  assert.equal(C.timerPhase(t, t0 + 9 * 60000), 'running');
  assert.equal(C.timerPhase(t, t0 + 10 * 60000), 'checkin');
});

test('timer: extensions stop at the session ceiling; going past needs an explicit override', () => {
  const t0 = 0;
  let t = C.newTimer({ now: t0, category: 'study', usedToday: 0, ceil: { session: 90, daily: null } });
  t = C.extendTimer(t, 25); t = C.extendTimer(t, 25); t = C.extendTimer(t, 25); // 85
  assert.equal(t.plannedMin, 85);
  t = C.extendTimer(t, 15);
  assert.equal(t.plannedMin, 90, 'clamped to the ceiling');
  assert.equal(C.timerPhase(t, 90 * 60000), 'ceiling');
  t = C.overrideTimer(t, 15);
  assert.equal(t.overridden, true);
  assert.equal(C.timerPhase(t, 95 * 60000), 'running');
  assert.equal(C.timerPhase(t, 105 * 60000), 'ceiling');
});

test('timer: daily remainder caps the session', () => {
  const t = C.newTimer({ now: 0, category: 'research', usedToday: 235, ceil: { session: 90, daily: 240 } });
  assert.equal(t.plannedMin, 5);
  assert.equal(t.capMin, 5);
  assert.equal(C.timerPhase(t, 5 * 60000), 'ceiling');
  const o = C.newTimer({ now: 0, category: 'research', usedToday: 240, ceil: { session: 90, daily: 240 }, override: true });
  assert.equal(o.plannedMin, 10);
  assert.equal(o.overridden, true);
});

test('timer survives screen-off: elapsed comes only from timestamps and pauses', () => {
  const t0 = 5_000_000;
  let t = C.newTimer({ now: t0, category: 'study', usedToday: 0, ceil: { session: 90, daily: null } });
  t = C.pauseTimer(t, t0 + 5 * 60000);
  assert.equal(C.elapsedMs(t, t0 + 50 * 60000), 5 * 60000, 'paused time does not count');
  t = C.resumeTimer(t, t0 + 65 * 60000);
  assert.equal(C.elapsedMs(t, t0 + 70 * 60000), 10 * 60000);
  // round-trip through JSON, as the store does
  const restored = JSON.parse(JSON.stringify(t));
  assert.equal(C.timerPhase(restored, t0 + 70 * 60000), 'checkin');
});

test('timer holds at the check-in instead of silently counting on', () => {
  const t0 = 0;
  let t = C.newTimer({ now: t0, category: 'study', usedToday: 0, ceil: { session: 90, daily: null } });
  const later = 40 * 60000; // came back after 40 minutes
  assert.equal(C.heldElapsedMs(t, later), 10 * 60000);
  t = C.settleTimer(t, later);
  assert.equal(C.elapsedMs(t, later), 10 * 60000);
  t = C.extendTimer(t, 15);
  assert.equal(C.timerPhase(t, later + 60000), 'running');
});

test('moon fraction grows from a thin crescent to full', () => {
  const t = C.newTimer({ now: 0, category: 'study', usedToday: 0, ceil: { session: 90, daily: null } });
  assert.ok(C.moonFraction(t, 0) > 0 && C.moonFraction(t, 0) < 0.1);
  assert.equal(C.moonFraction(t, 10 * 60000), 1);
  assert.ok(Math.abs(C.moonFraction(t, 5 * 60000) - 0.5) < 0.05);
});

test('moon path edge cases', () => {
  assert.equal(C.moonPath(50, 50, 40, 0, 'right'), '');
  assert.match(C.moonPath(50, 50, 40, 1, 'right'), /A 40 40 0 1 0/);
  assert.match(C.moonPath(50, 50, 40, 0.5, 'right'), /A 0 40/);
});

const P = (id, tier, status, kind = 'project') => ({ id, tier, status, kind, name: id });

test('WIP: a 4th active Main project is blocked until one steps back', () => {
  const wip = { main: 3, papers: 2 };
  const ps = [P('a', 'main', 'active'), P('b', 'main', 'active'), P('c', 'main', 'active')];
  const block = C.wipBlock(ps, P('d', 'main', 'active'), wip);
  assert.equal(block.kind, 'main');
  assert.equal(block.blockers.length, 3);
  // negative controls
  assert.equal(C.wipBlock(ps, P('d', 'background', 'active'), wip), null);
  assert.equal(C.wipBlock(ps, P('d', 'main', 'paused'), wip), null);
  ps[0].status = 'paused';
  assert.equal(C.wipBlock(ps, P('d', 'main', 'active'), wip), null);
  // editing an existing active project does not count itself
  assert.equal(C.wipBlock([P('a', 'main', 'active'), P('b', 'main', 'active'), P('c', 'main', 'active')], P('c', 'main', 'active'), wip), null);
});

test('WIP: at most 2 active papers, regardless of tier', () => {
  const wip = { main: 3, papers: 2 };
  const ps = [P('a', 'main', 'active', 'paper'), P('b', 'background', 'active', 'paper')];
  assert.equal(C.wipBlock(ps, P('c', 'background', 'active', 'paper'), wip).kind, 'paper');
  assert.equal(C.wipBlock(ps, P('c', 'background', 'active', 'project'), wip), null);
});

const slot = (o) => ({ id: o.id || Math.random().toString(36).slice(2), type: 'study', label: '', protected: false, ...o });

test('protected blocks reject work slots that touch them', () => {
  const rest = slot({ id: 'r', weekday: 5, start: '18:00', end: '00:00', type: 'rest', protected: true });
  const inside = slot({ weekday: 5, start: '19:00', end: '20:00' });
  const before = slot({ weekday: 5, start: '17:00', end: '18:00' });
  const otherDay = slot({ weekday: 4, start: '19:00', end: '20:00' });
  const oneOffFriday = slot({ date: '2026-10-30', start: '21:00', end: '22:00' });
  assert.equal(C.protectedConflict([rest], inside, 5).id, 'r');
  assert.equal(C.protectedConflict([rest], before, 5), null);
  assert.equal(C.protectedConflict([rest], otherDay, 5), null);
  assert.equal(C.protectedConflict([rest], oneOffFriday, 5).id, 'r');
});

test('slot ranges run on the logical day (past midnight stays the same evening)', () => {
  assert.deepEqual(C.slotRange({ start: '18:00', end: '00:00' }, 5), [780, 1140]);
  assert.deepEqual(C.slotRange({ start: '23:00', end: '02:00' }, 5), [1080, 1260]);
  assert.deepEqual(C.slotRange({ start: '22:00', end: '05:00' }, 5), [1020, 1440]);
});

function planCtx(over) {
  return {
    day: '2026-10-24', lm: 0, energy: 3, weekKey: '2026-10-24', dayEndHour: 5,
    slots: [], items: [], projects: [], focusKey: null, ...over,
  };
}

test('Today: no carry-over. Yesterday\'s open pins and finished slots never appear', () => {
  const items = [
    { id: 'y', title: 'yesterday', pinnedDate: '2026-10-23', status: 'open' },
    { id: 't', title: 'today', pinnedDate: '2026-10-24', status: 'open' },
  ];
  const slots = [
    slot({ id: 'early', weekday: 6, start: '08:00', end: '09:00' }), // lm 180-240
    slot({ id: 'late', weekday: 6, start: '20:00', end: '21:00' }),
  ];
  const plan = C.todayPlan(planCtx({ items, slots, lm: 600 /* 15:00 */ }));
  const keys = plan.main.map((m) => m.key);
  assert.deepEqual(keys, ['i:t', 's:late']);
});

test('Today: energy decides how much is shown', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, title: id, pinnedDate: '2026-10-24', status: 'open' }));
  assert.equal(C.todayPlan(planCtx({ items, energy: 1 })).main.length, 1);
  assert.equal(C.todayPlan(planCtx({ items, energy: 2 })).mode, 'minimum');
  assert.equal(C.todayPlan(planCtx({ items, energy: 3 })).main.length, 3);
  assert.equal(C.todayPlan(planCtx({ items, energy: 5 })).main.length, 3, 'never more than 3 main items');
  assert.equal(C.todayPlan(planCtx({ items, energy: 1, focusKey: 'i:c' })).main[0].key, 'i:c');
});

test('Today: full mode adds background items; paused-this-week projects stay quiet', () => {
  const projects = [
    { id: 'p1', name: 'reading', tier: 'background', status: 'active', nextStep: 'open one paper' },
    { id: 'p2', name: 'team', tier: 'background', status: 'active', nextStep: 'message', weekPause: '2026-10-24' },
  ];
  const full = C.todayPlan(planCtx({ projects, energy: 5 }));
  assert.deepEqual(full.background.map((b) => b.project.id), ['p1']);
  assert.equal(C.todayPlan(planCtx({ projects, energy: 3 })).background.length, 0);
});

test('Today: work slots inside protected time are left out', () => {
  const slots = [
    slot({ id: 'rest', weekday: 6, start: '18:00', end: '23:00', type: 'rest', protected: true }),
    slot({ id: 'clash', weekday: 6, start: '19:00', end: '20:00' }),
  ];
  const plan = C.todayPlan(planCtx({ slots }));
  assert.equal(plan.main.length, 0);
  assert.equal(plan.protectedToday.length, 1);
});

test('sky phase and greeting by hour', () => {
  const sunset = 17 * 60 + 30;
  assert.equal(C.skyPhase(20 * 60, sunset, 5), 'evening');
  assert.equal(C.skyPhase(23 * 60, sunset, 5), 'night');
  assert.equal(C.skyPhase(1 * 60, sunset, 5), 'night');
  assert.equal(C.skyPhase(4 * 60, sunset, 5), 'predawn');
  assert.equal(C.skyPhase(10 * 60, sunset, 5), 'day');
  assert.equal(C.greetingKey(8 * 60, sunset), 'morning');
  assert.equal(C.greetingKey(14 * 60, sunset), 'afternoon');
  assert.equal(C.greetingKey(19 * 60, sunset), 'evening');
  assert.equal(C.greetingKey(1 * 60, sunset), 'afterMidnight');
  assert.equal(C.greetingKey(4 * 60, sunset), 'predawn');
});

test('Damascus sunset is roughly right', () => {
  const dec = C.sunsetMin('2026-12-21', 180);
  const jun = C.sunsetMin('2026-06-21', 180);
  assert.ok(dec > 16 * 60 + 50 && dec < 17 * 60 + 50, 'December ~17:20 (UTC+3), got ' + dec);
  assert.ok(jun > 19 * 60 + 30 && jun < 20 * 60 + 15, 'June ~19:50 (UTC+3), got ' + jun);
});

test('numerals', () => {
  assert.equal(C.toEastern('13 weeks, 2026'), '١٣ weeks, ٢٠٢٦');
  assert.equal(C.toWestern('١٣'), '13');
});

test('Arabic counting words', () => {
  assert.equal(C.arCount(1, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), 'ساعة');
  assert.equal(C.arCount(2, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), 'ساعتين');
  assert.equal(C.arCount(5, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), '5 ساعات');
  assert.equal(C.arCount(13, 'أسبوع', 'أسبوعين', 'أسابيع', 'أسبوع'), '13 أسبوع');
});

test('wins sky: deterministic, one constellation line chain per month, no counts', () => {
  const wins = [
    { id: 'w1', date: '2026-10-02', text: 'a' }, { id: 'w2', date: '2026-10-09', text: 'b' },
    { id: 'w3', date: '2026-10-20', text: 'c' }, { id: 'w4', date: '2026-09-15', text: 'd' },
  ];
  const a = C.skyLayout(wins, 340);
  const b = C.skyLayout(wins.slice().reverse(), 340);
  assert.deepEqual(a, b, 'same input gives the same sky regardless of order');
  assert.equal(a.stars.length, 4);
  assert.equal(a.lines.length, 2, 'October joins 3 stars with 2 lines; September has 1 star');
  assert.equal(a.months[0].month, '2026-10', 'newest month on top');
  for (const s of a.stars) assert.ok(s.x >= 0 && s.x <= 340);
});

test('export format round-trips exactly', () => {
  const tables = {
    projects: [{ id: 'p', name: 'تعديل ورقة', tier: 'main', status: 'active', nested: { a: [1, 2] } }],
    wins: [{ id: 'w', text: 'passed <b>Python</b> exam', date: '2026-10-24', toldWho: null }],
    meta: [{ id: 'settings', lang: 'ar', ceilings: { study: { session: 90, daily: null } } }],
  };
  const json = JSON.stringify(C.makeExport(tables, '2026-10-24T10:00:00.000Z'));
  const back = C.readExport(JSON.parse(json), ['projects', 'wins', 'meta', 'slots']);
  assert.deepEqual(back, { ...tables, slots: [] });
});

test('export reader refuses files that are not Rawaq backups', () => {
  assert.throws(() => C.readExport({}, ['wins']));
  assert.throws(() => C.readExport({ app: 'other', tables: {} }, ['wins']));
  assert.throws(() => C.readExport({ app: 'rawaq', format: 1, tables: { wins: [{ text: 'no id' }] } }, ['wins']));
});

test('open questions and waiting-on resurface only on their date', () => {
  const qs = [
    { id: 'a', status: 'parked', answerBy: '2026-10-24' },
    { id: 'b', status: 'parked', answerBy: '2026-11-01' },
    { id: 'c', status: 'parked', answerBy: null },
    { id: 'd', status: 'resolved', answerBy: '2026-10-01' },
  ];
  assert.deepEqual(C.questionsDue(qs, '2026-10-24').map((q) => q.id), ['a']);
  const ws = [{ id: 'x', checkBackOn: '2026-10-25', done: false }, { id: 'y', checkBackOn: '2026-10-20', done: false }, { id: 'z', checkBackOn: null, done: false }];
  assert.deepEqual(C.waitingDue(ws, '2026-10-24').map((w) => w.id), ['y']);
});

test('re-reading the questions shelf several times in a short while triggers one gentle note', () => {
  const m = 60000;
  assert.equal(C.rereadNote([0, 5 * m], 6 * m), false);
  assert.equal(C.rereadNote([0, 5 * m, 9 * m], 10 * m), true);
  assert.equal(C.rereadNote([0, 40 * m, 80 * m], 81 * m), false);
});

test('weekly totals only (never per day)', () => {
  const sessions = [
    { day: '2026-10-24', category: 'study', minutes: 30 },
    { day: '2026-10-30', category: 'study', minutes: 25 },
    { day: '2026-10-31', category: 'study', minutes: 40 },
    { day: '2026-10-25', category: 'team', minutes: 15 },
  ];
  assert.deepEqual(C.weekTotals(sessions, '2026-10-24'), { study: 55, team: 15 });
});

test('ramp phase for the week', () => {
  const exam = { date: '2027-01-25', ramp: [{ from: '2026-10-01', to: '2026-11-30', lo: 4, hi: 6 }, { from: '2026-12-01', to: '2026-12-31', lo: 9, hi: 11 }] };
  assert.equal(C.rampFor(exam, '2026-10-24').hi, 6);
  assert.equal(C.rampFor(exam, '2026-12-05').lo, 9);
  assert.equal(C.rampFor(exam, '2027-01-10'), null);
});
