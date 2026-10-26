/* Papers, "Defend it": go back through each paper until every section is truly understood. One in focus at a time. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const nowIso = () => new Date().toISOString();

  const STATUS = {
    idea: ['فكرة', 'Idea'], writing: ['عم اكتبها', 'Writing'], submitted: ['انبعتت', 'Submitted'],
    review: ['تحت المراجعة', 'Under review'], revision: ['تعديلات', 'Revision'], published: ['انتشرت', 'Published'],
  };
  const SECTIONS = {
    background: ['الخلفية والفرضية', 'Background & hypothesis'], methods: ['الطرق', 'Methods'], data: ['الداتا', 'Data'],
    analysis: ['التحليل والموديل', 'Analysis / model'], results: ['النتائج', 'Results'], limitations: ['الحدود', 'Limitations'],
    differently: ['شو كنت بعمل غير', 'What I\'d do differently'], references: ['المراجع، متأكد منها', 'References verified'],
    aiPolicy: ['إفصاح الـ<bdi>AI</bdi> مطابق لسياسة المجلة', 'AI-use disclosure checked against the journal\'s policy'],
    explainBuild: ['بقدر اشرح كيف انبنت؟', 'Can I explain how it was built?'],
  };
  const CONF = [['seed', 'ضعيف', 'Shaky'], ['plant', 'ماشي', 'Getting there'], ['tree', 'فاهمو', 'Got it']];
  const statusName = (s) => L(...(STATUS[s] || STATUS.writing));

  function leaves(p) {
    return '<div class="leaves" aria-hidden="true">' + C.DEFEND_SECTIONS.map((s) => {
      const c = p.defend && p.defend[s] ? p.defend[s].confidence : null;
      return c == null ? UI.icon('seed', '') : UI.icon(CONF[c][0], 'c' + c);
    }).join('') + '</div>';
  }

  function paperCard(p) {
    return '<a class="card' + (p.defendFocus ? ' lampish' : ' plain') + '" style="display:block;color:inherit" href="#/work/papers/' + p.id + '">' +
      (p.defendFocus ? '<div class="tag lamp" style="margin-bottom:8px">' + L('بالتركيز هلق', 'In focus now') + '</div>' : '') +
      '<div class="row-title">' + UI.ut(p.title) + '</div>' +
      '<div class="row-sub">' + [p.venue ? UI.ut(p.venue) : '', statusName(p.status)].filter(Boolean).join(' · ') + '</div>' +
      '<div style="margin-top:10px">' + leaves(p) + '</div></a>';
  }

  function listView() {
    const papers = Store.all('papers').sort((a, b) => (b.defendFocus ? 1 : 0) - (a.defendFocus ? 1 : 0) || ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1));
    const linked = new Set(papers.map((p) => p.projectId).filter(Boolean));
    const loose = Store.all('projects').filter((p) => p.kind === 'paper' && p.status !== 'archived' && !linked.has(p.id));
    let html = '<p class="muted small">' + L('ارجع لكل ورقة لحد ما تقدر تدافع عن كل قسم فيها. وحدة بوحدة، مو كلهن سوا.', 'Go back through each paper until you can defend every section. One at a time, not all at once.') + '</p>' +
      '<div class="btns end" style="margin:8px 0 12px"><button class="btn soft sm" data-act="paper-new">' + UI.icon('plus') + L('ورقة', 'Paper') + '</button></div>';
    if (!papers.length && !loose.length) html += '<div class="card">' + UI.empty('desk', L('لما تبلّش بورقة، إلها مكان هون.', 'When you start on a paper, it has a place here.')) + '</div>';
    html += papers.map(paperCard).join('');
    if (loose.length) {
      html += '<div class="sec-title">' + L('مشاريع أوراق بلا ملف دفاع', 'Paper projects without a defend-it file') + '</div><div class="card plain"><div class="rows">' +
        loose.map((p) => '<div class="row"><div class="row-main">' + UI.ut(p.name) + '</div><button class="btn text sm" data-act="paper-from-project" data-id="' + p.id + '">' + L('ابدأ ملف', 'Start a file') + '</button></div>').join('') + '</div></div>';
    }
    return html;
  }

  function sectionRow(p, s) {
    const cur = p.defend && p.defend[s] ? p.defend[s] : {};
    return '<div class="row" style="flex-wrap:wrap;align-items:flex-start;gap:8px;padding:12px 0">' +
      '<div class="row-main" style="min-width:100%"><div class="row-title">' + L(...SECTIONS[s]) + '</div></div>' +
      '<div class="conf" role="group">' + CONF.map((c, i) => '<button data-act="paper-conf" data-id="' + p.id + '" data-s="' + s + '" data-c="' + i + '" aria-pressed="' + (cur.confidence === i) + '">' +
        UI.icon(c[0]) + L(c[1], c[2]) + '</button>').join('') + '</div>' +
      '<textarea class="input" style="min-height:48px;flex:1 1 100%" dir="auto" rows="1" placeholder="' + L('ملاحظة (إذا بدك)', 'A note (optional)') + '" data-change="paper-note" data-id="' + p.id + '" data-s="' + s + '">' + UI.esc(cur.note || '') + '</textarea>' +
      '</div>';
  }

  function detailView(id) {
    const p = Store.get('papers', id);
    if (!p) return '<p class="muted">' + L('ما لقيت هالورقة.', 'Couldn\'t find this paper.') + '</p><a href="#/work/papers">' + L('كل الأوراق', 'All papers') + '</a>';
    const st = C.defendState(p);
    let html = '<a class="small" href="#/work/papers">' + L('كل الأوراق', 'All papers') + '</a>' +
      '<div class="card-head" style="margin-top:8px"><h2 class="display" style="font-size:24px;line-height:1.6;margin:0">' + UI.ut(p.title) + '</h2>' +
      '<button class="icon-btn" data-act="paper-edit" data-id="' + p.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('edit') + '</button></div>' +
      '<p class="muted small">' + [p.venue ? UI.ut(p.venue) : '', statusName(p.status), p.myRole ? T('دوري: {r}', 'My role: {r}', { r: UI.raw(UI.ut(p.myRole)) }) : ''].filter(Boolean).join(' · ') + '</p>' +
      (p.coauthors ? '<p class="small">' + T('مع: {c}', 'With: {c}', { c: UI.raw(UI.ut(p.coauthors)) }) + '</p>' : '') +
      '<div class="btns" style="margin:8px 0 4px">' +
      '<button class="btn soft sm" data-act="focus-start" data-ref="pp:' + p.id + '" data-cat="research">' + UI.icon('play') + L('ابدأ ١٠ دقايق', 'Start 10 minutes') + '</button>' +
      (p.defendFocus ? '<button class="btn text sm" data-act="paper-unfocus" data-id="' + p.id + '">' + L('طلّعها من التركيز', 'Take it out of focus') + '</button>'
        : '<button class="btn sm" data-act="paper-focus" data-id="' + p.id + '">' + L('حطها بالتركيز', 'Put it in focus') + '</button>') + '</div>';
    if (st.ready) {
      html += '<div class="card rest" style="margin-top:12px">' + UI.jasmine('ornament-jasmine') + '<p>' + L('بتقدر تدافع عنها. هاد شي كبير.', 'You can defend it. That\'s a big thing.') + '</p>' +
        '<button class="btn sage sm" data-act="paper-ready-win" data-id="' + p.id + '">' + UI.icon('star') + L('حطها نجمة بسماك', 'Make it a star in your sky') + '</button></div>';
    }
    html += '<div class="sec-title">' + L('دافع عنها', 'Defend it') + '</div><div class="card plain"><div class="rows">' + C.DEFEND_SECTIONS.map((s) => sectionRow(p, s)).join('') + '</div></div>';
    const qs = p.interviewQs || [];
    html += '<div class="sec-title">' + L('أسئلة ممكن تنسأل', 'Questions you might be asked') + '</div><div class="card plain">' +
      (qs.length ? '<div class="rows">' + qs.map((q, i) => '<div class="row tap" data-act="paper-q-edit" data-id="' + p.id + '" data-i="' + i + '"><div class="row-main"><div class="row-title">' + UI.ut(q.q) + '</div>' +
        (q.a ? '<div class="row-sub">' + UI.ut(q.a) + '</div>' : '<div class="row-sub">' + L('لسا بدون جواب، وهاد عادي.', 'No answer yet, and that\'s okay.') + '</div>') + '</div></div>').join('') + '</div>' : '') +
      '<form data-form="paper-q-add" style="margin-top:10px"><input type="hidden" name="id" value="' + p.id + '">' +
      '<input class="input" id="pqQ" name="q" dir="auto" autocomplete="off" placeholder="' + L('سؤال ممكن ينسأل…', 'A question you might get…') + '">' +
      '<textarea class="input" id="pqA" name="a" dir="auto" style="min-height:64px;margin-top:8px" placeholder="' + L('جوابك (إذا بدك)', 'Your answer (optional)') + '"></textarea>' +
      '<button class="btn soft sm" style="margin-top:8px">' + L('زيد', 'Add') + '</button></form></div>';
    return html;
  }

  root.WorkTabs.papers = (r) => (r.parts[2] ? detailView(r.parts[2]) : listView());

  function paperForm(p, prefill) {
    const v = p || { title: prefill ? prefill.name : '', venue: '', status: 'writing', myRole: '', coauthors: '', projectId: prefill ? prefill.id : '' };
    const projs = Store.all('projects').filter((x) => x.kind === 'paper');
    return '<h3>' + (p ? L('الورقة', 'Paper') : L('ورقة جديدة', 'A new paper')) + '</h3><form data-form="paper-save"><input type="hidden" name="id" value="' + (p ? p.id : '') + '">' +
      '<label class="field"><span>' + L('العنوان', 'Title') + '</span><input name="title" dir="auto" required value="' + UI.esc(v.title) + '"' + (p ? '' : ' autofocus') + '></label>' +
      '<div class="grid2"><label class="field"><span>' + L('المجلة أو المكان', 'Journal / venue') + '</span><input name="venue" dir="auto" value="' + UI.esc(v.venue || '') + '"></label>' +
      '<label class="field"><span>' + L('وين صارت؟', 'Status') + '</span><select name="status">' + Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (k === v.status ? ' selected' : '') + '>' + statusName(k) + '</option>').join('') + '</select></label></div>' +
      '<label class="field"><span>' + L('دورك فيها', 'Your role') + '</span><input name="myRole" dir="auto" value="' + UI.esc(v.myRole || '') + '" placeholder="' + L('مثلاً: البيولوجيا وتصميم الموديل، والكتابة', 'e.g. biology & model design, writing') + '"></label>' +
      '<label class="field"><span>' + L('مع مين', 'Co-authors') + '</span><input name="coauthors" dir="auto" value="' + UI.esc(v.coauthors || '') + '"></label>' +
      (projs.length ? '<label class="field"><span>' + L('مربوطة بمشروع', 'Linked project') + '</span><select name="projectId"><option value="">' + L('بلا', 'None') + '</option>' +
        projs.map((x) => '<option value="' + x.id + '"' + (x.id === v.projectId ? ' selected' : '') + '>' + UI.esc(x.name) + '</option>').join('') + '</select></label>' : '') +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (p ? '<button class="btn text" type="button" data-act="paper-delete" data-id="' + p.id + '">' + L('امسحها', 'Delete') + '</button>' : '') + '</div></form>';
  }

  const A = root.Actions, F = root.Forms;
  A['paper-new'] = () => UI.sheet.open(() => paperForm(null));
  A['paper-from-project'] = (el) => { const pr = Store.get('projects', el.dataset.id); if (pr) UI.sheet.open(() => paperForm(null, pr)); };
  A['paper-edit'] = (el) => { const p = Store.get('papers', el.dataset.id); if (p) UI.sheet.open(() => paperForm(p)); };
  F['paper-save'] = (d) => {
    const cur = d.id ? Store.get('papers', d.id) : { id: Store.uid(), defend: {}, interviewQs: [], defendFocus: false, createdAt: nowIso() };
    UI.sheet.close();
    // A quiet record of status changes, for the monthly / yearly reflection.
    const statusLog = (cur.statusLog || []).concat(cur.status === d.status ? [] : [{ status: d.status, at: nowIso() }]);
    Store.put('papers', { ...cur, title: d.title.trim(), venue: (d.venue || '').trim(), status: d.status, statusLog, myRole: (d.myRole || '').trim(), coauthors: (d.coauthors || '').trim(), projectId: d.projectId || null });
    if (!d.id) UI.go('work/papers/' + cur.id);
  };
  A['paper-delete'] = (el) => UI.confirm({
    title: L('تمسح ملف الورقة؟', 'Delete this paper\'s file?'), body: L('الملاحظات والأسئلة كمان رح تنمسح.', 'Its notes and questions go too.'),
    yes: L('لا، خليها', 'No, keep it'), no: L('امسحها', 'Delete'), noClass: 'clay',
    onNo: () => { UI.removeWithUndo([['papers', el.dataset.id]]); UI.go('work/papers'); },
  });
  A['paper-conf'] = (el) => {
    const p = Store.get('papers', el.dataset.id);
    if (!p) return;
    const s = el.dataset.s, c = Number(el.dataset.c);
    const cur = (p.defend && p.defend[s]) || {};
    const wasReady = C.defendState(p).ready;
    const next = { ...p, defend: { ...(p.defend || {}), [s]: { ...cur, confidence: cur.confidence === c ? null : c } } };
    Store.put('papers', next);
    if (!wasReady && C.defendState(next).ready) { UI.petals(8); UI.toast(L('كل قسم صار مفهوم.', 'Every section is understood now.')); }
  };
  root.Changes['paper-note'] = (el) => {
    const p = Store.get('papers', el.dataset.id);
    if (!p) return;
    const s = el.dataset.s, cur = (p.defend && p.defend[s]) || {};
    Store.put('papers', { ...p, defend: { ...(p.defend || {}), [s]: { ...cur, note: el.value.trim() } } });
  };
  function setFocus(id) {
    for (const x of Store.all('papers')) if (x.defendFocus && x.id !== id) Store.patch('papers', x.id, { defendFocus: false });
    Store.patch('papers', id, { defendFocus: true });
  }
  A['paper-focus'] = (el) => {
    const id = el.dataset.id;
    const other = Store.all('papers').find((x) => x.defendFocus && x.id !== id);
    if (!other) { setFocus(id); return; }
    UI.confirm({
      title: L('في ورقة تانية بالتركيز.', 'Another paper is in focus.'),
      body: T('"{t}" لسا بالتركيز. أحسن نخلّص وحدة قبل ما نبلّش بالتانية.', '"{t}" is still in focus. Better to finish one before starting the next.', { t: other.title }),
      yes: L('خليني معها', 'Stay with that one'), no: L('بدّل لهي', 'Switch to this one'), noClass: 'text',
      onNo: () => setFocus(id),
    });
  };
  A['paper-unfocus'] = (el) => Store.patch('papers', el.dataset.id, { defendFocus: false });
  A['paper-ready-win'] = (el) => {
    const p = Store.get('papers', el.dataset.id);
    if (!p) return;
    Store.put('wins', { id: Store.uid(), text: T('بقدر دافع عن "{t}"', 'I can defend "{t}"', { t: UI.raw(p.title) }).replace(/&quot;/g, '"'), date: root.App.clock().day, toldWho: '', createdAt: nowIso() });
    UI.toast(L('انحفظت. وبتستاهل حدا يعرف فيها.', 'Saved. Someone deserves to hear about this.'));
  };
  F['paper-q-add'] = (d, f) => {
    const q = (d.q || '').trim();
    if (!q) return;
    const p = Store.get('papers', d.id);
    f.reset();
    Store.put('papers', { ...p, interviewQs: (p.interviewQs || []).concat({ q, a: (d.a || '').trim() }) });
  };
  A['paper-q-edit'] = (el) => {
    const p = Store.get('papers', el.dataset.id), i = Number(el.dataset.i);
    const q = p && p.interviewQs[i];
    if (!q) return;
    UI.sheet.open(() => '<h3>' + L('السؤال', 'Question') + '</h3><form data-form="paper-q-save"><input type="hidden" name="id" value="' + p.id + '"><input type="hidden" name="i" value="' + i + '">' +
      '<label class="field"><span>' + L('السؤال', 'Question') + '</span><input name="q" dir="auto" required value="' + UI.esc(q.q) + '"></label>' +
      '<label class="field"><span>' + L('جوابك', 'Your answer') + '</span><textarea name="a" dir="auto">' + UI.esc(q.a || '') + '</textarea></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button><button class="btn text" type="button" data-act="paper-q-delete" data-id="' + p.id + '" data-i="' + i + '">' + L('امسحو', 'Delete') + '</button></div></form>');
  };
  F['paper-q-save'] = (d) => {
    const p = Store.get('papers', d.id), i = Number(d.i);
    const qs = p.interviewQs.slice();
    qs[i] = { q: d.q.trim(), a: (d.a || '').trim() };
    UI.sheet.close();
    Store.put('papers', { ...p, interviewQs: qs });
  };
  A['paper-q-delete'] = (el) => {
    const p = Store.get('papers', el.dataset.id), i = Number(el.dataset.i);
    UI.sheet.close();
    Store.put('papers', { ...p, interviewQs: p.interviewQs.filter((_, k) => k !== i) });
  };
})(typeof self !== 'undefined' ? self : this);
