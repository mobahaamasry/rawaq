/* Focus timer: a moon that fills from a crescent. Small starts, gentle check-ins, ceilings. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  const SLOT_CAT = { study: 'study', course: 'teaching', team: 'team', gym: 'personal', other: 'free', rest: 'free' };
  let spindleRaf = 0;

  /* Optional companions while a session runs (all off by default in Settings):
     a soft hush made on the device (no sound files, no network), keeping the screen awake, a light vibration at the check-in. */
  const Companions = {
    ctx: null, src: null, gain: null, lock: null, hushOn: false, wanted: false,
    startHush() {
      if (this.src) return;
      try {
        const AC = root.AudioContext || root.webkitAudioContext;
        const ctx = this.ctx = this.ctx || new AC();
        if (ctx.state === 'suspended') ctx.resume();
        const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; } // brown noise
        const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), gain = ctx.createGain();
        src.buffer = buf; src.loop = true;
        lp.type = 'lowpass'; lp.frequency.value = 850;
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.16, t + 1.8);
        src.connect(lp).connect(gain).connect(ctx.destination);
        src.start();
        this.src = src; this.gain = gain; this.hushOn = true;
      } catch (e) { this.hushOn = false; }
    },
    stopHush() {
      if (!this.src) { this.hushOn = false; return; }
      const t = this.ctx.currentTime, g = this.gain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.exponentialRampToValueAtTime(0.0001, t + 0.9);
      this.src.stop(t + 1);
      this.src = null; this.hushOn = false;
    },
    async lockOn() {
      if (!S().focus.wakeLock || !navigator.wakeLock || this.lock || document.visibilityState !== 'visible') return;
      try { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } catch (e) { this.lock = null; }
    },
    lockOff() { if (this.lock) { this.lock.release().catch(() => {}); this.lock = null; } },
    buzz() { if (S().focus.vibrate && navigator.vibrate) navigator.vibrate([40, 70, 40]); },
    running() { const t = Focus.timer(); return !!t && t.pausedAt == null && C.timerPhase(t, Date.now()) === 'running'; },
    sync() {
      if (this.running()) this.lockOn();
      else { this.lockOff(); if (this.hushOn) this.stopHush(); }
    },
    resume() { if (this.wanted) this.startHush(); this.lockOn(); },
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root.App && Focus.timer) Companions.sync(); });

  const Focus = {
    last: null,
    phaseKey: '',
    timer: () => Store.get('meta', 'timer'),

    catOfProject(p) { return p.examId ? 'study' : (p.area || 'free'); },

    resolve(ref) {
      if (!ref) return { label: '', category: 'free' };
      const i = ref.indexOf(':');
      const k = ref.slice(0, i), id = ref.slice(i + 1);
      if (k === 's') { const s = Store.get('slots', id); if (s) return { label: UI.slotLabel(s), category: SLOT_CAT[s.type] || 'free' }; }
      if (k === 'i') {
        const it = Store.get('items', id);
        if (it) { const p = it.projectId && Store.get('projects', it.projectId); return { label: it.title, category: p ? Focus.catOfProject(p) : (it.category || 'free') }; }
      }
      if (k === 'c') {
        const ch = Store.get('chapters', id);
        if (ch) { const sub = Store.get('subjects', ch.subjectId); return { label: ch.name + (sub ? ' · ' + sub.name : ''), category: 'study' }; }
      }
      if (k === 'p') { const p = Store.get('projects', id); if (p) return { label: p.nextStep || p.name, category: Focus.catOfProject(p) }; }
      if (k === 'pp') { const pa = Store.get('papers', id); if (pa) return { label: pa.title, category: 'research' }; }
      if (k === 'o') { const o = Store.get('opportunities', id); if (o) return { label: o.name, category: 'personal' }; }
      return { label: '', category: 'free' };
    },

    start(o) {
      if (Focus.timer()) { UI.toast(L('في جلسة شغّالة هلق.', 'A session is already running.')); UI.go('focus'); return; }
      const season = root.Season && root.Season.now();
      if (season && season.mode === 'rest' && !o.restOk) {
        UI.confirm({
          title: L('هالأسبوع للراحة.', 'This week is for rest.'),
          body: L('ما في شي مطلوب منك هالأسبوع. متأكد بدك تشتغل؟', 'Nothing is asked of you this week. Sure you want to work?'),
          yes: L('معك حق، برتاح', 'You\'re right, I\'ll rest'), no: L('شي صغير بس', 'Just something small'), noClass: 'text',
          onNo: () => Focus.start({ ...o, restOk: true }),
        });
        return;
      }
      const info = Focus.resolve(o.ref);
      const category = o.category && o.category !== 'auto' ? o.category : info.category;
      const ck = root.App.clock();
      const ceil = C.ceilingFor(category, S(), root.App.weekKey(ck.day));
      const used = C.minutesOn(Store.all('sessions'), category, ck.day);
      if (!o.override && !C.startCheck(used, ceil).ok) { Focus.dailyCeilingSheet({ ...o, category }); return; }
      const t = C.newTimer({ now: Date.now(), category, usedToday: used, ceil, override: o.override, ref: o.ref, label: o.label || info.label, withWhom: o.withWhom });
      t.id = 'timer';
      Focus.last = null;
      Store.put('meta', t);
      Companions.wanted = !!S().focus.hush;
      if (Companions.wanted) Companions.startHush(); // started from a tap, so sound is allowed
      Companions.lockOn();
      UI.go('focus');
    },

    dailyCeilingSheet(o) {
      UI.sheet.open(() => '<h3>' + L('وقفة حلوة هلق.', 'Good place to stop.') + '</h3>' +
        '<p>' + T('وقّف وانت لسا عندك طاقة. هيك بيكفّي {cat} لليوم، وبكرا في وقت جديد.', 'Stop while you still have energy. That\'s enough {cat} for today, and tomorrow brings new time.', { cat: UI.isAr() ? UI.catName(o.category) : UI.catName(o.category).toLowerCase() }) + '</p>' +
        '<div class="btns stretch" style="margin-top:16px"><button class="btn lamp" data-act="sheet-close">' + L('تمام', 'Okay') + '</button></div>' +
        '<div class="center" style="margin-top:6px"><button class="btn text" data-act="focus-override-start">' + L('بدي كمّل شوي', 'I want to keep going a little') + '</button></div>');
      Focus.pendingStart = o;
    },

    stop() {
      const t = Focus.timer();
      if (!t) return;
      const now = Date.now();
      const phase = C.timerPhase(t, now);
      const minutes = Math.round(C.heldElapsedMs(t, now) / 60000);
      const day = root.App.clock(t.startedAt).day;
      let sessionId = null;
      if (minutes >= 1) {
        sessionId = Store.uid();
        Store.put('sessions', {
          id: sessionId, day, category: t.category, ref: t.ref || null, label: t.label || '', withWhom: t.withWhom || '',
          startedAt: t.startedAt, endedAt: now, minutes, overrideCeiling: !!t.overridden,
        });
      }
      let curio = null;
      if (t.category === 'study' && S().modules.curiosity) {
        const pool = Store.all('curiosity').filter((c) => c.status === 'want' || c.status === 'progress');
        if (pool.length) curio = pool[Math.floor(Math.random() * pool.length)].id;
      }
      Focus.last = { minutes, category: t.category, label: t.label, atCeiling: phase === 'ceiling', sessionId, curio, spindle: true };
      Store.del('meta', 'timer');
    },

    watchPhase() {
      const t = Focus.timer();
      if (!t) { Focus.phaseKey = ''; return; }
      const ph = C.timerPhase(t, Date.now());
      const key = t.startedAt + ':' + t.plannedMin + ':' + ph;
      if (key === Focus.phaseKey) return;
      const first = !Focus.phaseKey;
      Focus.phaseKey = key;
      Companions.sync();
      if (ph !== 'running') {
        if (!first) Companions.buzz();
        if (!first && document.visibilityState === 'visible') UI.chime();
        if (UI.route().parts[0] === 'focus') root.App.render();
      }
    },

    refOptions(sel) {
      const ck = root.App.clock();
      const log = Store.get('dayLogs', ck.day);
      const plan = C.todayPlan({
        day: ck.day, lm: ck.lm, energy: log && log.energy != null ? log.energy : 3, weekKey: root.App.weekKey(ck.day), dayEndHour: S().dayEndHour,
        slots: Store.all('slots'), items: Store.all('items'), projects: Store.all('projects'), focusKey: log && log.focusKey,
      });
      const opt = (v, label) => '<option value="' + UI.esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + UI.esc(label) + '</option>';
      let html = opt('', L('جلسة حرة', 'A free session'));
      const today = plan.candidates.slice(0, 3);
      if (today.length) {
        html += '<optgroup label="' + L('اليوم', 'Today') + '">' + today.map((c) => opt(c.key, c.kind === 'slot' ? UI.slotLabel(c.slot) : c.item.title)).join('') + '</optgroup>';
      }
      const projs = Store.all('projects').filter((p) => p.status === 'active');
      if (projs.length) html += '<optgroup label="' + L('مشاريع', 'Projects') + '">' + projs.map((p) => opt('p:' + p.id, p.name)).join('') + '</optgroup>';
      if (sel && !html.includes('value="' + UI.esc(sel) + '"')) html += opt(sel, Focus.resolve(sel).label || sel);
      return html;
    },

    weekCard() {
      const tot = C.weekTotals(Store.all('sessions'), root.App.weekKey());
      const cats = Object.keys(tot).filter((k) => tot[k] > 0);
      if (!cats.length) return '';
      return '<div class="sec-title">' + L('هالأسبوع', 'This week') + '</div><div class="card quiet plain"><div class="rows">' +
        cats.map((c) => '<div class="row" style="min-height:44px"><div class="row-main">' + UI.catName(c) + '</div><div class="muted small">' + UI.fmtDur(tot[c]) + '</div></div>').join('') +
        '</div></div>';
    },

    viewIdle(r) {
      const cats = ['auto'].concat(C.CATS);
      return '<div class="moon-wrap">' + UI.moon(0.06, { cls: 'moon-big', craters: true }) + '</div>' +
        '<p class="center muted" style="margin:6px 12px 18px">' + L('البداية أصعب شي. عشر دقايق بس، وبعدين منشوف.', 'Starting is the hardest part. Ten minutes, then we see.') + '</p>' +
        '<form class="card" data-form="focus-start">' +
        '<label class="field"><span>' + L('على شو؟', 'On what?') + '</span><select name="ref">' + Focus.refOptions(r.query.ref || '') + '</select></label>' +
        '<div class="grid2">' +
        '<label class="field"><span>' + L('نوعها', 'Kind') + '</span><select name="category">' + cats.map((c) => '<option value="' + c + '">' + (c === 'auto' ? L('تلقائي', 'Automatic') : UI.catName(c)) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>' + L('مع مين؟', 'With whom?') + '</span><input name="withWhom" id="fWith" autocomplete="off" dir="auto" placeholder="' + L('لحالي', 'Alone') + '"></label>' +
        '</div>' +
        '<button class="btn lamp big block" type="submit">' + L('ابدأ ١٠ دقايق بس', 'Just start for 10 minutes') + '</button>' +
        '</form>' + Focus.weekCard();
    },

    viewActive(t) {
      const now = Date.now();
      const ph = C.timerPhase(t, now);
      const paused = t.pausedAt != null;
      const f = C.moonFraction(t, now);
      const head = '<p class="center" style="margin:4px 0 0">' + (t.label ? UI.ut(t.label) : L('جلسة حرة', 'A free session')) +
        ' <span class="tag teal">' + UI.catName(t.category) + '</span></p>' +
        (t.withWhom ? '<p class="center muted small" style="margin:0">' + T('مع {who}', 'With {who}', { who: UI.raw(UI.ut(t.withWhom)) }) + '</p>' : '');
      const moon = '<div class="moon-wrap' + (ph !== 'running' ? ' glow' : ' running') + '">' + (ph === 'running' ? '<div class="orbit" aria-hidden="true"><i></i><i></i><i></i></div>' : '') +
        UI.moon(f, { cls: 'moon-big', craters: true, id: 'bigMoon' }) + '</div>';
      if (ph === 'running') {
        return head + moon +
          '<p class="center muted" id="fElapsed" style="min-height:1.7em">' + (paused ? L('وقفة. خود وقتك.', 'Paused. Take your time.') : Focus.elapsedText(t, now)) + '</p>' +
          '<div class="btns stretch" style="margin-top:14px">' +
          (paused ? '<button class="btn soft big" data-act="focus-resume">' + UI.icon('play') + L('كمّل', 'Resume') + '</button>'
            : '<button class="btn big" data-act="focus-pause">' + UI.icon('pause') + L('وقفة', 'Pause') + '</button>') +
          '<button class="btn big" data-act="focus-stop">' + L('خلص هون', 'Stop here') + '</button></div>' +
          (paused ? '' : '<div class="center" style="margin-top:10px"><button class="chip" data-act="focus-hush" aria-pressed="' + Companions.hushOn + '">' +
            UI.icon('breathe') + L('صوت هادي', 'A soft hush') + '</button></div>');
      }
      if (ph === 'checkin') {
        const left = t.capMin - t.plannedMin;
        const opts = [15, 25].map((m) => Math.min(m, left)).filter((m, i, a) => m > 0 && a.indexOf(m) === i);
        return head + moon +
          '<h2 class="display center" style="font-size:30px;margin:8px 0 0">' + L('كمّل؟', 'Keep going?') + '</h2>' +
          '<p class="center muted">' + L('أي جواب منيح.', 'Either answer is fine.') + '</p>' +
          '<div class="btns stretch" style="margin-top:12px">' +
          opts.map((m) => '<button class="btn big" data-act="focus-extend" data-min="' + m + '">+' + UI.n(m) + '</button>').join('') +
          '<button class="btn big" data-act="focus-stop">' + L('خلص هون', 'Stop here') + '</button></div>';
      }
      return head + moon +
        '<h2 class="display center" style="font-size:27px;margin:8px 0 0">' + L('وقّف وانت لسا عندك طاقة', 'Stop while you still have energy') + '</h2>' +
        '<p class="center muted">' + L('وقفة حلوة هلق.', 'This is a good place to stop.') + '</p>' +
        '<button class="btn lamp big block" style="margin-top:14px" data-act="focus-stop">' + L('خلص هون', 'Stop here') + '</button>' +
        '<div class="center" style="margin-top:4px"><button class="btn text" data-act="focus-override">' + L('بدي كمّل شوي', 'I want to keep going a little') + '</button></div>';
    },

    elapsedText(t, now) {
      const m = Math.floor(C.heldElapsedMs(t, now) / 60000);
      if (m < 1) return L('بلّشت. هاد أصعب شي.', 'You started. That\'s the hard part.');
      return T('صرلك {d}', '{d} in', { d: UI.fmtDur(m) });
    },

    viewDone() {
      const x = Focus.last;
      let html = '<div class="moon-wrap glow">' + UI.moon(1, { cls: 'moon-big', craters: true }) + '</div>' +
        '<svg class="wave" viewBox="0 0 320 40" preserveAspectRatio="none" style="height:34px;margin:4px 0 10px;color:var(--lamp)" aria-hidden="true"><path id="spindle" vector-effect="non-scaling-stroke" d="' + Focus.spindlePath(-100) + '"/></svg>' +
        '<h2 class="display center" style="font-size:30px;margin:0">' + L('خلصت.', 'Done.') + '</h2>';
      if (x.minutes >= 1) {
        html += '<p class="center">' + T('{d}. البداية كانت أصعب شي، وعملتها.', '{d}. Starting was the hardest part, and you did it.', { d: UI.fmtDur(x.minutes) }) + '</p>';
      } else {
        html += '<p class="center">' + L('ولا يهمك. إنك فتحتها بحد ذاتو شي.', 'That\'s fine. Opening it at all counts.') + '</p>';
      }
      if (x.atCeiling && !x.winSaved) {
        html += '<div class="card lampish" style="margin-top:16px"><p>' + L('وقفت عالسقف. هاد بحد ذاتو شي منيح.', 'You stopped at the ceiling. That itself is a good thing.') + '</p>' +
          '<button class="btn soft" data-act="focus-win">' + UI.icon('star') + L('حطها نجمة بسماك', 'Make it a star in your sky') + '</button></div>';
      } else if (x.minutes >= 1 && !x.winSaved) {
        html += '<div class="center"><button class="btn text" data-act="focus-win">' + UI.icon('star') + L('حطها نجمة؟', 'Make it a star?') + '</button></div>';
      } else if (x.winSaved) {
        html += '<p class="center muted small">' + L('صارت نجمة.', 'It\'s a star now.') + '</p>';
      }
      const c = x.curio && Store.get('curiosity', x.curio);
      if (c && !x.curioDone) {
        html += '<div class="card" style="margin-top:14px"><div class="muted small">' + L('بدك تفتح هالشي؟', 'Want to open this?') + '</div>' +
          '<div class="row-title" style="margin:4px 0 10px">' + UI.ut(c.title) + ' <span class="tag">' + root.Curio.typeName(c.type) + '</span></div>' +
          '<div class="btns"><button class="btn soft sm" data-act="focus-curio-open">' + L('يلا', 'Sure') + '</button>' +
          '<button class="btn text" data-act="focus-curio-skip">' + L('مش هلق', 'Not now') + '</button></div></div>';
      }
      html += '<button class="btn lamp block big" style="margin-top:18px" data-act="focus-dismiss">' + L('تمام', 'Okay') + '</button>';
      return html;
    },

    // A slow wave; a tiny spindle ripple travels across it once (consolidation after effort).
    spindlePath(s) {
      let d = '';
      for (let x = 0; x <= 320; x += 2) {
        const base = 22 - 9 * Math.sin((x / 320) * Math.PI * 2 * 1.25 - 0.6);
        const env = Math.exp(-Math.pow((x - s) / 16, 2));
        const y = base + 4.2 * env * Math.sin((x / 6.5) * Math.PI * 2);
        d += (x ? ' L' : 'M') + x + ' ' + y.toFixed(2);
      }
      return d;
    },
    runSpindle() {
      const el = document.getElementById('spindle');
      if (!el || UI.reducedMotion()) return;
      const t0 = performance.now(), dur = 2200;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 2);
        el.setAttribute('d', Focus.spindlePath(-30 + eased * 380));
        if (p < 1) spindleRaf = requestAnimationFrame(step); else spindleRaf = 0;
      };
      spindleRaf = requestAnimationFrame(step);
    },
  };

  root.Screens.focus = {
    title: () => L('التركيز', 'Focus'),
    render(r) {
      const t = Focus.timer();
      if (t) return Focus.viewActive(t);
      if (Focus.last) return Focus.viewDone();
      return Focus.viewIdle(r);
    },
    mount() {
      if (Focus.last && Focus.last.spindle) { Focus.last.spindle = false; Focus.runSpindle(); }
      Focus.watchPhase();
    },
    unmount() { if (spindleRaf) { cancelAnimationFrame(spindleRaf); spindleRaf = 0; } },
    onTick() {
      const t = Focus.timer();
      if (!t) return;
      const now = Date.now();
      const lit = document.querySelector('#bigMoon .lit');
      if (lit) lit.setAttribute('d', C.moonPath(50, 50, 46, C.moonFraction(t, now), UI.moonSide()));
      const el = document.getElementById('fElapsed');
      if (el && t.pausedAt == null) el.textContent = Focus.elapsedText(t, now);
    },
  };

  root.addEventListener('hashchange', () => { if (UI.route().parts[0] !== 'focus') Focus.last = null; });

  const A = root.Actions;
  root.Forms['focus-start'] = (d) => Focus.start({ ref: d.ref || null, category: d.category, withWhom: (d.withWhom || '').trim() });
  A['focus-start'] = (el) => Focus.start({ ref: el.dataset.ref || null, category: el.dataset.cat || 'auto' });
  A['focus-override-start'] = () => {
    const o = Focus.pendingStart;
    UI.sheet.close(true);
    UI.confirm({
      title: L('متأكد؟ الوقفة هلق غالباً أحسن.', 'Sure? Stopping now is usually better.'),
      yes: L('معك حق، بوقف', 'You\'re right, I\'ll stop'), no: L('إي، شوي بس', 'Yes, just a little'), noClass: 'text',
      onNo: () => Focus.start({ ...o, override: true }),
    });
  };
  A['focus-pause'] = () => { Store.put('meta', C.pauseTimer(Focus.timer(), Date.now())); Companions.sync(); };
  A['focus-resume'] = () => { Store.put('meta', C.resumeTimer(Focus.timer(), Date.now())); Companions.resume(); };
  A['focus-stop'] = () => { Focus.stop(); Companions.sync(); };
  A['focus-hush'] = () => {
    Companions.wanted = !Companions.hushOn;
    if (Companions.wanted) Companions.startHush(); else Companions.stopHush();
    root.App.render();
  };
  A['focus-extend'] = (el) => {
    const now = Date.now();
    Store.put('meta', C.extendTimer(C.settleTimer(Focus.timer(), now), Number(el.dataset.min)));
    Companions.resume();
  };
  A['focus-override'] = () => UI.confirm({
    title: L('متأكد؟ الوقفة هلق غالباً أحسن.', 'Sure? Stopping now is usually better.'),
    body: L('إذا كمّلت، ربع ساعة بس، وبعدين منرجع نسأل.', 'If you go on, it\'s fifteen minutes, then we ask again.'),
    yes: L('معك حق، بوقف', 'You\'re right, I\'ll stop'), no: L('ربع ساعة كمان', 'Fifteen more minutes'), noClass: 'text',
    onYes: () => { Focus.stop(); Companions.sync(); },
    onNo: () => { const now = Date.now(); Store.put('meta', C.overrideTimer(C.settleTimer(Focus.timer(), now), 15)); Companions.resume(); },
  });
  A['focus-dismiss'] = () => { Focus.last = null; UI.go('today'); };
  A['focus-win'] = () => {
    const x = Focus.last;
    if (!x) return;
    const ck = root.App.clock();
    const text = x.atCeiling
      ? L('وقفت عالسقف وانا لسا عندي طاقة', 'Stopped at the ceiling with energy left')
      : (x.label ? x.label + ' · ' : '') + UI.fmtDur(x.minutes);
    Store.put('wins', { id: Store.uid(), text, date: ck.day, toldWho: '', createdAt: new Date().toISOString() });
    x.winSaved = true;
    root.App.render();
    UI.toast(L('انحفظت. وبتستاهل حدا يعرف فيها.', 'Saved. Someone deserves to hear about this.'));
  };
  A['focus-curio-open'] = () => {
    const x = Focus.last;
    const c = x && Store.get('curiosity', x.curio);
    if (!c) return;
    x.curioDone = true;
    Store.patch('curiosity', c.id, { status: 'progress' });
    if (c.link) root.open(c.link, '_blank', 'noopener');
  };
  A['focus-curio-skip'] = () => { if (Focus.last) Focus.last.curioDone = true; root.App.render(); };

  root.Focus = Focus;
})(typeof self !== 'undefined' ? self : this);
