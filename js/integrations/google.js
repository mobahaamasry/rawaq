/* Google Calendar: week-plan slots go to a dedicated «رواق» calendar; today's events come back as one quiet card.
   Sign-in uses Google Identity Services (token model). Only a short-lived access token is kept; never a refresh token.
   Rawaq only edits or deletes events it created itself (their ids are in idMap). */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store, Net = root.Net, P = root.Payloads;
  const { L, T } = UI;
  const ID = 'google';
  const GSI = 'https://accounts.google.com/gsi/client';
  const API = 'https://www.googleapis.com/calendar/v3';
  const SCOPE = {
    created: 'https://www.googleapis.com/auth/calendar.app.created', // create and manage the «رواق» calendar only
    read: 'https://www.googleapis.com/auth/calendar.events.readonly', // read today's events
    main: 'https://www.googleapis.com/auth/calendar.events', // only if he chooses his main calendar
  };

  const opts = () => ({ deadlines: false, useMain: false, ...(Net.rec(ID).options || {}) });
  const cfg = () => Net.rec(ID).config || {};
  const tokenOk = (r) => !!(r.token && r.token.exp > Date.now() + 30000);
  const auth = () => ({ Authorization: 'Bearer ' + Net.rec(ID).token.access, 'Content-Type': 'application/json' });
  const req = (method, path, body) => Net.request(ID, API + path, { method, headers: auth(), body: body ? JSON.stringify(body) : undefined });

  function desired() {
    const s = Store.settings;
    const c = { tz: s.tz, dayEndHour: s.dayEndHour, lang: s.lang };
    const wk = root.App.weekKey();
    const out = {};
    for (const slot of Store.all('slots')) {
      if (slot.until && slot.until < wk) continue;
      if (slot.date && slot.date < wk) continue;
      out[slot.id] = P.gcalEvent(slot, c, wk);
    }
    if (opts().deadlines) {
      for (const o of Store.all('opportunities')) if (o.deadline && C.OPP_OPEN.includes(o.status)) out['deadline-' + o.id] = P.gcalDeadline(o, s.lang);
    }
    return out;
  }

  async function ensureCalendar() {
    if (opts().useMain) return 'primary';
    const r = Net.rec(ID);
    if (r.calendarId) {
      try { await req('GET', '/calendars/' + encodeURIComponent(r.calendarId)); return r.calendarId; } catch (e) { if (e.status !== 404) throw e; }
    }
    const cal = await req('POST', '/calendars', { summary: 'رواق', description: 'Rawaq week plan', timeZone: Store.settings.tz || 'Asia/Damascus' });
    Net.save(ID, { calendarId: cal.id, idMap: {} });
    return cal.id;
  }

  async function pushPlan() {
    const calId = await ensureCalendar();
    const base = '/calendars/' + encodeURIComponent(calId) + '/events';
    const want = desired();
    const idMap = { ...(Net.rec(ID).idMap || {}) };
    for (const key of Object.keys(want)) {
      if (idMap[key]) {
        try { await req('PUT', base + '/' + encodeURIComponent(idMap[key]), want[key]); continue; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
      }
      const ev = await req('POST', base, want[key]);
      idMap[key] = ev.id;
    }
    for (const key of Object.keys(idMap)) {
      if (want[key]) continue;
      try { await req('DELETE', base + '/' + encodeURIComponent(idMap[key])); } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
      delete idMap[key];
    }
    Net.save(ID, { idMap });
  }

  async function readToday() {
    const ck = root.App.clock();
    const s = Store.settings;
    const from = C.wallToTs(ck.day, C.pad(s.dayEndHour) + ':00', s.tz);
    const to = from + C.DAY;
    const q = '?singleEvents=true&orderBy=startTime&maxResults=12&timeMin=' + encodeURIComponent(new Date(from).toISOString()) + '&timeMax=' + encodeURIComponent(new Date(to).toISOString());
    const res = await req('GET', '/calendars/primary/events' + q);
    const events = (res.items || [])
      .filter((e) => e.status !== 'cancelled' && !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.rawaqId))
      .map((e) => ({ summary: e.summary || '', start: e.start.dateTime || null, end: e.end.dateTime || null, allDay: !!e.start.date }));
    Net.save(ID, { cache: { day: ck.day, at: Date.now(), events } });
  }

  const Google = {
    async connect(interactive) {
      const id = (cfg().clientId || '').trim();
      if (!id) { UI.toast(L('حط الـ <bdi>Client ID</bdi> أول.', 'Add the Client ID first.')); return; }
      Net.save(ID, { enabled: true });
      try { await Net.loadScript(GSI); } catch (e) { Net.save(ID, { lastError: 'offline' }); UI.toast(L('ما في نت، منجرب بعدين.', 'No connection, we\'ll try again later.')); return; }
      const scope = [SCOPE.created, SCOPE.read].concat(opts().useMain ? [SCOPE.main] : []).join(' ');
      const client = root.google.accounts.oauth2.initTokenClient({
        client_id: id, scope,
        callback: (resp) => {
          if (resp.error) { Net.save(ID, { lastError: 'auth' }); return; }
          Net.save(ID, { token: { access: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000 }, scopes: resp.scope, lastError: null, everConnected: true });
          Net.run(ID);
        },
        error_callback: () => Net.save(ID, { lastError: 'auth' }),
      });
      client.requestAccessToken({ prompt: Net.rec(ID).everConnected && !interactive ? '' : 'consent' });
    },
    async disconnect() {
      const r = Net.rec(ID);
      if (r.token && r.token.access && root.google && root.google.accounts) {
        try { root.google.accounts.oauth2.revoke(r.token.access, () => {}); } catch (e) { /* the token expires on its own within the hour */ }
      }
      Net.disconnect(ID);
    },
    todayCard(ck) {
      const r = Net.rec(ID);
      if (!r.enabled || !r.cache || r.cache.day !== ck.day || !r.cache.events.length) return '';
      return '<div class="card quiet plain"><div class="muted small">' + L('من التقويم', 'From your calendar') + '</div><div class="rows">' +
        r.cache.events.map((e) => '<div class="row" style="min-height:40px"><div class="row-main">' + UI.ut(e.summary) + '</div><span class="small muted">' +
          (e.allDay ? L('كل اليوم', 'All day') : UI.tsTime(e.start)) + '</span></div>').join('') + '</div></div>';
    },
  };

  root.Bridges.register({
    id: ID, title: 'Google Calendar', auto: true,
    ready: tokenOk,
    stale: (r) => !r.cache || r.cache.day !== root.App.clock().day || Date.now() - r.cache.at > 3600000,
    fingerprint: () => Net.fingerprint({ d: desired(), o: opts() }),
    async sync() { if (!tokenOk(Net.rec(ID))) throw Object.assign(new Error('auth'), { kind: 'auth' }); await pushPlan(); await readToday(); },
    card() {
      const r = Net.rec(ID), o = opts();
      let html = '<div class="card plain"><div class="card-head"><h2 class="card-title"><bdi>Google Calendar</bdi></h2>' +
        '<span class="tag' + (r.enabled ? ' sage' : '') + '">' + (r.enabled ? L('موصول', 'Connected') : L('مطفي', 'Off')) + '</span></div>';
      if (!r.enabled) {
        html += '<p class="small">' + L('بيكتب: أوقات أسبوعك (دراسة، رياضة، كورس، راحة محمية) بتقويم لحالو اسمو «رواق»، ومواعيد الفرص إذا بدك.', 'Writes: your week plan (study, gym, course, protected rest) to a separate calendar called «رواق», and application deadlines if you want.') + '</p>' +
          '<p class="small">' + L('بيقرا: مواعيد اليوم من تقويمك الأساسي، لتطلع بكرت هادي على صفحة اليوم. ما بيعدّل ولا بيمسح شي ما هو عملو.', 'Reads: today\'s events from your main calendar, shown as one quiet card on Today. It never edits or deletes anything it didn\'t create.') + '</p>' +
          Net.httpsNote() +
          '<label class="field" style="margin-top:10px"><span><bdi>OAuth Client ID</bdi></span><input dir="ltr" autocomplete="off" value="' + UI.esc(cfg().clientId || '') + '" data-change="g-cfg" data-k="clientId" placeholder="….apps.googleusercontent.com"></label>' +
          '<button class="btn soft" data-act="g-connect"' + (Net.canOAuth() ? '' : ' disabled') + '>' + L('وصّل <bdi>Google</bdi>', 'Connect Google') + '</button>';
      } else {
        html += Net.statusLine(ID) + '<div class="btns" style="margin-top:6px">' +
          (tokenOk(r) ? '<button class="btn soft sm" data-act="g-sync">' + L('زامن هلق', 'Sync now') + '</button>'
            : '<button class="btn soft sm" data-act="g-reconnect">' + L('وصّل <bdi>Google</bdi> مرة تانية', 'Connect Google again') + '</button>') + '</div>' +
          '<label class="switch"><span>' + L('ابعت مواعيد الفرص كأيام كاملة', 'Send application deadlines as all-day events') + '</span><input type="checkbox" data-change="g-opt" data-k="deadlines"' + (o.deadlines ? ' checked' : '') + '></label>' +
          '<label class="switch"><span>' + L('استعمل تقويمي الأساسي بدل «رواق»', 'Use my main calendar instead of «رواق»') + '<br><span class="small muted">' + L('بيحتاج توصيل مرة تانية.', 'Needs connecting again.') + '</span></span><input type="checkbox" data-change="g-opt" data-k="useMain"' + (o.useMain ? ' checked' : '') + '></label>' +
          '<button class="btn text sm" style="color:var(--clay)" data-act="g-disconnect">' + L('افصل', 'Disconnect') + '</button>';
      }
      return html + Net.neverLine() + '</div>';
    },
  });

  // Refresh today's events when the app opens or comes back, if connected (no network otherwise).
  function maybeRefresh() {
    const r = Net.rec(ID);
    if (!r.enabled || !tokenOk(r)) return;
    if (r.cache && r.cache.day === root.App.clock().day && Date.now() - r.cache.at < 3600000) return;
    readToday().catch(() => {});
  }
  root.addEventListener('rawaq:ready', maybeRefresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root.App && root.App.clock) maybeRefresh(); });

  const A = root.Actions, Ch = root.Changes;
  A['g-connect'] = () => Google.connect(true);
  A['g-reconnect'] = () => Google.connect(false);
  A['g-sync'] = async () => { const ok = await Net.run(ID); UI.toast(ok ? L('تزامن.', 'Synced.') : L('ما زبطت هالمرة. منجرب بعدين.', 'Didn\'t go through this time. We\'ll try later.')); };
  A['g-disconnect'] = () => UI.confirm({
    title: L('تفصل <bdi>Google</bdi>؟', 'Disconnect Google?'), body: L('رواق بيمسح التوكن وبينسى الربط. التقويم «رواق» بيضل بحسابك إذا بدك تمسحو بإيدك.', 'Rawaq deletes its token and forgets the link. The «رواق» calendar stays in your account if you want to delete it yourself.'),
    yes: L('خليه موصول', 'Keep it connected'), no: L('افصل', 'Disconnect'), noClass: 'clay', onNo: () => Google.disconnect(),
  });
  Ch['g-cfg'] = (el) => Net.save(ID, { config: { ...cfg(), [el.dataset.k]: el.value.trim() } });
  Ch['g-opt'] = (el) => {
    const next = { ...opts(), [el.dataset.k]: el.checked };
    Net.save(ID, el.dataset.k === 'useMain' ? { options: next, token: null, idMap: {}, lastError: 'auth' } : { options: next });
  };

  root.Google = Google;
})(typeof self !== 'undefined' ? self : this);
