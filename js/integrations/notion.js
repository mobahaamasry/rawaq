/* Notion: weekly reviews and wins become pages in a database he picks; applications go to another.
   The Notion API can't be called from a browser, so requests go through a tiny Cloudflare Worker he deploys
   himself (setup/notion-worker.js). The Notion token lives only in that Worker, never in Rawaq. */
(function (root) {
  'use strict';
  const UI = root.UI, Store = root.Store, Net = root.Net, P = root.Payloads;
  const { L, T } = UI;
  const ID = 'notion';

  const cfg = () => Net.rec(ID).config || {};
  const base = () => (cfg().workerUrl || '').trim().replace(/\/+$/, '');
  const req = (method, path, body) => Net.request(ID, base() + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const lang = () => Store.settings.lang;

  function pages() {
    const c = cfg(), out = [];
    if (c.reviewsDb) {
      for (const r of Store.all('reviews')) if (r.doneAt) out.push({ key: 'r:' + r.id, page: P.notionReviewPage(r, c.reviewsDb, lang()) });
      for (const w of Store.all('wins')) out.push({ key: 'w:' + w.id, page: P.notionWinPage(w, c.reviewsDb, lang()) });
    }
    if (c.oppsDb) for (const o of Store.all('opportunities')) out.push({ key: 'o:' + o.id, page: P.notionOppPage(o, c.oppsDb) });
    return out;
  }

  async function sync() {
    const idMap = { ...(Net.rec(ID).idMap || {}) };
    const sent = { ...(Net.rec(ID).sent || {}) };
    for (const { key, page } of pages()) {
      const h = Net.fingerprint(page);
      if (sent[key] === h) continue;
      if (idMap[key]) {
        try { await req('PATCH', '/v1/pages/' + idMap[key], { properties: page.properties }); sent[key] = h; continue; } catch (e) { if (e.status !== 404) throw e; }
      }
      const made = await req('POST', '/v1/pages', page);
      idMap[key] = made.id;
      sent[key] = h;
    }
    Net.save(ID, { idMap, sent });
    if (cfg().pullDb) {
      const res = await req('POST', '/v1/databases/' + cfg().pullDb + '/query', { page_size: 50 });
      const items = (res.results || []).map((pg) => {
        const titleProp = Object.values(pg.properties || {}).find((p) => p.type === 'title');
        return { id: pg.id, title: titleProp ? titleProp.title.map((t) => t.plain_text).join('') : '' };
      });
      for (const it of P.inboxFromExternal(items, 'notion', Store.all('inbox'), Store.uid, new Date().toISOString())) Store.put('inbox', it);
    }
  }

  const Notion = {
    async connect() {
      if (!/^https:\/\//.test(base())) { UI.toast(L('حط رابط الـ <bdi>Worker</bdi> أول (بيبلّش بـ <bdi>https</bdi>).', 'Add the Worker address first (it starts with https).')); return; }
      Net.save(ID, { enabled: true, lastError: null });
      try {
        const me = await req('GET', '/v1/users/me');
        Net.save(ID, { account: (me && (me.name || (me.bot && me.bot.workspace_name))) || '' });
        Net.run(ID);
      } catch (e) {
        Net.save(ID, { enabled: false, lastError: null });
        UI.toast(e.kind === 'offline' ? L('ما في نت، منجرب بعدين.', 'No connection, we\'ll try again later.') : L('الـ <bdi>Worker</bdi> ما ردّ متل ما منتوقع. راجع الخطوات بـ <bdi>SETUP.md</bdi>.', 'The Worker didn\'t answer as expected. Check the steps in SETUP.md.'));
      }
    },
  };

  root.Bridges.register({
    id: ID, title: 'Notion', auto: true,
    ready: () => !!base(), stale: () => false,
    fingerprint: () => Net.fingerprint({ p: pages().map((x) => x.page), pull: cfg().pullDb || '' }),
    sync,
    card() {
      const r = Net.rec(ID), c = cfg();
      const field = (k, label, ph) => '<label class="field"><span>' + label + '</span><input dir="ltr" autocomplete="off" value="' + UI.esc(c[k] || '') + '" data-change="nt-cfg" data-k="' + k + '" placeholder="' + (ph || '') + '"></label>';
      let html = '<div class="card plain"><div class="card-head"><h2 class="card-title"><bdi>Notion</bdi></h2>' +
        '<span class="tag' + (r.enabled ? ' sage' : '') + '">' + (r.enabled ? L('موصول', 'Connected') : L('مطفي', 'Off')) + '</span></div>';
      if (!r.enabled) {
        html += '<p class="small">' + L('بيكتب: المراجعات الأسبوعية والنجوم كصفحات بقاعدة بيانات بتختارها، والفرص بقاعدة تانية.', 'Writes: weekly reviews and wins as pages in a database you choose, and applications in another.') + '</p>' +
          '<p class="small">' + L('بيقرا (إذا بدك): قاعدة "مهام" أو "أفكار" لجوّا الصندوق.', 'Reads (if you want): a "Tasks" or "Ideas" database, into the inbox.') + '</p>' +
          '<p class="small muted">' + L('بيحتاج <bdi>Worker</bdi> صغير بتنزّلو انت على <bdi>Cloudflare</bdi>. التوكن بيضل عندك هونيك، مو برواق. الخطوات بـ <bdi>SETUP.md</bdi>.', 'Needs a small Worker you deploy yourself on Cloudflare. The token stays there, not in Rawaq. Steps in SETUP.md.') + '</p>';
      } else {
        html += (r.account ? '<p class="small">' + UI.ut(r.account) + '</p>' : '') + Net.statusLine(ID) +
          '<div class="btns" style="margin:6px 0 10px"><button class="btn soft sm" data-act="nt-sync">' + L('زامن هلق', 'Sync now') + '</button></div>';
      }
      html += field('workerUrl', L('رابط الـ <bdi>Worker</bdi>', 'Worker address'), 'https://….workers.dev') +
        field('reviewsDb', L('قاعدة المراجعات والنجوم (<bdi>database ID</bdi>)', 'Reviews & wins database ID')) +
        field('oppsDb', L('قاعدة الفرص (إذا بدك)', 'Applications database ID (optional)')) +
        field('pullDb', L('قاعدة بتنجاب منها مهام للصندوق (إذا بدك)', 'A database to pull into the inbox (optional)'));
      html += r.enabled ? '<button class="btn text sm" style="color:var(--clay)" data-act="nt-disconnect">' + L('افصل', 'Disconnect') + '</button>'
        : '<button class="btn soft" data-act="nt-connect">' + L('وصّل <bdi>Notion</bdi>', 'Connect Notion') + '</button>';
      return html + Net.neverLine() + '</div>';
    },
  });

  const A = root.Actions, Ch = root.Changes;
  A['nt-connect'] = () => Notion.connect();
  A['nt-sync'] = async () => { const ok = await Net.run(ID); UI.toast(ok ? L('تزامن.', 'Synced.') : L('ما زبطت هالمرة. منجرب بعدين.', 'Didn\'t go through this time. We\'ll try later.')); };
  A['nt-disconnect'] = () => UI.confirm({
    title: L('تفصل <bdi>Notion</bdi>؟', 'Disconnect Notion?'), body: L('رواق بينسى الربط والصفحات يلي بعتها. الصفحات بتضل بـ <bdi>Notion</bdi>.', 'Rawaq forgets the link and the pages it sent. The pages stay in Notion.'),
    yes: L('خليه موصول', 'Keep it connected'), no: L('افصل', 'Disconnect'), noClass: 'clay', onNo: () => Net.disconnect(ID),
  });
  Ch['nt-cfg'] = (el) => Net.save(ID, { config: { ...cfg(), [el.dataset.k]: el.value.trim().replace(/-/g, el.dataset.k === 'workerUrl' ? '-' : '') } });

  root.Notion = Notion;
})(typeof self !== 'undefined' ? self : this);
