/* Mizan — Body: progress, goal planner, workouts, calculators */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var C = M.calc;
  var range = 90;

  var SUBS = [['progress', 'Progress'], ['goal', 'Goal'], ['workouts', 'Workouts'], ['tools', 'Calculators']];

  function subnav(active) {
    return '<nav class="seg-wrap" aria-label="Body sections"><div class="seg">' + SUBS.map(function (s) {
      return '<a href="#/body/' + s[0] + '"' + (s[0] === active ? ' aria-current="page"' : '') + '>' + s[1] + '</a>';
    }).join('') + '</div></nav>';
  }

  function bmiBlock(kg) {
    var p = M.state.profile;
    var age = M.ageFrom(p);
    var b = C.bmi(kg, p.heightCm);
    if (!b) return '';
    if (age !== null && age < 20 && age >= 2) {
      var ba = C.bmiForAge(b, p.sex, M.ageMonths(p));
      if (ba) return '<div class="stat"><span class="label">BMI-for-age</span><span class="value">' + Math.round(ba.pct) + '<small>th percentile</small></span><span class="sub">' + M.esc(ba.category.label) + ' for age ' + age + ' · BMI ' + M.fmt(b, 1) + '</span></div>';
      return '<div class="stat"><span class="label">BMI</span><span class="value">' + M.fmt(b, 1) + '</span><span class="sub">Under 20: set your sex in your profile to see the percentile</span></div>';
    }
    var cat = C.bmiCategory(b, M.state.settings.bmiStandard);
    return '<div class="stat"><span class="label">BMI</span><span class="value">' + M.fmt(b, 1) + '</span><span class="sub">' + M.esc(cat.label) + ' (' + (M.state.settings.bmiStandard === 'asian' ? 'Asian' : 'WHO') + ' cut-offs)</span></div>';
  }

  /* ---------------- Progress ---------------- */
  function renderProgress(el) {
    var series = C.trend(M.state.weights);
    var p = M.state.profile;
    var age = M.ageFrom(p);
    var minor = age !== null && age < 18;
    if (!series.length) {
      el.innerHTML += '<div class="empty">' + M.icon('scale') + '<p><strong>No weigh-ins yet.</strong></p><p>Log your weight a few times a week at the same time of day. Mizan smooths out the daily water swings so you can see the real direction.</p><button type="button" class="btn btn-primary" data-action="log">' + M.icon('plus') + 'Log weight</button></div>' +
        (minor ? '<div style="margin-top:16px">' + U.note('info', '<p>While you’re still growing, gaining weight is expected. You don’t need to weigh yourself often — how you feel, sleep and perform matters more.</p>') + '</div>' : '');
      return;
    }
    var last = series[series.length - 1];
    var first = series[0];
    var rate = C.weeklyRate(series);
    var goal = p.targetKg;
    var shown = range === 0 ? series : series.filter(function (s) { return M.daysBetween(s.d, last.d) <= range; });
    var toGoal = goal ? last.trend - goal : null;
    el.innerHTML +=
      '<div class="panel"><div class="stats four">' +
      '<div class="stat"><span class="label">Trend weight</span><span class="value">' + M.showW(last.trend) + '<small>' + M.wUnit() + '</small></span><span class="sub">Last weigh-in ' + M.showW(last.kg) + ' on ' + M.fmtDate(last.d, 'short') + '</span></div>' +
      '<div class="stat"><span class="label">Weekly change</span><span class="value">' + (rate === null ? '—' : (rate > 0 ? '+' : '') + M.showW(rate, 2)) + (rate === null ? '' : '<small>' + M.wUnit() + '</small>') + '</span><span class="sub">' + (rate === null ? 'Needs a week of weigh-ins' : 'from the last 3 weeks') + '</span></div>' +
      '<div class="stat"><span class="label">Since you started</span><span class="value">' + ((last.trend - first.trend) > 0 ? '+' : '') + M.showW(last.trend - first.trend) + '<small>' + M.wUnit() + '</small></span><span class="sub">since ' + M.fmtDate(first.d, 'short') + '</span></div>' +
      (p.heightCm ? bmiBlock(last.trend) : '<div class="stat"><span class="label">To goal</span><span class="value">' + (toGoal === null ? '—' : M.showW(Math.abs(toGoal))) + '</span></div>') +
      '</div></div>' +
      '<div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Weight trend</h3>' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="log">' + M.icon('plus') + 'Log weight</button></div>' +
      '<div class="seg" role="tablist" aria-label="Time range" style="margin-bottom:10px">' + [[30, '30 days'], [90, '90 days'], [0, 'All']].map(function (o) { return '<button type="button" role="tab" aria-selected="' + (range === o[0]) + '" data-action="range" data-r="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div id="wchart"></div>' +
      '<p class="hint muted" style="margin-top:10px">Dots are daily weigh-ins; the line is a smoothed trend (each day moves it 10% of the way toward the new reading). Daily numbers can swing 1–2 kg with water, salt and food in your stomach — the line is what matters.</p></div>' +
      (minor ? '<div style="margin-top:16px">' + U.note('info', '<p>You’re still growing, so your weight and BMI are compared with others your age (percentiles), not with adult ranges.</p>') + '</div>' : '') +
      '<div class="grid-2" style="margin-top:16px">' +
      '<div class="panel"><div class="panel-title"><h3>Recent weigh-ins</h3></div><ul class="list">' +
      series.slice(-8).reverse().map(function (s) {
        return '<li><div class="li-main"><strong class="num">' + M.showW(s.kg) + ' ' + M.wUnit() + '</strong><span>' + M.fmtDate(s.d, 'weekday') + '</span></div><button type="button" class="icon-btn sm" data-action="del-w" data-d="' + s.d + '" aria-label="Delete weigh-in on ' + M.fmtDate(s.d, 'short') + '">' + M.icon('trash') + '</button></li>';
      }).join('') + '</ul></div>' +
      '<div class="panel"><div class="panel-title"><h3>Measurements</h3><button type="button" class="btn btn-sm" data-action="edit-profile">' + M.icon('edit') + 'Update</button></div>' + measurements() + '</div>' +
      '</div>';
    U.weightChart(M.$('#wchart', el), shown, goal);
  }

  function measurements() {
    var p = M.state.profile;
    var rows = [];
    var r = C.whtr(p.waistCm, p.heightCm);
    if (r) rows.push(['Waist-to-height', M.fmt(r, 2) + ' — ' + C.whtrBand(r).label.split(' — ')[0]]);
    if (p.waistCm) rows.push(['Waist', M.showLen(p.waistCm) + ' ' + M.lenUnit()]);
    var bf = C.navyBodyFat(p.sex, p.heightCm, p.neckCm, p.waistCm, p.hipCm);
    if (bf && bf > 2 && bf < 70) rows.push(['Body fat (estimate)', M.fmt(bf, 1) + '%']);
    if (!rows.length) return '<p class="muted" style="margin:0">Add your waist (and neck/hip for body fat) — waist-to-height is one of the best simple health checks.</p>';
    return '<dl class="kv">' + rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + M.esc(x[1]) + '</dd>'; }).join('') + '</dl>';
  }

  /* ---------------- Goal planner ---------------- */
  function renderGoal(el) {
    var gate = U.needProfile(['weight', 'height', 'age']);
    if (gate) { el.innerHTML += gate; return; }
    var p = M.state.profile;
    var kg = M.latestWeight();
    var plan = C.goalPlan(p, kg);
    var paces = C.PACES[p.goal === 'gain' ? 'gain' : 'lose'];
    var form = '<form id="goal-form" class="stack" novalidate>' +
      '<div class="field"><span class="label">Goal</span>' + U.radios('goal', [['lose', 'Lose fat'], ['maintain', 'Maintain'], ['gain', 'Gain weight / muscle']], p.goal) + '</div>' +
      (p.goal !== 'maintain' ? U.numField('target', 'Target weight', p.targetKg ? (M.imperial() ? M.fmt(M.kgToLb(p.targetKg), 1) : p.targetKg) : '', M.wUnit(), { step: 0.1, hint: 'Healthy range for your height: ' + M.showW(plan.range.min) + '–' + M.showW(plan.range.max) + ' ' + M.wUnit() + ' (' + (M.state.settings.bmiStandard === 'asian' ? 'Asian' : 'WHO') + ' BMI).' }) +
        '<div class="field"><span class="label">Pace</span>' + U.radios('pace', paces.map(function (x) { return [x.id, x.label, x.desc]; }), p.pace, true) + '</div>' : '') +
      U.selectField('activity', 'Activity level', C.ACTIVITY.map(function (a) { return [a.id, a.label + ' — ' + a.desc]; }), p.activity, { hint: 'Most people pick one level too high. If unsure, choose the lower one and adjust after 2–3 weeks.' }) +
      '</form>';

    var res = '';
    plan.blocks.forEach(function (b) { res += U.note('warn', '<p>' + M.esc(b) + '</p>'); });
    plan.warnings.forEach(function (w) { res += U.note('warn', '<p>' + M.esc(w) + '</p>'); });
    plan.notes.forEach(function (n) { res += U.note('info', '<p>' + M.esc(n) + '</p>'); });
    var light = M.state.settings.numbersLight;
    var mac = plan.macros;
    res += '<div class="result">' +
      (light ? '<div class="verdict">Your daily plan</div><p>Numbers-light mode is on. Build each meal around a palm or two of protein, half a plate of vegetables, a fist of grains or roti, and a thumb of fat. <button type="button" class="btn btn-sm btn-ghost" data-action="show-numbers">Show numbers</button></p>'
        : '<div class="stat hero"><span class="label">Daily calories</span><span class="value">' + M.fmt(plan.kcal) + '<small>kcal</small></span></div>' +
        '<p>' + (plan.goal === 'lose' ? 'That’s about ' + M.fmt(plan.deficit) + ' kcal below your estimated maintenance of ' + M.fmt(plan.tdee) + ' kcal.' : plan.goal === 'gain' ? 'That’s ' + M.fmt(plan.surplus) + ' kcal above your estimated maintenance of ' + M.fmt(plan.tdee) + ' kcal.' : 'That’s your estimated maintenance — enough to keep your weight steady.') + '</p>') +
      (plan.rateKgWk ? '<p><strong>Expected pace:</strong> about ' + M.showW(plan.rateKgWk, 2) + ' ' + M.wUnit() + ' a week' + (plan.weeks ? '. At that pace you’d reach ' + M.showW(plan.target) + ' ' + M.wUnit() + ' in roughly <strong>' + Math.round(plan.weeks) + '–' + Math.round(plan.weeksHi) + ' weeks</strong> (' + plan.eta.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' – ' + plan.etaHi.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + '). Progress naturally slows over time, so the later date is more realistic.' : '.') + '</p>' : '') +
      '</div>';
    if (!light) {
      res += '<div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Daily targets</h3></div><div class="macro">' +
        macroRow('Protein', mac.protein, 'g', M.fmt(mac.proteinRange.lo) + '–' + M.fmt(mac.proteinRange.hi) + ' g range') +
        macroRow('Carbohydrate', mac.carbs, 'g', 'the rest of your energy') +
        macroRow('Fat', mac.fat, 'g', 'about 28% of calories') +
        macroRow('Fibre', mac.fiber, 'g', 'at least 25 g') +
        '</div><p class="hint muted" style="margin-top:12px">' + M.esc(mac.proteinRange.why) + '</p>' +
        '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-primary" data-action="to-meals">' + M.icon('food') + 'Build a meal plan with these</button></div></div>';
    }
    res += '<div class="panel tint" style="margin-top:16px"><h3 style="margin-bottom:8px">How to use this</h3><ul class="checks">' +
      '<li class="info">' + M.icon('spark') + '<span>These are <strong>estimates</strong> (Mifflin–St Jeor + activity factor). Real needs differ by ±10% or more.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Weigh in 3–7 times a week. After 2–3 weeks, compare your <strong>trend</strong> with the planned pace and adjust by 100–200 kcal.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Keep strength training and enough protein so the weight you lose is mostly fat.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Sleep counts: people who slept 5.5 h instead of 8.5 h while dieting lost less fat and more muscle.</span></li></ul>' +
      U.sourceLine([['Mifflin–St Jeor 1990', 'https://mifflinstjeor.com/mifflin-st-jeor-equation/'], ['Helms et al. 2014', 'https://link.springer.com/article/10.1186/1550-2783-11-20'], ['Hall 2013', 'https://www.nature.com/articles/ijo2013112'], ['ISSN protein 2017', 'https://link.springer.com/article/10.1186/s12970-017-0177-8']]) + '</div>' +
      '<div style="margin-top:16px">' + U.note('info', '<p>Not for use during pregnancy or breastfeeding, or with a medical condition that affects eating or weight — please follow your doctor’s advice. If thinking about food or weight is causing you distress, reach out to someone you trust or a health professional.</p>') + '</div>';

    el.innerHTML += '<div class="split"><div class="panel">' + form + '</div><div>' + res + '</div></div>';

    var f = M.$('#goal-form', el);
    var onChange = function (e) {
      var d = M.formData(f);
      p.goal = d.goal || p.goal;
      if (d.target !== undefined) p.targetKg = M.inW(d.target);
      if (d.pace) p.pace = d.pace;
      p.activity = d.activity || p.activity;
      M.save();
      if (e && e.target && e.target.name === 'target' && e.type === 'input') return; // wait for change to avoid focus loss
      M.refresh();
    };
    f.addEventListener('change', onChange);
    f.addEventListener('submit', function (e) { e.preventDefault(); onChange(); });
    function macroRow(name, v, unit, sub) {
      return '<div class="macro-item"><div class="top"><strong>' + name + '</strong><span>' + M.fmt(v) + ' ' + unit + ' · ' + sub + '</span></div></div>';
    }
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.getAttribute('data-action') === 'to-meals') {
        M.foodPrefill = { kcal: plan.kcal, protein: plan.macros.protein };
        M.go('food/plan');
      } else if (a.getAttribute('data-action') === 'show-numbers') {
        M.state.settings.numbersLight = false; M.save(); M.refresh();
      }
    });
  }

  /* ---------------- Workouts ---------------- */
  function workoutForm(p) {
    var age = M.ageFrom(p);
    return '<form id="wo-form" class="stack" novalidate>' +
      '<div class="field"><span class="label">Main goal</span>' + U.radios('wgoal', [['health', 'Get fit & healthy'], ['lose', 'Lose fat'], ['gain', 'Build muscle'], ['strength', 'Get stronger']], p.goal === 'lose' ? 'lose' : p.goal === 'gain' ? 'gain' : 'health') + '</div>' +
      '<div class="field"><span class="label">Experience</span>' + U.radios('experience', [['beginner', 'New or returning (under ~6 months)'], ['intermediate', 'Training regularly 6+ months']], p.experience) + '</div>' +
      '<div class="field"><span class="label">Equipment</span>' + U.radios('equipment', M.EQUIPMENT.map(function (e) { return [e.id, e.label, e.desc]; }), p.equipment, true) + '</div>' +
      '<div class="field"><span class="label">Intensity</span>' + U.radios('intensity', M.INTENSITY.map(function (x) { return [x.id, x.label, x.desc]; }), p.workoutIntensity || 'medium', true) + '</div>' +
      '<div class="form-grid">' + U.selectField('days', 'Days per week', [[2, '2 days'], [3, '3 days'], [4, '4 days'], [5, '5 days'], [6, '6 days']], p.workoutDays) +
      U.selectField('minutes', 'Time per session', [[30, '30 minutes'], [45, '45 minutes'], [60, '60 minutes'], [75, '75 minutes']], p.sessionMin) + '</div>' +
      (age !== null && age < 18 ? U.note('info', '<p>Strength training is safe and useful for teens when it’s supervised and the focus is on good technique. Your plan uses lighter loads and 10–15 reps.</p>') : '') +
      '<button type="submit" class="btn btn-primary">' + M.icon('dumbbell') + 'Build my plan</button></form>';
  }

  function lastLog(exId, beforeKey) {
    var keys = Object.keys(M.state.workoutLog).filter(function (k) { return k < beforeKey; }).sort().reverse();
    for (var i = 0; i < keys.length; i++) {
      var e = M.state.workoutLog[keys[i]].ex && M.state.workoutLog[keys[i]].ex[exId];
      if (e && (e.w || e.r)) return { k: keys[i], w: e.w, r: e.r };
    }
    return null;
  }

  function exerciseSheet(id) {
    var ex = M.exercise(id);
    if (!ex) return;
    M.sheet({
      title: ex.name,
      body: '<h3 style="margin-bottom:8px">How to do it</h3><ol class="prose" style="padding-left:1.2em">' + ex.cues.map(function (c) { return '<li>' + M.esc(c) + '</li>'; }).join('') + '</ol>' +
        '<p class="muted" style="font-size:var(--fs-sm)">Move with control, breathe out on the hard part, and stop if you feel sharp pain. "Reps in reserve" (RIR) means how many more reps you could have done — 2 RIR means stop when you could do about 2 more.</p>',
      foot: '<button type="button" class="btn btn-primary" data-close>Got it</button>', noAutofocus: true
    });
  }

  function renderWorkouts(el) {
    var p = M.state.profile;
    var wp = M.state.workoutPlan;
    if (!wp || M.workoutRebuild) {
      M.workoutRebuild = false;
      el.innerHTML += '<div class="split"><div class="panel"><h3 style="margin-bottom:12px">Build a workout plan</h3>' + workoutForm(p) + '</div>' +
        '<div class="panel tint"><h3 style="margin-bottom:8px">What the plan follows</h3><ul class="checks">' +
        '<li class="info">' + M.icon('spark') + '<span>Train each muscle about <strong>twice a week</strong>.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Around <strong>10+ hard sets per muscle per week</strong> maximises growth; fewer still works well for beginners.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Stop sets 1–3 reps short of failure, rest 2–3 minutes on big lifts.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Add weight or reps gradually (double progression).</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Adults: 150–300 min of moderate activity a week plus 2+ strength days. Teens: 60 min every day.</span></li></ul>' +
        U.sourceLine([['WHO 2020', 'https://www.who.int/news-room/fact-sheets/detail/physical-activity'], ['Schoenfeld 2016–17', 'https://link.springer.com/article/10.1007/s40279-016-0543-8'], ['NSCA youth', 'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf']]) + '</div></div>';
      M.$('#wo-form', el).addEventListener('submit', function (e) {
        e.preventDefault();
        var d = M.formData(e.target);
        p.experience = d.experience; p.equipment = d.equipment; p.workoutDays = +d.days; p.sessionMin = +d.minutes; p.workoutIntensity = d.intensity || 'medium';
        M.state.workoutPlan = M.buildWorkoutPlan({ goal: d.wgoal, experience: d.experience, equipment: d.equipment, days: +d.days, minutes: +d.minutes, age: M.ageFrom(p), intensity: p.workoutIntensity });
        M.save(); M.haptic('success'); M.refresh(); M.toast('Workout plan ready');
      });
      return;
    }
    var today = M.today();
    var wd = M.weekday(today);
    var todayIdx = wp.days.indexOf(wd);
    var order = [1, 2, 3, 4, 5, 6, 0];
    var week = '<div class="row wrap" style="gap:8px">' + order.map(function (d) {
      var i = wp.days.indexOf(d);
      var s = i >= 0 ? wp.sessions[i % wp.sessions.length] : null;
      return '<div class="inset" style="flex:1 1 90px;min-width:90px;padding:10px;' + (d === wd ? 'outline:2px solid var(--now);' : '') + '"><div class="muted" style="font-size:var(--fs-xs);font-weight:700">' + M.DAY_SHORT[d] + (d === wd ? ' · today' : '') + '</div><div style="font-weight:700;font-size:var(--fs-sm)">' + (s ? M.esc(s.name) : 'Rest / walk') + '</div></div>';
    }).join('') + '</div>';
    var log = M.state.workoutLog[today] || { ex: {} };
    var sessions = wp.sessions.map(function (s, si) {
      var isToday = todayIdx >= 0 && (todayIdx % wp.sessions.length) === si;
      return '<section class="session" aria-label="' + M.esc(s.name) + '"><div class="session-head"><h3>' + M.esc(s.name) + (isToday ? ' <span class="badge accent">Today</span>' : '') + '</h3><span class="muted" style="font-size:var(--fs-sm)">' +
        wp.days.filter(function (d, i) { return i % wp.sessions.length === si; }).map(function (d) { return M.DAY_SHORT[d]; }).join(', ') + '</span></div>' +
        s.items.filter(function (it) { return !!M.exercise(it.ex); }).map(function (it) {
          var ex = M.exercise(it.ex);
          var lg = log.ex[it.ex] || {};
          var prev = isToday ? lastLog(it.ex, today) : null;
          return '<div class="ex"><button type="button" class="ex-name" data-action="ex" data-id="' + it.ex + '">' + M.esc(ex.name) + '</button><span class="ex-rx">' + it.sets + ' × ' + M.esc(it.reps) + '</span>' +
            '<span class="ex-sub">Rest ' + M.esc(it.rest) + (it.rir !== '—' ? ' · stop with ' + M.esc(it.rir) + ' reps in reserve' : '') + (prev ? ' · last time: ' + (prev.w ? M.esc(prev.w) + ' ' + M.wUnit() + ' × ' : '') + M.esc(prev.r || '') : '') + '</span>' +
            (isToday ? '<div class="ex-log">' + (ex.eq > 0 || /backpack/.test(ex.id) ? '<label class="sr-only" for="w-' + it.ex + '">Weight for ' + M.esc(ex.name) + '</label><input class="input" id="w-' + it.ex + '" inputmode="decimal" placeholder="' + M.wUnit() + '" data-ex="' + it.ex + '" data-f="w" value="' + M.esc(lg.w || '') + '">' : '') +
              '<label class="sr-only" for="r-' + it.ex + '">' + (ex.unit === 's' ? 'Seconds' : 'Reps') + ' for ' + M.esc(ex.name) + '</label><input class="input" id="r-' + it.ex + '" inputmode="numeric" placeholder="' + (ex.unit === 's' ? 'seconds' : 'reps') + '" data-ex="' + it.ex + '" data-f="r" value="' + M.esc(lg.r || '') + '">' +
              '<label class="choice" style="min-height:38px;padding:6px 12px"><input type="checkbox" data-ex="' + it.ex + '" data-f="done"' + (lg.done ? ' checked' : '') + '><span>Done</span></label></div>' : '') +
            '</div>';
        }).join('') + '</section>';
    }).join('');
    el.innerHTML +=
      '<div class="panel"><div class="panel-title"><h3>This week</h3><button type="button" class="btn btn-sm" data-action="rebuild">' + M.icon('refresh') + 'Change plan</button></div>' + week +
      '<fieldset class="field wo-intensity" style="margin-top:14px"><legend class="label">Intensity</legend><div class="seg" role="radiogroup">' + M.INTENSITY.map(function (x) { return '<label><input type="radio" name="wint" value="' + x.id + '"' + ((wp.intensity || 'medium') === x.id ? ' checked' : '') + '><span>' + M.esc(x.label.split(' — ')[0]) + '</span></label>'; }).join('') + '</div>' +
      '<p class="hint" style="margin:6px 0 0">' + M.esc(wp.effort || M.INTENSITY[1].desc) + '</p></fieldset></div>' +
      '<div class="split" style="margin-top:16px"><div class="stack">' +
      '<div class="panel tint"><h3 style="margin-bottom:6px">Warm-up</h3><p class="soft" style="font-size:var(--fs-sm);margin:0">' + M.esc(wp.warmup) + '</p></div>' +
      (wp.finisher ? '<div class="panel tint"><h3 style="margin-bottom:6px">Finisher</h3><p class="soft" style="font-size:var(--fs-sm);margin:0">' + M.esc(wp.finisher) + '</p></div>' : '') +
      '<div class="panel tint"><h3 style="margin-bottom:6px">Cardio & steps</h3><p class="soft" style="font-size:var(--fs-sm);margin:0">' + M.esc(wp.cardio) + '</p></div>' +
      '<div class="panel tint"><h3 style="margin-bottom:6px">How to progress</h3><p class="soft" style="font-size:var(--fs-sm);margin:0">' + M.esc(wp.progression) + '</p></div>' +
      (wp.minor ? U.note('info', '<p>Train with an adult or qualified coach nearby, especially with weights. No max-out attempts — technique first.</p>') : '') +
      '<p class="hint muted">Tip: add an Exercise block to your routine on training days so Today reminds you.</p>' +
      '</div><div class="panel">' + sessions + '</div></div>';

    el.addEventListener('change', function (e) {
      if (e.target.name !== 'wint') return;
      var o = Object.assign(M.workoutOpts(wp, p), { intensity: e.target.value });
      p.workoutIntensity = e.target.value;
      M.state.workoutPlan = M.buildWorkoutPlan(o);
      M.save(); M.haptic('success');
      M.flashAfterRender('.session');
      M.refresh();
      M.toast('Plan set to ' + e.target.value + ' intensity');
    });
    el.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.dataset || !t.dataset.ex) return;
      var L = M.state.workoutLog[today] || (M.state.workoutLog[today] = { ex: {} });
      var x = L.ex[t.dataset.ex] || (L.ex[t.dataset.ex] = {});
      x[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value.trim();
      M.save();
    });
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.getAttribute('data-action') === 'ex') exerciseSheet(a.getAttribute('data-id'));
      if (a.getAttribute('data-action') === 'rebuild') { M.workoutRebuild = true; M.refresh(); }
    });
  }

  /* ---------------- Calculators ---------------- */
  var TOOLS = [
    { id: 'bmi', name: 'BMI', icon: 'scale', desc: 'Body mass index with global, Asian and age-based cut-offs' },
    { id: 'calories', name: 'Calories needed', icon: 'flame', desc: 'Your resting and daily energy needs' },
    { id: 'healthy', name: 'Healthy weight range', icon: 'target', desc: 'The weight range that fits your height' },
    { id: 'whtr', name: 'Waist-to-height', icon: 'ruler', desc: 'A quick check of belly fat and health risk' },
    { id: 'bodyfat', name: 'Body fat estimate', icon: 'body', desc: 'Tape-measure (US Navy) method' },
    { id: 'protein', name: 'Protein', icon: 'leaf', desc: 'How much protein a day, and from what' },
    { id: 'water', name: 'Water', icon: 'water', desc: 'Daily drinks target for you' },
    { id: 'sleep', name: 'Sleep', icon: 'moon', desc: 'Hours you need and when to go to bed' },
    { id: 'heart', name: 'Heart-rate zones', icon: 'heart', desc: 'Training zones from your age and resting pulse' },
    { id: 'onerm', name: 'One-rep max', icon: 'dumbbell', desc: 'Estimate your max and training weights' },
    { id: 'activity', name: 'Activity calories', icon: 'body', desc: 'Energy used in common activities' }
  ];
  M.TOOLS = TOOLS;

  function renderTools(el) {
    el.innerHTML += '<div class="tool-grid">' + TOOLS.map(function (t) {
      return '<a class="tool-tile" href="#/body/tools/' + t.id + '"><span class="ti">' + M.icon(t.icon) + '</span><strong>' + M.esc(t.name) + '</strong><span>' + M.esc(t.desc) + '</span></a>';
    }).join('') + '</div><p class="hint muted" style="margin-top:16px">Calculators give population-based estimates, not diagnoses. Every formula and its source is listed on the <a href="#/science">Science page</a>.</p>';
  }

  /* the smallest age each calculator is meant for */
  var TOOL_AGE = {
    bmi: [2, 'BMI isn’t used for children under 2 — doctors use weight-for-length charts for babies and toddlers.'],
    calories: [10, 'These formulas are for ages 10 and up. For younger children, ask a doctor or dietitian.'],
    protein: [4, 'This is for ages 4 and up.'], water: [4, 'This is for ages 4 and up.'],
    heart: [10, 'Heart-rate zones are for ages 10 and up.'], sleep: [1, 'This is for ages 1 and up.']
  };
  var KEY_NAME = { age: 'age', heightCm: 'h', weightKg: 'w', waistCm: 'waist', neckCm: 'neck', hipCm: 'hip', restingHr: 'rest', bodyFat: 'bf', liftKg: 'lw', exMin: 'ex' };
  /* check the typed numbers are possible for a person; mark the fields → list of problems */
  function checkTool(id, d, f) {
    var v = {
      age: d.age !== undefined ? M.num(d.age) : null, heightCm: d.h !== undefined ? getH(d) : null, weightKg: d.w !== undefined ? getW(d) : null,
      waistCm: d.waist !== undefined ? M.inLen(d.waist) : null, neckCm: d.neck !== undefined ? M.inLen(d.neck) : null, hipCm: d.hip !== undefined ? M.inLen(d.hip) : null,
      restingHr: M.num(d.rest), bodyFat: M.num(d.bf), liftKg: d.lw !== undefined ? M.inW(d.lw) : null, exMin: M.num(d.ex)
    };
    var ta = TOOL_AGE[id];
    var errs = C.checkBody(v, ta ? { minAge: ta[0], minAgeMsg: ta[1] } : {});
    Object.keys(KEY_NAME).forEach(function (k) {
      if (d[KEY_NAME[k]] === undefined) return;
      var e = errs.filter(function (x) { return x.key === k; })[0];
      U.fieldError(f, KEY_NAME[k], e ? e.short || e.msg : ''); // short under the field; the full reason is in the result panel
    });
    return errs;
  }
  M.checkTool = checkTool;

  function toolShell(el, t, formHtml, compute) {
    el.innerHTML += '<a class="btn btn-ghost btn-sm" href="#/body/tools" style="margin-bottom:8px">' + M.icon('left') + 'All calculators</a>' +
      '<div class="split"><div class="panel"><h2 style="margin-bottom:14px">' + M.esc(t.name) + '</h2><form class="stack" id="tool-form" novalidate>' + formHtml + '</form></div><div id="tool-out" aria-live="polite"></div></div>';
    var f = M.$('#tool-form', el);
    var out = M.$('#tool-out', el);
    var run = function () {
      var d = M.formData(f);
      var errs = checkTool(t.id, d, f);
      if (errs.length) { var bad = errs.filter(function (e) { return !e.young; }).length; out.innerHTML = U.note('bad', '<p><strong>' + (!bad ? 'This calculator isn’t made for this age.' : bad > 1 ? 'These numbers aren’t possible — check them.' : 'That number isn’t possible — check it.') + '</strong></p><ul>' + errs.map(function (e) { return '<li>' + M.esc(e.msg) + '</li>'; }).join('') + '</ul>'); return; }
      try { out.innerHTML = compute(d); } catch (e) { out.innerHTML = U.note('warn', '<p>Check the numbers you entered.</p>'); }
    };
    var timer = null;
    f.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 450); });
    f.addEventListener('change', function () { clearTimeout(timer); run(); });
    f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    out.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action="save-profile"]');
      if (!a) return;
      var d = M.formData(f);
      var p = M.state.profile;
      var hh = getH(d);
      if (hh) p.heightCm = Math.round(hh * 10) / 10;
      if (d.w) { var kg = M.inW(d.w); if (kg && Math.abs(kg - (M.latestWeight() || 0)) > 0.05) M.logWeight(kg); }
      if (d.age) p.age = M.num(d.age);
      if (d.sex) p.sex = d.sex;
      if (d.waist) p.waistCm = M.inLen(d.waist);
      if (d.neck) p.neckCm = M.inLen(d.neck);
      if (d.hip) p.hipCm = M.inLen(d.hip);
      if (d.rest) p.restingHr = M.num(d.rest);
      if (d.activity) p.activity = d.activity;
      M.save(); M.haptic('success'); M.toast('Saved to your profile');
    });
    run();
  }

  function basics(fields) {
    var p = M.state.profile;
    var h = '';
    var w = M.latestWeight();
    if (fields.indexOf('sex') >= 0) h += '<div class="field"><span class="label">Sex</span>' + U.radios('sex', [['female', 'Female'], ['male', 'Male']], p.sex) + '</div>';
    h += '<div class="form-grid">';
    if (fields.indexOf('age') >= 0) h += U.numField('age', 'Age', M.ageFrom(p) || '', 'years', { step: 1, min: 2, max: 120 });
    if (fields.indexOf('h') >= 0) h += U.numField('h', 'Height', p.heightCm ? (M.imperial() ? M.fmt(M.cmToIn(p.heightCm), 1) : Math.round(p.heightCm)) : '', M.imperial() ? 'in' : 'cm', { step: 0.1 });
    if (fields.indexOf('w') >= 0) h += U.numField('w', 'Weight', w ? (M.imperial() ? M.fmt(M.kgToLb(w), 1) : w) : '', M.wUnit(), { step: 0.1 });
    h += '</div>';
    return h;
  }
  function getH(d) { var n = M.num(d.h); if (!n) return null; return M.imperial() ? M.inToCm(n) : n; }
  function getW(d) { return M.inW(d.w); }
  var SAVE_BTN = '<button type="button" class="btn btn-sm" data-action="save-profile" style="margin-top:12px">' + M.icon('user') + 'Save to my profile</button>';

  var TOOL_RENDER = {
    bmi: function (el, t) {
      toolShell(el, t, basics(['sex', 'age', 'h', 'w']) + U.selectField('std', 'Cut-offs for adults', [['who', 'WHO (global)'], ['asian', 'Asian Indian / South Asian']], M.state.settings.bmiStandard, { hint: 'People of South Asian and East Asian background tend to have more body fat and health risk at the same BMI, so lower cut-offs are used.' }), function (d) {
        var h = getH(d), w = getW(d), age = M.num(d.age);
        if (!h || !w) return U.note('info', '<p>Enter height and weight.</p>');
        var b = C.bmi(w, h);
        var html = '<div class="result"><div class="stat hero"><span class="label">Your BMI</span><span class="value">' + M.fmt(b, 1) + '</span></div>';
        if (age !== null && age < 20 && age >= 2) {
          if (d.sex !== 'male' && d.sex !== 'female') return html + '<p>Under 20, BMI is compared with others of the same age and sex. Choose a sex to see your percentile.</p></div>';
          var ba = C.bmiForAge(b, d.sex, age * 12 + 6);
          if (!ba) return html + '</div>';
          var bands = [{ label: 'Under', from: 0, to: 5 }, { label: 'Healthy', from: 5, to: 85 }, { label: 'Over', from: 85, to: 95 }, { label: 'Obesity', from: 95, to: 100 }];
          var ai = ba.pct < 5 ? 0 : ba.pct < 85 ? 1 : ba.pct < 95 ? 2 : 3;
          return html + '<div class="verdict">' + Math.round(ba.pct) + 'th percentile — ' + M.esc(ba.category.label) + '</div>' + U.scale(bands, ba.pct, ai) +
            '<p>For a ' + (d.sex === 'male' ? 'boy' : 'girl') + ' aged about ' + age + ', a healthy BMI is roughly ' + M.fmt(ba.p5, 1) + '–' + M.fmt(ba.p85, 1) + '. Children and teens are still growing, so BMI is judged by percentile, not adult ranges. Growth charts used by your doctor (including national charts) may differ slightly.</p>' + SAVE_BTN + '</div>' +
            U.sourceLine([['CDC BMI-for-age', 'https://www.cdc.gov/bmi/child-teen-calculator/bmi-categories.html'], ['WHO 5–19 reference', 'https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age']]);
        }
        var std = d.std || 'who';
        var cat = C.bmiCategory(b, std);
        var S = C.BMI_STANDARDS[std];
        var bands2 = S.bands.map(function (x, i) { return { label: x.label.replace('Obesity class ', 'Ob. ').replace('Healthy weight', 'Healthy').replace('Underweight', 'Under').replace('Overweight', 'Over'), from: i ? S.bands[i - 1].max : 14, to: x.max === Infinity ? Math.max(45, b + 2) : x.max }; });
        var rng = C.healthyRange(h, std);
        return html + '<div class="verdict">' + M.esc(cat.label) + '</div>' + U.scale(bands2, b, cat.index) +
          '<p>A healthy weight for your height is about <strong>' + M.showW(rng.min) + '–' + M.showW(rng.max) + ' ' + M.wUnit() + '</strong>. BMI is a quick screening number: it can’t tell muscle from fat, so very muscular people can read high. Pair it with your waist-to-height ratio.</p>' + SAVE_BTN + '</div>' +
          U.sourceLine([['WHO', 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight'], ['Asian Indian consensus', 'https://www.cmcendovellore.org/pub/2025/revised-definition-of-obesity-in-asian-indians-living-in-india.pdf'], ['NHS', 'https://www.nhs.uk/conditions/obesity/']]);
      });
    },
    calories: function (el, t) {
      toolShell(el, t, basics(['sex', 'age', 'h', 'w']) + U.selectField('activity', 'Activity level', C.ACTIVITY.map(function (a) { return [a.id, a.label + ' — ' + a.desc]; }), M.state.profile.activity) +
        U.numField('bf', 'Body fat % (optional)', '', '%', { step: 0.1, hint: 'If you know it, the Katch–McArdle equation is also shown.' }), function (d) {
        var h = getH(d), w = getW(d), age = M.num(d.age);
        if (!h || !w || !age) return U.note('info', '<p>Enter age, height and weight.</p>');
        var bmr = C.bmrMifflin(w, h, age, d.sex);
        var act = C.activity(d.activity);
        var bf = M.num(d.bf);
        var katch = bf ? C.bmrKatch(w * (1 - bf / 100)) : null;
        var rows = C.ACTIVITY.map(function (a) { return '<tr' + (a.id === act.id ? ' style="font-weight:700"' : '') + '><td>' + M.esc(a.label) + '</td><td class="n">×' + a.f + '</td><td class="n">' + M.fmt(bmr * a.f, 0) + '</td></tr>'; }).join('');
        return '<div class="result"><div class="stat hero"><span class="label">Maintenance calories</span><span class="value">' + M.fmt(M.round(bmr * act.f, 10)) + '<small>kcal/day</small></span></div>' +
          '<p>Resting (BMR): <strong>' + M.fmt(bmr) + ' kcal</strong> — what your body uses at complete rest.' + (katch ? ' With your body fat, Katch–McArdle gives ' + M.fmt(katch) + ' kcal.' : '') + '</p>' +
          (age < 18 ? '<p>These equations were built on adults. For teens they’re a rough guide only — growing bodies often need more.</p>' : '') +
          '<div class="table-wrap" tabindex="0" role="region" aria-label="Table" style="margin-top:12px"><table class="data"><thead><tr><th>Activity</th><th class="n">Factor</th><th class="n">kcal/day</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + SAVE_BTN + '</div>' +
          U.sourceLine([['Mifflin–St Jeor', 'https://mifflinstjeor.com/mifflin-st-jeor-equation/'], ['Activity factors', 'https://www.calculatemytdee.org/blog/activity-level-multipliers']]);
      });
    },
    healthy: function (el, t) {
      toolShell(el, t, basics(['sex', 'h']) + U.selectField('std', 'Cut-offs', [['who', 'WHO (global)'], ['asian', 'Asian Indian / South Asian']], M.state.settings.bmiStandard), function (d) {
        var h = getH(d);
        if (!h) return U.note('info', '<p>Enter your height.</p>');
        var r = C.healthyRange(h, d.std || 'who');
        var ibw = C.ibwDevine(d.sex, h);
        return '<div class="result"><div class="stat hero"><span class="label">Healthy range</span><span class="value">' + M.showW(r.min, 0) + '–' + M.showW(r.max, 0) + '<small>' + M.wUnit() + '</small></span></div>' +
          '<p>This is BMI 18.5–' + C.BMI_STANDARDS[d.std || 'who'].healthyMax + ' for ' + M.showH(h) + '. Anywhere in this range is fine — there’s no single perfect number.</p>' +
          (ibw && h >= 152 ? '<p>The Devine "ideal body weight" formula (used for medicine dosing) gives ' + M.showW(ibw) + ' ' + M.wUnit() + '. It ignores muscle, so treat it as a reference only.</p>' : '') + '</div>' +
          U.sourceLine([['WHO', 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight'], ['Devine formula', 'https://en.wikipedia.org/wiki/Human_body_weight']]);
      });
    },
    whtr: function (el, t) {
      var p = M.state.profile;
      toolShell(el, t, basics(['sex', 'h']) + '<div class="form-grid">' + U.numField('waist', 'Waist', p.waistCm ? M.showLen(p.waistCm) : '', M.lenUnit(), { step: 0.1, hint: 'Measure midway between your lowest rib and the top of your hip bone, after breathing out.' }) + '</div>', function (d) {
        var h = getH(d), waist = M.inLen(d.waist);
        if (!h || !waist) return U.note('info', '<p>Enter your height and waist.</p>');
        var r = C.whtr(waist, h);
        var band = C.whtrBand(r);
        var risk = C.waistRisk(d.sex, waist, M.state.settings.bmiStandard);
        return '<div class="result"><div class="stat hero"><span class="label">Waist-to-height ratio</span><span class="value">' + M.fmt(r, 2) + '</span></div>' +
          '<div class="verdict">' + M.esc(band.label) + '</div>' + U.scale([{ label: 'Low', from: 0.3, to: 0.4 }, { label: 'Healthy', from: 0.4, to: 0.5 }, { label: 'Take care', from: 0.5, to: 0.6 }, { label: 'Take action', from: 0.6, to: 0.75 }], r, band.index) +
          '<p>The simple rule: keep your waist to <strong>less than half your height</strong> — for you, under ' + M.showLen(h / 2, 0) + ' ' + M.lenUnit() + '. It works for adults of any ethnicity and for children over 5.</p>' +
          (risk ? '<p>Waist on its own: ' + M.esc(risk.text) + '</p>' : '') + SAVE_BTN + '</div>' +
          U.sourceLine([['NICE 2022 via NHS', 'https://www.nhs.uk/conditions/obesity/'], ['Waist-to-height ratio', 'https://en.wikipedia.org/wiki/Waist-to-height_ratio']]);
      });
    },
    bodyfat: function (el, t) {
      var p = M.state.profile;
      toolShell(el, t, basics(['sex', 'h']) + '<div class="form-grid">' +
        U.numField('neck', 'Neck', p.neckCm ? M.showLen(p.neckCm) : '', M.lenUnit(), { step: 0.1, hint: 'Just below the Adam’s apple.' }) +
        U.numField('waist', 'Waist', p.waistCm ? M.showLen(p.waistCm) : '', M.lenUnit(), { step: 0.1, hint: 'Men: at the navel. Women: narrowest point.' }) +
        U.numField('hip', 'Hips (women)', p.hipCm ? M.showLen(p.hipCm) : '', M.lenUnit(), { step: 0.1, hint: 'Widest part of the buttocks.' }) + '</div>', function (d) {
        var h = getH(d), neck = M.inLen(d.neck), waist = M.inLen(d.waist), hip = M.inLen(d.hip);
        if (d.sex !== 'male' && d.sex !== 'female') return U.note('info', '<p>Choose a sex — the formula is different for men and women.</p>');
        var bf = C.navyBodyFat(d.sex, h, neck, waist, hip);
        if (!bf || bf < 2 || bf > 70) return U.note('info', '<p>Enter height, neck and waist' + (d.sex === 'female' ? ' and hips' : '') + '.</p>');
        var band = C.bodyFatBand(d.sex, bf);
        var bands = band.bands.map(function (b, i) { return { label: b[1].replace(' fat', ''), from: i ? band.bands[i - 1][0] : (d.sex === 'female' ? 8 : 2), to: b[0] === Infinity ? 45 : b[0] }; });
        return '<div class="result"><div class="stat hero"><span class="label">Estimated body fat</span><span class="value">' + M.fmt(bf, 1) + '<small>%</small></span></div>' +
          '<div class="verdict">' + M.esc(band.label) + '</div>' + U.scale(bands, bf, band.index) +
          '<p>Tape-measure methods are usually within a few percentage points, but can be off by more. Use it to track change over time with the same tape and technique.</p>' + SAVE_BTN + '</div>' +
          U.sourceLine([['US Navy method', 'https://en.wikipedia.org/wiki/Body_fat_percentage'], ['ACE categories', 'https://en.wikipedia.org/wiki/Body_fat_percentage']]);
      });
    },
    protein: function (el, t) {
      toolShell(el, t, basics(['age', 'w', 'h']) + '<div class="field"><span class="label">Goal</span>' + U.radios('goal', [['lose', 'Lose fat'], ['maintain', 'Maintain'], ['gain', 'Build muscle']], M.state.profile.goal) + '</div>' +
        U.selectField('activity', 'Activity', C.ACTIVITY.map(function (a) { return [a.id, a.label]; }), M.state.profile.activity), function (d) {
        var w = getW(d);
        if (!w) return U.note('info', '<p>Enter your weight.</p>');
        var pr = C.proteinRange({ goal: d.goal, activity: d.activity, age: M.num(d.age), heightCm: getH(d) }, w);
        var mid = (pr.lo + pr.hi) / 2;
        var per = Math.round(mid / 4);
        return '<div class="result"><div class="stat hero"><span class="label">Protein a day</span><span class="value">' + M.fmt(pr.lo) + '–' + M.fmt(pr.hi) + '<small>g</small></span></div>' +
          '<p>' + M.esc(pr.why) + (pr.ref !== w ? ' Because your BMI is 30 or more, this uses the top of your healthy weight range (' + M.showW(pr.ref) + ' ' + M.wUnit() + ') to keep the target realistic.' : '') + '</p>' +
          '<p>Spread it over 3–4 meals — about <strong>' + per + ' g each</strong>. That’s roughly:</p><ul class="prose" style="font-size:var(--fs-sm)">' +
          '<li>2 boiled eggs + 1 glass of milk ≈ 19 g</li><li>100 g paneer ≈ 19 g · 100 g chicken breast ≈ 31 g</li><li>1 katori dal ≈ 9 g · 1 katori chole or rajma ≈ 11 g</li><li>30 g soya chunks (dry) ≈ 16 g · 1 katori curd ≈ 5 g</li></ul>' +
          '<p>Vegetarian tip: pair grains with pulses (about 3:1) — together they make complete protein.</p></div>' +
          U.sourceLine([['ISSN 2017', 'https://link.springer.com/article/10.1186/s12970-017-0177-8'], ['Morton 2018', 'https://www.scinergy.io/learn/how-much-protein-for-muscle-gain'], ['ICMR-NIN 2020', 'https://www.nin.res.in/rdabook/brief_note.pdf']]);
      });
    },
    water: function (el, t) {
      toolShell(el, t, basics(['sex', 'age', 'w']) + '<div class="form-grid">' + U.numField('ex', 'Exercise today', 60, 'min', { step: 5 }) +
        '<div class="field"><span class="label">Weather</span>' + U.radios('hot', [['no', 'Mild'], ['yes', 'Hot or humid']], 'no') + '</div></div>', function (d) {
        var g = C.waterGoal({ sex: d.sex, age: M.num(d.age) }, getW(d), M.num(d.ex) || 0, d.hot === 'yes');
        var glass = M.state.settings.glassMl || 250;
        return '<div class="result"><div class="stat hero"><span class="label">Drinks per day</span><span class="value">' + M.fmt(g.lo, 1) + '–' + M.fmt(g.hi, 1) + '<small>litres</small></span></div>' +
          '<p>About <strong>' + Math.round(g.goal * 1000 / glass) + ' glasses</strong> of ' + glass + ' ml. Food provides roughly another 20% of your water. ' + (g.extra ? 'This includes about ' + M.fmt(g.extra, 1) + ' L extra for exercise and heat.' : '') + '</p>' +
          '<p>Best check: pale-yellow urine and rarely feeling thirsty. Milk, tea, buttermilk and soups all count.</p>' +
          '<button type="button" class="btn btn-sm" data-action="set-water" data-l="' + g.goal + '" style="margin-top:8px">' + M.icon('water') + 'Use ' + M.fmt(g.goal, 2) + ' L as my Today goal</button></div>' +
          U.sourceLine([['EFSA & IOM via GSSI', 'https://www.gssiweb.org/sports-science-exchange/article/hydration-for-health-and-wellness'], ['Mayo Clinic', 'https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256']]);
      });
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action="set-water"]');
        if (!a) return;
        M.state.settings.waterGoalMl = Math.round(+a.getAttribute('data-l') * 1000);
        M.save(); M.toast('Water goal updated');
      });
    },
    sleep: function (el, t) {
      toolShell(el, t, '<div class="form-grid">' + U.numField('age', 'Age', M.ageFrom(M.state.profile) || '', 'years', { step: 1 }) +
        '<div class="field"><label for="wake">Wake-up time</label><input class="input" type="time" id="wake" name="wake" value="' + M.esc(wakeTime()) + '"></div></div>', function (d) {
        var need = C.sleepNeed(M.num(d.age));
        var wake = M.toMin(d.wake || '06:00');
        var lat = 15;
        var bedLate = wake - need.lo * 60 - lat, bedEarly = wake - need.hi * 60 - lat;
        return '<div class="result"><div class="stat hero"><span class="label">Sleep you need</span><span class="value">' + need.lo + '–' + need.hi + '<small>hours</small></span></div>' +
          '<p>' + M.esc(need.label) + '. To wake at ' + M.fmtTime(wake) + ', aim to be in bed between <strong>' + M.fmtTime(bedEarly) + ' and ' + M.fmtTime(bedLate) + '</strong> (allowing ~15 minutes to fall asleep).</p>' +
          '<ul class="prose" style="font-size:var(--fs-sm)"><li>Keep the same wake time every day, including weekends.</li><li>Screens off 30–60 minutes before bed; phone out of the bedroom if you can.</li><li>No caffeine after early afternoon.</li><li>Cool, dark, quiet room.</li></ul></div>' +
          U.sourceLine([['CDC', 'https://www.cdc.gov/sleep/about/index.html'], ['AASM', 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866']]);
      });
    },
    heart: function (el, t) {
      var p = M.state.profile;
      toolShell(el, t, '<div class="form-grid">' + U.numField('age', 'Age', M.ageFrom(p) || '', 'years', { step: 1 }) + U.numField('rest', 'Resting heart rate (optional)', p.restingHr || '', 'bpm', { step: 1, hint: 'Count your pulse for 60 s on waking.' }) + '</div>', function (d) {
        var age = M.num(d.age);
        if (!age) return U.note('info', '<p>Enter your age.</p>');
        var z = C.hrZones(age, M.num(d.rest));
        return '<div class="result"><div class="stat hero"><span class="label">Estimated max heart rate</span><span class="value">' + M.fmt(z.max) + '<small>bpm</small></span></div>' +
          '<p>From 208 − 0.7 × age. Individual max can differ by about ±10 bpm. ' + (z.method === 'reserve' ? 'Zones use your heart-rate reserve (Karvonen).' : 'Add your resting pulse for more personal zones.') + '</p>' +
          '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table class="data"><thead><tr><th>Zone</th><th>Feels like</th><th class="n">bpm</th></tr></thead><tbody>' +
          z.zones.map(function (x) { return '<tr><td><strong>' + x.name + '</strong></td><td style="white-space:normal">' + M.esc(x.desc) + '</td><td class="n">' + M.fmt(x.lo) + '–' + M.fmt(x.hi) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p>Most weekly cardio can sit in zones 2–3. Use zones 4–5 for short intervals once or twice a week.</p>' + SAVE_BTN + '</div>' +
          U.sourceLine([['Tanaka 2001, Karvonen', 'https://en.wikipedia.org/wiki/Heart_rate']]);
      });
    },
    onerm: function (el, t) {
      toolShell(el, t, '<div class="form-grid">' + U.numField('lw', 'Weight lifted', '', M.wUnit(), { step: 0.5 }) + U.numField('reps', 'Reps done', '', 'reps', { step: 1, min: 1, max: 12 }) + '</div>', function (d) {
        var w = M.num(d.lw), r = M.num(d.reps);
        if (!w || !r) return U.note('info', '<p>Enter a weight and how many clean reps you did (best under 10).</p>');
        var orm = C.oneRM(w, r);
        var rows = [1, 3, 5, 8, 10, 12, 15].map(function (n) { return '<tr><td>' + n + '</td><td class="n">' + M.fmt(C.loadForReps(orm, n), 1) + '</td><td class="n">' + Math.round(C.loadForReps(orm, n) / orm * 100) + '%</td></tr>'; }).join('');
        var age = M.ageFrom(M.state.profile);
        return '<div class="result"><div class="stat hero"><span class="label">Estimated 1-rep max</span><span class="value">' + M.fmt(orm, 1) + '<small>' + M.wUnit() + '</small></span></div>' +
          '<p>Average of the Epley and Brzycki formulas. Estimates can be 10% off — no need to test a true max to train well.' + (r > 10 ? ' Above 10 reps the estimate gets less reliable.' : '') + '</p>' +
          (age !== null && age < 18 ? '<p><strong>Teens:</strong> skip max-out attempts; train in the 10–15 rep range with good form.</p>' : '') +
          '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table class="data"><thead><tr><th>Reps</th><th class="n">Weight (' + M.wUnit() + ')</th><th class="n">% of max</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
          U.sourceLine([['1RM formulas', 'https://en.wikipedia.org/wiki/One-repetition_maximum']]);
      });
    },
    activity: function (el, t) {
      toolShell(el, t, basics(['w']) + '<div class="form-grid">' + U.selectField('act', 'Activity', C.METS.map(function (m) { return [m.id, m.label]; }), 'walk-brisk') + U.numField('min', 'Minutes', 30, 'min', { step: 5 }) + '</div>', function (d) {
        var w = getW(d), mins = M.num(d.min);
        if (!w || !mins) return U.note('info', '<p>Enter your weight and minutes.</p>');
        var m = C.METS.filter(function (x) { return x.id === d.act; })[0];
        var k = C.metKcal(m.met, w, mins);
        return '<div class="result"><div class="stat hero"><span class="label">Energy used</span><span class="value">≈' + M.fmt(M.round(k, 5)) + '<small>kcal</small></span></div>' +
          '<p>' + M.esc(m.label) + ' is about ' + m.met + ' METs (' + (m.met < 3 ? 'light' : m.met < 6 ? 'moderate' : 'vigorous') + ' intensity). This is total energy during the activity, including what you’d burn anyway.</p>' +
          '<p>Exercise is brilliant for health, mood and keeping muscle — but it’s easy to overestimate. Don’t "eat back" these calories one-for-one.</p></div>' +
          U.sourceLine([['MET values', 'https://en.wikipedia.org/wiki/Metabolic_equivalent_of_task'], ['Pontzer, constrained energy', 'https://en.wikipedia.org/wiki/Herman_Pontzer']]);
      });
    }
  };

  function wakeTime() {
    var r = M.calc.routineFor(M.today());
    if (!r) return '06:00';
    var sl = r.blocks.filter(function (b) { return b.cat === 'sleep'; })[0];
    return sl ? sl.end : '06:00';
  }

  M.views.body = {
    head: function (parts) {
      var sub = parts[0] || 'progress';
      if (sub === 'tools' && parts[1]) { var t = TOOLS.filter(function (x) { return x.id === parts[1]; })[0]; return { title: t ? t.name : 'Calculators', sub: 'Calculator' }; }
      return { title: 'Body', sub: { progress: 'Trends, not daily noise', goal: 'Calories and targets for your goal', workouts: 'A plan that fits your time and equipment', tools: 'Health calculators' }[sub] };
    },
    render: function (el, parts) {
      var sub = parts[0] || 'progress';
      if (sub === 'tools' && parts[1] && TOOL_RENDER[parts[1]]) {
        TOOL_RENDER[parts[1]](el, TOOLS.filter(function (x) { return x.id === parts[1]; })[0]);
        return;
      }
      el.innerHTML = subnav(sub);
      if (sub === 'goal') renderGoal(el);
      else if (sub === 'workouts') renderWorkouts(el);
      else if (sub === 'tools') renderTools(el);
      else renderProgress(el);
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'log') U.weightSheet(M.refresh);
        else if (act === 'range') { range = +a.getAttribute('data-r'); M.refresh(); }
        else if (act === 'del-w') {
          var d = a.getAttribute('data-d');
          var removed = M.state.weights.filter(function (x) { return x.d === d; })[0];
          M.state.weights = M.state.weights.filter(function (x) { return x.d !== d; });
          M.save(); M.refresh();
          M.toast('Weigh-in deleted', { label: 'Undo', fn: function () { M.state.weights.push(removed); M.state.weights.sort(function (x, y) { return x.d < y.d ? -1 : 1; }); M.save(); M.refresh(); } });
        }
      });
    }
  };
})();
