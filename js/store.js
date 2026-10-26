/* Rawaq store: everything is held in memory and written through to IndexedDB on this device.
   If IndexedDB isn't available (some file:// setups), it falls back to localStorage. Nothing leaves the device. */
(function (root) {
  'use strict';
  const C = root.Core;

  const TABLES = [
    'meta', 'dayLogs', 'slots', 'items', 'projects', 'ideas', 'waiting', 'sessions', 'reviews',
    'exams', 'subjects', 'chapters', 'questions', 'inbox', 'wins', 'curiosity', 'letters', 'opportunities', 'resetUses',
    // Phase 2
    'papers', 'bodySessions', 'weighIns', 'goals', 'prayers', 'faithNotes', 'rawNotes', 'sleep',
    // Phase 3
    'integrations', 'presence',
    // Phase 5
    'decisions',
  ];
  const DB_NAME = 'rawaq';
  const DB_VERSION = 4; // v2: Phase 2 tables, v3: integrations + presence ideas, v4: decisions. Existing data is kept.
  const LS_KEY = 'rawaq-db-v1';

  const mem = {};
  for (const t of TABLES) mem[t] = new Map();
  let db = null;
  let backend = 'none';
  const listeners = new Set();

  function uid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function openIDB() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('no-idb'));
      let req;
      try { req = root.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const t of TABLES) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const d = req.result;
        // Another tab is upgrading the database: step aside and come back on the new version.
        d.onversionchange = () => { d.close(); root.location.reload(); };
        resolve(d);
      };
      req.onerror = () => reject(req.error || new Error('idb-open'));
      // Blocked means an older tab still holds the database. Wait for it; never fall back to
      // localStorage here, or the real data would look missing.
      req.onblocked = () => { Store.blocked = true; console.warn('[rawaq] waiting for another tab to close'); };
    });
  }

  function readAllIDB() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TABLES, 'readonly');
      const out = {};
      for (const t of TABLES) {
        const r = tx.objectStore(t).getAll();
        r.onsuccess = () => { out[t] = r.result; };
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
    });
  }

  function loadLocal() {
    try {
      const raw = root.localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  let lsTimer = null;
  function saveLocalSoon() {
    clearTimeout(lsTimer);
    lsTimer = setTimeout(() => {
      try { root.localStorage.setItem(LS_KEY, JSON.stringify(snapshot())); } catch (e) { console.warn('[rawaq] local save', e); }
    }, 150);
  }

  function writeIDB(table, op, value) {
    try {
      const tx = db.transaction(table, 'readwrite');
      const st = tx.objectStore(table);
      if (op === 'put') st.put(value); else st.delete(value);
      tx.onerror = () => console.warn('[rawaq] write', table, tx.error);
    } catch (e) { console.warn('[rawaq] write', table, e); }
  }

  function persist(table, op, value) {
    if (backend === 'idb') writeIDB(table, op, value);
    else if (backend === 'local') saveLocalSoon();
  }

  function fill(data) {
    for (const t of TABLES) {
      mem[t].clear();
      for (const r of data[t] || []) mem[t].set(r.id, r);
    }
  }

  function snapshot() {
    const out = {};
    for (const t of TABLES) out[t] = Array.from(mem[t].values());
    return out;
  }

  let notifyQueued = false;
  function notify() {
    if (notifyQueued) return;
    notifyQueued = true;
    Promise.resolve().then(() => { notifyQueued = false; for (const fn of listeners) fn(); });
  }

  // Deep-merge stored settings over defaults so new settings appear after updates.
  function mergeSettings(stored) {
    const d = root.Seed.defaultSettings();
    if (!stored) return d;
    const out = { ...d, ...stored };
    for (const k of ['ceilings', 'wip', 'review', 'modules', 'messageWindows', 'resetSuggestions', 'body', 'faith', 'sleep', 'focus', 'examSeason', 'patternQuiet']) {
      out[k] = { ...d[k], ...(stored[k] || {}) };
    }
    for (const cat of Object.keys(d.ceilings)) out.ceilings[cat] = { ...d.ceilings[cat], ...((stored.ceilings || {})[cat] || {}) };
    return out;
  }

  const Store = {
    TABLES,
    get backend() { return backend; },
    uid,

    async init() {
      try {
        db = await openIDB();
        fill(await readAllIDB());
        backend = 'idb';
      } catch (e) {
        console.warn('[rawaq] IndexedDB unavailable, using localStorage', e && e.message);
        fill(loadLocal());
        backend = 'local';
      }
      if (!mem.meta.get('install')) await Store.seed();
      mem.meta.set('settings', mergeSettings(mem.meta.get('settings')));
      if (root.navigator && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    },

    async seed() {
      const s = root.Seed.buildSeed(Date.now(), uid);
      const tables = { ...s.tables, meta: [s.settings, { id: 'install', installedAt: new Date().toISOString() }] };
      await Store.replaceAll(tables, { silent: true });
    },

    get settings() {
      if (!mem.meta.get('settings')) mem.meta.set('settings', mergeSettings(null));
      return mem.meta.get('settings');
    },
    setSettings(patch) {
      const next = { ...Store.settings, ...patch, id: 'settings' };
      Store.put('meta', next);
      return next;
    },

    all(t) { return Array.from(mem[t].values()); },
    get(t, id) { return mem[t].get(id) || null; },
    put(t, rec) {
      if (rec.id == null) rec.id = uid();
      mem[t].set(rec.id, rec);
      persist(t, 'put', rec);
      notify();
      return rec;
    },
    patch(t, id, changes) {
      const cur = mem[t].get(id);
      if (!cur) return null;
      return Store.put(t, { ...cur, ...changes });
    },
    del(t, id) {
      mem[t].delete(id);
      persist(t, 'delete', id);
      notify();
    },

    snapshot,

    // Replace every table in one go (import, clear, first seed).
    replaceAll(tables, opts) {
      const data = {};
      for (const t of TABLES) data[t] = tables[t] || [];
      fill(data);
      const done = () => { if (!(opts && opts.silent)) notify(); };
      if (backend === 'idb') {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(TABLES, 'readwrite');
          for (const t of TABLES) {
            const st = tx.objectStore(t);
            st.clear();
            for (const r of data[t]) st.put(r);
          }
          tx.oncomplete = () => { done(); resolve(); };
          tx.onerror = () => reject(tx.error);
        });
      }
      if (backend === 'local') { try { root.localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { /* quota */ } }
      done();
      return Promise.resolve();
    },

    exportJSON() {
      const nowIso = new Date().toISOString();
      Store.put('meta', { id: 'backup', lastAt: nowIso });
      const snap = snapshot();
      // Backups never carry sign-in tokens; after a restore you simply connect again.
      snap.integrations = snap.integrations.map(({ token, ...rest }) => rest);
      return JSON.stringify(C.makeExport(snap, nowIso), null, 1);
    },

    parseImport(text) {
      return C.readExport(JSON.parse(text), TABLES);
    },

    async importTables(tables) {
      await Store.replaceAll(tables);
      mem.meta.set('settings', mergeSettings(mem.meta.get('settings')));
    },

    // Clear everything. Starts empty (no starter examples), with default settings.
    async clearAll() {
      const s = root.Seed.defaultSettings();
      await Store.replaceAll({ meta: [s, { id: 'install', installedAt: new Date().toISOString(), cleared: true }] });
    },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  root.Store = Store;
})(typeof self !== 'undefined' ? self : this);
