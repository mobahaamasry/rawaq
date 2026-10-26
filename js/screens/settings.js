/* Settings: language, look, time, ceilings, limits, Reset, backup. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  const opt = (v, label, cur) => '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + label + '</option>';
  const chip = (k, v, label, cur) => '<button class="chip" data-act="set-chip" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + (String(cur) === String(v)) + '">' + label + '</button>';
  const sw = (label, k, on, sub) => '<label class="switch"><span>' + label + (sub ? '<br><span class="small muted">' + sub + '</span>' : '') + '</span><input type="checkbox" data-change="set-bool" data-k="' + k + '"' + (on ? ' checked' : '') + '></label>';
  const sec = (t) => '<div class="sec-title">' + t + '</div>';
  const hourLabel = (h) => UI.fmtTime(C.pad(h) + ':00');

  function ceilingsCard(s) {
    const sessOpts = [30, 45, 60, 75, 90, 120];
    const dayOpts = [0, 60, 90, 120, 180, 240, 300, 360];
    return '<div class="card plain"><p class="small muted">' + L('كل نوع شغل إلو سقف للجلسة، وإذا بدك سقف لليوم. لما توصلو، رواق بيقلك توقف بلطف.', 'Each kind of work has a session ceiling, and a daily one if you like. When you reach it, Rawaq gently says stop.') + '</p>' +
      '<div class="rows">' + C.CATS.map((c) => {
        const v = s.ceilings[c] || { session: 90, daily: null };
        return '<div class="row" style="flex-wrap:wrap"><div class="row-main" style="min-width:30%">' + UI.catName(c) + '</div>' +
          '<label class="tiny muted" style="display:grid;gap:2px">' + L('الجلسة', 'Session') + '<select class="input" style="min-height:44px;padding:6px 10px" data-change="set-ceil" data-c="' + c + '" data-f="session">' + sessOpts.map((m) => opt(m, UI.fmtDur(m), v.session)).join('') + '</select></label>' +
          '<label class="tiny muted" style="display:grid;gap:2px">' + L('اليوم', 'Day') + '<select class="input" style="min-height:44px;padding:6px 10px" data-change="set-ceil" data-c="' + c + '" data-f="daily">' + dayOpts.map((m) => opt(m, m ? UI.fmtDur(m) : L('بلا', 'None'), v.daily || 0)).join('') + '</select></label></div>';
      }).join('') + '</div></div>';
  }

  function resetCard(s) {
    const F = root.Reset.FEELS;
    let html = '<div class="card plain"><p class="small muted">' + L('الاقتراحات يلي بتطلع بعد التنفّس. كل سطر اقتراح.', 'The suggestions that appear after breathing. One per line.') + '</p>';
    for (const k of Object.keys(F)) {
      const lines = (s.resetSuggestions[k] || []).map((x) => (UI.isAr() ? x.ar : x.en || x.ar)).join('\n');
      html += '<label class="field"><span>' + L(...F[k]) + '</span><textarea class="input" style="min-height:76px" dir="auto" data-change="set-reset-sugg" data-k="' + k + '">' + UI.esc(lines) + '</textarea></label>';
    }
    html += sw(L('خلّيني شوف نمط أسبوعي', 'Let me see a weekly pattern'), 'resetLog', s.resetLog,
      L('بيحفظ بس نوع الشعور والساعة. ما بيحفظ شو صار ولا شو عملت. مطفي من الأساس.', 'Keeps only the feeling and the hour. Never what happened or what you did. Off by default.'));
    if (s.resetLog) html += patternView();
    return html + '</div>';
  }

  function patternView() {
    const wk = root.App.weekKey();
    const uses = Store.all('resetUses').filter((u) => u.week === wk);
    const buckets = [[5, 12, 'الصبح', 'Morning'], [12, 18, 'الضهر', 'Afternoon'], [18, 24, 'المسا', 'Evening'], [0, 5, 'بالليل', 'Night']];
    let html = '<div class="muted small" style="margin-top:6px">' + L('هالأسبوع', 'This week') + '</div>';
    if (!uses.length) return html + '<p class="small muted">' + L('ما في شي هالأسبوع.', 'Nothing this week.') + '</p>';
    html += '<div class="rows">' + Object.keys(root.Reset.FEELS).filter((k) => uses.some((u) => u.feeling === k)).map((k) => '<div class="row" style="min-height:44px"><div class="row-main small">' + L(...root.Reset.FEELS[k]) + '</div>' +
      buckets.map((b) => '<span class="tiny muted" style="display:inline-flex;align-items:center;gap:4px;margin-inline-start:8px">' + L(b[2], b[3]) +
        '<i style="width:8px;height:8px;border-radius:50%;background:' + (uses.some((u) => u.feeling === k && u.hour >= b[0] && u.hour < b[1]) ? 'var(--dusk)' : 'var(--line)') + '"></i></span>').join('') + '</div>').join('') + '</div>';
    return html + '<button class="btn text sm" data-act="reset-pattern-clear">' + L('امسح النمط', 'Clear the pattern') + '</button>';
  }

  function backupCard() {
    const b = Store.get('meta', 'backup');
    const last = b && b.lastAt ? T('آخر نسخة: {d}', 'Last backup: {d}', { d: UI.fmtFull(root.App.clock(Date.parse(b.lastAt)).day) }) : L('لسا ما في نسخة.', 'No backup yet.');
    return '<div class="card plain"><p>' + last + '</p><p class="small muted">' + L('كل كم أسبوع، خود نسخة وحطها بمكان أمين. للاحتياط بس.', 'Every couple of weeks, save a copy somewhere safe. Just in case.') + '</p>' +
      '<div class="btns" style="margin-top:10px"><button class="btn soft" data-act="backup-export">' + L('صدّر كل شي', 'Export everything') + ' (<bdi>JSON</bdi>)</button>' +
      '<label class="btn">' + L('رجّع من ملف', 'Restore from a file') + '<input type="file" accept="application/json,.json" data-change="backup-import" hidden></label></div>' +
      '<a class="btn text sm" style="padding:0;margin-top:6px" href="#/more/bridges">' + L('تصدير بأشكال تانية، وجسور اختيارية', 'Other export formats, and optional bridges') + '</a>' +
      '<p class="tiny muted" style="margin-top:10px">' + T('التخزين: {b}', 'Storage: {b}', { b: Store.backend === 'idb' ? 'IndexedDB' : 'localStorage' }) + '</p></div>';
  }

  root.Screens.settings = {
    title: () => L('الإعدادات', 'Settings'),
    render() {
      const s = S();
      const [bm, bd] = s.birthday ? s.birthday.split('-').map(Number) : [0, 0];
      const none = (v) => '<option value=""' + (v ? '' : ' selected') + '>—</option>';
      let html = sec(L('عنك', 'About you')) + '<div class="card plain">' +
        '<label class="field"><span>' + L('اسمك (للتحية)', 'Your name (for greetings)') + '</span><input dir="auto" value="' + UI.esc(s.name) + '" data-change="set-text" data-k="name" autocomplete="off"></label>' +
        '<div class="field"><span>' + L('عيد ميلادك', 'Your birthday') + '</span><div class="grid2">' +
        '<select class="input" data-change="set-bday" data-part="d">' + none(bd) + Array.from({ length: 31 }, (_, i) => opt(i + 1, UI.n(i + 1), bd)).join('') + '</select>' +
        '<select class="input" data-change="set-bday" data-part="m">' + none(bm) + Array.from({ length: 12 }, (_, i) => opt(i + 1, UI.fmtDate('2026-' + C.pad(i + 1) + '-01', { month: 'long' }), bm)).join('') + '</select></div></div></div>';

      if (root.App.installPrompt) {
        html += '<div class="card lampish" style="margin-top:18px"><p>' + L('ثبّت رواق على الشاشة الرئيسية، ليفتح متل أي تطبيق وبدون نت.', 'Install Rawaq on your home screen, so it opens like any app, with no connection.') + '</p>' +
          '<button class="btn soft" data-act="app-install">' + L('ثبّت رواق', 'Install Rawaq') + '</button></div>';
      }
      html += sec(L('الشكل', 'Look')) + '<div class="card plain">' +
        '<div class="field"><span>' + L('اللغة', 'Language') + '</span><div class="chips">' + chip('lang', 'ar', 'العربي', s.lang) + chip('lang', 'en', 'English', s.lang) + '</div></div>' +
        '<div class="field"><span>' + L('الجو', 'Theme') + '</span><div class="chips">' + chip('theme', 'dark', L('ليل', 'Night'), s.theme) + chip('theme', 'light', L('صبح الشام', 'Damascus morning'), s.theme) + '</div></div>' +
        '<div class="field"><span>' + L('الأرقام', 'Numerals') + '</span><div class="chips">' + chip('numerals', 'eastern', '٠١٢٣', s.numerals) + chip('numerals', 'western', '0123', s.numerals) + '</div></div>' +
        sw(L('التاريخ الهجري كمان', 'Show the Hijri date too'), 'hijri', s.hijri) +
        sw(L('صوت ناعم آخر الجلسة', 'A soft chime when a session ends'), 'sound', s.sound) +
        (s.sound ? '<button class="btn text sm" data-act="chime-test">' + L('اسمعو', 'Hear it') + '</button>' : '') + '</div>';

      html += sec(L('راحة العين', 'Comfort')) + '<div class="card plain">' +
        '<div class="field"><span>' + L('حجم الكتابة', 'Text size') + '</span><div class="chips">' +
        chip('textSize', 'normal', L('عادي', 'Normal'), s.textSize || 'normal') + chip('textSize', 'large', L('أكبر', 'Larger'), s.textSize) + chip('textSize', 'larger', L('كبير', 'Large'), s.textSize) + '</div></div>' +
        sw(L('حركة هادية', 'Calm motion'), 'calmMotion', s.calmMotion, L('بلا ورد نازل، بلا نجوم بترفّ، كلشي ثابت.', 'No falling petals, no twinkling; everything stays still.')) + '</div>';

      html += sec(L('وقت التركيز', 'During focus')) + '<div class="card plain">' +
        sw(L('صوت هادي بالخلفية', 'A soft hush in the background'), 'focus.hush', s.focus.hush, L('متل صوت مطر بعيد. بينعمل على الجهاز، بلا ملفات.', 'Like distant rain. Made on the device, no files.')) +
        sw(L('خلّي الشاشة صاحية', 'Keep the screen awake'), 'focus.wakeLock', s.focus.wakeLock) +
        sw(L('رجّة خفيفة لما يخلص الوقت', 'A light vibration when the time is up'), 'focus.vibrate', s.focus.vibrate) + '</div>';

      html += sec(L('موسم الامتحانات', 'Exam season')) + '<div class="card plain">' +
        sw(L('أسبوعين قبل الامتحان: دراسة، راحة، وأهلك بس', 'Two weeks before an exam: only study, rest and family'), 'examSeason.auto', s.examSeason.auto,
          L('المشاريع يلي بالخلفية بتوقف لحالها، وصفحة اليوم بتخف. بيرجع كلشي بعدين.', 'Background projects pause on their own and Today gets lighter. Everything comes back after.')) +
        sw(L('أسبوع راحة بعد آخر امتحان', 'A rest week after the last exam'), 'examSeason.restWeek', s.examSeason.restWeek) + '</div>';

      html += sec(L('الوقت', 'Time')) + '<div class="card plain">' +
        '<label class="field"><span>' + L('اليوم بيخلص الساعة', 'The day ends at') + '</span><select data-change="set-num" data-k="dayEndHour">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => opt(h, hourLabel(h), s.dayEndHour)).join('') + '</select></label>' +
        '<p class="tiny muted" style="margin-top:-8px">' + L('يعني إذا سهرت للـ٢، لسا اليوم نفسو.', 'So staying up till 2 is still the same day.') + '</p>' +
        '<label class="field"><span>' + L('الأسبوع بيبلّش', 'The week starts on') + '</span><select data-change="set-num" data-k="weekStart">' + [6, 0, 1].map((d) => opt(d, UI.weekdayName(d), s.weekStart)).join('') + '</select></label>' +
        '<label class="field"><span>' + L('التوقيت', 'Time zone') + '</span><select data-change="set-text" data-k="tz">' + opt('Asia/Damascus', L('دمشق', 'Damascus'), s.tz) + opt('', L('توقيت الجهاز', 'This device\'s time'), s.tz) + '</select></label>' +
        '<div class="field"><span>' + L('المراجعة الأسبوعية بتفتح', 'The weekly review opens') + '</span><div class="grid2">' +
        '<select class="input" data-change="set-review" data-f="openDay">' + [0, 1, 2, 3, 4, 5, 6].map((d) => opt(d, UI.weekdayName(d), s.review.openDay)).join('') + '</select>' +
        '<select class="input" data-change="set-review" data-f="openHour">' + [12, 14, 16, 17, 18, 19, 20, 21].map((h) => opt(h, hourLabel(h), s.review.openHour)).join('') + '</select></div></div>' +
        '<label class="field"><span>' + L('ولآخر', 'Until the end of') + '</span><select data-change="set-review" data-f="closeDay">' + [0, 1, 2, 3, 4, 5, 6].map((d) => opt(d, UI.weekdayName(d), s.review.closeDay)).join('') + '</select></label></div>';

      html += sec(L('السقوف', 'Ceilings')) + ceilingsCard(s);

      html += sec(L('الحدود', 'Limits')) + '<div class="card plain"><p class="small" style="color:var(--sage)">' + L('الحد موجود لسبب.', 'The limit is there for a reason.') + '</p>' +
        '<div class="grid2"><label class="field"><span>' + L('مشاريع رئيسية شغّالة', 'Active Main projects') + '</span><select data-change="set-wip" data-f="main">' + [1, 2, 3, 4, 5].map((n) => opt(n, UI.n(n), s.wip.main)).join('') + '</select></label>' +
        '<label class="field"><span>' + L('أوراق شغّالة', 'Active papers') + '</span><select data-change="set-wip" data-f="papers">' + [1, 2, 3, 4].map((n) => opt(n, UI.n(n), s.wip.papers)).join('') + '</select></label></div></div>';

      html += sec(L('وقت الرسائل', 'Message windows')) + '<div class="card plain">' +
        sw(L('ذكّرني بوقت الرسائل على صفحة اليوم', 'Show my message times on Today'), 'messageWindows.enabled', s.messageWindows.enabled, L('بس تذكير هادي. ما في منع.', 'Just a quiet reminder. Nothing is blocked.')) +
        (s.messageWindows.enabled ? '<div class="grid2" style="margin-top:8px">' + s.messageWindows.times.map((t, i) => '<label class="field"><span>' + L('وقت', 'Time') + '</span><input type="time" value="' + t + '" data-change="set-msg-time" data-i="' + i + '"></label>').join('') + '</div>' +
          '<div class="btns">' + (s.messageWindows.times.length < 4 ? '<button class="btn text sm" data-act="msg-add">' + UI.icon('plus') + L('وقت كمان', 'Another time') + '</button>' : '') +
          (s.messageWindows.times.length > 1 ? '<button class="btn text sm" data-act="msg-remove">' + L('شيل آخر وقت', 'Remove the last one') + '</button>' : '') + '</div>' : '') + '</div>';

      html += sec(L('الأقسام', 'Sections')) + '<div class="card plain">' +
        sw(L('رف الفضول', 'Curiosity shelf'), 'modules.curiosity', s.modules.curiosity) +
        sw(L('الجسم', 'Body'), 'modules.body', s.modules.body) +
        sw(L('النوم', 'Sleep'), 'modules.sleep', s.modules.sleep) +
        sw(L('الإيمان', 'Faith'), 'modules.faith', s.modules.faith, L('إذا طفّيتو، بيختفي من كل مكان.', 'Turned off, it disappears everywhere.')) +
        sw(L('سؤال القريبين مرة بالأسبوع', 'The weekly "close ones" question'), 'modules.connection', s.modules.connection) +
        '<p class="tiny muted">' + L('الأقسام المطفية ما بتنمسح بياناتها، بس بتختفي.', 'Turned-off sections keep their data; they just step out of sight.') + '</p></div>';

      html += sec(L('تنفّس', 'Breathe')) + resetCard(s);
      html += sec(L('النسخة الاحتياطية', 'Backup')) + backupCard();
      html += '<div class="card plain" style="margin-top:26px"><p class="small muted">' + L('هاد بيمسح كل شي من هالجهاز.', 'This erases everything from this device.') + '</p>' +
        '<button class="btn clay" data-act="data-clear">' + L('امسح كل شي', 'Erase everything') + '</button></div>';
      return html;
    },
  };

  /* ---------- changes ---------- */
  const Ch = root.Changes, A = root.Actions;
  function setPath(path, v) {
    const [a, b] = path.split('.');
    if (!b) return Store.setSettings({ [a]: v });
    return Store.setSettings({ [a]: { ...S()[a], [b]: v } });
  }
  A['set-chip'] = (el) => setPath(el.dataset.k, el.dataset.v);
  Ch['set-bool'] = (el) => setPath(el.dataset.k, el.checked);
  Ch['set-text'] = (el) => setPath(el.dataset.k, el.value.trim());
  Ch['set-num'] = (el) => setPath(el.dataset.k, Number(el.value));
  Ch['set-bday'] = (el) => {
    // Either part set to blank means "no birthday"; picking one part first fills the other with the 1st / January.
    if (!el.value) { Store.setSettings({ birthday: null }); return; }
    const [m, d] = (S().birthday || '01-01').split('-');
    const next = el.dataset.part === 'm' ? C.pad(Number(el.value)) + '-' + d : m + '-' + C.pad(Number(el.value));
    Store.setSettings({ birthday: next });
  };
  Ch['set-review'] = (el) => setPath('review.' + el.dataset.f, Number(el.value));
  Ch['set-ceil'] = (el) => {
    const c = el.dataset.c, f = el.dataset.f, v = Number(el.value);
    const cur = S().ceilings;
    Store.setSettings({ ceilings: { ...cur, [c]: { ...(cur[c] || {}), [f]: f === 'daily' && !v ? null : v } } });
  };
  Ch['set-wip'] = (el) => {
    const f = el.dataset.f, v = Number(el.value), cur = S().wip[f];
    if (v <= cur) { setPath('wip.' + f, v); return; }
    el.value = cur;
    UI.confirm({
      title: L('الحد موجود لسبب.', 'The limit is there for a reason.'),
      body: L('تكبير الحد بيسهّل ترجع تحمل كتير. متأكد؟', 'Raising it makes it easier to carry too much again. Are you sure?'),
      yes: L('خليه متل ما هو', 'Keep it as it is'), no: T('إي، خليه {n}', 'Yes, make it {n}', { n: UI.n(v) }), noClass: 'text',
      onNo: () => setPath('wip.' + f, v),
    });
  };
  Ch['set-msg-time'] = (el) => {
    const t = S().messageWindows.times.slice();
    t[Number(el.dataset.i)] = el.value || t[Number(el.dataset.i)];
    setPath('messageWindows.times', t.sort());
  };
  A['msg-add'] = () => setPath('messageWindows.times', S().messageWindows.times.concat('17:00').sort());
  A['msg-remove'] = () => setPath('messageWindows.times', S().messageWindows.times.slice(0, -1));
  A['chime-test'] = () => UI.chime(true);
  A['app-install'] = async () => {
    const p = root.App.installPrompt;
    if (!p) return;
    root.App.installPrompt = null;
    p.prompt();
    try { await p.userChoice; } catch (e) { /* dismissed */ }
    root.App.render();
  };
  Ch['set-reset-sugg'] = (el) => {
    const k = el.dataset.k, lang = UI.isAr() ? 'ar' : 'en';
    const old = S().resetSuggestions[k] || [];
    const next = el.value.split('\n').map((x) => x.trim()).filter(Boolean).map((line) => old.find((o) => (o[lang] || o.ar) === line) || { ar: line, en: line });
    Store.setSettings({ resetSuggestions: { ...S().resetSuggestions, [k]: next } });
  };
  A['reset-pattern-clear'] = () => { for (const u of Store.all('resetUses')) Store.del('resetUses', u.id); };

  /* ---------- backup ---------- */
  function download(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  A['backup-export'] = () => {
    const json = Store.exportJSON();
    download('rawaq-backup-' + root.App.clock().day + '.json', json);
    UI.toast(L('انحفظت النسخة. حطها بمكان أمين.', 'Backup saved. Keep it somewhere safe.'));
  };
  Ch['backup-import'] = (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let tables;
      try { tables = Store.parseImport(String(reader.result)); } catch (e) {
        UI.toast(L('هالملف مو نسخة من رواق.', 'This file isn\'t a Rawaq backup.'));
        return;
      }
      let when = '';
      try { when = UI.fmtFull(JSON.parse(String(reader.result)).exportedAt.slice(0, 10)); } catch (e) { /* no date */ }
      UI.confirm({
        title: L('نرجّع هالنسخة؟', 'Restore this backup?'),
        body: T('هاد بيبدّل كل شي موجود هلق بالنسخة يلي اخترتها{w}.', 'This replaces everything here now with the backup you picked{w}.', { w: when ? ' (' + when + ')' : '' }),
        yes: L('رجّعها', 'Restore'), no: L('لأ', 'No'), noClass: 'text',
        onYes: async () => { await Store.importTables(tables); UI.toast(L('رجع كل شي.', 'Everything is back.')); },
      });
    };
    reader.readAsText(file);
    el.value = '';
  };
  A['data-clear'] = () => UI.confirm({
    title: L('تمسح كل شي؟', 'Erase everything?'),
    body: L('كل شي على هالجهاز رح ينمسح. إذا ما عندك نسخة، صدّر أول.', 'Everything on this device will be erased. If you have no backup, export first.'),
    yes: L('صدّر أول', 'Export first'), no: L('امسح كل شي', 'Erase everything'), noClass: 'clay solid',
    onYes: () => A['backup-export'](),
    onNo: async () => { await Store.clearAll(); UI.go('today'); UI.toast(L('انمسح كل شي. صفحة بيضا.', 'Everything is erased. A blank page.')); },
  });
})(typeof self !== 'undefined' ? self : this);
