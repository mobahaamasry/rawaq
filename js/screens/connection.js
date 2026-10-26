/* Connection nudges: being with real people, without turning them into a list or a number. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;

  const Connection = {
    // One gentle card, at most once a week, until he says "okay".
    todayCard(ck) {
      const wk = root.App.weekKey(ck.day);
      const ideas = Store.all('presence');
      const n = C.connectionNudge({ weekKey: wk, day: ck.day, shownWeek: S().connectionShownWeek, ideas, enabled: !!S().modules.connection });
      if (!n) return '';
      let body;
      if (n === 'family') body = '<p>' + L('في حدا من أهلك بتحب تقعد معو شوي هالأسبوع؟', 'Is there someone in your family you\'d like to sit with a little this week?') + '</p>';
      else if (n === 'share') {
        const recent = Store.all('wins').filter((w) => !w.toldWho && w.date >= C.addDays(ck.day, -7)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        body = '<p>' + L('في شي حلو صار ممكن تحكيه لحدا؟', 'Did something good happen that you could tell someone?') + '</p>' +
          (recent ? '<p class="small muted">' + T('مثلاً: {w}', 'Like: {w}', { w: UI.raw(UI.ut(recent.text)) }) + '</p>' : '');
      } else {
        const idea = ideas.find((i) => 'idea:' + i.id === n);
        body = '<p>' + T('فكرة لهالأسبوع: {i}', 'An idea for this week: {i}', { i: UI.raw(UI.ut(idea ? idea.text : '')) }) + '</p>';
      }
      return '<div class="card quiet">' + body + '<button class="btn text sm" data-act="conn-seen">' + L('تمام', 'Okay') + '</button></div>';
    },
  };

  root.Screens.connection = {
    title: () => L('قريبين', 'Close ones'),
    render() {
      const ideas = Store.all('presence').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return '<p class="muted small">' + L('مو قائمة ناس، ولا عدّاد. بس أفكار صغيرة لتكون حاضر مع يلي بتحبهن.', 'Not a list of people, and no counter. Just small ideas for being present with the ones you love.') + '</p>' +
        '<div class="card plain" style="margin-top:10px">' +
        '<label class="switch"><span>' + L('سؤال لطيف مرة بالأسبوع على صفحة اليوم', 'One gentle question a week on Today') + '</span><input type="checkbox" data-change="conn-toggle"' + (S().modules.connection ? ' checked' : '') + '></label></div>' +
        '<div class="sec-title">' + L('أفكار حضور، بكلماتك', 'Ways to be present, in your words') + '</div><div class="card plain">' +
        (ideas.length ? '<div class="rows">' + ideas.map((i) => '<div class="row"><div class="row-main">' + UI.ut(i.text) + '</div>' +
          '<button class="icon-btn" data-act="conn-del" data-id="' + i.id + '" aria-label="' + L('شيل', 'Remove') + '">' + UI.icon('close') + '</button></div>').join('') + '</div>' : '') +
        '<form class="inline-form" data-form="conn-add" style="margin-top:8px"><input class="input" id="connIdea" name="text" dir="auto" autocomplete="off" placeholder="' +
        L('عشا بدون موبايل، توصّل ماما مشوار…', 'Dinner without the phone, a drive with mum…') + '"><button class="btn soft">' + L('زيد', 'Add') + '</button></form></div>';
    },
  };

  const A = root.Actions;
  A['conn-seen'] = () => Store.setSettings({ connectionShownWeek: root.App.weekKey() });
  A['conn-del'] = (el) => UI.removeWithUndo([['presence', el.dataset.id]]);
  root.Forms['conn-add'] = (d, f) => {
    const text = (d.text || '').trim();
    if (!text) return;
    f.reset();
    Store.put('presence', { id: Store.uid(), text, createdAt: new Date().toISOString() });
  };
  root.Changes['conn-toggle'] = (el) => Store.setSettings({ modules: { ...S().modules, connection: el.checked } });

  root.Connection = Connection;
})(typeof self !== 'undefined' ? self : this);
