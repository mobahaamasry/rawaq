const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const Seed = require('../js/seed.js');

const now = Date.parse('2026-10-24T12:00:00+03:00');
const seed = Seed.buildSeed(now);
const T = seed.tables;

test('seed respects its own limits: Main projects within the WIP limit', () => {
  const active = T.projects.filter((p) => p.status === 'active');
  assert.ok(active.filter((p) => p.tier === 'main').length <= seed.settings.wip.main);
  assert.ok(active.filter((p) => p.kind === 'paper').length <= seed.settings.wip.papers);
  for (const p of active) assert.equal(C.wipBlock(T.projects, p, seed.settings.wip), null, p.name);
  // and a Main project past the limit would be stopped
  const full = Array.from({ length: seed.settings.wip.main }, (_, i) => ({ id: 'm' + i, tier: 'main', status: 'active', kind: 'project' }));
  const extra = { id: 'x', tier: 'main', status: 'active', kind: 'project' };
  assert.equal(C.wipBlock(full, extra, seed.settings.wip).kind, 'main');
});

test('seed is neutral: no personal name, birthday, exams or applications', () => {
  assert.equal(seed.settings.name, '');
  assert.equal(seed.settings.birthday, null);
  assert.equal(T.exams.length, 0);
  assert.equal(T.opportunities.length, 0);
});

test('seed: ceilings, protected Friday evening, message windows off', () => {
  const s = seed.settings;
  assert.equal(s.ceilings.research.daily, 240);
  assert.equal(s.ceilings.team.daily, 120);
  assert.equal(s.ceilings.study.session, 90);
  assert.equal(s.dayEndHour, 5);
  assert.equal(s.weekStart, 6);
  assert.equal(s.messageWindows.enabled, false);
  assert.equal(s.resetLog, false, 'Reset logging is opt-in');
  const rest = T.slots.find((x) => x.protected);
  assert.equal(rest.weekday, 5);
  assert.equal(rest.start, '18:00');
});

test('seed: first letter opens three months after install, locked', () => {
  const l = T.letters[0];
  assert.equal(l.openOn, '2027-01-24');
  assert.equal(l.opened, false);
});

test('seed: no field anywhere tracks streaks or misses', () => {
  const json = JSON.stringify(seed).toLowerCase();
  for (const w of ['streak', 'missed', 'overdue', 'debt']) assert.ok(!json.includes(w), w);
});

test('seed ids are unique', () => {
  const ids = Object.values(T).flat().map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});
