/* Today: only what today needs, shaped by the energy check-in. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  const ENERGY = [
    { v: 1, f: 0, ar: 'فاضي', en: 'Empty' },
    { v: 2, f: 0.25, ar: 'خفيف', en: 'Light' },
    { v: 3, f: 0.5, ar: 'عادي', en: 'Okay' },
    { v: 4, f: 0.75, ar: 'منيح', en: 'Good' },
    { v: 5, f: 1, ar: 'مليان', en: 'Full' },
  ];
  const FEELINGS = {
    tired: ['تعبان', 'Tired'], rested: ['مرتاح', 'Rested'], anxious: ['قلقان', 'Anxious'], lonely: ['وحيد', 'Lonely'],
    excited: ['متحمس', 'Excited'], empty: ['فاضي', 'Empty'], upset: ['مدايق', 'Upset'], happy: ['مبسوط', 'Happy'],
  };
  let pickedFeeling = null;
  let editing = false;
  let lastWin = null;

  const feelingName = (f) => (FEELINGS[f] ? L(...FEELINGS[f]) : UI.esc(f));

  function greeting(ck) {
    const name = S().name || '';
    switch (C.greetingKey(ck.wallMin, root.App.sunset || 1050)) {
      case 'morning': return name ? T('صباح الياسمين يا {name}', 'Jasmine morning, {name}', { name }) : L('صباح الياسمين', 'Jasmine morning');
      case 'afternoon': return name ? T('أهلين يا {name}', 'Hey {name}', { name }) : L('أهلين', 'Hey there');
      case 'evening': return name ? T('مسا الخير يا {name}', 'Good evening, {name}', { name }) : L('مسا الخير', 'Good evening');
      case 'afterMidnight': return L('سهران؟ خليها خفيفة الليلة.', 'Up late? Keep tonight light.');
      default: return L('قرّب الفجر.', 'Dawn is close.');
    }
  }

  // The real moon tonight, drawn as it looks from Damascus (lit on the right while it grows).
  const MOON_NAMES = {
    new: ['محاق', 'New moon'], waxingCrescent: ['هلال', 'Crescent'], firstQuarter: ['تربيع أول', 'First quarter'], waxingGibbous: ['أحدب', 'Gibbous'],
    full: ['بدر', 'Full moon'], waningGibbous: ['أحدب', 'Gibbous'], lastQuarter: ['تربيع تاني', 'Last quarter'], waningCrescent: ['هلال', 'Crescent'],
  };
  function tonightMoon() {
    const m = C.moonPhase(Date.now());
    return '<span class="tonight">' + UI.moon(m.illum, { side: m.waxing ? 'right' : 'left' }) + L('القمر الليلة: ', 'Tonight\'s moon: ') + L(...MOON_NAMES[m.name]) + '</span>';
  }

  // Exam season (two weeks before → last exam day) and the rest week after. "Show anyway" lifts it for today only.
  let showAllDay = null;
  root.Season = {
    now(dayKey) { return C.examSeason(Store.all('exams'), dayKey || root.App.clock().day, S().examSeason); },
    // Study range during the season: a little above the ramp (or a calm default).
    hours(exam, dayKey) { const ph = C.rampFor(exam, dayKey); return Math.round((ph ? ph.hi : 12) * 1.2); },
  };
  function planFor(ck, log) {
    const season = root.Season.now(ck.day);
    return C.todayPlan({
      day: ck.day, lm: ck.lm, energy: log && log.energy != null ? log.energy : 3, weekKey: root.App.weekKey(ck.day),
      dayEndHour: S().dayEndHour, slots: Store.all('slots'), items: Store.all('items'), projects: Store.all('projects'),
      focusKey: log && log.focusKey, season: season && showAllDay !== ck.day ? season.mode : null,
    });
  }

  function seasonCards(ck, plan) {
    const season = root.Season.now(ck.day);
    if (!season) return '';
    const more = plan.heldBack && showAllDay !== ck.day
      ? '<button class="btn text sm" style="padding:0" data-act="today-show-all">' + L('في شغلات تانية مستنية · ورجيني ياها', 'Other things are waiting · show them anyway') + '</button>' : '';
    if (season.mode === 'rest') {
      const curio = root.Curio && S().modules.curiosity ? Store.all('curiosity').filter((c) => c.status === 'want' || c.status === 'progress') : [];
      const c = curio.length ? curio[C.hash(ck.day) % curio.length] : null;
      const ideas = Store.all('presence');
      const idea = ideas.length ? ideas[C.hash(ck.day + 'p') % ideas.length] : null;
      return '<div class="card rest">' + UI.jasmine('ornament-jasmine') +
        '<h2 class="card-title">' + L('خلصت الامتحانات.', 'The exams are over.') + '</h2>' +
        '<p>' + L('هالأسبوع للراحة. مو لأنك استحقيتها، لأنك إنسان.', 'This week is for rest. Not because you earned it; because you\'re human.') + '</p>' +
        '<div class="rows" style="margin-top:6px">' +
        (c ? '<div class="row" style="min-height:44px"><div class="row-main small">' + T('من رف الفضول: {t}', 'From the curiosity shelf: {t}', { t: UI.raw(UI.ut(c.title)) }) + '</div></div>' : '') +
        (idea ? '<div class="row" style="min-height:44px"><div class="row-main small">' + T('مع أهلك: {t}', 'With family: {t}', { t: UI.raw(UI.ut(idea.text)) }) + '</div></div>' : '') +
        '<div class="row" style="min-height:44px"><div class="row-main small">' + L('نوم بلا منبّه، إذا بتقدر.', 'Sleep without an alarm, if you can.') + '</div></div></div>' +
        '<p class="tiny muted" style="margin-top:8px">' + T('الشغل بيرجع {d}.', 'Work comes back on {d}.', { d: UI.fmtShort(C.addDays(season.restEnds, 1)) }) + '</p>' + more + '</div>';
    }
    const head = { twoWeeks: ['موسم الامتحانات: آخر أسبوعين.', 'Exam season: the last two weeks.'], lastWeek: ['موسم الامتحانات: آخر أسبوع.', 'Exam season: the last week.'], examDays: ['أيام الامتحانات.', 'Exam days.'] }[season.stage];
    let html = '<div class="card lampish"><h2 class="card-title">' + L(...head) + '</h2>' +
      '<p class="small">' + L('دراسة، راحة، وأهلك. والباقي بيستنى لبعد الامتحانات.', 'Study, rest, and family. Everything else waits until after the exams.') + '</p>' + more + '</div>';
    let famSeen = false;
    try { famSeen = sessionStorage.getItem('rawaq-fam') === ck.day; } catch (e) { /* ok */ }
    if (!famSeen) {
      html += '<div class="card quiet plain"><div class="row" style="padding:0;min-height:44px"><div class="row-main small">' +
        L('شوية وقت مع أهلك اليوم؟ الدراسة بتمشي أحسن بعدها.', 'A little time with your family today? Studying goes better after.') + '</div>' +
        '<button class="btn text sm" data-act="today-fam">' + L('تمام', 'Okay') + '</button></div></div>';
    }
    return html;
  }

  function checkinCard(log) {
    const cur = log && log.energy;
    const fe = log && log.feeling != null ? log.feeling : pickedFeeling;
    const custom = fe && !FEELINGS[fe];
    return '<div class="card">' +
      '<h2 class="card-title">' + L('كيف الطاقة اليوم؟', 'How is your energy today?') + '</h2>' +
      '<p class="muted small">' + L('ما في جواب غلط.', 'There is no wrong answer.') + '</p>' +
      '<div class="moons">' + ENERGY.map((e) => '<button class="moon-btn" data-act="today-energy" data-v="' + e.v + '" aria-pressed="' + (cur === e.v) + '">' +
        UI.moon(e.f) + '<span>' + L(e.ar, e.en) + '</span></button>').join('') + '</div>' +
      '<p class="muted small" style="margin:12px 0 8px">' + L('وكلمة وحدة لشعورك؟ إذا بدك.', 'And one word for how you feel? If you like.') + '</p>' +
      '<div class="chips">' + Object.keys(FEELINGS).map((k) => '<button class="chip" data-act="today-feeling" data-k="' + k + '" aria-pressed="' + (fe === k) + '">' + L(...FEELINGS[k]) + '</button>').join('') +
      '<button class="chip" data-act="today-feeling-custom" aria-pressed="' + !!custom + '">' + (custom ? UI.ut(fe) : L('+ غير شي', '+ Something else')) + '</button></div>' +
      '<div class="btns end" style="margin-top:8px">' + (editing ? '<button class="btn text" data-act="today-checkin-done">' + L('تمام', 'Done') + '</button>' : '<button class="btn text" data-act="today-skip">' + L('مش هلق', 'Not now') + '</button>') + '</div>' +
      '</div>';
  }

  function summaryLine(log) {
    const e = ENERGY.find((x) => x.v === log.energy);
    const bits = [];
    if (e) bits.push(L(e.ar, e.en));
    if (log.feeling) bits.push(feelingName(log.feeling));
    return '<div class="row" style="min-height:44px;padding:0 2px 6px">' +
      (e ? '<span style="width:24px;height:24px;flex:none">' + UI.moon(e.f) + '</span>' : '') +
      '<div class="row-main muted small">' + (bits.length ? bits.join(' · ') : L('بلا سؤال الطاقة اليوم', 'No energy check-in today')) + '</div>' +
      '<button class="btn text sm" data-act="today-checkin-edit">' + L('غيّر', 'Change') + '</button></div>';
  }

  function itemRow(c, ck, opts) {
    let title, sub = [], extra = '';
    if (c.kind === 'slot') {
      const s = c.slot, r = C.slotRange(s, S().dayEndHour);
      title = UI.ut(UI.slotLabel(s));
      sub.push(UI.fmtRange(s.start, s.end));
      if (s.label) sub.push(UI.slotName(s.type));
      if (ck.lm >= r[0] && ck.lm < r[1]) extra = ' <span class="tag lamp">' + L('هلق', 'Now') + '</span>';
    } else if (c.kind === 'item') {
      title = UI.ut(c.item.title);
      const p = c.item.projectId && Store.get('projects', c.item.projectId);
      if (p) sub.push(UI.ut(p.name));
    } else {
      title = UI.ut(c.project.nextStep);
      sub.push(UI.ut(c.project.name));
    }
    const ref = c.kind === 'project' ? 'p:' + c.project.id : c.key;
    return '<div class="item"><div class="item-main">' +
      '<div class="row-title">' + title + extra + '</div>' + (sub.length ? '<div class="row-sub">' + sub.join(' · ') + '</div>' : '') +
      '<div class="btns" style="margin-top:8px">' +
      '<button class="btn ' + (opts && opts.quiet ? '' : 'soft ') + 'sm" data-act="focus-start" data-ref="' + UI.esc(ref) + '">' + UI.icon('play') + L('ابدأ ١٠ دقايق بس', 'Just start for 10 minutes') + '</button>' +
      (c.kind === 'item' ? '<button class="btn text sm" data-act="today-item-done" data-id="' + c.item.id + '">' + L('خلصت', 'Done') + '</button>' +
        '<button class="btn text sm" data-act="today-unpin" data-id="' + c.item.id + '">' + L('مش اليوم', 'Not today') + '</button>' : '') +
      '</div></div></div>';
  }

  function mainCard(plan, ck) {
    let head, line;
    if (plan.mode === 'minimum') {
      head = L('النسخة الصغيرة من اليوم.', 'The small version of the day.');
      line = L('الطاقة اليوم خفيفة، خلينا نعمل النسخة الصغيرة من اليوم.', 'Low energy today, so let\'s do the small version of the day.');
    } else if (plan.mode === 'full') {
      head = L('اليوم', 'Today');
      line = L('في طاقة اليوم. حلو، والسقف لسا موجود.', 'There is energy today. Nice, and the ceiling is still there.');
    } else {
      head = L('اليوم', 'Today');
      line = L('شي أو تلاتة بيكفّوا.', 'One to three things is plenty.');
    }
    let body;
    if (!plan.main.length) {
      body = plan.mode === 'minimum'
        ? UI.empty('rooftop', L('ما في شي مطلوب منك اليوم. ارتاح.', 'Nothing is asked of you today. Rest.'))
        : UI.empty('desk', L('ما في شي مخطط لليوم. يوم هادي.', 'Nothing planned for today. A quiet day.'));
    } else {
      body = plan.main.map((c) => itemRow(c, ck)).join('');
    }
    let foot = '';
    if (plan.mode === 'minimum') {
      if (plan.candidates.length > 1) foot += '<button class="btn text sm" data-act="today-swap">' + L('غيّرها بشي تاني', 'Swap for another') + '</button>';
      foot += '<p class="small muted" style="margin-top:8px">' + L('وإذا بتقدر، قيلولة أو مشوار قصير. الراحة جزء من اليوم، مو مكافأة.', 'If you can, a nap or a short walk. Rest is part of the day, not a reward.') + '</p>';
    } else if (plan.candidates.length < 3) {
      foot += '<div class="btns" style="margin-top:6px"><button class="btn text sm" data-act="today-add-open">' + UI.icon('plus') + L('حط شي لليوم', 'Add something for today') + '</button>' +
        (!plan.main.length ? '<a class="btn text sm" href="#/week">' + L('خطّط الأسبوع', 'Plan the week') + '</a>' : '') + '</div>';
    }
    return '<div class="card"><h2 class="card-title">' + head + '</h2><p class="muted small">' + line + '</p>' + body + foot + '</div>';
  }

  function restCard(s, ck) {
    const r = C.slotRange(s, S().dayEndHour);
    const evening = C.hmToMin(s.start) >= 17 * 60 || C.hmToMin(s.start) < 3 * 60;
    const now = ck.lm >= r[0] && ck.lm < r[1];
    return '<div class="card rest">' + UI.jasmine('ornament-jasmine') +
      '<h2 class="card-title">' + (evening ? L('هالمسا إلك', 'This evening is yours') : L('هالوقت إلك', 'This time is yours')) +
      (now ? ' <span class="tag sage">' + L('هلق', 'Now') + '</span>' : '') + '</h2>' +
      '<p class="muted small">' + UI.fmtRange(s.start, s.end) + (s.label ? ' · ' + UI.ut(s.label) : '') + '</p>' +
      '<p>' + L('هالوقت إلك. ما في شغل هون.', 'This time is yours. No work here.') + '</p></div>';
  }

  function notes(ck) {
    const out = [];
    if (root.Radar.visible(ck)) out.push(root.Radar.card());
    if (root.Decisions) { const dn = root.Decisions.todayNote(ck); if (dn) out.push(dn); }
    for (const l of C.lettersDue(Store.all('letters'), ck.day).slice(0, 1)) {
      out.push('<div class="card letter"><div class="sealed">' + UI.icon('letter') + L('في رسالة منك إلك.', 'There\'s a letter from you, to you.') + '</div>' +
        '<div class="row-title" style="margin:8px 0 10px">' + UI.ut(l.title) + '</div><button class="btn soft sm" data-act="letter-open" data-id="' + l.id + '">' + L('افتحها', 'Open it') + '</button></div>');
    }
    for (const o of C.responsesNear(Store.all('opportunities'), ck.day).slice(0, 1)) {
      out.push('<div class="card quiet"><p>' + T('قرّب وقت ردّ {n}. أياً كان الجواب، انت عملت يلي عليك.', '{n} should reply soon. Whatever the answer, you did your part.', { n: UI.raw(UI.ut(o.name)) }) + '</p>' +
        '<button class="btn text sm" data-act="opp-quiet" data-id="' + o.id + '">' + L('تمام', 'Okay') + '</button></div>');
    }
    const wk = C.reviewTarget(ck, S());
    if (wk) {
      const rv = Store.get('reviews', wk);
      if (!rv || !rv.doneAt) {
        out.push('<div class="card lampish"><h2 class="card-title">' + L('المراجعة الأسبوعية فاتحة', 'The weekly review is open') + '</h2>' +
          '<p class="muted small">' + L('خمس دقايق، مو تقييم.', 'Five minutes, not a grade.') + '</p>' +
          '<a class="btn soft sm" href="#/more/review">' + L('يلا', 'Let\'s go') + '</a></div>');
      }
    }
    for (const q of C.questionsDue(Store.all('questions'), ck.day).slice(0, 1)) {
      out.push('<div class="card quiet"><div class="muted small">' + L('وصل وقت هالسؤال.', 'This question\'s time has come.') + '</div>' +
        '<div class="row-title" style="margin:4px 0 10px">' + UI.ut(q.question) + '</div>' +
        '<div class="btns"><button class="btn soft sm" data-act="q-resolve" data-id="' + q.id + '">' + L('انحلّت', 'It\'s settled') + '</button>' +
        '<button class="btn sm" data-act="q-repark" data-id="' + q.id + '">' + L('رجّعها عالرف', 'Back on the shelf') + '</button>' +
        '<button class="btn text sm" data-act="q-later" data-id="' + q.id + '">' + L('مش هلق', 'Not now') + '</button></div></div>');
    }
    for (const w of C.waitingDue(Store.all('waiting'), ck.day).slice(0, 1)) {
      out.push('<div class="card quiet"><div class="muted small">' + T('فيك تسأل {who} عن:', 'You could check with {who} about:', { who: UI.raw(UI.ut(w.who || '')) }) + '</div>' +
        '<div class="row-title" style="margin:4px 0 10px">' + UI.ut(w.what) + '</div>' +
        '<div class="btns"><button class="btn soft sm" data-act="wait-done" data-id="' + w.id + '">' + L('وصل', 'It arrived') + '</button>' +
        '<button class="btn text sm" data-act="wait-week" data-id="' + w.id + '">' + L('بعد أسبوع', 'In a week') + '</button></div></div>');
    }
    return out.slice(0, 2).join('');
  }

  function winCard(ck) {
    let html = '<div class="card quiet">';
    if (lastWin && Store.get('wins', lastWin)) {
      const w = Store.get('wins', lastWin);
      html += '<p>' + L('انحفظت. وبتستاهل حدا يعرف فيها.', 'Saved. Someone deserves to hear about this.') + '</p>' +
        '<form data-form="today-told" class="inline-form"><input class="input" id="tTold" name="who" dir="auto" autocomplete="off" placeholder="' + L('لمين بدك تحكي؟', 'Who will you tell?') + '" value="' + UI.esc(w.toldWho || '') + '">' +
        '<button class="btn soft">' + L('تمام', 'Okay') + '</button></form>';
    } else {
      html += '<h2 class="card-title" style="font-size:16px">' + L('شي منيح صار اليوم؟', 'Something good happen today?') + '</h2>' +
        '<form data-form="today-win" class="inline-form" style="margin-top:8px"><input class="input" id="tWin" name="text" dir="auto" autocomplete="off" placeholder="' + L('ولو صغير…', 'Even a small one…') + '">' +
        '<button class="btn soft">' + L('احفظ', 'Save') + '</button></form>';
    }
    const ago = C.monthAgoWin(Store.all('wins'), ck.day);
    if (ago) html += '<a class="small muted" style="display:block;margin-top:12px" href="#/more/wins">' + T('من شهر: {w}', 'A month ago: {w}', { w: UI.raw(UI.ut(ago.text)) }) + '</a>';
    return html + '</div>';
  }

  function birthdayCard() {
    return '<div class="card letter tap" data-act="today-birthday">' +
      '<div style="display:flex;gap:6px;margin-bottom:8px">' + UI.jasmine() + UI.jasmine() + UI.jasmine() + '</div>' +
      '<p class="display" style="font-size:22px;line-height:1.7">' + (S().name ? T('كل سنة وانت بخير يا {name}.', 'Happy birthday, {name}.', { name: S().name }) : L('كل سنة وانت بخير.', 'Happy birthday.')) + '</p>' +
      '<p>' + L('شوف قديش صار في نجوم بسماك هالسنة.', 'Look how many stars your sky gathered this year.') + '</p></div>';
  }

  root.Screens.today = {
    title: () => '',
    render() {
      const s = S();
      const ck = root.App.clock();
      const log = Store.get('dayLogs', ck.day);
      const checked = !!log && (log.energy != null || log.skipped);
      let html = '<h2 class="greet">' + greeting(ck) + '</h2><p class="date-line"><span>' + UI.fmtDay(ck.day) + (s.hijri ? ' · ' + UI.fmtHijri(ck.day) : '') + '</span>' + tonightMoon() + '</p>';
      const bday = C.isBirthday(ck.day, s.birthday);
      if (bday) html += birthdayCard();
      if (ck.wallMin >= 180 && ck.wallMin < Math.max(5, s.dayEndHour) * 60) {
        html += '<div class="card quiet"><p>' + L('الليل قرّب يخلص. الشي يلي بإيدك بيستنى لبكرا.', 'The night is almost over. What\'s in your hands can wait for tomorrow.') + '</p></div>';
      }
      if (!checked || editing) {
        html += checkinCard(log);
        if (!checked) return html;
      } else {
        html += summaryLine(log);
      }
      const plan = planFor(ck, log);
      html += notes(ck);
      html += seasonCards(ck, plan);
      if (!plan.restWeek) html += mainCard(plan, ck);
      if (plan.background.length) {
        html += '<div class="card quiet"><h2 class="card-title" style="font-size:16px">' + L('إذا ضل في طاقة', 'If there\'s energy left') + '</h2>' +
          plan.background.map((c) => itemRow(c, ck, { quiet: true })).join('') + '</div>';
      }
      if (root.Google) html += root.Google.todayCard(ck);
      for (const p of plan.protectedToday.slice(0, 2)) html += restCard(p, ck);
      const quiet = (root.Faith ? root.Faith.todayRows(ck) : '') + (root.Sleep ? root.Sleep.todayRow(ck) : '');
      if (quiet) html += '<div class="card quiet plain"><div class="rows">' + quiet + '</div></div>';
      if (root.Connection) html += root.Connection.todayCard(ck);
      if (s.messageWindows.enabled && s.messageWindows.times.length) {
        html += '<div class="card quiet plain" style="padding:14px 18px"><p class="small">' +
          T('وقت الرسائل: {t}.', 'Message time: {t}.', { t: s.messageWindows.times.map(UI.hour12).join(L(' و ', ' and ')) }) + '</p></div>';
      }
      html += winCard(ck);
      return html;
    },
    mount() {
      const ck = root.App.clock();
      if (C.isBirthday(ck.day, S().birthday)) {
        const k = 'rawaq-bday-' + ck.day;
        try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); UI.petals(12); } } catch (e) { /* private */ }
      }
    },
  };

  /* ---------- actions ---------- */
  const A = root.Actions;
  const day = () => root.App.clock().day;
  function putLog(patch) {
    const d = day();
    const cur = Store.get('dayLogs', d) || { id: d };
    Store.put('dayLogs', { ...cur, ...patch, id: d });
  }

  A['today-energy'] = (el) => {
    const v = Number(el.dataset.v);
    const cur = Store.get('dayLogs', day());
    const feeling = cur && cur.feeling != null ? cur.feeling : pickedFeeling;
    editing = false;
    putLog({ energy: v, feeling: feeling || null, mode: C.energyMode(v), skipped: false, at: new Date().toISOString() });
    pickedFeeling = null;
  };
  A['today-feeling'] = (el) => {
    const k = el.dataset.k;
    const cur = Store.get('dayLogs', day());
    if (cur && (cur.energy != null || cur.skipped)) putLog({ feeling: cur.feeling === k ? null : k });
    else { pickedFeeling = pickedFeeling === k ? null : k; root.App.render(); }
  };
  A['today-feeling-custom'] = () => UI.sheet.open(() => '<h3>' + L('بكلمة وحدة؟', 'In one word?') + '</h3>' +
    '<form data-form="today-feeling-custom" class="inline-form"><input class="input" name="w" dir="auto" maxlength="24" autocomplete="off" autofocus>' +
    '<button class="btn soft">' + L('تمام', 'Okay') + '</button></form>');
  root.Forms['today-feeling-custom'] = (d) => {
    const w = (d.w || '').trim();
    UI.sheet.close();
    if (!w) return;
    const cur = Store.get('dayLogs', day());
    if (cur && (cur.energy != null || cur.skipped)) putLog({ feeling: w });
    else { pickedFeeling = w; root.App.render(); }
  };
  A['today-skip'] = () => { editing = false; putLog({ skipped: true, feeling: pickedFeeling || null }); pickedFeeling = null; };
  A['today-checkin-edit'] = () => { editing = true; root.App.render(); };
  A['today-checkin-done'] = () => { editing = false; root.App.render(); };

  A['today-swap'] = () => {
    const ck = root.App.clock();
    const log = Store.get('dayLogs', ck.day);
    const plan = planFor(ck, log);
    if (plan.candidates.length < 2) return;
    const i = plan.candidates.findIndex((c) => c.key === (plan.main[0] && plan.main[0].key));
    putLog({ focusKey: plan.candidates[(i + 1) % plan.candidates.length].key });
  };

  A['today-show-all'] = () => { showAllDay = root.App.clock().day; root.App.render(); };
  A['today-fam'] = () => { try { sessionStorage.setItem('rawaq-fam', root.App.clock().day); } catch (e) { /* ok */ } root.App.render(); };
  A['today-item-done'] = (el) => {
    Store.patch('items', el.dataset.id, { status: 'done', doneAt: new Date().toISOString() });
    UI.toast(L('حلو.', 'Nice.'));
  };
  A['today-unpin'] = (el) => Store.patch('items', el.dataset.id, { pinnedDate: null });

  function todayFull() {
    const ck = root.App.clock();
    return planFor(ck, Store.get('dayLogs', ck.day)).candidates.length >= 3;
  }
  /* Burnout radar: a gentle note when two or more signs of tiredness show up together. Never a diagnosis. */
  root.Radar = {
    state() {
      const s = S();
      return C.burnoutSignals({
        day: root.App.clock().day, dayLogs: Store.all('dayLogs'), sessions: Store.all('sessions'), projects: Store.all('projects'),
        wip: s.wip, sleep: s.modules.sleep ? Store.all('sleep') : [], reviews: Store.all('reviews'),
      });
    },
    visible(ck) { const q = S().radarQuietUntil; return !(q && q >= ck.day) && root.Radar.state().show; },
    card() {
      const wk = root.App.weekKey();
      const bg = Store.all('projects').some((p) => p.status === 'active' && p.tier === 'background' && !C.pausedThisWeek(p, wk));
      return '<div class="card radar"><p>' + L('في علامات تعب. يمكن هالأسبوع وقت نخفف شي.', 'Some signs of tiredness. Maybe this week is a time to lighten something.') + '</p>' +
        '<div class="btns" style="margin-top:6px">' +
        (bg ? '<button class="btn sm" data-act="radar-pause">' + L('وقّف شي بالخلفية', 'Pause something in the background') + '</button>' : '') +
        (S().lighterWeek !== wk ? '<button class="btn sm" data-act="radar-lighter">' + L('خفّف السقوف', 'Lower the ceilings') + '</button>' : '') +
        '<button class="btn sage sm" data-act="slot-add" data-type="rest">' + L('زيد وقت إلك', 'Add time for you') + '</button>' +
        '<button class="btn text sm" data-act="radar-quiet">' + L('مش هلق', 'Not now') + '</button></div></div>';
    },
  };
  A['radar-pause'] = () => UI.sheet.open(() => {
    const wk = root.App.weekKey();
    const bg = Store.all('projects').filter((p) => p.status === 'active' && p.tier === 'background');
    return '<h3>' + L('شو يرتاح هالأسبوع؟', 'What can rest this week?') + '</h3><div class="rows">' + bg.map((p) => {
      const paused = C.pausedThisWeek(p, wk);
      return '<div class="row"><div class="row-main">' + UI.ut(p.name) + '</div><button class="btn ' + (paused ? 'text' : 'sage') + ' sm" data-act="week-pause" data-id="' + p.id + '" data-w="' + wk + '">' +
        (paused ? L('رجّعها', 'Resume') : L('وقّفها هالأسبوع', 'Pause this week')) + '</button></div>';
    }).join('') + '</div><button class="btn lamp block" style="margin-top:14px" data-act="sheet-close">' + L('تمام', 'Okay') + '</button>';
  });
  A['radar-lighter'] = () => { Store.setSettings({ lighterWeek: root.App.weekKey() }); UI.toast(L('هالأسبوع أخف. السقوف نزلت شوي.', 'A lighter week. The ceilings came down a little.')); };
  A['radar-quiet'] = () => Store.setSettings({ radarQuietUntil: C.addDays(root.App.clock().day, 3) });

  root.Today = {
    // Pin something for today, unless today already has enough.
    pin(itemId) {
      if (todayFull()) { UI.toast(L('اليوم فيه كفاية. خليها لبكرا؟', 'Today has enough already. Leave it for tomorrow?')); return false; }
      Store.patch('items', itemId, { pinnedDate: day() });
      UI.toast(L('انحطت لليوم.', 'Added to today.'));
      return true;
    },
    pinProjectStep(projectId) {
      const p = Store.get('projects', projectId);
      if (!p || !p.nextStep) return false;
      if (todayFull()) { UI.toast(L('اليوم فيه كفاية. خليها لبكرا؟', 'Today has enough already. Leave it for tomorrow?')); return false; }
      Store.put('items', { id: Store.uid(), title: p.nextStep, projectId: p.id, status: 'open', owner: 'me', pinnedDate: day(), createdAt: new Date().toISOString() });
      UI.toast(L('انحطت لليوم.', 'Added to today.'));
      return true;
    },
  };

  A['today-add-open'] = () => UI.sheet.open(() => {
    const d = day();
    const tasks = Store.all('items').filter((i) => i.status === 'open' && i.pinnedDate !== d && (i.owner || 'me') === 'me').slice(0, 8);
    const steps = Store.all('projects').filter((p) => p.status === 'active' && p.tier === 'main' && p.nextStep);
    let html = '<h3>' + L('شو بدك تحط لليوم؟', 'What would you like for today?') + '</h3>' +
      '<form data-form="today-add" class="inline-form"><input class="input" name="title" dir="auto" autocomplete="off" autofocus placeholder="' + L('شغلة صغيرة…', 'A small thing…') + '">' +
      '<button class="btn soft">' + L('حطها', 'Add') + '</button></form>';
    if (tasks.length || steps.length) {
      html += '<div class="sec-title">' + L('أو من يلي عندك', 'Or from what you have') + '</div><div class="rows">';
      for (const t of tasks) html += '<div class="row"><div class="row-main">' + UI.ut(t.title) + '</div><button class="btn soft sm" data-act="today-pin" data-id="' + t.id + '">' + L('لليوم', 'Today') + '</button></div>';
      for (const p of steps) html += '<div class="row"><div class="row-main"><div>' + UI.ut(p.nextStep) + '</div><div class="row-sub">' + UI.ut(p.name) + '</div></div><button class="btn soft sm" data-act="today-pin-step" data-id="' + p.id + '">' + L('لليوم', 'Today') + '</button></div>';
      html += '</div>';
    }
    return html;
  });
  root.Forms['today-add'] = (d) => {
    const title = (d.title || '').trim();
    if (!title) return;
    if (todayFull()) { UI.sheet.close(); UI.toast(L('اليوم فيه كفاية. خليها لبكرا؟', 'Today has enough already. Leave it for tomorrow?')); return; }
    Store.put('items', { id: Store.uid(), title, status: 'open', owner: 'me', pinnedDate: day(), createdAt: new Date().toISOString() });
    UI.sheet.close();
  };
  A['today-pin'] = (el) => { if (root.Today.pin(el.dataset.id)) UI.sheet.close(); };
  A['today-pin-step'] = (el) => { if (root.Today.pinProjectStep(el.dataset.id)) UI.sheet.close(); };

  root.Forms['today-win'] = (d, form) => {
    const text = (d.text || '').trim();
    if (!text) return;
    form.reset();
    lastWin = Store.uid();
    Store.put('wins', { id: lastWin, text, date: day(), toldWho: '', createdAt: new Date().toISOString() });
  };
  root.Forms['today-told'] = (d) => {
    const who = (d.who || '').trim();
    const id = lastWin;
    lastWin = null;
    if (id && who) Store.patch('wins', id, { toldWho: who });
    else root.App.render();
  };
  A['today-birthday'] = () => UI.go('more/wins?year=1');
})(typeof self !== 'undefined' ? self : this);
