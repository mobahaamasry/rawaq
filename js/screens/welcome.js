/* Welcome: a calm first meeting. Shown once on first launch; again from About. Everything here can change later. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L } = UI;
  const S = () => Store.settings;
  let el = null, step = 0;
  const LAST = 4;

  function stepHtml() {
    const s = S();
    const dots = '<div class="steps">' + Array.from({ length: LAST + 1 }, (_, i) => '<i class="' + (i <= step ? 'on' : '') + '"></i>').join('') + '</div>';
    const next = (label) => '<button class="btn lamp big block" data-act="wl-next">' + label + '</button>';
    switch (step) {
      case 0:
        return '<div style="width:88px;margin:4vh auto 8px">' + UI.mark() + '</div>' +
          '<h2 class="greet center" style="font-size:34px">' + L('أهلين بـ رواق', 'Welcome to Rawaq') + '</h2>' +
          '<p class="center muted">' + L('رواق يعني على مهلك. هون ما في سباق.', 'Rawaq means calm, unhurried. There is no race here.') + '</p>' +
          '<div class="card plain" style="margin:18px 0">' +
          '<div class="row"><span style="width:26px;flex:none;color:var(--lamp)">' + UI.moon(1) + '</span><div class="row-main">' + L('سقوف، مو بس أهداف. لما توصل، رواق بيقلك وقّف بلطف.', 'Ceilings, not only goals. When you reach one, Rawaq gently says stop.') + '</div></div>' +
          '<div class="row"><span style="width:26px;flex:none">' + UI.jasmine() + '</span><div class="row-main">' + L('ما في دين. كل أسبوع صفحة جديدة، وما في شي متراكم.', 'No debt. Every week is a clean page; nothing piles up.') + '</div></div>' +
          '<div class="row"><span style="width:26px;flex:none;color:var(--teal)">' + UI.icon('play') + '</span><div class="row-main">' + L('بدايات صغيرة. ابدأ ١٠ دقايق بس.', 'Small starts. Just start for 10 minutes.') + '</div></div></div>' +
          next(L('يلا', 'Let\'s go'));
      case 1:
        return dots + '<h2 class="display" style="font-size:26px">' + L('شو بحب ناديك؟', 'What should I call you?') + '</h2>' +
          '<input class="input" id="wlName" dir="auto" autocomplete="off" value="' + UI.esc(s.name) + '" style="margin:8px 0 18px">' +
          '<div class="field"><span>' + L('اللغة', 'Language') + '</span><div class="chips">' +
          '<button class="chip" data-act="wl-lang" data-v="ar" aria-pressed="' + (s.lang !== 'en') + '">العربي</button>' +
          '<button class="chip" data-act="wl-lang" data-v="en" aria-pressed="' + (s.lang === 'en') + '">English</button></div></div>' + next(L('التالي', 'Next'));
      case 2:
        return dots + '<h2 class="display" style="font-size:26px">' + L('إمتى بيخلص يومك؟', 'When does your day end?') + '</h2>' +
          '<p class="muted small">' + L('إذا بتسهر، اليوم بيضل يومك لهالساعة. يعني الساعة ٢ بالليل لسا "اليوم".', 'If you stay up late, the day stays yours until this hour. So 2 AM still counts as "today".') + '</p>' +
          '<select class="input" id="wlDayEnd" style="margin:8px 0 18px">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => '<option value="' + h + '"' + (h === s.dayEndHour ? ' selected' : '') + '>' + UI.fmtTime(C.pad(h) + ':00') + '</option>').join('') + '</select>' +
          next(L('التالي', 'Next'));
      case 3: {
        const sw = (k, ar, en) => '<label class="switch"><span>' + L(ar, en) + '</span><input type="checkbox" data-change="wl-mod" data-k="' + k + '"' + (s.modules[k] ? ' checked' : '') + '></label>';
        return dots + '<h2 class="display" style="font-size:26px">' + L('شو بدك يكون معك؟', 'What would you like with you?') + '</h2>' +
          '<p class="muted small">' + L('فيك تغيّر هالشي بأي وقت من الإعدادات.', 'You can change this any time in Settings.') + '</p><div class="card plain" style="margin:8px 0 18px">' +
          sw('curiosity', 'رف الفضول: أشيا بتحبها لحالها', 'Curiosity shelf: things you love for their own sake') +
          sw('body', 'الجسم: عادات بالأسبوع، مو أرقام', 'Body: weekly habits, not numbers') +
          sw('sleep', 'النوم: سجل خفيف', 'Sleep: a light log') +
          sw('faith', 'الإيمان: للرجعة، مو للحساب', 'Faith: for coming back, not for counting') +
          sw('connection', 'قريبين: سؤال لطيف مرة بالأسبوع', 'Close ones: one gentle question a week') + '</div>' +
          next(L('التالي', 'Next'));
      }
      default:
        return '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center;gap:10px">' +
          '<div style="display:flex;justify-content:center;gap:8px">' + UI.jasmine() + UI.jasmine() + UI.jasmine() + '</div>' +
          '<h2 class="greet" style="font-size:32px">' + L('تمام. على مهلك.', 'Done. Take it slowly.') + '</h2>' +
          '<p class="muted">' + L('أول شي: كيف الطاقة اليوم؟', 'First thing: how is your energy today?') + '</p></div>' +
          next(L('يلا', 'Let\'s go'));
    }
  }

  function paint() {
    if (!el) return;
    el.innerHTML = '<div class="overlay-inner" style="max-width:460px"><div class="top">' +
      (step < LAST ? '<button class="btn text" data-act="wl-skip">' + L('بعدين', 'Later') + '</button>' : '') + '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;padding-bottom:12px">' + stepHtml() + '</div></div>';
  }
  function save() {
    const n = document.getElementById('wlName');
    if (n && n.value.trim()) Store.setSettings({ name: n.value.trim() });
    const d = document.getElementById('wlDayEnd');
    if (d) Store.setSettings({ dayEndHour: Number(d.value) });
  }

  const Welcome = {
    isOpen: () => !!el,
    open() {
      if (el) return;
      step = 0;
      el = document.createElement('div');
      el.className = 'overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      document.getElementById('overlayRoot').appendChild(el);
      paint();
      requestAnimationFrame(() => el && el.classList.add('on'));
    },
    close() {
      Store.put('meta', { id: 'welcome', at: new Date().toISOString() });
      if (!el) return;
      const e = el;
      el = null;
      e.classList.remove('on');
      setTimeout(() => e.remove(), 500);
    },
  };
  root.addEventListener('rawaq:ready', () => { if (!Store.get('meta', 'welcome')) Welcome.open(); });

  const A = root.Actions;
  A['wl-next'] = () => {
    save();
    if (step >= LAST) { Welcome.close(); UI.petals(10); root.App.render(); return; }
    step++;
    paint();
  };
  A['wl-skip'] = () => { save(); Welcome.close(); };
  A['wl-lang'] = (b) => { save(); Store.setSettings({ lang: b.dataset.v }); setTimeout(paint, 0); };
  A['welcome-open'] = () => Welcome.open();
  root.Changes['wl-mod'] = (c) => Store.setSettings({ modules: { ...S().modules, [c.dataset.k]: c.checked } });

  root.Welcome = Welcome;
})(typeof self !== 'undefined' ? self : this);
