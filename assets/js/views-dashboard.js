/* Mizan — Dashboard: what to do now, what's next, water, BMI and the important things today */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var C = M.calc;
  var secTimer = null, minTimer = null;

  M.greeting = function () {
    var h = new Date().getHours();
    var n = M.state.profile.name ? ', ' + M.state.profile.name.split(' ')[0] : '';
    if (h < 4) return 'Up late' + n;
    if (h < 12) return 'Good morning' + n;
    if (h < 17) return 'Good afternoon' + n;
    return 'Good evening' + n;
  };

  /* ------------------------------------------------------------------ */
  /* Water (with timestamps, for reminders)                              */
  /* ------------------------------------------------------------------ */
  M.water = {
    glassMl: function () { return M.state.settings.glassMl || 250; },
    goalGlasses: function () {
      var p = M.state.profile, w = M.latestWeight();
      var goalL = M.state.settings.waterGoalMl ? M.state.settings.waterGoalMl / 1000 : C.waterGoal(p, w || 60, 0, false).goal;
      return Math.max(4, Math.round(goalL * 1000 / M.water.glassMl()));
    },
    todayMl: function (k) { return M.state.water[k || M.today()] || 0; },
    glasses: function (k) { return Math.round(M.water.todayMl(k) / M.water.glassMl()); },
    add: function (sign) {
      var k = M.today(), g = M.water.glassMl();
      var v = Math.max(0, (M.state.water[k] || 0) + (sign < 0 ? -g : g));
      M.state.water[k] = v;
      var log = M.state.waterLog[k] || (M.state.waterLog[k] = []);
      if (sign < 0) log.pop(); else log.push(Date.now());
      // keep the log small: only the last 14 days
      Object.keys(M.state.waterLog).forEach(function (d) { if (M.daysBetween(d, k) > 14) delete M.state.waterLog[d]; });
      M.save();
      if (sign > 0) M.haptic('select');
      return v;
    },
    lastAt: function () {
      var k = M.today();
      var a = (M.state.waterLog[k] || []).slice(-1)[0];
      if (a) return a;
      var y = (M.state.waterLog[M.addDays(k, -1)] || []).slice(-1)[0];
      return y || null;
    },
    /* Is the person awake by their timetable right now? And when did today start? */
    wakeInfo: function () {
      var k = M.today(), now = M.nowMin();
      var r = C.routineFor(k);
      var res = r ? C.resolveBlocks(r, k) : [];
      var sl = res.filter(function (x) { return x.b.cat === 'sleep'; })[0];
      if (!sl) return { awake: true, wokeMin: 420 };
      var inside = sl.start < sl.end ? (now >= sl.start && now < sl.end) : (now >= sl.start || now < sl.end);
      return { awake: !inside, wokeMin: sl.end };
    },
    /* minutes since the last glass (or since waking), or null if asleep / reminders off */
    overdue: function () {
      var cfg = M.state.settings.water || {};
      if (cfg.remind === false) return null;
      var wi = M.water.wakeInfo();
      if (cfg.quietInSleep !== false && !wi.awake) return null;
      var now = Date.now();
      var wokeAt = new Date(); wokeAt.setHours(0, 0, 0, 0); wokeAt = wokeAt.getTime() + wi.wokeMin * 60000;
      if (wokeAt > now) wokeAt -= 86400000;
      var since = Math.max(M.water.lastAt() || 0, wokeAt);
      var min = (now - since) / 60000;
      return min >= (cfg.everyMin || 90) ? Math.round(min) : null;
    },
    sinceText: function () {
      var l = M.water.lastAt();
      if (!l) return 'No water logged yet today';
      var m = Math.round((Date.now() - l) / 60000);
      return m < 1 ? 'Last glass just now' : 'Last glass ' + M.fmtDur(m) + ' ago';
    }
  };

  /* ------------------------------------------------------------------ */
  /* BMI summary for the profile                                          */
  /* ------------------------------------------------------------------ */
  M.bmiInfo = function () {
    var p = M.state.profile, w = M.latestWeight();
    var missing = [];
    if (!p.heightCm) missing.push('height');
    if (!w) missing.push('weight');
    if (missing.length) return { missing: missing };
    var series = C.trend(M.state.weights);
    var kg = series.length ? series[series.length - 1].trend : w;
    var b = C.bmi(kg, p.heightCm);
    var age = M.ageFrom(p);
    var out = { bmi: b, kg: kg, age: age };
    if (age !== null && age >= 2 && age < 20) {
      out.teen = true;
      var ba = (p.sex === 'male' || p.sex === 'female') ? C.bmiForAge(b, p.sex, M.ageMonths(p)) : null;
      if (!ba) { out.needSex = true; return out; }
      out.pct = ba.pct; out.key = ba.category.key; out.label = ba.category.label;
      out.range = { min: ba.p5 * Math.pow(p.heightCm / 100, 2), max: ba.p85 * Math.pow(p.heightCm / 100, 2) };
      out.scale = U.scale([{ label: 'Under', from: 0, to: 5 }, { label: 'Healthy', from: 5, to: 85 }, { label: 'Over', from: 85, to: 95 }, { label: 'Obesity', from: 95, to: 100 }], ba.pct, ba.pct < 5 ? 0 : ba.pct < 85 ? 1 : ba.pct < 95 ? 2 : 3);
    } else {
      var std = M.state.settings.bmiStandard;
      var cat = C.bmiCategory(b, std);
      var S = C.BMI_STANDARDS[std];
      out.key = cat.key; out.label = cat.label;
      out.range = C.healthyRange(p.heightCm, std);
      out.scale = U.scale(S.bands.map(function (x, i) { return { label: x.label.replace('Obesity class ', 'Ob. ').replace('Healthy weight', 'Healthy').replace('Underweight', 'Under').replace('Overweight', 'Over'), from: i ? S.bands[i - 1].max : 14, to: x.max === Infinity ? Math.max(45, b + 2) : x.max }; }), b, cat.index);
    }
    out.tone = out.key === 'healthy' ? 'good' : out.key === 'under' || out.key === 'over' ? 'warn' : 'bad';
    out.advice = {
      under: out.teen ? 'Eat regular meals plus 1–2 snacks, and add strength exercise. Talk to a doctor if you’re losing weight.' : 'Add a snack or two each day and do strength training 2–3 times a week to gain slowly.',
      healthy: 'You’re in the healthy range. Keep moving every day, sleep well and eat mostly home-made food.',
      over: out.teen ? 'Focus on habits, not dieting: daily activity, fewer sugary drinks, regular sleep.' : 'Aim to lose about 0.5 kg a week: a daily walk, smaller portions of rice and roti, fewer sugary drinks.',
      ob1: out.teen ? 'Build daily activity and healthy family meals, and check in with a doctor.' : 'A daily walk and a small calorie deficit help. Consider talking to a doctor about a plan.',
      ob2: 'Please talk to a doctor — they can help you make a safe plan. Daily movement and regular meals are a great start.',
      ob3: 'Please talk to a doctor — they can help you make a safe plan.'
    }[out.key] || '';
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* The day right now                                                    */
  /* ------------------------------------------------------------------ */
  function dayNow() {
    var k = M.today(), now = M.nowMin();
    var r = C.routineFor(k);
    if (!r || !r.blocks.length) return { k: k, now: now, none: true };
    var res = C.resolveBlocks(r, k);
    var loc = C.locate(res, now);
    var upcoming = res.filter(function (x) { return !loc.cur || x !== loc.cur; }).sort(function (a, b) { return ((a.start - now + 1440) % 1440) - ((b.start - now + 1440) % 1440); })
      .filter(function (x) { var inside = x.start < x.end ? (now >= x.start && now < x.end) : (now >= x.start || now < x.end); return !inside; });
    return { k: k, now: now, routine: r, res: res, loc: loc, cur: loc.cur, upcoming: upcoming.slice(0, 3) };
  }
  M.dayNow = dayNow;

  /* epoch ms of a minute-of-day, today or tomorrow (never in the past) */
  function at(min) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var t = d.getTime() + Math.round(min) * 60000;
    if (t <= Date.now() - 1000) t += 86400000;
    return t;
  }
  function hms(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + M.pad(m) : m) + ':' + M.pad(x);
  }

  /* ------------------------------------------------------------------ */
  /* Important things right now                                           */
  /* ------------------------------------------------------------------ */
  M.important = function () {
    var out = [];
    var d = dayNow();
    var s = M.state.settings;
    var od = M.water.overdue();
    if (od !== null) out.push({ level: 'warn', icon: 'water', text: 'You haven’t had water for ' + M.fmtDur(od) + '. Have a glass now.', action: { label: '+1 glass', act: 'water-plus' } });
    if (!d.none) {
      var sleep = d.res.filter(function (x) { return x.b.cat === 'sleep'; })[0];
      if (sleep && d.cur !== sleep) {
        var toBed = (sleep.start - d.now + 1440) % 1440;
        if (toBed <= 60) out.push({ level: 'info', icon: 'moon', text: 'Bedtime in ' + M.fmtDur(toBed) + '. Screens off and start winding down.' });
      }
      var nx = d.upcoming[0];
      if (nx) {
        var inMin = (nx.start - d.now + 1440) % 1440;
        if (inMin <= 10 && nx.b.cat !== 'sleep') out.push({ level: 'info', icon: 'clock', text: '“' + nx.b.title + '” starts in ' + M.fmtDur(Math.max(1, inMin)) + ' — get ready.' });
      }
      var ci = M.state.checkins[d.k] || {};
      var missed = d.res.filter(function (x) { return x.start < x.end && x.end <= d.now && !ci[x.b.id] && x.b.cat !== 'sleep' && x.dur >= 20; });
      var fresh = M.state.setup && M.state.setup.at === d.k; // timetable made today: don't nag about earlier blocks
      if (missed.length >= 2 && !fresh) out.push({ level: 'info', icon: 'check', text: missed.length + ' blocks from earlier today aren’t checked in yet.', action: { label: 'Check in', href: '#/today' } });
      var an = C.analyzeRoutine(d.routine, M.state.profile, d.k);
      if (an.overlaps.length) out.push({ level: 'bad', icon: 'alert', text: 'Today’s plan has ' + an.overlaps.length + ' overlapping ' + M.plural(an.overlaps.length, 'block') + '.', action: { label: 'Fix in Plan', href: '#/plan' } });
    } else {
      out.push({ level: 'info', icon: 'plan', text: 'There’s no timetable for today yet.', action: { label: 'Build one', act: 'setup' } });
    }
    // habits left after 6 pm
    var wd = M.weekday(d.k);
    var hs = M.state.habits.filter(function (h) { return !h.archived && h.days.indexOf(wd) >= 0; });
    var log = M.state.habitLog[d.k] || [];
    var left = hs.filter(function (h) { return log.indexOf(h.id) < 0; });
    if (left.length && d.now >= 18 * 60) out.push({ level: 'info', icon: 'habits', text: left.length + ' ' + M.plural(left.length, 'habit') + ' left today: ' + left.slice(0, 2).map(function (h) { return h.name; }).join(', ') + (left.length > 2 ? '…' : '') + '.', action: { label: 'Open', href: '#/habits' } });
    // workout planned today
    var wp = M.state.workoutPlan;
    if (wp && wp.days.indexOf(wd) >= 0) {
      var idx = wp.days.indexOf(wd), ses = wp.sessions[idx % wp.sessions.length];
      var done = M.state.workoutLog && M.state.workoutLog[d.k];
      if (!done) out.push({ level: 'info', icon: 'dumbbell', text: 'Today’s workout: ' + ses.name + '.', action: { label: 'Open', href: '#/body/workouts' } });
    }
    // BMI / weight
    var bi = M.bmiInfo();
    if (bi.missing) out.push({ level: 'info', icon: 'scale', text: 'Add your ' + bi.missing.join(' and ') + ' to see your BMI.', action: { label: 'Add', href: '#/settings/profile' } });
    else if (M.state.weights.length) {
      var last = M.state.weights[M.state.weights.length - 1];
      var ago = M.daysBetween(last.d, d.k);
      if (ago >= 7) out.push({ level: 'info', icon: 'scale', text: 'Last weigh-in was ' + ago + ' days ago.', action: { label: 'Log weight', act: 'log-weight' } });
    }
    // backup
    if (M.backup) { var bk = M.backup.reminder(); if (bk) out.push(bk); }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Cards                                                                */
  /* ------------------------------------------------------------------ */
  var CARD = {};

  CARD.now = function (d) {
    if (d.none) return '<section class="panel dash-now" aria-labelledby="dn-h"><p class="eyebrow">Right now</p><h2 id="dn-h">No timetable yet</h2><p class="soft">Plan it hour by hour with the assistant, or answer 5 quick questions and Mizan builds one for you.</p><div class="btn-row"><button type="button" class="btn btn-primary" data-action="custom">' + M.icon('chat') + 'Build it step by step</button><button type="button" class="btn" data-action="setup">' + M.icon('plan') + 'Answer 5 questions</button></div></section>';
    var cur = d.cur;
    if (!cur) {
      var nx = d.upcoming[0];
      return '<section class="panel dash-now" aria-labelledby="dn-h"><p class="eyebrow">Right now</p><h2 id="dn-h">Free time</h2><p class="soft">Nothing is planned for this moment' + (nx ? ' — <strong>' + M.esc(nx.b.title) + '</strong> starts at ' + M.fmtTime(nx.start) : '') + '.</p>' +
        (nx ? '<div class="dn-count"><span class="big num" data-count-to="' + at(nx.start) + '">' + hms(at(nx.start) - Date.now()) + '</span><span>until it starts</span></div>' : '') +
        '<a class="btn" href="#/plan">' + M.icon('plus') + 'Fill this gap</a></section>';
    }
    var c = M.cat(cur.b.cat);
    var ci = (M.state.checkins[d.k] || {})[cur.b.id];
    var st = ci ? ci.s : '';
    var pct = M.clamp(d.loc.elapsed / cur.dur * 100, 0, 100);
    var isSleep = cur.b.cat === 'sleep';
    var endAt = at(cur.end);
    return '<section class="panel dash-now" style="--cat:' + M.catVar(cur.b.cat) + '" aria-labelledby="dn-h">' +
      '<div class="dn-top"><p class="eyebrow">' + M.icon(c.icon) + 'Right now · ' + M.esc(c.label) + '</p><span class="dn-time num">' + M.fmtTime(cur.start) + '–' + M.fmtTime(cur.end) + '</span></div>' +
      '<h2 id="dn-h">' + M.esc(cur.b.title) + '</h2>' +
      '<div class="dn-count"><span class="big num" data-count-to="' + endAt + '" data-rerender>' + hms(endAt - Date.now()) + '</span><span>' + (isSleep ? 'until you wake up' : 'left') + '</span></div>' +
      '<div class="meter now-meter" role="img" aria-label="' + Math.round(pct) + '% done"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
      (cur.b.notes ? '<p class="dn-notes">' + M.esc(cur.b.notes) + '</p>' : '') +
      (isSleep ? '<p class="soft" style="margin:0">Put the phone away — sleep is when your body and brain recover.</p>' :
        '<div class="checkin" role="group" aria-label="Check in for ' + M.esc(cur.b.title) + '">' +
        '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="done" aria-pressed="' + (st === 'done') + '">' + M.icon('check') + 'Done</button>' +
        '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="partial" aria-pressed="' + (st === 'partial') + '">' + M.icon('half') + 'Partly</button>' +
        '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="skipped" aria-pressed="' + (st === 'skipped') + '">' + M.icon('skip') + 'Skipped</button></div>' +
        (cur.b.cat === 'study' ? '<button type="button" class="btn btn-ink btn-block" style="margin-top:10px" data-action="focus" data-label="' + M.esc(cur.b.title) + '">' + M.icon('timer') + 'Start focus timer</button>' : '') +
        (cur.b.cat === 'exercise' ? '<a class="btn btn-ink btn-block" style="margin-top:10px" href="#/move">' + M.icon('run') + 'Track a walk or run</a>' : '')) +
      '</section>';
  };

  CARD.next = function (d) {
    if (d.none || !d.upcoming.length) return '';
    var n = d.upcoming[0];
    var c = M.cat(n.b.cat);
    return '<section class="panel dash-next" aria-labelledby="dx-h"><div class="panel-title"><h3 id="dx-h">Up next</h3><a class="btn btn-sm btn-ghost" href="#/today">Full day</a></div>' +
      '<div class="dx-main" style="--cat:' + M.catVar(n.b.cat) + '"><span class="dx-bar" aria-hidden="true"></span><div class="grow"><strong>' + M.esc(n.b.title) + '</strong><span class="muted">' + M.esc(c.label) + ' · ' + M.fmtTime(n.start) + '–' + M.fmtTime(n.end) + ' · ' + M.fmtDurShort(n.dur) + '</span></div>' +
      '<div class="dx-count"><span class="muted">starts in</span><strong class="num" data-count-to="' + at(n.start) + '" data-rerender>' + hms(at(n.start) - Date.now()) + '</strong></div></div>' +
      (d.upcoming.length > 1 ? '<ul class="dx-later">' + d.upcoming.slice(1).map(function (x) { return '<li style="--cat:' + M.catVar(x.b.cat) + '"><i aria-hidden="true"></i><span class="num">' + M.fmtTime(x.start) + '</span><span class="grow">' + M.esc(x.b.title) + '</span><span class="muted num">in ' + M.fmtDurShort((x.start - d.now + 1440) % 1440) + '</span></li>'; }).join('') + '</ul>' : '') +
      '</section>';
  };

  CARD.water = function () {
    var n = M.water.glasses(), goal = M.water.goalGlasses();
    var od = M.water.overdue();
    var pct = M.clamp(n / goal * 100, 0, 100);
    return '<section class="panel dash-water' + (od !== null ? ' is-due' : '') + '" aria-labelledby="dw-h"><div class="panel-title"><h3 id="dw-h">Water</h3><a class="btn btn-sm btn-ghost" href="#/settings/water">Reminders</a></div>' +
      (od !== null ? '<p class="water-alert" role="alert">' + M.icon('bell') + 'No water for ' + M.fmtDur(od) + ' — time for a glass.</p>' : '') +
      '<div class="row between"><div class="stat"><span class="value water-count">' + n + '<small>of ' + goal + ' glasses</small></span><span class="sub">' + M.esc(M.water.sinceText()) + '</span></div>' +
      '<div class="row"><button type="button" class="icon-btn" data-action="water-minus" aria-label="Remove a glass">' + M.icon('minus') + '</button><button type="button" class="btn btn-primary" data-action="water-plus" aria-label="Add a glass of water">' + M.icon('water') + '+1</button></div></div>' +
      '<div class="glasses" aria-hidden="true">' + Array.apply(null, Array(goal)).map(function (_, i) { return '<i class="' + (i < n ? 'on' : '') + '"></i>'; }).join('') + '</div></section>';
  };

  CARD.important = function () {
    var items = M.important();
    return '<section class="panel dash-important" aria-labelledby="di-h"><div class="panel-title"><h3 id="di-h">Important</h3>' + (items.length ? '<span class="badge">' + items.length + '</span>' : '') + '</div>' +
      (items.length ? '<ul class="imp-list">' + items.map(function (x) {
        return '<li class="' + x.level + '">' + M.icon(x.icon) + '<span class="grow">' + M.esc(x.text) + '</span>' +
          (x.action ? (x.action.href ? '<a class="btn btn-sm" href="' + x.action.href + '">' + M.esc(x.action.label) + '</a>' : '<button type="button" class="btn btn-sm" data-action="' + x.action.act + '">' + M.esc(x.action.label) + '</button>') : '') + '</li>';
      }).join('') + '</ul>' : '<p class="all-clear">' + M.icon('good') + 'All clear. Nothing needs your attention right now.</p>') +
      '</section>';
  };

  CARD.bmi = function () {
    var b = M.bmiInfo();
    var head = '<div class="panel-title"><h3 id="db-h">BMI</h3><a class="btn btn-sm btn-ghost" href="#/body">Details</a></div>';
    if (b.missing) return '<section class="panel dash-bmi" aria-labelledby="db-h">' + head + '<p class="soft">Add your ' + b.missing.join(' and ') + ' to see your BMI and what it means for you.</p><button type="button" class="btn btn-primary" data-action="log-weight">' + M.icon('scale') + 'Add weight</button> <a class="btn" href="#/settings/profile">Add height</a></section>';
    if (b.needSex) return '<section class="panel dash-bmi" aria-labelledby="db-h">' + head + '<div class="stat"><span class="value">' + M.fmt(b.bmi, 1) + '</span></div><p class="soft">Under 20, BMI is judged by age and sex. Add your sex in Settings to see where you are.</p><a class="btn" href="#/settings/profile">Open profile</a></section>';
    return '<section class="panel dash-bmi" aria-labelledby="db-h">' + head +
      '<div class="row between wrap" style="align-items:flex-end"><div class="stat"><span class="value">' + M.fmt(b.bmi, 1) + '</span><span class="sub">' + (b.teen ? Math.round(b.pct) + 'th percentile for your age' : (M.state.settings.bmiStandard === 'asian' ? 'Asian' : 'WHO') + ' cut-offs') + '</span></div>' +
      '<span class="badge ' + b.tone + '">' + M.icon(b.tone === 'good' ? 'good' : 'alert') + M.esc(b.label) + '</span></div>' + b.scale +
      '<p class="soft" style="margin:8px 0 0;font-size:var(--fs-sm)">Healthy weight for your height: <strong>' + M.showW(b.range.min) + '–' + M.showW(b.range.max) + ' ' + M.wUnit() + '</strong>. ' + M.esc(b.advice) + '</p></section>';
  };

  CARD.progress = function (d) {
    var ci = M.state.checkins[d.k] || {};
    var past = d.none ? [] : d.res.filter(function (x) { return x.b.cat !== 'sleep' && (x.start < x.end ? x.start <= d.now : false); });
    var done = past.filter(function (x) { return ci[x.b.id] && ci[x.b.id].s === 'done'; }).length;
    var wd = M.weekday(d.k);
    var hs = M.state.habits.filter(function (h) { return !h.archived && h.days.indexOf(wd) >= 0; });
    var hlog = M.state.habitLog[d.k] || [];
    var hd = hs.filter(function (h) { return hlog.indexOf(h.id) >= 0; }).length;
    var act = M.activityToday ? M.activityToday() : { km: 0, steps: 0 };
    var row = function (label, val, max, unit) {
      var pc = max ? M.clamp(val / max * 100, 0, 100) : 0;
      return '<div class="pg-row"><span class="pg-l">' + label + '</span><div class="meter"><span style="width:' + pc.toFixed(0) + '%"></span></div><span class="pg-v num">' + val + (max ? '<small>/' + max + '</small>' : '') + (unit || '') + '</span></div>';
    };
    return '<section class="panel dash-progress" aria-labelledby="dp-h"><div class="panel-title"><h3 id="dp-h">Today’s progress</h3></div>' +
      row('Blocks done', done, past.length) + row('Habits', hd, hs.length) + row('Water', M.water.glasses(), M.water.goalGlasses()) +
      '<div class="stats" style="margin-top:14px"><div class="stat"><span class="label">Focus time</span><span class="value">' + M.fmtDurShort(M.state.focus[d.k] || 0) + '</span></div>' +
      '<div class="stat"><span class="label">Walked / ran</span><span class="value">' + M.fmt(act.km, 2) + '<small>km</small></span></div></div></section>';
  };

  CARD.activity = function () {
    var today = M.activityToday ? M.activityToday() : { km: 0, steps: 0, n: 0 };
    var week = M.activityWeek ? M.activityWeek() : { km: 0, n: 0 };
    var last = (M.state.activities || []).slice(-1)[0];
    return '<section class="panel dash-activity" aria-labelledby="da-h"><div class="panel-title"><h3 id="da-h">Walks & runs</h3><a class="btn btn-sm btn-ghost" href="#/move/history">History</a></div>' +
      '<div class="stats"><div class="stat"><span class="label">Today</span><span class="value">' + M.fmt(today.km, 2) + '<small>km</small></span><span class="sub">' + M.fmt(today.steps) + ' steps</span></div>' +
      '<div class="stat"><span class="label">This week</span><span class="value">' + M.fmt(week.km, 1) + '<small>km</small></span><span class="sub">' + week.n + ' ' + M.plural(week.n, 'session') + '</span></div></div>' +
      (last ? '<p class="muted" style="font-size:var(--fs-sm);margin:10px 0 0">Last: ' + M.esc(last.type === 'run' ? 'Run' : last.type === 'treadmill' ? 'Treadmill' : 'Walk') + ', ' + M.fmt(last.km, 2) + ' km in ' + M.fmtDur(Math.round(last.movingSec / 60)) + ' · ' + M.fmtDate(last.date, 'weekday') + '</p>' : '') +
      '<a class="btn btn-primary" style="margin-top:12px" href="#/move">' + M.icon('run') + 'Start a walk or run</a></section>';
  };

  CARD.actions = function () {
    var A = [
      ['#/move', 'run', 'Walk / run'],
      ['act:water-plus', 'water', '+1 water'],
      ['act:focus', 'timer', 'Focus timer'],
      ['act:assistant', 'chat', 'Ask ' + M.esc((M.state.settings.bot && M.state.settings.bot.name) || 'assistant')],
      ['act:log-weight', 'scale', 'Log weight'],
      ['#/looks', 'face', 'Looks guide'],
      ['act:add-block', 'plus', 'Add a block'],
      ['#/food/plan', 'food', 'Meal plan']
    ];
    return '<section class="panel dash-actions" aria-labelledby="dq-h"><div class="panel-title"><h3 id="dq-h">Quick actions</h3></div><div class="qa-grid">' +
      A.map(function (x) {
        var inner = '<span class="qa-ico">' + M.icon(x[1]) + '</span><span>' + x[2] + '</span>';
        return x[0].indexOf('act:') === 0 ? '<button type="button" class="qa" data-action="' + x[0].slice(4) + '">' + inner + '</button>' : '<a class="qa" href="' + x[0] + '">' + inner + '</a>';
      }).join('') + '</div></section>';
  };

  CARD.habits = function (d) {
    var wd = M.weekday(d.k);
    var hs = M.state.habits.filter(function (h) { return !h.archived && h.days.indexOf(wd) >= 0; });
    if (!hs.length) return '<section class="panel dash-habits" aria-labelledby="dh-h"><div class="panel-title"><h3 id="dh-h">Habits</h3></div><p class="muted" style="margin:0 0 12px">Small daily habits, each tied to a cue you already have.</p><a class="btn" href="#/habits">' + M.icon('plus') + 'Add a habit</a></section>';
    var log = M.state.habitLog[d.k] || [];
    return '<section class="panel dash-habits" aria-labelledby="dh-h"><div class="panel-title"><h3 id="dh-h">Habits</h3><span class="badge">' + hs.filter(function (h) { return log.indexOf(h.id) >= 0; }).length + ' of ' + hs.length + '</span></div><ul class="list">' +
      hs.map(function (h) {
        var on = log.indexOf(h.id) >= 0;
        return '<li><button type="button" class="habit-check" style="width:40px;height:40px;border-radius:12px" data-action="habit-toggle" data-id="' + M.esc(h.id) + '" aria-pressed="' + on + '" aria-label="' + M.esc(h.name) + (on ? ', done' : ', not done') + '">' + M.icon('check') + '</button><div class="li-main"><strong>' + M.esc(h.name) + '</strong><span>' + M.esc(h.cue) + '</span></div></li>';
      }).join('') + '</ul></section>';
  };

  CARD.sun = function () {
    if (!M.sun.active()) return '<section class="panel dash-sun" aria-labelledby="ds-h"><div class="panel-title"><h3 id="ds-h">Sun times</h3></div><p class="muted" style="margin:0 0 12px">See sunrise and sunset for where you are.</p><a class="btn" href="#/settings/sun">' + M.icon('sun') + 'Turn on</a></section>';
    var t = M.sun.times(M.today());
    return '<section class="panel dash-sun" aria-labelledby="ds-h"><div class="panel-title"><h3 id="ds-h">Sun times</h3></div><div class="stats three">' + t.map(function (x) { return '<div class="stat"><span class="label">' + x.label + '</span><span class="value" style="font-size:var(--fs-xl)">' + M.fmtTime(x.at) + '</span></div>'; }).join('') + '</div></section>';
  };

  /* ------------------------------------------------------------------ */
  function tickCountdowns(root) {
    var needRender = false;
    M.$$('[data-count-to]', root).forEach(function (el) {
      var left = +el.getAttribute('data-count-to') - Date.now();
      if (left <= 0 && el.hasAttribute('data-rerender')) needRender = true;
      el.textContent = hms(left);
    });
    if (needRender && !document.querySelector('dialog[open]')) M.render(true);
  }

  M.views.dashboard = {
    head: function () {
      var k = M.today();
      var r = C.routineFor(k);
      return { title: M.greeting(), sub: M.fmtDate(k) + (r ? ' · ' + r.name : '') };
    },
    render: function (el) {
      var d = dayNow();
      var cards = M.state.settings.dash.cards.filter(function (c) { return c.on; }).map(function (c) {
        var html = CARD[c.id] ? CARD[c.id](d) : '';
        return html ? '<div class="dash-cell cell-' + c.id + '">' + html + '</div>' : '';
      }).join('');
      el.innerHTML = '<div class="dash-grid">' + (cards || '<div class="empty">' + M.icon('dash') + '<p><strong>All dashboard cards are hidden.</strong></p><a class="btn" href="#/settings/dashboard">Choose cards</a></div>') + '</div>' +
        '<div class="dash-foot"><a class="btn btn-ghost" href="#/settings/dashboard">' + M.icon('palette') + 'Customize dashboard</a></div>';

      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'ci') {
          var id = a.getAttribute('data-id'), s = a.getAttribute('data-s');
          var was = (M.state.checkins[d.k] || {})[id]; was = was && was.s === s;
          M.setCheckin(d.k, id, s);
          M.haptic(s === 'done' ? 'success' : s === 'skipped' ? 'warning' : 'select');
          M.flashAfterRender('.dash-now .checkin [aria-pressed="true"]', 'pop');
          if (s === 'skipped' && !was && d.cur) M.askMissReason(d.k, d.cur.b, M.refresh);
          else { M.refresh(); if (s === 'done' && !was) M.toast('Nice — checked in.'); }
        } else if (act === 'water-plus' || act === 'water-minus') {
          M.water.add(act === 'water-plus' ? 1 : -1);
          M.flashAfterRender('.water-count', 'pop');
          M.refresh();
        } else if (act === 'habit-toggle') {
          var hid = a.getAttribute('data-id');
          var on = M.toggleHabit(d.k, hid);
          if (on) { M.haptic('success'); M.flashAfterRender('.habit-check[data-id="' + hid + '"]', 'pop'); }
          M.refresh();
        } else if (act === 'focus') U.focusTimer(a.getAttribute('data-label') || '');
        else if (act === 'log-weight') U.weightSheet(M.refresh);
        else if (act === 'setup') M.startSetup();
        else if (act === 'custom') { if (M.assistant) M.assistant.startBuilder(); }
        else if (act === 'assistant') { if (M.assistant) M.assistant.open(); else M.go('assistant'); }
        else if (act === 'add-block') { var r = C.routineFor(d.k); if (r) U.editBlock(r, null, function () { M.refresh(); }); else M.startSetup(); }
        else if (act === 'backup-now') { if (M.backup) M.backup.quick(); }
      });

      clearInterval(secTimer); clearInterval(minTimer);
      secTimer = setInterval(function () { if (!document.hidden) tickCountdowns(el); }, 1000);
      var lastMin = Math.floor(M.nowMin());
      var dueShown = M.water.overdue() !== null;
      minTimer = setInterval(function () {
        if (document.hidden || document.querySelector('dialog[open]')) return;
        if (Math.floor(M.nowMin()) !== lastMin) {
          lastMin = Math.floor(M.nowMin());
          var due = M.water.overdue() !== null;
          if (due && !dueShown) { M.haptic('warning'); M.notify && M.notify('Time for water', 'You haven’t had a glass in a while.'); }
          dueShown = due;
          M.render(true);
        }
      }, 15000);
    },
    leave: function () { clearInterval(secTimer); clearInterval(minTimer); }
  };
})();
