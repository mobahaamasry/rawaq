// Copy and colour audit: the app source must never contain streak / overdue / missed language or red failure colours.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
function files(dir, exts) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p, exts));
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}
const sources = [...files(path.join(root, 'js'), ['.js']), ...files(path.join(root, 'css'), ['.css']), path.join(root, 'index.html'),
  ...['sw.js'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f))];

const FORBIDDEN = [
  /streak/i, /overdue/i, /\bmissed\b/i, /you missed/i, /\bbehind\b/i, /\bfailed\b/i, /\bfailure\b/i, /\bpenalt/i,
  /\bscore\b/i, /\bxp\b/i, /leaderboard/i, /\bbadge\b/i, /\bcalorie/i,
  /فاتك/, /فوّت/, /متأخر/, /تأخرت/, /فشلت/, /قصّرت/, /لازم/, /عليك أن/, /متراكمة/,
];
const RED = [/\bred\b/i, /#f00\b/i, /#ff0000/i, /crimson/i, /tomato/i, /#e53935/i, /#d32f2f/i, /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/i];

test('negative control: the audit catches known-bad copy and colours', () => {
  const bad = ['3 day streak', 'You missed 2 sessions', 'Overdue', "You're behind", 'فاتك يومين', 'لازم تخلص', 'color: red;', 'fill="#ff0000"'];
  for (const s of bad) assert.ok([...FORBIDDEN, ...RED].some((re) => re.test(s)), 'should flag: ' + s);
  const fine = ['ما في شي متراكم', 'هالوقت إلك', 'stored', 'bored', 'rendered'];
  for (const s of fine) assert.ok(![...FORBIDDEN, ...RED].some((re) => re.test(s)), 'should pass: ' + s);
});

test('no forbidden copy in the app source', () => {
  const hits = [];
  for (const f of sources) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const re of FORBIDDEN) if (re.test(line)) hits.push(path.relative(root, f) + ':' + (i + 1) + ' ' + re + '  ' + line.trim().slice(0, 90));
    });
  }
  assert.deepEqual(hits, []);
});

test('no red failure colours anywhere', () => {
  const hits = [];
  for (const f of sources) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const re of RED) if (re.test(line)) hits.push(path.relative(root, f) + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
    });
  }
  assert.deepEqual(hits, []);
});

test('the one carry-over phrase allowed is the kind one', () => {
  // "ما في شي متراكم" (nothing carries over) is the only use of متراكم, and always negated.
  for (const f of sources) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (line.includes('متراكم')) assert.match(line, /ما في شي متراكم/, f);
    }
  }
});

// The network has exactly one door (js/integrations/net.js), and only the optional bridges know remote addresses.
const rel = (f) => path.relative(root, f).replace(/\\/g, '/');
const NET_DOOR = ['js/integrations/net.js'];
const REMOTE_OK = ['js/integrations/google.js', 'js/integrations/mstodo.js', 'js/integrations/notion.js'];
const SW = ['sw.js'];

test('network calls only through the one door', () => {
  const hits = [];
  for (const f of sources) {
    const s = fs.readFileSync(f, 'utf8');
    if (/\bfetch\(/.test(s) && !NET_DOOR.includes(rel(f)) && !SW.includes(rel(f))) hits.push(rel(f) + ' fetch(');
    for (const re of [/XMLHttpRequest/, /sendBeacon/, /new WebSocket/, /EventSource\(/]) if (re.test(s)) hits.push(rel(f) + ' ' + re);
  }
  assert.deepEqual(hits, []);
});

test('remote addresses live only in the optional bridges; nothing remote loads at startup', () => {
  const hits = [];
  for (const f of sources) {
    const s = fs.readFileSync(f, 'utf8');
    if (/https?:\/\/(?!www\.w3\.org)/.test(s) && !REMOTE_OK.includes(rel(f))) hits.push(rel(f));
  }
  assert.deepEqual(hits, []);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/<(script|link)[^>]+(src|href)="(https?:)?\/\//.test(html), 'index.html loads only local files');
});

test('offline: every app file is in the service worker list, and the list has no strays', () => {
  const { assetsOf } = require('../scripts/stamp-sw.js');
  const assets = new Set(assetsOf(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')));
  const needed = [
    'index.html', 'manifest.webmanifest', 'icon.svg', 'css/rawaq.css',
    ...files(path.join(root, 'js'), ['.js']).map(rel),
    ...files(path.join(root, 'fonts'), ['.woff2']).map(rel),
    ...files(path.join(root, 'icons'), ['.png', '.svg']).map(rel),
  ];
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) needed.push(m[1]);
  assert.deepEqual(needed.filter((f) => !assets.has(f)), [], 'missing from sw.js ASSETS');
  assert.deepEqual([...assets].filter((a) => a !== './' && !fs.existsSync(path.join(root, a))), [], 'listed but not on disk');
});

test('offline: the cache version matches the files (run node scripts/stamp-sw.js after any change)', () => {
  const { assetsOf, versionFor } = require('../scripts/stamp-sw.js');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(sw.match(/const VERSION = '([^']*)'/)[1], versionFor(assetsOf(sw)));
});

test('no bridge reads the tables that never leave (Reset, feelings, open questions, faith)', () => {
  const hits = [];
  for (const f of files(path.join(root, 'js', 'integrations'), ['.js'])) {
    const s = fs.readFileSync(f, 'utf8');
    for (const t of ['resetUses', 'dayLogs', 'questions', 'prayers', 'faithNotes', 'decisions']) {
      if (new RegExp("Store\\.(all|get)\\('" + t + "'").test(s)) hits.push(rel(f) + ' reads ' + t);
    }
  }
  assert.deepEqual(hits, []);
});
