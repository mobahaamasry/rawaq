/* قرار: for big decisions. Not to hand you an answer, but to make your own voice clearer.
   Three tests per option (removal, relief or excitement, audience) and a "not before" lock for decisions
   that shouldn't be made under a ticking clock. Decisions never leave the app and are never searched. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const day = () => root.App.clock().day;
  const nowIso = () => new Date().toISOString();

  const REMOVAL = [['yes', 'إي', 'Yes'], ['no', 'لأ', 'No'], ['unsure', 'ما بعرف', 'Not sure']];
  const FEEL = [['toward', 'عم امشي لشي', 'Moving toward something'], ['closing', 'باب عم يتسكّر', 'A door closing'], ['unsure', 'ما بعرف', 'Not sure']];

  const opts = (d) => d.options || [];
  const lockLine = (d) => '<p class="sealed" style="margin:6px 0 0">' + UI.icon('letter') + T('مقفول لـ {d}. هلق فيك تفكر وتكتب، بس القرار بعدين.', 'Locked until {d}. You can think and write now; the deciding comes later.', { d: UI.fmtFull(d.notBefore) }) + '</p>';

  function listView() {
    const ds = Store.all('decisions').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const open = ds.filter((d) => d.status !== 'decided'), done = ds.filter((d) => d.status === 'decided');
    let html = '<p class="muted small">' + L('للقرارات الكبيرة. مش ليعطيك جواب، ليوضّحلك صوتك.', 'For big decisions. Not to give you an answer, but to make your own voice clearer.') + '</p>' +
      '<button class="btn soft block" style="margin:10px 0 14px" data-act="dec-new">' + UI.icon('plus') + L('قرار جديد', 'A new decision') + '</button>';
    if (!ds.length) html += '<div class="card">' + UI.empty('rooftop', L('لما يجي قرار كبير، خود وقتك معو هون.', 'When a big decision comes, take your time with it here.')) + '</div>';
    html += open.map((d) => '<a class="card plain" style="display:block;color:inherit" href="#/more/decisions?id=' + d.id + '">' +
      '<div class="row-title">' + UI.ut(d.title) + '</div>' +
      '<div class="row-sub">' + (opts(d).length ? opts(d).map((o) => UI.ut(o.text)).join(' · ') : L('لسا بلا خيارات', 'No options yet')) + '</div>' +
      (C.decisionLocked(d, day()) ? lockLine(d) : '') + '</a>').join('');
    if (done.length) {
      html += '<details class="fold"><summary>' + L('قرارات أخدتها', 'Decisions made') + '</summary>' + done.map((d) => {
        const ch = opts(d).find((o) => o.id === d.chosen);
        return '<a class="card plain quiet" style="display:block;color:inherit" href="#/more/decisions?id=' + d.id + '"><div class="row-title">' + UI.ut(d.title) + '</div>' +
          (ch ? '<div class="row-sub">' + T('اخترت: {c}', 'Chose: {c}', { c: UI.raw(UI.ut(ch.text)) }) + '</div>' : '') + '</a>';
      }).join('') + '</details>';
    }
    return html;
  }

  function optionCard(d, o, i) {
    const chip = (field, val, label, cur) => '<button class="chip" data-act="dec-set" data-id="' + d.id + '" data-o="' + o.id + '" data-f="' + field + '" data-v="' + val + '" aria-pressed="' + (cur === val) + '">' + label + '</button>';
    return '<div class="card plain">' +
      '<div class="card-head"><h2 class="card-title">' + UI.ut(o.text) + '</h2>' +
      '<button class="icon-btn" data-act="dec-opt-del" data-id="' + d.id + '" data-o="' + o.id + '" aria-label="' + L('شيل', 'Remove') + '">' + UI.icon('close') + '</button></div>' +
      '<div class="field" style="margin-top:8px"><span>' + L('١. لو الخوف مو موجود، كنت رح تختار هاد؟', '1. If the fear weren\'t there, would you still choose this?') + '</span>' +
      '<div class="chips">' + REMOVAL.map((r) => chip('removal', r[0], L(r[1], r[2]), o.removal)).join('') + '</div></div>' +
      '<div class="field"><span>' + L('٢. لما تتخيل حالك اخترتو: باب عم يتسكّر، ولا عم تمشي لقدّام لشي؟', '2. Imagining you chose it: a door closing, or moving toward something?') + '</span>' +
      '<p class="tiny muted" style="margin:-2px 0 6px">' + L('الارتياح لحالو غالباً هروب من شي. الحماس غالباً اتجاه.', 'Relief alone is often escaping something. Excitement is often a direction.') + '</p>' +
      '<div class="chips">' + FEEL.map((r) => chip('feel', r[0], L(r[1], r[2]), o.feel)).join('') + '</div></div>' +
      '<label class="field"><span>' + L('٣. لو شفت حالك بفيلم عم تاخد هالقرار، شو كنت رح تصرّخ عالشاشة؟', '3. If you watched yourself make this choice in a film, what would you shout at the screen?') + '</span>' +
      '<textarea class="input" style="min-height:64px" dir="auto" id="aud-' + o.id + '" data-change="dec-aud" data-id="' + d.id + '" data-o="' + o.id + '">' + UI.esc(o.audience || '') + '</textarea></label>' +
      '</div>';
  }

  function compare(d) {
    const os = opts(d);
    if (os.length < 2 || !os.some((o) => o.removal || o.feel || o.audience)) return '';
    const name = (arr, v) => { const f = arr.find((x) => x[0] === v); return f ? L(f[1], f[2]) : '–'; };
    return '<div class="sec-title">' + L('جنب بعض', 'Side by side') + '</div><div class="card plain"><div class="rows">' + os.map((o) =>
      '<div class="row" style="align-items:flex-start"><div class="row-main"><div class="row-title">' + UI.ut(o.text) + '</div>' +
      '<div class="row-sub">' + L('بلا خوف: ', 'Without fear: ') + name(REMOVAL, o.removal) + ' · ' + name(FEEL, o.feel) + '</div>' +
      (o.audience ? '<div class="row-sub">' + T('من الفيلم: «{a}»', 'From the film: «{a}»', { a: UI.raw(UI.ut(o.audience)) }) + '</div>' : '') + '</div></div>').join('') + '</div></div>';
  }

  function detailView(id) {
    const d = Store.get('decisions', id);
    if (!d) return '<p class="muted">' + L('ما لقيتو.', 'Couldn\'t find it.') + '</p><a href="#/more/decisions">' + L('كل القرارات', 'All decisions') + '</a>';
    const locked = C.decisionLocked(d, day());
    let html = '<a class="small" href="#/more/decisions">' + L('كل القرارات', 'All decisions') + '</a>' +
      '<div class="card-head" style="margin-top:8px"><h2 class="display" style="font-size:24px;line-height:1.6;margin:0">' + UI.ut(d.title) + '</h2>' +
      '<button class="icon-btn" data-act="dec-edit" data-id="' + d.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('edit') + '</button></div>' +
      (locked ? lockLine(d) : '');
    if (d.status === 'decided') {
      const ch = opts(d).find((o) => o.id === d.chosen);
      html += '<div class="card rest" style="margin-top:12px">' + UI.jasmine('ornament-jasmine') + '<p>' + T('اخترت: {c}', 'You chose: {c}', { c: UI.raw(UI.ut(ch ? ch.text : '')) }) + '</p>' +
        (d.why ? '<p class="small muted">' + UI.utb(d.why) + '</p>' : '') + '<p class="tiny muted">' + UI.fmtFull((d.decidedAt || nowIso()).slice(0, 10)) + '</p>' +
        '<button class="btn text sm" data-act="dec-reopen" data-id="' + d.id + '">' + L('رجّعو مفتوح', 'Reopen it') + '</button></div>';
    }
    html += '<div class="sec-title">' + L('الخيارات', 'Options') + '</div>' + opts(d).map((o, i) => optionCard(d, o, i)).join('');
    if (opts(d).length < 3 && d.status !== 'decided') {
      html += '<form class="inline-form" data-form="dec-opt-add" style="margin-bottom:14px"><input type="hidden" name="id" value="' + d.id + '">' +
        '<input class="input" id="decOpt" name="text" dir="auto" autocomplete="off" placeholder="' + L('خيار…', 'An option…') + '"><button class="btn soft">' + L('زيد', 'Add') + '</button></form>';
    }
    html += compare(d);
    if (d.status !== 'decided') {
      html += '<div class="card plain" style="margin-top:14px">' +
        (locked ? '<p class="small muted">' + L('هلق مو وقت القرار. رح يرجعلك عصفحة اليوم بوقتو.', 'Now is not the time to decide. It will come back to you on Today when it\'s time.') + '</p>'
          : '<button class="btn lamp block" data-act="dec-decide" data-id="' + d.id + '"' + (opts(d).length ? '' : ' disabled') + '>' + L('أخدت قراري', 'I\'ve decided') + '</button>') +
        '<button class="btn text sm" style="margin-top:6px" data-act="dec-lock" data-id="' + d.id + '">' + (d.notBefore ? L('غيّر تاريخ القفل', 'Change the lock date') : L('قفّلو لتاريخ: «مش قبل…»', 'Lock it: "not before…"')) + '</button></div>';
    }
    html += '<div class="center" style="margin-top:10px"><button class="btn text sm" style="color:var(--clay)" data-act="dec-delete" data-id="' + d.id + '">' + L('امسح القرار', 'Delete the decision') + '</button></div>';
    return html;
  }

  root.Screens.decisions = {
    title: () => L('قرار', 'Decide'),
    render(r) { return r.query.id ? detailView(r.query.id) : listView(); },
  };

  // Today: a locked decision whose day has come, once.
  root.Decisions = {
    todayNote(ck) {
      const d = C.decisionsDue(Store.all('decisions'), ck.day)[0];
      if (!d) return '';
      return '<div class="card quiet"><div class="muted small">' + L('وصل وقت قرار. خود وقتك.', 'A decision\'s time has come. Take your time.') + '</div>' +
        '<div class="row-title" style="margin:4px 0 10px">' + UI.ut(d.title) + '</div><div class="btns">' +
        '<a class="btn soft sm" href="#/more/decisions?id=' + d.id + '" data-seen="' + d.id + '">' + L('افتحو', 'Open it') + '</a>' +
        '<button class="btn text sm" data-act="dec-seen" data-id="' + d.id + '">' + L('مش اليوم', 'Not today') + '</button></div></div>';
    },
  };

  function lockForm(d) {
    return '<h3>' + L('مش قبل…', 'Not before…') + '</h3><p class="small muted">' + L('للقرارات يلي ما بتنعمل منيح تحت ضغط وقت محدود، متل زيارة قصيرة. لحد هالتاريخ، فيك تفكر بس ما تقرر.', 'For decisions that don\'t go well under a ticking clock, like a short visit. Until this date you can think, but not decide.') + '</p>' +
      '<form data-form="dec-lock"><input type="hidden" name="id" value="' + d.id + '"><input class="input" type="date" name="notBefore" value="' + (d.notBefore || C.addDays(day(), 14)) + '" style="margin:8px 0 12px">' +
      '<div class="btns stretch"><button class="btn lamp">' + L('قفّل', 'Lock') + '</button>' + (d.notBefore ? '<button class="btn text" type="button" data-act="dec-unlock" data-id="' + d.id + '">' + L('شيل القفل', 'Remove the lock') + '</button>' : '') + '</div></form>';
  }

  const A = root.Actions, F = root.Forms;
  const save = (d) => Store.put('decisions', d);
  A['dec-new'] = () => UI.sheet.open(() => '<h3>' + L('قرار جديد', 'A new decision') + '</h3><form data-form="dec-new">' +
    '<label class="field"><span>' + L('شو القرار؟', 'What\'s the decision?') + '</span><input name="title" dir="auto" required autocomplete="off" autofocus placeholder="' + L('مثلاً: أقدّم على برنامج برّا هالسنة؟', 'e.g. Apply to a program abroad this year?') + '"></label>' +
    '<label class="field"><span>' + L('الخيارات (سطر لكل خيار، لحد ٣)', 'Options (one per line, up to 3)') + '</span><textarea name="options" dir="auto" placeholder="' + L('إي، هالسنة\nلأ، السنة الجاية', 'Yes, this year\nNo, next year') + '"></textarea></label>' +
    '<button class="btn lamp block">' + L('يلا', 'Start') + '</button></form>');
  F['dec-new'] = (dd) => {
    const options = String(dd.options || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 3).map((text) => ({ id: Store.uid().slice(0, 8), text }));
    const d = { id: Store.uid(), title: dd.title.trim(), options, status: 'open', notBefore: null, createdAt: nowIso() };
    UI.sheet.close();
    save(d);
    UI.go('more/decisions?id=' + d.id);
  };
  A['dec-edit'] = (el) => {
    const d = Store.get('decisions', el.dataset.id);
    if (!d) return;
    UI.sheet.open(() => '<h3>' + L('القرار', 'The decision') + '</h3><form data-form="dec-title"><input type="hidden" name="id" value="' + d.id + '">' +
      '<input class="input" name="title" dir="auto" required value="' + UI.esc(d.title) + '" style="margin-bottom:12px"><button class="btn lamp block">' + L('احفظ', 'Save') + '</button></form>');
  };
  F['dec-title'] = (dd) => { UI.sheet.close(); Store.patch('decisions', dd.id, { title: dd.title.trim() }); };
  F['dec-opt-add'] = (dd, f) => {
    const text = (dd.text || '').trim();
    const d = Store.get('decisions', dd.id);
    if (!text || !d || opts(d).length >= 3) return;
    f.reset();
    save({ ...d, options: opts(d).concat({ id: Store.uid().slice(0, 8), text }) });
  };
  A['dec-opt-del'] = (el) => { const d = Store.get('decisions', el.dataset.id); if (d) save({ ...d, options: opts(d).filter((o) => o.id !== el.dataset.o) }); };
  A['dec-set'] = (el) => {
    const d = Store.get('decisions', el.dataset.id);
    if (!d) return;
    const f = el.dataset.f, v = el.dataset.v;
    save({ ...d, options: opts(d).map((o) => (o.id === el.dataset.o ? { ...o, [f]: o[f] === v ? null : v } : o)) });
  };
  root.Changes['dec-aud'] = (el) => {
    const d = Store.get('decisions', el.dataset.id);
    if (d) save({ ...d, options: opts(d).map((o) => (o.id === el.dataset.o ? { ...o, audience: el.value.trim() } : o)) });
  };
  A['dec-lock'] = (el) => { const d = Store.get('decisions', el.dataset.id); if (d) UI.sheet.open(() => lockForm(d)); };
  F['dec-lock'] = (dd) => {
    UI.sheet.close();
    if (!dd.notBefore) return;
    Store.patch('decisions', dd.id, { notBefore: dd.notBefore, dueSeen: false });
    UI.toast(T('مقفول لـ {d}. لحد هداك الوقت، ما في داعي تقرر.', 'Locked until {d}. Until then, there\'s no need to decide.', { d: UI.fmtShort(dd.notBefore) }), 5200);
  };
  A['dec-unlock'] = (el) => { UI.sheet.close(); Store.patch('decisions', el.dataset.id, { notBefore: null }); };
  A['dec-decide'] = (el) => {
    const d = Store.get('decisions', el.dataset.id);
    if (!d || C.decisionLocked(d, day())) return;
    UI.sheet.open(() => '<h3>' + L('شو اخترت؟', 'What did you choose?') + '</h3><form data-form="dec-decide"><input type="hidden" name="id" value="' + d.id + '">' +
      '<div class="chips" style="margin-bottom:12px">' + opts(d).map((o, i) => '<label class="chip"><input type="radio" name="chosen" value="' + o.id + '"' + (i ? '' : ' checked') + '>' + UI.ut(o.text) + '</label>').join('') + '</div>' +
      '<label class="field"><span>' + L('ليش؟ (لنفسك بعدين)', 'Why? (for yourself, later)') + '</span><textarea name="why" dir="auto"></textarea></label>' +
      '<button class="btn lamp block">' + L('هاد قراري', 'This is my decision') + '</button></form>');
  };
  F['dec-decide'] = (dd) => {
    UI.sheet.close();
    Store.patch('decisions', dd.id, { status: 'decided', chosen: dd.chosen, why: (dd.why || '').trim(), decidedAt: nowIso() });
    UI.toast(L('أخدت قرارك. هاد بحد ذاتو شي.', 'You made your decision. That itself is something.'));
  };
  A['dec-reopen'] = (el) => Store.patch('decisions', el.dataset.id, { status: 'open', chosen: null });
  A['dec-seen'] = (el) => Store.patch('decisions', el.dataset.id, { dueSeen: true });
  A['dec-delete'] = (el) => UI.confirm({
    title: L('تمسح القرار؟', 'Delete the decision?'), yes: L('لا، خليه', 'No, keep it'), no: L('امسحو', 'Delete'), noClass: 'clay',
    onNo: () => { UI.removeWithUndo([['decisions', el.dataset.id]]); UI.go('more/decisions'); },
  });
  // Opening a due decision from Today counts as having seen it.
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[data-seen]'); if (a) Store.patch('decisions', a.dataset.seen, { dueSeen: true }); });
})(typeof self !== 'undefined' ? self : this);
