/* Brain dump (فرّغ راسك): one field, one tap. The inbox asks nothing of you. */
(function (root) {
  'use strict';
  const UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const nowIso = () => new Date().toISOString();

  function captureSheet() {
    return '<h3>' + L('فرّغ راسك', 'Empty your head') + '</h3>' +
      '<form data-form="capture-save"><textarea class="input" name="text" dir="auto" autofocus placeholder="' + L('شو عم يدور براسك؟', 'What\'s going around in your head?') + '"></textarea>' +
      '<div class="btns" style="margin-top:12px;justify-content:space-between"><a class="btn text sm" href="#/more/inbox">' + L('شوف الصندوق', 'Open the inbox') + '</a>' +
      '<button class="btn lamp">' + L('حطها بالصندوق', 'Drop it in') + '</button></div></form>';
  }

  root.Screens.inbox = {
    title: () => L('الصندوق', 'Inbox'),
    render() {
      const items = Store.all('inbox').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      let html = '<p class="muted small">' + L('ما في شي مستعجل هون. حوّل شي إذا حبيت، أو اتركو.', 'Nothing here is urgent. Turn something into something else if you like, or leave it.') + '</p>';
      if (!items.length) return html + '<div class="card">' + UI.empty('jasmine', L('فاضي، وراسك كمان يمكن أخف.', 'Empty, and maybe your head is lighter too.')) + '</div>';
      const SRC = { mstodo: '<bdi>To Do</bdi>', notion: '<bdi>Notion</bdi>', obsidian: '<bdi>Obsidian</bdi>' };
      return html + '<div class="card plain"><div class="rows">' + items.map((i) => '<div class="row tap" data-act="inbox-open" data-id="' + i.id + '"><div class="row-main"><div>' + UI.ut(i.text) + '</div>' +
        '<div class="row-sub">' + [UI.fmtShort(i.createdAt.slice(0, 10)),
          i.source && SRC[i.source] ? T('من {s}', 'from {s}', { s: UI.raw(SRC[i.source]) }) : '',
          i.due ? T('تاريخ: {d}', 'date: {d}', { d: UI.fmtShort(i.due) }) : '',
          i.toObsidian ? L('رايحة لـ <bdi>Obsidian</bdi>', 'going to Obsidian') : ''].filter(Boolean).join(' · ') + '</div></div>' + UI.icon('dots', 'muted') + '</div>').join('') + '</div></div>';
    },
  };

  const OPTIONS = [
    ['task', 'شغلة', 'A task'], ['idea', 'فكرة مشروع', 'A project idea'], ['question', 'سؤال للرف', 'An open question'],
    ['curiosity', 'لرف الفضول', 'For the curiosity shelf'], ['letter', 'رسالة', 'A letter'], ['win', 'نجمة بسماك', 'A star in your sky'],
  ];

  const A = root.Actions, F = root.Forms;
  A['capture-open'] = () => UI.sheet.open(captureSheet);
  F['capture-save'] = (d) => {
    const text = (d.text || '').trim();
    if (!text) { UI.sheet.close(); return; }
    Store.put('inbox', { id: Store.uid(), text, createdAt: nowIso() });
    UI.sheet.close();
    UI.toast(L('انحطت. فيك تنساها هلق.', 'Saved. You can let it go now.'));
  };
  A['inbox-open'] = (el) => {
    const it = Store.get('inbox', el.dataset.id);
    if (!it) return;
    UI.sheet.open(() => '<h3>' + L('شو بدك تعمل فيها؟', 'What would you like to do with it?') + '</h3>' +
      '<div style="margin-bottom:14px">' + UI.utb(it.text) + '</div><div class="btns">' +
      OPTIONS.map((o) => '<button class="btn sm" data-act="inbox-to" data-to="' + o[0] + '" data-id="' + it.id + '">' + L(o[1], o[2]) + '</button>').join('') +
      (root.Net && root.Net.rec('obsidian').enabled ? '<button class="btn sm" data-act="inbox-obsidian" data-id="' + it.id + '" aria-pressed="' + !!it.toObsidian + '">' +
        (it.toObsidian ? L('مش لـ <bdi>Obsidian</bdi>', 'Not for Obsidian') : L('لـ <bdi>Obsidian</bdi>', 'For Obsidian')) + '</button>' : '') +
      '</div><div class="btns" style="margin-top:12px;justify-content:space-between"><button class="btn text sm" data-act="sheet-close">' + L('اتركها هون', 'Leave it here') + '</button>' +
      '<button class="btn text sm" style="color:var(--clay)" data-act="inbox-delete" data-id="' + it.id + '">' + L('امسحها', 'Delete') + '</button></div>');
  };
  A['inbox-to'] = (el) => {
    const it = Store.get('inbox', el.dataset.id);
    if (!it) return;
    const to = el.dataset.to;
    if (to === 'question') {
      UI.sheet.open(() => '<h3>' + L('سؤال للرف', 'An open question') + '</h3>' + root.Questions.form(it.text, it.id).replace('class="card"', 'class=""'));
      return;
    }
    if (to === 'letter') { root.Letters.fromText(it.text, it.id); return; }
    const base = { id: Store.uid(), createdAt: nowIso() };
    if (to === 'task') Store.put('items', { ...base, title: it.text, status: 'open', owner: 'me' });
    if (to === 'idea') Store.put('ideas', { ...base, text: it.text });
    if (to === 'curiosity') Store.put('curiosity', { ...base, type: it.link ? 'paper' : 'topic', title: it.text, link: it.link || '', status: 'want' });
    if (to === 'win') Store.put('wins', { ...base, text: it.text, date: root.App.clock().day, toldWho: '' });
    Store.del('inbox', it.id);
    UI.sheet.close();
    UI.toast(L('تمام، انحطت بمكانها.', 'Done, it\'s in its place.'));
  };
  A['inbox-delete'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['inbox', el.dataset.id]]); };
  A['inbox-obsidian'] = (el) => {
    const it = Store.get('inbox', el.dataset.id);
    if (!it) return;
    UI.sheet.close();
    Store.patch('inbox', it.id, { toObsidian: !it.toObsidian });
    UI.toast(it.toObsidian ? L('تمام، مش رايحة.', 'Okay, it stays here.') : L('بتروح مع الإرسال الجاي لـ <bdi>Obsidian</bdi>.', 'It goes with the next send to Obsidian.'));
  };
})(typeof self !== 'undefined' ? self : this);
