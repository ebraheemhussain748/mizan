/* Mizan — first-run welcome, "About you", and the 5 questions that build a timetable.
   The same questions can be run again later from Settings ("Rebuild my timetable"). */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var C = M.calc;

  var wz = null; // { mode: 'onboard'|'setup', step, a: answers }

  var TRAVEL = [[0, 'None'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1½ hours']];
  var EXMIN = [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1½ hours']];
  var STUDY = [[0, 'None'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [150, '2½ hours'], [180, '3 hours'], [240, '4 hours']];
  var GOAL_DESC = {
    lose: 'More walking, a steady calorie deficit, a walk after dinner.',
    gain: 'Strength training and an extra snack every day.',
    fit: 'A balanced day with daily movement and good sleep.',
    study: 'More focused study time and a morning revision slot.',
    discipline: 'Planning in the morning, reflection at night, fixed times.'
  };
  var ROLE_DESC = {
    school: 'Classes most mornings, homework in the evening.',
    college: 'Lectures and labs, self-study, more freedom.',
    work: 'A job with set hours, learning after work.',
    home: 'At home, between jobs, retired, or your own hours.'
  };

  function start(mode) {
    var age = M.ageFrom(M.state.profile);
    var prev = M.state.setup && M.state.setup.answers;
    wz = { mode: mode, step: mode === 'onboard' ? 0 : 2, a: prev ? M.deepClone(prev) : M.setup.defaults('school', age) };
    if (!prev) wz.fresh = true;
  }
  M.startSetup = function () { start('setup'); M.go('setup'); };

  function roleName(a) { var r = M.ROLES.filter(function (x) { return x.id === a.role; })[0]; return r ? r.short.toLowerCase() : 'work'; }

  /* ------------------------------------------------------------------ */
  function render(el, mode) {
    if (!wz || wz.mode !== mode) start(mode);
    var st = M.state, a = wz.a;
    var total = mode === 'onboard' ? 8 : 6;
    var idx = mode === 'onboard' ? wz.step : wz.step - 2;
    var dots = '<div class="steps" aria-hidden="true">' + Array.apply(null, Array(total)).map(function (_, i) { return '<i class="' + (i <= idx ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    var qn = function (n) { return '<p class="q-count">Question ' + n + ' of 5</p>'; };
    var back = '<button type="button" class="btn btn-ghost" data-action="back">Back</button>';
    var html = '<div class="onboard">' + dots;

    if (wz.step === 0) {
      html += '<div class="brand-hero">' + M.logo(64) + '<div><strong>Mizan</strong><span>Balance your day, body &amp; plate</span></div></div>' +
        '<h1>Plan a day you can actually keep.</h1>' +
        '<p class="lede">Answer 5 quick questions — or plan it hour by hour with the assistant — and Mizan builds a timetable around your life, then helps you follow it, stay healthy and look after yourself.</p>' +
        '<ul class="checks" style="margin:18px 0 24px">' +
        '<li class="info">' + M.icon('dash') + '<span><strong>A dashboard for your day</strong> — what to do now, what’s next, water reminders and your BMI at a glance.</span></li>' +
        '<li class="info">' + M.icon('plan') + '<span><strong>A timetable made for you — or by you</strong> — from your school or work hours, sleep and goals, or built step by step in the chat with a check of what’s good and what to fix. Every block is editable.</span></li>' +
        '<li class="info">' + M.icon('run') + '<span><strong>Walk & run tracker</strong> — distance, time, steps and calories.</span></li>' +
        '<li class="info">' + M.icon('face') + '<span><strong>Skin, face & grooming guide</strong> — a routine for your skin type and styles for your face shape.</span></li>' +
        '<li class="info">' + M.icon('chat') + '<span><strong>A helpful assistant</strong> — ask how to do anything in the app.</span></li>' +
        '<li class="info">' + M.icon('lock') + '<span><strong>Private</strong> — no account needed. Your data stays on this device unless you back it up.</span></li></ul>' +
        '<div class="btn-row"><button type="button" class="btn btn-primary" data-action="next">Get started</button><button type="button" class="btn" data-action="restore">' + M.icon('cloud') + 'Restore my data</button><button type="button" class="btn btn-ghost" data-action="skip">Skip and explore</button></div>';
    } else if (wz.step === 1) {
      var p = st.profile;
      var w = M.latestWeight();
      html += '<h1>About you</h1><p class="lede">Used for your BMI, sleep, calorie and exercise guidance. All optional — you can change it any time in Settings.</p>' +
        '<form id="ob-form" class="stack" novalidate>' +
        '<div class="field"><label for="ob-name">First name</label><input class="input" id="ob-name" name="name" maxlength="40" value="' + M.esc(p.name) + '" autocomplete="given-name"></div>' +
        '<fieldset class="field"><legend class="label">Units</legend>' + U.radios('units', [['metric', 'kg & cm'], ['imperial', 'lb & inches']], st.settings.units) + '</fieldset>' +
        '<div class="form-grid">' + U.numField('age', 'Age', M.ageFrom(p) || '', 'years', { step: 1, min: 5, max: 110 }) +
        U.numField('h', 'Height', p.heightCm ? (M.imperial() ? M.fmt(M.cmToIn(p.heightCm), 1) : Math.round(p.heightCm)) : '', M.imperial() ? 'in' : 'cm', { step: 0.1 }) +
        U.numField('w', 'Weight', w ? (M.imperial() ? M.fmt(M.kgToLb(w), 1) : w) : '', M.wUnit(), { step: 0.1 }) + '</div>' +
        '<fieldset class="field"><legend class="label">Sex</legend>' + U.radios('sex', [['female', 'Female'], ['male', 'Male'], ['', 'Prefer not to say']], p.sex) + '<span class="hint">Calorie and body-fat formulas differ by sex. If you skip this, Mizan uses an average.</span></fieldset>' +
        U.selectField('activity', 'How active are you on a normal day?', C.ACTIVITY.map(function (x) { return [x.id, x.label + ' — ' + x.desc]; }), p.activity) +
        '<label class="switch"><span class="sw-text"><strong>Use Asian BMI cut-offs</strong><span>Recommended for South Asian and East Asian backgrounds, where health risks start at a lower BMI.</span></span><input type="checkbox" name="asian"' + (st.settings.bmiStandard === 'asian' ? ' checked' : '') + '></label>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary">Continue</button>' + back + '</div></form>';
    } else if (wz.step === 2) {
      html += qn(1) + '<h1>What does your day look like?</h1><p class="lede">This decides the shape of your timetable.</p>' +
        '<form class="stack q-form" novalidate><fieldset class="field"><legend class="sr-only">Your day</legend><div class="choice-grid">' +
        M.ROLES.map(function (r) { return '<label class="choice block"><input type="radio" name="role" value="' + r.id + '"' + (a.role === r.id ? ' checked' : '') + '><span class="row" style="gap:8px">' + M.icon(r.icon, 'style="width:20px;height:20px"') + '<strong>' + M.esc(r.label) + '</strong></span><small>' + M.esc(ROLE_DESC[r.id]) + '</small></label>'; }).join('') +
        '</div></fieldset><div class="btn-row"><button type="submit" class="btn btn-primary">Next</button>' + back + '</div></form>' +
        '<div class="inset custom-tt" style="margin-top:20px"><strong>' + M.icon('chat', 'style="width:18px;height:18px;vertical-align:-3px"') + ' Prefer to plan every hour yourself?</strong><p class="soft" style="margin:4px 0 10px;font-size:var(--fs-sm)">Tell the assistant when you wake up, then what you do and until when — it checks your day and can fix weak spots.</p><button type="button" class="btn" data-action="custom">Build it step by step</button></div>';
    } else if (wz.step === 3) {
      var age = M.ageFrom(st.profile);
      html += qn(2) + '<h1>When do you wake up and go to sleep?</h1><p class="lede">Your usual times on a normal day.</p>' +
        '<form class="stack q-form" novalidate><div class="form-grid">' +
        '<div class="field"><label for="q-wake">Wake up</label><input class="input" id="q-wake" type="time" name="wake" value="' + M.esc(a.wake) + '" required></div>' +
        '<div class="field"><label for="q-bed">Go to sleep</label><input class="input" id="q-bed" type="time" name="bed" value="' + M.esc(a.bed) + '" required></div></div>' +
        '<p class="hint" id="q-sleep" aria-live="polite"></p>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary">Next</button>' + back + '</div></form>';
      setTimeout(function () {
        var f = M.$('.q-form', el); if (!f) return;
        var upd = function () {
          var need = C.sleepNeed(age);
          var sl = (M.toMin(f.wake.value) - M.toMin(f.bed.value) + 1440) % 1440;
          var ok = sl >= need.lo * 60 && sl <= need.hi * 60 + 30;
          M.$('#q-sleep', el).innerHTML = (ok ? M.icon('good', 'style="width:16px;height:16px;display:inline;vertical-align:-3px;color:var(--good)"') : M.icon('alert', 'style="width:16px;height:16px;display:inline;vertical-align:-3px;color:var(--warn)"')) +
            ' That’s <strong>' + M.fmtDur(sl) + '</strong> of sleep. ' + need.label + ' need ' + need.lo + '–' + need.hi + ' hours.';
        };
        f.wake.addEventListener('input', upd); f.bed.addEventListener('input', upd); upd();
      }, 0);
    } else if (wz.step === 4) {
      var home = a.role === 'home';
      var hasFixed = !home || !!a.start;
      var label = { school: 'school', college: 'college', work: 'work', home: 'busy' }[a.role] || 'work';
      html += qn(3) + '<h1>' + (home ? 'Do you have fixed busy hours?' : 'Your ' + label + ' hours') + '</h1><p class="lede">' + (home ? 'For example a class, a shift or looking after family. Leave it off if your days are flexible.' : 'When it starts and ends, which days, and how long it takes to get there.') + '</p>' +
        '<form class="stack q-form" novalidate>' +
        (home ? '<label class="switch"><span class="sw-text"><strong>I have fixed busy hours</strong></span><input type="checkbox" name="hasFixed"' + (hasFixed ? ' checked' : '') + '></label>' : '') +
        '<div class="stack fixed-fields"' + (hasFixed ? '' : ' hidden') + '><div class="form-grid">' +
        '<div class="field"><label for="q-start">Starts</label><input class="input" id="q-start" type="time" name="start" value="' + M.esc(a.start || '10:00') + '"></div>' +
        '<div class="field"><label for="q-end">Ends</label><input class="input" id="q-end" type="time" name="end" value="' + M.esc(a.end || '13:00') + '"></div></div>' +
        '<fieldset class="field"><legend class="label">Which days?</legend><div class="choice-row">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<label class="choice"><input type="checkbox" data-multi name="days" value="' + d + '"' + (a.days.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + M.DAY_SHORT[d] + '</span></label>'; }).join('') + '</div></fieldset>' +
        U.selectField('travel', 'Travel time each way', TRAVEL, a.travel || 0) + '</div>' +
        '<p class="err hidden" id="q-err" role="alert"></p>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary">Next</button>' + back + '</div></form>';
      setTimeout(function () {
        var f = M.$('.q-form', el); if (!f || !f.hasFixed) return;
        f.hasFixed.addEventListener('change', function () { M.$('.fixed-fields', el).hidden = !f.hasFixed.checked; });
      }, 0);
    } else if (wz.step === 5) {
      html += qn(4) + '<h1>What’s your main goal right now?</h1><p class="lede">Mizan adds the right kind of blocks for it. You can change goals any time.</p>' +
        '<form class="stack q-form" novalidate><fieldset class="field"><legend class="sr-only">Main goal</legend><div class="choice-grid">' +
        M.GOALS.map(function (g) { return '<label class="choice block"><input type="radio" name="goal" value="' + g.id + '"' + (a.goal === g.id ? ' checked' : '') + '><span><strong>' + M.esc(g.label) + '</strong></span><small>' + M.esc(GOAL_DESC[g.id]) + '</small></label>'; }).join('') +
        '</div></fieldset><div class="btn-row"><button type="submit" class="btn btn-primary">Next</button>' + back + '</div></form>';
    } else if (wz.step === 6) {
      var sLabel = a.role === 'school' || a.role === 'college' ? 'Study time each day (outside ' + roleName(a) + ')' : 'Learning or personal-project time each day';
      html += qn(5) + '<h1>Exercise and ' + (a.role === 'school' || a.role === 'college' ? 'study' : 'learning') + ' time</h1><p class="lede">Be realistic — a plan you can keep beats a perfect one.</p>' +
        '<form class="stack q-form" novalidate>' +
        '<fieldset class="field"><legend class="label">When do you like to exercise?</legend>' + U.radios('exWhen', [['morning', 'Morning'], ['evening', 'Evening'], ['none', 'Not yet']], a.exWhen) + '</fieldset>' +
        '<fieldset class="field ex-min"' + (a.exWhen === 'none' ? ' hidden' : '') + '><legend class="label">For how long?</legend>' + U.radios('exMin', EXMIN, a.exMin) + '</fieldset>' +
        '<fieldset class="field"><legend class="label">' + M.esc(sLabel) + '</legend>' + U.radios('studyMin', STUDY, a.studyMin) + '</fieldset>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary">See my timetable</button>' + back + '</div></form>';
      setTimeout(function () {
        var f = M.$('.q-form', el); if (!f) return;
        f.addEventListener('change', function (e) { if (e.target.name === 'exWhen') M.$('.ex-min', el).hidden = e.target.value === 'none'; });
      }, 0);
    } else {
      // --- preview ---
      var problems = M.setup.problems(a);
      html += '<h1>' + (problems.length ? 'Let’s fix one thing' : 'Here’s your timetable') + '</h1>';
      if (problems.length) {
        html += U.note('bad', problems.map(function (x) { return '<p>' + M.esc(x) + '</p>'; }).join('')) +
          '<div class="btn-row" style="margin-top:16px"><button type="button" class="btn btn-primary" data-action="goto" data-step="3">Change my times</button><button type="button" class="btn" data-action="goto" data-step="4">Change ' + roleName(a) + ' hours</button></div>';
      } else {
        var routines = M.setup.build(a);
        wz.preview = routines;
        var warn = M.setup.check(a, M.ageFrom(st.profile));
        html += '<p class="lede">Built from your answers. Every block can be changed later in Plan.</p>' +
          (warn.length ? U.note('warn', warn.map(function (x) { return '<p>' + M.esc(x.text) + '</p>'; }).join('')) : '') +
          routines.map(function (r, i) {
            var res = C.resolveBlocks(r, M.today());
            var an = C.analyzeRoutine(r, st.profile, M.today());
            var legend = '<div class="ds-legend">' + M.CATS.filter(function (c) { return an.totals[c.id]; }).sort(function (x, y) { return an.totals[y.id] - an.totals[x.id]; }).map(function (c) { return '<span style="--cat:' + M.catVar(c.id) + '"><i aria-hidden="true"></i>' + M.esc(c.label) + ' <em>' + M.fmtDurShort(an.totals[c.id]) + '</em></span>'; }).join('') + '</div>';
            return '<section class="panel preview-routine"' + (i ? ' style="margin-top:16px"' : '') + '><div class="panel-title"><div><h3>' + M.esc(r.name) + '</h3><p class="ds-sub">' + r.days.map(function (d) { return M.DAY_SHORT[d]; }).join(', ') + '</p></div></div>' +
              U.dayStrip(res, { now: null, date: M.today() }) + legend +
              '<details class="preview-list"' + (i === 0 ? ' open' : '') + '><summary>All ' + res.length + ' blocks</summary><ol class="mini-agenda">' + res.map(function (x) {
                return '<li style="--cat:' + M.catVar(x.b.cat) + '"><span class="num">' + M.fmtTime(x.start) + '</span><i aria-hidden="true"></i><span>' + M.esc(x.b.title) + '</span><em>' + M.fmtDurShort(x.dur) + '</em></li>';
              }).join('') + '</ol></details></section>';
          }).join('') +
          '<div class="btn-row" style="margin-top:20px"><button type="button" class="btn btn-primary" data-action="use">' + (wz.mode === 'onboard' ? 'Use this timetable' : 'Replace my timetable') + '</button>' + back +
          (wz.mode === 'setup' ? '<a class="btn btn-ghost" href="#/plan">Keep my current one</a>' : '') + '</div>';
      }
    }
    html += (wz.mode === 'onboard' ? '<p class="muted" style="margin-top:28px;font-size:var(--fs-sm)">Mizan gives general guidance, not medical advice. <a href="privacy.html">Privacy policy</a> · <a href="#/science">Science & sources</a></p>' : '') + '</div>';
    el.innerHTML = html;
    if (el.querySelector('.daystrip')) U.fitStrip(el);

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-action]');
      if (!b) return;
      var act = b.getAttribute('data-action');
      if (act === 'next') { wz.step = 1; M.refresh(); }
      else if (act === 'back') {
        var min = wz.mode === 'onboard' ? 0 : 2;
        if (wz.step <= min) { if (wz.mode === 'setup') { wz = null; M.go('settings'); } return; }
        wz.step -= 1; M.render();
      }
      else if (act === 'goto') { wz.step = +b.getAttribute('data-step'); M.render(); }
      else if (act === 'skip') finish(false);
      else if (act === 'restore') { if (M.backup) M.backup.restoreSheet(); }
      else if (act === 'custom') { if (M.assistant) M.assistant.startBuilder(); }
      else if (act === 'use') use();
    });
    var f1 = M.$('#ob-form', el);
    if (f1) {
      f1.addEventListener('change', function (e) {
        if (e.target.name !== 'units') return;
        if (!saveAbout(f1)) {
          // keep what they typed: undo the switch until the numbers are fixed
          var prev = f1.querySelector('input[name=units][value="' + M.state.settings.units + '"]');
          if (prev) prev.checked = true;
          M.toast('Fix the marked number first, then switch units.');
          return;
        }
        M.state.settings.units = e.target.value; M.state.settings.unitPrefs = {}; M.refresh();
      });
      f1.addEventListener('submit', function (e) { e.preventDefault(); if (!saveAbout(f1)) return; var age = M.ageFrom(M.state.profile); if (wz.fresh) wz.a = M.setup.defaults(wz.a.role, age); wz.step = 2; M.render(); });
    }
    var qf = M.$('.q-form', el);
    if (qf) qf.addEventListener('submit', function (e) { e.preventDefault(); if (readStep(qf, el)) { wz.step += 1; M.render(); } });
  }

  /* Read the current question into the answers. Returns false to stay on the step. */
  function readStep(f, el) {
    var d = M.formData(f), a = wz.a;
    if (wz.step === 2) {
      var role = d.role || a.role;
      if (role !== a.role) {
        // new role: fresh default hours, keep sleep times the person may have set
        var keep = { wake: a.wake, bed: a.bed, goal: a.goal, exWhen: a.exWhen, exMin: a.exMin };
        wz.a = Object.assign(M.setup.defaults(role, M.ageFrom(M.state.profile)), wz.fresh ? {} : keep);
      }
    } else if (wz.step === 3) {
      if (!d.wake || !d.bed) return false;
      a.wake = d.wake; a.bed = d.bed;
    } else if (wz.step === 4) {
      var err = M.$('#q-err', el);
      if (f.hasFixed && !f.hasFixed.checked) { a.start = ''; a.end = ''; a.days = [1, 2, 3, 4, 5, 6]; a.travel = 0; return true; }
      a.start = d.start; a.end = d.end; a.travel = +d.travel || 0;
      a.days = (d.days || []).map(Number);
      if (!a.days.length) { err.textContent = 'Pick at least one day.'; err.classList.remove('hidden'); M.haptic('error'); return false; }
      if (!d.start || !d.end || M.toMin(d.end) <= M.toMin(d.start)) { err.textContent = 'The end time needs to be after the start time.'; err.classList.remove('hidden'); M.haptic('error'); return false; }
    } else if (wz.step === 5) {
      a.goal = d.goal || a.goal;
      if (wz.fresh || a._goalDefaults !== false) {
        // goal-based suggestions for the next question
        if (a.goal === 'lose') { a.exMin = Math.max(a.exMin, 45); if (a.exWhen === 'none') a.exWhen = 'evening'; }
        if (a.goal === 'gain') { a.exMin = Math.max(a.exMin, 45); if (a.exWhen === 'none') a.exWhen = 'evening'; }
        if (a.goal === 'study' && (a.role === 'school' || a.role === 'college')) a.studyMin = Math.max(a.studyMin, 150);
      }
    } else if (wz.step === 6) {
      a.exWhen = d.exWhen || a.exWhen; a.exMin = +d.exMin || a.exMin; a.studyMin = d.studyMin === undefined ? a.studyMin : +d.studyMin;
      a._goalDefaults = false;
    }
    return true;
  }

  /* → false (and marks the fields) when a number can't be right */
  function saveAbout(f) {
    var d = M.formData(f);
    var p = M.state.profile;
    var age = M.num(d.age), hN = M.num(d.h), h = hN ? (M.imperial() ? M.inToCm(hN) : hN) : null, w = M.inW(d.w);
    var errs = C.checkBody({ age: age, heightCm: h, weightKg: w }, { minAge: 5, minAgeMsg: 'Mizan is made for ages 5 and up.' });
    [['age', 'age'], ['heightCm', 'h'], ['weightKg', 'w']].forEach(function (x) { var e = errs.filter(function (y) { return y.key === x[0]; })[0]; U.fieldError(f, x[1], e ? e.msg : ''); });
    if (errs.length) { M.haptic('error'); var first = f.querySelector('.has-err input:not([type=hidden])'); if (first) first.focus(); return false; }
    p.name = (d.name || '').trim();
    if (age) { p.age = Math.round(age); p.dob = ''; }
    if (h) p.heightCm = h;
    if (w) M.logWeight(w);
    p.sex = d.sex || '';
    p.activity = d.activity || p.activity;
    M.state.settings.bmiStandard = d.asian ? 'asian' : 'who';
    M.save();
    return true;
  }

  function use() {
    var go = function () {
      var a = wz.a;
      M.state.routines = (wz.preview || M.setup.build(a)).concat(M.special ? M.special.all() : []); // special days stay
      var clean = M.deepClone(a); delete clean._goalDefaults;
      M.state.setup = { answers: clean, at: M.today() };
      var g = M.GOALS.filter(function (x) { return x.id === a.goal; })[0];
      if (g && g.profileGoal) M.state.profile.goal = g.profileGoal;
      var wasOnboarding = wz.mode === 'onboard';
      finish(true);
      M.haptic('success');
      M.toast(wasOnboarding ? 'Your timetable is ready. Change any block in Plan.' : 'Timetable rebuilt');
    };
    if (wz.mode === 'setup') M.confirm('Replace your timetable?', 'Your current routines and blocks will be replaced by the new ones. Check-ins you already made stay in your history.', 'Replace').then(function (ok) { if (ok) go(); });
    else go();
  }

  function finish(built) {
    var mode = wz ? wz.mode : 'onboard';
    M.state.settings.onboarded = true;
    M.save(true);
    M.requestPersist();
    wz = null;
    M.renderNav();
    M.go(mode === 'setup' ? 'plan' : M.state.settings.nav.start || 'dashboard');
    if (!built && mode === 'onboard') setTimeout(function () { M.toast('Tip: ☰ → Settings → Rebuild my timetable to answer the 5 questions later.'); }, 400);
  }

  M.views.welcome = { head: function () { return { title: 'Welcome' }; }, render: function (el) { render(el, 'onboard'); } };
  M.views.setup = { head: function () { return { title: 'Build my timetable', sub: '5 quick questions' }; }, render: function (el) { render(el, 'setup'); } };
})();
