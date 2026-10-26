/* Open questions shelf (رف الأسئلة المفتوحة): park a loop with the date an answer is actually possible. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const nowIso = () => new Date().toISOString();
  const opens = [];
  let noteShown = (() => { try { return sessionStorage.getItem('rawaq-qnote') === '1'; } catch (e) { return false; } })();
  let showNote = false;

  function onRoute() {
    const r = UI.route();
    if (r.parts[0] === 'more' && r.parts[1] === 'questions') {
      opens.push(Date.now());
      if (!noteShown && C.rereadNote(opens, Date.now())) {
        noteShown = true; showNote = true;
        try { sessionStorage.setItem('rawaq-qnote', '1'); } catch (e) { /* ok */ }
      }
    } else showNote = false;
  }
  root.addEventListener('hashchange', onRoute);
  root.addEventListener('rawaq:ready', onRoute);

  function parkedMsg(date) {
    return date
      ? T('انحطت عالرف. ما في جواب قبل {d}، فما في داعي تفكر فيها هلق.', 'Parked. No answer before {d}, so no need to think about it now.', { d: UI.fmtShort(date) })
      : L('انحطت عالرف. لما يجي وقتها، بتلاقيها هون.', 'Parked. When its time comes, you\'ll find it here.');
  }

  function qActions(q) {
    return '<div class="btns" style="margin-top:10px"><button class="btn soft sm" data-act="q-resolve" data-id="' + q.id + '">' + L('انحلّت', 'It\'s settled') + '</button>' +
      '<button class="btn sm" data-act="q-repark" data-id="' + q.id + '">' + L('رجّعها عالرف', 'Back on the shelf') + '</button>' +
      '<button class="btn text sm" data-act="q-delete" data-id="' + q.id + '">' + L('امسحها', 'Delete') + '</button></div>';
  }

  function qForm(prefill, inboxId) {
    return '<form class="card" data-form="q-add">' + (inboxId ? '<input type="hidden" name="inboxId" value="' + inboxId + '">' : '') +
      '<label class="field"><span>' + L('شو السؤال؟', 'What is the question?') + '</span><textarea name="question" id="qText" dir="auto" required placeholder="' + L('مثلاً: قبلوني بالـ internship؟', 'e.g. Did I get into the internship?') + '">' + UI.esc(prefill || '') + '</textarea></label>' +
      '<div class="field"><span>' + L('متى ممكن يكون في جواب؟', 'When could there be an answer?') + '</span>' +
      '<input type="date" name="answerBy" class="input"><label class="check-row"><input type="checkbox" name="unknown" value="1">' + L('ما بعرف', 'I don\'t know') + '</label></div>' +
      '<label class="field"><span>' + L('وإذا صار الأسوأ، شو بتعمل؟ (سطر واحد، إذا بدك)', 'And if the worst happens, what would you do? (one line, optional)') + '</span><input name="worst" dir="auto" autocomplete="off"></label>' +
      '<button class="btn lamp block">' + L('حطها عالرف', 'Put it on the shelf') + '</button></form>';
  }

  root.Screens.questions = {
    title: () => L('رف الأسئلة', 'Open questions'),
    render() {
      const day = root.App.clock().day;
      const qs = Store.all('questions').sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1));
      const due = qs.filter((q) => q.status === 'resurfaced' || (q.status === 'parked' && q.answerBy && q.answerBy <= day));
      const parked = qs.filter((q) => q.status === 'parked' && !due.includes(q));
      const resolved = qs.filter((q) => q.status === 'resolved');
      let html = '';
      if (showNote) html += '<div class="card quiet"><p>' + L('التفكير فيها هلق ما رح يجيب جواب جديد.', 'Thinking about it now won\'t bring a new answer.') + '</p></div>';
      html += '<p class="muted small">' + L('في سؤال عم يدور براسك؟ حطو عالرف مع وقت الجواب، وخلّي راسك يرتاح.', 'A question looping in your head? Shelve it with the time an answer is possible, and let your head rest.') + '</p>';
      html += qForm('');
      if (due.length) {
        html += '<div class="sec-title">' + L('وصل وقتها', 'Their time has come') + '</div>' + due.map((q) => '<div class="card"><div class="row-title">' + UI.ut(q.question) + '</div>' +
          (q.worstCasePlan ? '<p class="small muted" style="margin-top:6px">' + T('إذا صار الأسوأ: {w}', 'If the worst happens: {w}', { w: UI.raw(UI.ut(q.worstCasePlan)) }) + '</p>' : '') + qActions(q) + '</div>').join('');
      }
      if (parked.length) {
        html += '<div class="sec-title">' + L('عالرف', 'On the shelf') + '</div><div class="card plain quiet">' + parked.map((q) => '<details class="fold"><summary><span class="ut" dir="auto" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(q.question) + '</span>' +
          '<span class="tiny" style="margin-inline:8px">' + (q.answerBy ? UI.fmtShort(q.answerBy) : L('بعدين', 'Later')) + '</span></summary>' +
          (q.worstCasePlan ? '<p class="small muted">' + T('إذا صار الأسوأ: {w}', 'If the worst happens: {w}', { w: UI.raw(UI.ut(q.worstCasePlan)) }) + '</p>' : '') + qActions(q) + '</details>').join('') + '</div>';
      }
      if (resolved.length) {
        html += '<details class="fold"><summary>' + L('انحلّوا', 'Settled') + '</summary><div class="card plain quiet"><div class="rows">' + resolved.map((q) => '<div class="row"><div class="row-main"><div>' + UI.ut(q.question) + '</div>' +
          (q.resolutionNote ? '<div class="row-sub">' + UI.ut(q.resolutionNote) + '</div>' : '') + '</div></div>').join('') + '</div></div></details>';
      }
      return html;
    },
  };

  const A = root.Actions, F = root.Forms;
  root.Questions = { form: qForm, parkedMsg };
  F['q-add'] = (d, f) => {
    const question = (d.question || '').trim();
    if (!question) return;
    const answerBy = d.unknown ? null : d.answerBy || null;
    f.reset();
    if (d.inboxId) { Store.del('inbox', d.inboxId); UI.sheet.close(); }
    Store.put('questions', { id: Store.uid(), question, answerBy, worstCasePlan: (d.worst || '').trim(), status: 'parked', createdAt: nowIso() });
    UI.toast(parkedMsg(answerBy), 5200);
  };
  A['q-resolve'] = (el) => UI.sheet.open(() => '<h3>' + L('انحلّت', 'Settled') + '</h3><form data-form="q-resolve"><input type="hidden" name="id" value="' + el.dataset.id + '">' +
    '<label class="field"><span>' + L('شو صار؟ (إذا بدك)', 'What happened? (optional)') + '</span><textarea name="note" dir="auto" autofocus></textarea></label>' +
    '<button class="btn lamp block">' + L('تمام', 'Okay') + '</button></form>');
  F['q-resolve'] = (d) => {
    UI.sheet.close();
    Store.patch('questions', d.id, { status: 'resolved', resolutionNote: (d.note || '').trim(), resolvedAt: nowIso() });
    UI.toast(L('انحلّت. راسك أخف هلق.', 'Settled. Your head is a little lighter now.'));
  };
  A['q-repark'] = (el) => UI.sheet.open(() => '<h3>' + L('رجّعها عالرف', 'Back on the shelf') + '</h3><form data-form="q-repark"><input type="hidden" name="id" value="' + el.dataset.id + '">' +
    '<label class="field"><span>' + L('متى ممكن يكون في جواب؟', 'When could there be an answer?') + '</span><input type="date" name="answerBy"></label>' +
    '<label class="check-row"><input type="checkbox" name="unknown" value="1">' + L('ما بعرف', 'I don\'t know') + '</label>' +
    '<button class="btn lamp block" style="margin-top:10px">' + L('حطها عالرف', 'Put it on the shelf') + '</button></form>');
  F['q-repark'] = (d) => {
    const answerBy = d.unknown ? null : d.answerBy || null;
    UI.sheet.close();
    Store.patch('questions', d.id, { status: 'parked', answerBy });
    UI.toast(parkedMsg(answerBy), 5200);
  };
  A['q-later'] = (el) => Store.patch('questions', el.dataset.id, { status: 'resurfaced' });
  A['q-delete'] = (el) => UI.removeWithUndo([['questions', el.dataset.id]]);
})(typeof self !== 'undefined' ? self : this);
