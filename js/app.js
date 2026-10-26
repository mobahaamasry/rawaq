/* Rawaq app shell: boot, routing, the sky clock, the timer tick, event delegation. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const L = UI.L, T = UI.T;

  const TABS = [
    { key: 'today', icon: 'today', ar: 'اليوم', en: 'Today' },
    { key: 'week', icon: 'week', ar: 'الأسبوع', en: 'Week' },
    { key: 'focus', icon: 'focus', ar: 'التركيز', en: 'Focus' },
    { key: 'work', icon: 'work', ar: 'الشغل', en: 'Work' },
    { key: 'more', icon: 'more', ar: 'أكتر', en: 'More' },
  ];

  let current = null, lastKey = '', lastDay = '', tickId = null;

  const App = {
    clock(ts) { return C.clockOf(ts || Date.now(), Store.settings); },
    weekKey(day) { return C.weekStartOf(day || App.clock().day, Store.settings.weekStart); },
    screenKey(r) { return r.parts[0] === 'more' && r.parts[1] ? r.parts[1] : r.parts[0]; },

    applyLook() {
      const s = Store.settings, html = document.documentElement;
      const lang = s.lang === 'en' ? 'en' : 'ar';
      if (html.lang !== lang) { html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr'; }
      if (html.dataset.theme !== s.theme) html.dataset.theme = s.theme;
      if (html.dataset.size !== (s.textSize || 'normal')) html.dataset.size = s.textSize || 'normal';
      html.classList.toggle('calm', !!s.calmMotion);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = s.theme === 'light' ? '#F4EEE3' : '#121428';
      try { localStorage.setItem('rawaq-look', JSON.stringify({ lang, theme: s.theme })); } catch (e) { /* private mode */ }
    },

    updateSky() {
      const ck = App.clock();
      const off = C.tzOffsetMin(ck.ts, Store.settings.tz);
      const sunset = C.sunsetMin(ck.wallKey, off);
      App.sunset = sunset;
      const phase = C.skyPhase(ck.wallMin, sunset, Store.settings.dayEndHour);
      if (document.body.dataset.sky !== phase) document.body.dataset.sky = phase;
      if (lastDay && ck.day !== lastDay) App.render();
      lastDay = ck.day;
    },

    buildStars() {
      const box = document.querySelector('.stars');
      if (!box || box.childElementCount) return;
      const r = C.rng(29071);
      let html = '';
      for (let i = 0; i < 18; i++) {
        const tw = i % 3 === 0 ? ' class="tw" style="animation-delay:' + (r() * 8).toFixed(1) + 's;' : ' style="';
        html += '<i' + tw + 'top:' + (r() * 92).toFixed(1) + '%;left:' + (r() * 100).toFixed(1) + '%"></i>';
      }
      html += '<i class="bright" style="top:9%;left:72%"></i>';
      box.innerHTML = html;
    },

    renderNav() {
      const k = UI.route().parts[0];
      document.getElementById('nav').innerHTML = '<div class="nav-inner">' + TABS.map((t) =>
        '<a href="#/' + t.key + '"' + (t.key === k ? ' aria-current="page"' : '') + '>' + UI.icon(t.icon) + '<span>' + L(t.ar, t.en) + '</span></a>').join('') + '</div>';
      document.getElementById('fab').setAttribute('aria-label', L('فرّغ راسك', 'Empty your head'));
    },

    renderTop(scr, r) {
      const title = scr.title ? scr.title(r) : '';
      const sub = r.parts[0] === 'more' && r.parts[1];
      document.getElementById('topTitle').innerHTML = (sub ? '<a class="icon-btn" href="#/' + (scr.backTo || 'more') + '" aria-label="' + L('رجوع', 'Back') + '" style="margin-inline-start:-10px">' + UI.icon('back', 'flip-rtl') + '</a>' : '') +
        '<span>' + title + '</span>';
      document.getElementById('topTitle').style.display = 'flex';
      document.getElementById('topTitle').style.alignItems = 'center';
      let actions = '';
      const t = Store.get('meta', 'timer');
      if (t && r.parts[0] !== 'focus') {
        actions += '<a class="icon-btn" href="#/focus" id="miniMoon" aria-label="' + L('في جلسة شغّالة', 'A session is running') + '">' + UI.moon(C.moonFraction(t, Date.now()), { cls: 'mini-moon' }) + '</a>';
      }
      actions += '<button class="icon-btn labelled" data-act="reset-open">' + UI.icon('breathe') + '<span>' + L('تنفّس', 'Breathe') + '</span></button>';
      document.getElementById('topActions').innerHTML = actions;
    },

    render() {
      const r = UI.route();
      const key = App.screenKey(r);
      const scr = root.Screens[key] || root.Screens.today;
      const view = document.getElementById('view');
      const kept = keepInputs(view);
      if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
      let html;
      try { html = scr.render(r); } catch (e) {
        console.error('[rawaq] render', key, e);
        html = '<div class="card"><p>' + L('في شي ما زبط بهالصفحة. جرّب ترجع لليوم.', 'Something on this page did not work. Try going back to Today.') + '</p><a class="btn" href="#/today">' + L('اليوم', 'Today') + '</a></div>';
      }
      const fresh = key + JSON.stringify(r.query) !== lastKey;
      view.innerHTML = '<div class="' + (fresh ? 'screen' : 'screen-same') + '">' + html + '</div>';
      if (fresh) { lastKey = key + JSON.stringify(r.query); }
      else restoreInputs(view, kept);
      App.renderTop(scr, r);
      App.renderNav();
      current = scr;
      if (scr.mount) { try { scr.mount(r, view); } catch (e) { console.error('[rawaq] mount', key, e); } }
      document.title = L('رواق', 'Rawaq');
    },

    ensureTick() {
      const t = Store.get('meta', 'timer');
      if (t && !tickId) tickId = setInterval(App.tick, 1000);
      if (!t && tickId) { clearInterval(tickId); tickId = null; }
    },

    tick() {
      const t = Store.get('meta', 'timer');
      if (!t) return App.ensureTick();
      if (current && current.onTick) current.onTick();
      const mini = document.querySelector('#miniMoon .lit');
      if (mini) mini.setAttribute('d', C.moonPath(50, 50, 46, C.moonFraction(t, Date.now()), UI.moonSide()));
      if (root.Focus) root.Focus.watchPhase();
    },
  };

  // Keep typed text across re-renders of the same screen.
  function keepInputs(view) {
    const out = {};
    view.querySelectorAll('input[id], textarea[id]').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
      out[el.id] = { v: el.value, f: document.activeElement === el, s: el.selectionStart };
    });
    return out;
  }
  function restoreInputs(view, kept) {
    for (const id in kept) {
      const el = view.querySelector('#' + CSS.escape(id));
      if (!el) continue;
      if (kept[id].v && !el.value) el.value = kept[id].v;
      if (kept[id].f) { el.focus({ preventScroll: true }); try { el.setSelectionRange(kept[id].s, kept[id].s); } catch (e) { /* not text */ } }
    }
  }

  /* ---------- event delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = root.Actions[el.dataset.act];
    if (!fn) { console.warn('[rawaq] no action', el.dataset.act); return; }
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = root.Forms[f.dataset.form];
    if (fn) fn(UI.formObj(f), f, e); else console.warn('[rawaq] no form', f.dataset.form);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    const fn = root.Changes[el.dataset.change];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (root.Reset && root.Reset.isOpen()) root.Reset.close();
      else if (UI.sheet.isOpen) UI.sheet.close();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const f = e.target.closest && e.target.closest('form[data-form]');
      if (f) { e.preventDefault(); f.requestSubmit(); }
    }
  });
  let ready = false;
  root.addEventListener('hashchange', () => { if (!ready) return; UI.sheet.close(true); App.render(); root.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => {
    if (ready && document.visibilityState === 'visible') { App.updateSky(); App.render(); if (root.Focus) root.Focus.watchPhase(); }
  });

  async function boot() {
    const slow = setTimeout(() => {
      const sp = document.getElementById('splash');
      if (sp && Store.blocked) sp.insertAdjacentHTML('beforeend', '<p style="position:absolute;bottom:12vh;inset-inline:24px;text-align:center;color:#A9A6B8">إذا رواق مفتوح بتبويب تاني، سكّرو وبيكمّل لحالو.<br>If Rawaq is open in another tab, close it and this will continue.</p>');
    }, 3000);
    try {
      await Store.init();
    } catch (e) {
      console.error('[rawaq] store', e);
    }
    clearTimeout(slow);
    ready = true;
    App.applyLook();
    App.buildStars();
    App.updateSky();
    App.render();
    App.ensureTick();
    setInterval(App.updateSky, 60000);
    Store.onChange(() => { App.applyLook(); App.render(); UI.sheet.refresh(); App.ensureTick(); });
    const sp = document.getElementById('splash');
    if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 700); }
    root.dispatchEvent(new Event('rawaq:ready'));
    registerOffline();
    handleLaunch();
  }

  // Home-screen shortcuts (?do=…) and "share to Rawaq" from other apps. Shared things land in the inbox.
  function handleLaunch() {
    const sp = new URLSearchParams(location.search);
    if (sp.has('code') || sp.has('error')) return; // a sign-in coming back; the To Do bridge handles it
    const act = sp.get('do');
    const shared = C.shareToInbox({ title: sp.get('share_title'), text: sp.get('share_text'), url: sp.get('share_url') });
    if (!act && !shared) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (shared) {
      // It lands in the inbox first (nothing is lost); then one tap can move it to the curiosity shelf.
      const id = Store.uid();
      const title = (sp.get('share_title') || '').trim() || (sp.get('share_text') || '').replace(/https?:\/\/\S+/g, '').trim() || shared.link || shared.text;
      Store.put('inbox', { id, text: shared.text, link: shared.link, source: 'share', createdAt: new Date().toISOString() });
      UI.go('more/inbox');
      setTimeout(() => App.shareChoice(id, title), 80);
      return;
    }
    if (act === 'capture') root.Actions['capture-open']();
    else if (act === 'breathe') root.Actions['reset-open']();
    else if (act === 'focus') UI.go('focus');
  }

  // After a share: inbox or curiosity shelf? The kind is guessed from the link (video / paper / film / book / topic).
  const CURIO_TYPE = { video: ['فيديو', 'video'], paper: ['ورقة', 'paper'], film: ['فيلم', 'film'], book: ['كتاب', 'book'], topic: ['موضوع', 'topic'] };
  App.shareChoice = (inboxId, title) => {
    const it = Store.get('inbox', inboxId);
    if (!it) return;
    const type = C.guessCurioType(it.link, it.text);
    UI.sheet.open(() => '<h3>' + L('وين بدك تحطها؟', 'Where should it go?') + '</h3>' +
      '<div class="ut" dir="auto" style="margin-bottom:14px">' + UI.esc(title) + '</div>' +
      '<div class="btns stretch"><button class="btn soft" data-act="share-curio" data-id="' + inboxId + '" data-type="' + type + '" data-title="' + UI.esc(title) + '">' +
      UI.icon('curiosity') + T('رف الفضول ({t})', 'Curiosity shelf ({t})', { t: L(...CURIO_TYPE[type]) }) + '</button>' +
      '<button class="btn" data-act="share-inbox">' + UI.icon('inbox') + L('الصندوق', 'The inbox') + '</button></div>');
  };
  root.Actions['share-curio'] = (el) => {
    const it = Store.get('inbox', el.dataset.id);
    UI.sheet.close();
    if (!it) return;
    Store.put('curiosity', { id: Store.uid(), title: el.dataset.title || it.text, type: el.dataset.type, link: it.link || '', status: 'want', createdAt: new Date().toISOString() });
    Store.del('inbox', it.id);
    UI.toast(L('انحطت على رف الفضول. بلا مواعيد.', 'On the curiosity shelf. No deadlines.'));
  };
  root.Actions['share-inbox'] = () => { UI.sheet.close(); UI.toast(L('انحطت بالصندوق. فيك تنساها هلق.', 'Saved to your inbox. You can let it go now.')); };

  // Keep the app on the device (needs http/https; opening the file directly already works offline).
  function registerOffline() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[rawaq] offline cache', e && e.message));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) UI.toast(L('في نسخة جديدة من رواق. بتشتغل المرة الجاية لما تفتحو.', 'A new version of Rawaq is ready. It starts the next time you open it.'), 6000);
    });
  }
  // "Add to home screen" when the browser offers it (Settings shows a quiet button).
  root.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); App.installPrompt = e; if (ready) App.render(); });
  root.addEventListener('appinstalled', () => { App.installPrompt = null; });

  root.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof self !== 'undefined' ? self : this);
