/* Your sky (سماك): every win is a star. Stars never disappear, and no number is ever shown. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const W = 340;
  let mode = (() => { try { return localStorage.getItem('rawaq-wins-view') || 'sky'; } catch (e) { return 'sky'; } })();

  function winsFor(r) {
    let wins = Store.all('wins');
    if (r.query.year === '1') { const from = C.addDays(root.App.clock().day, -365); wins = wins.filter((w) => w.date >= from); }
    return wins;
  }

  function skySvg(wins) {
    const sky = C.skyLayout(wins, W);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + sky.height + '" role="img" aria-label="' + L('سماك', 'Your sky') + '">';
    for (const m of sky.months) svg += '<text class="mlabel" x="' + W / 2 + '" y="' + (m.y + 16) + '" text-anchor="middle">' + UI.esc(UI.fmtMonth(m.month)) + '</text>';
    for (const [a, b] of sky.lines) svg += '<line class="cline" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
    for (const s of sky.stars) {
      svg += '<circle class="halo" id="halo-' + s.id + '" cx="' + s.x + '" cy="' + s.y + '" r="' + (s.size * 5) + '"/>' +
        '<circle class="star' + (s.tw > 4 ? ' twk' : '') + '" id="star-' + s.id + '" cx="' + s.x + '" cy="' + s.y + '" r="' + s.size + '" style="animation-delay:' + s.tw + 's"/>' +
        '<circle class="star-hit" data-act="win-open" data-id="' + s.id + '" cx="' + s.x + '" cy="' + s.y + '" r="16"><title>' + UI.esc(Store.get('wins', s.id).text) + '</title></circle>';
    }
    return '<div class="skybox">' + svg + '</svg></div>';
  }

  function listView(wins) {
    const groups = {};
    for (const w of wins.slice().sort((a, b) => (a.date < b.date ? 1 : -1))) (groups[w.date.slice(0, 7)] = groups[w.date.slice(0, 7)] || []).push(w);
    return Object.keys(groups).sort().reverse().map((m) => '<div class="sec-title">' + UI.fmtMonth(m) + '</div><div class="card plain"><div class="rows">' +
      groups[m].map((w) => '<div class="row tap" data-act="win-open" data-id="' + w.id + '"><div class="row-main"><div>' + UI.ut(w.text) + '</div>' +
        '<div class="row-sub">' + UI.fmtShort(w.date) + (w.toldWho ? ' · ' + T('حكيت لـ {w}', 'Told {w}', { w: UI.raw(UI.ut(w.toldWho)) }) : '') + '</div></div></div>').join('') +
      '</div></div>').join('');
  }

  root.Screens.wins = {
    title: () => L('سماك', 'Your sky'),
    render(r) {
      const wins = winsFor(r);
      let html = '<div class="btns" style="justify-content:space-between;margin-bottom:12px">' +
        '<div class="chips"><button class="chip" data-act="wins-mode" data-m="sky" aria-pressed="' + (mode === 'sky') + '">' + L('سما', 'Sky') + '</button>' +
        '<button class="chip" data-act="wins-mode" data-m="list" aria-pressed="' + (mode === 'list') + '">' + L('قائمة', 'List') + '</button></div>' +
        '<button class="btn soft sm" data-act="win-add">' + UI.icon('plus') + L('نجمة جديدة', 'A new star') + '</button></div>';
      if (r.query.year === '1') html += '<p class="small muted">' + L('هالسنة بس.', 'Just this year.') + ' <a href="#/more/wins">' + L('كل السما', 'The whole sky') + '</a></p>';
      if (!wins.length) {
        return html + '<div class="card">' + UI.empty('rooftop', L('سماك هادية هلق. أول شي منيح بيصير، حطّو هون.', 'Your sky is quiet for now. The next good thing, put it here.')) + '</div>';
      }
      html += mode === 'sky' ? skySvg(wins) : listView(wins);
      html += '<div class="center" style="margin-top:14px"><button class="btn text" data-act="win-random">' + UI.icon('star') + L('نجمة عشوائية', 'A random star') + '</button></div>';
      return html;
    },
  };

  function winSheet(w) {
    return '<h3>' + UI.fmtFull(w.date) + '</h3>' + '<div style="font-size:18px;margin-bottom:12px">' + UI.utb(w.text) + '</div>' +
      (w.toldWho ? '<p class="muted small">' + T('حكيت لـ {w}', 'You told {w}', { w: UI.raw(UI.ut(w.toldWho)) }) + '</p>'
        : '<form class="inline-form" data-form="win-told"><input type="hidden" name="id" value="' + w.id + '"><input class="input" name="who" dir="auto" autocomplete="off" placeholder="' + L('بتستاهل حدا يعرف فيها. لمين؟', 'Someone deserves to hear about this. Who?') + '"><button class="btn soft">' + L('تمام', 'Okay') + '</button></form>') +
      '<div class="btns end" style="margin-top:12px"><button class="btn text sm" data-act="win-edit" data-id="' + w.id + '">' + UI.icon('edit') + L('عدّل', 'Edit') + '</button></div>';
  }
  function winForm(w) {
    const d = w ? w.date : root.App.clock().day;
    return '<h3>' + (w ? L('عدّل النجمة', 'Edit the star') : L('نجمة جديدة', 'A new star')) + '</h3><form data-form="win-save"><input type="hidden" name="id" value="' + (w ? w.id : '') + '">' +
      '<label class="field"><span>' + L('شو صار؟ كبير أو صغير.', 'What happened? Big or small.') + '</span><textarea name="text" dir="auto" required' + (w ? '' : ' autofocus') + '>' + UI.esc(w ? w.text : '') + '</textarea></label>' +
      '<div class="grid2"><label class="field"><span>' + L('إمتى؟', 'When?') + '</span><input type="date" name="date" value="' + d + '"></label>' +
      '<label class="field"><span>' + L('لمين حكيت؟ (إذا بدك)', 'Who did you tell? (optional)') + '</span><input name="toldWho" dir="auto" autocomplete="off" value="' + UI.esc(w ? w.toldWho || '' : '') + '"></label></div>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (w ? '<button class="btn text" type="button" data-act="win-delete" data-id="' + w.id + '">' + L('امسحها', 'Delete') + '</button>' : '') + '</div></form>';
  }

  const A = root.Actions, F = root.Forms;
  A['wins-mode'] = (el) => { mode = el.dataset.m; try { localStorage.setItem('rawaq-wins-view', mode); } catch (e) { /* ok */ } root.App.render(); };
  A['win-add'] = () => UI.sheet.open(() => winForm(null));
  A['win-open'] = (el) => { const w = Store.get('wins', el.dataset.id); if (w) UI.sheet.open(() => winSheet(Store.get('wins', w.id) || w)); };
  A['win-edit'] = (el) => { const w = Store.get('wins', el.dataset.id); if (w) UI.sheet.open(() => winForm(w)); };
  F['win-save'] = (d) => {
    const text = (d.text || '').trim();
    if (!text) return;
    const cur = d.id ? Store.get('wins', d.id) : { id: Store.uid(), createdAt: new Date().toISOString() };
    UI.sheet.close();
    Store.put('wins', { ...cur, text, date: d.date || root.App.clock().day, toldWho: (d.toldWho || '').trim() });
    if (!d.id) UI.toast(d.toldWho ? L('انحفظت.', 'Saved.') : L('انحفظت. وبتستاهل حدا يعرف فيها.', 'Saved. Someone deserves to hear about this.'));
  };
  F['win-told'] = (d) => { const who = (d.who || '').trim(); if (who) Store.patch('wins', d.id, { toldWho: who }); };
  A['win-delete'] = (el) => UI.confirm({
    title: L('متأكد؟ النجمة رح تنطفي.', 'Sure? The star will go out.'),
    yes: L('لا، خليها', 'No, keep it'), no: L('امسحها', 'Delete'), noClass: 'clay',
    onNo: () => UI.removeWithUndo([['wins', el.dataset.id]]),
  });
  A['win-random'] = () => {
    const wins = winsFor(UI.route());
    if (!wins.length) return;
    const w = wins[Math.floor(Math.random() * wins.length)];
    const star = document.getElementById('star-' + w.id), halo = document.getElementById('halo-' + w.id);
    if (star) { star.classList.add('lit'); halo.classList.add('on'); star.scrollIntoView({ block: 'center', behavior: UI.reducedMotion() ? 'auto' : 'smooth' }); }
    setTimeout(() => UI.sheet.open(() => winSheet(w), { onClose: () => { if (star) { star.classList.remove('lit'); halo.classList.remove('on'); } } }), star ? 700 : 0);
  };
})(typeof self !== 'undefined' ? self : this);
