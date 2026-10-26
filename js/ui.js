/* Rawaq UI kit: copy helpers, formatting, hand-drawn SVG motifs, sheet, toast, petals, chime. */
(function (root) {
  'use strict';
  const C = root.Core;
  const S = () => root.Store.settings;

  root.Screens = root.Screens || {};
  root.Actions = root.Actions || {};
  root.Forms = root.Forms || {};
  root.Changes = root.Changes || {};

  const UI = {};

  /* ---------- copy ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  UI.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  UI.isAr = () => S().lang !== 'en';
  UI.digits = (s) => (S().numerals === 'eastern' ? C.toEastern(s) : C.toWestern(s));
  // Static app copy. Never pass user text or markup with numbers here; use T() for values.
  UI.L = (ar, en) => (UI.isAr() ? UI.digits(ar) : (en == null ? ar : en));
  // Copy with {placeholders}. Values are inserted after digit conversion; strings are escaped unless wrapped in UI.raw().
  UI.T = (ar, en, vars) => {
    let s = UI.L(ar, en);
    for (const k in vars || {}) {
      const v = vars[k];
      const val = v && v.__raw != null ? v.__raw : UI.esc(v);
      s = s.split('{' + k + '}').join(val);
    }
    return s;
  };
  UI.raw = (html) => ({ __raw: html });
  UI.n = (x) => (UI.isAr() ? UI.digits(String(x)) : String(x));
  // User text: escaped, direction decided by its own content.
  UI.ut = (s) => '<span class="ut" dir="auto">' + UI.esc(s) + '</span>';
  UI.utb = (s) => '<div class="ut" dir="auto">' + UI.esc(s).replace(/\n/g, '<br>') + '</div>';

  /* ---------- dates and durations ---------- */
  function locale(ext) {
    if (!UI.isAr()) return 'en-GB' + (ext ? '-u-' + ext : '');
    const nu = S().numerals === 'eastern' ? 'nu-arab' : 'nu-latn';
    return 'ar-SY-u-' + (ext ? ext + '-' : '') + nu;
  }
  const fcache = {};
  function fmt(loc, opt) {
    const k = loc + JSON.stringify(opt);
    return fcache[k] || (fcache[k] = new Intl.DateTimeFormat(loc, opt));
  }
  UI.fmtDate = (key, opt) => fmt(locale(), { timeZone: 'UTC', ...(opt || { day: 'numeric', month: 'long' }) }).format(new Date(C.keyToUTC(key)));
  UI.fmtDay = (key) => UI.fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
  UI.fmtShort = (key) => UI.fmtDate(key, { day: 'numeric', month: 'short' });
  UI.fmtFull = (key) => UI.fmtDate(key, { day: 'numeric', month: 'long', year: 'numeric' });
  UI.fmtMonth = (ym) => UI.fmtDate(ym + '-01', { month: 'long', year: 'numeric' });
  UI.fmtHijri = (key) => fmt(locale('ca-islamic-umalqura'), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(C.keyToUTC(key)));
  UI.weekdayName = (wd, short) => UI.fmtDate(C.addDays('2026-10-25', wd), { weekday: short ? 'short' : 'long' }); // 2026-10-25 is a Sunday
  UI.fmtTime = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    const loc = UI.isAr() ? locale() : 'en-US';
    return fmt(loc, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
  };
  UI.fmtRange = (a, b) => UI.fmtTime(a) + ' – ' + UI.fmtTime(b);
  // A timestamp's wall-clock time in the chosen time zone.
  UI.tsTime = (ts) => { const w = C.wallParts(typeof ts === 'string' ? Date.parse(ts) : ts, S().tz); return UI.fmtTime(C.pad(w.hh) + ':' + C.pad(w.mm)); };
  UI.hour12 = (hm) => { const h = Number(hm.split(':')[0]) % 12 || 12; const m = hm.split(':')[1]; return UI.n(m === '00' ? h : h + ':' + m); };
  UI.fmtDur = (min) => {
    min = Math.max(0, Math.round(min));
    const h = Math.floor(min / 60), m = min % 60;
    if (!UI.isAr()) return [h ? h + ' hr' : '', m || !h ? m + ' min' : ''].filter(Boolean).join(' ');
    const parts = [];
    if (h) parts.push(C.arCount(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'));
    if (m || !h) parts.push(C.arCount(m || 0, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة'));
    return UI.digits(parts.join(' و '));
  };
  UI.hoursWord = (h) => (UI.isAr() ? UI.digits(C.arCount(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')) : h + (h === 1 ? ' hour' : ' hours'));
  UI.weeksWord = (w) => (UI.isAr() ? UI.digits(C.arCount(w, 'أسبوع', 'أسبوعين', 'أسابيع', 'أسبوع')) : w + (w === 1 ? ' week' : ' weeks'));

  /* ---------- names ---------- */
  const CAT = {
    study: ['دراسة', 'Study'], research: ['بحث', 'Research'], team: ['الفريق', 'Team'], teaching: ['تدريس', 'Teaching'],
    personal: ['شخصي', 'Personal'], learning: ['تعلّم', 'Learning'], free: ['حر', 'Free'],
  };
  UI.catName = (c) => UI.L(...(CAT[c] || CAT.free));
  UI.AREAS = ['research', 'team', 'teaching', 'personal', 'learning'];
  const SLOT = {
    study: ['دراسة', 'Study'], gym: ['رياضة', 'Gym'], course: ['كورس', 'Course'], team: ['الفريق', 'Team'],
    rest: ['وقت إلك', 'Your time'], other: ['غير شي', 'Other'],
  };
  UI.SLOT_TYPES = Object.keys(SLOT);
  UI.slotName = (t) => UI.L(...(SLOT[t] || SLOT.other));
  UI.slotLabel = (s) => (s.label ? s.label : UI.slotName(s.type));

  /* ---------- icons (thin line, 1.5px, round caps) ---------- */
  const IC = {
    today: '<path d="M5 20.5V11a7 7 0 0 1 14 0v9.5"/><path d="M3 20.5h18"/><path d="M9.5 20.5v-5a2.5 2.5 0 0 1 5 0v5"/>',
    week: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v3.5M16 3v3.5"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
    focus: '<path d="M19.5 14.2A8 8 0 1 1 9.8 4.5a6.4 6.4 0 0 0 9.7 9.7z"/>',
    work: '<path d="M12 6.6C10 5.1 7 4.6 3.5 5.1v13.2c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5.1C17 4.6 14 5.1 12 6.6z"/><path d="M12 6.6v13.2"/>',
    more: '<path d="M12 3.2l8.8 8.8-8.8 8.8L3.2 12z"/><path d="M5.8 5.8h12.4v12.4H5.8z"/>',
    breathe: '<path d="M2.5 12.5c2.3-4.4 4.7-4.4 7 0s4.7 4.4 7 0c1.3-2.4 2.7-3.2 5-2.2"/>',
    plusWave: '<path d="M12 5v9M7.5 9.5h9"/><path d="M4.5 18.5c2.5-1.7 5-1.7 7.5 0s5 1.7 7.5 0"/>',
    chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
    back: '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    dots: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
    play: '<path d="M8.5 6v12l9.5-6z"/>',
    pause: '<path d="M9 6.5v11M15 6.5v11"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    star: '<path d="M12 3.5c.8 4.4 2.3 5.9 6.8 6.8-4.5.8-6 2.3-6.8 6.8-.8-4.5-2.3-6-6.8-6.8 4.5-.9 6-2.4 6.8-6.8z"/>',
    inbox: '<path d="M4 13.5l2.6-7.5h10.8L20 13.5V19H4z"/><path d="M4 13.5h4.6a3.4 3.4 0 0 0 6.8 0H20"/>',
    question: '<path d="M3.5 20h17"/><path d="M9.6 8.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7v.8"/><path d="M12 16.4v.1"/>',
    review: '<path d="M5.5 4.5h9.5l3.5 3.5v12H5.5z"/><path d="M8.5 11.5h7M8.5 15h4.5"/>',
    curiosity: '<path d="M4.5 19V6.2a2 2 0 0 1 2-2H15V18H6.5a2 2 0 0 0-2 2z"/><path d="M18.6 7l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z"/>',
    settings: '<path d="M4 7.5h9.5M18.5 7.5H20M4 16.5h3.5M12.5 16.5H20"/><circle cx="16" cy="7.5" r="2.2"/><circle cx="10" cy="16.5" r="2.2"/>',
    lamp: '<path d="M8.5 3.5h7l2.5 7H6z"/><path d="M12 10.5v7.5M8 20.5h8"/>',
    edit: '<path d="M4.5 19.5l3.8-.9 10-10a2 2 0 0 0-2.9-2.9l-10 10-.9 3.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1"/>',
    paper: '<path d="M6.5 3.5h8l3 3v14h-11z"/><path d="M14.5 3.5v3h3"/><path d="M9 11h6M9 14h6M9 17h4"/>',
    plane: '<path d="M3.5 11.2l17-6.7-5.8 15.5-3.2-6.3z"/><path d="M11.5 13.7l9-9.2"/>',
    body: '<path d="M3 12.5h4l2-5 3.5 10 2.5-6.5 1.5 2H21"/>',
    faith: '<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5"/><path d="M4 20.5h16"/><path d="M13.6 9.6a2.3 2.3 0 1 1-2.2-2.9 1.8 1.8 0 0 0 2.2 2.9z"/>',
    letter: '<rect x="3.5" y="6" width="17" height="12.5" rx="2.2"/><path d="M4.2 7.2l7.8 6.3 7.8-6.3"/>',
    sleep: '<path d="M16 17.2A7.2 7.2 0 0 1 9.3 6.5a7.2 7.2 0 1 0 6.7 10.7z"/><path d="M15 4h4l-4 4.2h4"/>',
    seed: '<path d="M4 20.5h16"/><path d="M12 20.5v-5.5"/><path d="M12 15c-3.8 0-6-2-6-5.2 3.8 0 6 2 6 5.2zM12 15c3.8 0 6-2 6-5.2-3.8 0-6 2-6 5.2z"/>',
    plant: '<path d="M4 20.5h16"/><path d="M12 20.5V5"/><path d="M12 16c-3.6 0-5.6-1.9-5.6-4.8 3.6 0 5.6 1.9 5.6 4.8zM12 12.2c3.6 0 5.6-1.9 5.6-4.8-3.6 0-5.6 1.9-5.6 4.8zM12 7.2c-2.2-.9-3-2.6-2.5-4.5 2.2.9 3 2.6 2.5 4.5z"/>',
    tree: '<path d="M4 20.5h16"/><path d="M12 20.5v-6.5M12 16.5l-2.6-2.2M12 15.2l2.4-2"/><path d="M7.2 14.2a3.6 3.6 0 0 1-.6-6.6A5.4 5.4 0 0 1 17 6.4a3.8 3.8 0 0 1 .2 7.8z"/>',
    pen: '<path d="M4.5 19.5c3-.6 5.2-1.8 7.4-4l7-7a2 2 0 0 0-2.9-2.9l-7 7c-2.2 2.2-3.4 4.4-4 7.4z"/><path d="M14.5 7.5l2 2"/>',
    jasmine: '<path d="M12 11.3c-1.7-2.6-1.4-6.2 0-7.8 1.4 1.6 1.7 5.2 0 7.8zM12.7 12.2c2.9-1.1 6.3.1 7.4 1.9-1.9.9-5.4.4-7.4-1.9zM12.4 13.1c1.4 2.8.6 6.3-1.1 7.5-1-1.9-.7-5.4 1.1-7.5zM11.4 12.9c-2.5 1.8-6.1 1.7-7.6.1 1.6-1.4 5.2-1.8 7.6-.1zM11.3 11.9c-3-.9-4.9-4-4.5-6.1 2.1.2 4.6 2.8 4.5 6.1z"/>',
  };
  UI.icon = (name, cls) => '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';

  /* ---------- motifs ---------- */
  UI.moonSide = () => (UI.isAr() ? 'left' : 'right');
  UI.moon = (f, opt) => {
    opt = opt || {};
    const d = C.moonPath(50, 50, 46, f, opt.side || UI.moonSide());
    const craters = opt.craters ? '<circle class="crater" cx="38" cy="36" r="7"/><circle class="crater" cx="60" cy="62" r="9"/><circle class="crater" cx="64" cy="34" r="4"/><circle class="crater" cx="34" cy="64" r="4.5"/>' : '';
    return '<svg class="moon-svg ' + (opt.cls || '') + '" viewBox="0 0 100 100" aria-hidden="true"' + (opt.id ? ' id="' + opt.id + '"' : '') + '>' +
      '<circle class="dark" cx="50" cy="50" r="46"/><path class="lit" d="' + d + '"/>' + craters + '<circle class="rim" cx="50" cy="50" r="46"/></svg>';
  };
  UI.sinePath = (w, mid, amp, periods, step) => {
    step = step || 4;
    let d = '';
    for (let x = 0; x <= w; x += step) {
      const y = mid - amp * Math.sin((x / w) * periods * 2 * Math.PI);
      d += (x ? ' L' : 'M') + x + ' ' + y.toFixed(2);
    }
    return d;
  };
  UI.wave = (cls, id) => '<svg class="wave ' + (cls || '') + '" viewBox="0 0 320 16" preserveAspectRatio="none" aria-hidden="true"><path ' + (id ? 'id="' + id + '" ' : '') + 'vector-effect="non-scaling-stroke" d="' + UI.sinePath(320, 8, 3.4, 2.5) + '"/></svg>';

  UI.jasmine = (cls) => {
    let petals = '';
    const tilt = [0, 3, -4, 2, -2];
    for (let k = 0; k < 5; k++) {
      petals += '<path transform="rotate(' + (k * 72 + tilt[k] + 8) + ' 16 16)" d="M16 15.2C13.7 11.6 14.1 6.6 16 4.4c1.9 2.2 2.3 7.2 0 10.8z"/>';
    }
    return '<svg class="jasmine ' + (cls || '') + '" viewBox="0 0 32 32" aria-hidden="true">' + petals + '<circle cx="16" cy="16" r="1.7"/></svg>';
  };

  const ART = {
    desk: '<path class="glowfill" d="M106 62 L132 54 L168 114 L92 114 Z"/>' +
      '<path class="ln" d="M14 114H186"/>' +
      '<path class="ln" d="M40 114c0-5 7-8 17-8s17 3 17 8"/><path class="ln" d="M57 106L71 68L102 47"/>' +
      '<circle class="ln" cx="71" cy="68" r="2.6"/><circle class="ln" cx="102" cy="47" r="2.6"/>' +
      '<path class="ln warm" d="M99 41L120 33L134 57L108 66Z"/>' +
      '<path class="ln" d="M120 114v-6h40v6M124 108v-5h32v5"/><path class="ln" d="M166 114v-11h11v11M177 106c4 0 4 5 0 5"/>' +
      '<path class="ln" d="M24 114V86M24 86c-5-4-4-11 0-14 4 3 5 10 0 14zM24 98c4-3 9-2 11 1-3 3-8 3-11-1z"/>',
    rooftop: '<path class="ln" d="M8 122H192"/><path class="ln" d="M18 122V94h30v28"/><path class="ln" d="M24 104h6M36 104h6"/>' +
      '<path class="ln" d="M58 122V100h38v22M58 100a19 19 0 0 1 38 0"/><path class="ln" d="M77 81v-5"/>' +
      '<path class="ln" d="M122 122V62M115 62h14M117 62v-8h10v8M122 54v-9M122 45l-2-3h4z"/><path class="ln" d="M140 122v-20h44v20M146 112h8M164 112h8"/>' +
      '<path class="ln warm" d="M166 22a14 14 0 1 0 9 24 11 11 0 0 1-9-24z"/><path class="ln" d="M40 30h.01M88 18h.01M140 40h.01M30 58h.01M104 44h.01"/>',
    jasmine: '<path class="ln" d="M10 124H190M30 124V30"/><path class="ln sagel" d="M30 52c30-6 52 2 74 18s46 22 70 16"/>' +
      '<path class="ln sagel" d="M58 50c-3-8 0-14 8-17-1 8-3 13-8 17zM88 61c4-8 11-10 18-8-4 6-10 9-18 8zM132 82c-1-8 4-13 12-14-2 7-6 11-12 14zM152 86c6-5 12-5 18-1-6 4-12 5-18 1z"/>' +
      '<g class="warm"><path class="ln warm" d="M76 54c-3-4-2-8 1-10 2 3 2 7-1 10zM76 54c-4-1-7 1-8 4 3 1 6 0 8-4zM76 54c2 4 1 8-2 9-1-3 0-7 2-9zM76 54c4 1 6 4 6 7-3 0-5-3-6-7zM76 54c3-3 7-3 9-1-2 3-6 3-9 1z"/></g>' +
      '<path class="ln" d="M118 74c-2-4-1-7 2-9 2 3 1 7-2 9zm0 0c-4 0-6 2-7 5 3 1 6-1 7-5zm0 0c2 4 1 7-2 8-1-3 0-6 2-8zm0 0c4 1 6 4 5 7-3-1-5-3-5-7zm0 0c3-3 7-3 9-1-3 2-6 3-9 1z"/>',
  };
  UI.art = (kind) => '<svg class="art" viewBox="0 0 200 140" aria-hidden="true">' + (ART[kind] || ART.desk) + '</svg>';
  UI.empty = (kind, html) => '<div class="empty">' + UI.art(kind) + '<p>' + html + '</p></div>';

  // A soft line over weeks (never daily bars). values: numbers; lo/hi: the y range.
  UI.softLine = (values, opt) => {
    opt = opt || {};
    if (values.length < 2) return '';
    const w = 320, h = opt.h || 80, pad = 10;
    const lo = opt.lo != null ? opt.lo : Math.min(...values), hi = opt.hi != null ? opt.hi : Math.max(...values);
    const span = hi - lo || 1;
    const xs = (i) => pad + (i * (w - pad * 2)) / (values.length - 1);
    const ys = (v) => pad + (1 - (v - lo) / span) * (h - pad * 2);
    let d = 'M' + xs(0).toFixed(1) + ' ' + ys(values[0]).toFixed(1);
    for (let i = 1; i < values.length; i++) {
      const px = xs(i - 1), py = ys(values[i - 1]), x = xs(i), y = ys(values[i]), cx = (px + x) / 2;
      d += ' C' + cx.toFixed(1) + ' ' + py.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + y.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return '<svg class="chart ' + (opt.cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="' + d + '"/></svg>';
  };
  // Seven small dots for a week: a soft dot where something happened, blank otherwise.
  UI.weekDots = (presence, weekKey) => '<div class="week-dots">' + presence.map((on, i) =>
    '<div><span>' + UI.weekdayName(C.weekdayOf(C.addDays(weekKey, i)), true) + '</span><i class="' + (on ? 'on' : '') + '"></i></div>').join('') + '</div>';

  UI.mark = () => '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#121428"/>' +
    '<path d="M344.6 310.5A118 118 0 1 1 217.3 126.6 112 112 0 1 0 344.6 310.5Z" fill="#E6B566"/>' +
    '<path d="M318 160c3.6 18.6 9.4 24.4 28 28-18.6 3.6-24.4 9.4-28 28-3.6-18.6-9.4-24.4-28-28 18.6-3.6 24.4-9.4 28-28z" fill="#F2ECE1"/>' +
    '<path d="M150 412c35-22 71-22 106 0s71 22 106 0" fill="none" stroke="#E6B566" stroke-width="11" stroke-linecap="round"/></svg>';

  /* ---------- sheet ---------- */
  let sheetFn = null, sheetEl = null, backEl = null, sheetOpts = null;
  UI.sheet = {
    get isOpen() { return !!sheetEl; },
    open(fn, opts) {
      UI.sheet.close(true);
      sheetFn = fn; sheetOpts = opts || {};
      const rootEl = document.getElementById('sheetRoot');
      backEl = document.createElement('div');
      backEl.className = 'sheet-backdrop';
      backEl.addEventListener('click', () => UI.sheet.close());
      sheetEl = document.createElement('div');
      sheetEl.className = 'sheet';
      sheetEl.setAttribute('role', 'dialog');
      sheetEl.setAttribute('aria-modal', 'true');
      sheetEl.innerHTML = '<div class="grab"></div>' + fn();
      rootEl.append(backEl, sheetEl);
      const b = backEl, s = sheetEl;
      requestAnimationFrame(() => { b.classList.add('on'); s.classList.add('on'); });
      const af = sheetEl.querySelector('[autofocus]');
      if (af) setTimeout(() => af.focus({ preventScroll: true }), 60);
    },
    refresh() {
      if (!sheetEl || !sheetFn) return;
      const a = document.activeElement;
      if (a && sheetEl.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      const top = sheetEl.scrollTop;
      sheetEl.innerHTML = '<div class="grab"></div>' + sheetFn();
      sheetEl.scrollTop = top;
    },
    close(instant) {
      if (!sheetEl) return;
      const s = sheetEl, b = backEl, o = sheetOpts;
      sheetEl = backEl = sheetFn = sheetOpts = null;
      if (instant) { s.remove(); b.remove(); } else {
        s.classList.remove('on'); b.classList.remove('on');
        setTimeout(() => { s.remove(); b.remove(); }, 460);
      }
      if (o && o.onClose) o.onClose();
    },
    el: () => sheetEl,
  };
  root.Actions['sheet-close'] = () => UI.sheet.close();

  // A gentle two-button question. The kind choice comes first.
  let confirmHandlers = null;
  UI.confirm = (o) => {
    confirmHandlers = o;
    UI.sheet.open(() => '<h3>' + o.title + '</h3>' + (o.body ? '<p class="muted">' + o.body + '</p>' : '') +
      '<div class="btns stretch" style="margin-top:16px">' +
      '<button class="btn ' + (o.yesClass || 'lamp') + '" data-act="confirm-yes">' + o.yes + '</button>' +
      '<button class="btn ' + (o.noClass || '') + '" data-act="confirm-no">' + o.no + '</button></div>');
  };
  root.Actions['confirm-yes'] = () => { const h = confirmHandlers; confirmHandlers = null; UI.sheet.close(); if (h && h.onYes) h.onYes(); };
  root.Actions['confirm-no'] = () => { const h = confirmHandlers; confirmHandlers = null; UI.sheet.close(); if (h && h.onNo) h.onNo(); };

  /* ---------- delete, with a quiet way back ---------- */
  // refs: [[table, id], ...]. Removes them, then offers «تراجع» for a few seconds.
  let undoBuf = null;
  UI.removeWithUndo = (refs, msg) => {
    const saved = refs.map(([t, id]) => [t, root.Store.get(t, id)]).filter(([, r]) => r);
    for (const [t, r] of saved) root.Store.del(t, r.id);
    undoBuf = saved;
    UI.toast('<span>' + (msg || UI.L('انمسحت.', 'Deleted.')) + '</span> <button class="btn text sm" data-act="undo" style="min-height:40px;padding:0 10px;color:var(--lamp)">' + UI.L('تراجع', 'Undo') + '</button>', 7000);
  };
  root.Actions.undo = () => {
    if (!undoBuf) return;
    for (const [t, r] of undoBuf) root.Store.put(t, r);
    undoBuf = null;
    document.getElementById('toast').classList.remove('on');
  };

  /* ---------- toast ---------- */
  let toastTimer = null;
  UI.toast = (html, ms) => {
    const el = document.getElementById('toast');
    el.innerHTML = html;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), ms || 3600);
  };

  /* ---------- motion & sound ---------- */
  UI.reducedMotion = () => !!(S() && S().calmMotion) || !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  UI.petals = (count) => {
    if (UI.reducedMotion()) return;
    const n = count || 9;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'petal';
      p.style.left = (6 + Math.random() * 88) + 'vw';
      p.style.setProperty('--d', (7 + Math.random() * 4).toFixed(1) + 's');
      p.style.animationDelay = (Math.random() * 2.4).toFixed(2) + 's';
      p.innerHTML = '<i style="animation-delay:' + (Math.random() * 2).toFixed(2) + 's"></i>';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 14000);
    }
  };
  UI.brighten = () => {
    if (UI.reducedMotion()) return;
    document.body.classList.add('brighten');
    setTimeout(() => document.body.classList.remove('brighten'), 1100);
  };
  let audio = null;
  UI.chime = (force) => {
    if (!force && !S().sound) return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      const t = audio.currentTime;
      [[523.25, 0.16], [1046.5, 0.05], [784, 0.04]].forEach(([f, g]) => {
        const o = audio.createOscillator(), v = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        v.gain.setValueAtTime(0.0001, t);
        v.gain.exponentialRampToValueAtTime(g, t + 0.03);
        v.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        o.connect(v).connect(audio.destination);
        o.start(t); o.stop(t + 3.3);
      });
    } catch (e) { /* no audio here */ }
  };

  /* ---------- routing ---------- */
  UI.route = () => {
    const h = (location.hash || '#/today').replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { parts: parts.length ? parts : ['today'], query };
  };
  UI.go = (path) => { const h = '#/' + path.replace(/^#?\/?/, ''); if (location.hash === h) root.App && root.App.render(); else location.hash = h; };

  // Hand the viewer a file (works from file:// too).
  UI.download = (name, data, type) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  UI.formObj = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { if (k in o) o[k] = [].concat(o[k], v); else o[k] = v; });
    return o;
  };

  root.UI = UI;
})(typeof self !== 'undefined' ? self : this);
