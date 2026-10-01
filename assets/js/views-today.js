/* Mizan — Today */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var tick = null;

  function greeting() { return M.greeting(); }

  function checkinsFor(k) { return M.state.checkins[k] || (M.state.checkins[k] = {}); }

  M.setCheckin = function (dateKey, blockId, status) {
    var c = checkinsFor(dateKey);
    if (c[blockId] && c[blockId].s === status) delete c[blockId];
    else c[blockId] = { s: status, t: Date.now() };
    M.save();
  };

  M.askMissReason = function (dateKey, block, done) {
    var body = '<p class="soft">Missing once doesn’t undo your progress — what matters is getting back to it next time. A quick note helps you spot patterns in your weekly review.</p>' +
      '<div class="field"><span class="label">What got in the way?</span><div class="choice-row">' +
      M.MISS_REASONS.map(function (r) { return '<label class="choice"><input type="radio" name="reason" value="' + M.esc(r) + '"><span>' + M.esc(r) + '</span></label>'; }).join('') +
      '</div></div>' +
      '<div class="field" style="margin-top:14px"><label for="miss-plan">If it happens again, I will…</label><input class="input" id="miss-plan" name="plan" maxlength="140" placeholder="e.g. keep my phone in the kitchen during study"></div>';
    M.sheet({
      title: 'Skipped: ' + block.title,
      body: '<form>' + body + '</form>',
      foot: '<button type="button" class="btn btn-ghost" data-close>No note</button><button type="button" class="btn btn-primary" data-save>Save note</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          var d = M.formData(dlg.querySelector('form'));
          if (d.reason || d.plan) {
            (M.state.misses[dateKey] = M.state.misses[dateKey] || []).push({ block: block.id, title: block.title, cat: block.cat, reason: d.reason || 'Other', plan: (d.plan || '').trim() });
            M.save();
            M.toast('Noted. Next one is a fresh start.');
          }
          dlg.close('ok');
        });
      },
      onClose: function () { if (done) done(); }
    });
  };

  function blockSheet(dateKey, r, after) {
    var b = r.b;
    var c = checkinsFor(dateKey)[b.id];
    var st = c ? c.s : '';
    var body = '<div class="stack">' +
      '<div class="row wrap">' + U.catChip(b.cat) + '<span class="badge">' + M.icon('clock') + M.fmtTime(r.start) + '–' + M.fmtTime(r.end) + ' · ' + M.fmtDurShort(r.dur) + '</span>' + (r.anchored ? '<span class="badge accent">' + M.icon('sun') + 'Follows ' + M.esc(M.sun.anchorLabel(b.anchor.to)) + '</span>' : '') + '</div>' +
      (b.notes ? '<p class="soft" style="white-space:pre-line;margin:0">' + M.esc(b.notes) + '</p>' : '') +
      '<div class="checkin" role="group" aria-label="Check in">' +
      '<button type="button" class="btn" data-s="done" aria-pressed="' + (st === 'done') + '">' + M.icon('check') + 'Done</button>' +
      '<button type="button" class="btn" data-s="partial" aria-pressed="' + (st === 'partial') + '">' + M.icon('half') + 'Half done</button>' +
      '<button type="button" class="btn" data-s="skipped" aria-pressed="' + (st === 'skipped') + '">' + M.icon('skip') + 'Skipped</button>' +
      '</div></div>';
    M.sheet({
      title: b.title, body: body,
      foot: '<a class="btn btn-ghost" href="#/plan" data-close>' + M.icon('edit') + 'Edit in Plan</a><span class="spacer"></span><button type="button" class="btn" data-close>Close</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        M.$$('[data-s]', dlg).forEach(function (btn) {
          btn.addEventListener('click', function () {
            var s = btn.getAttribute('data-s');
            var wasSame = checkinsFor(dateKey)[b.id] && checkinsFor(dateKey)[b.id].s === s;
            M.setCheckin(dateKey, b.id, s);
            M.haptic(s === 'done' ? 'success' : s === 'skipped' ? 'warning' : 'select');
            M.flashAfterRender('[data-row-tl="' + b.id + '"] .status-dot', 'pop');
            dlg.close('ok');
            if (s === 'skipped' && !wasSame) M.askMissReason(dateKey, b, after);
            else if (after) after();
          });
        });
      }
    });
  }
  M.blockSheet = blockSheet;

  function waterPanel(k) {
    var p = M.state.profile;
    var w = M.latestWeight();
    var goalL = M.state.settings.waterGoalMl ? M.state.settings.waterGoalMl / 1000 : M.calc.waterGoal(p, w || 60, 0, false).goal;
    var glass = M.state.settings.glassMl || 250;
    var goalGlasses = Math.max(4, Math.round(goalL * 1000 / glass));
    var ml = M.state.water[k] || 0;
    var n = Math.round(ml / glass);
    var pct = M.clamp(n / goalGlasses * 100, 0, 100);
    return '<div class="panel"><div class="panel-title"><h3>' + 'Water' + '</h3><a class="btn btn-sm btn-ghost" href="#/body/tools/water">Goal</a></div>' +
      '<div class="row between"><div class="stat"><span class="value water-count">' + n + '<small>of ' + goalGlasses + ' glasses</small></span><span class="sub">' + M.fmt(ml / 1000, 2) + ' L · ' + glass + ' ml per glass</span></div>' +
      '<div class="row"><button type="button" class="icon-btn" data-action="water-minus" aria-label="Remove a glass">' + M.icon('minus') + '</button><button type="button" class="btn btn-primary" data-action="water-plus" aria-label="Add a glass of water">' + M.icon('water') + '+1</button></div></div>' +
      '<div class="meter accent" style="margin-top:12px" role="img" aria-label="' + n + ' of ' + goalGlasses + ' glasses"><span style="width:' + pct + '%"></span></div></div>';
  }

  function habitsPanel(k) {
    var wd = M.weekday(k);
    var hs = M.state.habits.filter(function (h) { return !h.archived && h.days.indexOf(wd) >= 0; });
    if (!hs.length) {
      return '<div class="panel"><div class="panel-title"><h3>Habits</h3></div><p class="muted" style="margin:0 0 12px">Small daily habits, each tied to a cue you already have.</p><a class="btn" href="#/habits">' + M.icon('plus') + 'Add a habit</a></div>';
    }
    var log = M.state.habitLog[k] || [];
    var done = hs.filter(function (h) { return log.indexOf(h.id) >= 0; }).length;
    return '<div class="panel"><div class="panel-title"><h3>Habits</h3><span class="badge">' + done + ' of ' + hs.length + '</span></div><ul class="list">' +
      hs.map(function (h) {
        var on = log.indexOf(h.id) >= 0;
        return '<li><button type="button" class="habit-check" style="width:40px;height:40px;border-radius:12px" data-action="habit-toggle" data-id="' + M.esc(h.id) + '" aria-pressed="' + on + '" aria-label="' + M.esc(h.name) + (on ? ', done' : ', not done') + '">' + M.icon('check') + '</button>' +
          '<div class="li-main"><strong>' + M.esc(h.name) + '</strong><span>' + M.esc(h.cue) + '</span></div></li>';
      }).join('') + '</ul></div>';
  }

  /* Sunrise / sunset for today — only when the person turned them on */
  function timesStrip() {
    if (!M.sun.active()) return '';
    var list = M.sun.times(M.today());
    var nx = M.sun.next();
    if (!list.length || !nx) return '';
    var place = M.state.settings.sun.place;
    return '<div class="panel tint times-strip"><div class="row between wrap"><div class="row">' + M.icon('sun', 'style="width:22px;height:22px;color:var(--sun)"') +
      '<div><span class="muted" style="font-size:var(--fs-xs);font-weight:700;text-transform:uppercase;letter-spacing:.04em">Sun times</span><strong style="display:block">' + M.esc(nx.item.label) + ' at ' + M.fmtTime(nx.item.at) + '</strong><div class="muted" style="font-size:var(--fs-sm)">in ' + M.fmtDur(nx.inMin) + (place ? ' · ' + M.esc(place) : '') + '</div></div></div>' +
      '<div class="row wrap" style="gap:6px">' + list.map(function (p) {
        return '<span class="badge' + (p.id === nx.item.id ? ' accent' : '') + '">' + M.esc(p.label) + ' ' + M.fmtTime(p.at, false) + '</span>';
      }).join('') + '</div></div></div>';
  }

  function workoutToday(k) {
    var wp = M.state.workoutPlan;
    if (!wp) return null;
    var wd = M.weekday(k);
    var idx = wp.days.indexOf(wd);
    if (idx < 0) return null;
    return { idx: idx, session: wp.sessions[idx % wp.sessions.length] };
  }

  M.views.day = {
    head: function () {
      var k = M.today();
      var r = M.calc.routineFor(k);
      return { title: 'My whole day', sub: M.fmtDate(k) + (r ? ' · ' + r.name : '') };
    },
    render: function (el) {
      var k = M.today();
      var routine = M.calc.routineFor(k);
      if (!routine || !routine.blocks.length) {
        el.innerHTML = '<div class="empty">' + M.icon('plan') + '<p><strong>No plan for today yet.</strong></p><p>Make a timetable and this page shows where you are in it.</p><a class="btn btn-primary" href="#/plan">Open Plan</a></div>';
        return;
      }
      var res = M.calc.resolveBlocks(routine, k);
      var now = M.nowMin();
      var loc = M.calc.locate(res, now);
      var ci = checkinsFor(k);
      var tmap = M.sun.timeMap(k);
      var sun = tmap.sunrise !== undefined ? { rise: tmap.sunrise, set: tmap.sunset } : null;
      var cur = loc.cur;

      var clock = M.fmtTime(now, false);
      var suffix = M.state.settings.clock === '12' ? (now < 720 ? 'am' : 'pm') : '';
      var center = '<div class="dial-center"><div class="clock">' + clock + (suffix ? '<small>' + suffix + '</small>' : '') + '</div>' +
        (cur ? '<div class="now-title">' + M.esc(cur.b.title) + '</div><div class="now-left">' + M.fmtDur(loc.left) + ' left</div>'
          : '<div class="now-title">Unplanned time</div>' + (loc.next ? '<div class="now-left">' + M.esc(loc.next.b.title) + ' in ' + M.fmtDur(loc.untilNext) + '</div>' : '')) + '</div>';

      var nowCard;
      if (cur) {
        var st = ci[cur.b.id] ? ci[cur.b.id].s : '';
        var pct = M.clamp(loc.elapsed / cur.dur * 100, 0, 100);
        var wt = cur.b.cat === 'exercise' ? workoutToday(k) : null;
        nowCard = '<article class="now-card" style="--cat:' + M.catVar(cur.b.cat) + '" aria-labelledby="now-h">' +
          '<div class="when">Now · ' + M.fmtTime(cur.start) + '–' + M.fmtTime(cur.end) + ' · ' + M.esc(M.cat(cur.b.cat).label) + '</div>' +
          '<h2 id="now-h">' + M.esc(cur.b.title) + '</h2>' +
          (cur.b.notes ? '<p class="notes">' + M.esc(cur.b.notes) + '</p>' : '') +
          '<div class="progress"><div class="meter accent" role="img" aria-label="' + Math.round(pct) + '% of this block done"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
          '<div class="row between muted" style="font-size:var(--fs-sm);margin-top:6px"><span>' + M.fmtDur(loc.elapsed) + ' in</span><span>' + M.fmtDur(loc.left) + ' left</span></div></div>' +
          '<div class="checkin" role="group" aria-label="Check in for ' + M.esc(cur.b.title) + '">' +
          '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="done" aria-pressed="' + (st === 'done') + '">' + M.icon('check') + 'Done</button>' +
          '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="partial" aria-pressed="' + (st === 'partial') + '">' + M.icon('half') + 'Half done</button>' +
          '<button type="button" class="btn" data-action="ci" data-id="' + M.esc(cur.b.id) + '" data-s="skipped" aria-pressed="' + (st === 'skipped') + '">' + M.icon('skip') + 'Skipped</button></div>' +
          (cur.b.cat === 'study' ? '<button type="button" class="btn btn-ink btn-block" style="margin-top:12px" data-action="focus" data-label="' + M.esc(cur.b.title) + '">' + M.icon('timer') + 'Start focus timer</button>' : '') +
          (wt ? '<a class="btn btn-ink btn-block" style="margin-top:12px" href="#/body/workouts">' + M.icon('dumbbell') + 'Open today’s workout: ' + M.esc(wt.session.name) + '</a>' : '') +
          '</article>';
      } else {
        nowCard = '<article class="now-card"><div class="when">Right now</div><h2>Unplanned time</h2><p class="notes">Nothing is scheduled for this moment. ' + (loc.next ? 'Next up is <strong>' + M.esc(loc.next.b.title) + '</strong> at ' + M.fmtTime(loc.next.start) + '.' : '') + '</p><a class="btn" href="#/plan">' + M.icon('plus') + 'Fill this gap</a></article>';
      }

      // next three blocks that haven't started yet (skips anything already in progress)
      var upcoming = res.filter(function (r) {
        if (cur && r === cur) return false;
        var inside = r.start < r.end ? (now >= r.start && now < r.end) : (now >= r.start || now < r.end);
        return !inside;
      }).sort(function (a, b) { return ((a.start - now + 1440) % 1440) - ((b.start - now + 1440) % 1440); }).slice(0, 3);
      var nextHtml = '<div class="panel"><div class="panel-title"><h3>Up next</h3><button type="button" class="btn btn-sm btn-ghost" data-action="focus">' + M.icon('timer') + 'Focus timer</button></div><ul class="list">' +
        upcoming.map(function (r) {
          var inMin = (r.start - now + 1440) % 1440;
          return '<li><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + M.catVar(r.b.cat) + ';flex-shrink:0" aria-hidden="true"></span><div class="li-main"><strong>' + M.esc(r.b.title) + '</strong><span>' + M.fmtTime(r.start) + ' · ' + M.fmtDurShort(r.dur) + '</span></div><span class="muted nowrap" style="font-size:var(--fs-sm)">in ' + M.fmtDurShort(inMin) + '</span></li>';
        }).join('') + '</ul></div>';

      // timeline
      var doneCount = 0, totalPast = 0;
      var tl = res.map(function (r) {
        var c = ci[r.b.id];
        var isNow = cur && cur.b.id === r.b.id;
        var isPast = r.start < r.end ? r.end <= now : false;
        if (isPast || isNow) { totalPast++; if (c && c.s === 'done') doneCount++; }
        var s = c ? c.s : '';
        var ico = s === 'done' ? M.icon('check') : s === 'partial' ? M.icon('half') : s === 'skipped' ? M.icon('x') : '';
        return '<li data-row-tl="' + M.esc(r.b.id) + '" class="' + (isNow ? 'is-now' : isPast ? 'is-past' : '') + '" style="--cat:' + M.catVar(r.b.cat) + '">' +
          '<span class="t-time">' + M.fmtTime(r.start) + '</span><span class="t-bar" aria-hidden="true"></span>' +
          '<button type="button" class="t-body" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;color:inherit" data-action="block" data-id="' + M.esc(r.b.id) + '"><strong>' + M.esc(r.b.title) + '</strong><span>' + M.fmtDurShort(r.dur) + ' · ' + M.esc(M.cat(r.b.cat).label) + (r.anchored ? ' · follows ' + M.esc(M.sun.anchorLabel(r.b.anchor.to)) : '') + '</span></button>' +
          '<span class="t-status"><span class="status-dot ' + s + '" role="img" aria-label="' + (s ? { done: 'Done', partial: 'Half done', skipped: 'Skipped' }[s] : 'Not checked in') + '">' + ico + '</span></span></li>';
      }).join('');

      var focusMin = M.state.focus[k] || 0;
      el.innerHTML =
        '<section class="today-hero" aria-label="Your day">' +
        '<div><div class="dial-wrap">' + U.dial(res, { nowMin: now, isToday: true, checkins: ci, sun: sun }) + center + '</div>' +
        '<div class="dial-legend" aria-hidden="true"><span><i style="background:var(--ink-2)"></i>Done</span><span><i style="background:var(--now)"></i>Now</span><span><i style="background:var(--future)"></i>Upcoming</span><span><i style="background:var(--past);height:3px"></i>Not checked</span></div></div>' +
        '<div class="stack">' + nowCard + nextHtml + '</div></section>' +
        (timesStrip() ? '<div style="margin-top:20px">' + timesStrip() + '</div>' : '') +
        '<div class="grid-2" style="margin-top:20px">' + habitsPanel(k) + waterPanel(k) + '</div>' +
        '<div class="grid-2" style="margin-top:16px">' +
        '<div class="panel"><div class="panel-title"><h3>Weight</h3><a class="btn btn-sm btn-ghost" href="#/body">Details</a></div>' + bodyMini() + '</div>' +
        '<div class="panel"><div class="panel-title"><h3>Today so far</h3></div><div class="stats">' +
        '<div class="stat"><span class="label">Blocks done</span><span class="value">' + doneCount + '<small>of ' + totalPast + ' so far</small></span></div>' +
        '<div class="stat"><span class="label">Focus time</span><span class="value">' + M.fmtDurShort(focusMin) + '</span></div></div></div>' +
        '</div>' +
        '<section style="margin-top:28px" aria-labelledby="tl-h"><div class="section-head"><div><h2 id="tl-h">Full day</h2><p>' + M.esc(routine.name) + ' · tap a block to check in</p></div><a class="btn btn-sm" href="#/plan">' + M.icon('edit') + 'Edit</a></div>' +
        '<div class="panel"><ol class="timeline">' + tl + '</ol></div></section>';

      U.bindDial(M.$('.dial-wrap', el), res, function (id) {
        var r = res.filter(function (x) { return x.b.id === id; })[0];
        if (r) blockSheet(k, r, M.refresh);
      });

      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'ci') {
          var id = a.getAttribute('data-id'), s = a.getAttribute('data-s');
          var was = ci[id] && ci[id].s === s;
          M.setCheckin(k, id, s);
          M.haptic(s === 'done' ? 'success' : s === 'skipped' ? 'warning' : 'select');
          M.flashAfterRender('.checkin [aria-pressed="true"], [data-row-tl="' + id + '"] .status-dot', 'pop');
          var blk = res.filter(function (x) { return x.b.id === id; })[0];
          if (s === 'skipped' && !was && blk) M.askMissReason(k, blk.b, M.refresh);
          else { M.refresh(); if (s === 'done' && !was) M.toast('Nice — checked in.'); }
        } else if (act === 'block') {
          var r = res.filter(function (x) { return x.b.id === a.getAttribute('data-id'); })[0];
          if (r) blockSheet(k, r, M.refresh);
        } else if (act === 'focus') {
          U.focusTimer(a.getAttribute('data-label') || '');
        } else if (act === 'water-plus' || act === 'water-minus') {
          M.water.add(act === 'water-plus' ? 1 : -1);
          M.flashAfterRender('.water-count', 'pop');
          M.refresh();
        } else if (act === 'habit-toggle') {
          var hid = a.getAttribute('data-id');
          var nowOn = a.getAttribute('aria-pressed') !== 'true';
          M.toggleHabit(k, hid);
          if (nowOn) { M.haptic('success'); M.flashAfterRender('.habit-check[data-id="' + hid + '"]', 'pop'); }
          M.refresh();
        } else if (act === 'log-weight') {
          U.weightSheet(M.refresh);
        }
      });

      clearInterval(tick);
      var lastMin = Math.floor(now);
      tick = setInterval(function () {
        if (document.hidden) return;
        if (M.currentRoute && M.currentRoute.name === 'day' && Math.floor(M.nowMin()) !== lastMin && !document.querySelector('dialog[open]')) {
          if (M.today() !== k) { M.render(true); return; }
          M.render(true);
        }
      }, 20000);
    },
    leave: function () { clearInterval(tick); }
  };

  function bodyMini() {
    var w = M.latestWeight();
    var series = M.calc.trend(M.state.weights);
    var rate = M.calc.weeklyRate(series);
    var p = M.state.profile;
    var age = M.ageFrom(p);
    if (!w) return '<p class="muted" style="margin:0 0 12px">Log your weight to see a smoothed trend instead of daily ups and downs.</p><button type="button" class="btn" data-action="log-weight">' + M.icon('scale') + 'Log weight</button>';
    var last = series[series.length - 1];
    return '<div class="row between wrap"><div class="stat"><span class="label">Average weight ' + M.help('The average of your recent weigh-ins. It smooths out daily ups and downs from water and food, so you see the real direction.', 'average weight') + '</span><span class="value">' + M.showW(last.trend) + '<small>' + M.wUnit() + '</small></span>' +
      (rate !== null ? '<span class="sub">' + (rate > 0 ? '+' : '') + M.showW(rate, 2) + ' ' + M.wUnit() + ' per week</span>' : '<span class="sub">A trend appears after a week of weigh-ins</span>') + '</div>' +
      '<button type="button" class="btn" data-action="log-weight">' + M.icon('plus') + 'Log</button></div>' +
      (age !== null && age < 18 ? '<p class="hint muted" style="margin-top:10px">While you’re growing, weight going up is normal. Focus on energy, strength and sleep.</p>' : '');
  }
})();
