/* Mizan — the starting questions, and the timetable they produce.
   Everything is worked out on the device from 5 answers. The result is a normal routine,
   so every block can be edited afterwards in Plan. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var R5 = function (m) { return Math.round(m / 5) * 5; };
  var clock = function (min) { return M.fromMin(((R5(min) % 1440) + 1440) % 1440); };

  M.ROLES = [
    { id: 'school', label: 'School student', short: 'School', fixed: 'School', icon: 'school' },
    { id: 'college', label: 'College student', short: 'College', fixed: 'College / classes', icon: 'book' },
    { id: 'work', label: 'Working', short: 'Work', fixed: 'Work', icon: 'calc' },
    { id: 'home', label: 'At home / other', short: 'Home', fixed: 'Main tasks', icon: 'user' }
  ];
  M.GOALS = [
    { id: 'lose', label: 'Lose weight', profileGoal: 'lose' },
    { id: 'gain', label: 'Build muscle / gain weight', profileGoal: 'gain' },
    { id: 'fit', label: 'Stay fit & healthy', profileGoal: 'maintain' },
    { id: 'study', label: 'Study better', profileGoal: null },
    { id: 'discipline', label: 'Build discipline', profileGoal: null }
  ];

  /* Sensible first answers for a role (and age, if known) */
  function defaults(role, age) {
    var teen = age !== null && age !== undefined && age < 18;
    var d = {
      school: { wake: '06:00', bed: teen ? '22:00' : '22:30', start: '07:30', end: '14:00', days: [1, 2, 3, 4, 5, 6], travel: 20, studyMin: 120 },
      college: { wake: '06:30', bed: '23:00', start: '09:00', end: '16:00', days: [1, 2, 3, 4, 5], travel: 30, studyMin: 150 },
      work: { wake: '06:30', bed: '23:00', start: '09:30', end: '18:00', days: [1, 2, 3, 4, 5], travel: 30, studyMin: 45 },
      home: { wake: '07:00', bed: '23:00', start: '10:00', end: '13:00', days: [1, 2, 3, 4, 5, 6], travel: 0, studyMin: 60 }
    }[role] || {};
    return {
      role: role, wake: d.wake, bed: d.bed, start: d.start, end: d.end, days: d.days, travel: d.travel,
      goal: 'fit', exWhen: 'morning', exMin: 30, studyMin: d.studyMin
    };
  }

  /* ------------------------------------------------------------------ */
  /* Fit a list of flexible items into a time budget.                     */
  /* items: {title, cat, ideal, min, pr (higher = keep longer), notes}    */
  /* ------------------------------------------------------------------ */
  function fit(items, budget) {
    items = items.filter(function (x) { return x.ideal > 0; }).map(function (x) { var y = Object.assign({}, x); y.dur = R5(x.ideal); y.min = R5(x.min === undefined ? x.ideal : x.min); return y; });
    var total = function () { return items.reduce(function (a, x) { return a + x.dur; }, 0); };
    var over = total() - budget;
    if (over > 0) {
      // shrink the least important first, down to their minimum
      var order = items.slice().sort(function (a, b) { return a.pr - b.pr; });
      order.forEach(function (x) {
        if (over <= 0) return;
        var cut = Math.min(over, x.dur - x.min);
        x.dur -= cut; over -= cut;
      });
      // still too long: drop items, least important first
      order.forEach(function (x) {
        if (over <= 0 || x.keep) return;
        over -= x.dur; x.dur = 0;
      });
      items = items.filter(function (x) { return x.dur > 0; });
    }
    // a 5-minute "screen time" or study block isn't useful: drop tiny leftovers and give the time back
    items = items.filter(function (x) { return x.keep || x.dur >= Math.min(15, x.ideal) || x.cat === 'routine'; });
    return { items: items, slack: Math.max(0, budget - total()) };
  }

  /* Study blocks of about an hour with short real breaks in between */
  function studyItems(total, role) {
    var names = role === 'school' ? ['Study block 1 — homework', 'Study block 2 — revision & practice', 'Study block 3 — test yourself', 'Study block 4 — weak topics']
      : role === 'college' ? ['Deep study', 'Practice problems', 'Revision', 'Reading & notes']
      : ['Learning / side project', 'Learning — practice', 'Learning — review', 'Learning'];
    var notes = role === 'school' || role === 'college'
      ? ['Phone in another room. One subject at a time.', 'Test yourself instead of re-reading.', 'Close your notes and write what you remember.', 'Spend it on the topic you find hardest.']
      : ['One focused task. Notifications off.', '', '', ''];
    var out = [];
    if (total < 15) return out;
    var n = Math.max(1, Math.round(total / 60));
    var each = R5(total / n);
    for (var i = 0; i < n; i++) {
      out.push({ title: names[i % names.length], cat: 'study', ideal: each, min: Math.max(20, R5(each * 0.5)), pr: 6, notes: notes[i % notes.length] });
      if (i < n - 1) out.push({ title: 'Short break', cat: 'free', ideal: 10, min: 5, pr: 7, notes: 'Stand up, stretch, drink water. Not scrolling.' });
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Build one day. Works in "minutes after waking" so midnight is easy.  */
  /* ------------------------------------------------------------------ */
  function buildDay(a, fixedDay) {
    var W = M.toMin(a.wake), B = M.toMin(a.bed);
    var dayLen = (B - W + 1440) % 1440 || 960;
    var off = function (hhmm) { return (M.toMin(hhmm) - W + 1440) % 1440; };
    var role = M.ROLES.filter(function (r) { return r.id === a.role; })[0] || M.ROLES[0];
    var blocks = [];
    var t = 0;
    var push = function (title, cat, dur, notes) { dur = R5(dur); if (dur <= 0) return; blocks.push({ s: t, e: t + dur, title: title, cat: cat, notes: notes || '' }); t += dur; };
    var pushAll = function (list) { list.forEach(function (x) { push(x.title, x.cat, x.dur, x.notes); }); };

    var exMorning = a.exWhen === 'morning' && a.exMin > 0;
    var exEvening = a.exWhen === 'evening' && a.exMin > 0;
    var exTitle = a.goal === 'gain' ? 'Strength workout' : a.goal === 'lose' ? 'Walk, jog or workout' : 'Exercise';
    var exNotes = a.goal === 'gain' ? 'Main lifts first, 2–3 hard sets each. Eat protein afterwards.' : a.goal === 'lose' ? 'Keep most days comfortable — you should be able to talk. Consistency beats intensity.' : 'Mix walking or sport with some strength work each week.';

    // --- Tail of the day (backwards from bedtime) ---
    var tail = [
      { title: 'Dinner', cat: 'meal', ideal: 30, min: 20, pr: 9, keep: true, notes: 'Unrushed, ideally with family. Finish 2 hours or more before sleep.' },
      { title: a.goal === 'lose' ? 'Walk after dinner' : 'Family & free time', cat: a.goal === 'lose' ? 'exercise' : 'free', ideal: a.goal === 'lose' ? 15 : 60, min: 0, pr: 2, notes: a.goal === 'lose' ? 'A 10–15 minute walk helps digestion and blood sugar.' : '' },
      { title: 'Prepare for tomorrow', cat: 'routine', ideal: 15, min: 10, pr: 8, keep: true, notes: 'Pack your bag, lay out clothes' + (exMorning ? ' and workout kit' : '') + '.' },
      { title: a.goal === 'discipline' ? 'Reflect & wind down (no screens)' : 'Wind down (no screens)', cat: 'routine', ideal: 20, min: 10, pr: 8, keep: true, notes: a.goal === 'discipline' ? 'Write one thing that went well and your top task for tomorrow. Phone away.' : 'Phone away, lights dim. Read or stretch.' }
    ];
    if (a.goal === 'lose') tail.splice(2, 0, { title: 'Family & free time', cat: 'free', ideal: 45, min: 0, pr: 1 });
    var tailIdeal = tail.reduce(function (x, y) { return x + y.ideal; }, 0);

    if (fixedDay && a.start && a.end) {
      var S = off(a.start), E = off(a.end);
      if (E <= S) E = S + 60;
      var T = R5(a.travel || 0);
      var leave = S - T;
      // --- Morning: wake → leave ---
      var morning = [
        { title: 'Wake up & freshen up', cat: 'routine', ideal: 15, min: 10, pr: 9, keep: true, notes: 'Water first, then wash up.' },
        { title: 'Plan your day', cat: 'personal', ideal: a.goal === 'discipline' ? 10 : 0, min: 5, pr: 4, notes: 'Look at today’s blocks and pick your top 3 tasks.' },
        exMorning ? { title: exTitle, cat: 'exercise', ideal: a.exMin, min: 15, pr: 5, notes: exNotes } : null,
        { title: exMorning ? 'Shower & breakfast' : 'Breakfast', cat: 'meal', ideal: exMorning ? 30 : 20, min: 10, pr: 9, keep: true, notes: 'Include some protein: milk, curd, eggs, paneer, dal or sprouts.' },
        { title: a.role === 'school' || a.role === 'college' ? 'Morning revision' : 'Quiet time', cat: a.role === 'school' || a.role === 'college' ? 'study' : 'personal', ideal: 0, min: 0, pr: 1 },
        { title: 'Get ready', cat: 'routine', ideal: 20, min: 10, pr: 8, keep: true, notes: 'Dress, check your bag, leave on time.' }
      ].filter(Boolean);
      var mf = fit(morning, leave);
      // slack in the morning: a short revision / quiet block, the rest as free time
      var slack = mf.slack;
      var items = mf.items;
      var readyIdx = items.length - 1;
      if (slack >= 20 && (a.role === 'school' || a.role === 'college') && a.goal === 'study') {
        var rev = R5(Math.min(30, slack));
        items.splice(readyIdx, 0, { title: 'Morning revision', cat: 'study', dur: rev, notes: 'Quick recall of yesterday’s lessons.' });
        slack -= rev;
      }
      if (slack >= 10) items.splice(items.length - 1, 0, { title: 'Free time', cat: 'free', dur: R5(slack), notes: '' });
      else if (slack > 0) items[0].dur += slack;
      pushAll(items);
      if (T) push('Travel to ' + role.short.toLowerCase(), 'routine', T, 'Leave a few minutes early — it keeps the whole day calm.');
      t = S;
      push(role.fixed, 'school', E - S, role.id === 'school' ? 'Classes, learning and school activities.' : role.id === 'college' ? 'Lectures, labs and self-study on campus.' : '');
      if (T) push('Travel back', 'routine', T);
      // --- Afternoon / evening: after travel → dinner ---
      var endClock = (W + E) % 1440;
      var afterLunch = endClock >= 690 && endClock <= 930; // finished between 11:30 and 15:30
      var dinnerStart = dayLen - tailIdeal;
      var eve = [
        { title: 'Decompress', cat: 'routine', ideal: 15, min: 5, pr: 7, notes: 'Change, wash up, sit quietly for a few minutes.' },
        afterLunch ? { title: 'Lunch', cat: 'meal', ideal: 30, min: 20, pr: 9, keep: true, notes: 'Unrushed.' } : { title: 'Snack', cat: 'meal', ideal: 15, min: 10, pr: 5, notes: 'Fruit, roasted chana, curd or a sandwich.' },
        afterLunch ? { title: 'Rest / free time', cat: 'free', ideal: 40, min: 15, pr: 3, notes: 'Hobby, play, family — no screen needed.' } : null,
        exEvening ? { title: exTitle, cat: 'exercise', ideal: a.exMin, min: 15, pr: 5, notes: exNotes } : null,
        exEvening ? { title: 'Cool down & freshen up', cat: 'routine', ideal: 10, min: 5, pr: 4 } : null,
        a.goal === 'gain' && afterLunch ? { title: 'Snack', cat: 'meal', ideal: 15, min: 10, pr: 5, notes: 'An extra meal helps you gain: milk, peanuts, banana, eggs or paneer.' } : null
      ].filter(Boolean).concat(studyItems(a.studyMin, a.role)).concat([
        { title: 'Screen time', cat: 'screen', ideal: a.role === 'school' ? 30 : 45, min: 0, pr: 2, notes: 'Kept to its own window so it doesn’t spill into rest or study.' }
      ]);
      var budget = dinnerStart - t;
      if (budget < 0) {
        // late finish: shrink the after-dinner time first
        tail.forEach(function (x) { if (!x.keep) x.ideal = 0; });
        budget = dayLen - tail.reduce(function (x, y) { return x + y.ideal; }, 0) - t;
      }
      var ef = fit(eve, Math.max(0, budget));
      pushAll(ef.items);
      if (ef.slack >= 5) push('Free time', 'free', ef.slack);
    } else {
      // --- A day without fixed hours (weekend, holiday or at home) ---
      var home = a.role === 'home' && fixedDay;
      var lunchAt = Math.max(off('12:45'), 150);
      var morn = [
        { title: 'Wake up & freshen up', cat: 'routine', ideal: 20, min: 10, pr: 9, keep: true, notes: 'Keep your wake-up time steady — it makes weekdays easier.' },
        { title: 'Plan your day', cat: 'personal', ideal: a.goal === 'discipline' ? 10 : 0, min: 5, pr: 4 },
        (exMorning || (!exEvening && a.exMin > 0)) ? { title: exTitle, cat: 'exercise', ideal: Math.min(90, (a.exMin || 30) + (home ? 0 : 15)), min: 20, pr: 5, notes: home ? exNotes : 'A longer, easier session or a sport with friends.' } : null,
        { title: 'Breakfast', cat: 'meal', ideal: 30, min: 20, pr: 9, keep: true }
      ].filter(Boolean);
      var studyToday = home ? a.studyMin : (a.role === 'school' || a.role === 'college' ? R5(Math.min(120, a.studyMin * 0.75)) : R5(Math.min(90, a.studyMin)));
      var mainTask = home ? [
        { title: 'Main tasks', cat: 'school', ideal: 90, min: 45, pr: 7, notes: 'Your most important work first, before messages.' },
        { title: 'Short break', cat: 'free', ideal: 15, min: 5, pr: 6 },
        { title: 'Main tasks', cat: 'school', ideal: 60, min: 30, pr: 6 }
      ] : [];
      var weekendNames = ['Weekly review of lessons', 'Practice & revision', 'Weak topics', 'Reading & notes'];
      var wi = 0;
      var studyWeekend = studyItems(studyToday, a.role).map(function (x) { if (x.cat === 'study' && !home && a.role !== 'work') x.title = weekendNames[wi++ % weekendNames.length]; return x; });
      var pre = morn.concat(mainTask).concat(studyWeekend);
      var mfit = fit(pre, lunchAt);
      pushAll(mfit.items);
      if (mfit.slack >= 5) push(home ? 'Chores & errands' : 'Free time', home ? 'routine' : 'free', mfit.slack, home ? '' : 'Hobby, reading, time with family.');
      push('Lunch', 'meal', 45);
      var dinnerStart2 = dayLen - tailIdeal;
      var aft = [
        { title: 'Rest', cat: 'routine', ideal: 40, min: 15, pr: 5, notes: 'A short nap (20–30 min) or quiet time.' },
        { title: home ? 'Personal time' : 'Friends, family & hobbies', cat: home ? 'personal' : 'free', ideal: 120, min: 30, pr: 3 },
        exEvening ? { title: exTitle, cat: 'exercise', ideal: a.exMin + 15, min: 20, pr: 6, notes: exNotes } : null,
        { title: 'Screen time', cat: 'screen', ideal: 60, min: 0, pr: 2 },
        home ? null : { title: 'Plan the week', cat: 'routine', ideal: 20, min: 10, pr: 4, notes: 'Look at next week’s tests, tasks and meals.' }
      ].filter(Boolean);
      var afit = fit(aft, Math.max(0, dinnerStart2 - t));
      pushAll(afit.items);
      if (afit.slack >= 5) push('Free time', 'free', afit.slack);
    }
    // --- tail to bedtime ---
    var tailFit = fit(tail, dayLen - t);
    // any spare minutes go to the time right after dinner
    if (tailFit.slack >= 5 && tailFit.items.length > 1) {
      var fr = tailFit.items.filter(function (x) { return x.cat === 'free'; })[0] || tailFit.items[1];
      fr.dur += tailFit.slack;
    }
    pushAll(tailFit.items);
    // close any rounding gap before bed with the last block
    if (blocks.length) blocks[blocks.length - 1].e = dayLen;
    var sleepH = (1440 - dayLen) / 60;
    blocks.push({ s: dayLen, e: 1440, title: 'Sleep', cat: 'sleep', notes: sleepH >= 7 ? M.fmtDur(1440 - dayLen) + ' — recovery, growth and concentration depend on it.' : 'Try to protect at least 7–8 hours.' });

    // to clock times, merging anything that got squeezed to nothing
    return blocks.filter(function (b) { return b.e - b.s >= 5 || b.cat === 'sleep'; }).map(function (b) {
      return { id: M.uid(), start: clock(W + b.s), end: clock(W + b.e), title: b.title, cat: b.cat, notes: b.notes || '', anchor: null };
    });
  }

  /* Tidy: make each block start exactly where the previous one ends */
  function tidy(blocks) {
    for (var i = 1; i < blocks.length; i++) blocks[i].start = blocks[i - 1].end;
    return blocks;
  }

  /* Times that can't make a day (e.g. school starting before you wake up) */
  function problems(a) {
    var out = [];
    var W = M.toMin(a.wake), B = M.toMin(a.bed);
    var dayLen = (B - W + 1440) % 1440;
    if (!a.wake || !a.bed || dayLen < 360) out.push('Your wake-up and bedtime leave less than 6 hours awake. Check both times.');
    if (a.start && a.end && a.role) {
      var S = (M.toMin(a.start) - W + 1440) % 1440, E = (M.toMin(a.end) - W + 1440) % 1440;
      if (S >= dayLen || E > dayLen || E <= S) out.push('Your ' + (a.role === 'work' ? 'work' : a.role === 'home' ? 'busy' : a.role) + ' hours need to fall between waking up and bedtime.');
      else {
        if (S - (a.travel || 0) < 30) out.push('You need at least 30 minutes between waking up and leaving' + (a.travel ? ' (travel is ' + a.travel + ' min)' : '') + '. Wake up earlier or change the start time.');
        if (dayLen - E - (a.travel || 0) < 75) out.push('You finish too close to bedtime to fit dinner and winding down. Check your end time or bedtime.');
      }
    }
    return out;
  }

  function build(a) {
    var bad = problems(a);
    if (bad.length) { var err = new Error(bad[0]); err.problems = bad; throw err; }
    var days = (a.days && a.days.length ? a.days : [1, 2, 3, 4, 5]).slice().sort();
    var off = [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return days.indexOf(d) < 0; });
    var role = M.ROLES.filter(function (r) { return r.id === a.role; })[0] || M.ROLES[0];
    var routines = [];
    var fixedName = role.id === 'home' ? 'Weekdays' : role.short + ' day';
    routines.push({ id: M.uid(), name: fixedName, days: days, blocks: tidy(buildDay(a, true)) });
    if (off.length) {
      var name = off.length === 1 ? M.DAY_LONG[off[0]] : off.length === 2 && off.indexOf(0) >= 0 && off.indexOf(6) >= 0 ? 'Weekend' : 'Days off';
      routines.push({ id: M.uid(), name: name, days: off, blocks: tidy(buildDay(a, false)) });
    }
    return routines;
  }

  /* Plain-language checks on the answers, shown before building */
  function check(a, age) {
    var out = [];
    var W = M.toMin(a.wake), B = M.toMin(a.bed);
    var sleep = (W - B + 1440) % 1440;
    var need = M.calc ? M.calc.sleepNeed(age) : { lo: 7, hi: 9, label: 'Adults' };
    if (sleep < need.lo * 60) out.push({ level: 'warn', text: 'That’s ' + M.fmtDur(sleep) + ' of sleep. ' + need.label + ' need ' + need.lo + '–' + need.hi + ' hours — try an earlier bedtime.' });
    if (a.role !== 'home' || a.start) {
      var toStart = (M.toMin(a.start) - W + 1440) % 1440;
      var need2 = 35 + (a.travel || 0) + (a.exWhen === 'morning' ? Math.min(a.exMin, 15) : 0);
      if (toStart < need2) out.push({ level: 'warn', text: 'Only ' + M.fmtDur(toStart) + ' between waking and starting. The morning will be very tight' + (a.exWhen === 'morning' ? ' — morning exercise may be moved or shortened.' : '.') });
      var endToBed = (B - M.toMin(a.end) + 1440) % 1440;
      if (endToBed < 180) out.push({ level: 'warn', text: 'Only ' + M.fmtDur(endToBed) + ' between finishing and bedtime, so study and free time will be short.' });
    }
    return out;
  }

  M.setup = { defaults: defaults, build: build, check: check, problems: problems, fit: fit };
})();
