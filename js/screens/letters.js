/* Letters to your future self, and raw notes written from inside a feeling. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const nowIso = () => new Date().toISOString();
  const day = () => root.App.clock().day;

  let rawEl = null, rawId = null, rawTimer = 0;

  function lettersTab() {
    const d = day();
    const ls = Store.all('letters').sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1));
    const due = C.lettersDue(ls, d);
    const sealed = ls.filter((l) => C.letterLocked(l, d));
    const whenNeeded = ls.filter((l) => !l.openOn && !l.archived);
    const opened = ls.filter((l) => l.openOn && l.opened);
    let html = '<button class="btn soft block" data-act="letter-new">' + UI.icon('pen') + L('اكتب رسالة لحالك بالمستقبل', 'Write to your future self') + '</button>';
    if (due.length) {
      html += '<div class="sec-title">' + L('وصل وقتها', 'Their day has come') + '</div>' + due.map((l) => '<div class="card letter"><div class="sealed">' + UI.icon('letter') + L('في رسالة منك إلك.', 'There\'s a letter from you, to you.') + '</div>' +
        '<div class="row-title" style="margin:8px 0 10px">' + UI.ut(l.title) + '</div><button class="btn soft sm" data-act="letter-open" data-id="' + l.id + '">' + L('افتحها', 'Open it') + '</button></div>').join('');
    }
    if (whenNeeded.length) {
      html += '<div class="sec-title">' + L('لما تحتاجها', 'For when you need it') + '</div><div class="card plain"><div class="rows">' + whenNeeded.map((l) => '<div class="row tap" data-act="letter-read" data-id="' + l.id + '"><div class="row-main"><div class="row-title">' + UI.ut(l.title) + '</div>' +
        (l.moment ? '<div class="row-sub">' + T('اقراها لما: {m}', 'Read it when: {m}', { m: UI.raw(UI.ut(l.moment)) }) + '</div>' : '') + '</div>' + UI.icon('letter', 'muted') + '</div>').join('') + '</div></div>';
    }
    if (sealed.length) {
      html += '<div class="sec-title">' + L('مسكّرة لوقتها', 'Sealed until their day') + '</div><div class="card plain"><div class="rows">' + sealed.map((l) => '<div class="row"><div class="row-main"><div class="row-title">' + UI.ut(l.title) + '</div>' +
        '<div class="sealed">' + UI.icon('letter') + T('بتنفتح {d}', 'Opens {d}', { d: UI.fmtFull(l.openOn) }) + '</div></div>' +
        '<button class="icon-btn" data-act="letter-early" data-id="' + l.id + '" aria-label="' + L('خيارات', 'Options') + '">' + UI.icon('dots') + '</button></div>').join('') + '</div></div>';
    }
    if (opened.length) {
      html += '<details class="fold"><summary>' + L('رسائل انفتحت', 'Opened letters') + '</summary><div class="card plain quiet"><div class="rows">' + opened.map((l) => '<div class="row tap" data-act="letter-read" data-id="' + l.id + '"><div class="row-main"><div>' + UI.ut(l.title) + '</div><div class="row-sub">' + UI.fmtShort(l.openOn) + '</div></div></div>').join('') + '</div></div></details>';
    }
    if (!ls.length) html += '<div class="card" style="margin-top:14px">' + UI.empty('jasmine', L('أول رسالة بتستنّاك تكتبها.', 'Your first letter is waiting to be written.')) + '</div>';
    return html;
  }

  function rawTab() {
    const notes = Store.all('rawNotes').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    let html = '<p class="muted small">' + L('اكتب من جوّا الشعور، مو عنو. بلا عناوين، بلا ترتيب.', 'Write from inside the feeling, not about it. No titles, no order.') + '</p>' +
      '<button class="btn soft block" style="margin-top:8px" data-act="raw-open">' + UI.icon('pen') + L('ابدأ تكتب', 'Start writing') + '</button>';
    if (notes.length) {
      html += '<div class="card plain" style="margin-top:14px"><div class="rows">' + notes.map((n) => '<div class="row tap" data-act="raw-open" data-id="' + n.id + '"><div class="row-main">' +
        '<div class="row-sub">' + UI.fmtShort(n.createdAt.slice(0, 10)) + ' · ' + UI.tsTime(n.createdAt) + '</div>' +
        '<div class="ut" dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(n.body.split('\n')[0]) + '</div></div></div>').join('') + '</div></div>';
    }
    return html;
  }

  root.Screens.letters = {
    title: () => L('رسائل', 'Letters'),
    render(r) {
      const tab = r.query.t === 'raw' ? 'raw' : 'letters';
      return '<nav class="seg"><a href="#/more/letters"' + (tab === 'letters' ? ' aria-current="page"' : '') + '>' + L('رسائل للمستقبل', 'Letters to the future') + '</a>' +
        '<a href="#/more/letters?t=raw"' + (tab === 'raw' ? ' aria-current="page"' : '') + '>' + L('كتابة خام', 'Raw notes') + '</a></nav>' +
        (tab === 'raw' ? rawTab() : lettersTab());
    },
    unmount() { /* the raw writer is a separate layer and closes itself on navigation */ },
  };

  function letterForm(l, prefill, inboxId) {
    const v = l || { title: '', body: prefill || '', openOn: C.addMonths(day(), 3), moment: '' };
    const mode = v.openOn ? 'date' : 'need';
    return '<h3>' + (l ? L('الرسالة', 'The letter') : L('رسالة لحالك', 'A letter to yourself')) + '</h3><form data-form="letter-save"><input type="hidden" name="id" value="' + (l ? l.id : '') + '">' +
      (inboxId ? '<input type="hidden" name="inboxId" value="' + inboxId + '">' : '') +
      '<label class="field"><span>' + L('العنوان', 'Title') + '</span><input name="title" dir="auto" required value="' + UI.esc(v.title) + '" placeholder="' + L('مثلاً: لما تخلص الامتحانات', 'e.g. For after the exams') + '"></label>' +
      '<label class="field"><span>' + L('الرسالة', 'The letter') + '</span><textarea name="body" dir="auto" style="min-height:160px" required>' + UI.esc(v.body) + '</textarea></label>' +
      '<div class="field"><span>' + L('إمتى بتنفتح؟', 'When does it open?') + '</span><div class="chips">' +
      '<label class="chip"><input type="radio" name="mode" value="date"' + (mode === 'date' ? ' checked' : '') + '>' + L('بتاريخ', 'On a date') + '</label>' +
      '<label class="chip"><input type="radio" name="mode" value="need"' + (mode === 'need' ? ' checked' : '') + '>' + L('لما احتاجها', 'When I need it') + '</label></div></div>' +
      '<div class="grid2"><label class="field"><span>' + L('التاريخ', 'Date') + '</span><input type="date" name="openOn" value="' + (v.openOn || C.addMonths(day(), 3)) + '"></label>' +
      '<label class="field"><span>' + L('اقراها لما… (إذا بدك)', 'Read it when… (optional)') + '</span><input name="moment" dir="auto" value="' + UI.esc(v.moment || '') + '" placeholder="' + L('قرار كبير مستعجل', 'a big decision feels rushed') + '"></label></div>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (l ? '<button class="btn text" type="button" data-act="letter-delete" data-id="' + l.id + '">' + L('امسحها', 'Delete') + '</button>' : '') + '</div></form>';
  }
  function letterView(l) {
    return '<h3>' + UI.ut(l.title) + '</h3><p class="muted small">' + T('كتبتها {d}', 'Written {d}', { d: UI.fmtFull((l.createdAt || nowIso()).slice(0, 10)) }) + '</p>' +
      '<div class="card letter plain" style="line-height:2">' + UI.utb(l.body) + '</div>' +
      '<div class="btns end"><button class="btn text sm" data-act="letter-edit" data-id="' + l.id + '">' + UI.icon('edit') + L('عدّل', 'Edit') + '</button></div>';
  }

  /* ---------- raw writer: a plain full-screen page, saved as you type ---------- */
  function rawOpen(id) {
    if (rawEl) return;
    rawId = id || null;
    const n = rawId && Store.get('rawNotes', rawId);
    const stamp = n ? n.createdAt : nowIso();
    rawEl = document.createElement('div');
    rawEl.className = 'raw-wrap';
    rawEl.innerHTML = '<div class="bar"><span>' + UI.fmtShort(stamp.slice(0, 10)) + ' · ' + UI.tsTime(stamp) + '</span>' +
      '<button class="btn text sm" data-act="raw-close">' + L('خلص', 'Done') + '</button></div>' +
      '<textarea dir="auto" aria-label="' + L('كتابة خام', 'Raw notes') + '"></textarea>';
    document.getElementById('overlayRoot').appendChild(rawEl);
    const ta = rawEl.querySelector('textarea');
    ta.value = n ? n.body : '';
    ta.addEventListener('input', () => { clearTimeout(rawTimer); rawTimer = setTimeout(rawSave, 700); });
    requestAnimationFrame(() => { if (rawEl) rawEl.classList.add('on'); ta.focus(); });
  }
  function rawSave() {
    if (!rawEl) return;
    const body = rawEl.querySelector('textarea').value;
    if (!body.trim()) { if (rawId) { Store.del('rawNotes', rawId); rawId = null; } return; }
    if (!rawId) { rawId = Store.uid(); Store.put('rawNotes', { id: rawId, body, createdAt: nowIso() }); } else Store.patch('rawNotes', rawId, { body, editedAt: nowIso() });
  }
  function rawClose() {
    clearTimeout(rawTimer);
    rawSave();
    if (!rawEl) return;
    const e = rawEl;
    rawEl = null; rawId = null;
    e.classList.remove('on');
    setTimeout(() => e.remove(), 500);
  }
  root.addEventListener('hashchange', () => { if (rawEl) rawClose(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rawEl) rawClose(); });

  const A = root.Actions, F = root.Forms;
  A['letter-new'] = () => UI.sheet.open(() => letterForm(null));
  A['letter-edit'] = (el) => { const l = Store.get('letters', el.dataset.id); if (l) UI.sheet.open(() => letterForm(l)); };
  F['letter-save'] = (d) => {
    const cur = d.id ? Store.get('letters', d.id) : { id: Store.uid(), opened: false, createdAt: nowIso() };
    const openOn = d.mode === 'date' ? d.openOn || null : null;
    UI.sheet.close();
    if (d.inboxId) Store.del('inbox', d.inboxId);
    Store.put('letters', { ...cur, title: d.title.trim(), body: d.body.trim(), openOn, moment: (d.moment || '').trim(), opened: openOn && openOn > day() ? false : cur.opened });
    if (!d.id) UI.toast(openOn ? T('انحفظت. بتنفتح {d}.', 'Saved. It opens {d}.', { d: UI.fmtFull(openOn) }) : L('انحفظت لما تحتاجها.', 'Saved for when you need it.'));
  };
  A['letter-open'] = (el) => {
    const l = Store.get('letters', el.dataset.id);
    if (!l) return;
    Store.patch('letters', l.id, { opened: true, openedAt: nowIso() });
    UI.petals(6);
    UI.sheet.open(() => letterView(Store.get('letters', l.id)));
  };
  A['letter-read'] = (el) => { const l = Store.get('letters', el.dataset.id); if (l) UI.sheet.open(() => letterView(l)); };
  A['letter-early'] = (el) => {
    const l = Store.get('letters', el.dataset.id);
    if (!l) return;
    UI.confirm({
      title: T('هالرسالة مسكّرة لـ {d}.', 'This letter is sealed until {d}.', { d: UI.fmtFull(l.openOn) }),
      body: L('فيك تستنّاها، أو تفتحها هلق إذا حاسس إنك بحاجتها.', 'You can wait for it, or open it now if you feel you need it.'),
      yes: L('خليها مسكّرة', 'Keep it sealed'), no: L('افتحها هلق', 'Open it now'), noClass: 'text',
      onNo: () => A['letter-open'](el),
    });
  };
  A['letter-delete'] = (el) => UI.confirm({
    title: L('تمسح الرسالة؟', 'Delete the letter?'), yes: L('لا، خليها', 'No, keep it'), no: L('امسحها', 'Delete'), noClass: 'clay',
    onNo: () => UI.removeWithUndo([['letters', el.dataset.id]]),
  });
  A['raw-open'] = (el) => rawOpen(el.dataset.id);
  A['raw-close'] = () => rawClose();

  root.Letters = {
    fromText(text, inboxId) { UI.sheet.open(() => letterForm(null, text, inboxId)); },
    isWriting: () => !!rawEl,
  };
})(typeof self !== 'undefined' ? self : this);
