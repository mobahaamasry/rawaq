/* Rawaq exports: pure builders for .ics, Markdown, CSV, the reflection file, Obsidian vault files and a small zip.
   No DOM and no network. Loaded as window.Exports in the browser and require()'d by the Node tests. */
(function (root, factory) {
  var api = factory(root.Core || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Exports = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const LBL = {
    ar: {
      app: 'رواق', rest: 'وقت إلك 🌿', deadline: 'آخر يوم', intro: 'مادة للتأمل، مو تقييم.', quiet: 'فترة هادية. وهاد كمان منيح.',
      wins: 'نجوم', projects: 'مشاريع خلصت', papers: 'أوراق', apps: 'فرص', letters: 'رسائل كتبتها', enjoyed: 'شو انبسطت فيه', curiosity: 'من رف الفضول',
      told: 'حكيت لـ', review: 'المراجعة الأسبوعية', felt: 'كيف كان', blockers: 'شو عاق', shared: 'حكيت شي حقيقي لحدا', yes: 'إي', no: 'لأ', note: 'ملاحظة',
      nextStep: 'الخطوة الجاية', interview: 'أسئلة ممكن تنسأل', inbox: 'من راسك', defend: 'دافع عنها',
    },
    en: {
      app: 'Rawaq', rest: 'Your time 🌿', deadline: 'deadline', intro: 'Material for reflection, not a grade.', quiet: 'A quiet stretch. That is fine too.',
      wins: 'Wins', projects: 'Finished projects', papers: 'Papers', apps: 'Applications', letters: 'Letters written', enjoyed: 'What you enjoyed', curiosity: 'From the curiosity shelf',
      told: 'told', review: 'Weekly review', felt: 'How it felt', blockers: 'Got in the way', shared: 'Shared something real', yes: 'yes', no: 'no', note: 'Note',
      nextStep: 'Next tiny step', interview: 'Questions you might be asked', inbox: 'From your head', defend: 'Defend it',
    },
  };
  const t = (lang, k) => (LBL[lang === 'ar' ? 'ar' : 'en'])[k];
  const SLOT = { study: ['دراسة', 'Study'], gym: ['رياضة', 'Gym'], course: ['كورس', 'Course'], team: ['الفريق', 'Team'], rest: ['وقت إلك', 'Your time'], other: ['غير شي', 'Other'] };
  const PAPER = { idea: ['فكرة', 'idea'], writing: ['عم اكتبها', 'writing'], submitted: ['انبعتت', 'submitted'], review: ['تحت المراجعة', 'under review'], revision: ['تعديلات', 'revision'], published: ['انتشرت', 'published'] };
  const OPP = {
    considering: ['عم فكّر فيها', 'considering'], preparing: ['عم حضّر', 'preparing'], submitted: ['انبعتت', 'submitted'], interview: ['مقابلة', 'interview'],
    accepted: ['انقبلت', 'accepted'], rejected: ['ما زبطت هالمرة', 'did not work out this time'], skipped: ['تركتها', 'let go'],
  };
  const DEFEND = {
    background: ['الخلفية والفرضية', 'Background & hypothesis'], methods: ['الطرق', 'Methods'], data: ['الداتا', 'Data'], analysis: ['التحليل والموديل', 'Analysis / model'],
    results: ['النتائج', 'Results'], limitations: ['الحدود', 'Limitations'], differently: ['شو كنت بعمل غير', 'What I\'d do differently'],
    references: ['المراجع، متأكد منها', 'References verified'], aiPolicy: ['إفصاح الـ AI مطابق لسياسة المجلة', 'AI-use disclosure checked against the journal\'s policy'],
    explainBuild: ['بقدر اشرح كيف انبنت؟', 'Can I explain how it was built?'],
  };
  const CONF = [['ضعيف', 'shaky'], ['ماشي', 'getting there'], ['فاهمو', 'got it']];
  const BLOCK = { tired: ['تعب', 'tiredness'], family: ['ضغط عيلة', 'family pressure'], projects: ['مشاريع زيادة', 'too many projects'], sleep: ['نوم', 'sleep'], phone: ['موبايل', 'phone'], ill: ['مرض', 'being ill'], none: ['ولا شي', 'nothing'] };
  const FACES = ['😔', '😕', '😐', '🙂', '😌'];
  const pick = (map, k, lang) => (map[k] ? map[k][lang === 'ar' ? 0 : 1] : k);
  const arr = (x) => x || [];

  /* ---------- dates ---------- */
  const compact = (key, hm) => key.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00';
  function utcStamp(ts) { return new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function monthName(ym, lang, numerals) {
    const loc = lang === 'ar' ? 'ar-SY-u-nu-' + (numerals === 'western' ? 'latn' : 'arab') : 'en-GB';
    return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(ym + '-01T00:00:00Z'));
  }
  function isoWeek(key) {
    const d = new Date(C.keyToUTC(key));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const year = d.getUTCFullYear();
    const firstThu = new Date(Date.UTC(year, 0, 4));
    const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
    return year + '-W' + String(week).padStart(2, '0');
  }
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]+/g, '-').replace(/\s+/g, ' ').replace(/^[-\s.]+|[-\s.]+$/g, '').slice(0, 80) || 'untitled';

  /* ---------- week plan → calendar ---------- */
  function slotSummary(slot, lang) {
    if (slot.protected) return t(lang, 'rest');
    return slot.label || pick(SLOT, slot.type, lang);
  }
  // First real (wall-clock) occurrence of a slot. After-midnight slots belong to the evening before,
  // so on the wall they fall on the next date.
  function slotOccurrence(slot, fromWeekKey, cfg) {
    let day = slot.date;
    if (!day) {
      const base = slot.from || fromWeekKey;
      day = base;
      for (let i = 0; i < 7 && C.weekdayOf(day) !== slot.weekday; i++) day = C.addDays(base, i + 1);
    }
    const deh = (cfg.dayEndHour || 0) * 60;
    const s = C.hmToMin(slot.start), e = C.hmToMin(slot.end);
    const startDate = s < deh ? C.addDays(day, 1) : day;
    const endDate = e <= s ? C.addDays(startDate, 1) : startDate;
    return { start: compact(startDate, slot.start), end: compact(endDate, slot.end) };
  }
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  function rrule(slot, occ, cfg) {
    const wallDate = occ.start.slice(0, 4) + '-' + occ.start.slice(4, 6) + '-' + occ.start.slice(6, 8);
    let r = 'FREQ=WEEKLY;BYDAY=' + BYDAY[C.weekdayOf(wallDate)];
    if (slot.until) {
      const endOfLogicalDay = C.wallToTs(C.addDays(slot.until, 1), C.pad(cfg.dayEndHour || 0) + ':00', cfg.tz) - 1000;
      r += ';UNTIL=' + utcStamp(endOfLogicalDay);
    }
    return r;
  }
  const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  // Fold to 75 octets per line (RFC 5545), never splitting a character.
  function icsFold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const out = [];
    let cur = '', bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > 75) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function buildICS(state, opts) {
    opts = opts || {};
    const s = state.settings || {};
    const lang = s.lang === 'en' ? 'en' : 'ar';
    const tz = s.tz || '';
    const tzp = tz ? ';TZID=' + tz : '';
    const stamp = utcStamp(opts.nowTs || Date.now());
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rawaq//Week plan//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + icsEscape(t(lang, 'app'))];
    if (tz === 'Asia/Damascus') {
      L.push('BEGIN:VTIMEZONE', 'TZID:Asia/Damascus', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0300', 'TZNAME:+03', 'END:STANDARD', 'END:VTIMEZONE');
    }
    const cfg = { tz, dayEndHour: s.dayEndHour || 0 };
    for (const slot of arr(state.slots)) {
      const occ = slotOccurrence(slot, opts.fromWeekKey || slot.from, cfg);
      L.push('BEGIN:VEVENT', 'UID:' + slot.id + '@rawaq', 'DTSTAMP:' + stamp, 'DTSTART' + tzp + ':' + occ.start, 'DTEND' + tzp + ':' + occ.end);
      if (!slot.date) L.push('RRULE:' + rrule(slot, occ, cfg));
      L.push('SUMMARY:' + icsEscape(slotSummary(slot, lang)));
      if (slot.protected) L.push('TRANSP:TRANSPARENT');
      L.push('END:VEVENT');
    }
    if (opts.deadlines) {
      for (const o of arr(state.opportunities)) {
        if (!o.deadline || !C.OPP_OPEN.includes(o.status)) continue;
        L.push('BEGIN:VEVENT', 'UID:deadline-' + o.id + '@rawaq', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + o.deadline.replace(/-/g, ''),
          'DTEND;VALUE=DATE:' + C.addDays(o.deadline, 1).replace(/-/g, ''), 'SUMMARY:' + icsEscape(o.name + ' · ' + t(lang, 'deadline')), 'TRANSP:TRANSPARENT', 'END:VEVENT');
      }
    }
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  /* ---------- reflection (month or year) ---------- */
  function reflection(state, period, opts) {
    opts = opts || {};
    const lang = opts.lang === 'ar' ? 'ar' : 'en';
    const inP = (v) => !!v && (period.kind === 'month' ? String(v).slice(0, 7) === period.ym : String(v).slice(0, 4) === period.y);
    const title = period.kind === 'month' ? monthName(period.ym, lang, opts.numerals) : (lang === 'ar' && opts.numerals !== 'western' ? C.toEastern(period.y) : period.y);
    const out = ['# ' + t(lang, 'app') + ' · ' + title, '', '_' + t(lang, 'intro') + '_', ''];
    const section = (k, lines) => { if (lines.length) out.push('## ' + t(lang, k), '', ...lines, ''); };
    section('wins', arr(state.wins).filter((w) => inP(w.date)).sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((w) => '- ' + w.date + ' · ' + w.text + (w.toldWho ? ' (' + t(lang, 'told') + ' ' + w.toldWho + ')' : '')));
    section('projects', arr(state.projects).filter((p) => p.status === 'done' && inP(p.doneAt)).map((p) => '- ' + p.name + ' (' + p.doneAt.slice(0, 10) + ')'));
    section('papers', arr(state.papers).map((p) => {
      const log = arr(p.statusLog).filter((x) => inP(x.at));
      if (!log.length) return null;
      const before = arr(p.statusLog).filter((x) => x.at < log[0].at).slice(-1)[0];
      const chain = (before ? [before] : []).concat(log).map((x) => pick(PAPER, x.status, lang)).join(' → ');
      return '- ' + p.title + ': ' + chain + ' (' + log[log.length - 1].at.slice(0, 10) + ')';
    }).filter(Boolean));
    section('apps', arr(state.opportunities).filter((o) => inP(o.createdAt) || inP(o.statusAt) || inP(o.submittedAt))
      .map((o) => '- ' + o.name + ' · ' + pick(OPP, o.status, lang)));
    section('letters', arr(state.letters).filter((l) => inP(l.createdAt)).map((l) => '- ' + l.title + (opts.letterBodies ? '\n\n  ' + String(l.body || '').replace(/\n/g, '\n  ') + '\n' : '')));
    section('enjoyed', arr(state.reviews).filter((r) => inP(r.id) && r.enjoyed).sort((a, b) => (a.id < b.id ? -1 : 1)).map((r) => '- ' + r.id + ' · ' + r.enjoyed));
    section('curiosity', arr(state.curiosity).filter((c) => (c.status === 'done' || c.status === 'loved') && inP(c.finishedAt)).map((c) => '- ' + c.title + (c.status === 'loved' ? ' ♥' : '')));
    if (out.length === 4) out.push(t(lang, 'quiet'), '');
    return out.join('\n');
  }

  /* ---------- CSV ---------- */
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n') + '\r\n';
  const MODULES = ['wins', 'projects', 'papers', 'reviews', 'opportunities', 'curiosity', 'letters', 'sessions'];
  function moduleCSV(state, m) {
    const by = (k) => (a, b) => (String(a[k] || '') < String(b[k] || '') ? -1 : 1);
    switch (m) {
      case 'wins': return csv(['date', 'text', 'told'], arr(state.wins).slice().sort(by('date')).map((w) => [w.date, w.text, w.toldWho || '']));
      case 'projects': return csv(['name', 'area', 'tier', 'kind', 'status', 'next_step'], arr(state.projects).map((p) => [p.name, p.area, p.tier, p.kind, p.status, p.nextStep || '']));
      case 'papers': return csv(['title', 'venue', 'status', 'coauthors', 'my_role'], arr(state.papers).map((p) => [p.title, p.venue, p.status, p.coauthors, p.myRole]));
      case 'reviews': return csv(['week', 'felt', 'sessions', 'enjoyed', 'shared'], arr(state.reviews).slice().sort(by('id')).map((r) => [r.id, r.overall ? FACES[r.overall - 1] : '', r.sessions || '', r.enjoyed || '', r.shared || '']));
      case 'opportunities': return csv(['name', 'org', 'location', 'deadline', 'status', 'expected_response', 'link'], arr(state.opportunities).slice().sort(by('deadline')).map((o) => [o.name, o.org, o.location, o.deadline, o.status, o.expectedResponse, o.link]));
      case 'curiosity': return csv(['title', 'type', 'status', 'link'], arr(state.curiosity).map((c) => [c.title, c.type, c.status, c.link]));
      case 'letters': return csv(['title', 'written', 'opens'], arr(state.letters).map((l) => [l.title, (l.createdAt || '').slice(0, 10), l.openOn || '']));
      case 'sessions': return csv(['day', 'category', 'minutes', 'with', 'label'], arr(state.sessions).slice().sort(by('day')).map((s) => [s.day, s.category, s.minutes, s.withWhom, s.label]));
      default: return '';
    }
  }

  /* ---------- Markdown per module ---------- */
  function moduleMarkdown(state, m, lang) {
    lang = lang === 'ar' ? 'ar' : 'en';
    const out = ['# ' + t(lang, 'app') + ' · ' + m, ''];
    if (m === 'wins') {
      const g = {};
      for (const w of arr(state.wins)) (g[w.date.slice(0, 7)] = g[w.date.slice(0, 7)] || []).push(w);
      for (const k of Object.keys(g).sort().reverse()) {
        out.push('## ' + monthName(k, lang, 'western'), '');
        for (const w of g[k].sort((a, b) => (a.date < b.date ? -1 : 1))) out.push('- ' + w.date + ' · ' + w.text + (w.toldWho ? ' (' + t(lang, 'told') + ' ' + w.toldWho + ')' : ''));
        out.push('');
      }
    } else if (m === 'letters') {
      for (const l of arr(state.letters)) out.push('- ' + l.title + (l.openOn ? ' · ' + l.openOn : ''));
    } else {
      const rows = moduleCSV(state, m).trim().split('\r\n');
      if (rows.length < 2) return out.join('\n');
      const head = rows[0].split(',');
      out.push('| ' + head.join(' | ') + ' |', '|' + head.map(() => ' --- |').join(''));
      const parse = (line) => { const cells = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch; } cells.push(cur); return cells; };
      for (const r of rows.slice(1)) out.push('| ' + parse(r).map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |');
    }
    return out.join('\n') + '\n';
  }

  /* ---------- Obsidian vault ---------- */
  const y = (v) => JSON.stringify(v == null ? '' : v);
  function vaultFiles(state, opts) {
    opts = opts || {};
    const lang = opts.lang === 'ar' ? 'ar' : 'en';
    const F = (opts.folder || 'Rawaq').replace(/^\/+|\/+$/g, '');
    const files = [];
    const add = (path, lines) => files.push({ path: F + '/' + path, content: lines.join('\n') + '\n' });
    const projById = {};
    for (const p of arr(state.projects)) projById[p.id] = p;

    for (const r of arr(state.reviews)) {
      if (!r.doneAt) continue;
      const end = C.addDays(r.id, 6);
      const blk = arr(r.blockers).map((b) => pick(BLOCK, b, lang)).concat(r.blockerOther ? [r.blockerOther] : []);
      add('Weekly Reviews/' + isoWeek(C.addDays(r.id, 3)) + '.md', [
        '---', 'type: weekly-review', 'week_start: ' + r.id, 'week_end: ' + end, 'tags: [rawaq/review]', '---', '',
        '# ' + t(lang, 'review') + ' · ' + r.id + ' → ' + end, '',
        r.overall ? '- ' + t(lang, 'felt') + ': ' + FACES[r.overall - 1] : '',
        r.enjoyed ? '- ' + t(lang, 'enjoyed') + ': ' + r.enjoyed : '',
        blk.length ? '- ' + t(lang, 'blockers') + ': ' + blk.join(', ') : '',
        r.shared ? '- ' + t(lang, 'shared') + ': ' + t(lang, r.shared === 'yes' ? 'yes' : 'no') : '',
        r.note ? '- ' + t(lang, 'note') + ': ' + r.note : '',
        '', '[[Wins/' + r.id.slice(0, 7) + ']]',
      ].filter((l, i, a) => l !== '' || a[i - 1] !== ''));
    }
    const months = {};
    for (const w of arr(state.wins)) (months[w.date.slice(0, 7)] = months[w.date.slice(0, 7)] || []).push(w);
    for (const m of Object.keys(months)) {
      add('Wins/' + m + '.md', ['---', 'type: wins', 'month: ' + m, 'tags: [rawaq/win]', '---', '', '# ' + t(lang, 'wins') + ' · ' + monthName(m, lang, 'western'), '',
        ...months[m].sort((a, b) => (a.date < b.date ? -1 : 1)).map((w) => '- ' + w.date + ' · ' + w.text + (w.toldWho ? ' (' + t(lang, 'told') + ' ' + w.toldWho + ')' : '') + ' #rawaq/win')]);
    }
    for (const p of arr(state.papers)) {
      const proj = p.projectId && projById[p.projectId];
      const lines = ['---', 'type: paper', 'title: ' + y(p.title), 'venue: ' + y(p.venue), 'status: ' + (p.status || ''), 'coauthors: ' + y(p.coauthors), 'tags: [rawaq/paper]', '---', '',
        '# ' + p.title, '', proj ? 'Project: [[Projects/' + safeName(proj.name) + ']]' : '', '', '## ' + t(lang, 'defend'), ''];
      for (const s of C.DEFEND_SECTIONS) {
        const d = (p.defend && p.defend[s]) || {};
        lines.push('- [' + (d.confidence === 2 ? 'x' : ' ') + '] ' + pick(DEFEND, s, lang) + (d.confidence != null ? ' · ' + pick({ c: CONF[d.confidence] }, 'c', lang) : ''));
        if (d.note) lines.push('  - ' + d.note);
      }
      if (arr(p.interviewQs).length) {
        lines.push('', '## ' + t(lang, 'interview'), '');
        for (const q of p.interviewQs) lines.push('- **' + q.q + '**' + (q.a ? '\n  ' + q.a : ''));
      }
      add('Papers/' + safeName(p.title) + '.md', lines.filter((l, i, a) => l !== '' || a[i - 1] !== ''));
    }
    for (const p of arr(state.projects)) {
      if (p.status === 'archived') continue;
      add('Projects/' + safeName(p.name) + '.md', ['---', 'type: project', 'area: ' + (p.area || ''), 'tier: ' + (p.tier || ''), 'kind: ' + (p.kind || 'project'), 'status: ' + p.status, 'tags: [rawaq/project]', '---', '',
        '# ' + p.name, '', p.nextStep ? '- ' + t(lang, 'nextStep') + ': ' + p.nextStep : '']);
    }
    const sent = arr(state.inbox).filter((i) => i.toObsidian);
    if (sent.length) add('Inbox.md', ['---', 'type: inbox', 'tags: [rawaq/inbox]', '---', '', '# ' + t(lang, 'inbox'), '', ...sent.map((i) => '- ' + i.createdAt.slice(0, 10) + ' · ' + i.text)]);
    if (opts.letters) {
      const used = new Set();
      for (const l of arr(state.letters)) {
        let name = safeName(l.title);
        if (used.has(name)) name += ' ' + l.id.slice(0, 4);
        used.add(name);
        add('Letters/' + name + '.md', ['---', 'type: letter', 'written: ' + (l.createdAt || '').slice(0, 10), 'open_on: ' + (l.openOn || 'when needed'), l.moment ? 'read_when: ' + y(l.moment) : '', 'tags: [rawaq/letter]', '---', '', '# ' + l.title, '', l.body || ''].filter((x) => x !== '' || true));
      }
    }
    if (opts.raw) {
      for (const n of arr(state.rawNotes)) {
        const w = C.wallParts(Date.parse(n.createdAt), (state.settings || {}).tz);
        const stamp = C.keyFromYMD(w.y, w.m, w.d) + ' ' + C.pad(w.hh) + C.pad(w.mm);
        add('Raw Notes/' + stamp + '.md', ['---', 'type: raw-note', 'written: ' + n.createdAt, 'tags: [rawaq/raw]', '---', '', n.body]);
      }
    }
    return files;
  }

  /* ---------- zip (stored, no compression) ---------- */
  let CRC_TABLE = null;
  function crc32(bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files, nowTs) {
    const enc = new TextEncoder();
    const d = new Date(nowTs || Date.UTC(2026, 0, 1));
    const dosTime = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
    const dosDate = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path), data = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      chunks.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    const all = [...chunks, ...central, new Uint8Array(e.buffer)];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  return {
    LBL, slotSummary, slotOccurrence, rrule, icsEscape, icsFold, buildICS, reflection, csvCell, MODULES, moduleCSV, moduleMarkdown,
    isoWeek, safeName, vaultFiles, crc32, zip, monthName, pick, OPP, PAPER,
  };
});
