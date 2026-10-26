/* Body: process goals checked weekly, sessions logged, weight optional and weekly only. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;
  const nowIso = () => new Date().toISOString();

  const TYPES = { cardio: ['كارديو', 'Cardio'], weights: ['حديد', 'Weights'], walk: ['مشي', 'Walk'], other: ['غير شي', 'Other'] };
  const typeName = (t) => L(...(TYPES[t] || TYPES.other));

  function goalsCard(kind) {
    const goals = Store.all('goals').filter((g) => (g.kind || 'move') === kind).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const ph = kind === 'move' ? L('مثلاً: كارديو ٣ مرات بالأسبوع، مشي بعد العشا', 'e.g. cardio 3 times a week, a walk after dinner') : L('مثلاً: مشروبات سكرية أقل', 'e.g. fewer sugary drinks');
    return '<div class="card plain">' + (goals.length ? '<div class="rows">' + goals.map((g) => '<div class="row"><div class="row-main">' + UI.ut(g.text) +
      (g.weeklyTarget ? ' <span class="tag">' + T('{n} بالأسبوع', '{n} a week', { n: UI.n(g.weeklyTarget) }) + '</span>' : '') + '</div>' +
      '<button class="icon-btn" data-act="goal-del" data-id="' + g.id + '" aria-label="' + L('شيل', 'Remove') + '">' + UI.icon('close') + '</button></div>').join('') + '</div>' : '') +
      '<form class="inline-form" data-form="goal-add" style="margin-top:8px"><input type="hidden" name="kind" value="' + kind + '">' +
      '<input class="input" id="goal-' + kind + '" name="text" dir="auto" autocomplete="off" placeholder="' + ph + '">' +
      (kind === 'move' ? '<select class="input" name="weeklyTarget" style="max-width:76px" aria-label="' + L('كم مرة بالأسبوع', 'Times a week') + '"><option value="">–</option>' + [1, 2, 3, 4, 5, 6, 7].map((n) => '<option value="' + n + '">' + UI.n(n) + '</option>').join('') + '</select>' : '') +
      '<button class="btn soft">' + L('زيد', 'Add') + '</button></form></div>';
  }

  function sessionsCard() {
    const wk = root.App.weekKey();
    const days = new Set(C.weekDays(wk));
    const list = Store.all('bodySessions').filter((s) => days.has(s.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const chip = (name, val, cur, label) => '<label class="chip"><input type="radio" name="' + name + '" value="' + val + '"' + (val === cur ? ' checked' : '') + '>' + label + '</label>';
    return '<div class="card plain">' + UI.weekDots(C.weekPresence(list.map((s) => ({ id: s.date })), wk), wk) +
      (list.length ? '<div class="rows" style="margin-top:10px">' + list.map((s) => '<div class="row"><div class="row-main"><div>' + typeName(s.type) + ' · ' + UI.fmtDur(s.minutes) + '</div>' +
        '<div class="row-sub">' + UI.weekdayName(C.weekdayOf(s.date)) + (s.withWhom ? ' · ' + T('مع {w}', 'with {w}', { w: UI.raw(UI.ut(s.withWhom)) }) : '') + '</div></div>' +
        '<button class="icon-btn" data-act="bsess-del" data-id="' + s.id + '" aria-label="' + L('امسح', 'Delete') + '">' + UI.icon('close') + '</button></div>').join('') + '</div>' : '') +
      '<form data-form="bsess-add" style="margin-top:12px"><div class="chips">' + Object.keys(TYPES).map((t) => chip('type', t, 'cardio', typeName(t))).join('') + '</div>' +
      '<div class="grid2" style="margin-top:10px"><select class="input" name="minutes">' + [15, 20, 30, 45, 60, 90].map((m) => '<option value="' + m + '"' + (m === 30 ? ' selected' : '') + '>' + UI.fmtDur(m) + '</option>').join('') + '</select>' +
      '<input class="input" id="bsWho" name="withWhom" dir="auto" autocomplete="off" placeholder="' + L('مع مين؟', 'With whom?') + '"></div>' +
      '<button class="btn soft block" style="margin-top:10px">' + L('سجّلها', 'Log it') + '</button></form></div>';
  }

  function weightCard() {
    const b = S().body;
    if (!b.weightOn) {
      return '<div class="card plain"><label class="switch"><span>' + L('تتبّع الوزن', 'Track weight') +
        '<br><span class="small muted">' + L('مطفي من الأساس. مرة بالأسبوع بس، والاتجاه أهم من الرقم.', 'Off by default. Once a week only, and the direction matters more than the number.') + '</span></span>' +
        '<input type="checkbox" data-change="body-set" data-k="weightOn"></label></div>';
    }
    const wk = root.App.weekKey();
    const ws = Store.all('weighIns');
    const ma = C.movingAvg(ws, 4);
    const trend = C.weightTrend(ma);
    const trendText = { down: L('نازل شوي', 'easing down'), flat: L('ثابت تقريباً', 'about steady'), up: L('طالع شوي', 'creeping up') }[trend];
    const mine = ws.find((w) => w.id === wk);
    let html = '<div class="card plain">';
    if (C.canWeighIn(ws, wk)) {
      html += '<form class="inline-form" data-form="weigh-add"><input class="input" type="number" step="0.1" min="30" max="250" name="kg" inputmode="decimal" placeholder="' + L('وزن هالأسبوع (كغ)', 'This week\'s weight (kg)') + '" dir="ltr"><button class="btn soft">' + L('سجّل', 'Log') + '</button></form>';
    } else {
      html += '<p class="small">' + L('سجّلت هالأسبوع. الأسبوع الجاي منشوف.', 'Logged for this week. Next week, we\'ll see.') + '</p>' +
        (b.hideNumber ? '' : '<p class="small muted">' + T('هالأسبوع: {k} كغ', 'This week: {k} kg', { k: UI.n(mine.kg) }) + ' <button class="btn text sm" data-act="weigh-fix">' + L('صحّح الرقم', 'Correct it') + '</button></p>');
    }
    if (ma.length >= 2) {
      html += '<div class="muted small" style="margin-top:10px">' + L('المعدّل على ٤ أسابيع', 'The 4-week average') + (trendText ? ': ' + trendText : '') + '</div>';
      if (!b.hideNumber) html += UI.softLine(ma.map((p) => p.avg), { cls: 'sage', h: 70 }) + '<div class="btns tiny muted" style="justify-content:space-between"><span>' + UI.n(ma[0].avg) + '</span><span>' + UI.n(ma[ma.length - 1].avg) + '</span></div>';
    }
    html += '<label class="switch"><span>' + L('خبّي الرقم، ورجيني الاتجاه بس', 'Hide the number, show only the direction') + '</span><input type="checkbox" data-change="body-set" data-k="hideNumber"' + (b.hideNumber ? ' checked' : '') + '></label>';
    html += '<details class="fold"><summary>' + L('هدف (إذا بدك)', 'A target (optional)') + '</summary>' +
      '<form data-form="weigh-target"><div class="grid2"><label class="field"><span>' + L('الوزن', 'Weight') + '</span><input type="number" step="0.1" name="kg" dir="ltr" value="' + (b.targetKg || '') + '"></label>' +
      '<label class="field"><span>' + L('لتاريخ', 'By') + '</span><input type="date" name="by" value="' + (b.targetBy || '') + '"></label></div>' +
      '<button class="btn soft sm">' + L('احفظ', 'Save') + '</button></form>' + paceNote() + '</details>';
    html += '<label class="switch"><span class="small muted">' + L('طفّي تتبّع الوزن', 'Turn weight tracking off') + '</span><input type="checkbox" data-change="body-set" data-k="weightOn" checked></label>';
    return html + '</div>';
  }

  function paceNote() {
    const b = S().body;
    const ma = C.movingAvg(Store.all('weighIns'), 4);
    if (!b.targetKg || !b.targetBy || !ma.length) return '';
    const pace = C.weeklyPace(ma[ma.length - 1].avg, b.targetKg, root.App.clock().day, b.targetBy);
    if (pace <= 1) return '<p class="small muted">' + L('وتيرة هادية ومعقولة.', 'A calm, reasonable pace.') + '</p>';
    return '<p class="small" style="color:var(--sage)">' + L('هاد أسرع من كيلو بالأسبوع. الأبطأ بيدوم أكتر، ومنيح تسأل دكتور قبل.', 'That\'s faster than a kilo a week. Slower lasts longer, and it\'s worth asking a doctor first.') + '</p>';
  }

  root.Screens.body = {
    title: () => L('الجسم', 'Body'),
    render() {
      return '<p class="muted small">' + L('عادات بتمشي معك، مو أرقام بتلاحقك. منشوفها بالمراجعة الأسبوعية، مو كل يوم.', 'Habits that walk with you, not numbers that chase you. We look at them in the weekly review, not every day.') + '</p>' +
        '<div class="sec-title">' + L('أهدافك بالأسبوع', 'Your weekly goals') + '</div>' + goalsCard('move') +
        '<div class="sec-title">' + L('حركة هالأسبوع', 'Movement this week') + '</div>' + sessionsCard() +
        '<div class="sec-title">' + L('عادات الأكل', 'Food habits') + '</div>' + goalsCard('food') +
        '<div class="sec-title">' + L('الوزن', 'Weight') + '</div>' + weightCard();
    },
  };

  const A = root.Actions, F = root.Forms, Ch = root.Changes;
  F['goal-add'] = (d, f) => {
    const text = (d.text || '').trim();
    if (!text) return;
    f.reset();
    Store.put('goals', { id: Store.uid(), kind: d.kind || 'move', text, weeklyTarget: d.weeklyTarget ? Number(d.weeklyTarget) : null, createdAt: nowIso() });
  };
  A['goal-del'] = (el) => UI.removeWithUndo([['goals', el.dataset.id]]);
  F['bsess-add'] = (d, f) => {
    f.reset();
    Store.put('bodySessions', { id: Store.uid(), date: root.App.clock().day, type: d.type || 'other', minutes: Number(d.minutes || 30), withWhom: (d.withWhom || '').trim(), createdAt: nowIso() });
    UI.toast(L('حلو. جسمك بيشكرك.', 'Nice. Your body thanks you.'));
  };
  A['bsess-del'] = (el) => UI.removeWithUndo([['bodySessions', el.dataset.id]]);
  Ch['body-set'] = (el) => Store.setSettings({ body: { ...S().body, [el.dataset.k]: el.checked } });
  F['weigh-add'] = (d) => {
    const kg = Number(d.kg);
    if (!kg) return;
    const wk = root.App.weekKey();
    if (!C.canWeighIn(Store.all('weighIns'), wk)) { UI.toast(L('سجّلت هالأسبوع. الأسبوع الجاي منشوف.', 'Logged for this week. Next week, we\'ll see.')); return; }
    Store.put('weighIns', { id: wk, kg: Math.round(kg * 10) / 10, at: nowIso() });
  };
  A['weigh-fix'] = () => {
    const wk = root.App.weekKey(), w = Store.get('weighIns', wk);
    if (!w) return;
    UI.sheet.open(() => '<h3>' + L('صحّح رقم هالأسبوع', 'Correct this week\'s number') + '</h3><form class="inline-form" data-form="weigh-fix"><input class="input" type="number" step="0.1" name="kg" dir="ltr" value="' + w.kg + '" autofocus><button class="btn soft">' + L('احفظ', 'Save') + '</button></form>');
  };
  F['weigh-fix'] = (d) => { UI.sheet.close(); const kg = Number(d.kg); if (kg) Store.patch('weighIns', root.App.weekKey(), { kg: Math.round(kg * 10) / 10 }); };
  F['weigh-target'] = (d) => Store.setSettings({ body: { ...S().body, targetKg: d.kg ? Number(d.kg) : null, targetBy: d.by || null } });

  root.Body = { TYPES, typeName };
})(typeof self !== 'undefined' ? self : this);
