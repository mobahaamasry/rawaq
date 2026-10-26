/* Week planner: slots are time containers decided in calm moments. Past slots fade; nothing moves forward. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  function viewWeek(r) { return r.query.w || root.App.weekKey(); }

  function rampLine(wk) {
    const ck = root.App.clock();
    const exam = Store.all('exams').filter((e) => e.date >= ck.day).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (!exam) return '';
    const ph = C.rampFor(exam, wk >= ck.day ? wk : ck.day) || C.rampFor(exam, C.addDays(wk, 6));
    if (!ph) return '';
    const season = root.Season && root.Season.now(wk >= ck.day ? wk : ck.day);
    const inSeason = season && season.mode === 'season' && season.exam.id === exam.id;
    const mid = inSeason ? root.Season.hours(exam, ck.day) : Math.round((ph.lo + ph.hi) / 2);
    let planned = 0;
    for (const d of C.weekDays(wk)) {
      for (const s of C.workSlotsOn(Store.all('slots'), d, S().dayEndHour)) {
        if (s.type !== 'study') continue;
        const rg = C.slotRange(s, S().dayEndHour);
        planned += rg[1] - rg[0];
      }
    }
    return '<div class="card quiet plain" style="padding:14px 18px">' +
      '<p>' + (inSeason ? T('موسم الامتحانات: دراسة حوالي {h} هالأسبوع.', 'Exam season: about {h} of study this week.', { h: UI.hoursWord(mid) })
        : T('دراسة هالأسبوع: حوالي {h}.', 'Study this week: about {h}.', { h: UI.hoursWord(mid) })) + '</p>' +
      '<p class="small muted">' + L('اقتراح بس، انت بتقرر.', 'Just a suggestion. You decide.') +
      (planned ? ' ' + T('بالخطة هلق: {d}.', 'In the plan now: {d}.', { d: UI.fmtDur(planned) }) : '') + '</p></div>';
  }

  function slotChip(s, d, state, used) {
    return '<div class="slot ' + s.type + (state === 'past' ? ' past' : '') + '" data-act="slot-edit" data-id="' + s.id + '" data-day="' + d + '" role="button" tabindex="0">' +
      (s.protected ? UI.jasmine() : '') +
      '<div class="l"><div class="row-title" style="font-weight:500">' + UI.ut(UI.slotLabel(s)) + '</div>' +
      (s.protected ? '<div class="row-sub">' + L('هالوقت إلك', 'This time is yours') + '</div>' : '') + '</div>' +
      (used ? '<span class="used" title="' + L('صار في جلسة هون', 'A session happened here') + '"></span>' : '') +
      '<span class="t">' + UI.fmtRange(s.start, s.end) + '</span></div>';
  }

  function projectsCard(wk) {
    const ps = Store.all('projects').filter((p) => p.status === 'active');
    const main = ps.filter((p) => p.tier === 'main');
    const bg = ps.filter((p) => p.tier === 'background');
    if (!ps.length) return '';
    let html = '<div class="sec-title">' + L('المشاريع هالأسبوع', 'Projects this week') + '</div><div class="card plain">';
    if (main.length) {
      html += '<div class="muted small">' + L('الرئيسي', 'Main') + '</div><div class="rows">' +
        main.map((p) => '<div class="row" style="min-height:44px"><div class="row-main">' + UI.ut(p.name) + '</div></div>').join('') + '</div>';
    }
    if (bg.length) {
      html += '<div class="muted small" style="margin-top:12px">' + L('بالخلفية', 'In the background') + '</div><div class="rows">' +
        bg.map((p) => {
          const paused = C.pausedThisWeek(p, wk);
          return '<div class="row"><div class="row-main">' + UI.ut(p.name) +
            (paused ? ' <span class="tag sage">' + L('هالأسبوع متوقف', 'Paused this week') + '</span>' : '') + '</div>' +
            '<button class="btn ' + (paused ? 'text' : 'sage') + ' sm" data-act="week-pause" data-id="' + p.id + '" data-w="' + wk + '">' +
            (paused ? L('رجّعها', 'Resume') : L('وقّفها هالأسبوع', 'Pause this week')) + '</button></div>';
        }).join('') + '</div>' +
        '<p class="tiny muted" style="margin-top:8px">' + L('الوقفة شي طبيعي وصحي.', 'Pausing is a normal, healthy state.') + '</p>';
    }
    return html + '</div>';
  }

  root.Screens.week = {
    title: () => L('الأسبوع', 'Week'),
    render(r) {
      const s = S();
      const ck = root.App.clock();
      const cur = root.App.weekKey(ck.day);
      const wk = viewWeek(r);
      const days = C.weekDays(wk);
      const slots = Store.all('slots');
      const sessions = Store.all('sessions');
      let html = '<div class="week-nav">' +
        '<a class="icon-btn" href="#/week?w=' + C.addDays(wk, -7) + '" aria-label="' + L('الأسبوع يلي قبل', 'Previous week') + '">' + UI.icon('back', 'flip-rtl') + '</a>' +
        '<div class="center"><div class="range">' + UI.fmtShort(days[0]) + ' – ' + UI.fmtShort(days[6]) + '</div>' +
        (wk !== cur ? '<a class="small" href="#/week">' + L('رجوع لهالأسبوع', 'Back to this week') + '</a>' : '<div class="small muted">' + L('هالأسبوع', 'This week') + '</div>') + '</div>' +
        '<a class="icon-btn" href="#/week?w=' + C.addDays(wk, 7) + '" aria-label="' + L('الأسبوع الجاي', 'Next week') + '">' + UI.icon('chev', 'flip-rtl') + '</a></div>';
      // The week at a glance: one column a day, a small dot per slot. Tap to jump to that day.
      html += '<div class="wstrip">' + days.map((d) => {
        const dots = C.slotsOn(slots, d, s.dayEndHour).slice(0, 4).map((sl) => '<i class="' + sl.type + '"></i>').join('');
        return '<a href="#" data-act="week-jump" data-day="' + d + '" class="' + (d === ck.day ? 'today' : '') + (d < ck.day ? ' past' : '') + '">' +
          '<span class="wd">' + UI.weekdayName(C.weekdayOf(d), true) + '</span><span class="dn">' + UI.n(Number(d.slice(8))) + '</span><span class="wdots">' + dots + '</span></a>';
      }).join('') + '</div>';
      if (wk >= cur) html += rampLine(wk);
      if (s.lighterWeek === wk) html += '<p class="small muted center">' + L('هالأسبوع أخف: السقوف نازلة شوي.', 'A lighter week: the ceilings are a bit lower.') + '</p>';
      for (const d of days) {
        const past = d < ck.day;
        const isToday = d === ck.day;
        const list = C.slotsOn(slots, d, s.dayEndHour);
        html += '<div class="card day' + (past ? ' past' : '') + (isToday ? ' today' : '') + ' plain" id="day-' + d + '">' +
          '<div class="day-head"><div><span class="day-name">' + UI.weekdayName(C.weekdayOf(d)) + '</span> <span class="muted small">' + UI.fmtShort(d) + '</span>' +
          (isToday ? ' <span class="tag lamp">' + L('اليوم', 'Today') + '</span>' : '') + '</div>' +
          (!past ? '<button class="icon-btn" data-act="slot-add" data-day="' + d + '" aria-label="' + L('زيد وقت', 'Add a slot') + '">' + UI.icon('plus') + '</button>' : '') + '</div>';
        if (list.length) {
          html += '<div class="slots">' + list.map((sl) => {
            const rg = C.slotRange(sl, s.dayEndHour);
            const state = past || (isToday && rg[1] <= ck.lm) ? 'past' : 'live';
            const used = sessions.some((x) => x.ref === 's:' + sl.id && x.day === d);
            return slotChip(sl, d, state, used);
          }).join('') + '</div>';
        } else if (!past) {
          html += '<p class="small muted" style="margin:0">' + L('فاضي. وهاد كمان منيح.', 'Open. That\'s fine too.') + '</p>';
        }
        html += '</div>';
      }
      if (wk >= cur) html += projectsCard(wk);
      return html;
    },
  };

  /* ---------- slot sheet ---------- */
  function slotForm(o) {
    const s = o.slot;
    const type = s ? s.type : (o.type || 'study');
    const wd = C.weekdayOf(o.day);
    const startDefault = (() => { const h = new Date().getHours() + 1; return C.pad(h % 24) + ':00'; })();
    const start = s ? s.start : (type === 'rest' ? '18:00' : startDefault);
    const end = s ? s.end : C.minToHm((C.hmToMin(start) + 60) % 1440);
    const typeChips = UI.SLOT_TYPES.map((t) => '<label class="chip' + (t === 'rest' ? ' sage' : '') + '"><input type="radio" name="type" value="' + t + '"' + (t === type ? ' checked' : '') + '>' + UI.slotName(t) + '</label>').join('');
    const order = [];
    for (let i = 0; i < 7; i++) order.push((S().weekStart + i) % 7);
    const dayChips = order.map((i) => '<label class="chip"><input type="checkbox" name="wd" value="' + i + '"' + (i === wd ? ' checked' : '') + '>' + UI.weekdayName(i, true) + '</label>').join('');
    return '<h3>' + (s ? L('عدّل الوقت', 'Edit this slot') : L('وقت جديد', 'A new slot')) + '</h3>' +
      '<form data-form="slot-save">' +
      '<input type="hidden" name="id" value="' + (s ? s.id : '') + '"><input type="hidden" name="day" value="' + o.day + '">' +
      '<div class="field"><span>' + L('شو نوعو؟', 'What kind?') + '</span><div class="chips">' + typeChips + '</div></div>' +
      '<label class="field"><span>' + L('اسم (إذا بدك)', 'A name (optional)') + '</span><input name="label" dir="auto" autocomplete="off" value="' + UI.esc(s ? s.label : '') + '" placeholder="' + L('الجيم، كورس الإحصاء، اجتماع الفريق…', 'Gym, stats course, team meeting…') + '"></label>' +
      '<div class="grid2"><label class="field"><span>' + L('من', 'From') + '</span><input type="time" name="start" value="' + start + '" required></label>' +
      '<label class="field"><span>' + L('لـ', 'To') + '</span><input type="time" name="end" value="' + end + '" required></label></div>' +
      (s ? '<p class="small muted">' + (s.date ? L('هالأسبوع بس.', 'This week only.') : T('كل {d}.', 'Every {d}.', { d: UI.weekdayName(s.weekday) })) + '</p>'
        : '<div class="field"><span>' + L('أي أيام؟', 'Which days?') + '</span><div class="chips">' + dayChips + '</div></div>' +
        '<div class="field"><span>' + L('بيتكرر؟', 'Does it repeat?') + '</span><div class="chips">' +
        '<label class="chip"><input type="radio" name="repeat" value="weekly" checked>' + L('كل أسبوع', 'Every week') + '</label>' +
        '<label class="chip"><input type="radio" name="repeat" value="once">' + L('هالأسبوع بس', 'This week only') + '</label></div></div>') +
      '<p class="small" id="slotMsg" style="color:var(--sage);min-height:1.2em"></p>' +
      '<div class="btns stretch"><button class="btn lamp" type="submit">' + L('احفظ', 'Save') + '</button>' +
      (s ? '<button class="btn text" type="button" data-act="slot-delete" data-id="' + s.id + '">' + L('شيلها', 'Remove') + '</button>' : '') + '</div>' +
      '</form>';
  }

  const A = root.Actions;
  // Open a slot's editor, optionally pre-filled with a suggested change (used by the review's pattern notes).
  root.WeekUI = {
    editSlot(id, patch) {
      const s = Store.get('slots', id);
      if (s) UI.sheet.open(() => slotForm({ slot: { ...s, ...(patch || {}) }, day: s.date || root.App.clock().day }));
    },
    addSlot(type) { UI.sheet.open(() => slotForm({ day: root.App.clock().day, type })); },
  };
  A['week-jump'] = (el) => {
    const card = document.getElementById('day-' + el.dataset.day);
    if (card) card.scrollIntoView({ block: 'start', behavior: UI.reducedMotion() ? 'auto' : 'smooth' });
  };
  A['slot-add'] = (el) => UI.sheet.open(() => slotForm({ day: el.dataset.day || root.App.clock().day, type: el.dataset.type }));
  A['slot-edit'] = (el) => {
    const s = Store.get('slots', el.dataset.id);
    if (s) UI.sheet.open(() => slotForm({ slot: s, day: el.dataset.day }));
  };
  root.Forms['slot-save'] = (d) => {
    const msg = document.getElementById('slotMsg');
    const type = d.type || 'other';
    if (!d.start || !d.end || d.start === d.end) { msg.textContent = L('اختار وقت بداية ونهاية.', 'Pick a start and an end time.'); return; }
    const deh = S().dayEndHour;
    const all = Store.all('slots');
    const base = { type, label: (d.label || '').trim(), start: d.start, end: d.end, protected: type === 'rest' };
    let drafts;
    if (d.id) {
      drafts = [{ ...Store.get('slots', d.id), ...base }];
    } else {
      const wds = [].concat(d.wd || []).map(Number);
      if (!wds.length) { msg.textContent = L('اختار يوم واحد عالأقل.', 'Pick at least one day.'); return; }
      const wk = C.weekStartOf(d.day, S().weekStart);
      drafts = wds.map((wd) => {
        const date = C.weekDays(wk).find((k) => C.weekdayOf(k) === wd);
        const x = { id: Store.uid(), ...base, createdAt: new Date().toISOString() };
        if (d.repeat === 'once') x.date = date; else { x.weekday = wd; x.from = wk; }
        return x;
      });
    }
    for (const x of drafts) {
      const hit = C.protectedConflict(all, x, deh);
      if (hit) {
        msg.innerHTML = T('هالوقت محمي. ({l})', 'This time is protected. ({l})', { l: UI.raw(UI.ut(UI.slotLabel(hit))) });
        return;
      }
    }
    UI.sheet.close();
    for (const x of drafts) Store.put('slots', x);
    if (base.protected) UI.toast(L('هالوقت إلك. ما في شغل هون.', 'This time is yours. No work here.'));
  };
  A['slot-delete'] = (el) => {
    const s = Store.get('slots', el.dataset.id);
    if (!s) return;
    UI.sheet.close();
    const cur = root.App.weekKey();
    if (!s.date && s.from && s.from < cur) Store.patch('slots', s.id, { until: C.addDays(cur, -1) });
    else Store.del('slots', s.id);
  };
  A['week-pause'] = (el) => {
    const p = Store.get('projects', el.dataset.id);
    if (!p) return;
    const wk = el.dataset.w;
    Store.patch('projects', p.id, { weekPause: p.weekPause === wk ? null : wk });
  };
})(typeof self !== 'undefined' ? self : this);
