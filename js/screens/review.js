/* Weekly review: one short, kind look back. Not a grade. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  const FACES = [['😔', 'صعب', 'Hard'], ['😕', 'مش كتير', 'Not great'], ['😐', 'عادي', 'Okay'], ['🙂', 'منيح', 'Good'], ['😌', 'حلو', 'Lovely']];
  const SESS = [['most', 'مُعظمها', 'Most of them'], ['half', 'نصها', 'About half'], ['few', 'قليل', 'A few']];
  const BLOCK = [['tired', 'تعب', 'Tiredness'], ['family', 'ضغط عيلة', 'Family pressure'], ['projects', 'مشاريع زيادة', 'Too many projects'], ['sleep', 'نوم', 'Sleep'],
    ['phone', 'موبايل', 'Phone'], ['ill', 'مرض', 'Being ill'], ['none', 'ولا شي', 'Nothing']];
  const BODY = [['yes', 'إي', 'Yes'], ['some', 'شوي', 'Some'], ['no', 'مش هالأسبوع', 'Not this week']];
  // The questions, in order. Body goals join only when the module is on and there are goals.
  function steps() {
    const out = ['overall', 'sessions', 'blockers', 'enjoyed', 'shared'];
    if (S().modules.body && Store.all('goals').length) out.push('body');
    if (notesNow().length) out.push('notice');
    out.push('lighten');
    return out;
  }
  let st = null;

  /* ---------- honest pattern notes: what held for three weeks, and one small change to try ---------- */
  function notesNow() {
    if (!st) return [];
    const s = S(), ck = root.App.clock();
    const handled = st.d.noticed || {};
    const quiet = {};
    for (const k in s.patternQuiet || {}) if (!handled[k]) quiet[k] = s.patternQuiet[k];
    const reviews = Store.all('reviews').filter((r) => r.id !== st.week).concat([{ ...st.d, id: st.week }]);
    return C.patternNotes({ slots: Store.all('slots'), sessions: Store.all('sessions'), reviews, goals: s.modules.body ? Store.all('goals') : [] },
      st.week, { tz: s.tz, dayEndHour: s.dayEndHour, now: { day: ck.day, lm: ck.lm }, quiet }).slice(0, 2);
  }
  const BUCKET_NAME = { morning: ['الصبح', 'morning'], afternoon: ['الضهر', 'afternoon'], evening: ['المسا', 'evening'], night: ['الليل', 'late-night'] };
  const BUCKET_START = { morning: '09:00', afternoon: '14:00', evening: '18:00', night: '22:00' };
  const ORD = { 3: ['للأسبوع التالت', 'For the third week'], 4: ['للأسبوع الرابع', 'For the fourth week'], 5: ['للأسبوع الخامس', 'For the fifth week'] };
  const ord = (n) => L(...(ORD[n] || ['من كم أسبوع', 'For a few weeks now']));
  function firstSlotIn(bucket) {
    return Store.all('slots').find((x) => !x.date && !x.protected && ['study', 'course', 'team', 'other'].includes(x.type) && C.bucketOf(x.start) === bucket);
  }
  function noteBody(n) {
    const b = (k) => L(...BUCKET_NAME[k]);
    const btn = (act, label, cls) => '<button class="btn ' + (cls || 'sm') + '" data-act="rv-note" data-key="' + n.key + '" data-do="' + act + '">' + label + '</button>';
    let text = '', acts = '';
    switch (n.kind) {
      case 'timeOfDay':
        if (n.better) {
          text = T('{o}، جلسات {b} ما عم تصير، بس جلسات {g} عم تصير. نجرب نحطها {g}؟', '{o}, the {b} sessions aren\'t happening, but the {g} ones are. Shall we try moving them to the {g}?', { o: ord(n.weeks), b: b(n.bucket), g: b(n.better) });
          acts = btn('try-move', L('جرّب', 'Try it'), 'soft sm');
        } else {
          text = T('{o}، جلسات {b} ما عم تصير. يمكن الوقت مو مناسب، أو الجلسة طويلة. نجرب وقت تاني، أو جلسة أقصر؟', '{o}, the {b} sessions aren\'t happening. Maybe the time doesn\'t suit, or the session is long. Try another time, or a shorter session?', { o: ord(n.weeks), b: b(n.bucket) });
          acts = btn('try-move', L('غيّر الوقت', 'Change the time'), 'soft sm');
        }
        break;
      case 'slot': {
        const s = Store.get('slots', n.slotId);
        if (!s) return '';
        text = T('{o}، وقت «{l}» يوم {d} {t} ما عم يصير. ننقلو، نشيلو، أو نخليه؟', '{o}, «{l}» on {d} at {t} isn\'t happening. Move it, let it go, or keep it?',
          { o: ord(n.weeks), l: UI.slotLabel(s), d: UI.weekdayName(s.weekday), t: UI.fmtTime(s.start) });
        acts = btn('move-slot', L('انقلو', 'Move it'), 'soft sm') + btn('remove-slot', L('شيلو', 'Let it go'));
        break;
      }
      case 'fewSessions':
        text = T('{o}، قليل من الجلسات المخططة عم يصير. يمكن الخطة أكبر من الأسبوع. نصغّرها شوي؟', '{o}, few of the planned sessions are happening. Maybe the plan is bigger than the week. Make it a little smaller?', { o: ord(n.weeks) });
        acts = btn('open-week', L('افتح الأسبوع', 'Open the week'), 'soft sm');
        break;
      case 'overrides':
        text = T('{o}، عم تكمّل بعد السقف. يمكن الجلسات بدها تكون أقصر، أو الأسبوع الجاي أخف؟', '{o}, you\'ve been going past the ceiling. Maybe shorter sessions, or a lighter next week?', { o: ord(n.weeks) });
        acts = btn('lighter', L('أخف الأسبوع الجاي', 'Lighter next week'), 'soft sm');
        break;
      case 'blocker': {
        const B = {
          sleep: [['النوم عم يعيق. نشغّل تذكير قبل النوم؟', 'sleep has been getting in the way. Turn on a bedtime reminder?'], 'winddown', ['شغّل التذكير', 'Turn it on']],
          phone: [['الموبايل عم يعيق. نجرب أوقات محددة للرسائل؟', 'the phone has been getting in the way. Try set times for messages?'], 'messages', ['شغّل أوقات الرسائل', 'Turn them on']],
          projects: [['المشاريع الزيادة عم تعيق. شي بالخلفية يرتاح أسبوع؟ (بالخطوة الجاية)', 'too many projects have been getting in the way. Let something in the background rest a week? (next step)'], 'ok', ['تمام', 'Okay']],
          tired: [['في تعب. نخلّي الأسبوع الجاي أخف؟', 'there\'s been tiredness. Make next week lighter?'], 'lighter', ['أخف الأسبوع الجاي', 'Lighter next week']],
          ill: [['المرض حاضر. ارتاح، ونخلّي الأسبوع الجاي أخف؟', 'being ill has been there. Rest, and make next week lighter?'], 'lighter', ['أخف الأسبوع الجاي', 'Lighter next week']],
          family: [['ضغط العيلة حاضر. نحط وقت محمي إلك؟', 'family pressure has been there. Add some protected time for you?'], 'rest-slot', ['زيد وقت إلك', 'Add time for you']],
        }[n.blocker];
        text = ord(n.weeks) + L('، ', ', ') + L(...B[0]);
        acts = btn(B[1], L(...B[2]), 'soft sm');
        break;
      }
      case 'bodyGoal': {
        const g = Store.get('goals', n.goalId);
        text = T('{o}، «{g}» ما عم يصير. نخلّيه أصغر؟', '{o}, «{g}» isn\'t happening. Make it smaller?', { o: ord(n.weeks), g: g ? g.text : '' });
        acts = btn('open-body', L('خلّيه أصغر', 'Make it smaller'), 'soft sm');
        break;
      }
      case 'notShared':
        text = T('{o}، ما حكيت شي حقيقي لحدا. شي صغير هالأسبوع: رسالة لحدا قريب؟', '{o}, you haven\'t shared something real with anyone. Something small this week: a message to someone close?', { o: ord(n.weeks) });
        acts = btn('ok', L('تمام', 'Okay'), 'soft sm');
        break;
      default:
        return '';
    }
    const done = (st.d.noticed || {})[n.key];
    return '<div class="card plain" style="margin-bottom:10px"><p style="line-height:1.9">' + text + '</p>' +
      (done ? '<p class="small" style="color:var(--sage);margin:0">' + (done === 'kept' ? L('تمام، خليناها هيك.', 'Okay, we\'ll leave it.') : L('تمام، منجرّب.', 'Okay, we\'ll try.')) + '</p>'
        : '<div class="btns">' + acts + btn('keep', L('خليها هيك', 'Leave it as it is'), 'text sm') + '</div>') + '</div>';
  }

  function blank(week) {
    const ex = Store.get('reviews', week);
    return {
      week, step: 0, done: false,
      d: ex ? { body: {}, noticed: {}, ...JSON.parse(JSON.stringify(ex)) } : { id: week, overall: null, sessions: null, blockers: [], blockerOther: '', enjoyed: '', shared: null, sharedNote: '', body: {}, noticed: {}, pauseNext: [], lighter: false, note: '' },
    };
  }
  const range = (wk) => UI.fmtShort(wk) + ' – ' + UI.fmtShort(C.addDays(wk, 6));

  function capture() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
    const d = st.d;
    if (v('rvOther') != null) d.blockerOther = v('rvOther');
    if (v('rvEnjoyed') != null) d.enjoyed = v('rvEnjoyed');
    if (v('rvShared') != null) d.sharedNote = v('rvShared');
    if (v('rvNote') != null) d.note = v('rvNote');
  }

  function stepView() {
    const d = st.d;
    const list = steps();
    const total = list.length;
    const dots = '<div class="steps">' + Array.from({ length: total }, (_, i) => '<i class="' + (i < st.step ? 'on' : '') + '"></i>').join('') + '</div>';
    const nav = (canSkip) => '<div class="btns" style="justify-content:space-between;margin-top:20px">' +
      '<button class="btn text" data-act="rv-back">' + L('رجوع', 'Back') + '</button>' +
      '<div class="btns">' + (canSkip ? '<button class="btn text" data-act="rv-next">' + L('تخطّى', 'Skip') + '</button>' : '') +
      '<button class="btn lamp" data-act="rv-next">' + (st.step === total ? L('خلصت', 'Finish') : L('التالي', 'Next')) + '</button></div></div>';
    const q = (ar, en) => '<h2 class="display" style="font-size:24px;line-height:1.6;margin:0 0 14px">' + L(ar, en) + '</h2>';
    switch (list[st.step - 1]) {
      case 'notice':
        return dots + q('شي لاحظتو', 'Something I noticed') +
          '<p class="small muted">' + L('مو حكم، بس ملاحظة. وانت بتقرر.', 'Not a verdict, just a noticing. You decide.') + '</p>' +
          notesNow().map(noteBody).join('') + nav(true);
      case 'body': {
        const days = new Set(C.weekDays(st.week));
        const sess = Store.all('bodySessions').filter((s) => days.has(s.date)).map((s) => ({ id: s.date }));
        const goals = Store.all('goals').sort((a, b) => ((a.kind || 'move') < (b.kind || 'move') ? -1 : a.createdAt < b.createdAt ? -1 : 1));
        return dots + q('جسمك هالأسبوع؟', 'Your body this week?') + '<p class="small muted">' + L('بلا حساب، بس نظرة.', 'No counting, just a look.') + '</p>' +
          UI.weekDots(C.weekPresence(sess, st.week), st.week) +
          goals.map((g) => '<div class="field" style="margin-top:14px"><span>' + UI.ut(g.text) + '</span><div class="chips">' + BODY.map((b) =>
            '<button class="chip sage" data-act="rv-body" data-g="' + g.id + '" data-v="' + b[0] + '" aria-pressed="' + (d.body[g.id] === b[0]) + '">' + L(b[1], b[2]) + '</button>').join('') + '</div></div>').join('') + nav(true);
      }
      case 'overall':
        return dots + q('كيف كان الأسبوع بشكل عام؟', 'How was the week overall?') +
          '<div class="faces">' + FACES.map((f, i) => '<button class="face" data-act="rv-pick" data-k="overall" data-v="' + (i + 1) + '" aria-pressed="' + (d.overall === i + 1) + '" aria-label="' + L(f[1], f[2]) + '">' + f[0] + '</button>').join('') + '</div>' + nav(true);
      case 'sessions':
        return dots + q('الجلسات المخططة… صارت؟', 'The planned sessions… did they happen?') +
          '<div class="chips">' + SESS.map((s) => '<button class="chip" data-act="rv-pick" data-k="sessions" data-v="' + s[0] + '" aria-pressed="' + (d.sessions === s[0]) + '">' + L(s[1], s[2]) + '</button>').join('') + '</div>' +
          '<p class="small muted" style="margin-top:12px">' + L('أي جواب منيح. هاد بس لتعرف شو بيناسبك.', 'Any answer is fine. It\'s only so you learn what suits you.') + '</p>' + nav(true);
      case 'blockers':
        return dots + q('شو عاق الشغل؟', 'What got in the way?') + '<p class="small muted">' + L('إذا في شي. فيك تختار أكتر من وحدة.', 'If anything. You can pick more than one.') + '</p>' +
          '<div class="chips">' + BLOCK.map((b) => '<button class="chip" data-act="rv-toggle" data-v="' + b[0] + '" aria-pressed="' + d.blockers.includes(b[0]) + '">' + L(b[1], b[2]) + '</button>').join('') + '</div>' +
          '<label class="field" style="margin-top:12px"><span>' + L('غير شي؟', 'Something else?') + '</span><input id="rvOther" dir="auto" autocomplete="off" value="' + UI.esc(d.blockerOther) + '"></label>' + nav(true);
      case 'enjoyed':
        return dots + q('شو الشي يلي انبسطت فيه؟', 'What did you enjoy?') +
          '<textarea class="input" id="rvEnjoyed" dir="auto" placeholder="' + L('ولو شي صغير…', 'Even something small…') + '">' + UI.esc(d.enjoyed) + '</textarea>' + nav(true);
      case 'shared':
        return dots + q('حكيت شي حقيقي لحدا هالأسبوع؟', 'Did you share something real with someone this week?') +
          '<div class="chips"><button class="chip" data-act="rv-pick" data-k="shared" data-v="yes" aria-pressed="' + (d.shared === 'yes') + '">' + L('إي', 'Yes') + '</button>' +
          '<button class="chip" data-act="rv-pick" data-k="shared" data-v="no" aria-pressed="' + (d.shared === 'no') + '">' + L('لأ', 'No') + '</button></div>' +
          '<label class="field" style="margin-top:12px"><span>' + L('مع مين، أو عن شو؟ (إذا بدك)', 'With whom, or about what? (optional)') + '</span><input id="rvShared" dir="auto" autocomplete="off" value="' + UI.esc(d.sharedNote) + '"></label>' +
          (d.shared === 'no' ? '<p class="small muted">' + L('عادي. يمكن الأسبوع الجاي، لحدا قريب.', 'That\'s okay. Maybe next week, with someone close.') + '</p>' : '') + nav(true);
      case 'lighten': {
        const bg = Store.all('projects').filter((p) => p.status === 'active' && p.tier === 'background');
        const sleepLine = S().modules.sleep && root.Sleep ? root.Sleep.weekLine(st.week) : '';
        const radar = root.Radar && root.Radar.state().show;
        return dots + q('بالأسبوع الجاي: شو بدو يخف؟', 'Next week: what could be lighter?') +
          (radar ? '<div class="card radar plain"><p>' + L('في علامات تعب هالفترة. يمكن الأسبوع الجاي يكون أخف شوي.', 'There are signs of tiredness lately. Maybe next week can be a little lighter.') + '</p></div>' : '') +
          (sleepLine ? '<p class="small muted">' + sleepLine + '</p>' : '') +
          (bg.length ? '<div class="field"><span>' + L('شي بالخلفية يرتاح أسبوع؟', 'Something in the background could rest a week?') + '</span><div class="chips">' +
            bg.map((p) => '<button class="chip sage" data-act="rv-pause" data-v="' + p.id + '" aria-pressed="' + d.pauseNext.includes(p.id) + '">' + UI.ut(p.name) + '</button>').join('') + '</div></div>' : '') +
          '<label class="switch"><span>' + L('خلّي السقوف أخف الأسبوع الجاي', 'Lower the ceilings next week') + '</span><input type="checkbox" data-change="rv-lighter"' + (d.lighter ? ' checked' : '') + '></label>' +
          '<label class="field" style="margin-top:8px"><span>' + L('غير شي؟', 'Anything else?') + '</span><textarea class="input" id="rvNote" dir="auto">' + UI.esc(d.note) + '</textarea></label>' + nav(false);
      }
      default:
        return '';
    }
  }

  // The week's wins as a few stars (never a number). Nothing at all when there were none.
  function weekSky(wk) {
    const days = new Set(C.weekDays(wk));
    const wins = Store.all('wins').filter((w) => days.has(w.date));
    if (!wins.length) return '';
    const sky = C.skyLayout(wins, 300);
    const top = sky.months[0].y + 24, h = Math.max(70, sky.height - top - 10);
    let svg = '<svg viewBox="0 ' + top + ' 300 ' + h + '" aria-hidden="true">';
    for (const [a, b] of sky.lines) svg += '<line class="cline" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
    for (const s of sky.stars) svg += '<circle class="star twk" cx="' + s.x + '" cy="' + s.y + '" r="' + (s.size + 0.4) + '" style="animation-delay:' + s.tw + 's"/>';
    return '<p class="small muted" style="margin:14px 0 6px">' + L('نجوم هالأسبوع', 'This week\'s stars') + '</p><div class="skybox" style="max-width:320px;margin:0 auto">' + svg + '</svg></div>';
  }

  function opener(wk) {
    const ex = Store.get('reviews', wk);
    return '<div class="center" style="padding:18px 4px 0">' + UI.wave() +
      '<h2 class="greet" style="font-size:28px">' + L('كيف كان أسبوعك؟', 'How was your week?') + '</h2>' +
      '<p class="muted">' + L('مو تقييم، بس نظرة سريعة.', 'Not a grade, just a quick look.') + '</p>' +
      '<p class="small muted">' + range(wk) + '</p>' + weekSky(wk) +
      (ex && ex.doneAt ? '<p class="small">' + L('عملتها هالأسبوع. فيك تعدّل إذا حبيت.', 'You did it this week. You can edit it if you like.') + '</p>' : '') +
      '<button class="btn lamp big" style="margin-top:12px" data-act="rv-next">' + (ex && ex.doneAt ? L('عدّل', 'Edit') : L('يلا', 'Let\'s go')) + '</button>' +
      '<div style="margin-top:22px"><a class="small" href="#/more/reviews">' + L('المراجعات القديمة', 'Past reviews') + '</a></div></div>';
  }

  function doneView() {
    return '<div class="center" style="padding-top:40px">' +
      '<div style="display:flex;justify-content:center;gap:8px;margin-bottom:12px">' + UI.jasmine() + UI.jasmine() + '</div>' +
      '<h2 class="greet">' + L('أسبوع جديد، صفحة جديدة.', 'New week, clean page.') + '</h2>' +
      '<p>' + L('ما في شي متراكم.', 'Nothing carries over.') + '</p>' +
      '<a class="btn lamp big" style="margin-top:16px" href="#/today">' + L('تمام', 'Okay') + '</a></div>';
  }

  root.Screens.review = {
    title: () => L('المراجعة', 'Weekly review'),
    render() {
      const ck = root.App.clock();
      const wk = C.reviewTarget(ck, S()) || C.reviewWeekManual(ck, S());
      if (!st || (st.week !== wk && !st.done)) st = blank(wk);
      if (st.done) return doneView();
      if (st.step === 0) return opener(st.week);
      return stepView();
    },
  };

  function save() {
    const d = st.d;
    const next = C.addDays(st.week, 7);
    const rec = { ...d, id: st.week, doneAt: new Date().toISOString() };
    Store.put('reviews', rec);
    for (const id of d.pauseNext) Store.patch('projects', id, { weekPause: next });
    if (d.lighter) Store.setSettings({ lighterWeek: next });
    else if (S().lighterWeek === next) Store.setSettings({ lighterWeek: null });
  }

  const A = root.Actions;
  A['rv-next'] = () => {
    capture();
    if (st.step >= steps().length) {
      save();
      if (root.Obsidian) root.Obsidian.afterReview();
      st.done = true;
      root.App.render();
      UI.brighten();
      UI.petals(10);
      return;
    }
    st.step++;
    root.App.render();
    root.scrollTo(0, 0);
  };
  A['rv-back'] = () => { capture(); st.step = Math.max(0, st.step - 1); root.App.render(); };
  A['rv-pick'] = (el) => {
    capture();
    const k = el.dataset.k;
    const v = k === 'overall' ? Number(el.dataset.v) : el.dataset.v;
    st.d[k] = st.d[k] === v ? null : v;
    root.App.render();
    if ((k === 'overall' || k === 'sessions') && st.d[k] != null) {
      const at = st.step;
      setTimeout(() => { if (st && st.step === at && !st.done) { st.step++; root.App.render(); } }, 420);
    }
  };
  A['rv-toggle'] = (el) => {
    capture();
    const v = el.dataset.v, b = st.d.blockers;
    if (v === 'none') st.d.blockers = b.includes('none') ? [] : ['none'];
    else st.d.blockers = b.includes(v) ? b.filter((x) => x !== v) : b.filter((x) => x !== 'none').concat(v);
    root.App.render();
  };
  A['rv-pause'] = (el) => {
    capture();
    const v = el.dataset.v, p = st.d.pauseNext;
    st.d.pauseNext = p.includes(v) ? p.filter((x) => x !== v) : p.concat(v);
    root.App.render();
  };
  root.Changes['rv-lighter'] = (el) => { capture(); st.d.lighter = el.checked; };
  A['rv-note'] = (el) => {
    const key = el.dataset.key, what = el.dataset.do;
    const n = notesNow().find((x) => x.key === key);
    if (!n) return;
    st.d.noticed = { ...(st.d.noticed || {}), [key]: what === 'keep' ? 'kept' : 'tried' };
    const S2 = S();
    if (what === 'keep') {
      Store.setSettings({ patternQuiet: { ...(S2.patternQuiet || {}), [key]: C.addDays(st.week, 21) } });
    } else if (what === 'try-move' || what === 'move-slot') {
      const slot = n.kind === 'slot' ? Store.get('slots', n.slotId) : firstSlotIn(n.bucket);
      if (slot) {
        const r = C.slotRange(slot, S2.dayEndHour), dur = r[1] - r[0];
        const start = n.better ? BUCKET_START[n.better] : slot.start;
        root.WeekUI.editSlot(slot.id, n.better ? { start, end: C.minToHm((C.hmToMin(start) + dur) % 1440) } : null);
      }
    } else if (what === 'remove-slot') {
      Store.patch('slots', n.slotId, { until: C.addDays(st.week, 6) });
      UI.toast(L('تمام، من الأسبوع الجاي ما في هالوقت.', 'Okay, from next week this slot is gone.'));
    } else if (what === 'lighter') {
      st.d.lighter = true;
    } else if (what === 'winddown') {
      Store.setSettings({ sleep: { ...S2.sleep, windDown: true } });
    } else if (what === 'messages') {
      Store.setSettings({ messageWindows: { ...S2.messageWindows, enabled: true } });
    } else if (what === 'rest-slot') {
      root.WeekUI.addSlot('rest');
    } else if (what === 'open-week') {
      UI.go('week'); return;
    } else if (what === 'open-body') {
      UI.go('more/body'); return;
    }
    root.App.render();
  };
  A['rv-body'] = (el) => {
    const g = el.dataset.g, v = el.dataset.v;
    st.d.body = { ...(st.d.body || {}), [g]: st.d.body && st.d.body[g] === v ? null : v };
    root.App.render();
  };
  root.addEventListener('hashchange', () => { const r = UI.route(); if (!(r.parts[0] === 'more' && r.parts[1] === 'review') && st && st.done) st = null; });

  /* ---------- past reviews ---------- */
  function trendSvg(points) {
    if (points.length < 2) return '';
    const w = 320, h = 80, pad = 10;
    const xs = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
    const ys = (v) => pad + ((5 - v) / 4) * (h - pad * 2);
    let d = '';
    points.forEach((p, i) => {
      const x = xs(i), y = ys(p.value);
      if (!i) d = 'M' + x + ' ' + y;
      else { const px = xs(i - 1), py = ys(points[i - 1].value), cx = (px + x) / 2; d += ' C' + cx + ' ' + py + ' ' + cx + ' ' + y + ' ' + x + ' ' + y; }
    });
    return '<div class="card plain"><div class="muted small">' + L('شعورك بالأسابيع، شهر بشهر', 'How the weeks felt, month by month') + '</div>' +
      '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="' + d + '"/></svg>' +
      '<div class="btns tiny muted" style="justify-content:space-between"><span>' + UI.fmtMonth(points[0].month) + '</span><span>' + UI.fmtMonth(points[points.length - 1].month) + '</span></div></div>';
  }

  root.Screens.reviews = {
    title: () => L('المراجعات القديمة', 'Past reviews'),
    backTo: 'more/review',
    render() {
      const rs = Store.all('reviews').filter((r) => r.doneAt).sort((a, b) => (a.id < b.id ? 1 : -1));
      if (!rs.length) return '<div class="card">' + UI.empty('jasmine', L('لما تعمل أول مراجعة، رح تلاقيها هون.', 'After your first review, you\'ll find it here.')) + '</div>';
      let html = trendSvg(C.monthlyTrend(rs));
      for (const r of rs) {
        const f = r.overall ? FACES[r.overall - 1] : null;
        const s = SESS.find((x) => x[0] === r.sessions);
        html += '<div class="card plain"><div class="card-head"><div class="muted small">' + range(r.id) + '</div>' + (f ? '<span style="font-size:22px" aria-label="' + L(f[1], f[2]) + '">' + f[0] + '</span>' : '') + '</div>' +
          (r.enjoyed ? '<p style="margin-top:6px">' + UI.ut(r.enjoyed) + '</p>' : '') +
          '<p class="small muted">' + [s ? L(s[1], s[2]) : '', r.shared === 'yes' ? L('حكيت شي حقيقي لحدا', 'Shared something real') : ''].filter(Boolean).join(' · ') + '</p></div>';
      }
      return html;
    },
  };
})(typeof self !== 'undefined' ? self : this);
