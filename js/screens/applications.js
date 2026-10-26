/* Applications & opportunities: track them here so they don't live in your head. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const nowIso = () => new Date().toISOString();
  const day = () => root.App.clock().day;

  const STATUS = {
    considering: ['عم فكّر فيها', 'Considering'], preparing: ['عم حضّر', 'Preparing'], submitted: ['انبعتت', 'Submitted'],
    interview: ['مقابلة', 'Interview'], accepted: ['انقبلت', 'Accepted'], rejected: ['ما زبطت هالمرة', 'Didn\'t work out this time'], skipped: ['تركتها', 'Let it go'],
  };
  const DOCS = {
    cv: ['<bdi>CV</bdi>', 'CV'], motivation: ['رسالة الدافع', 'Motivation letter'], transcript: ['كشف العلامات', 'Transcript'],
    gpa: ['تحويل المعدل', 'GPA conversion'], referees: ['المعرّفين', 'Referees'], language: ['امتحان اللغة', 'Language test'],
  };
  const statusName = (s) => L(...(STATUS[s] || STATUS.considering));

  function docDots(o) {
    const keys = Object.keys(o.docs || {});
    if (!keys.length) return '';
    return '<div class="dots" style="margin-top:8px" aria-hidden="true">' + keys.map((k) => '<i class="' + (o.docs[k] ? 's2' : '') + '"></i>').join('') + '</div>';
  }

  function oppCard(o, hl) {
    const d = day();
    let when = '';
    if (o.deadline) {
      when = hl ? '<span class="tag lamp">' + UI.fmtShort(o.deadline) + '</span>' : '<span class="tag">' + UI.fmtShort(o.deadline) + '</span>';
    }
    const passed = o.deadline && o.deadline < d && o.status !== 'interview';
    return '<a class="card' + (hl ? '' : ' plain') + '" style="display:block;color:inherit" href="#/work/apps/' + o.id + '">' +
      '<div class="card-head"><div class="row-main"><div class="row-title">' + UI.ut(o.name) + '</div>' +
      '<div class="row-sub">' + [o.org ? UI.ut(o.org) : '', o.location ? UI.ut(o.location) : '', statusName(o.status)].filter(Boolean).join(' · ') + '</div></div>' + when + '</div>' +
      docDots(o) +
      (passed ? '<p class="small muted" style="margin-top:8px">' + L('وقتها خلص. فيك تتركها، أو تعدّل التاريخ إذا تغيّر.', 'Its time has passed. You can let it go, or change the date if it moved.') + '</p>' : '') + '</a>';
  }

  function listView() {
    const b = C.oppBuckets(Store.all('opportunities'), day());
    let html = '<p class="muted small">' + L('الفرص هون، مو براسك.', 'The opportunities live here, not in your head.') + '</p>' +
      '<div class="btns end" style="margin:8px 0 12px"><button class="btn soft sm" data-act="opp-new">' + UI.icon('plus') + L('فرصة', 'Opportunity') + '</button></div>';
    if (!b.active.length && !b.waiting.length && !b.closed.length) html += '<div class="card">' + UI.empty('rooftop', L('لما تلاقي فرصة حلوة، حطها هون.', 'When you find a good opportunity, put it here.')) + '</div>';
    html += b.active.map((o) => oppCard(o, b.highlight.has(o.id))).join('');
    if (b.waiting.length) {
      html += '<div class="sec-title">' + L('انبعتت، وعم نستنى', 'Sent, and waiting') + '</div>' + b.waiting.map((o) => '<a class="card quiet plain" style="display:block;color:inherit" href="#/work/apps/' + o.id + '">' +
        '<div class="row-title">' + UI.ut(o.name) + '</div><p class="small muted" style="margin-top:4px">' +
        (o.expectedResponse ? T('ما في شي تعملو هلق لحد {d}.', 'Nothing to do now until {d}.', { d: UI.fmtShort(o.expectedResponse) }) : L('ما في شي تعملو هلق.', 'Nothing to do now.')) + '</p></a>').join('');
    }
    if (b.closed.length) {
      html += '<details class="fold"><summary>' + L('ملفات مسكّرة', 'Closed files') + '</summary>' + b.closed.map((o) => '<a class="card plain quiet" style="display:block;color:inherit" href="#/work/apps/' + o.id + '">' +
        '<div class="row-title">' + UI.ut(o.name) + ' <span class="tag' + (o.status === 'accepted' ? ' sage' : '') + '">' + statusName(o.status) + '</span></div>' +
        (o.learned ? '<p class="small muted" style="margin-top:4px">' + T('تعلمت: {l}', 'Learned: {l}', { l: UI.raw(UI.ut(o.learned)) }) + '</p>' : '') + '</a>').join('') + '</details>';
    }
    return html;
  }

  function detailView(id) {
    const o = Store.get('opportunities', id);
    if (!o) return '<p class="muted">' + L('ما لقيتها.', 'Couldn\'t find it.') + '</p><a href="#/work/apps">' + L('كل الفرص', 'All opportunities') + '</a>';
    const docs = o.docs || {};
    const refs = o.referees || [];
    let html = '<a class="small" href="#/work/apps">' + L('كل الفرص', 'All opportunities') + '</a>' +
      '<div class="card-head" style="margin-top:8px"><h2 class="display" style="font-size:24px;line-height:1.6;margin:0">' + UI.ut(o.name) + '</h2>' +
      '<button class="icon-btn" data-act="opp-edit" data-id="' + o.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('edit') + '</button></div>' +
      '<p class="muted small">' + [o.org ? UI.ut(o.org) : '', o.location ? UI.ut(o.location) : '', o.deadline ? T('آخر يوم: {d}', 'Deadline: {d}', { d: UI.fmtFull(o.deadline) }) : ''].filter(Boolean).join(' · ') + '</p>' +
      (o.funding ? '<p class="small">' + T('التمويل: {f}', 'Funding: {f}', { f: UI.raw(UI.ut(o.funding)) }) + '</p>' : '') +
      (o.note ? '<p class="small">' + UI.ut(o.note) + '</p>' : '') +
      (o.link ? '<a class="btn text sm" style="padding:0" href="' + UI.esc(o.link) + '" target="_blank" rel="noopener">' + L('افتح الرابط', 'Open the link') + '</a>' : '');
    if (o.status === 'submitted') {
      html += '<div class="card quiet" style="margin-top:12px"><p>' + (o.expectedResponse ? T('ما في شي تعملو هلق لحد {d}.', 'Nothing to do now until {d}.', { d: UI.fmtFull(o.expectedResponse) }) : L('ما في شي تعملو هلق.', 'Nothing to do now.')) + '</p></div>';
    }
    if (o.status === 'rejected') {
      html += '<div class="card quiet" style="margin-top:12px"><p>' + L('ما زبطت هالمرة. هاد ما بيقول شي عنك، بيقول عن هالمرة بس.', 'It didn\'t work out this time. That says something about this time, not about you.') + '</p>' +
        (o.learned ? '<p class="small muted">' + T('تعلمت: {l}', 'Learned: {l}', { l: UI.raw(UI.ut(o.learned)) }) + '</p>' : '') + '</div>';
    }
    html += '<div class="sec-title">' + L('وين صارت؟', 'Where is it?') + '</div><div class="chips">' + Object.keys(STATUS).map((k) =>
      '<button class="chip' + (k === 'accepted' ? ' sage' : '') + '" data-act="opp-status" data-id="' + o.id + '" data-s="' + k + '" aria-pressed="' + (o.status === k) + '">' + statusName(k) + '</button>').join('') + '</div>';
    const dk = Object.keys(docs);
    if (dk.length) {
      html += '<div class="sec-title">' + L('الأوراق المطلوبة', 'Documents') + '</div><div class="card plain">' + dk.map((k) =>
        '<label class="check-row" style="color:var(--text);min-height:48px"><input type="checkbox" data-change="opp-doc" data-id="' + o.id + '" data-k="' + k + '"' + (docs[k] ? ' checked' : '') + '>' + L(...(DOCS[k] || [k, k])) + '</label>').join('') + '</div>';
    }
    html += '<div class="sec-title">' + L('المعرّفين', 'Referees') + '</div><div class="card plain">' +
      (refs.length ? refs.map((r, i) => '<div class="row" style="min-height:48px"><label class="check-row" style="flex:1;color:var(--text)"><input type="checkbox" data-change="opp-ref" data-id="' + o.id + '" data-i="' + i + '"' + (r.asked ? ' checked' : '') + '>' +
        UI.ut(r.name) + ' <span class="muted small">' + (r.asked ? L('سألتو', 'asked') : L('لسا ما سألتو', 'not asked yet')) + '</span></label>' +
        '<button class="icon-btn" data-act="opp-ref-del" data-id="' + o.id + '" data-i="' + i + '" aria-label="' + L('شيل', 'Remove') + '">' + UI.icon('close') + '</button></div>').join('') : '') +
      '<form class="inline-form" data-form="opp-ref-add" style="margin-top:8px"><input type="hidden" name="id" value="' + o.id + '"><input class="input" id="oppRef" name="name" dir="auto" autocomplete="off" placeholder="' + L('اسم معرّف…', 'A referee\'s name…') + '"><button class="btn soft">' + L('زيد', 'Add') + '</button></form></div>';
    html += '<div class="btns" style="margin-top:14px"><button class="btn soft sm" data-act="focus-start" data-ref="o:' + o.id + '" data-cat="personal">' + UI.icon('play') + L('ابدأ ١٠ دقايق', 'Start 10 minutes') + '</button></div>';
    return html;
  }

  root.WorkTabs.apps = (r) => (r.parts[2] ? detailView(r.parts[2]) : listView());

  function oppForm(o) {
    const v = o || { name: '', org: '', location: '', link: '', funding: '', deadline: '', note: '', docs: { cv: false, motivation: false, transcript: false, referees: false } };
    const docs = v.docs || {};
    return '<h3>' + (o ? L('الفرصة', 'Opportunity') : L('فرصة جديدة', 'A new opportunity')) + '</h3><form data-form="opp-save"><input type="hidden" name="id" value="' + (o ? o.id : '') + '">' +
      '<label class="field"><span>' + L('الاسم', 'Name') + '</span><input name="name" dir="auto" required value="' + UI.esc(v.name) + '"' + (o ? '' : ' autofocus') + '></label>' +
      '<div class="grid2"><label class="field"><span>' + L('الجهة', 'Organisation') + '</span><input name="org" dir="auto" value="' + UI.esc(v.org || '') + '"></label>' +
      '<label class="field"><span>' + L('وين', 'Where') + '</span><input name="location" dir="auto" value="' + UI.esc(v.location || '') + '"></label></div>' +
      '<div class="grid2"><label class="field"><span>' + L('آخر يوم', 'Deadline') + '</span><input type="date" name="deadline" value="' + (v.deadline || '') + '"></label>' +
      '<label class="field"><span>' + L('إمتى ممكن يردّوا', 'Expected response') + '</span><input type="date" name="expectedResponse" value="' + (v.expectedResponse || '') + '"></label></div>' +
      '<label class="field"><span>' + L('الرابط', 'Link') + '</span><input name="link" type="url" dir="ltr" value="' + UI.esc(v.link || '') + '"></label>' +
      '<label class="field"><span>' + L('التمويل', 'Funding notes') + '</span><input name="funding" dir="auto" value="' + UI.esc(v.funding || '') + '"></label>' +
      '<div class="field"><span>' + L('شو مطلوب؟', 'What\'s needed?') + '</span><div class="chips">' + Object.keys(DOCS).map((k) =>
        '<label class="chip"><input type="checkbox" name="docs" value="' + k + '"' + (k in docs ? ' checked' : '') + '>' + L(...DOCS[k]) + '</label>').join('') + '</div></div>' +
      '<label class="field"><span>' + L('ملاحظة', 'Note') + '</span><textarea name="note" dir="auto">' + UI.esc(v.note || '') + '</textarea></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (o ? '<button class="btn text" type="button" data-act="opp-delete" data-id="' + o.id + '">' + L('امسحها', 'Delete') + '</button>' : '') + '</div></form>';
  }

  const A = root.Actions, F = root.Forms, Ch = root.Changes;
  A['opp-new'] = () => UI.sheet.open(() => oppForm(null));
  A['opp-edit'] = (el) => { const o = Store.get('opportunities', el.dataset.id); if (o) UI.sheet.open(() => oppForm(o)); };
  F['opp-save'] = (d) => {
    const cur = d.id ? Store.get('opportunities', d.id) : { id: Store.uid(), status: 'considering', referees: [], createdAt: nowIso() };
    const chosen = [].concat(d.docs || []);
    const docs = {};
    for (const k of chosen) docs[k] = !!(cur.docs && cur.docs[k]);
    UI.sheet.close();
    Store.put('opportunities', {
      ...cur, name: d.name.trim(), org: (d.org || '').trim(), location: (d.location || '').trim(), link: (d.link || '').trim(),
      funding: (d.funding || '').trim(), deadline: d.deadline || null, expectedResponse: d.expectedResponse || null, note: (d.note || '').trim(), docs,
    });
    if (!d.id) UI.go('work/apps/' + cur.id);
  };
  A['opp-delete'] = (el) => UI.confirm({
    title: L('تمسحها؟', 'Delete it?'), yes: L('لا، خليها', 'No, keep it'), no: L('امسحها', 'Delete'), noClass: 'clay',
    onNo: () => { UI.removeWithUndo([['opportunities', el.dataset.id]]); UI.go('work/apps'); },
  });
  A['opp-status'] = (el) => {
    const o = Store.get('opportunities', el.dataset.id);
    if (!o) return;
    const s = el.dataset.s;
    if (s === 'submitted') {
      UI.sheet.open(() => '<h3>' + L('انبعتت', 'Sent') + '</h3><form data-form="opp-submitted"><input type="hidden" name="id" value="' + o.id + '">' +
        '<label class="field"><span>' + L('إمتى ممكن يردّوا؟ (إذا بتعرف)', 'When might they reply? (if you know)') + '</span><input type="date" name="expectedResponse" value="' + (o.expectedResponse || '') + '"></label>' +
        '<button class="btn lamp block">' + L('سكّر الملف', 'Close the file') + '</button></form>');
      return;
    }
    if (s === 'rejected') {
      UI.sheet.open(() => '<h3>' + L('ما زبطت هالمرة', 'Didn\'t work out this time') + '</h3><form data-form="opp-rejected"><input type="hidden" name="id" value="' + o.id + '">' +
        '<label class="field"><span>' + L('شي تعلمتو؟ (إذا بدك)', 'Anything you learned? (optional)') + '</span><textarea name="learned" dir="auto">' + UI.esc(o.learned || '') + '</textarea></label>' +
        '<button class="btn lamp block">' + L('تمام', 'Okay') + '</button></form>');
      return;
    }
    Store.patch('opportunities', o.id, { status: s, statusAt: nowIso() });
    if (s === 'accepted') {
      UI.petals(10);
      Store.put('wins', { id: Store.uid(), text: T('انقبلت بـ {n}', 'Accepted to {n}', { n: UI.raw(o.name) }), date: day(), toldWho: '', createdAt: nowIso() });
      UI.toast(L('انقبلت! صارت نجمة بسماك. وبتستاهل حدا يعرف فيها.', 'Accepted! It\'s a star in your sky now. Someone deserves to hear about this.'), 6000);
    }
  };
  F['opp-submitted'] = (d) => {
    UI.sheet.close();
    Store.patch('opportunities', d.id, { status: 'submitted', expectedResponse: d.expectedResponse || null, submittedAt: nowIso(), statusAt: nowIso() });
    UI.toast(d.expectedResponse ? T('انبعتت. ما في شي تعملو هلق لحد {d}.', 'Sent. Nothing to do now until {d}.', { d: UI.fmtShort(d.expectedResponse) }) : L('انبعتت. الملف مسكّر هلق.', 'Sent. The file is closed for now.'), 5200);
  };
  F['opp-rejected'] = (d) => { UI.sheet.close(); Store.patch('opportunities', d.id, { status: 'rejected', learned: (d.learned || '').trim(), statusAt: nowIso() }); };
  Ch['opp-doc'] = (el) => { const o = Store.get('opportunities', el.dataset.id); Store.put('opportunities', { ...o, docs: { ...o.docs, [el.dataset.k]: el.checked } }); };
  Ch['opp-ref'] = (el) => {
    const o = Store.get('opportunities', el.dataset.id), i = Number(el.dataset.i);
    const refs = (o.referees || []).slice();
    refs[i] = { ...refs[i], asked: el.checked };
    Store.put('opportunities', { ...o, referees: refs });
  };
  F['opp-ref-add'] = (d, f) => {
    const name = (d.name || '').trim();
    if (!name) return;
    const o = Store.get('opportunities', d.id);
    f.reset();
    Store.put('opportunities', { ...o, referees: (o.referees || []).concat({ name, asked: false }) });
  };
  A['opp-ref-del'] = (el) => {
    const o = Store.get('opportunities', el.dataset.id), i = Number(el.dataset.i);
    Store.put('opportunities', { ...o, referees: (o.referees || []).filter((_, k) => k !== i) });
  };
  A['opp-quiet'] = (el) => { const o = Store.get('opportunities', el.dataset.id); if (o) Store.patch('opportunities', o.id, { quietUntil: o.expectedResponse || day() }); };
})(typeof self !== 'undefined' ? self : this);
