/* Sleep: a light log, weekly averages as information, an optional wind-down card. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;
  const cfg = () => ({ tz: S().tz, dayEndHour: S().dayEndHour });
  const wallHm = (ts) => { const w = C.wallParts(ts, S().tz); return C.pad(w.hh) + ':' + C.pad(w.mm); };

  // The most recent night that has a bedtime but no wake time (within 20 hours).
  function openNight() {
    const now = Date.now();
    return Store.all('sleep').filter((n) => n.bedAt && !n.wakeAt && now - n.bedAt < 20 * 3600000).sort((a, b) => b.bedAt - a.bedAt)[0] || null;
  }

  const Sleep = {
    openNight,
    weekLine(wk) {
      const w = C.sleepWeek(Store.all('sleep'), wk, cfg());
      if (!w) return '';
      return T('نومك هالأسبوع: بالمعدل {d}، وكنت تنام حوالي {t}.', 'Your sleep this week: about {d} on average, falling asleep around {t}.', { d: UI.fmtDur(w.avgMin), t: UI.fmtTime(C.minToHm(w.avgBed)) });
    },
    // Rows for Today's quiet card.
    todayRow(ck) {
      if (!S().modules.sleep) return '';
      const open = openNight();
      const lastNight = Store.get('sleep', C.addDays(ck.day, -1));
      if (open && ck.wallMin >= 5 * 60 && ck.wallMin < 14 * 60) {
        return '<div class="row"><div class="row-main">' + L('صباح الخير. صحيت؟', 'Good morning. Awake?') + '</div><button class="btn soft sm" data-act="sleep-wake">' + L('صحيت', 'I\'m up') + '</button></div>';
      }
      if (!open && ck.wallMin >= 5 * 60 && ck.wallMin < 13 * 60 && !lastNight && !Sleep.skippedToday(ck.day)) {
        return '<div class="row"><div class="row-main">' + L('كيف كان النوم؟ إذا بدك تسجّلو.', 'How was the night? If you want to log it.') + '</div>' +
          '<button class="btn text sm" data-act="sleep-manual" data-night="' + C.addDays(ck.day, -1) + '">' + L('سجّل', 'Log') + '</button>' +
          '<button class="icon-btn" data-act="sleep-skip" aria-label="' + L('مش اليوم', 'Not today') + '">' + UI.icon('close') + '</button></div>';
      }
      if (!open && (ck.wallMin >= 21 * 60 || ck.wallMin < S().dayEndHour * 60)) {
        let html = '';
        const wd = S().sleep;
        if (wd.windDown) {
          const at = C.toLogical(C.hmToMin(wd.windDownAt), S().dayEndHour);
          if (ck.lm >= at) html += '<p class="small" style="margin:0 0 6px">' + L('قرّب وقت النوم. خلّص اللي بإيدك.', 'Bedtime is close. Wrap up what\'s in your hands.') + '</p>';
        }
        return html + '<div class="row"><div class="row-main">' + L('رايح تنام؟', 'Heading to sleep?') + '</div><button class="btn soft sm" data-act="sleep-bed">' + UI.icon('sleep') + L('تصبح على خير', 'Good night') + '</button></div>';
      }
      return '';
    },
    skippedToday(dayKey) { try { return sessionStorage.getItem('rawaq-sleep-skip') === dayKey; } catch (e) { return false; } },
  };

  root.Screens.sleep = {
    title: () => L('النوم', 'Sleep'),
    render() {
      const ck = root.App.clock();
      const wk = root.App.weekKey(ck.day);
      const open = openNight();
      const nights = Store.all('sleep').sort((a, b) => (a.id < b.id ? 1 : -1));
      let html = '<p class="muted small">' + L('النوم أرخص دوا للمزاج والتركيز. وهو مجال بحثك كمان.', 'Sleep is the cheapest medicine for mood and focus. And it\'s your research field too.') + '</p>' +
        '<div class="btns" style="margin:10px 0 14px">' +
        (open ? '<button class="btn soft" data-act="sleep-wake">' + L('صحيت هلق', 'I just woke up') + '</button>' : '<button class="btn soft" data-act="sleep-bed">' + UI.icon('sleep') + L('رايح نام هلق', 'Going to sleep now') + '</button>') +
        '<button class="btn" data-act="sleep-manual" data-night="' + C.addDays(ck.day, -1) + '">' + L('سجّل ليلة', 'Log a night') + '</button></div>';
      const line = Sleep.weekLine(wk);
      if (line) html += '<div class="card quiet plain"><p>' + line + '</p></div>';
      const weeks = [];
      for (let i = 7; i >= 0; i--) { const w = C.sleepWeek(Store.all('sleep'), C.addDays(wk, -7 * i), cfg()); if (w) weeks.push(w.avgMin); }
      if (weeks.length >= 2) html += '<div class="card plain"><div class="muted small">' + L('معدّل النوم، أسبوع بأسبوع', 'Average sleep, week by week') + '</div>' + UI.softLine(weeks, { cls: 'lamp', h: 70, lo: 240, hi: 600 }) + '</div>';
      html += '<div class="sec-title">' + L('الليالي', 'Nights') + '</div>';
      if (!nights.length) html += '<div class="card">' + UI.empty('rooftop', L('لما تسجّل أول ليلة، بتبين هون.', 'Once you log a night, it shows here.')) + '</div>';
      else html += '<div class="card plain"><div class="rows">' + nights.slice(0, 14).map((n) => '<div class="row tap" data-act="sleep-edit" data-id="' + n.id + '"><div class="row-main">' +
        '<div>' + UI.fmtDay(n.id) + '</div><div class="row-sub">' + (n.bedAt ? UI.tsTime(n.bedAt) : '…') + ' – ' + (n.wakeAt ? UI.tsTime(n.wakeAt) : '…') + '</div></div></div>').join('') + '</div></div>';
      const wd = S().sleep;
      html += '<div class="sec-title">' + L('قبل النوم', 'Before sleep') + '</div><div class="card plain">' +
        '<label class="switch"><span>' + L('ذكّرني على صفحة اليوم إنو قرّب وقت النوم', 'Remind me on Today when bedtime is close') + '</span><input type="checkbox" data-change="sleep-set" data-k="windDown"' + (wd.windDown ? ' checked' : '') + '></label>' +
        (wd.windDown ? '<label class="field"><span>' + L('من الساعة', 'From') + '</span><input type="time" value="' + wd.windDownAt + '" data-change="sleep-time"></label>' : '') + '</div>';
      return html;
    },
  };

  function nightForm(night, rec) {
    const bed = rec && rec.bedAt ? wallHm(rec.bedAt) : '00:30';
    const wake = rec && rec.wakeAt ? wallHm(rec.wakeAt) : '08:00';
    return '<h3>' + T('ليلة {d}', 'The night of {d}', { d: UI.fmtDay(night) }) + '</h3><form data-form="sleep-save"><input type="hidden" name="night" value="' + night + '">' +
      '<div class="grid2"><label class="field"><span>' + L('نمت', 'Slept') + '</span><input type="time" name="bed" value="' + bed + '" required></label>' +
      '<label class="field"><span>' + L('صحيت', 'Woke') + '</span><input type="time" name="wake" value="' + wake + '" required></label></div>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (rec ? '<button class="btn text" type="button" data-act="sleep-del" data-id="' + rec.id + '">' + L('امسحها', 'Delete') + '</button>' : '') + '</div></form>';
  }

  const A = root.Actions, F = root.Forms, Ch = root.Changes;
  A['sleep-bed'] = () => {
    const now = Date.now();
    const id = C.nightKey(now, cfg());
    Store.put('sleep', { ...(Store.get('sleep', id) || {}), id, bedAt: now, wakeAt: null });
    UI.toast(L('تصبح على خير. نوم هادي.', 'Good night. Sleep softly.'));
  };
  A['sleep-wake'] = () => {
    const n = openNight();
    if (!n) return;
    Store.patch('sleep', n.id, { wakeAt: Date.now() });
    UI.toast(L('صباح الخير.', 'Good morning.'));
  };
  A['sleep-manual'] = (el) => UI.sheet.open(() => nightForm(el.dataset.night, Store.get('sleep', el.dataset.night)));
  A['sleep-edit'] = (el) => { const n = Store.get('sleep', el.dataset.id); if (n) UI.sheet.open(() => nightForm(n.id, n)); };
  F['sleep-save'] = (d) => {
    UI.sheet.close();
    Store.put('sleep', { id: d.night, ...C.nightFromTimes(d.night, d.bed, d.wake, cfg()) });
  };
  A['sleep-del'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['sleep', el.dataset.id]]); };
  A['sleep-skip'] = () => { try { sessionStorage.setItem('rawaq-sleep-skip', root.App.clock().day); } catch (e) { /* ok */ } root.App.render(); };
  Ch['sleep-set'] = (el) => Store.setSettings({ sleep: { ...S().sleep, [el.dataset.k]: el.checked } });
  Ch['sleep-time'] = (el) => { if (el.value) Store.setSettings({ sleep: { ...S().sleep, windDownAt: el.value } }); };

  root.Sleep = Sleep;
})(typeof self !== 'undefined' ? self : this);
