/* Microsoft To Do: next tiny steps and application documents go to a «رواق» list; finishing a task in either
   app finishes it in the other; tasks from lists he picks come into the inbox, never onto Today.
   Sign-in: OAuth 2.0 authorization code + PKCE straight to the Microsoft identity platform (the same protocol MSAL
   uses, without the library). No offline_access, so no refresh token is ever issued or stored. */
(function (root) {
  'use strict';
  const UI = root.UI, Store = root.Store, Net = root.Net, P = root.Payloads;
  const { L, T } = UI;
  const ID = 'mstodo';
  const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SCOPE = 'Tasks.ReadWrite openid profile';
  const PKCE_KEY = 'rawaq-ms-pkce';

  const cfg = () => Net.rec(ID).config || {};
  const opts = () => ({ steps: true, docs: true, pullLists: [], ...(Net.rec(ID).options || {}) });
  const tokenOk = (r) => !!(r.token && r.token.exp > Date.now() + 30000);
  const redirectUri = () => location.origin + location.pathname;
  const req = (method, path, body) => Net.request(ID, GRAPH + path, {
    method, headers: { Authorization: 'Bearer ' + Net.rec(ID).token.access, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });

  function wanted() {
    const o = opts();
    return P.msTasks({ projects: Store.all('projects'), opportunities: Store.all('opportunities') }, Store.settings.lang)
      .filter((t) => (t.ref.kind === 'step' ? o.steps : o.docs));
  }

  async function ensureList() {
    const r = Net.rec(ID);
    if (r.listId) {
      try { await req('GET', '/me/todo/lists/' + r.listId); return r.listId; } catch (e) { if (e.status !== 404) throw e; }
    }
    const lists = await req('GET', '/me/todo/lists');
    const found = (lists.value || []).find((l) => l.displayName === 'رواق');
    const list = found || await req('POST', '/me/todo/lists', { displayName: 'رواق' });
    Net.save(ID, { listId: list.id, idMap: found ? (r.idMap || {}) : {}, lists: (lists.value || []).map((l) => ({ id: l.id, name: l.displayName })) });
    return list.id;
  }

  // Something finished over there: mark it finished here.
  function applyDone(t) {
    if (t.ref.kind === 'doc') {
      const o = Store.get('opportunities', t.ref.oppId);
      if (o && o.docs && !o.docs[t.ref.doc]) Store.put('opportunities', { ...o, docs: { ...o.docs, [t.ref.doc]: true } });
    } else {
      const p = Store.get('projects', t.ref.projectId);
      if (p && p.nextStep === t.ref.step) Store.put('projects', { ...p, nextStep: '' });
    }
  }

  async function sync() {
    if (!tokenOk(Net.rec(ID))) throw Object.assign(new Error('auth'), { kind: 'auth' });
    const listId = await ensureList();
    const base = '/me/todo/lists/' + listId + '/tasks';
    const remote = {};
    let page = await req('GET', base + '?$top=100');
    for (;;) {
      for (const t of page.value || []) remote[t.id] = t;
      if (!page['@odata.nextLink']) break;
      page = await Net.request(ID, page['@odata.nextLink'], { headers: { Authorization: 'Bearer ' + Net.rec(ID).token.access } });
    }
    const r = Net.rec(ID);
    const idMap = { ...(r.idMap || {}) }, dropped = { ...(r.dropped || {}) };
    const want = wanted();
    const keys = new Set(want.map((t) => t.key));
    for (const t of want) {
      const id = idMap[t.key];
      if (id && remote[id]) {
        const rt = remote[id];
        const doneThere = rt.status === 'completed';
        if (doneThere && !t.done) applyDone(t);
        else if (t.done && !doneThere) await req('PATCH', base + '/' + id, { status: 'completed' });
        if (rt.title !== t.title) await req('PATCH', base + '/' + id, { title: t.title });
      } else if (id && !remote[id]) {
        delete idMap[t.key]; dropped[t.key] = true; // deleted over there: don't bring it back
      } else if (!dropped[t.key]) {
        const made = await req('POST', base, { title: t.title, status: t.done ? 'completed' : 'notStarted' });
        idMap[t.key] = made.id;
      }
    }
    // A step that changed or a document that's no longer needed: done there too (never deleted).
    for (const key of Object.keys(idMap)) {
      if (keys.has(key)) continue;
      const id = idMap[key];
      if (remote[id] && remote[id].status !== 'completed') await req('PATCH', base + '/' + id, { status: 'completed' });
      delete idMap[key];
    }
    Net.save(ID, { idMap, dropped });
    // Pull from the lists he picked: into the inbox, once, due dates as plain information.
    for (const lid of opts().pullLists) {
      if (lid === listId) continue;
      const res = await req('GET', '/me/todo/lists/' + lid + '/tasks?$top=100&$filter=' + encodeURIComponent("status ne 'completed'"));
      const items = (res.value || []).map((t) => ({ id: t.id, title: t.title, due: t.dueDateTime && t.dueDateTime.dateTime ? t.dueDateTime.dateTime.slice(0, 10) : null }));
      for (const it of P.inboxFromExternal(items, 'mstodo', Store.all('inbox'), Store.uid, new Date().toISOString())) Store.put('inbox', it);
    }
    const lists = await req('GET', '/me/todo/lists');
    Net.save(ID, { lists: (lists.value || []).map((l) => ({ id: l.id, name: l.displayName })) });
  }

  const MsTodo = {
    async connect() {
      const clientId = (cfg().clientId || '').trim();
      if (!clientId) { UI.toast(L('حط الـ <bdi>Client ID</bdi> أول.', 'Add the Client ID first.')); return; }
      const verifier = P.pkceVerifier();
      const state = P.pkceVerifier().slice(0, 24);
      sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
      Net.save(ID, { enabled: true, lastError: null });
      const q = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri(), response_mode: 'query', scope: SCOPE,
        code_challenge: await P.pkceChallenge(verifier), code_challenge_method: 'S256', state, prompt: 'select_account',
      });
      location.assign(AUTH + '/authorize?' + q.toString());
    },
    // Back from Microsoft with ?code=…: exchange it, then tidy the address bar.
    async finishRedirect() {
      const sp = new URLSearchParams(location.search);
      const code = sp.get('code'), state = sp.get('state');
      if (!code && !sp.get('error')) return;
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch (e) { /* none */ }
      sessionStorage.removeItem(PKCE_KEY);
      history.replaceState(null, '', location.pathname + '#/more/bridges');
      if (!code || !saved || saved.state !== state || !Net.rec(ID).enabled) { if (Net.rec(ID).enabled) Net.save(ID, { lastError: 'auth' }); return; }
      try {
        const body = new URLSearchParams({ client_id: cfg().clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: saved.verifier, scope: SCOPE });
        const tok = await Net.request(ID, AUTH + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        let account = '';
        try { account = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).preferred_username || ''; } catch (e) { /* no name */ }
        Net.save(ID, { token: { access: tok.access_token, exp: Date.now() + (Number(tok.expires_in) || 3600) * 1000 }, account, lastError: null });
        Net.run(ID);
      } catch (e) {
        Net.save(ID, { lastError: e.kind === 'offline' ? 'offline' : 'auth' });
      }
    },
  };
  root.addEventListener('rawaq:ready', () => { MsTodo.finishRedirect(); });

  root.Bridges.register({
    id: ID, title: 'Microsoft To Do', auto: true,
    ready: tokenOk, stale: () => false,
    fingerprint: () => Net.fingerprint({ w: wanted(), o: opts() }),
    sync,
    card() {
      const r = Net.rec(ID), o = opts();
      let html = '<div class="card plain"><div class="card-head"><h2 class="card-title"><bdi>Microsoft To Do</bdi></h2>' +
        '<span class="tag' + (r.enabled ? ' sage' : '') + '">' + (r.enabled ? L('موصول', 'Connected') : L('مطفي', 'Off')) + '</span></div>';
      if (!r.enabled) {
        html += '<p class="small">' + L('بيكتب: أصغر خطوة جاية لكل مشروع شغّال، والأوراق المطلوبة للفرص، بقائمة اسمها «رواق». إذا خلّصت شي هونيك، بيخلص هون كمان.', 'Writes: the next tiny step of each active project and the documents your applications need, into a list called «رواق». Finish something there and it\'s finished here too.') + '</p>' +
          '<p class="small">' + L('بيقرا: مهام القوائم يلي بتختارها، وبتنحط بالصندوق، مو باليوم. التواريخ بتضل معلومة بس.', 'Reads: tasks from lists you choose; they land in the inbox, not on Today. Dates stay as plain information.') + '</p>' +
          Net.httpsNote() +
          '<label class="field" style="margin-top:10px"><span><bdi>Application (client) ID</bdi></span><input dir="ltr" autocomplete="off" value="' + UI.esc(cfg().clientId || '') + '" data-change="ms-cfg" data-k="clientId"></label>' +
          '<button class="btn soft" data-act="ms-connect"' + (Net.canOAuth() ? '' : ' disabled') + '>' + L('وصّل <bdi>Microsoft</bdi>', 'Connect Microsoft') + '</button>';
      } else {
        html += (r.account ? '<p class="small">' + UI.ut(r.account) + '</p>' : '') + Net.statusLine(ID) + '<div class="btns" style="margin-top:6px">' +
          (tokenOk(r) ? '<button class="btn soft sm" data-act="ms-sync">' + L('زامن هلق', 'Sync now') + '</button>'
            : '<button class="btn soft sm" data-act="ms-connect">' + L('وصّل <bdi>Microsoft</bdi> مرة تانية', 'Connect Microsoft again') + '</button>') + '</div>' +
          '<label class="switch"><span>' + L('ابعت أصغر خطوة جاية للمشاريع', 'Send the next tiny step of projects') + '</span><input type="checkbox" data-change="ms-opt" data-k="steps"' + (o.steps ? ' checked' : '') + '></label>' +
          '<label class="switch"><span>' + L('ابعت أوراق الفرص المطلوبة', 'Send application documents') + '</span><input type="checkbox" data-change="ms-opt" data-k="docs"' + (o.docs ? ' checked' : '') + '></label>';
        const lists = (r.lists || []).filter((l) => l.id !== r.listId);
        if (lists.length) {
          html += '<div class="field" style="margin-top:8px"><span>' + L('جيب مهام من هالقوائم للصندوق', 'Bring tasks from these lists into the inbox') + '</span>' +
            lists.map((l) => '<label class="check-row" style="color:var(--text)"><input type="checkbox" data-change="ms-pull" data-id="' + UI.esc(l.id) + '"' + (o.pullLists.includes(l.id) ? ' checked' : '') + '>' + UI.ut(l.name) + '</label>').join('') + '</div>';
        }
        html += '<button class="btn text sm" style="color:var(--clay)" data-act="ms-disconnect">' + L('افصل', 'Disconnect') + '</button>';
      }
      return html + Net.neverLine() + '</div>';
    },
  });

  const A = root.Actions, Ch = root.Changes;
  A['ms-connect'] = () => MsTodo.connect();
  A['ms-sync'] = async () => { const ok = await Net.run(ID); UI.toast(ok ? L('تزامن.', 'Synced.') : L('ما زبطت هالمرة. منجرب بعدين.', 'Didn\'t go through this time. We\'ll try later.')); };
  A['ms-disconnect'] = () => UI.confirm({
    title: L('تفصل <bdi>Microsoft To Do</bdi>؟', 'Disconnect Microsoft To Do?'), body: L('رواق بيمسح التوكن وبينسى الربط. القائمة «رواق» بتضل بحسابك.', 'Rawaq deletes its token and forgets the link. The «رواق» list stays in your account.'),
    yes: L('خليه موصول', 'Keep it connected'), no: L('افصل', 'Disconnect'), noClass: 'clay', onNo: () => Net.disconnect(ID),
  });
  Ch['ms-cfg'] = (el) => Net.save(ID, { config: { ...cfg(), [el.dataset.k]: el.value.trim() } });
  Ch['ms-opt'] = (el) => Net.save(ID, { options: { ...opts(), [el.dataset.k]: el.checked } });
  Ch['ms-pull'] = (el) => {
    const cur = opts().pullLists.filter((x) => x !== el.dataset.id);
    Net.save(ID, { options: { ...opts(), pullLists: el.checked ? cur.concat(el.dataset.id) : cur } });
  };

  root.MsTodo = MsTodo;
})(typeof self !== 'undefined' ? self : this);
