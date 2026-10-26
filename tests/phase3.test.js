// Ground truth for Phase 3: connection nudges, exports (.ics, reflection, CSV, zip, Obsidian vault),
// integration payloads, and the rule that sensitive modules never leave the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const X = require('../js/exports.js');
const P = require('../js/integrations/payloads.js');

const cfg = { tz: 'Asia/Damascus', dayEndHour: 5, lang: 'en' };

/* ---------- connection nudges ---------- */
test('connection nudge: at most once a week, on one day of it, and gone once seen', () => {
  const wk = '2026-10-24';
  const days = C.weekDays(wk);
  const shown = days.map((d) => C.connectionNudge({ weekKey: wk, day: d, shownWeek: null, ideas: [], enabled: true }));
  const first = shown.findIndex(Boolean);
  assert.ok(first >= 2 && first <= 5, 'it appears mid-week, not on the first day');
  assert.ok(shown.slice(0, first).every((x) => x === null));
  assert.ok(shown.slice(first).every((x) => x === shown[first]), 'same gentle prompt for the rest of that week');
  assert.equal(C.connectionNudge({ weekKey: wk, day: days[6], shownWeek: wk, ideas: [], enabled: true }), null, 'dismissed this week');
  assert.equal(C.connectionNudge({ weekKey: wk, day: days[6], shownWeek: null, ideas: [], enabled: false }), null, 'turned off');
  assert.notEqual(C.connectionNudge({ weekKey: '2026-10-31', day: '2026-11-06', shownWeek: wk, ideas: [], enabled: true }), null, 'next week starts fresh');
});

test('connection nudge can surface one of his own presence ideas', () => {
  const kinds = new Set();
  for (let i = 0; i < 40; i++) {
    const wk = C.addDays('2026-10-24', 7 * i);
    kinds.add(C.connectionNudge({ weekKey: wk, day: C.addDays(wk, 6), shownWeek: null, ideas: [{ id: 'x', text: 'عشا بدون موبايل' }], enabled: true }));
  }
  assert.ok(kinds.has('family') && kinds.has('share') && kinds.has('idea:x'));
});

/* ---------- .ics ---------- */
const slots = [
  { id: 'rest', weekday: 5, start: '18:00', end: '00:00', type: 'rest', protected: true, label: 'مسا الجمعة', from: '2026-10-24' },
  { id: 'late', weekday: 5, start: '01:00', end: '02:30', type: 'study', protected: false, label: 'Team, sync; notes', from: '2026-10-24', until: '2026-12-31' },
  { id: 'once', date: '2026-10-27', start: '16:00', end: '17:00', type: 'gym', protected: false, label: '' },
];

test('slot occurrences: evenings and after-midnight slots land on the right wall dates', () => {
  assert.deepEqual(X.slotOccurrence(slots[0], '2026-10-24', cfg), { start: '20261030T180000', end: '20261031T000000' });
  assert.deepEqual(X.slotOccurrence(slots[1], '2026-10-24', cfg), { start: '20261031T010000', end: '20261031T023000' }, '1 AM on "Friday night" is Saturday on the wall');
  assert.deepEqual(X.slotOccurrence(slots[2], null, cfg), { start: '20261027T160000', end: '20261027T170000' });
});

test('.ics: valid calendar with weekly rules, escaping, folding, CRLF', () => {
  const ics = X.buildICS({ slots, opportunities: [], settings: { ...cfg, lang: 'ar' } }, { nowTs: Date.parse('2026-10-24T10:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
  assert.match(ics, /DTSTART;TZID=Asia\/Damascus:20261030T180000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=FR\r\n/);
  // the 1 AM "Friday night" slot repeats on the wall-clock Saturday, until the end of the logical 31 Dec (05:00 on 1 Jan)
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20270101T015959Z/);
  assert.match(ics, /SUMMARY:وقت إلك 🌿/);
  assert.ok(ics.includes('SUMMARY:Team\\, sync\\; notes'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  const enc = new TextEncoder();
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, 'line too long: ' + line);
  // the one-off slot has no repeat rule
  const once = ics.split('BEGIN:VEVENT').find((b) => b.includes('UID:once@rawaq'));
  assert.ok(!once.includes('RRULE'));
});

test('.ics folding keeps multi-byte text intact', () => {
  const long = 'ر'.repeat(120);
  const folded = X.icsFold('SUMMARY:' + long);
  const lines = folded.split('\r\n');
  for (const l of lines) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(lines.map((l, i) => (i ? l.slice(1) : l)).join(''), 'SUMMARY:' + long);
});

test('.ics: deadlines only when asked, as all-day events', () => {
  const opps = [{ id: 'o', name: 'Summer School 2027', deadline: '2026-11-16', status: 'preparing' }, { id: 'r', name: 'Old', deadline: '2026-09-01', status: 'rejected' }];
  const without = X.buildICS({ slots: [], opportunities: opps, settings: cfg }, { nowTs: 0 });
  assert.ok(!without.includes('VALUE=DATE'));
  const withD = X.buildICS({ slots: [], opportunities: opps, settings: cfg }, { nowTs: 0, deadlines: true });
  assert.match(withD, /DTSTART;VALUE=DATE:20261116/);
  assert.match(withD, /DTEND;VALUE=DATE:20261117/);
  assert.ok(!withD.includes('Old'), 'closed applications are left out');
});

/* ---------- shared fixture with sensitive markers ---------- */
function state() {
  return {
    settings: { ...cfg },
    wins: [
      { id: 'w1', date: '2026-10-05', text: 'Explained the model to the team', toldWho: 'Lina' },
      { id: 'w2', date: '2026-09-12', text: 'First gym week', toldWho: '' },
    ],
    projects: [
      { id: 'p1', name: 'Paper revision', area: 'research', tier: 'main', status: 'active', kind: 'paper', nextStep: 'Reread reviewer 2' },
      { id: 'p2', name: 'Old course', area: 'teaching', tier: 'background', status: 'done', doneAt: '2026-10-20T10:00:00Z' },
      { id: 'p3', name: 'Paused one', area: 'team', tier: 'background', status: 'paused', nextStep: 'SECRET-NOT-ACTIVE' },
    ],
    papers: [{
      id: 'pa', title: 'Brain sim: a model?', venue: 'Frontiers', status: 'revision', projectId: 'p1', coauthors: 'A, B',
      defend: { background: { confidence: 2 }, methods: { confidence: 1, note: 'check normalization' } },
      interviewQs: [{ q: 'Why this model?', a: 'Because…' }], statusLog: [{ status: 'writing', at: '2026-09-01T00:00:00Z' }, { status: 'revision', at: '2026-10-10T00:00:00Z' }],
    }],
    opportunities: [{ id: 'o1', name: 'Summer School 2027', status: 'preparing', deadline: '2026-11-16', link: 'example.org', docs: { cv: true, motivation: false }, createdAt: '2026-10-02T00:00:00Z' }],
    letters: [{ id: 'l1', title: 'For after the exams', body: 'SECRET-LETTER-BODY', openOn: '2027-01-23', opened: false, createdAt: '2026-10-08T00:00:00Z' }],
    rawNotes: [{ id: 'r1', body: 'SECRET-RAW-NOTE', createdAt: '2026-10-09T00:00:00Z' }],
    reviews: [{ id: '2026-10-17', overall: 3, sessions: 'half', blockers: ['sleep'], enjoyed: 'A walk with friends', shared: 'yes', sharedNote: '', note: '', doneAt: '2026-10-23T18:00:00Z' }],
    curiosity: [{ id: 'c1', title: 'Soul (Pixar)', type: 'film', status: 'loved', finishedAt: '2026-10-11T00:00:00Z' }],
    inbox: [{ id: 'i1', text: 'Ask about the dataset', createdAt: '2026-10-12T00:00:00Z', toObsidian: true }, { id: 'i2', text: 'SECRET-UNSENT-INBOX', createdAt: '2026-10-12T00:00:00Z' }],
    slots,
    // sensitive: must never appear in anything that leaves the app
    questions: [{ id: 'q', question: 'SECRET-QUESTION', status: 'parked' }],
    dayLogs: [{ id: '2026-10-20', energy: 1, feeling: 'SECRET-FEELING' }],
    resetUses: [{ id: 'x', hour: 2, feeling: 'SECRET-RESET' }],
    prayers: [{ id: '2026-10-20', at: 'SECRET-PRAYER' }],
    faithNotes: [{ id: 'f', kind: 'note', text: 'SECRET-FAITH' }],
  };
}
const SENSITIVE = ['SECRET-QUESTION', 'SECRET-FEELING', 'SECRET-RESET', 'SECRET-PRAYER', 'SECRET-FAITH'];

/* ---------- reflection export ---------- */
test('monthly reflection: neutral, factual, only that month', () => {
  const md = X.reflection(state(), { kind: 'month', ym: '2026-10' }, { lang: 'en', letterBodies: false });
  assert.match(md, /^# Rawaq · October 2026/);
  assert.ok(md.includes('Explained the model to the team'));
  assert.ok(!md.includes('First gym week'), 'September win is not in October');
  assert.ok(md.includes('Old course'), 'finished project');
  assert.ok(md.includes('Brain sim: a model?') && md.includes('revision'), 'paper status change');
  assert.ok(md.includes('Summer School 2027'));
  assert.ok(md.includes('For after the exams') && !md.includes('SECRET-LETTER-BODY'), 'letter titles only');
  assert.ok(md.includes('A walk with friends'));
  assert.ok(md.includes('Soul (Pixar)'));
  for (const s of SENSITIVE) assert.ok(!md.includes(s), s);
  for (const w of ['streak', 'missed', 'overdue', 'score']) assert.ok(!md.toLowerCase().includes(w));
});

test('yearly reflection includes the whole year; letter bodies only when chosen', () => {
  const md = X.reflection(state(), { kind: 'year', y: '2026' }, { lang: 'en', letterBodies: true });
  assert.ok(md.includes('First gym week'));
  assert.ok(md.includes('SECRET-LETTER-BODY'));
  const ar = X.reflection(state(), { kind: 'month', ym: '2026-10' }, { lang: 'ar' });
  assert.match(ar, /^# رواق ·/);
});

/* ---------- CSV ---------- */
test('CSV escaping and the wins table', () => {
  assert.equal(X.csvCell('a,b'), '"a,b"');
  assert.equal(X.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(X.csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(X.csvCell(3), '3');
  const csv = X.moduleCSV(state(), 'wins');
  assert.deepEqual(csv.split('\r\n').slice(0, 3), ['date,text,told', '2026-09-12,First gym week,', '2026-10-05,Explained the model to the team,Lina']);
  for (const m of X.MODULES) for (const s of SENSITIVE) assert.ok(!X.moduleCSV(state(), m).includes(s), m + ' ' + s);
});

/* ---------- Obsidian vault ---------- */
test('ISO week labels, including the 53rd week of 2026', () => {
  assert.equal(X.isoWeek('2026-10-20'), '2026-W43');
  assert.equal(X.isoWeek('2026-01-01'), '2026-W01');
  assert.equal(X.isoWeek('2027-01-01'), '2026-W53');
  assert.equal(X.safeName('a/b:c?*"d|<e>'), 'a-b-c-d-e');
});

test('vault files follow Obsidian conventions; letters and raw notes only when turned on', () => {
  const files = X.vaultFiles(state(), { folder: 'Rawaq', letters: false, raw: false, lang: 'en' });
  const paths = files.map((f) => f.path);
  assert.ok(paths.includes('Rawaq/Weekly Reviews/2026-W43.md'));
  assert.ok(paths.includes('Rawaq/Wins/2026-10.md'));
  assert.ok(paths.includes('Rawaq/Papers/Brain sim- a model.md'));
  assert.ok(paths.includes('Rawaq/Projects/Paper revision.md'));
  assert.ok(paths.includes('Rawaq/Inbox.md'));
  assert.ok(!paths.some((p) => p.includes('/Letters/') || p.includes('/Raw Notes/')));
  const wins = files.find((f) => f.path === 'Rawaq/Wins/2026-10.md').content;
  assert.ok(wins.startsWith('---\n') && wins.includes('#rawaq/win'));
  const paper = files.find((f) => f.path.includes('/Papers/')).content;
  assert.match(paper, /- \[x\] Background & hypothesis/);
  assert.match(paper, /- \[ \] Methods/);
  assert.ok(paper.includes('[[Projects/Paper revision]]'));
  const inbox = files.find((f) => f.path === 'Rawaq/Inbox.md').content;
  assert.ok(inbox.includes('Ask about the dataset') && !inbox.includes('SECRET-UNSENT-INBOX'), 'only items he chose to send');
  const all = JSON.stringify(files);
  for (const s of [...SENSITIVE, 'SECRET-LETTER-BODY', 'SECRET-RAW-NOTE']) assert.ok(!all.includes(s), s);
  const withLetters = X.vaultFiles(state(), { folder: 'Rawaq', letters: true, raw: true, lang: 'en' });
  const lp = withLetters.find((f) => f.path.startsWith('Rawaq/Letters/'));
  assert.ok(lp && lp.content.includes('open_on: 2027-01-23') && lp.content.includes('SECRET-LETTER-BODY'));
  assert.ok(withLetters.some((f) => f.path.startsWith('Rawaq/Raw Notes/')));
  for (const s of SENSITIVE) assert.ok(!JSON.stringify(withLetters).includes(s), s);
});

/* ---------- zip ---------- */
test('zip: CRC-32 check value and a readable archive with UTF-8 names', () => {
  assert.equal(X.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const z = X.zip([{ path: 'a.txt', content: 'hi' }, { path: 'Rawaq/عربي.md', content: 'مرحبا' }]);
  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const eocd = z.byteLength - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  assert.equal(dv.getUint16(eocd + 10, true), 2, 'two entries');
  let off = dv.getUint32(eocd + 16, true);
  const names = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(dv.getUint32(off, true), 0x02014b50);
    assert.ok(dv.getUint16(off + 8, true) & 0x800, 'UTF-8 flag');
    const n = dv.getUint16(off + 28, true), e = dv.getUint16(off + 30, true), c = dv.getUint16(off + 32, true);
    names.push(new TextDecoder().decode(z.slice(off + 46, off + 46 + n)));
    off += 46 + n + e + c;
  }
  assert.deepEqual(names, ['a.txt', 'Rawaq/عربي.md']);
});

/* ---------- integration payloads ---------- */
test('Google Calendar events: dedicated time zone, weekly rule, protected time as «وقت إلك 🌿»', () => {
  const e = P.gcalEvent(slots[0], { ...cfg, lang: 'ar' }, '2026-10-24');
  assert.deepEqual(e.start, { dateTime: '2026-10-30T18:00:00', timeZone: 'Asia/Damascus' });
  assert.deepEqual(e.end, { dateTime: '2026-10-31T00:00:00', timeZone: 'Asia/Damascus' });
  assert.deepEqual(e.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=FR']);
  assert.equal(e.summary, 'وقت إلك 🌿');
  assert.equal(e.extendedProperties.private.rawaqId, 'rest');
  const d = P.gcalDeadline({ id: 'o', name: 'Summer School 2027', deadline: '2026-11-16' }, 'en');
  assert.deepEqual(d.start, { date: '2026-11-16' });
  assert.deepEqual(d.end, { date: '2026-11-17' });
});

test('Microsoft To Do tasks: next tiny steps of active projects and application documents', () => {
  const tasks = P.msTasks(state(), 'en');
  const titles = tasks.map((t) => t.title);
  assert.ok(titles.includes('Reread reviewer 2 · Paper revision'));
  assert.ok(titles.some((t) => t.startsWith('CV · Summer School 2027')));
  assert.ok(!titles.some((t) => t.includes('SECRET')), 'paused projects stay out');
  assert.equal(tasks.find((t) => t.title.startsWith('CV')).done, true);
  assert.equal(tasks.find((t) => t.title.startsWith('Motivation')).done, false);
  assert.equal(new Set(tasks.map((t) => t.key)).size, tasks.length, 'stable unique keys');
});

test('Notion pages for reviews, wins and opportunities', () => {
  const s = state();
  const r = P.notionReviewPage(s.reviews[0], 'db1', 'en');
  assert.equal(r.parent.database_id, 'db1');
  assert.equal(r.properties.Date.date.start, '2026-10-17');
  assert.equal(r.properties.Type.select.name, 'Weekly review');
  assert.ok(JSON.stringify(r.children).includes('A walk with friends'));
  const w = P.notionWinPage(s.wins[0], 'db1', 'en');
  assert.equal(w.properties.Name.title[0].text.content, 'Explained the model to the team');
  const o = P.notionOppPage(s.opportunities[0], 'db2', 'en');
  assert.equal(o.properties.Deadline.date.start, '2026-11-16');
  assert.equal(o.properties.Status.select.name, 'Preparing');
  const long = P.notionWinPage({ id: 'x', date: '2026-10-01', text: 'x'.repeat(5000) }, 'db1', 'en');
  assert.ok(long.properties.Name.title[0].text.content.length <= 2000);
});

test('imported items always land in the inbox, once, with due dates as plain information', () => {
  const existing = [{ id: 'i9', text: 'old', source: 'mstodo', externalId: 'T1' }];
  const incoming = [{ id: 'T1', title: 'already here' }, { id: 'T2', title: 'Write the abstract', due: '2026-10-01' }];
  const out = P.inboxFromExternal(incoming, 'mstodo', existing, () => 'new-id', '2026-10-24T10:00:00Z');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { id: 'new-id', text: 'Write the abstract', source: 'mstodo', externalId: 'T2', due: '2026-10-01', createdAt: '2026-10-24T10:00:00Z' });
  assert.ok(!('status' in out[0]) && !('pinnedDate' in out[0]), 'never a task on Today, never a status');
});

test('nothing sensitive is ever in an outgoing payload', () => {
  const s = state();
  const out = [
    ...s.slots.map((x) => P.gcalEvent(x, cfg, '2026-10-24')),
    ...s.opportunities.map((o) => P.gcalDeadline(o, 'en')),
    P.msTasks(s, 'en'),
    ...s.reviews.map((r) => P.notionReviewPage(r, 'db', 'en')),
    ...s.wins.map((w) => P.notionWinPage(w, 'db', 'en')),
    ...s.opportunities.map((o) => P.notionOppPage(o, 'db', 'en')),
  ];
  const json = JSON.stringify(out);
  for (const m of [...SENSITIVE, 'SECRET-LETTER-BODY', 'SECRET-RAW-NOTE', 'SECRET-UNSENT-INBOX']) assert.ok(!json.includes(m), m);
  assert.deepEqual(P.NEVER_SENT.slice().sort(), ['dayLogs', 'decisions', 'faithNotes', 'prayers', 'questions', 'resetUses']);
});

test('PKCE: RFC 7636 appendix B check vector', async () => {
  assert.equal(await P.pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const v = P.pkceVerifier();
  assert.match(v, /^[A-Za-z0-9\-._~]{43,128}$/);
});
