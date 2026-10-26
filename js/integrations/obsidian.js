/* Obsidian: a vault is just a folder of Markdown files. No network; the browser writes into a folder he picks.
   On phones (no folder access) the same files come as a .zip to drop into the vault. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store, Net = root.Net, X = root.Exports, P = root.Payloads;
  const { L, T } = UI;
  const ID = 'obsidian';

  // The folder handle lives in its own small database so backups stay plain JSON.
  function hdb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('rawaq-handles', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('h');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function handleOp(mode, value) {
    const db = await hdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('h', mode === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore('h');
      const req = mode === 'get' ? st.get(ID) : mode === 'put' ? st.put(value, ID) : st.delete(ID);
      tx.oncomplete = () => { db.close(); resolve(mode === 'get' ? req.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  const supported = () => typeof root.showDirectoryPicker === 'function';
  const opts = () => ({ folder: 'Rawaq', letters: false, raw: false, autoAfterReview: false, ...(Net.rec(ID).options || {}) });
  function vaultState() {
    const t = (n) => Store.all(n);
    return { settings: Store.settings, reviews: t('reviews'), wins: t('wins'), papers: t('papers'), projects: t('projects'), inbox: t('inbox'), letters: t('letters'), rawNotes: t('rawNotes') };
  }
  const files = () => { const o = opts(); return X.vaultFiles(vaultState(), { folder: o.folder, letters: o.letters, raw: o.raw, lang: Store.settings.lang }); };

  async function writeFiles(dir, list) {
    for (const f of list) {
      const parts = f.path.split('/');
      let d = dir;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
      const w = await fh.createWritable();
      await w.write(f.content);
      await w.close();
    }
    return list.length;
  }
  async function permitted(h, interactive) {
    const o = { mode: 'readwrite' };
    if ((await h.queryPermission(o)) === 'granted') return true;
    return !!interactive && (await h.requestPermission(o)) === 'granted';
  }

  const Obsidian = {
    supported, writeFiles, files,
    async connect() {
      const h = await root.showDirectoryPicker({ id: 'rawaq-vault', mode: 'readwrite' });
      await handleOp('put', h);
      Net.save(ID, { enabled: true, vault: h.name, options: opts(), lastError: null });
    },
    async send(interactive) {
      const h = await handleOp('get');
      if (!h || !(await permitted(h, interactive))) throw Object.assign(new Error('auth'), { kind: 'auth' });
      const n = await writeFiles(h, files());
      Net.save(ID, { lastSync: new Date().toISOString(), lastError: null, lastCount: n });
      return n;
    },
    downloadZip() {
      UI.download('rawaq-obsidian-' + root.App.clock().day + '.zip', new Blob([X.zip(files())], { type: 'application/zip' }));
    },
    async importNote() {
      const [fh] = await root.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] } }] });
      const text = await (await fh.getFile()).text();
      const items = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|#+\s+|\d+\.\s+)/, '').trim())
        .filter((l) => l && l !== '---' && !/^[a-z_]+:\s/.test(l)).map((l) => ({ id: C.hash(l).toString(36), title: l }));
      const fresh = P.inboxFromExternal(items, 'obsidian', Store.all('inbox'), Store.uid, new Date().toISOString());
      for (const it of fresh) Store.put('inbox', it);
      return fresh.length;
    },
    async afterReview() {
      const r = Net.rec(ID);
      if (!r.enabled || !opts().autoAfterReview) return;
      try { await Obsidian.send(false); } catch (e) { Net.save(ID, { lastError: 'auth' }); }
    },
    async disconnect() { try { await handleOp('delete'); } catch (e) { /* nothing stored */ } Net.disconnect(ID); },
  };

  root.Bridges.register({
    id: ID, title: 'Obsidian', auto: false,
    ready: () => true, stale: () => false,
    sync: () => Obsidian.send(true),
    card() {
      const r = Net.rec(ID), o = opts();
      let html = '<div class="card plain"><div class="card-head"><h2 class="card-title"><bdi>Obsidian</bdi></h2>' +
        '<span class="tag' + (r.enabled ? ' sage' : '') + '">' + (r.enabled ? L('موصول', 'Connected') : L('مطفي', 'Off')) + '</span></div>';
      if (!r.enabled) {
        html += '<p class="small">' + L('بيكتب ملفات <bdi>Markdown</bdi> بمجلد <bdi>Rawaq/</bdi> جوّا الـ <bdi>vault</bdi> تبعك: المراجعات الأسبوعية، النجوم، الأوراق، المشاريع، ويلي بتختار تبعتو من الصندوق. الرسائل والكتابة الخام بس إذا شغّلتهن.', 'Writes Markdown files into a Rawaq/ folder inside your vault: weekly reviews, wins, papers, projects, and inbox items you choose to send. Letters and raw notes only if you turn them on.') + '</p>' +
          '<p class="small muted">' + L('بيقرا بس الملاحظة يلي بتختارها للاستيراد. ما في نت أبداً، كلو على جهازك.', 'It only reads a note you pick to import. No network at all; it all happens on this device.') + '</p>';
        html += supported()
          ? '<button class="btn soft" data-act="obs-connect">' + L('اختار مجلد الـ <bdi>vault</bdi>', 'Choose the vault folder') + '</button>'
          : '<p class="small" style="color:var(--sage)">' + L('هالمتصفح ما بيقدر يكتب بمجلد مباشرة (متل الموبايل). نزّل الملفات كـ <bdi>.zip</bdi> وحطهن بالـ <bdi>vault</bdi>.', 'This browser can\'t write into a folder directly (phones can\'t). Download the files as a .zip and drop them into the vault.') + '</p>';
        html += ' <button class="btn text sm" data-act="obs-zip">' + L('نزّل كـ <bdi>Markdown (.zip)</bdi>', 'Download as Markdown (.zip)') + '</button>';
      } else {
        html += '<p class="small">' + T('الـ vault: {v}', 'Vault: {v}', { v: UI.raw('<bdi>' + UI.esc(r.vault || '') + '</bdi>') }) + '</p>' + Net.statusLine(ID) +
          '<div class="btns" style="margin-top:6px"><button class="btn soft sm" data-act="obs-send">' + L('ابعت لـ <bdi>Obsidian</bdi>', 'Send to Obsidian') + '</button>' +
          '<button class="btn sm" data-act="obs-import">' + L('استورد من ملاحظة', 'Import from a note') + '</button>' +
          '<button class="btn text sm" data-act="obs-zip">' + L('نزّل <bdi>.zip</bdi>', 'Download .zip') + '</button></div>' +
          '<label class="field" style="margin-top:12px"><span>' + L('اسم المجلد جوّا الـ <bdi>vault</bdi>', 'Folder inside the vault') + '</span><input dir="ltr" value="' + UI.esc(o.folder) + '" data-change="obs-opt-text" data-k="folder"></label>' +
          '<label class="switch"><span>' + L('ابعت الرسائل كمان', 'Send letters too') + '</span><input type="checkbox" data-change="obs-opt" data-k="letters"' + (o.letters ? ' checked' : '') + '></label>' +
          '<label class="switch"><span>' + L('ابعت الكتابة الخام كمان', 'Send raw notes too') + '</span><input type="checkbox" data-change="obs-opt" data-k="raw"' + (o.raw ? ' checked' : '') + '></label>' +
          '<label class="switch"><span>' + L('ابعت لحالو بعد كل مراجعة أسبوعية', 'Send automatically after each weekly review') + '</span><input type="checkbox" data-change="obs-opt" data-k="autoAfterReview"' + (o.autoAfterReview ? ' checked' : '') + '></label>' +
          '<button class="btn text sm" style="color:var(--clay)" data-act="obs-disconnect">' + L('افصل', 'Disconnect') + '</button>';
      }
      return html + Net.neverLine() + '</div>';
    },
  });

  const A = root.Actions, Ch = root.Changes;
  const calm = (e) => { if (e && e.name === 'AbortError') return; console.warn('[rawaq] obsidian', e); UI.toast(L('ما زبطت هالمرة. جرّب كمان شوي.', 'That didn\'t work this time. Try again in a bit.')); };
  A['obs-connect'] = async () => { try { await Obsidian.connect(); UI.toast(L('موصول. الملفات بتروح لمجلد <bdi>Rawaq/</bdi>.', 'Connected. Files go into the Rawaq/ folder.')); } catch (e) { calm(e); } };
  A['obs-send'] = async () => {
    try { const n = await Obsidian.send(true); UI.toast(T('انبعتوا {n} ملف لـ Obsidian.', 'Sent {n} files to Obsidian.', { n: UI.n(n) })); } catch (e) { if (e.kind === 'auth') Net.save(ID, { lastError: 'auth' }); calm(e); }
  };
  A['obs-zip'] = () => Obsidian.downloadZip();
  A['obs-import'] = async () => {
    try { const n = await Obsidian.importNote(); UI.toast(n ? T('انحطوا {n} بالصندوق.', '{n} went into the inbox.', { n: UI.n(n) }) : L('ما في شي جديد بهالملاحظة.', 'Nothing new in that note.')); } catch (e) { calm(e); }
  };
  A['obs-disconnect'] = () => UI.confirm({
    title: L('تفصل <bdi>Obsidian</bdi>؟', 'Disconnect Obsidian?'), body: L('رواق بينسى المجلد. الملفات يلي انكتبت بتضل بالـ <bdi>vault</bdi>.', 'Rawaq forgets the folder. Files already written stay in your vault.'),
    yes: L('خليه موصول', 'Keep it connected'), no: L('افصل', 'Disconnect'), noClass: 'clay', onNo: () => Obsidian.disconnect(),
  });
  Ch['obs-opt'] = (el) => Net.save(ID, { options: { ...opts(), [el.dataset.k]: el.checked } });
  Ch['obs-opt-text'] = (el) => { const v = el.value.trim().replace(/[\\:*?"<>|]/g, '') || 'Rawaq'; Net.save(ID, { options: { ...opts(), folder: v } }); };

  root.Obsidian = Obsidian;
})(typeof self !== 'undefined' ? self : this);
