// Ground truth for Phase 2 logic: burnout radar, sleep, weight, applications, letters, defend-it.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const TZ = 'Asia/Damascus';
const at = (iso) => Date.parse(iso + '+03:00');
const DAY = '2026-10-24';
const days = (n) => Array.from({ length: n }, (_, i) => C.addDays(DAY, -i));

function healthy() {
  return {
    day: DAY,
    dayLogs: days(10).map((d, i) => ({ id: d, energy: 3 + (i % 3) })),
    sessions: days(10).map((d) => ({ day: d, category: 'study', minutes: 40, overrideCeiling: false })),
    projects: [{ id: 'a', tier: 'main', status: 'active' }, { id: 'b', tier: 'main', status: 'active' }],
    wip: { main: 3, papers: 2 },
    sleep: days(7).map((d) => ({ id: d, bedAt: at(d + 'T23:30'), wakeAt: at(C.addDays(d, 1) + 'T07:00') })),
    reviews: [{ id: '2026-10-10', overall: 3 }, { id: '2026-10-17', overall: 4 }],
  };
}

test('radar negative control: a healthy fortnight shows nothing', () => {
  const r = C.burnoutSignals(healthy());
  assert.deepEqual(r.signals, []);
  assert.equal(r.show, false);
});

test('radar: one signal alone is not enough (being at the WIP limit is normal)', () => {
  const c = healthy();
  c.projects.push({ id: 'c', tier: 'main', status: 'active' });
  const r = C.burnoutSignals(c);
  assert.deepEqual(r.signals, ['atLimit']);
  assert.equal(r.show, false);
});

test('radar: low energy + frequent overrides together trigger the gentle signal', () => {
  const c = healthy();
  c.dayLogs = days(6).map((d, i) => ({ id: d, energy: i === 0 ? 3 : 1 + (i % 2) }));
  c.sessions = days(4).map((d) => ({ day: d, category: 'research', minutes: 100, overrideCeiling: true }));
  const r = C.burnoutSignals(c);
  assert.deepEqual(r.signals, ['lowEnergy', 'overrides']);
  assert.equal(r.show, true);
});

test('radar: needs enough check-ins, and ignores anything older than 10 days', () => {
  const c = healthy();
  c.dayLogs = days(3).map((d) => ({ id: d, energy: 1 }));
  assert.ok(!C.burnoutSignals(c).signals.includes('lowEnergy'), 'three check-ins are too few to say anything');
  c.dayLogs = [12, 13, 14, 15, 16].map((n) => ({ id: C.addDays(DAY, -n), energy: 1 }));
  assert.ok(!C.burnoutSignals(c).signals.includes('lowEnergy'), 'old days do not count');
  c.sessions = [12, 13, 14].map((n) => ({ day: C.addDays(DAY, -n), overrideCeiling: true }));
  assert.ok(!C.burnoutSignals(c).signals.includes('overrides'));
});

test('radar: short sleep and a falling weekly feeling', () => {
  const c = healthy();
  c.sleep = days(5).map((d) => ({ id: d, bedAt: at(C.addDays(d, 1) + 'T02:00'), wakeAt: at(C.addDays(d, 1) + 'T07:00') }));
  c.reviews = [{ id: '2026-10-10', overall: 4 }, { id: '2026-10-17', overall: 2 }];
  assert.deepEqual(C.burnoutSignals(c).signals, ['shortSleep', 'reviewDown']);
  c.reviews = [{ id: '2026-10-10', overall: 2 }, { id: '2026-10-17', overall: 3 }];
  assert.ok(!C.burnoutSignals(c).signals.includes('reviewDown'), 'going up is not a signal');
  c.sleep = c.sleep.slice(0, 3);
  assert.ok(!C.burnoutSignals(c).signals.includes('shortSleep'), 'three nights are too few');
});

test('sleep minutes and the weekly average bedtime across midnight', () => {
  assert.equal(C.sleepMinutes({ bedAt: at('2026-10-24T23:30'), wakeAt: at('2026-10-25T07:00') }), 450);
  assert.equal(C.sleepMinutes({ bedAt: at('2026-10-24T23:30') }), null);
  assert.equal(C.sleepMinutes({ bedAt: at('2026-10-25T07:00'), wakeAt: at('2026-10-24T23:30') }), null);
  const logs = [
    { id: '2026-10-24', bedAt: at('2026-10-24T23:30'), wakeAt: at('2026-10-25T07:30') }, // 8h
    { id: '2026-10-25', bedAt: at('2026-10-26T01:30'), wakeAt: at('2026-10-26T07:30') }, // 6h
    { id: '2026-10-17', bedAt: at('2026-10-17T22:00'), wakeAt: at('2026-10-18T10:00') }, // other week
  ];
  const w = C.sleepWeek(logs, '2026-10-24', { tz: TZ });
  assert.equal(w.avgMin, 420);
  assert.equal(w.avgBed, 30, 'average of 23:30 and 01:30 is 00:30, not 12:30');
  assert.equal(w.nights, 2);
  assert.equal(C.sleepWeek(logs, '2026-11-07', { tz: TZ }), null);
});

test('night key: going to bed at 2 AM belongs to the evening before', () => {
  assert.equal(C.nightKey(at('2026-10-25T02:00'), { tz: TZ, dayEndHour: 5 }), '2026-10-24');
  assert.equal(C.nightKey(at('2026-10-24T23:00'), { tz: TZ, dayEndHour: 5 }), '2026-10-24');
});

test('typing a night by hand: bed after midnight still belongs to that night', () => {
  const cfg = { tz: TZ, dayEndHour: 5 };
  assert.equal(C.wallToTs('2026-10-24', '23:30', TZ), at('2026-10-24T23:30'));
  const a = C.nightFromTimes('2026-10-24', '23:30', '07:00', cfg);
  assert.equal(a.bedAt, at('2026-10-24T23:30'));
  assert.equal(a.wakeAt, at('2026-10-25T07:00'));
  const b = C.nightFromTimes('2026-10-24', '01:30', '08:00', cfg);
  assert.equal(b.bedAt, at('2026-10-25T01:30'), '01:30 is the early hours after the 24th');
  assert.equal(b.wakeAt, at('2026-10-25T08:00'));
  assert.equal(C.sleepMinutes(b), 390);
  const c = C.nightFromTimes('2026-10-24', '22:00', '23:30', cfg);
  assert.equal(C.sleepMinutes(c), 90, 'a short nap the same evening');
});

test('weight: one entry per week, 4-week moving average, trend direction', () => {
  const w = [
    { id: '2026-09-26', kg: 80 }, { id: '2026-10-03', kg: 80 }, { id: '2026-10-10', kg: 79 },
    { id: '2026-10-17', kg: 79 }, { id: '2026-10-24', kg: 78 },
  ];
  assert.equal(C.canWeighIn(w, '2026-10-24'), false);
  assert.equal(C.canWeighIn(w, '2026-10-31'), true);
  const ma = C.movingAvg(w.slice().reverse(), 4);
  assert.deepEqual(ma.map((p) => p.avg), [80, 80, 79.67, 79.5, 79]);
  assert.equal(C.weightTrend(ma), 'down');
  assert.equal(C.weightTrend(C.movingAvg([{ id: 'a', kg: 70 }, { id: 'b', kg: 70.2 }, { id: 'c', kg: 69.9 }], 4)), 'flat');
  assert.equal(C.weightTrend(C.movingAvg([{ id: 'a', kg: 70 }], 4)), null);
});

test('weight target pace: more than ~1 kg a week gets the gentle note', () => {
  assert.equal(C.weeklyPace(80, 70, '2026-10-24', '2026-11-28'), 2);
  assert.ok(C.weeklyPace(80, 70, '2026-10-24', '2026-11-28') > 1);
  assert.ok(C.weeklyPace(80, 78, '2026-10-24', '2026-12-19') <= 1);
});

test('applications: only the next 3 deadlines are highlighted; submitted ones rest on their own shelf', () => {
  const o = (id, status, deadline, extra) => ({ id, status, deadline, ...extra });
  const opps = [
    o('a', 'preparing', '2026-11-16'), o('b', 'considering', '2026-11-01'), o('c', 'preparing', '2026-12-01'),
    o('d', 'considering', '2027-01-10'), o('e', 'preparing', '2026-10-01'), o('f', 'submitted', '2026-10-10', { expectedResponse: '2026-12-15' }),
    o('g', 'rejected', '2026-09-01'), o('h', 'interview', null),
  ];
  const b = C.oppBuckets(opps, DAY);
  assert.deepEqual([...b.highlight].sort(), ['a', 'b', 'c']);
  assert.ok(b.active.some((x) => x.id === 'e'), 'a passed deadline stays, just not highlighted');
  assert.deepEqual(b.waiting.map((x) => x.id), ['f']);
  assert.deepEqual(b.closed.map((x) => x.id), ['g']);
  assert.deepEqual(C.responsesNear(opps, '2026-12-12').map((x) => x.id), []);
  assert.deepEqual(C.responsesNear(opps, '2026-12-13').map((x) => x.id), ['f']);
  assert.deepEqual(C.responsesNear([{ ...opps[5], quietUntil: '2026-12-20' }], '2026-12-14'), []);
});

test('letters: locked until their day, then due once', () => {
  const ls = [
    { id: 'a', openOn: '2027-01-23', opened: false },
    { id: 'b', openOn: '2026-10-24', opened: false },
    { id: 'c', openOn: '2026-10-01', opened: true },
    { id: 'd', openOn: null, opened: false },
  ];
  assert.deepEqual(C.lettersDue(ls, DAY).map((l) => l.id), ['b']);
  assert.equal(C.letterLocked(ls[0], DAY), true);
  assert.equal(C.letterLocked(ls[1], DAY), false);
  assert.equal(C.letterLocked(ls[3], DAY), false, '"when I need it" letters can be opened any time');
});

test('defend it: ready only when every section is understood', () => {
  const p = { defend: {} };
  assert.equal(C.defendState(p).ready, false);
  assert.equal(C.defendState(p).counts.unset, C.DEFEND_SECTIONS.length);
  for (const s of C.DEFEND_SECTIONS) p.defend[s] = { confidence: 2 };
  assert.equal(C.defendState(p).ready, true);
  p.defend.methods = { confidence: 1 };
  assert.equal(C.defendState(p).ready, false);
  assert.equal(C.defendState(p).counts[1], 1);
});

test('presence dots: days it happened, absence stays blank', () => {
  const recs = [{ id: '2026-10-24' }, { id: '2026-10-27' }];
  assert.deepEqual(C.weekPresence(recs, '2026-10-24'), [true, false, false, true, false, false, false]);
});
