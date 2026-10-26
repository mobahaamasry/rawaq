/* Work: study & exam, projects with WIP limits, tasks (with delegation), ideas, waiting-on. */
(function (root) {
  'use strict';
  const C = root.Core, UI = root.UI, Store = root.Store;
  const { L, T } = UI;
  const S = () => Store.settings;
  const nowIso = () => new Date().toISOString();
  const day = () => root.App.clock().day;
  const byCreated = (a, b) => ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1);

  const TABS = [
    ['study', 'دراسة', 'Study'], ['projects', 'مشاريع', 'Projects'], ['papers', 'أوراق', 'Papers'], ['apps', 'فرص', 'Applications'],
    ['tasks', 'شغلات', 'Tasks'], ['ideas', 'أفكار', 'Ideas'], ['waiting', 'بستنّى', 'Waiting on'],
  ];
  root.WorkTabs = root.WorkTabs || {};
  const AREA = { research: ['بحث', 'Research'], team: ['الفريق', 'Team'], teaching: ['تدريس', 'Teaching'], personal: ['شخصي', 'Personal'], learning: ['تعلّم', 'Learning'] };
  const areaName = (a) => L(...(AREA[a] || AREA.personal));
  const CH_STATES = [['لسا', 'Not yet'], ['مرّيت عليه', 'Went over it'], ['بفهمو', 'I get it']];

  /* ================= study ================= */
  function examCard(ex) {
    const ck = root.App.clock();
    const wl = C.weeksLeft(ck.day, ex.date);
    let when;
    if (wl == null) when = L('خلص.', 'Done.');
    else if (wl === 0) when = L('هالأسبوع.', 'This week.');
    else when = T('باقي {w}', '{w} to go', { w: UI.weeksWord(wl) });
    const ph = C.rampFor(ex, ck.day);
    const studied = C.weekTotals(Store.all('sessions'), root.App.weekKey(ck.day)).study || 0;
    let ramp = '';
    const season = root.Season && root.Season.now(ck.day);
    if (season && season.mode === 'season' && season.exam.id === ex.id) {
      const h = root.Season.hours(ex, ck.day);
      ramp = '<p style="margin-top:10px">' + T('موسم الامتحانات: حوالي {h} بالأسبوع.', 'Exam season: about {h} a week.', { h: UI.hoursWord(h) }) + '</p>' +
        '<p class="small muted">' + L('المشاريع يلي بالخلفية متوقفة لحالها لبعد الامتحانات.', 'Background projects are paused on their own until after the exams.') + '</p>';
      if (studied > 0) ramp += '<p class="small muted">' + T('لهلق: {d}', 'So far: {d}', { d: UI.fmtDur(studied) }) + '</p>';
    } else if (ph && wl != null) {
      const mid = Math.round((ph.lo + ph.hi) / 2);
      ramp = '<p style="margin-top:10px">' + T('هالأسبوع: حوالي {h}', 'This week: about {h}', { h: UI.hoursWord(mid) }) + '</p>';
      if (studied >= ph.hi * 60) ramp += '<p class="small" style="color:var(--sage)">' + L('وصلت لحد معقول هالأسبوع. الباقي بيستنى.', 'You\'ve reached a sensible amount this week. The rest can wait.') + '</p>';
      else if (studied > 0) ramp += '<p class="small muted">' + T('لهلق: {d}', 'So far: {d}', { d: UI.fmtDur(studied) }) + '</p>';
    }
    return '<div class="card"><div class="card-head"><div><h2 class="card-title">' + UI.ut(ex.name) + '</h2>' +
      '<div class="muted small">' + UI.fmtFull(ex.date) + '</div></div>' +
      '<button class="icon-btn" data-act="exam-edit" data-id="' + ex.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('edit') + '</button></div>' +
      '<p class="display" style="font-size:24px;margin:10px 0 0">' + when + '</p>' + ramp + '</div>';
  }

  function chapterRow(ch) {
    const st = ch.state || 0;
    return '<div class="row" style="flex-wrap:wrap;gap:8px">' +
      '<div class="row-main" style="min-width:60%"><div class="row-title">' + UI.ut(ch.name) + '</div>' +
      '<label class="check-row"><input type="checkbox" data-change="ch-teach" data-id="' + ch.id + '"' + (ch.teachBack ? ' checked' : '') + '>' + L('شرحتو لحدا / كتبت ملخص', 'Explained it / wrote a summary') + '</label></div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
      '<div class="tri" role="group">' + CH_STATES.map((s, i) => '<button data-act="ch-state" data-id="' + ch.id + '" data-s="' + i + '" aria-pressed="' + (st === i) + '">' + L(...s) + '</button>').join('') + '</div>' +
      '<button class="icon-btn" data-act="focus-start" data-ref="c:' + ch.id + '" aria-label="' + L('ابدأ ١٠ دقايق بس', 'Just start for 10 minutes') + '" style="color:var(--teal)">' + UI.icon('play') + '</button>' +
      '<button class="icon-btn" data-act="ch-edit" data-id="' + ch.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('dots') + '</button>' +
      '</div></div>';
  }

  function studyTab() {
    const exams = Store.all('exams').sort((a, b) => (a.date < b.date ? -1 : 1));
    let html = '';
    if (!exams.length) {
      html += '<div class="card">' + UI.empty('desk', L('ما في امتحان مسجّل.', 'No exam added.')) + '<button class="btn soft block" data-act="exam-edit">' + L('زيد امتحان', 'Add an exam') + '</button></div>';
    }
    for (const ex of exams) {
      html += examCard(ex);
      const subs = Store.all('subjects').filter((s) => s.examId === ex.id).sort(byCreated);
      for (const sub of subs) {
        const chs = Store.all('chapters').filter((c) => c.subjectId === sub.id).sort(byCreated);
        html += '<div class="card plain"><div class="card-head"><div><h2 class="card-title">' + UI.ut(sub.name) + '</h2>' +
          (chs.length ? '<div class="dots" aria-hidden="true">' + chs.map((c) => '<i class="s' + (c.state || 0) + '"></i>').join('') + '</div>' : '') + '</div>' +
          '<button class="icon-btn" data-act="sub-edit" data-id="' + sub.id + '" aria-label="' + L('عدّل', 'Edit') + '">' + UI.icon('dots') + '</button></div>' +
          '<div class="rows">' + chs.map(chapterRow).join('') + '</div>' +
          '<form class="inline-form" data-form="ch-add" style="margin-top:10px"><input type="hidden" name="sub" value="' + sub.id + '">' +
          '<input class="input" id="chAdd-' + sub.id + '" name="name" dir="auto" autocomplete="off" placeholder="' + L('فصل جديد…', 'A new chapter…') + '"><button class="btn soft">' + L('زيد', 'Add') + '</button></form></div>';
      }
      html += '<form class="inline-form" data-form="sub-add" style="margin:0 0 18px"><input type="hidden" name="exam" value="' + ex.id + '">' +
        '<input class="input" id="subAdd-' + ex.id + '" name="name" dir="auto" autocomplete="off" placeholder="' + L('مادة جديدة…', 'A new subject…') + '"><button class="btn">' + L('زيد مادة', 'Add subject') + '</button></form>';
    }
    if (exams.length) html += '<div class="center"><button class="btn text sm" data-act="exam-edit">' + UI.icon('plus') + L('امتحان تاني', 'Another exam') + '</button></div>';
    return html;
  }

  function examForm(ex) {
    const ramp = (ex && ex.ramp) || [];
    const row = (p, i) => '<div class="grid2" style="grid-template-columns:1fr 1fr 64px 64px;gap:6px;margin-bottom:8px">' +
      '<input class="input" type="date" name="from' + i + '" value="' + (p.from || '') + '" aria-label="' + L('من', 'From') + '">' +
      '<input class="input" type="date" name="to' + i + '" value="' + (p.to || '') + '" aria-label="' + L('لـ', 'To') + '">' +
      '<input class="input" type="number" min="0" max="60" name="lo' + i + '" value="' + (p.lo != null ? p.lo : '') + '" aria-label="' + L('من كم ساعة', 'Hours, low') + '">' +
      '<input class="input" type="number" min="0" max="60" name="hi' + i + '" value="' + (p.hi != null ? p.hi : '') + '" aria-label="' + L('لكم ساعة', 'Hours, high') + '"></div>';
    const rows = ramp.concat([{}]).slice(0, 6);
    return '<h3>' + (ex ? L('عدّل الامتحان', 'Edit the exam') : L('امتحان جديد', 'A new exam')) + '</h3>' +
      '<form data-form="exam-save"><input type="hidden" name="id" value="' + (ex ? ex.id : '') + '"><input type="hidden" name="n" value="' + rows.length + '">' +
      '<label class="field"><span>' + L('الاسم', 'Name') + '</span><input name="name" dir="auto" required value="' + UI.esc(ex ? ex.name : '') + '"></label>' +
      '<div class="grid2"><label class="field"><span>' + L('أول يوم امتحان', 'First exam day') + '</span><input type="date" name="date" required value="' + (ex ? ex.date : '') + '"></label>' +
      '<label class="field"><span>' + L('آخر يوم (إذا أكتر من يوم)', 'Last day (if several)') + '</span><input type="date" name="endDate" value="' + (ex && ex.endDate ? ex.endDate : '') + '"></label></div>' +
      '<div class="field"><span>' + L('الخطة على مراحل (ساعات بالأسبوع، من–لـ)', 'Ramp by phase (hours per week, low–high)') + '</span>' + rows.map(row).join('') + '</div>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      (ex ? '<button class="btn text" type="button" data-act="exam-delete" data-id="' + ex.id + '">' + L('امسحو', 'Delete') + '</button>' : '') + '</div></form>';
  }

  /* ================= projects ================= */
  function projectCard(p, wk) {
    const paused = C.pausedThisWeek(p, wk);
    let tags = '<span class="tag">' + areaName(p.area) + '</span>' + (p.kind === 'paper' ? ' <span class="tag teal">' + L('ورقة', 'Paper') + '</span>' : '');
    if (paused) tags += ' <span class="tag sage">' + L('هالأسبوع متوقف', 'Paused this week') + '</span>';
    const season = root.Season && root.Season.now();
    if (season && season.mode === 'season' && p.tier === 'background' && p.status === 'active') tags += ' <span class="tag sage">' + L('متوقفة لموسم الامتحانات', 'Paused for exam season') + '</span>';
    let body = '';
    if (p.status === 'active') {
      body += p.nextStep
        ? '<p class="small" style="margin-top:10px"><span class="muted">' + L('الخطوة الجاية:', 'Next tiny step:') + '</span> ' + UI.ut(p.nextStep) + '</p>'
        : '<button class="btn text sm" style="margin-top:6px;padding:0" data-act="proj-open" data-id="' + p.id + '">' + L('شو أصغر خطوة جاية؟', 'What is the next tiny step?') + '</button>';
      body += '<div class="btns" style="margin-top:8px"><button class="btn soft sm" data-act="focus-start" data-ref="p:' + p.id + '">' + UI.icon('play') + L('ابدأ ١٠ دقايق', 'Start 10 minutes') + '</button>' +
        (p.nextStep ? '<button class="btn text sm" data-act="proj-today" data-id="' + p.id + '">' + L('لليوم', 'For today') + '</button>' : '') + '</div>';
    } else if (p.status === 'paused') {
      if (p.pausedUntil && p.pausedUntil >= day()) body += '<p class="small muted" style="margin-top:8px">' + T('مستنية لبعد {d}.', 'Resting until after {d}.', { d: UI.fmtShort(p.pausedUntil) }) + '</p>';
      else if (p.pausedUntil) body += '<p class="small muted" style="margin-top:8px">' + L('صار فيك ترجعلها إذا حبيت.', 'You can come back to it whenever you like.') + '</p>';
    }
    return '<div class="card' + (p.status !== 'active' ? ' quiet plain' : '') + '"><div class="card-head"><div class="row-main"><div class="row-title">' + UI.ut(p.name) + '</div><div style="margin-top:4px">' + tags + '</div></div>' +
      '<button class="icon-btn" data-act="proj-open" data-id="' + p.id + '" aria-label="' + L('تفاصيل', 'Details') + '">' + UI.icon('dots') + '</button></div>' + body + '</div>';
  }

  function projectsTab() {
    const ps = Store.all('projects').sort(byCreated);
    const wk = root.App.weekKey();
    const main = ps.filter((p) => p.status === 'active' && p.tier === 'main');
    const bg = ps.filter((p) => p.status === 'active' && p.tier === 'background');
    const paused = ps.filter((p) => p.status === 'paused');
    const done = ps.filter((p) => p.status === 'done' || p.status === 'archived');
    let html = '<div class="btns end" style="margin-bottom:4px"><button class="btn soft sm" data-act="proj-new">' + UI.icon('plus') + L('مشروع جديد', 'New project') + '</button></div>';
    html += '<div class="sec-title"><span>' + L('الرئيسي', 'Main') + '</span><span class="tiny">' + T('حدّك {n}', 'Your limit: {n}', { n: UI.n(S().wip.main) }) + '</span></div>';
    html += main.length ? main.map((p) => projectCard(p, wk)).join('') : '<p class="small muted">' + L('ما في شي رئيسي هلق.', 'Nothing in Main right now.') + '</p>';
    html += '<div class="sec-title">' + L('بالخلفية', 'In the background') + '</div>';
    html += bg.length ? bg.map((p) => projectCard(p, wk)).join('') : '<p class="small muted">' + L('ولا شي بالخلفية.', 'Nothing in the background.') + '</p>';
    if (paused.length) html += '<details class="fold"><summary>' + L('متوقفين، وهاد طبيعي', 'Paused, and that\'s normal') + '</summary>' + paused.map((p) => projectCard(p, wk)).join('') + '</details>';
    if (done.length) html += '<details class="fold"><summary>' + L('خلصوا', 'Finished') + '</summary>' + done.map((p) => projectCard(p, wk)).join('') + '</details>';
    return html;
  }

  function projectForm(p, prefill) {
    const v = p || { name: prefill || '', area: 'research', tier: 'main', kind: 'project', nextStep: '' };
    const chip = (name, val, cur, label) => '<label class="chip"><input type="radio" name="' + name + '" value="' + val + '"' + (val === cur ? ' checked' : '') + '>' + label + '</label>';
    let html = '<h3>' + (p ? L('المشروع', 'Project') : L('مشروع جديد', 'New project')) + '</h3>' +
      '<form data-form="proj-save"><input type="hidden" name="id" value="' + (p ? p.id : '') + '">' +
      '<label class="field"><span>' + L('الاسم', 'Name') + '</span><input name="name" dir="auto" required autocomplete="off" value="' + UI.esc(v.name) + '"' + (p ? '' : ' autofocus') + '></label>' +
      '<label class="field"><span>' + L('المجال', 'Area') + '</span><select name="area">' + UI.AREAS.map((a) => '<option value="' + a + '"' + (a === v.area ? ' selected' : '') + '>' + areaName(a) + '</option>').join('') + '</select></label>' +
      '<div class="field"><span>' + L('وين مكانو؟', 'Where does it sit?') + '</span><div class="chips">' + chip('tier', 'main', v.tier, L('رئيسي', 'Main')) + chip('tier', 'background', v.tier, L('بالخلفية', 'Background')) + '</div></div>' +
      '<div class="field"><span>' + L('نوعو', 'Kind') + '</span><div class="chips">' + chip('kind', 'project', v.kind, L('مشروع', 'Project')) + chip('kind', 'paper', v.kind, L('ورقة', 'Paper')) + '</div></div>' +
      '<label class="field"><span>' + L('أصغر خطوة جاية (إذا بدك)', 'The next tiny step (optional)') + '</span><input name="nextStep" dir="auto" autocomplete="off" value="' + UI.esc(v.nextStep || '') + '" placeholder="' + L('مثلاً: افتح الملف واقرا أول فقرة', 'e.g. open the file and read the first paragraph') + '"></label>' +
      '<button class="btn lamp block">' + L('احفظ', 'Save') + '</button></form>';
    if (p) {
      html += '<div class="sec-title">' + L('حالتو', 'Status') + '</div><div class="btns">';
      if (p.status === 'active') html += '<button class="btn sage sm" data-act="proj-status" data-id="' + p.id + '" data-s="paused">' + L('وقّفها', 'Pause') + '</button>';
      if (p.status === 'paused' || p.status === 'done' || p.status === 'archived') html += '<button class="btn soft sm" data-act="proj-status" data-id="' + p.id + '" data-s="active">' + L('رجّعها', 'Bring it back') + '</button>';
      if (p.status !== 'done') html += '<button class="btn sm" data-act="proj-status" data-id="' + p.id + '" data-s="done">' + L('خلصت', 'Finished') + '</button>';
      if (p.status !== 'archived') html += '<button class="btn text sm" data-act="proj-status" data-id="' + p.id + '" data-s="archived">' + L('أرشيف', 'Archive') + '</button>';
      html += '<button class="btn text sm" style="color:var(--clay)" data-act="proj-delete" data-id="' + p.id + '">' + L('امسح', 'Delete') + '</button></div>';
    }
    return html;
  }

  /* WIP: before something new becomes active, something steps back. */
  let pending = null; // { draft, ideaId }
  function trySaveProject(draft, ideaId) {
    const block = C.wipBlock(Store.all('projects'), draft, S().wip);
    if (!block) {
      Store.put('projects', draft);
      if (ideaId) Store.del('ideas', ideaId);
      return true;
    }
    pending = { draft, ideaId };
    UI.sheet.open(() => stepBackSheet(block));
    return false;
  }
  function stepBackSheet(block) {
    const d = pending.draft;
    const body = block.kind === 'main'
      ? T('عندك {n} مشاريع رئيسية شغّالة. الحد موجود لسبب.', 'You have {n} Main projects running. The limit is there for a reason.', { n: UI.n(block.blockers.length) })
      : L('عندك ورقتين شغّالين. الحد موجود لسبب.', 'You have two papers in progress. The limit is there for a reason.');
    return '<h3>' + L('قبل ما نضيف شي جديد، شو بدو يتأجل؟', 'Before adding something new, what steps back?') + '</h3>' +
      '<p class="muted small">' + body + '</p>' +
      '<div class="rows" style="margin-top:6px">' + block.blockers.map((b) => '<div class="row"><div class="row-main">' + UI.ut(b.name) + '</div>' +
        '<button class="btn sage sm" data-act="wip-pause" data-id="' + b.id + '">' + L('وقّفها', 'Pause') + '</button>' +
        '<button class="btn text sm" data-act="wip-done" data-id="' + b.id + '">' + L('خلصت', 'Finished') + '</button></div>').join('') + '</div>' +
      UI.wave() +
      '<div class="btns">' +
      '<button class="btn sm" data-act="wip-idea">' + L('خليها فكرة هلق', 'Keep it as an idea for now') + '</button>' +
      (block.kind === 'main' && d.tier === 'main' ? '<button class="btn sm" data-act="wip-bg">' + L('خليها بالخلفية', 'Put it in the background') + '</button>' : '') +
      '<button class="btn text sm" data-act="wip-cancel">' + L('ولا شي هلق', 'Nothing for now') + '</button></div>';
  }
  function finishPending(msg) {
    const p = pending;
    pending = null;
    UI.sheet.close();
    if (p && trySaveProject(p.draft, p.ideaId)) UI.toast(msg || T('تمام، {n} هلق بالشغل.', 'Okay. {n} is active now.', { n: UI.raw(UI.ut(p.draft.name)) }));
  }

  /* ================= tasks ================= */
  function taskRow(t) {
    const p = t.projectId && Store.get('projects', t.projectId);
    const pinned = t.pinnedDate === day();
    const sub = [];
    if (p) sub.push(UI.ut(p.name));
    if (t.owner === 'delegated') sub.push(T('عند {w}', 'With {w}', { w: UI.raw(UI.ut(t.delegatedTo || '')) }));
    if (t.owner === 'waiting') sub.push(L('بستنّى', 'Waiting'));
    return '<div class="row">' +
      '<button class="circle-check" data-act="task-toggle" data-id="' + t.id + '" aria-pressed="' + (t.status === 'done') + '" aria-label="' + L('خلصت', 'Done') + '"><i></i></button>' +
      '<div class="row-main tap" data-act="task-open" data-id="' + t.id + '"><div class="row-title">' + UI.ut(t.title) + (pinned ? ' <span class="tag lamp">' + L('اليوم', 'Today') + '</span>' : '') + '</div>' +
      (sub.length ? '<div class="row-sub">' + sub.join(' · ') + '</div>' : '') + '</div>' +
      (t.status === 'open' && (t.owner || 'me') === 'me' ? (pinned ? '' : '<button class="btn text sm" data-act="task-today" data-id="' + t.id + '">' + L('لليوم', 'Today') + '</button>') +
        '<button class="icon-btn" data-act="focus-start" data-ref="i:' + t.id + '" style="color:var(--teal)" aria-label="' + L('ابدأ ١٠ دقايق بس', 'Just start for 10 minutes') + '">' + UI.icon('play') + '</button>' : '') +
      '</div>';
  }

  function projectSelect(sel) {
    return '<select name="projectId" class="input" style="max-width:40%"><option value="">' + L('بدون مشروع', 'No project') + '</option>' +
      Store.all('projects').filter((p) => p.status === 'active').map((p) => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + UI.esc(p.name) + '</option>').join('') + '</select>';
  }

  function tasksTab() {
    const items = Store.all('items').sort(byCreated);
    const mine = items.filter((i) => i.status === 'open' && (i.owner || 'me') === 'me');
    const others = items.filter((i) => i.status === 'open' && (i.owner || 'me') !== 'me');
    const done = items.filter((i) => i.status === 'done').sort((a, b) => ((a.doneAt || '') > (b.doneAt || '') ? -1 : 1)).slice(0, 15);
    let html = '<form class="inline-form" data-form="task-add" style="margin-bottom:12px">' +
      '<input class="input" id="taskAdd" name="title" dir="auto" autocomplete="off" placeholder="' + L('شغلة جديدة…', 'A new task…') + '">' + projectSelect('') +
      '<button class="btn soft">' + L('زيد', 'Add') + '</button></form>';
    html += '<div class="card plain">' + (mine.length ? '<div class="rows">' + mine.map(taskRow).join('') + '</div>' : UI.empty('desk', L('ما في شغلات مفتوحة. براحتك.', 'No open tasks. Take it easy.'))) + '</div>';
    if (others.length) html += '<div class="sec-title">' + L('عند غيري', 'With others') + '</div><div class="card plain"><div class="rows">' + others.map(taskRow).join('') + '</div></div>';
    if (done.length) html += '<details class="fold"><summary>' + L('خلصوا', 'Done') + '</summary><div class="card plain quiet"><div class="rows">' + done.map(taskRow).join('') + '</div></div></details>';
    return html;
  }

  function taskForm(t) {
    const owner = t.owner || 'me';
    const chip = (val, label) => '<label class="chip"><input type="radio" name="owner" value="' + val + '"' + (val === owner ? ' checked' : '') + '>' + label + '</label>';
    return '<h3>' + L('الشغلة', 'Task') + '</h3><form data-form="task-save"><input type="hidden" name="id" value="' + t.id + '">' +
      '<label class="field"><span>' + L('شو هي؟', 'What is it?') + '</span><input name="title" dir="auto" required value="' + UI.esc(t.title) + '"></label>' +
      '<label class="field"><span>' + L('المشروع', 'Project') + '</span>' + projectSelect(t.projectId).replace('style="max-width:40%"', '') + '</label>' +
      '<div class="field"><span>' + L('مع مين هي؟', 'Whose is it?') + '</span><div class="chips">' + chip('me', L('إلي', 'Mine')) + chip('delegated', L('عطيتها لحدا', 'Delegated')) + chip('waiting', L('بستنّى', 'Waiting')) + '</div></div>' +
      '<label class="field"><span>' + L('لمين؟ (إذا عطيتها)', 'To whom? (if delegated)') + '</span><input name="delegatedTo" dir="auto" autocomplete="off" value="' + UI.esc(t.delegatedTo || '') + '"></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button>' +
      '<button class="btn text" type="button" data-act="task-delete" data-id="' + t.id + '">' + L('امسحها', 'Delete') + '</button></div></form>';
  }

  /* ================= ideas / waiting ================= */
  function ideasTab() {
    const ideas = Store.all('ideas').sort(byCreated).reverse();
    let html = '<p class="muted small">' + L('الأفكار ببلاش، الالتزامات لأ. حط كل يلي ببالك هون، بدون حد.', 'Ideas are free; commitments are not. Put anything here, no limit.') + '</p>' +
      '<form class="inline-form" data-form="idea-add" style="margin:10px 0 14px"><input class="input" id="ideaAdd" name="text" dir="auto" autocomplete="off" placeholder="' + L('فكرة…', 'An idea…') + '"><button class="btn soft">' + L('حطها', 'Add') + '</button></form>';
    if (!ideas.length) return html + '<div class="card plain">' + UI.empty('jasmine', L('لما تجي فكرة، إلها مكان هون.', 'When an idea comes, it has a place here.')) + '</div>';
    return html + '<div class="card plain"><div class="rows">' + ideas.map((i) => '<div class="row"><div class="row-main"><div>' + UI.ut(i.text) + '</div><div class="row-sub">' + UI.fmtShort((i.createdAt || nowIso()).slice(0, 10)) + '</div></div>' +
      '<button class="btn text sm" data-act="idea-promote" data-id="' + i.id + '">' + L('مشروع؟', 'Project?') + '</button>' +
      '<button class="icon-btn" data-act="idea-delete" data-id="' + i.id + '" aria-label="' + L('امسحها', 'Delete') + '">' + UI.icon('close') + '</button></div>').join('') + '</div></div>';
  }

  function waitingTab() {
    const ws = Store.all('waiting').sort(byCreated);
    const open = ws.filter((w) => !w.done), done = ws.filter((w) => w.done).slice(-10).reverse();
    let html = '<p class="muted small">' + L('شي عم تستنّاه من حدا؟ حطّو هون وريّح راسك. ما رح يذكّرك فيه قبل وقتو.', 'Waiting on someone? Put it here and rest your head. It won\'t come up before its time.') + '</p>' +
      '<form class="card" data-form="wait-add" style="margin-top:10px">' +
      '<label class="field"><span>' + L('شو؟', 'What?') + '</span><input id="wWhat" name="what" dir="auto" required autocomplete="off" placeholder="' + L('ردّ على الـ draft، رسالة توصية…', 'Comments on the draft, a reference letter…') + '"></label>' +
      '<div class="grid2"><label class="field"><span>' + L('من مين؟', 'From whom?') + '</span><input id="wWho" name="who" dir="auto" autocomplete="off"></label>' +
      '<label class="field"><span>' + L('بشوف فيها بـ (إذا بدك)', 'Check back on (optional)') + '</span><input type="date" name="checkBackOn"></label></div>' +
      '<button class="btn soft block">' + L('حطها', 'Put it here') + '</button></form>';
    if (open.length) {
      html += '<div class="card plain"><div class="rows">' + open.map((w) => '<div class="row"><div class="row-main tap" data-act="wait-open" data-id="' + w.id + '"><div class="row-title">' + UI.ut(w.what) + '</div>' +
        '<div class="row-sub">' + (w.who ? T('من {w}', 'From {w}', { w: UI.raw(UI.ut(w.who)) }) : '') + (w.checkBackOn ? (w.who ? ' · ' : '') + T('بشوف فيها {d}', 'Check back {d}', { d: UI.fmtShort(w.checkBackOn) }) : '') + '</div></div>' +
        '<button class="btn sage sm" data-act="wait-done" data-id="' + w.id + '">' + L('وصل', 'Arrived') + '</button></div>').join('') + '</div></div>';
    }
    if (done.length) html += '<details class="fold"><summary>' + L('وصلوا', 'Arrived') + '</summary><div class="card plain quiet"><div class="rows">' + done.map((w) => '<div class="row"><div class="row-main">' + UI.ut(w.what) + '</div><button class="icon-btn" data-act="wait-delete" data-id="' + w.id + '" aria-label="' + L('امسحها', 'Delete') + '">' + UI.icon('close') + '</button></div>').join('') + '</div></details>';
    return html;
  }

  root.Screens.work = {
    title: () => L('الشغل', 'Work'),
    render(r) {
      const tab = TABS.some((t) => t[0] === r.parts[1]) ? r.parts[1] : 'study';
      const seg = '<nav class="seg" id="workSeg">' + TABS.map((t) => '<a href="#/work/' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + L(t[1], t[2]) + '</a>').join('') + '</nav>';
      const own = { study: studyTab, projects: projectsTab, tasks: tasksTab, ideas: ideasTab, waiting: waitingTab }[tab];
      const body = own ? own() : root.WorkTabs[tab](r);
      return seg + body;
    },
    mount() {
      const cur = document.querySelector('#workSeg [aria-current="page"]');
      if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    },
  };

  /* ================= actions ================= */
  const A = root.Actions, F = root.Forms;

  // exams, subjects, chapters
  A['exam-edit'] = (el) => { const ex = el.dataset.id && Store.get('exams', el.dataset.id); UI.sheet.open(() => examForm(ex)); };
  F['exam-save'] = (d) => {
    const ramp = [];
    for (let i = 0; i < Number(d.n); i++) {
      if (d['from' + i] && d['to' + i]) ramp.push({ from: d['from' + i], to: d['to' + i], lo: Number(d['lo' + i] || 0), hi: Number(d['hi' + i] || d['lo' + i] || 0) });
    }
    const cur = d.id ? Store.get('exams', d.id) : { id: Store.uid(), createdAt: nowIso() };
    UI.sheet.close();
    Store.put('exams', { ...cur, name: d.name.trim(), date: d.date, endDate: d.endDate && d.endDate > d.date ? d.endDate : null, ramp });
  };
  A['exam-delete'] = (el) => UI.confirm({
    title: L('تمسح الامتحان؟', 'Delete this exam?'), body: L('المواد والفصول تبعو كمان رح تنمسح.', 'Its subjects and chapters go too.'),
    yes: L('لا، خليه', 'No, keep it'), no: L('امسحو', 'Delete'), noClass: 'clay',
    onNo: () => {
      const id = el.dataset.id;
      const refs = [['exams', id]];
      for (const s of Store.all('subjects').filter((x) => x.examId === id)) {
        refs.push(['subjects', s.id]);
        for (const c of Store.all('chapters').filter((x) => x.subjectId === s.id)) refs.push(['chapters', c.id]);
      }
      UI.removeWithUndo(refs);
    },
  });
  F['sub-add'] = (d, f) => { const name = (d.name || '').trim(); if (!name) return; f.reset(); Store.put('subjects', { id: Store.uid(), examId: d.exam, name, createdAt: nowIso() }); };
  F['ch-add'] = (d, f) => { const name = (d.name || '').trim(); if (!name) return; f.reset(); Store.put('chapters', { id: Store.uid(), subjectId: d.sub, name, state: 0, teachBack: false, createdAt: nowIso() }); };
  A['ch-state'] = (el) => Store.patch('chapters', el.dataset.id, { state: Number(el.dataset.s) });
  root.Changes['ch-teach'] = (el) => Store.patch('chapters', el.dataset.id, { teachBack: el.checked });
  A['ch-edit'] = (el) => {
    const ch = Store.get('chapters', el.dataset.id);
    if (!ch) return;
    UI.sheet.open(() => '<h3>' + L('الفصل', 'Chapter') + '</h3><form data-form="ch-save"><input type="hidden" name="id" value="' + ch.id + '">' +
      '<label class="field"><span>' + L('الاسم', 'Name') + '</span><input name="name" dir="auto" required value="' + UI.esc(ch.name) + '"></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button><button class="btn text" type="button" data-act="ch-delete" data-id="' + ch.id + '">' + L('امسحو', 'Delete') + '</button></div></form>');
  };
  F['ch-save'] = (d) => { UI.sheet.close(); Store.patch('chapters', d.id, { name: d.name.trim() }); };
  A['ch-delete'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['chapters', el.dataset.id]]); };
  A['sub-edit'] = (el) => {
    const s = Store.get('subjects', el.dataset.id);
    if (!s) return;
    UI.sheet.open(() => '<h3>' + L('المادة', 'Subject') + '</h3><form data-form="sub-save"><input type="hidden" name="id" value="' + s.id + '">' +
      '<label class="field"><span>' + L('الاسم', 'Name') + '</span><input name="name" dir="auto" required value="' + UI.esc(s.name) + '"></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button><button class="btn text" type="button" data-act="sub-delete" data-id="' + s.id + '">' + L('امسحها', 'Delete') + '</button></div></form>');
  };
  F['sub-save'] = (d) => { UI.sheet.close(); Store.patch('subjects', d.id, { name: d.name.trim() }); };
  A['sub-delete'] = (el) => {
    UI.sheet.close();
    const refs = [['subjects', el.dataset.id]];
    for (const c of Store.all('chapters').filter((x) => x.subjectId === el.dataset.id)) refs.push(['chapters', c.id]);
    UI.removeWithUndo(refs);
  };

  // projects
  A['proj-new'] = () => UI.sheet.open(() => projectForm(null));
  A['proj-open'] = (el) => { const p = Store.get('projects', el.dataset.id); if (p) UI.sheet.open(() => projectForm(Store.get('projects', p.id) || p)); };
  F['proj-save'] = (d) => {
    const cur = d.id ? Store.get('projects', d.id) : { id: Store.uid(), status: 'active', createdAt: nowIso() };
    const draft = { ...cur, name: d.name.trim(), area: d.area, tier: d.tier || 'main', kind: d.kind || 'project', nextStep: (d.nextStep || '').trim() };
    const ideaId = pendingIdea;
    pendingIdea = null;
    UI.sheet.close(true);
    if (trySaveProject(draft, ideaId) && !d.id) UI.toast(T('{n} هلق بالشغل.', '{n} is active.', { n: UI.raw(UI.ut(draft.name)) }));
  };
  A['proj-status'] = (el) => {
    const p = Store.get('projects', el.dataset.id);
    if (!p) return;
    const s = el.dataset.s;
    UI.sheet.close(true);
    if (s === 'active') { trySaveProject({ ...p, status: 'active', pausedUntil: null }); return; }
    Store.put('projects', { ...p, status: s, ...(s === 'done' ? { doneAt: nowIso() } : {}) });
    if (s === 'done') UI.toast(L('خلصت. هاد شي بيستاهل نجمة.', 'Finished. That deserves a star.'));
  };
  A['proj-delete'] = (el) => UI.confirm({
    title: L('تمسح المشروع؟', 'Delete this project?'), body: L('إذا بس بدك ترتاح منو، "وقّفها" أو "أرشيف" كمان بيمشوا.', 'If you just want a break from it, Pause or Archive work too.'),
    yes: L('لا، خليه', 'No, keep it'), no: L('امسحو', 'Delete'), noClass: 'clay',
    onNo: () => UI.removeWithUndo([['projects', el.dataset.id]]),
  });
  A['proj-today'] = (el) => root.Today.pinProjectStep(el.dataset.id);
  A['wip-pause'] = (el) => { Store.patch('projects', el.dataset.id, { status: 'paused' }); finishPending(); };
  A['wip-done'] = (el) => { Store.patch('projects', el.dataset.id, { status: 'done', doneAt: nowIso() }); finishPending(); };
  A['wip-bg'] = () => { if (pending) pending.draft.tier = 'background'; finishPending(); };
  A['wip-idea'] = () => {
    const p = pending;
    pending = null;
    UI.sheet.close();
    if (!p) return;
    if (!p.ideaId) Store.put('ideas', { id: Store.uid(), text: p.draft.name + (p.draft.nextStep ? ' · ' + p.draft.nextStep : ''), createdAt: nowIso() });
    UI.toast(L('انحطت بالأفكار. الأفكار ببلاش.', 'Saved to Ideas. Ideas are free.'));
  };
  A['wip-cancel'] = () => { pending = null; UI.sheet.close(); };

  // tasks
  F['task-add'] = (d, f) => {
    const title = (d.title || '').trim();
    if (!title) return;
    f.reset();
    Store.put('items', { id: Store.uid(), title, projectId: d.projectId || null, status: 'open', owner: 'me', createdAt: nowIso() });
  };
  A['task-toggle'] = (el) => {
    const t = Store.get('items', el.dataset.id);
    if (!t) return;
    Store.patch('items', t.id, t.status === 'done' ? { status: 'open', doneAt: null } : { status: 'done', doneAt: nowIso() });
  };
  A['task-today'] = (el) => root.Today.pin(el.dataset.id);
  A['task-open'] = (el) => { const t = Store.get('items', el.dataset.id); if (t) UI.sheet.open(() => taskForm(t)); };
  F['task-save'] = (d) => {
    const t = Store.get('items', d.id);
    if (!t) return;
    const next = { ...t, title: d.title.trim(), projectId: d.projectId || null, owner: d.owner || 'me', delegatedTo: (d.delegatedTo || '').trim() };
    UI.sheet.close(true);
    if ((t.owner === 'delegated' || t.owner === 'waiting') && next.owner === 'me') {
      UI.confirm({
        title: L('متأكد بدك تشيلها عنهن؟', 'Sure you want to take it back from them?'),
        body: L('عطيتها لسبب. يمكن تستنّى شوي؟', 'You handed it over for a reason. Maybe give it a little time?'),
        yes: L('لا، خليها عندهن', 'No, leave it with them'), no: L('إي، رجّعها إلي', 'Yes, take it back'), noClass: 'text',
        onYes: () => Store.put('items', { ...next, owner: t.owner, delegatedTo: t.delegatedTo }),
        onNo: () => Store.put('items', next),
      });
      return;
    }
    Store.put('items', next);
  };
  A['task-delete'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['items', el.dataset.id]]); };

  // ideas
  let pendingIdea = null;
  F['idea-add'] = (d, f) => { const text = (d.text || '').trim(); if (!text) return; f.reset(); Store.put('ideas', { id: Store.uid(), text, createdAt: nowIso() }); };
  A['idea-delete'] = (el) => UI.removeWithUndo([['ideas', el.dataset.id]]);
  A['idea-promote'] = (el) => {
    const i = Store.get('ideas', el.dataset.id);
    if (!i) return;
    pendingIdea = i.id;
    UI.sheet.open(() => projectForm(null, i.text), { onClose: () => { setTimeout(() => { if (!pending) pendingIdea = null; }, 0); } });
  };

  // waiting-on
  F['wait-add'] = (d, f) => {
    const what = (d.what || '').trim();
    if (!what) return;
    f.reset();
    Store.put('waiting', { id: Store.uid(), what, who: (d.who || '').trim(), checkBackOn: d.checkBackOn || null, done: false, createdAt: nowIso() });
    UI.toast(d.checkBackOn
      ? T('انحطت. ما في شي تعملو قبل {d}.', 'Saved. Nothing to do before {d}.', { d: UI.fmtShort(d.checkBackOn) })
      : L('انحطت. فيك تريّح راسك منها.', 'Saved. You can let it rest.'));
  };
  A['wait-done'] = (el) => Store.patch('waiting', el.dataset.id, { done: true, doneAt: nowIso() });
  A['wait-week'] = (el) => Store.patch('waiting', el.dataset.id, { checkBackOn: C.addDays(day(), 7) });
  A['wait-delete'] = (el) => UI.removeWithUndo([['waiting', el.dataset.id]]);
  A['wait-open'] = (el) => {
    const w = Store.get('waiting', el.dataset.id);
    if (!w) return;
    UI.sheet.open(() => '<h3>' + L('بستنّى', 'Waiting on') + '</h3><form data-form="wait-save"><input type="hidden" name="id" value="' + w.id + '">' +
      '<label class="field"><span>' + L('شو؟', 'What?') + '</span><input name="what" dir="auto" required value="' + UI.esc(w.what) + '"></label>' +
      '<label class="field"><span>' + L('من مين؟', 'From whom?') + '</span><input name="who" dir="auto" value="' + UI.esc(w.who || '') + '"></label>' +
      '<label class="field"><span>' + L('بشوف فيها بـ', 'Check back on') + '</span><input type="date" name="checkBackOn" value="' + (w.checkBackOn || '') + '"></label>' +
      '<div class="btns stretch"><button class="btn lamp">' + L('احفظ', 'Save') + '</button><button class="btn text" type="button" data-act="wait-delete-sheet" data-id="' + w.id + '">' + L('امسحها', 'Delete') + '</button></div></form>');
  };
  F['wait-save'] = (d) => { UI.sheet.close(); Store.patch('waiting', d.id, { what: d.what.trim(), who: (d.who || '').trim(), checkBackOn: d.checkBackOn || null }); };
  A['wait-delete-sheet'] = (el) => { UI.sheet.close(); UI.removeWithUndo([['waiting', el.dataset.id]]); };
})(typeof self !== 'undefined' ? self : this);
