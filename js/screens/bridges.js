/* Bridges (الجسور): exports that need nothing, and optional integrations. Rawaq stays the calm source of truth. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store, X = root.Exports;
  const { L, T } = UI;
  const S = () => Store.settings;

  const MOD = {
    wins: ['النجوم', 'Wins'], projects: ['المشاريع', 'Projects'], papers: ['الأوراق', 'Papers'], reviews: ['المراجعات الأسبوعية', 'Weekly reviews'],
    opportunities: ['الفرص', 'Applications'], curiosity: ['رف الفضول', 'Curiosity shelf'], letters: ['عناوين الرسائل', 'Letter titles'], sessions: ['جلسات التركيز', 'Focus sessions'],
  };

  function periods() {
    const day = root.App.clock().day;
    const out = [];
    for (let i = 0; i < 18; i++) out.push({ v: 'm:' + C.addMonths(day, -i).slice(0, 7), label: UI.fmtMonth(C.addMonths(day, -i).slice(0, 7)) });
    const y = Number(day.slice(0, 4));
    for (let k = y; k >= y - 2; k--) out.push({ v: 'y:' + k, label: T('سنة {y} كلها', 'The whole of {y}', { y: UI.n(k) }) });
    return out;
  }

  // Only the tables the exports read; sensitive ones are never handed over.
  function exportState() {
    const t = (n) => Store.all(n);
    return {
      settings: S(), wins: t('wins'), projects: t('projects'), papers: t('papers'), opportunities: t('opportunities'), letters: t('letters'),
      reviews: t('reviews'), curiosity: t('curiosity'), sessions: t('sessions'), slots: t('slots'), inbox: t('inbox'), rawNotes: t('rawNotes'),
    };
  }

  root.Screens.bridges = {
    title: () => L('الجسور', 'Bridges'),
    render() {
      let html = '<p class="muted small">' + L('رواق هو البيت. هدول جسور لبرّا، كل واحد بتشغّلو لحالو، وكلهن مطفيين من الأساس.', 'Rawaq is home. These are bridges to the outside; each one you turn on yourself, and all of them start off.') + '</p>';
      html += '<div class="sec-title">' + L('للتأمل', 'For reflection') + '</div><form class="card plain" data-form="br-reflect">' +
        '<p class="small muted">' + L('ملف <bdi>Markdown</bdi> فيه شو صار بشهر أو بسنة: نجوم، مشاريع خلصت، أوراق، فرص، رسائل، شو انبسطت فيه. لتكتب انت تأملك فوقو.', 'A Markdown file of what happened in a month or a year: wins, finished projects, papers, applications, letters, what you enjoyed. For you to write your own reflection on top.') + '</p>' +
        '<label class="field"><span>' + L('الفترة', 'Period') + '</span><select name="period">' + periods().map((p) => '<option value="' + p.v + '">' + UI.esc(p.label) + '</option>').join('') + '</select></label>' +
        '<label class="check-row"><input type="checkbox" name="bodies" value="1">' + L('مع نص الرسائل (مو بس العناوين)', 'Include letter text (not only titles)') + '</label>' +
        '<button class="btn soft block" style="margin-top:8px">' + L('نزّل الملف', 'Download the file') + '</button></form>';
      html += '<div class="sec-title">' + L('تصدير بدون أي إعداد', 'Exports, no setup') + '</div><div class="card plain">' +
        '<form data-form="br-module" class="grid2" style="align-items:end"><label class="field"><span>' + L('شو؟', 'What?') + '</span><select name="m">' +
        X.MODULES.map((m) => '<option value="' + m + '">' + L(...MOD[m]) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>' + L('بأي شكل؟', 'Format') + '</span><select name="f"><option value="md">Markdown</option><option value="csv">CSV</option></select></label>' +
        '<button class="btn soft block" style="grid-column:1/-1">' + L('نزّل', 'Download') + '</button></form>' +
        UI.wave() +
        '<form data-form="br-ics"><p class="small">' + L('أسبوعك كملف <bdi>.ics</bdi> بيفتح بأي تطبيق تقويم.', 'Your week plan as an .ics file that opens in any calendar app.') + '</p>' +
        '<label class="check-row"><input type="checkbox" name="deadlines" value="1">' + L('ومواعيد الفرص كمان', 'And application deadlines too') + '</label>' +
        '<button class="btn soft block" style="margin-top:8px">' + L('نزّل الأسبوع (<bdi>.ics</bdi>)', 'Download the week (.ics)') + '</button></form></div>';
      html += '<div class="sec-title">' + L('جسور', 'Bridges') + '</div>' + root.Bridges.list.map((b) => b.card()).join('');
      return html;
    },
  };

  const F = root.Forms;
  const stamp = () => root.App.clock().day;
  F['br-reflect'] = (d) => {
    const [k, v] = (d.period || '').split(':');
    const period = k === 'y' ? { kind: 'year', y: v } : { kind: 'month', ym: v };
    const md = X.reflection(exportState(), period, { lang: S().lang, numerals: S().numerals, letterBodies: !!d.bodies });
    UI.download('rawaq-' + (period.kind === 'year' ? period.y : period.ym) + '.md', md, 'text/markdown;charset=utf-8');
  };
  F['br-module'] = (d) => {
    const st = exportState();
    if (d.f === 'csv') UI.download('rawaq-' + d.m + '-' + stamp() + '.csv', X.moduleCSV(st, d.m), 'text/csv;charset=utf-8');
    else UI.download('rawaq-' + d.m + '-' + stamp() + '.md', X.moduleMarkdown(st, d.m, S().lang), 'text/markdown;charset=utf-8');
  };
  F['br-ics'] = (d) => {
    UI.download('rawaq-week-' + stamp() + '.ics', X.buildICS(exportState(), { deadlines: !!d.deadlines, fromWeekKey: root.App.weekKey() }), 'text/calendar;charset=utf-8');
  };
})(typeof self !== 'undefined' ? self : this);
