/* Rawaq core: pure logic with no DOM.
   Loaded as window.Core in the browser and require()'d by the Node tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- calendar keys ('YYYY-MM-DD'), pure UTC math ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const keyFromYMD = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return { y, m, d }; }
  function keyToUTC(k) { const p = parseKey(k); return Date.UTC(p.y, p.m - 1, p.d); }
  function utcToKey(t) { const d = new Date(t); return keyFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  const addDays = (k, n) => utcToKey(keyToUTC(k) + n * DAY);
  const diffDays = (a, b) => Math.round((keyToUTC(b) - keyToUTC(a)) / DAY);
  const weekdayOf = (k) => new Date(keyToUTC(k)).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  function addMonths(k, n) {
    const p = parseKey(k);
    const total = p.y * 12 + (p.m - 1) + n;
    const y = Math.floor(total / 12), m = (total % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return keyFromYMD(y, m, Math.min(p.d, last));
  }

  /* ---------- wall clock in a time zone ---------- */
  const fmtCache = {};
  function wallParts(ts, tz) {
    if (tz) {
      try {
        let f = fmtCache[tz];
        if (!f) {
          f = fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
          });
        }
        const o = {};
        for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
        return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute };
      } catch (e) { /* unknown zone: fall through to device time */ }
    }
    const d = new Date(ts);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
  }
  // Minutes east of UTC for a zone at a moment (Damascus: 180).
  function tzOffsetMin(ts, tz) {
    const w = wallParts(ts, tz);
    const asUTC = Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm);
    return Math.round((asUTC - Math.floor(ts / 60000) * 60000) / 60000);
  }

  const hmToMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const minToHm = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const toLogical = (min, dayEndHour) => (min - dayEndHour * 60 + 1440 * 2) % 1440;

  // The "day" ends at dayEndHour (default 5 AM): 2 AM still belongs to the evening before.
  function clockOf(ts, cfg) {
    const w = wallParts(ts, cfg.tz);
    const wallKey = keyFromYMD(w.y, w.m, w.d);
    const wallMin = w.hh * 60 + w.mm;
    const endMin = (cfg.dayEndHour || 0) * 60;
    const day = wallMin < endMin ? addDays(wallKey, -1) : wallKey;
    return { ts, wallKey, wallMin, day, lm: toLogical(wallMin, cfg.dayEndHour || 0) };
  }

  /* ---------- weeks ---------- */
  function weekStartOf(dayKey, weekStartDay) {
    return addDays(dayKey, -((weekdayOf(dayKey) - weekStartDay + 7) % 7));
  }
  function weekDays(weekKey) { const out = []; for (let i = 0; i < 7; i++) out.push(addDays(weekKey, i)); return out; }
  function weeksLeft(dayKey, dateKey) {
    const d = diffDays(dayKey, dateKey);
    return d < 0 ? null : Math.floor(d / 7);
  }

  /* ---------- weekly review window ---------- */
  function reviewWindow(weekKey, rv, dayEndHour) {
    const open = weekDays(weekKey).find((k) => weekdayOf(k) === rv.openDay);
    let close = open;
    while (weekdayOf(close) !== rv.closeDay) close = addDays(close, 1);
    return { open, openLm: toLogical(rv.openHour * 60, dayEndHour), close };
  }
  // Which week's review is open right now (or null).
  function reviewTarget(clock, s) {
    const w = weekStartOf(clock.day, s.weekStart);
    for (const wk of [w, addDays(w, -7)]) {
      const win = reviewWindow(wk, s.review, s.dayEndHour);
      const afterOpen = clock.day > win.open || (clock.day === win.open && clock.lm >= win.openLm);
      if (afterOpen && clock.day <= win.close) return wk;
    }
    return null;
  }
  // Week to review when he opens it by hand outside the window.
  function reviewWeekManual(clock, s) {
    const open = reviewTarget(clock, s);
    if (open) return open;
    const w = weekStartOf(clock.day, s.weekStart);
    return diffDays(w, clock.day) < 3 ? addDays(w, -7) : w;
  }

  /* ---------- ceilings and the focus timer ---------- */
  const CATS = ['study', 'research', 'team', 'teaching', 'personal', 'learning', 'free'];
  function ceilingFor(cat, s, weekKey) {
    const all = s.ceilings || {};
    const c = all[cat] || all.free || { session: 90, daily: null };
    let daily = c.daily || null;
    if (daily && s.lighterWeek && s.lighterWeek === weekKey) daily = Math.max(15, Math.round((daily * 0.75) / 15) * 15);
    return { session: c.session || 90, daily };
  }
  function minutesOn(sessions, cat, dayKey) {
    let m = 0;
    for (const x of sessions) if (x.day === dayKey && x.category === cat) m += x.minutes || 0;
    return m;
  }
  function startCheck(usedToday, ceil) {
    if (ceil.daily && usedToday >= ceil.daily) return { ok: false, reason: 'daily' };
    return { ok: true };
  }
  function newTimer(o) {
    let cap = o.ceil.session;
    if (o.ceil.daily && !o.override) cap = Math.min(cap, o.ceil.daily - (o.usedToday || 0));
    cap = Math.max(1, cap);
    return {
      startedAt: o.now, pausedAt: null, pausedMs: 0,
      plannedMin: Math.min(10, cap), capMin: cap, overridden: !!o.override,
      category: o.category, ref: o.ref || null, label: o.label || '', withWhom: o.withWhom || '',
    };
  }
  const elapsedMs = (t, now) => Math.max(0, (t.pausedAt != null ? t.pausedAt : now) - t.startedAt - t.pausedMs);
  const heldElapsedMs = (t, now) => Math.min(elapsedMs(t, now), t.plannedMin * 60000);
  const pauseTimer = (t, now) => (t.pausedAt != null ? t : { ...t, pausedAt: now });
  const resumeTimer = (t, now) => (t.pausedAt == null ? t : { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null });
  function timerPhase(t, now) {
    if (elapsedMs(t, now) < t.plannedMin * 60000) return 'running';
    return t.plannedMin >= t.capMin ? 'ceiling' : 'checkin';
  }
  // Time spent waiting at a check-in doesn't count as work.
  function settleTimer(t, now) {
    const over = elapsedMs(t, now) - t.plannedMin * 60000;
    return over > 0 ? { ...t, pausedMs: t.pausedMs + over } : t;
  }
  const extendTimer = (t, add) => ({ ...t, plannedMin: Math.min(t.plannedMin + add, t.capMin) });
  function overrideTimer(t, add) { const p = t.plannedMin + add; return { ...t, plannedMin: p, capMin: p, overridden: true }; }
  function moonFraction(t, now) {
    return clamp(heldElapsedMs(t, now) / (t.plannedMin * 60000), 0.04, 1);
  }

  /* ---------- moon drawing ---------- */
  // f: lit fraction 0..1; side: which limb is lit ('right' | 'left').
  function moonPath(cx, cy, r, f, side) {
    f = clamp(f, 0, 1);
    if (f <= 0.001) return '';
    if (f >= 0.999) return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    const rx = +(Math.abs(1 - 2 * f) * r).toFixed(3);
    const outer = side === 'left' ? 0 : 1;
    const inner = f < 0.5 ? 1 - outer : outer;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${inner} ${cx} ${cy - r} Z`;
  }

  /* ---------- projects and limits ---------- */
  function wipBlock(projects, cand, wip) {
    if (cand.status !== 'active') return null;
    const others = projects.filter((p) => p.id !== cand.id && p.status === 'active');
    if (cand.tier === 'main') {
      const mains = others.filter((p) => p.tier === 'main');
      if (mains.length >= wip.main) return { kind: 'main', blockers: mains };
    }
    if (cand.kind === 'paper') {
      const papers = others.filter((p) => p.kind === 'paper');
      if (papers.length >= wip.papers) return { kind: 'paper', blockers: papers };
    }
    return null;
  }
  const pausedThisWeek = (p, weekKey) => !!p.weekPause && p.weekPause === weekKey;

  /* ---------- week slots ---------- */
  function slotRange(slot, dayEndHour) {
    const s = toLogical(hmToMin(slot.start), dayEndHour);
    let e = toLogical(hmToMin(slot.end), dayEndHour);
    if (e <= s) e = 1440;
    return [s, e];
  }
  function slotOnDay(slot, dayKey) {
    if (slot.date) return slot.date === dayKey;
    if (slot.weekday !== weekdayOf(dayKey)) return false;
    if (slot.from && dayKey < slot.from) return false;
    if (slot.until && dayKey > slot.until) return false;
    return true;
  }
  function slotsOn(slots, dayKey, dayEndHour) {
    return slots.filter((s) => slotOnDay(s, dayKey))
      .sort((a, b) => slotRange(a, dayEndHour)[0] - slotRange(b, dayEndHour)[0]);
  }
  const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];
  function sharesDay(a, b) {
    if (a.date && b.date) return a.date === b.date;
    if (a.date) return weekdayOf(a.date) === b.weekday;
    if (b.date) return weekdayOf(b.date) === a.weekday;
    return a.weekday === b.weekday;
  }
  function protectedConflict(slots, cand, dayEndHour) {
    if (cand.protected) return null;
    const r = slotRange(cand, dayEndHour);
    return slots.find((s) => s.protected && s.id !== cand.id && sharesDay(s, cand) && overlaps(r, slotRange(s, dayEndHour))) || null;
  }
  function workSlotsOn(slots, dayKey, dayEndHour) {
    const day = slotsOn(slots, dayKey, dayEndHour);
    const prot = day.filter((s) => s.protected).map((s) => slotRange(s, dayEndHour));
    return day.filter((s) => !s.protected && !prot.some((p) => overlaps(p, slotRange(s, dayEndHour))));
  }

  /* ---------- Today ---------- */
  function energyMode(e) { if (e == null) return null; return e <= 2 ? 'minimum' : e === 3 ? 'normal' : 'full'; }
  function todayPlan(c) {
    const mode = energyMode(c.energy);
    const projById = {};
    for (const p of c.projects) projById[p.id] = p;
    const tierOf = (i) => i.tier || (i.projectId && projById[i.projectId] ? projById[i.projectId].tier : 'main');
    const pinned = c.items.filter((i) => i.pinnedDate === c.day && i.status === 'open');
    const live = workSlotsOn(c.slots, c.day, c.dayEndHour).filter((s) => slotRange(s, c.dayEndHour)[1] > c.lm);
    const all = [
      ...pinned.filter((i) => tierOf(i) !== 'background').map((i) => ({ kind: 'item', key: 'i:' + i.id, item: i })),
      ...live.map((s) => ({ kind: 'slot', key: 's:' + s.id, slot: s })),
    ];
    // Exam season keeps Today to studying; the rest week after keeps it empty. Nothing is lost, it just waits.
    let pool = all;
    if (c.season === 'rest') pool = [];
    else if (c.season === 'season') {
      pool = all.filter((x) => (x.kind === 'slot' ? x.slot.type === 'study'
        : x.item.category === 'study' || !!(x.item.projectId && projById[x.item.projectId] && projById[x.item.projectId].examId)));
    }
    const heldBack = pool.length < all.length;
    const candidates = pool;
    let main = candidates.slice(0, 3);
    if (mode === 'minimum') {
      const pick = candidates.find((x) => x.key === c.focusKey) || candidates[0];
      main = pick ? [pick] : [];
    }
    let background = [];
    if (mode === 'full' && !c.season) {
      const pinnedProjects = new Set(pinned.map((i) => i.projectId).filter(Boolean));
      background = [
        ...pinned.filter((i) => tierOf(i) === 'background').map((i) => ({ kind: 'item', key: 'i:' + i.id, item: i })),
        ...c.projects
          .filter((p) => p.tier === 'background' && p.status === 'active' && p.nextStep && !pausedThisWeek(p, c.weekKey) && !pinnedProjects.has(p.id))
          .map((p) => ({ kind: 'project', key: 'p:' + p.id, project: p })),
      ].slice(0, 2);
    }
    const protectedToday = slotsOn(c.slots, c.day, c.dayEndHour)
      .filter((s) => s.protected && slotRange(s, c.dayEndHour)[1] > c.lm);
    return { mode, main, background, protectedToday, candidates, heldBack, restWeek: c.season === 'rest' };
  }

  /* ---------- sun, sky, greeting ---------- */
  // Approximate sunset for Damascus (33.51 N, 36.29 E), in wall minutes for the given UTC offset.
  function sunsetMin(dayKey, offsetMin, lat = 33.51, lon = 36.29) {
    const p = parseKey(dayKey);
    const n = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(p.y, 0, 0)) / DAY);
    const rad = Math.PI / 180;
    const decl = 23.44 * Math.sin(rad * (360 / 365) * (n - 81));
    const b = rad * (360 / 364) * (n - 81);
    const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    const noon = 720 - 4 * lon - eot + offsetMin;
    const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl * rad)) / (Math.cos(lat * rad) * Math.cos(decl * rad));
    const h = Math.acos(clamp(cosH, -1, 1)) / rad;
    return Math.round(noon + 4 * h);
  }
  function skyPhase(wallMin, sunset, dayEndHour) {
    const dawnEnd = Math.max(5, dayEndHour || 0) * 60;
    if (wallMin >= 22 * 60 || wallMin < 3 * 60) return 'night';
    if (wallMin < dawnEnd) return 'predawn';
    if (wallMin >= sunset) return 'evening';
    return 'day';
  }
  function greetingKey(wallMin, sunset) {
    if (wallMin < 3 * 60) return 'afterMidnight';
    if (wallMin < 5 * 60) return 'predawn';
    if (wallMin < 12 * 60) return 'morning';
    if (wallMin < sunset) return 'afternoon';
    return 'evening';
  }

  /* ---------- numbers and words ---------- */
  const EAST = '٠١٢٣٤٥٦٧٨٩';
  const toEastern = (s) => String(s).replace(/[0-9]/g, (d) => EAST[d]);
  const toWestern = (s) => String(s).replace(/[٠-٩]/g, (d) => String(EAST.indexOf(d)));
  // Arabic counted nouns: 1 ساعة, 2 ساعتين, 3-10 ساعات, 11+ ساعة
  function arCount(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    const r = n % 100;
    return n + ' ' + (r >= 3 && r <= 10 ? few : many);
  }

  /* ---------- hashing and the wins sky ---------- */
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const byDateThenId = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  function skyLayout(wins, width) {
    const groups = {};
    for (const w of wins) (groups[w.date.slice(0, 7)] = groups[w.date.slice(0, 7)] || []).push(w);
    const monthKeys = Object.keys(groups).sort().reverse();
    const out = { stars: [], lines: [], months: [], height: 0 };
    let y = 36;
    for (const month of monthKeys) {
      const list = groups[month].slice().sort(byDateThenId);
      const bandH = Math.min(340, 130 + list.length * 24);
      out.months.push({ month, y, h: bandH });
      const placed = [];
      for (const w of list) {
        const r = rng(hash(w.id));
        let best = null, bestD = -1;
        for (let i = 0; i < 16; i++) {
          const x = 22 + r() * (width - 44), yy = y + 30 + r() * (bandH - 52);
          let d = Infinity;
          for (const p of placed) d = Math.min(d, Math.hypot(p.x - x, p.y - yy));
          if (d > bestD) { best = { x, y: yy }; bestD = d; }
          if (d > 48) break;
        }
        const star = { id: w.id, month, x: +best.x.toFixed(1), y: +best.y.toFixed(1), size: +(1.5 + r() * 1.9).toFixed(2), tw: +(r() * 6).toFixed(2) };
        placed.push(star);
        out.stars.push(star);
      }
      for (let i = 1; i < placed.length; i++) out.lines.push([placed[i - 1], placed[i]]);
      y += bandH;
    }
    out.height = y + 24;
    return out;
  }

  /* ---------- totals, ramp, resurfacing ---------- */
  function weekTotals(sessions, weekKey) {
    const days = new Set(weekDays(weekKey));
    const out = {};
    for (const s of sessions) if (days.has(s.day)) out[s.category] = (out[s.category] || 0) + (s.minutes || 0);
    return out;
  }
  const rampFor = (exam, dayKey) => (exam && exam.ramp ? exam.ramp.find((p) => dayKey >= p.from && dayKey <= p.to) || null : null);
  const questionsDue = (qs, dayKey) => qs.filter((q) => q.status === 'parked' && q.answerBy && q.answerBy <= dayKey);
  const waitingDue = (ws, dayKey) => ws.filter((w) => !w.done && w.checkBackOn && w.checkBackOn <= dayKey);
  function rereadNote(opens, now) {
    const recent = opens.filter((t) => now - t <= 30 * 60000);
    return recent.length >= 3;
  }
  const isBirthday = (dayKey, mmdd) => !!mmdd && dayKey.slice(5) === mmdd;
  // "One month ago" win, shown on some days only.
  function monthAgoWin(wins, dayKey) {
    if (hash(dayKey) % 3 !== 0) return null;
    const lo = addDays(dayKey, -36), hi = addDays(dayKey, -25);
    const pool = wins.filter((w) => w.date >= lo && w.date <= hi).sort(byDateThenId);
    return pool.length ? pool[hash(dayKey + 'w') % pool.length] : null;
  }
  // Average "overall week" answer per month, for a soft trend line.
  function monthlyTrend(reviews) {
    const g = {};
    for (const r of reviews) if (r.overall) { const m = r.id.slice(0, 7); (g[m] = g[m] || []).push(r.overall); }
    return Object.keys(g).sort().map((m) => ({ month: m, value: g[m].reduce((a, b) => a + b, 0) / g[m].length }));
  }

  /* ---------- Phase 2: sleep ---------- */
  function sleepMinutes(rec) {
    if (!rec || !rec.bedAt || !rec.wakeAt || rec.wakeAt <= rec.bedAt) return null;
    return Math.round((rec.wakeAt - rec.bedAt) / 60000);
  }
  // A night belongs to the logical day you went to bed on (2 AM is still last night).
  const nightKey = (bedTs, cfg) => clockOf(bedTs, cfg).day;
  // Wall date + "HH:MM" in a zone -> timestamp.
  function wallToTs(key, hm, tz) {
    const p = parseKey(key), m = hmToMin(hm);
    const guess = Date.UTC(p.y, p.m - 1, p.d, Math.floor(m / 60), m % 60);
    return guess - tzOffsetMin(guess, tz) * 60000;
  }
  // Bed and wake typed for the night of `night` (a logical day).
  function nightFromTimes(night, bedHm, wakeHm, cfg) {
    const bedMin = hmToMin(bedHm), wakeMin = hmToMin(wakeHm);
    const bedDate = bedMin < (cfg.dayEndHour || 0) * 60 ? addDays(night, 1) : night;
    const wakeDate = wakeMin > bedMin ? bedDate : addDays(bedDate, 1);
    return { bedAt: wallToTs(bedDate, bedHm, cfg.tz), wakeAt: wallToTs(wakeDate, wakeHm, cfg.tz) };
  }
  function sleepWeek(logs, weekKey, cfg) {
    const days = new Set(weekDays(weekKey));
    const nights = logs.filter((l) => days.has(l.id) && sleepMinutes(l) != null);
    if (!nights.length) return null;
    const avgMin = Math.round(nights.reduce((a, l) => a + sleepMinutes(l), 0) / nights.length);
    // Average bedtime measured from noon, so 23:30 and 01:30 average to 00:30.
    const fromNoon = nights.map((l) => { const w = wallParts(l.bedAt, cfg.tz); return (w.hh * 60 + w.mm - 720 + 1440) % 1440; });
    const avgBed = Math.round(fromNoon.reduce((a, b) => a + b, 0) / fromNoon.length + 720) % 1440;
    return { avgMin, avgBed, nights: nights.length };
  }

  /* ---------- Phase 2: weight (optional, weekly only) ---------- */
  const canWeighIn = (weighIns, weekKey) => !weighIns.some((w) => w.id === weekKey);
  function movingAvg(weighIns, n) {
    const s = weighIns.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    return s.map((w, i) => {
      const win = s.slice(Math.max(0, i - n + 1), i + 1);
      return { week: w.id, avg: Math.round((win.reduce((a, x) => a + x.kg, 0) / win.length) * 100) / 100 };
    });
  }
  function weightTrend(ma) {
    if (!ma || ma.length < 2) return null;
    const diff = ma[ma.length - 1].avg - ma[Math.max(0, ma.length - 4)].avg;
    if (Math.abs(diff) < 0.3) return 'flat';
    return diff < 0 ? 'down' : 'up';
  }
  function weeklyPace(currentKg, targetKg, fromKey, byKey) {
    const weeks = Math.max(1, diffDays(fromKey, byKey) / 7);
    return Math.round((Math.abs(currentKg - targetKg) / weeks) * 100) / 100;
  }

  /* ---------- Phase 2: burnout radar ---------- */
  // Gentle, never diagnostic. Shows only when two or more signs appear together in the last 10 days.
  function burnoutSignals(c) {
    const from = addDays(c.day, -9);
    const inWin = (k) => k >= from && k <= c.day;
    const signals = [];
    const logs = (c.dayLogs || []).filter((l) => inWin(l.id) && l.energy != null);
    if (logs.length >= 4 && logs.filter((l) => l.energy <= 2).length / logs.length >= 0.6) signals.push('lowEnergy');
    if ((c.sessions || []).filter((s) => inWin(s.day) && s.overrideCeiling).length >= 3) signals.push('overrides');
    if (c.wip && (c.projects || []).filter((p) => p.status === 'active' && p.tier === 'main').length >= c.wip.main) signals.push('atLimit');
    const nights = (c.sleep || []).filter((s) => inWin(s.id) && sleepMinutes(s) != null);
    if (nights.length >= 4 && nights.reduce((a, s) => a + sleepMinutes(s), 0) / nights.length < 360) signals.push('shortSleep');
    const rv = (c.reviews || []).filter((r) => r.overall).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (rv.length >= 2) {
      const last = rv[rv.length - 1].overall, prev = rv[rv.length - 2].overall;
      if (last < prev && last <= 2) signals.push('reviewDown');
    }
    return { signals, show: signals.length >= 2 };
  }

  /* ---------- Phase 2: applications ---------- */
  const OPP_OPEN = ['considering', 'preparing', 'interview'];
  const byDeadline = (a, b) => ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : 0);
  function oppBuckets(opps, dayKey) {
    const active = opps.filter((o) => OPP_OPEN.includes(o.status)).sort(byDeadline);
    const highlight = new Set(active.filter((o) => o.deadline && o.deadline >= dayKey).slice(0, 3).map((o) => o.id));
    const waiting = opps.filter((o) => o.status === 'submitted')
      .sort((a, b) => ((a.expectedResponse || '9999') < (b.expectedResponse || '9999') ? -1 : 1));
    const closed = opps.filter((o) => ['accepted', 'rejected', 'skipped'].includes(o.status));
    return { active, highlight, waiting, closed };
  }
  function responsesNear(opps, dayKey) {
    const soon = addDays(dayKey, 2);
    return opps.filter((o) => o.status === 'submitted' && o.expectedResponse && o.expectedResponse <= soon && !(o.quietUntil && o.quietUntil >= dayKey));
  }

  /* ---------- Phase 2: letters, defend-it, presence ---------- */
  const lettersDue = (letters, dayKey) => letters.filter((l) => l.openOn && !l.opened && l.openOn <= dayKey);
  const letterLocked = (l, dayKey) => !!l.openOn && !l.opened && l.openOn > dayKey;
  const DEFEND_SECTIONS = ['background', 'methods', 'data', 'analysis', 'results', 'limitations', 'differently', 'references', 'aiPolicy', 'explainBuild'];
  function defendState(paper) {
    const counts = { 0: 0, 1: 0, 2: 0, unset: 0 };
    for (const s of DEFEND_SECTIONS) {
      const c = paper.defend && paper.defend[s] && paper.defend[s].confidence;
      if (c === 0 || c === 1 || c === 2) counts[c]++; else counts.unset++;
    }
    return { counts, ready: counts[2] === DEFEND_SECTIONS.length };
  }
  const weekPresence = (records, weekKey) => { const have = new Set(records.map((r) => r.id)); return weekDays(weekKey).map((d) => have.has(d)); };

  /* ---------- Phase 3: connection nudge ---------- */
  // At most one gentle prompt a week, from a mid-week day on, until he says "okay". No contacts, no counters.
  function connectionNudge(c) {
    if (!c.enabled || c.shownWeek === c.weekKey) return null;
    const nudgeDay = addDays(c.weekKey, 2 + (hash(c.weekKey) % 4));
    if (c.day < nudgeDay) return null;
    const kinds = ['family', 'share'].concat((c.ideas || []).map((i) => 'idea:' + i.id));
    return kinds[hash(c.weekKey + 'n') % kinds.length];
  }

  /* ---------- Phase 4: tonight's moon ---------- */
  // Mean synodic month from a known new moon (2000-01-06 18:14 UTC). Good to within about a day.
  const SYNODIC = 29.530588853, NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  function moonPhase(ts) {
    const phase = ((((ts - NEW_MOON_EPOCH) / DAY) / SYNODIC) % 1 + 1) % 1;
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const names = [[0.0339, 'new'], [0.2161, 'waxingCrescent'], [0.2839, 'firstQuarter'], [0.4661, 'waxingGibbous'], [0.5339, 'full'],
      [0.7161, 'waningGibbous'], [0.7839, 'lastQuarter'], [0.9661, 'waningCrescent'], [1.01, 'new']];
    return { phase, illum, waxing: phase < 0.5, name: names.find((n) => phase < n[0])[1] };
  }

  /* ---------- Phase 4: search ---------- */
  const SEARCH_SKIPS = ['questions', 'dayLogs', 'resetUses', 'prayers', 'faithNotes', 'decisions']; // never searchable
  function normalizeAr(s) {
    return toWestern(String(s || ''))
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function buildSearchIndex(st) {
    const out = [];
    const add = (type, id, text, sub, route) => { if (text) out.push({ type, id, text: String(text), sub: sub || '', route, norm: normalizeAr(text + ' ' + (sub || '')) }); };
    for (const w of st.wins || []) add('win', w.id, w.text, w.toldWho, '#/more/wins');
    for (const i of st.items || []) add('task', i.id, i.title, '', '#/work/tasks');
    for (const p of st.projects || []) add('project', p.id, p.name, p.nextStep, '#/work/projects');
    for (const p of st.papers || []) add('paper', p.id, p.title, p.venue, '#/work/papers/' + p.id);
    for (const o of st.opportunities || []) add('opportunity', o.id, o.name, [o.org, o.location, o.note].filter(Boolean).join(' · '), '#/work/apps/' + o.id);
    for (const d of st.ideas || []) add('idea', d.id, d.text, '', '#/work/ideas');
    for (const w of st.waiting || []) add('waiting', w.id, w.what, w.who, '#/work/waiting');
    for (const x of st.inbox || []) add('inbox', x.id, x.text, '', '#/more/inbox');
    for (const l of st.letters || []) add('letter', l.id, l.title, '', '#/more/letters'); // titles only, never the letter itself
    for (const c of st.curiosity || []) add('curiosity', c.id, c.title, c.note, '#/more/curiosity');
    for (const r of st.rawNotes || []) add('raw', r.id, r.body, '', '#/more/letters?t=raw');
    return out;
  }
  function search(index, q) {
    const words = normalizeAr(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    // "ال" is often dropped after prefixes (للفريق), so a word starting with it also matches without it.
    const hit = (norm, w) => norm.includes(w) || (w.length > 3 && w.startsWith('ال') && norm.includes(w.slice(2)));
    return index.filter((e) => words.every((w) => hit(e.norm, w))).slice(0, 40);
  }

  /* ---------- Phase 4: sharing into the inbox ---------- */
  function shareToInbox(p) {
    const clean = (s) => String(s || '').trim();
    const title = clean(p && p.title), text = clean(p && p.text), url = clean(p && p.url);
    const parts = [];
    if (title) parts.push(title);
    if (text && text !== title) parts.push(text);
    if (url && !parts.some((x) => x.includes(url))) parts.push(url);
    if (!parts.length) return null;
    const found = text.match(/https?:\/\/\S+/);
    return { text: parts.join(' — '), link: url || (found ? found[0] : null) };
  }

  /* ---------- Phase 5: honest pattern notes ---------- */
  // Noticing, not judging: only what held for three weeks in a row, each with one small change to try.
  const BUCKETS = ['morning', 'afternoon', 'evening', 'night'];
  function bucketOf(hm) {
    const m = hmToMin(hm);
    if (m >= 300 && m < 720) return 'morning';
    if (m >= 720 && m < 1020) return 'afternoon';
    if (m >= 1020 && m < 1320) return 'evening';
    return 'night';
  }
  const WORK_TYPES = ['study', 'course', 'team', 'other'];
  function patternNotes(st, reviewWeek, cfg) {
    const deh = cfg.dayEndHour || 0;
    const now = cfg.now || { day: '9999-12-31', lm: 0 };
    const quiet = cfg.quiet || {};
    const sessions = st.sessions || [];
    const isPast = (d, range) => d < now.day || (d === now.day && range[1] <= now.lm);
    // For one week: per slot and per time of day, how many past occurrences and how many were used.
    function weekUse(w) {
      const per = {}, buckets = {};
      for (const b of BUCKETS) buckets[b] = { planned: 0, used: 0 };
      for (const d of weekDays(w)) {
        for (const s of workSlotsOn(st.slots || [], d, deh)) {
          if (!WORK_TYPES.includes(s.type)) continue;
          const r = slotRange(s, deh);
          if (!isPast(d, r)) continue;
          const used = sessions.some((x) => x.day === d && (x.ref === 's:' + s.id ||
            (x.startedAt && (() => { const lm = clockOf(x.startedAt, cfg).lm; return lm >= r[0] - 30 && lm < r[1]; })())));
          const b = bucketOf(s.start);
          buckets[b].planned++; if (used) buckets[b].used++;
          const p = per[s.id] = per[s.id] || { planned: 0, used: 0, slot: s };
          p.planned++; if (used) p.used++;
        }
      }
      return { per, buckets };
    }
    const cache = {};
    const use = (w) => cache[w] || (cache[w] = weekUse(w));
    // How many weeks in a row (ending at the reviewed week) a condition holds, looking back at most 6.
    const run = (pred) => { let n = 0; for (let i = 0; i < 6 && pred(addDays(reviewWeek, -7 * i)); i++) n++; return n; };
    const notes = [];
    const push = (n) => { const until = quiet[n.key]; if (!(until && until >= reviewWeek)) notes.push(n); };

    const flaggedBuckets = new Set();
    for (const b of BUCKETS) {
      const weeks = run((w) => use(w).buckets[b].planned > 0 && use(w).buckets[b].used === 0);
      if (weeks < 3) continue;
      let better = null, bestUsed = 0;
      for (const o of BUCKETS) {
        if (o === b) continue;
        const ws = [0, 1, 2].map((i) => use(addDays(reviewWeek, -7 * i)).buckets[o].used);
        const total = ws.reduce((a, x) => a + x, 0);
        if (ws.filter((x) => x > 0).length >= 2 && total > bestUsed) { better = o; bestUsed = total; }
      }
      flaggedBuckets.add(b);
      push({ kind: 'timeOfDay', key: 'tod:' + b, bucket: b, better, weeks });
    }
    for (const s of st.slots || []) {
      if (s.date || s.protected || !WORK_TYPES.includes(s.type) || flaggedBuckets.has(bucketOf(s.start))) continue;
      const weeks = run((w) => { const p = use(w).per[s.id]; return !!p && p.planned > 0 && p.used === 0; });
      if (weeks >= 3) push({ kind: 'slot', key: 'slot:' + s.id, slotId: s.id, weeks });
    }
    const rv = {};
    for (const r of st.reviews || []) rv[r.id] = r;
    const fromReviews = (pred) => run((w) => !!rv[w] && pred(rv[w]));
    let n = fromReviews((r) => r.sessions === 'few');
    if (n >= 3) push({ kind: 'fewSessions', key: 'few', weeks: n });
    n = run((w) => weekDays(w).some((d) => sessions.some((x) => x.day === d && x.overrideCeiling)));
    if (n >= 3) push({ kind: 'overrides', key: 'overrides', weeks: n });
    for (const b of ['tired', 'sleep', 'phone', 'projects', 'family', 'ill']) {
      n = fromReviews((r) => (r.blockers || []).includes(b));
      if (n >= 3) { push({ kind: 'blocker', key: 'blocker:' + b, blocker: b, weeks: n }); break; }
    }
    for (const g of st.goals || []) {
      n = fromReviews((r) => !!r.body && r.body[g.id] === 'no');
      if (n >= 3) { push({ kind: 'bodyGoal', key: 'goal:' + g.id, goalId: g.id, weeks: n }); break; }
    }
    n = fromReviews((r) => r.shared === 'no');
    if (n >= 3) push({ kind: 'notShared', key: 'notShared', weeks: n });
    return notes;
  }

  /* ---------- Phase 5: exam season and the rest week after ---------- */
  function examSeason(exams, dayKey, opts) {
    const o = { auto: true, restWeek: true, ...(opts || {}) };
    if (!o.auto) return null;
    let found = null;
    for (const ex of exams || []) {
      if (!ex.date) continue;
      const end = ex.endDate && ex.endDate >= ex.date ? ex.endDate : ex.date;
      const start = addDays(ex.date, -14);
      if (dayKey >= start && dayKey <= end) {
        const d = diffDays(dayKey, ex.date);
        const stage = d > 7 ? 'twoWeeks' : d >= 1 ? 'lastWeek' : 'examDays';
        if (!found || found.mode !== 'season' || ex.date < found.exam.date) found = { mode: 'season', stage, exam: ex, end };
      } else if (o.restWeek && dayKey > end && dayKey <= addDays(end, 7) && !found) {
        found = { mode: 'rest', exam: ex, end, restEnds: addDays(end, 7) };
      }
    }
    return found;
  }

  /* ---------- Phase 5: decisions ---------- */
  const decisionLocked = (d, dayKey) => !!d.notBefore && d.status !== 'decided' && dayKey < d.notBefore;
  const decisionsDue = (ds, dayKey) => ds.filter((d) => d.status === 'open' && d.notBefore && d.notBefore <= dayKey && !d.dueSeen);

  /* ---------- Phase 5: what kind of thing is a shared link? ---------- */
  function guessCurioType(url, text) {
    const u = String(url || (String(text || '').match(/https?:\/\/\S+/) || [''])[0]).toLowerCase();
    if (!u) return 'topic';
    if (/youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com\/(reel|tv)|facebook\.com\/(reel|watch)|fb\.watch/.test(u)) return 'video';
    if (/doi\.org|arxiv\.org|biorxiv\.org|medrxiv\.org|pubmed|ncbi\.nlm\.nih\.gov|sciencedirect\.com|nature\.com|springer|wiley\.com|frontiersin\.org|plos\.org|cell\.com|elifesciences\.org|researchgate\.net|semanticscholar\.org|jneurosci\.org|academic\.oup\.com|journals\./.test(u)) return 'paper';
    if (/imdb\.com|letterboxd\.com/.test(u)) return 'film';
    if (/goodreads\.com|books\.google/.test(u)) return 'book';
    return 'topic';
  }

  /* ---------- backup format ---------- */
  function makeExport(tables, nowIso) {
    return { app: 'rawaq', format: 1, exportedAt: nowIso, tables };
  }
  function readExport(obj, known) {
    if (!obj || obj.app !== 'rawaq' || !obj.tables || typeof obj.tables !== 'object') throw new Error('not-rawaq');
    const out = {};
    for (const name of known) {
      const rows = obj.tables[name] || [];
      if (!Array.isArray(rows)) throw new Error('bad-table:' + name);
      for (const r of rows) if (!r || typeof r !== 'object' || r.id == null) throw new Error('bad-row:' + name);
      out[name] = rows;
    }
    return out;
  }

  return {
    DAY, clamp, pad, keyFromYMD, parseKey, keyToUTC, utcToKey, addDays, diffDays, weekdayOf, addMonths,
    wallParts, tzOffsetMin, hmToMin, minToHm, toLogical, clockOf,
    weekStartOf, weekDays, weeksLeft, reviewWindow, reviewTarget, reviewWeekManual,
    CATS, ceilingFor, minutesOn, startCheck, newTimer, elapsedMs, heldElapsedMs, pauseTimer, resumeTimer,
    timerPhase, settleTimer, extendTimer, overrideTimer, moonFraction, moonPath,
    wipBlock, pausedThisWeek, slotRange, slotOnDay, slotsOn, overlaps, protectedConflict, workSlotsOn,
    energyMode, todayPlan, sunsetMin, skyPhase, greetingKey,
    EAST, toEastern, toWestern, arCount, hash, rng, skyLayout,
    weekTotals, rampFor, questionsDue, waitingDue, rereadNote, isBirthday, monthAgoWin, monthlyTrend,
    sleepMinutes, nightKey, wallToTs, nightFromTimes, sleepWeek, canWeighIn, movingAvg, weightTrend, weeklyPace, burnoutSignals,
    OPP_OPEN, oppBuckets, responsesNear, lettersDue, letterLocked, DEFEND_SECTIONS, defendState, weekPresence, connectionNudge,
    moonPhase, SEARCH_SKIPS, normalizeAr, buildSearchIndex, search, shareToInbox,
    BUCKETS, bucketOf, patternNotes, examSeason, decisionLocked, decisionsDue, guessCurioType,
    makeExport, readExport,
  };
});
