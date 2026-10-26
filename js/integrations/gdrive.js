/* Sync between his devices through ONE file in his own Google Drive, in the hidden app folder only Rawaq can see.
   The file is sealed here with his passphrase (js/sync.js); Google stores it but can't read it. There is no Rawaq server.
   Each sync: download the file, open it, merge (newest change wins), save what's new here, upload if the file lacks something.
   The private corners (Reset, feelings, open questions, faith, decisions) stay on the device unless he turns them on.
   Sign-in uses Google Identity Services (token model): a short-lived access token only, never a refresh token. */
(function (root) {
  'use strict';
  const UI = root.UI, Store = root.Store, Net = root.Net, Sync = root.Sync;
  const { L, T } = UI;
  const ID = 'gdrive';
  const GSI = 'https://accounts.google.com/gsi/client';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILES = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const NAME = 'rawaq-sync.json';
  const subtle = () => root.crypto && root.crypto.subtle;
  const rand = (n) => root.crypto.getRandomValues(new Uint8Array(n));

  const fail = (kind) => Object.assign(new Error(kind), { kind });
  const opts = () => ({ includePrivate: false, remember: true, ...(Net.rec(ID).options || {}) });
  const clientId = () => ((Net.rec(ID).config || {}).clientId || (Net.rec('google').config || {}).clientId || '').trim();
  const tokenOk = (r) => !!(r.token && r.token.exp > Date.now() + 30000);
  const auth = (type) => ({ Authorization: 'Bearer ' + Net.rec(ID).token.access, ...(type ? { 'Content-Type': type } : {}) });

  // The key lives in memory for this visit; if he chose "remember", also in this device's storage (it can't be read back out).
  let memKey = null;
  const isKey = (k) => !!k && typeof CryptoKey !== 'undefined' && k instanceof CryptoKey;
  const key = () => memKey || (isKey(Net.rec(ID).key) ? Net.rec(ID).key : null);
  // After Google said no (expired or revoked), wait for a tap on «وصّل» instead of knocking again on every launch.
  const ready = (r) => tokenOk(r) && !!key() && !!r.salt && r.lastError !== 'auth';

  /* ---------- Drive ---------- */
  async function findFile() {
    const q = '?spaces=appDataFolder&fields=files(id,modifiedTime)&q=' + encodeURIComponent("name='" + NAME + "' and trashed=false");
    const res = await Net.request(ID, FILES + q, { headers: auth() });
    const f = (res && res.files) || [];
    return f.length ? f[0] : null;
  }
  const download = (fileId) => Net.request(ID, FILES + '/' + encodeURIComponent(fileId) + '?alt=media', { headers: auth() });
  async function upload(fileId, env) {
    const body = JSON.stringify(env);
    if (fileId) return Net.request(ID, UPLOAD + '/' + encodeURIComponent(fileId) + '?uploadType=media', { method: 'PATCH', headers: auth('application/json'), body });
    const b = 'rawaq' + Math.random().toString(36).slice(2);
    const multipart = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: NAME, parents: ['appDataFolder'] }) +
      '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + b + '--';
    return Net.request(ID, UPLOAD + '?uploadType=multipart&fields=id', { method: 'POST', headers: auth('multipart/related; boundary=' + b), body: multipart });
  }

  /* ---------- one sync ---------- */
  function localState() {
    return Sync.collect({ snapshot: Store.snapshot(), tomb: Store.tomb(), settings: Store.settings }, { includePrivate: opts().includePrivate });
  }
  // Tombstones for tables this device doesn't sync stay as they are here.
  function nextTomb(merged) {
    const inc = opts().includePrivate, out = {}, here = Store.tomb();
    for (const k of Object.keys(here)) if (!Sync.inScope(k.split('/')[0], inc)) out[k] = here[k];
    for (const k of Object.keys(merged.tomb)) if (Sync.inScope(k.split('/')[0], inc)) out[k] = merged.tomb[k];
    return out;
  }

  async function readRemote() {
    const f = await findFile();
    if (!f) return { file: null, data: null };
    const env = await download(f.id);
    let data;
    try { data = await Sync.open(subtle(), key(), env); } catch (e) {
      // The file was sealed with another passphrase (changed on his other device): ask again, calmly.
      if (e.kind === 'passphrase') { memKey = null; Net.save(ID, { key: null, lastError: 'passphrase' }); }
      throw e;
    }
    return { file: f, data, env };
  }

  async function syncOnce() {
    const r = Net.rec(ID);
    if (!tokenOk(r)) throw fail('auth');
    if (!key()) throw fail('passphrase');
    const since = Date.now();
    // A fresh start (he forgot the old passphrase): the old file is replaced by this device's copy, unread.
    const { file, data } = r.fresh ? { file: await findFile(), data: null } : await readRemote();
    const m = Sync.merge(localState(), data, { includePrivate: opts().includePrivate });
    const changed = m.apply.puts.length + m.apply.dels.length + (m.apply.settings ? 1 : 0);
    Store.applySync(m.apply, nextTomb(m.state), since);
    let fileId = file && file.id;
    if (m.upload) {
      const env = await Sync.seal(subtle(), key(), Sync.b64d(r.salt), r.iter || Sync.ITER, m.state, rand);
      const res = await upload(fileId, env);
      fileId = fileId || (res && res.id);
    }
    Net.save(ID, { fileId, lastIn: changed, lastOut: !!m.upload, fresh: false });
  }

  /* ---------- connecting ---------- */
  const Drive = {
    async connect(interactive) {
      if (!clientId()) { UI.toast(L('حط الـ <bdi>Client ID</bdi> أول.', 'Add the Client ID first.')); return; }
      if (!subtle()) { UI.toast(L('هالمتصفح ما فيه التشفير يلي بدنا ياه.', 'This browser lacks the encryption this needs.')); return; }
      Net.save(ID, { enabled: true });
      try { await Net.loadScript(GSI); } catch (e) { Net.save(ID, { lastError: 'offline' }); UI.toast(L('ما في نت، منجرب بعدين.', 'No connection, we\'ll try again later.')); return; }
      const client = root.google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: SCOPE,
        callback: (resp) => {
          if (resp.error) { Net.save(ID, { lastError: 'auth' }); return; }
          Net.save(ID, { token: { access: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000 }, lastError: null, everConnected: true });
          afterToken();
        },
        error_callback: () => Net.save(ID, { lastError: 'auth' }),
      });
      client.requestAccessToken({ prompt: Net.rec(ID).everConnected && !interactive ? '' : 'consent' });
    },
    disconnect() {
      const r = Net.rec(ID);
      memKey = null;
      if (r.token && r.token.access && root.google && root.google.accounts) {
        try { root.google.accounts.oauth2.revoke(r.token.access, () => {}); } catch (e) { /* the token expires on its own within the hour */ }
      }
      Net.disconnect(ID);
    },
  };

  async function afterToken() {
    if (key() && Net.rec(ID).salt) { Net.run(ID).then(toastResult); return; }
    let f = null;
    try { f = await findFile(); } catch (e) { Net.save(ID, { lastError: e.kind === 'auth' ? 'auth' : e.kind === 'offline' ? 'offline' : 'other' }); return; }
    UI.sheet.open(() => passForm(!!f));
  }

  function passForm(exists, fresh) {
    const o = opts();
    return '<h3>' + (exists ? L('كلمة سر المزامنة', 'Your sync passphrase') : L('اختار كلمة سر للمزامنة', 'Choose a sync passphrase')) + '</h3>' +
      '<p class="muted small">' + (exists
        ? L('في نسخة من رواق بـ <bdi>Drive</bdi> تبعك. اكتب نفس كلمة السر يلي اخترتها عالجهاز التاني.', 'There\'s a Rawaq copy in your Drive. Type the same passphrase you chose on your other device.')
        : L('هي بتقفل الملف قبل ما يطلع من الجهاز. ما حدا غيرك بيعرفها، ولا رواق. إذا نسيتها، الملف بـ <bdi>Drive</bdi> ما بينفتح، بس بياناتك على كل جهاز بتضل سليمة.', 'It locks the file before it leaves this device. Nobody but you knows it, not even Rawaq. If you forget it, the Drive copy can\'t be opened, but your data on each device stays safe.')) + '</p>' +
      '<form data-form="gd-pass"><input type="hidden" name="exists" value="' + (exists ? '1' : '') + '"><input type="hidden" name="fresh" value="' + (fresh ? '1' : '') + '">' +
      '<label class="field"><span>' + L('كلمة السر', 'Passphrase') + '</span><input type="password" name="p1" dir="auto" autocomplete="new-password" minlength="10" required autofocus></label>' +
      (exists ? '' : '<label class="field"><span>' + L('مرة تانية', 'Once more') + '</span><input type="password" name="p2" dir="auto" autocomplete="new-password" required></label>' +
        '<p class="tiny muted">' + L('أحسن شي جملة طويلة بتتذكرها، مو كلمة قصيرة.', 'A long sentence you\'ll remember works better than a short word.') + '</p>') +
      '<label class="switch"><span>' + L('تذكّرها على هالجهاز', 'Remember it on this device') + '</span><input type="checkbox" name="remember"' + (o.remember ? ' checked' : '') + '></label>' +
      '<div class="btns stretch" style="margin-top:14px"><button class="btn lamp">' + L('تمام', 'Okay') + '</button>' +
      '<button type="button" class="btn text" data-act="sheet-close">' + L('بعدين', 'Later') + '</button></div></form>' +
      (exists ? '<button class="btn text sm" style="margin-top:6px" data-act="gd-forgot">' + L('نسيتها؟ ابدأ ملف جديد', 'Forgot it? Start a new file') + '</button>' : '');
  }

  async function usePassphrase(d) {
    const pass = d.p1 || '';
    if (pass.length < 10) { UI.toast(L('خليها أطول شوي، ١٠ أحرف على الأقل.', 'Make it a bit longer, at least 10 characters.')); return; }
    if (!d.exists && pass !== d.p2) { UI.toast(L('الكلمتين مو متل بعض. جرّب مرة تانية.', 'The two don\'t match. Try once more.')); return; }
    const remember = !!d.remember;
    Net.save(ID, { options: { ...opts(), remember } });
    let remote = null, salt, iter;
    try {
      if (d.exists) {
        const f = await findFile();
        const env = f ? await download(f.id) : null;
        if (env) {
          salt = Sync.b64d(env.kdf.salt); iter = env.kdf.iter;
          const k = await Sync.deriveKey(subtle(), pass, salt, iter);
          try { remote = await Sync.open(subtle(), k, env); } catch (e) {
            if (e.kind === 'passphrase') { UI.toast(L('هالكلمة ما فتحت الملف. جرّب مرة تانية.', 'That passphrase didn\'t open the file. Try again.')); return; }
            throw e;
          }
          memKey = k;
        }
      }
      if (!memKey) { salt = rand(16); iter = Sync.ITER; memKey = await Sync.deriveKey(subtle(), pass, salt, iter); }
    } catch (e) {
      UI.toast(e.kind === 'offline' ? L('ما في نت، منجرب بعدين.', 'No connection, we\'ll try again later.') : L('ما زبطت هالمرة. جرّب كمان شوي.', 'That didn\'t work this time. Try again in a bit.'));
      return;
    }
    Net.save(ID, { salt: Sync.b64e(salt), iter, key: remember ? memKey : null, lastError: null, fresh: !d.exists && !!d.fresh });
    UI.sheet.close();
    const hasHere = Store.all('projects').length + Store.all('items').length + Store.all('wins').length > 0;
    if (remote && hasHere && !Net.rec(ID).lastSync) {
      // First time on this device, and both sides have things: ask once how to start.
      UI.confirm({
        title: L('كيف نبدأ على هالجهاز؟', 'How should this device start?'),
        body: L('«ضمّهن» بيخلّي كل شي من الجهازين. «خود نسخة Drive» بيبدّل يلي هون بيلي بـ <bdi>Drive</bdi>، منيح إذا هالجهاز جديد وفيه بس الأمثلة.',
          '"Combine" keeps everything from both devices. "Use the Drive copy" replaces what\'s here with what\'s in Drive, good if this device is new and only has the examples.'),
        yes: L('ضمّهن', 'Combine'), no: L('خود نسخة Drive', 'Use the Drive copy'), noClass: 'text',
        onYes: () => Net.run(ID).then(toastResult),
        onNo: () => replaceHere(remote).then(() => Net.run(ID)).then(toastResult),
      });
      return;
    }
    if (remote && !hasHere && !Net.rec(ID).lastSync) await replaceHere(remote);
    Net.run(ID).then(toastResult);
  }

  // Start this device from the Drive copy: every synced table becomes the file's; sign-ins and this device's own settings stay.
  async function replaceHere(remote) {
    const inc = opts().includePrivate;
    const snap = Store.snapshot();
    const tables = {};
    for (const t of Store.TABLES) tables[t] = Sync.inScope(t, inc) ? ((remote.tables || {})[t] || []) : snap[t];
    const here = Store.settings;
    const keep = {};
    for (const k of Sync.DEVICE_KEYS) if (k in here) keep[k] = here[k];
    const tomb = {};
    for (const k of Object.keys(remote.tomb || {})) if (Sync.inScope(k.split('/')[0], inc)) tomb[k] = remote.tomb[k];
    tables.meta = snap.meta.filter((r) => r.id !== 'settings' && r.id !== 'sync-tomb')
      .concat([{ ...here, ...(remote.settings || {}), ...keep, id: 'settings' }, { id: 'sync-tomb', map: tomb }]);
    await Store.importTablesRaw(tables);
  }

  function toastResult(ok) {
    const r = Net.rec(ID);
    if (!ok) { if (r.lastError === 'passphrase') UI.sheet.open(() => passForm(true)); return; }
    UI.toast(r.lastIn ? T('تزامن. وصل {n} من الجهاز التاني.', 'Synced. {n} came from your other device.', { n: UI.n(r.lastIn) }) : r.lastOut ? L('تزامن. آخر شي عندك صار بـ <bdi>Drive</bdi>.', 'Synced. Drive has your latest now.') : L('تزامن. كل شي متل بعضو.', 'Synced. Everything matches.'));
  }

  /* ---------- the card ---------- */
  function statusLine() {
    const r = Net.rec(ID);
    if (!Net.isRunning(ID) && r.lastError === 'passphrase') return '<p class="small muted">' + L('بدها كلمة السر مرة تانية.', 'It needs your passphrase again.') + '</p>';
    return Net.statusLine(ID);
  }

  root.Bridges.register({
    id: ID, title: 'Google Drive sync', auto: true,
    ready,
    stale: (r) => !r.lastSync || Date.now() - Date.parse(r.lastSync) > 15 * 60000,
    // Changes to the synced tables only (not sign-ins or sync status), so a sync doesn't wake the next one.
    fingerprint: () => { const s = localState(); return Net.fingerprint([Object.keys(s.tables).map((t) => [t, s.tables[t].length, Math.max(0, ...s.tables[t].map((x) => x._u || 0))]), Object.keys(s.tomb).length, s.settings && s.settings._u]); },
    sync: syncOnce,
    card() {
      const r = Net.rec(ID), o = opts();
      let html = '<div class="card plain"><div class="card-head"><h2 class="card-title">' + L('مزامنة بين أجهزتك', 'Sync between your devices') + '</h2>' +
        '<span class="tag' + (r.enabled ? ' sage' : '') + '">' + (r.enabled ? L('شغّالة', 'On') : L('مطفية', 'Off')) + '</span></div>';
      if (!r.enabled) {
        html += '<p class="small">' + L('بيخلّي اللابتوب والموبايل عندهم نفس الشي، عن طريق ملف واحد مخفي بـ <bdi>Google Drive</bdi> تبعك.', 'Keeps your laptop and phone in step, through one hidden file in your own Google Drive.') + '</p>' +
          '<p class="small">' + L('الملف بيتقفل على الجهاز بكلمة سر بتختارها انت. <bdi>Google</bdi> ما بيقدر يقراه، ورواق ما عندو سيرفر.', 'The file is locked on the device with a passphrase you choose. Google can\'t read it, and Rawaq has no server.') + '</p>' +
          Net.httpsNote() +
          '<label class="field" style="margin-top:10px"><span><bdi>OAuth Client ID</bdi></span><input dir="ltr" autocomplete="off" value="' + UI.esc(clientId()) + '" data-change="gd-cfg" data-k="clientId" placeholder="….apps.googleusercontent.com"></label>' +
          '<button class="btn soft" data-act="gd-connect"' + (Net.canOAuth() ? '' : ' disabled') + '>' + L('شغّل المزامنة', 'Turn on sync') + '</button>';
      } else {
        html += statusLine() + '<div class="btns" style="margin-top:6px">' +
          (!tokenOk(r) || r.lastError === 'auth' ? '<button class="btn soft sm" data-act="gd-reconnect">' + L('وصّل <bdi>Google</bdi> وزامن', 'Connect Google and sync') + '</button>'
            : !key() ? '<button class="btn soft sm" data-act="gd-pass">' + L('اكتب كلمة السر', 'Enter the passphrase') + '</button>'
              : '<button class="btn soft sm" data-act="gd-sync">' + L('زامن هلق', 'Sync now') + '</button>') + '</div>' +
          '<label class="switch"><span>' + L('ضمّ الزوايا الخاصة كمان', 'Include the private corners too') + '<br><span class="small muted">' +
            L('تنفّس، مشاعر سؤال الطاقة، الأسئلة المفتوحة، الإيمان والقرارات. بيطلعوا مقفولين بكلمة سرك بس.', 'Reset, check-in feelings, open questions, faith and decisions. They leave only locked with your passphrase.') +
          '</span></span><input type="checkbox" data-change="gd-opt" data-k="includePrivate"' + (o.includePrivate ? ' checked' : '') + '></label>' +
          '<p class="tiny muted">' + L('الموبايل بيزامن لحالو وهو مفتوح. بعد ساعة من التوصيل، <bdi>Google</bdi> بيطلب كبسة «وصّل» جديدة.', 'It syncs by itself while Rawaq is open. About an hour after connecting, Google asks for a fresh tap on "Connect".') + '</p>' +
          '<button class="btn text sm" style="color:var(--clay)" data-act="gd-disconnect">' + L('وقّف المزامنة', 'Turn off sync') + '</button>';
      }
      return html + (o.includePrivate && r.enabled ? '' : Net.neverLine()) + '</div>';
    },
  });

  // Pick up the other device's changes when Rawaq comes back to the front.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const r = Net.rec(ID);
    if (r.enabled && ready(r) && (!r.lastSync || Date.now() - Date.parse(r.lastSync) > 120000)) Net.run(ID);
  });
  root.addEventListener('rawaq:ready', () => { const r = Net.rec(ID); if (r.enabled && ready(r)) Net.run(ID); });

  const A = root.Actions, Ch = root.Changes, F = root.Forms;
  A['gd-connect'] = () => Drive.connect(true);
  A['gd-reconnect'] = () => Drive.connect(false);
  A['gd-pass'] = () => afterToken();
  A['gd-forgot'] = () => UI.confirm({
    title: L('نبدأ ملف جديد؟', 'Start a new file?'),
    body: L('الملف القديم بـ <bdi>Drive</bdi> بيتبدّل بنسخة هالجهاز، مقفولة بكلمة سر جديدة. ولا شي هون بينمسح. عالأجهزة التانية بتكتب الكلمة الجديدة.',
      'The old Drive file is replaced by this device\'s copy, locked with a new passphrase. Nothing here is deleted. On your other devices, type the new one.'),
    yes: L('إي، ملف جديد', 'Yes, a new file'), no: L('لأ', 'No'), noClass: 'text',
    onYes: () => setTimeout(() => UI.sheet.open(() => passForm(false, true)), 480),
  });
  A['gd-sync'] = () => Net.run(ID).then((ok) => { if (ok) toastResult(true); else if (Net.rec(ID).lastError === 'passphrase') toastResult(false); else UI.toast(L('ما زبطت هالمرة. منجرب بعدين.', 'Didn\'t go through this time. We\'ll try later.')); });
  A['gd-disconnect'] = () => UI.confirm({
    title: L('توقّف المزامنة؟', 'Turn off sync?'),
    body: L('كل شي هون بيضل متل ما هو. رواق بينسى الربط وكلمة السر على هالجهاز. الملف بـ <bdi>Drive</bdi> بيضل، وبتقدر تمسحو من إعدادات <bdi>Drive</bdi> ← إدارة التطبيقات.',
      'Everything here stays as it is. Rawaq forgets the link and the passphrase on this device. The Drive file stays; you can remove it in Drive settings → Manage apps.'),
    yes: L('خليها شغّالة', 'Keep it on'), no: L('وقّفها', 'Turn it off'), noClass: 'clay', onNo: () => Drive.disconnect(),
  });
  Ch['gd-cfg'] = (el) => Net.save(ID, { config: { ...(Net.rec(ID).config || {}), clientId: el.value.trim() } });
  Ch['gd-opt'] = (el) => Net.save(ID, { options: { ...opts(), [el.dataset.k]: el.checked } });
  F['gd-pass'] = (d) => usePassphrase(d);

  root.Drive = Drive;
})(typeof self !== 'undefined' ? self : this);
