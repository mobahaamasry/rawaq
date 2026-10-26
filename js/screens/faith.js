/* Faith: reconnection, not compliance. One anchor prayer, presence only, his own words. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;
  const nowIso = () => new Date().toISOString();

  const PRAYERS = { fajr: ['الفجر', 'Fajr'], dhuhr: ['الضهر', 'Dhuhr'], asr: ['العصر', 'Asr'], maghrib: ['المغرب', 'Maghrib'], isha: ['العشا', 'Isha'] };
  const prayerName = (k) => L(...(PRAYERS[k] || PRAYERS.isha));

  const Faith = {
    // Rows for Today's quiet card.
    todayRows(ck) {
      if (!S().modules.faith) return '';
      let html = '';
      const a = S().faith.anchor;
      if (a) {
        const done = !!Store.get('prayers', ck.day);
        html += '<div class="row"><div class="row-main">' + T('صلاة {p}', '{p} prayer', { p: prayerName(a) }) + '</div>' +
          (done ? '<button class="btn text sm" data-act="faith-mark" style="color:var(--sage)">' + L('الحمدلله', 'Alhamdulillah') + '</button>'
            : '<button class="btn sage sm" data-act="faith-mark">' + L('صلّيتها', 'I prayed it') + '</button>') + '</div>';
      }
      if (S().faith.showVerse) {
        const verses = Store.all('faithNotes').filter((n) => n.kind === 'verse').sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1));
        if (verses.length) {
          const v = verses[C.hash(ck.day) % verses.length];
          html += '<div style="padding:10px 2px 4px;line-height:1.9">' + UI.utb(v.text) + '</div>';
        }
      }
      return html;
    },
  };

  root.Screens.faith = {
    title: () => L('الإيمان', 'Faith'),
    render() {
      const s = S();
      const ck = root.App.clock();
      const wk = root.App.weekKey(ck.day);
      const a = s.faith.anchor;
      const done = !!Store.get('prayers', ck.day);
      const verses = Store.all('faithNotes').filter((n) => n.kind === 'verse').sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1));
      const notes = Store.all('faithNotes').filter((n) => n.kind === 'note').sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
      let html = '<p class="muted small">' + L('للرجعة، مو للحساب. ما في شي هون بيعدّ عليك.', 'For coming back, not for keeping count. Nothing here counts against you.') + '</p>';
      html += '<div class="sec-title">' + L('صلاة وحدة بتمسك فيها', 'One prayer to hold on to') + '</div><div class="card plain">' +
        '<p class="small muted">' + L('اختار الأقرب لجدولك هلق.', 'Pick the one that fits your days now.') + '</p><div class="chips">' +
        Object.keys(PRAYERS).map((k) => '<button class="chip sage" data-act="faith-anchor" data-k="' + k + '" aria-pressed="' + (a === k) + '">' + prayerName(k) + '</button>').join('') + '</div>';
      if (a) {
        html += '<div class="btns" style="margin-top:12px">' + (done ? '<button class="btn text" data-act="faith-mark" style="color:var(--sage)">' + L('صلّيتها اليوم. الحمدلله', 'Prayed today. Alhamdulillah') + '</button>'
          : '<button class="btn sage" data-act="faith-mark">' + L('صلّيتها اليوم', 'I prayed it today') + '</button>') + '</div>' +
          UI.weekDots(C.weekPresence(Store.all('prayers'), wk), wk);
      }
      html += '</div>';
      html += '<div class="sec-title">' + L('كلمات إلك', 'Words for you') + '</div><div class="card plain">' +
        '<p class="small muted">' + L('آية أو دعاء أو فكرة، بكلماتك. وحدة منهن بتطلع على صفحة اليوم.', 'A verse, a prayer, or a thought, in your words. One of them shows on Today.') + '</p>' +
        (verses.length ? '<div class="rows">' + verses.map((v) => '<div class="row"><div class="row-main">' + UI.utb(v.text) + '</div><button class="icon-btn" data-act="faith-del" data-id="' + v.id + '" aria-label="' + L('شيل', 'Remove') + '">' + UI.icon('close') + '</button></div>').join('') + '</div>' : '') +
        '<form data-form="faith-add" style="margin-top:8px"><input type="hidden" name="kind" value="verse"><textarea class="input" id="faithVerse" name="text" dir="auto" style="min-height:64px"></textarea>' +
        '<button class="btn soft sm" style="margin-top:8px">' + L('زيد', 'Add') + '</button></form>' +
        '<label class="switch"><span class="small">' + L('ورجيني وحدة على صفحة اليوم', 'Show one on Today') + '</span><input type="checkbox" data-change="faith-set" data-k="showVerse"' + (s.faith.showVerse ? ' checked' : '') + '></label></div>';
      html += '<div class="sec-title">' + L('مساحة حرة', 'A free space') + '</div><div class="card plain">' +
        '<form data-form="faith-add"><input type="hidden" name="kind" value="note"><textarea class="input" id="faithNote" name="text" dir="auto" placeholder="' + L('اكتب شو ما بدك…', 'Write whatever you like…') + '"></textarea>' +
        '<button class="btn soft sm" style="margin-top:8px">' + L('احفظ', 'Save') + '</button></form>' +
        (notes.length ? '<div class="rows" style="margin-top:10px">' + notes.map((n) => '<div class="row"><div class="row-main"><div class="row-sub">' + UI.fmtShort(n.createdAt.slice(0, 10)) + '</div>' + UI.utb(n.text) + '</div>' +
          '<button class="icon-btn" data-act="faith-del" data-id="' + n.id + '" aria-label="' + L('امسح', 'Delete') + '">' + UI.icon('close') + '</button></div>').join('') + '</div>' : '') + '</div>';
      return html;
    },
  };

  const A = root.Actions, F = root.Forms, Ch = root.Changes;
  A['faith-anchor'] = (el) => Store.setSettings({ faith: { ...S().faith, anchor: S().faith.anchor === el.dataset.k ? null : el.dataset.k } });
  A['faith-mark'] = () => {
    const d = root.App.clock().day;
    if (Store.get('prayers', d)) Store.del('prayers', d);
    else Store.put('prayers', { id: d, at: nowIso() });
  };
  F['faith-add'] = (d, f) => {
    const text = (d.text || '').trim();
    if (!text) return;
    f.reset();
    Store.put('faithNotes', { id: Store.uid(), kind: d.kind === 'verse' ? 'verse' : 'note', text, createdAt: nowIso() });
  };
  A['faith-del'] = (el) => UI.confirm({
    title: L('تمسحها؟', 'Delete it?'), yes: L('لا، خليها', 'No, keep it'), no: L('امسحها', 'Delete'), noClass: 'clay',
    onNo: () => UI.removeWithUndo([['faithNotes', el.dataset.id]]),
  });
  Ch['faith-set'] = (el) => Store.setSettings({ faith: { ...S().faith, [el.dataset.k]: el.checked } });

  root.Faith = Faith;
})(typeof self !== 'undefined' ? self : this);
