/* First-launch data (spec section 10). Everything here is editable or deletable in the app. */
(function (root, factory) {
  var api = factory(root.Core || (typeof require === 'function' ? require('./core.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Seed = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const RESET_SUGGESTIONS = {
    lonely: [
      { ar: 'ابعت رسالة لحدا بتحبو', en: 'Message someone you love' },
      { ar: 'اطلع لعند أهلك ١٠ دقايق', en: 'Go sit with your family for 10 minutes' },
    ],
    pressured: [
      { ar: 'امشي ١٠ دقايق', en: 'Walk for 10 minutes' },
      { ar: 'فرّغ راسك بكم سطر', en: 'Empty your head in a few lines', action: 'capture' },
    ],
    bored: [
      { ar: 'افتح شي من رف الفضول', en: 'Open something from the curiosity shelf', action: 'curiosity' },
      { ar: 'العب شي بدون ذنب', en: 'Play something, guilt-free' },
    ],
    numb: [
      { ar: 'اطلع من الغرفة', en: 'Step out of the room' },
      { ar: 'دوش', en: 'Take a shower' },
      { ar: 'احكي مع حدا', en: 'Talk to someone' },
    ],
    tired: [
      { ar: 'نام. جد.', en: 'Sleep. Really.' },
      { ar: 'استراحة بدون موبايل', en: 'A break without the phone' },
    ],
    anxious: [
      { ar: 'حطها عالرف', en: 'Put it on the shelf', action: 'questions' },
    ],
  };

  function defaultSettings() {
    return {
      id: 'settings',
      lang: 'ar', theme: 'dark', numerals: 'eastern', hijri: false, sound: false,
      name: '', birthday: null,
      tz: 'Asia/Damascus', dayEndHour: 5, weekStart: 6,
      ceilings: {
        study: { session: 90, daily: null },
        research: { session: 90, daily: 240 },
        team: { session: 90, daily: 120 },
        teaching: { session: 90, daily: null },
        personal: { session: 90, daily: null },
        learning: { session: 90, daily: null },
        free: { session: 90, daily: null },
      },
      wip: { main: 3, papers: 2 },
      messageWindows: { enabled: false, times: ['14:00', '21:00'] },
      review: { openDay: 4, openHour: 18, closeDay: 6 },
      modules: { curiosity: true, body: true, faith: true, sleep: true, connection: true },
      connectionShownWeek: null,
      resetSuggestions: JSON.parse(JSON.stringify(RESET_SUGGESTIONS)),
      resetLog: false,
      lighterWeek: null,
      body: { weightOn: false, hideNumber: false, targetKg: null, targetBy: null },
      faith: { anchor: null, showVerse: true },
      sleep: { windDown: false, windDownAt: '00:30' },
      radarQuietUntil: null,
      focus: { hush: false, wakeLock: false, vibrate: false },
      textSize: 'normal', calmMotion: false,
      examSeason: { auto: true, restWeek: true },
      patternQuiet: {},
    };
  }

  function buildSeed(nowTs, idFn) {
    let n = 0;
    const id = idFn || (() => 'seed-' + (++n));
    const iso = new Date(nowTs).toISOString();
    const settings = defaultSettings();
    const today = C.clockOf(nowTs, settings).day;

    let order = 0;
    const project = (name, area, tier, extra) => ({
      id: id(), name, area, tier, kind: 'project', status: 'active', nextStep: '', createdAt: new Date(nowTs + order++).toISOString(), ...extra,
    });

    // Neutral starter data: a few gentle examples, nothing about any real person. Everything is editable.
    return {
      settings,
      tables: {
        exams: [],
        subjects: [],
        chapters: [],
        projects: [
          project('مشروع رئيسي (عدّلو)', 'learning', 'main', { nextStep: 'اكتب أصغر خطوة جاية' }),
          project('شي بالخلفية (عدّلو)', 'personal', 'background'),
        ],
        opportunities: [],
        slots: [{
          id: id(), weekday: 5, start: '18:00', end: '00:00', type: 'rest', protected: true,
          label: 'مسا الجمعة', from: C.weekStartOf(today, settings.weekStart), createdAt: iso,
        }],
        curiosity: [
          { id: id(), type: 'topic', title: 'شي بتحبو لحالو (عدّلو)', status: 'want', createdAt: iso },
        ],
        letters: [{
          id: id(), title: 'من نفسك قبل ٣ شهور', createdAt: iso,
          openOn: C.addMonths(today, 3), opened: false,
          body: 'إذا عم تقرا هالرسالة، تذكر: ما في دين، ما في شي متراكم. وقّف وانت لسا عندك طاقة. وإذا صار شي منيح — احكيه لحدا.',
        }],
      },
    };
  }

  return { RESET_SUGGESTIONS, defaultSettings, buildSeed };
});
