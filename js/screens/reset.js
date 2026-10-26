/* Reset (تنفّس): a 60-second pause, then what's underneath, then something small that meets the need.
   Stores nothing unless the opt-in pattern setting is on, and then only the feeling and the hour. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L } = UI;
  const S = () => Store.settings;

  const FEELS = {
    lonely: ['وحيد', 'Lonely'], pressured: ['مضغوط', 'Pressured'], bored: ['زهقان', 'Bored'],
    numb: ['فاضي (مخدّر)', 'Empty (numb)'], tired: ['تعبان', 'Tired'], anxious: ['قلقان', 'Anxious'],
  };
  const CYCLE = 11000, CYCLES = 5;
  const W = 360, MID = 80, AMP = 52;
  let el = null, raf = 0, timer = 0, step = 'breath', feeling = null, curio = null;

  const yAt = (x) => MID + AMP * Math.cos((x / W) * Math.PI * 2);
  function curve(toX) {
    let d = '';
    for (let x = 0; x <= toX; x += 3) d += (x ? ' L' : 'M') + x + ' ' + yAt(x).toFixed(1);
    return d;
  }

  function breathView() {
    if (UI.reducedMotion()) {
      return '<div class="breath"><div class="word" id="brWord">' + L('شهيق', 'Breathe in') + '</div><div class="count" id="brCount"></div>' +
        '<p class="muted small">' + L('على مهلك.', 'Slowly.') + '</p></div>';
    }
    return '<div class="breath"><svg viewBox="-10 0 380 160" aria-hidden="true"><path class="path" d="' + curve(W) + '"/>' +
      '<path class="trail" id="brTrail" d=""/><circle class="dot" id="brDot" r="7" cx="0" cy="' + yAt(0) + '"/></svg>' +
      '<div class="word" id="brWord">' + L('شهيق', 'Breathe in') + '</div>' +
      '<p class="muted small">' + L('بس تنفّس مع الموجة.', 'Just breathe with the wave.') + '</p></div>';
  }
  function feelView() {
    return '<div class="breath" style="justify-content:flex-start;padding-top:10vh">' +
      '<h2 class="display" style="font-size:28px;margin:0">' + L('شو عم تحس فعلياً؟', 'What are you actually feeling?') + '</h2>' +
      '<div class="chips" style="justify-content:center;max-width:420px">' + Object.keys(FEELS).map((k) => '<button class="chip" data-act="reset-feel" data-k="' + k + '">' + L(...FEELS[k]) + '</button>').join('') + '</div>' +
      '<button class="btn text" data-act="reset-close" style="margin-top:12px">' + L('ولا شي، أنا منيح هلق', 'Nothing, I\'m okay now') + '</button></div>';
  }
  function suggestView() {
    const list = (S().resetSuggestions[feeling] || []).slice(0, 3);
    return '<div class="breath" style="justify-content:flex-start;padding-top:8vh;align-items:stretch;text-align:start">' +
      '<h2 class="display center" style="font-size:28px;margin:0">' + L(...FEELS[feeling]) + '</h2>' +
      '<p class="muted center">' + L('شي صغير بس:', 'Something small:') + '</p>' +
      list.map((s) => '<div class="card" style="margin:0"><div class="row" style="padding:0;min-height:44px"><div class="row-main">' + UI.ut(UI.isAr() ? s.ar : s.en || s.ar) + '</div>' +
        (s.action ? '<button class="btn soft sm" data-act="reset-go" data-to="' + s.action + '">' + L('يلا', 'Go') + '</button>' : '') + '</div></div>').join('') +
      (curio ? '<div class="card lampish" style="margin:0"><div class="muted small">' + L('من رف الفضول:', 'From your curiosity shelf:') + '</div>' +
        '<div class="row" style="padding:0;min-height:44px"><div class="row-main">' + UI.ut(curio.title) + ' <span class="tag">' + root.Curio.typeName(curio.type) + '</span></div>' +
        (curio.link ? '<a class="btn soft sm" href="' + UI.esc(curio.link) + '" target="_blank" rel="noopener">' + L('افتحو', 'Open it') + '</a>' : '') + '</div></div>' : '') +
      '<div class="btns stretch" style="margin-top:8px"><button class="btn lamp" data-act="reset-close">' + L('خلص، أحسن', 'Okay, better') + '</button>' +
      '<button class="btn text" data-act="reset-back">' + L('رجوع', 'Back') + '</button></div></div>';
  }

  function paint() {
    stopLoops();
    const body = step === 'breath' ? breathView() : step === 'feel' ? feelView() : suggestView();
    el.innerHTML = '<div class="overlay-inner"><div class="top">' +
      (step === 'breath' ? '<button class="btn text" data-act="reset-skip">' + L('تخطّى', 'Skip') + '</button>' : '<button class="icon-btn" data-act="reset-close" aria-label="' + L('سكّر', 'Close') + '">' + UI.icon('close') + '</button>') +
      '</div>' + body + '</div>';
    if (step === 'breath') runBreath();
    const f = el.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }

  function runBreath() {
    const t0 = performance.now();
    const word = document.getElementById('brWord');
    if (UI.reducedMotion()) {
      const cnt = document.getElementById('brCount');
      let n = 0;
      const tickR = () => {
        const inPhase = Math.floor(n / 5) % 2 === 0;
        word.textContent = inPhase ? L('شهيق', 'Breathe in') : L('زفير', 'Breathe out');
        cnt.textContent = UI.n(5 - (n % 5));
        n++;
        if (n > CYCLES * 10) { step = 'feel'; paint(); }
      };
      tickR();
      timer = setInterval(tickR, 1100);
      return;
    }
    const dot = document.getElementById('brDot'), trail = document.getElementById('brTrail');
    let lastIn = null;
    const frame = (now) => {
      const t = now - t0;
      if (t >= CYCLE * CYCLES) { step = 'feel'; paint(); return; }
      const p = (t % CYCLE) / CYCLE;
      const x = p * W;
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', yAt(x).toFixed(1));
      trail.setAttribute('d', curve(x));
      const inhale = p < 0.5;
      if (inhale !== lastIn) { word.textContent = inhale ? L('شهيق', 'Breathe in') : L('زفير', 'Breathe out'); lastIn = inhale; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function stopLoops() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (timer) { clearInterval(timer); timer = 0; }
  }

  const Reset = {
    isOpen: () => !!el,
    open() {
      if (el) return;
      UI.sheet.close(true);
      step = 'breath'; feeling = null;
      el = document.createElement('div');
      el.className = 'overlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', L('تنفّس', 'Breathe'));
      document.getElementById('overlayRoot').appendChild(el);
      paint();
      requestAnimationFrame(() => el && el.classList.add('on'));
    },
    close() {
      stopLoops();
      if (!el) return;
      const e = el;
      el = null;
      e.classList.remove('on');
      setTimeout(() => e.remove(), 500);
    },
  };

  const A = root.Actions;
  A['reset-open'] = () => Reset.open();
  A['reset-close'] = () => Reset.close();
  A['reset-skip'] = () => { step = 'feel'; paint(); };
  A['reset-back'] = () => { step = 'feel'; paint(); };
  A['reset-feel'] = (b) => {
    feeling = b.dataset.k;
    curio = feeling === 'bored' && S().modules.curiosity && root.Curio ? root.Curio.pickOne() : null;
    if (S().resetLog) {
      const ck = root.App.clock();
      Store.put('resetUses', { id: Store.uid(), hour: Math.floor(ck.wallMin / 60), feeling, week: root.App.weekKey(ck.day) });
    }
    step = 'suggest';
    paint();
  };
  A['reset-go'] = (b) => {
    const to = b.dataset.to;
    Reset.close();
    if (to === 'capture') A['capture-open']();
    else if (to === 'questions') UI.go('more/questions');
    else if (to === 'curiosity') UI.go('more/curiosity');
  };
  root.addEventListener('hashchange', () => { if (el) Reset.close(); });

  root.Reset = Reset;
  root.Reset.FEELS = FEELS;
})(typeof self !== 'undefined' ? self : this);
