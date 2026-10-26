/* More: the quieter rooms. Also the curiosity shelf and the About page. */
(function (root) {
  'use strict';
  const UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  root.Screens.more = {
    title: () => L('أكتر', 'More'),
    render() {
      const rows = [
        ['wins', 'star', 'سماك', 'Your sky', 'كل شي منيح صار، نجمة.', 'Every good thing, a star.'],
        ['inbox', 'inbox', 'فرّغ راسك', 'Empty your head', 'الصندوق، بدون ضغط.', 'The inbox, no pressure.'],
        ['questions', 'question', 'رف الأسئلة المفتوحة', 'Open questions shelf', 'حطها عالرف، وريّح راسك.', 'Shelve it, rest your head.'],
        ['review', 'review', 'المراجعة الأسبوعية', 'Weekly review', 'خمس دقايق بالأسبوع.', 'Five minutes a week.'],
        ['decisions', 'question', 'قرار', 'Decide', 'للقرارات الكبيرة، على مهل.', 'For big decisions, slowly.'],
      ];
      rows.push(['letters', 'letter', 'رسائل', 'Letters', 'لحالك بالمستقبل، وكتابة خام.', 'To your future self, and raw notes.']);
      if (S().modules.curiosity) rows.push(['curiosity', 'curiosity', 'رف الفضول', 'Curiosity shelf', 'أشيا بتحبها، بدون مواعيد.', 'Things you love, no deadlines.']);
      if (S().modules.body) rows.push(['body', 'body', 'الجسم', 'Body', 'عادات، مو أرقام.', 'Habits, not numbers.']);
      if (S().modules.sleep) rows.push(['sleep', 'sleep', 'النوم', 'Sleep', 'سجل خفيف، ومعدّل بالأسبوع.', 'A light log, a weekly average.']);
      if (S().modules.faith) rows.push(['faith', 'faith', 'الإيمان', 'Faith', 'للرجعة، مو للحساب.', 'For coming back, not for counting.']);
      rows.push(['connection', 'jasmine', 'قريبين', 'Close ones', 'أفكار صغيرة لتكون حاضر.', 'Small ways to be present.']);
      rows.push(['bridges', 'plane', 'الجسور', 'Bridges', 'تصدير، وتأمل الشهر، وجسور اختيارية.', 'Exports, monthly reflection, optional bridges.']);
      rows.push(['settings', 'settings', 'الإعدادات', 'Settings', 'اللغة، السقوف، النسخة الاحتياطية.', 'Language, ceilings, backup.']);
      rows.push(['about', 'lamp', 'عن رواق', 'About Rawaq', '', '']);
      return '<input class="input" id="moreSearch" type="search" dir="auto" autocomplete="off" placeholder="' + L('دوّر على شي…', 'Find something…') + '" style="margin-bottom:10px">' +
        '<div id="searchResults"></div>' +
        '<div class="card plain more-list">' + rows.map((r) => '<a href="#/more/' + r[0] + '">' + UI.icon(r[1]) +
        '<div class="row-main"><div class="row-title">' + L(r[2], r[3]) + '</div>' + (r[4] ? '<div class="row-sub">' + L(r[4], r[5]) + '</div>' : '') + '</div>' +
        UI.icon('chev', 'flip-rtl muted') + '</a>').join('') + '</div>';
    },
    mount() {
      const input = document.getElementById('moreSearch');
      if (!input) return;
      let timer = 0;
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(showResults, 120); });
      if (input.value) showResults();
    },
  };

  /* ---------- search: local only; open questions, feelings, Reset and faith are never searched ---------- */
  const KIND = {
    win: ['نجمة', 'Win'], task: ['شغلة', 'Task'], project: ['مشروع', 'Project'], paper: ['ورقة', 'Paper'], opportunity: ['فرصة', 'Application'],
    idea: ['فكرة', 'Idea'], waiting: ['بستنّى', 'Waiting'], inbox: ['الصندوق', 'Inbox'], letter: ['رسالة', 'Letter'], curiosity: ['رف الفضول', 'Curiosity'], raw: ['كتابة خام', 'Raw note'],
  };
  function showResults() {
    const input = document.getElementById('moreSearch'), box = document.getElementById('searchResults');
    if (!input || !box) return;
    const q = input.value.trim();
    if (!q) { box.innerHTML = ''; return; }
    const t = (n) => Store.all(n);
    const idx = root.Core.buildSearchIndex({
      wins: t('wins'), items: t('items'), projects: t('projects'), papers: t('papers'), opportunities: t('opportunities'), ideas: t('ideas'),
      waiting: t('waiting'), inbox: t('inbox'), letters: t('letters'), curiosity: S().modules.curiosity ? t('curiosity') : [], rawNotes: t('rawNotes'),
    });
    const res = root.Core.search(idx, q);
    box.innerHTML = res.length
      ? '<div class="card plain"><div class="rows">' + res.map((r) => '<a class="row" style="color:inherit" href="' + r.route + '"><div class="row-main"><div class="ut" dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.esc(r.text) + '</div>' +
        (r.sub ? '<div class="row-sub ut" dir="auto">' + UI.esc(r.sub) + '</div>' : '') + '</div><span class="tag">' + L(...KIND[r.type]) + '</span></a>').join('') + '</div></div>'
      : '<p class="small muted center">' + L('ما لقيت شي بهالكلمات.', 'Nothing found with those words.') + '</p>';
  }

  /* ---------- curiosity shelf ---------- */
  const TYPES = { paper: ['ورقة', 'Paper'], film: ['فيلم', 'Film'], book: ['كتاب', 'Book'], video: ['فيديو', 'Video'], topic: ['موضوع', 'Topic'], game: ['لعبة', 'Game'] };
  const STATUS = { want: ['بدي', 'Want'], progress: ['عم', 'In progress'], loved: ['حبيتو', 'Loved'], done: ['خلص', 'Done'] };
  const pickOne = () => {
    const pool = Store.all('curiosity').filter((c) => c.status === 'want' || c.status === 'progress');
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };
  root.Curio = { typeName: (t) => L(...(TYPES[t] || TYPES.topic)), pickOne };
  let filter = 'all';

  root.Screens.curiosity = {
    title: () => L('رف الفضول', 'Curiosity shelf'),
    render() {
      const all = Store.all('curiosity');
      const types = Object.keys(TYPES).filter((t) => all.some((i) => i.type === t));
      if (filter !== 'all' && !types.includes(filter)) filter = 'all';
      const items = filter === 'all' ? all : all.filter((i) => i.type === filter);
      let html = '<p class="muted small">' + L('بدون مواعيد، بدون أهداف. بس أشيا بتحبها لحالها.', 'No deadlines, no goals. Just things you love for their own sake.') + '</p>' +
        '<form class="card" data-form="curio-add" style="margin-top:10px"><div class="inline-form">' +
        '<input class="input" id="cuTitle" name="title" dir="auto" required autocomplete="off" placeholder="' + L('فيلم، كتاب، ورقة، موضوع…', 'A film, book, paper, topic…') + '">' +
        '<select class="input" name="type" style="max-width:34%">' + Object.keys(TYPES).map((k) => '<option value="' + k + '">' + L(...TYPES[k]) + '</option>').join('') + '</select></div>' +
        '<details class="fold"><summary>' + L('رابط وملاحظة (إذا بدك)', 'Link and note (optional)') + '</summary>' +
        '<input class="input" id="cuLink" name="link" type="url" dir="ltr" placeholder="' + L('رابط', 'Link') + '" style="margin-bottom:8px"><input class="input" id="cuNote" name="note" dir="auto" placeholder="' + L('ليش بدك ياه؟', 'Why do you want it?') + '"></details>' +
        '<button class="btn soft block" style="margin-top:10px">' + L('حطها عالرف', 'Put it on the shelf') + '</button></form>';
      if (all.length) {
        html += '<div class="btns" style="justify-content:space-between;margin:4px 0 6px"><div class="chips">' +
          '<button class="chip" data-act="curio-filter" data-t="all" aria-pressed="' + (filter === 'all') + '">' + L('الكل', 'All') + '</button>' +
          types.map((t) => '<button class="chip" data-act="curio-filter" data-t="' + t + '" aria-pressed="' + (filter === t) + '">' + L(...TYPES[t]) + '</button>').join('') + '</div>' +
          '<button class="btn text sm" data-act="curio-surprise">' + UI.icon('star') + L('فاجئني', 'Surprise me') + '</button></div>';
      }
      for (const st of Object.keys(STATUS)) {
        const list = items.filter((i) => i.status === st);
        if (!list.length) continue;
        html += '<div class="sec-title">' + L(...STATUS[st]) + '</div><div class="card plain"><div class="rows">' + list.map((i) => '<div class="row tap" data-act="curio-open" data-id="' + i.id + '">' +
          '<div class="row-main"><div class="row-title">' + UI.ut(i.title) + '</div>' + (i.note ? '<div class="row-sub">' + UI.ut(i.note) + '</div>' : '') + '</div>' +
          '<span class="tag">' + root.Curio.typeName(i.type) + '</span></div>').join('') + '</div></div>';
      }
      return html;
    },
  };

  const A = root.Actions, F = root.Forms;
  F['curio-add'] = (d, f) => {
    const title = (d.title || '').trim();
    if (!title) return;
    f.reset();
    Store.put('curiosity', { id: Store.uid(), title, type: d.type || 'topic', status: 'want', link: (d.link || '').trim(), note: (d.note || '').trim(), createdAt: new Date().toISOString() });
  };
  A['curio-filter'] = (el) => { filter = el.dataset.t; root.App.render(); };
  A['curio-surprise'] = () => {
    const c = pickOne();
    if (!c) { UI.toast(L('الرف كلو مقري أو محبوب. زيد شي جديد؟', 'Everything on the shelf is done or loved. Add something new?')); return; }
    A['curio-open']({ dataset: { id: c.id } });
  };
  A['curio-open'] = (el) => {
    const i = Store.get('curiosity', el.dataset.id);
    if (!i) return;
    UI.sheet.open(() => {
      const c = Store.get('curiosity', i.id) || i;
      return '<h3>' + UI.ut(c.title) + '</h3><form data-form="curio-save"><input type="hidden" name="id" value="' + c.id + '">' +
        '<div class="field"><span>' + L('وين وصلت؟', 'Where are you with it?') + '</span><div class="chips">' + Object.keys(STATUS).map((k) => '<label class="chip"><input type="radio" name="status" value="' + k + '"' + (k === c.status ? ' checked' : '') + '>' + L(...STATUS[k]) + '</label>').join('') + '</div></div>' +
        '<label class="field"><span>' + L('الاسم', 'Title') + '</span><input name="title" dir="auto" required value="' + UI.esc(c.title) + '"></label>' +
        '<div class="grid2"><label class="field"><span>' + L('النوع', 'Type') + '</span><select name="type">' + Object.keys(TYPES).map((k) => '<option value="' + k + '"' + (k === c.type ? ' selected' : '') + '>' + L(...TYPES[k]) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>' + L('رابط (إذا في)', 'Link (optional)') + '</span><input name="link" type="url" dir="ltr" value="' + UI.esc(c.link || '') + '"></label></div>' +
        '<label class="field"><span>' + L('ملاحظة', 'Note') + '</span><input name="note" dir="auto" value="' + UI.esc(c.note || '') + '"></label>' +
        '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button><button class="btn text" type="button" data-act="curio-delete" data-id="' + c.id + '">' + L('امسحها', 'Delete') + '</button></div></form>' +
        (c.link ? '<a class="btn text sm" style="margin-top:8px" href="' + UI.esc(c.link) + '" target="_blank" rel="noopener">' + L('افتح الرابط', 'Open the link') + '</a>' : '');
    });
  };
  F['curio-save'] = (d) => {
    UI.sheet.close();
    const cur = Store.get('curiosity', d.id) || {};
    const finished = (d.status === 'done' || d.status === 'loved') && !cur.finishedAt ? { finishedAt: new Date().toISOString() } : {};
    Store.patch('curiosity', d.id, { title: d.title.trim(), type: d.type, status: d.status, link: (d.link || '').trim(), note: (d.note || '').trim(), ...finished });
  };
  A['curio-delete'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['curiosity', el.dataset.id]]); };

  /* ---------- about ---------- */
  root.Screens.about = {
    title: () => L('عن رواق', 'About'),
    render() {
      return '<div class="center" style="padding-top:12px"><div style="width:96px;margin:0 auto">' + UI.mark() + '</div>' +
        '<div class="greet" style="font-size:40px;margin-top:6px">' + L('رواق', 'Rawaq') + '</div>' +
        '<p class="muted">' + L('يعني على مهلك. بدون عجلة.', 'It means: calm, easy, unhurried.') + '</p></div>' +
        '<div class="card plain" style="margin-top:18px"><p>' + L('رواق مصمم ليخلّي النمط الصحي هو الأسهل: سقوف مش بس أهداف، ما في دين، بدايات صغيرة، والراحة محمية.', 'Rawaq is built so the healthy pattern is the easy one: ceilings, not only goals; no debt; small starts; protected rest.') + '</p>' +
        '<p class="muted small">' + L('كل شي محفوظ على هالجهاز بس. ما في حساب، ولا سيرفر، ولا تتبّع.', 'Everything stays on this device. No account, no server, no tracking.') + '</p></div>' +
        '<button class="btn text block" data-act="about-wave" aria-label="' + L('الموجة', 'The wave') + '" style="min-height:56px">' + UI.wave('', '') + '</button>' +
        '<p class="small muted center" id="waveNote" hidden>' + L('الموجة هي <bdi>slow oscillation</bdi>: نفس الموجة يلي بتثبّت الذاكرة وقت النوم العميق.', 'The wave is a slow oscillation: the same wave that consolidates memory in deep sleep.') + '</p>' +
        '<p class="tiny muted center" style="margin-top:24px">' + L('الخطوط: <bdi>Aref Ruqaa</bdi>، <bdi>IBM Plex Sans Arabic</bdi>، <bdi>IBM Plex Sans</bdi>، <bdi>Fraunces</bdi>، كلها بترخيص <bdi>SIL OFL</bdi>.', 'Fonts: Aref Ruqaa, IBM Plex Sans Arabic, IBM Plex Sans, Fraunces, all under the SIL Open Font License.') + '</p>' +
        '<div class="center" style="margin-top:18px"><button class="btn text sm" data-act="welcome-open">' + L('شوف الترحيب مرة تانية', 'See the welcome again') + '</button></div>' +
        '<p class="display center" style="font-size:22px;margin-top:40px">' + L('معمول إلك، بهدوء.', 'Made for you, quietly.') + '</p>';
    },
  };
  A['about-wave'] = () => { const n = document.getElementById('waveNote'); if (n) n.hidden = !n.hidden; };
})(typeof self !== 'undefined' ? self : this);
