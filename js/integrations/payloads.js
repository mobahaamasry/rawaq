/* What each bridge sends, built as plain data (no network here). Each builder only reads the tables it needs,
   and the tables in NEVER_SENT are never passed to any of them. */
(function (root, factory) {
  const req = typeof require === 'function';
  var api = factory(root.Core || (req ? require('../core.js') : null), root.Exports || (req ? require('../exports.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Payloads = api;
})(typeof self !== 'undefined' ? self : this, function (C, X) {
  'use strict';

  // Reset, check-in feelings, open questions, faith and decisions never leave the app.
  const NEVER_SENT = ['resetUses', 'dayLogs', 'questions', 'prayers', 'faithNotes', 'decisions'];
  const arr = (x) => x || [];
  const DOCS = { cv: ['CV', 'CV'], motivation: ['رسالة الدافع', 'Motivation letter'], transcript: ['كشف العلامات', 'Transcript'], gpa: ['تحويل المعدل', 'GPA conversion'], referees: ['المعرّفين', 'Referees'], language: ['امتحان اللغة', 'Language test'] };
  const FACES = ['😔', '😕', '😐', '🙂', '😌'];
  const OPP_NOTION = { considering: 'Considering', preparing: 'Preparing', submitted: 'Submitted', interview: 'Interview', accepted: 'Accepted', rejected: 'Not this time', skipped: 'Let go' };
  const lng = (lang) => (lang === 'ar' ? 0 : 1);

  /* ---------- Google Calendar ---------- */
  const isoLocal = (c) => c.slice(0, 4) + '-' + c.slice(4, 6) + '-' + c.slice(6, 8) + 'T' + c.slice(9, 11) + ':' + c.slice(11, 13) + ':' + c.slice(13, 15);
  function gcalEvent(slot, cfg, fromWeekKey) {
    const occ = X.slotOccurrence(slot, fromWeekKey, cfg);
    const tz = cfg.tz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
    const ev = {
      summary: X.slotSummary(slot, cfg.lang),
      start: { dateTime: isoLocal(occ.start), timeZone: tz },
      end: { dateTime: isoLocal(occ.end), timeZone: tz },
      extendedProperties: { private: { rawaqId: slot.id } },
    };
    if (!slot.date) ev.recurrence = ['RRULE:' + X.rrule(slot, occ, cfg)];
    if (slot.protected) { ev.colorId = '2'; ev.transparency = 'transparent'; }
    return ev;
  }
  function gcalDeadline(o, lang) {
    return {
      summary: o.name + ' · ' + X.LBL[lang === 'ar' ? 'ar' : 'en'].deadline,
      start: { date: o.deadline }, end: { date: C.addDays(o.deadline, 1) },
      transparency: 'transparent', extendedProperties: { private: { rawaqId: 'deadline-' + o.id } },
    };
  }

  /* ---------- Microsoft To Do ---------- */
  // Next tiny steps of active projects, and the document checklist of open applications.
  function msTasks(state, lang) {
    const out = [];
    for (const p of arr(state.projects)) {
      if (p.status !== 'active' || !p.nextStep) continue;
      out.push({ key: 'p:' + p.id + ':' + C.hash(p.nextStep).toString(36), title: p.nextStep + ' · ' + p.name, done: false, ref: { kind: 'step', projectId: p.id, step: p.nextStep } });
    }
    for (const o of arr(state.opportunities)) {
      if (!C.OPP_OPEN.includes(o.status)) continue;
      for (const k of Object.keys(o.docs || {})) {
        out.push({ key: 'o:' + o.id + ':' + k, title: (DOCS[k] ? DOCS[k][lng(lang)] : k) + ' · ' + o.name, done: !!o.docs[k], ref: { kind: 'doc', oppId: o.id, doc: k } });
      }
    }
    return out;
  }

  /* ---------- Notion ---------- */
  const rt = (s) => [{ type: 'text', text: { content: String(s == null ? '' : s).slice(0, 2000) } }];
  const para = (s) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(s) } });
  function notionReviewPage(r, dbId, lang) {
    const en = lang !== 'ar';
    const lines = [];
    if (r.overall) lines.push((en ? 'How it felt: ' : 'كيف كان: ') + FACES[r.overall - 1]);
    if (r.enjoyed) lines.push((en ? 'Enjoyed: ' : 'انبسطت فيه: ') + r.enjoyed);
    const blk = arr(r.blockers).concat(r.blockerOther ? [r.blockerOther] : []);
    if (blk.length) lines.push((en ? 'Got in the way: ' : 'شو عاق: ') + blk.join(', '));
    if (r.shared) lines.push((en ? 'Shared something real: ' : 'حكيت شي حقيقي: ') + (r.shared === 'yes' ? (en ? 'yes' : 'إي') : (en ? 'no' : 'لأ')));
    if (r.note) lines.push((en ? 'Note: ' : 'ملاحظة: ') + r.note);
    return {
      parent: { database_id: dbId },
      properties: {
        Name: { title: rt((en ? 'Weekly review · ' : 'المراجعة الأسبوعية · ') + r.id + ' → ' + C.addDays(r.id, 6)) },
        Date: { date: { start: r.id } },
        Type: { select: { name: 'Weekly review' } },
      },
      children: lines.map(para),
    };
  }
  function notionWinPage(w, dbId, lang) {
    return {
      parent: { database_id: dbId },
      properties: { Name: { title: rt(w.text) }, Date: { date: { start: w.date } }, Type: { select: { name: 'Win' } } },
      children: w.toldWho ? [para((lang === 'ar' ? 'حكيت لـ ' : 'Told ') + w.toldWho)] : [],
    };
  }
  function notionOppPage(o, dbId) {
    const props = { Name: { title: rt(o.name) }, Status: { select: { name: OPP_NOTION[o.status] || 'Considering' } } };
    if (o.deadline) props.Deadline = { date: { start: o.deadline } };
    if (o.link) props.Link = { url: o.link };
    return { parent: { database_id: dbId }, properties: props };
  }

  /* ---------- incoming: always to the inbox, once ---------- */
  function inboxFromExternal(items, source, existing, idFn, nowIso) {
    const have = new Set(arr(existing).filter((i) => i.source === source).map((i) => i.externalId));
    return arr(items).filter((i) => i && i.id && i.title && !have.has(i.id)).map((i) => ({
      id: idFn(), text: String(i.title), source, externalId: i.id, due: i.due || null, createdAt: nowIso,
    }));
  }

  /* ---------- PKCE (RFC 7636) ---------- */
  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function pkceVerifier() { const a = new Uint8Array(32); crypto.getRandomValues(a); return b64url(a); }
  async function pkceChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return b64url(new Uint8Array(digest));
  }

  return { NEVER_SENT, gcalEvent, gcalDeadline, msTasks, notionReviewPage, notionWinPage, notionOppPage, inboxFromExternal, pkceVerifier, pkceChallenge, b64url };
});
