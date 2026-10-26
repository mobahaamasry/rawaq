/* The one door to the network. A bridge that is off can't send anything: every request checks first.
   Bridges register themselves here; sync status is small and neutral, failures are calm and retried later. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;

  const list = [];
  const running = new Set();
  const lastAuto = {};

  const fail = (kind, extra) => Object.assign(new Error(kind), { kind }, extra || {});

  const Net = {
    rec(id) { return Store.get('integrations', id) || { id, enabled: false }; },
    save(id, patch) { return Store.put('integrations', { ...Net.rec(id), ...patch, id }); },

    async request(id, url, opts) {
      if (!Net.rec(id).enabled) throw fail('disabled');
      if (root.navigator && navigator.onLine === false) throw fail('offline');
      let res;
      try { res = await fetch(url, opts); } catch (e) { throw fail('offline'); }
      if (res.status === 401) throw fail('auth', { status: 401 });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw fail(res.status === 403 && /scope|permission|insufficient/i.test(body) ? 'auth' : 'other', { status: res.status, body });
      }
      if (res.status === 204) return null;
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    },

    // Only ever called from a "connect" tap: nothing remote loads at startup.
    loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(fail('offline'));
        document.head.appendChild(s);
      });
    },

    async run(id, opts) {
      const b = Bridges.get(id);
      if (!b || !Net.rec(id).enabled || running.has(id)) return false;
      running.add(id);
      try {
        const hash = b.fingerprint ? b.fingerprint() : null;
        await b.sync(opts || {});
        Net.save(id, { lastSync: new Date().toISOString(), lastError: null, lastHash: hash });
        return true;
      } catch (e) {
        console.warn('[rawaq] sync', id, e && (e.kind || e.message), e && e.body ? String(e.body).slice(0, 200) : '');
        if (Net.rec(id).enabled) Net.save(id, { lastError: e && e.kind === 'offline' ? 'offline' : e && e.kind === 'auth' ? 'auth' : 'other' });
        return false;
      } finally {
        running.delete(id);
      }
    },

    // Disconnecting forgets tokens, account and links; only non-secret settings stay.
    disconnect(id) {
      const r = Net.rec(id);
      Store.put('integrations', { id, enabled: false, config: r.config || {}, options: r.options || {} });
    },

    isRunning: (id) => running.has(id),

    statusLine(id) {
      const r = Net.rec(id);
      if (running.has(id)) return '<p class="small muted">' + L('عم نزامن…', 'Syncing…') + '</p>';
      if (r.lastError === 'offline') return '<p class="small muted">' + L('ما في نت، منجرب بعدين.', 'No connection, we\'ll try again later.') + '</p>';
      if (r.lastError === 'auth') return '<p class="small muted">' + L('بدها توصيل مرة تانية.', 'It needs connecting again.') + '</p>';
      if (r.lastError === 'other') return '<p class="small muted">' + L('ما زبطت المزامنة هالمرة. منجرب بعدين.', 'The sync didn\'t go through this time. We\'ll try again later.') + '</p>';
      if (r.lastSync) {
        const ck = root.App.clock(Date.parse(r.lastSync));
        return '<p class="small muted">' + T('آخر مزامنة: {d}، {t}', 'Last sync: {d}, {t}', { d: UI.fmtShort(ck.wallKey), t: UI.tsTime(r.lastSync) }) + '</p>';
      }
      return '<p class="small muted">' + L('لسا ما صار في مزامنة.', 'No sync yet.') + '</p>';
    },

    // Rows in the tables a bridge reads; used to sync only when something actually changed.
    fingerprint(obj) { return C.hash(JSON.stringify(obj)).toString(36); },
  };

  const Bridges = {
    list,
    register(def) { if (!list.some((b) => b.id === def.id)) list.push(def); },
    get: (id) => list.find((b) => b.id === id),
  };

  // Gentle background sync: shortly after a change or when the connection returns, only for bridges that are on.
  let timer = 0;
  function autoSync() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (root.navigator && navigator.onLine === false) return;
      for (const b of list) {
        const r = Net.rec(b.id);
        if (!r.enabled || !b.auto || !b.ready(r)) continue;
        if (b.fingerprint && r.lastHash === b.fingerprint() && r.lastError !== 'offline' && !b.stale(r)) continue;
        if (Date.now() - (lastAuto[b.id] || 0) < 60000) continue;
        lastAuto[b.id] = Date.now();
        Net.run(b.id, { auto: true });
      }
    }, 4000);
  }
  root.addEventListener('online', autoSync);
  root.addEventListener('rawaq:ready', () => { Store.onChange(autoSync); autoSync(); });

  // What never leaves, said once in plain words on every bridge card.
  Net.neverLine = () => '<p class="tiny muted" style="margin-top:8px">' + L('تنفّس، مشاعر سؤال الطاقة، الأسئلة المفتوحة، والإيمان ما بيطلعوا من رواق أبداً.', 'Reset, check-in feelings, open questions and faith never leave Rawaq.') + '</p>';
  Net.httpsNote = () => (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '' : '<p class="small" style="color:var(--sage)">' + L('هاد الجسر بيحتاج رواق يكون مفتوح من عنوان <bdi>https</bdi> (شوف <bdi>SETUP.md</bdi>).', 'This bridge needs Rawaq to be opened from an https address (see SETUP.md).') + '</p>';
  Net.canOAuth = () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  root.Net = Net;
  root.Bridges = Bridges;
})(typeof self !== 'undefined' ? self : this);
