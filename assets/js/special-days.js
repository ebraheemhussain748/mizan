/* Mizan — plan specific days differently
   A holiday, an exam day, a trip: pick the dates on a calendar and give them their own plan.
   A dated plan is a normal routine with `dates: ['YYYY-MM-DD', …]` and no weekdays, so every
   screen that asks "which routine is today?" (C.routineFor) picks it up and every block
   can be edited in Plan like any other. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var S = {};
  var MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var KEEP_DAYS = 90; // past special days are kept this long (the weekly review still uses them)

  /* ------------------------------------------------------------------ */
  /* Data                                                                 */
  /* ------------------------------------------------------------------ */
  S.isDated = function (r) { return !!(r && Array.isArray(r.dates)); };
  S.all = function () { return (M.state.routines || []).filter(S.isDated); };
  S.weekly = function () { return (M.state.routines || []).filter(function (r) { return !S.isDated(r); }); };
  S.forDate = function (k) { return S.all().filter(function (r) { return r.dates.indexOf(k) >= 0; })[0] || null; };
  /* special plans that still have a day today or later, soonest first */
  S.upcoming = function () {
    var t = M.today();
    return S.all().map(function (r) { var next = r.dates.filter(function (d) { return d >= t; }).sort()[0]; return { r: r, next: next }; })
      .filter(function (x) { return x.next; }).sort(function (a, b) { return a.next < b.next ? -1 : 1; }).map(function (x) { return x.r; });
  };
  S.marks = function (exceptId) {
    var out = {};
    S.all().forEach(function (r) { if (r.id !== exceptId) r.dates.forEach(function (d) { out[d] = r.name; }); });
    return out;
  };
  function uniqSorted(list) { var seen = {}; return list.filter(function (k) { if (seen[k]) return false; seen[k] = 1; return true; }).sort(); }
  /* give these dates to r (and take them from any other special plan) */
  S.setDates = function (r, dates) {
    dates = uniqSorted(dates);
    r.dates = dates; r.days = [];
    M.state.routines = M.state.routines.filter(function (o) {
      if (o === r || !S.isDated(o)) return true;
      o.dates = o.dates.filter(function (d) { return dates.indexOf(d) < 0; });
      return o.dates.length > 0;
    });
    return r;
  };
  /* a new special plan: dates + blocks → the saved routine */
  S.create = function (dates, blocks, name) {
    var r = { id: M.uid(), name: (name || '').trim() || 'Special day', days: [], dates: [], blocks: blocks.map(function (b) { var c = M.deepClone(b); c.id = M.uid(); return c; }) };
    M.state.routines.push(r);
    S.setDates(r, dates);
    return r;
  };
  S.remove = function (r) { M.state.routines = M.state.routines.filter(function (x) { return x !== r && x.id !== r.id; }); };
  /* forget special days long past */
  S.prune = function () {
    if (!M.state || !M.state.routines) return;
    var cut = M.addDays(M.today(), -KEEP_DAYS);
    M.state.routines = M.state.routines.filter(function (r) {
      if (!S.isDated(r)) return true;
      r.dates = r.dates.filter(function (d) { return d >= cut; });
      return r.dates.length > 0;
    });
  };
  /* "Thu 2 Oct" · "Thu 2 Oct, Fri 3 Oct" · "Thu 2 Oct + 4 more" (upcoming first) */
  S.label = function (dates, max, lower) {
    max = max || 3;
    var t = M.today();
    var list = uniqSorted(dates);
    var up = list.filter(function (d) { return d >= t; });
    var use = up.length ? up : list;
    var shown = use.slice(0, max).map(function (d) { return d === t ? (lower ? 'today' : 'Today') : d === M.addDays(t, 1) ? (lower ? 'tomorrow' : 'Tomorrow') : M.fmtDate(d, 'weekday'); });
    return shown.join(', ') + (use.length > max ? ' + ' + (use.length - max) + ' more' : '');
  };
  S.usualFor = function (k) {
    var wd = M.weekday(k), ws = S.weekly();
    return ws.filter(function (r) { return r.days.indexOf(wd) >= 0; })[0] || ws[0] || null;
  };
  /* the answers the timetable was built from, or sensible ones for this person */
  function answers() {
    var a = M.state.setup && M.state.setup.answers;
    if (a && a.role) return M.deepClone(a);
    var age = M.ageFrom(M.state.profile);
    var role = age !== null && age < 18 ? 'school' : age !== null && age < 23 ? 'college' : 'work';
    return M.setup.defaults(role, age);
  }
  /* wake-up and bedtime of the usual plan for that date (from its sleep block) */
  S.usualTimes = function (k) {
    var a = answers();
    var r = S.usualFor(k);
    var sl = r && r.blocks.filter(function (b) { return b.cat === 'sleep'; })[0];
    return { wake: sl ? sl.end : a.wake || '06:30', bed: sl ? sl.start : a.bed || '22:30' };
  };
  S.dayOffBlocks = function (wake, bed) {
    var a = answers();
    a.wake = wake; a.bed = bed;
    return M.setup.dayOff(a);
  };
  S.copyBlocks = function (k) {
    var r = S.usualFor(k);
    return r ? r.blocks : [];
  };
  /* problems with a wake-up / bedtime pair, or '' */
  S.timesProblem = function (wake, bed) {
    if (!wake || !bed) return 'Pick both times.';
    var awake = (M.toMin(bed) - M.toMin(wake) + 1440) % 1440;
    if (awake < 360) return 'That leaves less than 6 hours awake — check both times.';
    if (awake > 20 * 60) return 'That leaves less than 4 hours of sleep — check both times.';
    return '';
  };

  /* ------------------------------------------------------------------ */
  /* Dates typed in words: today, tomorrow, kal, parso, friday, this      */
  /* weekend, 5 Oct, Oct 5, 5/10, 5–8 Oct, 2026-10-05 …                   */
  /* → sorted list of date keys from today on                             */
  /* ------------------------------------------------------------------ */
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  var WD = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
  var MONRE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  function keyOf(y, m, d) {
    var dt = new Date(y, m, d, 12);
    if (dt.getMonth() !== m || dt.getDate() !== d) return null;
    return M.dateKey(dt);
  }
  /* a day + month with no year: this year, or next year if that date has passed */
  function upcomingKey(m, d) {
    var t = M.today(), y = +t.slice(0, 4);
    var k = keyOf(y, m, d);
    if (k && k < t) k = keyOf(y + 1, m, d);
    return k;
  }
  function rangeKeys(a, b) {
    if (!a || !b) return [];
    if (b < a) { var x = a; a = b; b = x; }
    var out = [], k = a, n = 0;
    while (k <= b && n++ < 62) { out.push(k); k = M.addDays(k, 1); }
    return out;
  }
  function nextWeekday(wd, fromTomorrow) {
    var t = M.today(), k = fromTomorrow ? M.addDays(t, 1) : t;
    for (var i = 0; i < 7; i++) { if (M.weekday(k) === wd) return k; k = M.addDays(k, 1); }
    return null;
  }
  S.parseDates = function (text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, '').replace(/(\d)(st|nd|rd|th)\b/g, '$1') + ' ';
    var out = [], m, today = M.today();
    var monIdx = function (s) { return MON[s.slice(0, 3) === 'sep' ? 'sep' : s.slice(0, 3)]; };
    // ISO dates
    t = t.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, function (all, y, mo, d) { var k = keyOf(+y, +mo - 1, +d); if (k) out.push(k); return ' '; });
    // ranges with a month name: 5-8 oct, 5 to 8 october, oct 5-8
    t = t.replace(new RegExp('\\b(\\d{1,2})\\s*(?:-|–|to|till|until|se)\\s*(\\d{1,2})\\s+' + MONRE + '\\b', 'g'), function (all, a, b, mo) { var mi = monIdx(mo); out.push.apply(out, rangeKeys(upcomingKey(mi, +a), upcomingKey(mi, +b))); return ' '; });
    t = t.replace(new RegExp('\\b' + MONRE + '\\s+(\\d{1,2})\\s*(?:-|–|to|till|until)\\s*(\\d{1,2})\\b', 'g'), function (all, mo, a, b) { var mi = monIdx(mo); out.push.apply(out, rangeKeys(upcomingKey(mi, +a), upcomingKey(mi, +b))); return ' '; });
    // lists sharing a month: 5, 6 and 9 oct
    t = t.replace(new RegExp('\\b((?:\\d{1,2}\\s*(?:,|and|&|aur)\\s*)+\\d{1,2})\\s+' + MONRE + '\\b', 'g'), function (all, list, mo) { var mi = monIdx(mo); list.split(/\s*(?:,|and|&|aur)\s*/).forEach(function (d) { var k = upcomingKey(mi, +d); if (k) out.push(k); }); return ' '; });
    // single: 5 oct / oct 5
    t = t.replace(new RegExp('\\b(\\d{1,2})\\s+' + MONRE + '\\b', 'g'), function (all, d, mo) { var k = upcomingKey(monIdx(mo), +d); if (k) out.push(k); return ' '; });
    t = t.replace(new RegExp('\\b' + MONRE + '\\s+(\\d{1,2})\\b', 'g'), function (all, mo, d) { var k = upcomingKey(monIdx(mo), +d); if (k) out.push(k); return ' '; });
    // numbers: 5/10 or 5-10 (day/month, as written in India and the UK), optional year
    t = t.replace(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/g, function (all, d, mo, y) {
      var k = y ? keyOf(+y < 100 ? 2000 + +y : +y, +mo - 1, +d) : upcomingKey(+mo - 1, +d);
      if (k) out.push(k); return ' ';
    });
    // words
    if (/\b(day after tomorrow|parso|parson)\b/.test(t)) { out.push(M.addDays(today, 2)); t = t.replace(/\b(day after tomorrow|parso|parson)\b/g, ' '); }
    if (/\b(today|aaj|tonight)\b/.test(t)) out.push(today);
    if (/\b(tomorrow|tmrw|tmr|kal)\b/.test(t)) out.push(M.addDays(today, 1));
    if (/\b(this |next |coming )?weekend\b/.test(t)) {
      var sat = nextWeekday(6, false), sun = nextWeekday(0, false);
      if (/\bnext weekend\b/.test(t) && sat) { sat = M.addDays(sat, 7); sun = M.addDays(sat, 1); }
      else if (sun && sat && sun < sat) { out.push(sun); sun = null; sat = null; } // today is Sunday: just today
      if (sat) out.push(sat); if (sun) out.push(sun);
    }
    // weekday ranges: monday to wednesday
    t = t.replace(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?s?\s*(?:-|–|to|till|until|se)\s*(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?s?\b/g, function (all, a, b) {
      var ka = nextWeekday(WD[a], false), kb = ka;
      for (var i = 0; i < 7; i++) { if (M.weekday(kb) === WD[b]) break; kb = M.addDays(kb, 1); }
      out.push.apply(out, rangeKeys(ka, kb)); return ' ';
    });
    var wre = /\b(next |this |coming )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday|rsday)?s?\b/g;
    while ((m = wre.exec(t))) {
      var k = nextWeekday(WD[m[2]], false);
      if (k && m[1] === 'next ' && k === today) k = M.addDays(k, 7);
      if (k) out.push(k);
    }
    return uniqSorted(out).filter(function (k) { return k >= today && k <= M.addDays(today, 366); });
  };

  /* ------------------------------------------------------------------ */
  /* Calendar: tap days to pick them                                      */
  /* st = { month: 'YYYY-MM', sel: [keys], marks: {key: name}, done }      */
  /* ------------------------------------------------------------------ */
  S.calState = function (sel, extra) {
    sel = uniqSorted(sel || []);
    var first = sel[0] || M.today();
    return Object.assign({ month: first.slice(0, 7), sel: sel, marks: S.marks() }, extra || {});
  };
  function monthAdd(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; var d = new Date(y, m, 1, 12); return d.getFullYear() + '-' + M.pad(d.getMonth() + 1); }
  S.calHtml = function (st) {
    var t = M.today(), max = M.addDays(t, 366);
    var y = +st.month.slice(0, 4), mo = +st.month.slice(5, 7) - 1;
    var nDays = new Date(y, mo + 1, 0).getDate();
    var lead = (new Date(y, mo, 1, 12).getDay() + 6) % 7; // Monday first
    var prevOk = st.month > t.slice(0, 7), nextOk = st.month < max.slice(0, 7);
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="cal-blank" aria-hidden="true"></span>';
    for (var d = 1; d <= nDays; d++) {
      var k = keyOf(y, mo, d), past = k < t || k > max, sel = st.sel.indexOf(k) >= 0, mark = st.marks && st.marks[k];
      var lab = M.DAY_LONG[M.weekday(k)] + ' ' + d + ' ' + MONTH_LONG[mo] + (k === t ? ', today' : '') + (mark ? ', special plan: ' + mark : '');
      cells += '<button type="button" class="cal-day' + (k === t ? ' is-today' : '') + (sel ? ' is-sel' : '') + (mark ? ' has-plan' : '') + '" data-cal-day="' + k + '" aria-pressed="' + sel + '" aria-label="' + M.esc(lab) + '"' + (past ? ' disabled' : '') + '>' + d + (mark ? '<i class="cal-dot" aria-hidden="true"></i>' : '') + '</button>';
    }
    var wd = [1, 2, 3, 4, 5, 6, 0].map(function (x) { return '<span class="cal-wd" aria-hidden="true">' + M.DAY_SHORT[x].slice(0, 2) + '</span>'; }).join('');
    var n = st.sel.length;
    return '<div class="cal" data-cal>' +
      '<div class="cal-head"><button type="button" class="icon-btn sm" data-cal-nav="-1" aria-label="Previous month"' + (prevOk ? '' : ' disabled') + '>' + M.icon('left') + '</button>' +
      '<strong class="cal-title">' + MONTH_LONG[mo] + ' ' + y + '</strong>' +
      '<button type="button" class="icon-btn sm" data-cal-nav="1" aria-label="Next month"' + (nextOk ? '' : ' disabled') + '>' + M.icon('right') + '</button></div>' +
      '<div class="cal-grid" role="group" aria-label="' + MONTH_LONG[mo] + ' ' + y + ' — tap days to pick them">' + wd + cells + '</div>' +
      '<div class="cal-quick" role="group" aria-label="Quick picks"><button type="button" class="chip" data-cal-quick="today">Today</button><button type="button" class="chip" data-cal-quick="tomorrow">Tomorrow</button><button type="button" class="chip" data-cal-quick="weekend">This weekend</button>' + (n ? '<button type="button" class="chip" data-cal-quick="clear">Clear</button>' : '') + '</div>' +
      '<p class="cal-sum" aria-live="polite">' + (n ? '<strong>' + n + ' ' + M.plural(n, 'day') + ':</strong> ' + M.esc(S.label(st.sel, 4)) : 'No days picked yet — tap the days to plan differently.') + '</p>' +
      (Object.keys(st.marks || {}).length ? '<p class="cal-legend"><i class="cal-dot" aria-hidden="true"></i>Already has a special plan</p>' : '') +
      (st.done ? '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-cal-done' + (n ? '' : ' disabled') + '>' + M.esc(st.done) + '</button></div>' : '') +
      '</div>';
  };
  /* handle a click inside a calendar; returns true when st changed (re-draw it) */
  S.calClick = function (e, st) {
    var b = e.target.closest('[data-cal-nav],[data-cal-day],[data-cal-quick]');
    if (!b || b.disabled) return false;
    if (b.hasAttribute('data-cal-nav')) { st.month = monthAdd(st.month, +b.getAttribute('data-cal-nav')); return true; }
    if (b.hasAttribute('data-cal-day')) {
      var k = b.getAttribute('data-cal-day'), i = st.sel.indexOf(k);
      if (i >= 0) st.sel.splice(i, 1); else st.sel.push(k);
      st.sel.sort();
      M.haptic && M.haptic("tap");
      return true;
    }
    var q = b.getAttribute('data-cal-quick'), t = M.today(), add = [];
    if (q === 'clear') { st.sel = []; return true; }
    if (q === 'today') add = [t];
    if (q === 'tomorrow') add = [M.addDays(t, 1)];
    if (q === 'weekend') add = S.parseDates('this weekend');
    add.forEach(function (k) { if (st.sel.indexOf(k) < 0) st.sel.push(k); });
    st.sel.sort();
    if (add.length) st.month = add[0].slice(0, 7);
    return true;
  };
  /* re-draw the calendar inside root, keeping focus on the same button */
  S.calRedraw = function (root, st) {
    var old = root.querySelector('[data-cal]');
    if (!old) return;
    var a = document.activeElement, key = a && a.closest && a.closest('[data-cal]') ? (a.getAttribute('data-cal-day') ? '[data-cal-day="' + a.getAttribute('data-cal-day') + '"]' : a.getAttribute('data-cal-nav') ? '[data-cal-nav="' + a.getAttribute('data-cal-nav') + '"]' : a.getAttribute('data-cal-quick') ? '[data-cal-quick="' + a.getAttribute('data-cal-quick') + '"]' : null) : null;
    var tmp = document.createElement('div');
    tmp.innerHTML = S.calHtml(st);
    old.parentNode.replaceChild(tmp.firstChild, old);
    if (key) { var nb = root.querySelector('[data-cal] ' + key); if (nb && !nb.disabled) nb.focus(); }
  };

  /* ------------------------------------------------------------------ */
  /* The planner sheet: 1) pick days  2) how to plan them                  */
  /* ------------------------------------------------------------------ */
  var WAYS = [
    { id: 'off', title: 'Day off / holiday', desc: 'No school or work. Pick your wake-up and bedtime — Mizan fills in the rest.', name: 'Day off' },
    { id: 'copy', title: 'Copy my usual day and change it', desc: 'Start from the plan you’d normally follow and edit only what’s different.', name: 'Special day' },
    { id: 'chat', title: 'Build it step by step with ' + 'Mizo', desc: 'Say what you’ll do and until when, block by block — like the custom timetable.', name: 'Special day' }
  ];
  function botName() { return (M.state.settings.assistant && M.state.settings.assistant.name) || 'Mizo'; }

  S.open = function (pre, opts) {
    opts = opts || {};
    var st = S.calState(pre || [], { done: null });
    var step = 1, way = opts.way || 'off', times = null;
    var dlg = M.sheet({
      title: 'Plan specific days',
      body: '<div class="sd-body"></div>',
      foot: '<div class="sd-foot btn-row" style="width:100%"></div>',
      noAutofocus: true,
      onOpen: function (d) {
        draw(d);
        d.addEventListener('click', function (e) {
          if (S.calClick(e, st)) { S.calRedraw(d, st); syncFoot(d); return; }
          var a = e.target.closest('[data-sd]');
          if (!a) return;
          var act = a.getAttribute('data-sd');
          if (act === 'next') { if (!st.sel.length) return; step = 2; times = S.usualTimes(st.sel[0]); draw(d); }
          else if (act === 'back') { step = 1; draw(d); }
          else if (act === 'make') make(d);
        });
        d.addEventListener('change', function (e) {
          if (e.target.name === 'way') { way = e.target.value; var o = d.querySelector('.sd-off'); if (o) o.hidden = way !== 'off'; var n = d.querySelector('input[name=sdname]'); if (n && !n.dataset.touched) n.value = defaultName(); }
        });
        d.addEventListener('input', function (e) { if (e.target.name === 'sdname') e.target.dataset.touched = '1'; });
      }
    });
    function defaultName() { return (WAYS.filter(function (w) { return w.id === way; })[0] || WAYS[0]).name; }
    function syncFoot(d) { var n = d.querySelector('[data-sd=next]'); if (n) n.disabled = !st.sel.length; }
    function draw(d) {
      var body = d.querySelector('.sd-body'), foot = d.querySelector('.sd-foot');
      if (step === 1) {
        body.innerHTML = '<p class="soft" style="margin-top:0">Tap the days you want to plan differently — a holiday, an exam, a trip. On those days this plan replaces your usual one; every other day stays the same.</p>' + S.calHtml(st);
        foot.innerHTML = '<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-sd="next"' + (st.sel.length ? '' : ' disabled') + '>Next' + M.icon('right') + '</button>';
        var first = body.querySelector('.cal-day:not([disabled])'); if (first && !opts.noFocus) setTimeout(function () { try { (body.querySelector('.cal-day.is-sel') || first).focus(); } catch (e) { /* ignore */ } }, 40);
      } else {
        var replaced = st.sel.filter(function (k) { return st.marks[k]; });
        var usual = S.usualFor(st.sel[0]);
        body.innerHTML = '<p class="soft" style="margin-top:0">Planning <strong>' + M.esc(S.label(st.sel, 4)) + '</strong>.</p>' +
          '<form class="stack sd-form" novalidate><fieldset class="field"><legend class="label">How do you want to plan ' + (st.sel.length > 1 ? 'them' : 'it') + '?</legend><div class="choice-grid">' +
          WAYS.map(function (w) {
            var desc = w.id === 'copy' && usual ? 'Start from “' + usual.name + '” and edit only what’s different.' : w.id === 'chat' ? 'Tell ' + botName() + ' what you’ll do and until when, block by block.' : w.desc;
            var title = w.id === 'chat' ? 'Build it step by step with ' + botName() : w.title;
            return '<label class="choice block"><input type="radio" name="way" value="' + w.id + '"' + (w.id === way ? ' checked' : '') + '><span><strong>' + M.esc(title) + '</strong></span><small>' + M.esc(desc) + '</small></label>';
          }).join('') + '</div></fieldset>' +
          '<div class="sd-off form-grid"' + (way === 'off' ? '' : ' hidden') + '><div class="field"><label for="sd-wake">Wake up at</label><input class="input" id="sd-wake" type="time" name="wake" value="' + times.wake + '"></div>' +
          '<div class="field"><label for="sd-bed">Go to bed at</label><input class="input" id="sd-bed" type="time" name="bed" value="' + times.bed + '"></div></div>' +
          '<div class="field"><label for="sd-name">Name</label><input class="input" id="sd-name" name="sdname" maxlength="40" value="' + M.esc(defaultName()) + '"></div>' +
          '<p class="field-err sd-err" role="alert" hidden></p>' +
          (replaced.length ? U().note('info', '<p>' + M.esc(S.label(replaced, 3)) + ' already ' + (replaced.length > 1 ? 'have' : 'has') + ' a special plan — this one replaces it on ' + (replaced.length > 1 ? 'those days' : 'that day') + '.</p>') : '') +
          '</form>';
        foot.innerHTML = '<button type="button" class="btn btn-ghost" data-sd="back">' + M.icon('left') + 'Days</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-sd="make">' + M.icon('check') + 'Plan ' + (st.sel.length > 1 ? 'these days' : 'this day') + '</button>';
      }
    }
    function make(d) {
      var f = M.formData(d.querySelector('.sd-form'));
      var err = d.querySelector('.sd-err');
      var name = (f.sdname || '').trim() || defaultName();
      way = f.way || way;
      if (way === 'off') {
        var p = S.timesProblem(f.wake, f.bed);
        if (p) { err.textContent = p; err.hidden = false; M.haptic('error'); return; }
        var r = S.create(st.sel, S.dayOffBlocks(f.wake, f.bed), name);
        done(d, r, '“' + name + '” planned for ' + S.label(r.dates, 2, true) + '. Tap any block to change it.');
      } else if (way === 'copy') {
        var r2 = S.create(st.sel, S.copyBlocks(st.sel[0]), name);
        done(d, r2, 'Copied your usual day to ' + S.label(r2.dates, 2, true) + ' — change what’s different.');
      } else {
        d.close();
        if (M.assistant) M.assistant.startBuilder({ dates: st.sel.slice(), name: name });
      }
    }
    function done(d, r, msg) {
      M.save(true); d.close(); M.haptic('success');
      if (opts.onDone) opts.onDone(r);
      M.planSelect = r.id;
      if (M.currentRoute && M.currentRoute.name === 'plan') M.refresh(); else M.go('plan');
      M.flashAfterRender('.pg-head');
      M.toast(msg);
    }
    return dlg;
  };
  function U() { return M.ui; }

  /* settings for one special plan: name, its days, delete */
  S.settings = function (r, after) {
    var st = S.calState(r.dates, { marks: S.marks(r.id) });
    M.sheet({
      title: 'Special plan settings',
      body: '<form class="stack sd-set" novalidate><div class="field"><label for="sd-rn">Name</label><input class="input" id="sd-rn" name="name" maxlength="40" value="' + M.esc(r.name) + '"></div>' +
        '<div class="field"><span class="label">Days it’s used on</span>' + S.calHtml(st) + '</div><p class="field-err sd-err" role="alert" hidden></p></form>',
      foot: '<button type="button" class="btn btn-danger" data-del>' + M.icon('trash') + 'Delete</button><span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.addEventListener('click', function (e) { if (S.calClick(e, st)) S.calRedraw(dlg, st); });
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          if (!st.sel.length) { var er = dlg.querySelector('.sd-err'); er.textContent = 'Pick at least one day — or delete this plan.'; er.hidden = false; M.haptic('error'); return; }
          r.name = (M.formData(dlg.querySelector('.sd-set')).name || '').trim() || r.name;
          // keep past days it already covered (history), replace the rest with the picked ones
          var t = M.today();
          S.setDates(r, r.dates.filter(function (k) { return k < t; }).concat(st.sel));
          M.save(); dlg.close('ok'); M.haptic('success');
          if (after) after('saved');
        });
        dlg.querySelector('[data-del]').addEventListener('click', function () {
          dlg.close();
          M.confirm('Delete “' + r.name + '”?', 'Those days go back to your usual timetable.', 'Delete', true).then(function (ok) {
            if (!ok) return;
            S.remove(r); M.save(); M.toast('Special plan deleted');
            if (after) after('deleted');
          });
        });
      }
    });
  };

  M.special = S;
})();
