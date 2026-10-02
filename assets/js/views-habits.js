/* Mizan — Habits and Weekly review */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;

  M.toggleHabit = function (k, id) {
    var log = M.state.habitLog[k] || (M.state.habitLog[k] = []);
    var i = log.indexOf(id);
    if (i >= 0) log.splice(i, 1); else log.push(id);
    if (!log.length) delete M.state.habitLog[k];
    M.save();
    return i < 0;
  };
  function isDone(k, id) { var l = M.state.habitLog[k]; return !!(l && l.indexOf(id) >= 0); }

  function stats(h, today) {
    var created = h.created || today;
    var weekKeys = M.weekKeys(today);
    var wkSched = 0, wkDone = 0;
    weekKeys.forEach(function (k) {
      if (k > today || k < created) return;
      if (h.days.indexOf(M.weekday(k)) >= 0) { wkSched++; if (isDone(k, h.id)) wkDone++; }
    });
    var s28 = 0, d28 = 0;
    for (var i = 0; i < 28; i++) {
      var k = M.addDays(today, -i);
      if (k < created) break;
      if (h.days.indexOf(M.weekday(k)) >= 0) { s28++; if (isDone(k, h.id)) d28++; }
    }
    // never miss twice: was the last scheduled day before today missed?
    var lastSched = null;
    for (var j = 1; j < 8; j++) {
      var kk = M.addDays(today, -j);
      if (kk < created) break;
      if (h.days.indexOf(M.weekday(kk)) >= 0) { lastSched = kk; break; }
    }
    var missedLast = lastSched && !isDone(lastSched, h.id);
    var age = Math.max(1, M.daysBetween(created, today) + 1);
    var totalDone = 0;
    Object.keys(M.state.habitLog).forEach(function (k) { if (M.state.habitLog[k].indexOf(h.id) >= 0) totalDone++; });
    return { wkSched: wkSched, wkDone: wkDone, pct28: s28 ? Math.round(d28 / s28 * 100) : null, missedLast: missedLast, age: age, totalDone: totalDone };
  }

  function habitSheet(h) {
    var isNew = !h;
    h = h ? M.deepClone(h) : { id: M.uid(), name: '', cue: '', place: '', backup: '', why: '', days: [0, 1, 2, 3, 4, 5, 6], cat: 'routine', created: M.today(), archived: false };
    var order = [1, 2, 3, 4, 5, 6, 0];
    var body = '<form class="stack" novalidate>' +
      (isNew ? '<div class="field"><span class="label">Ideas to start with</span><div class="choice-row">' + M.habitIdeas().map(function (x, i) { return '<button type="button" class="chip" data-idea="' + i + '">' + M.esc(x.name) + '</button>'; }).join('') + '</div></div>' : '') +
      '<div class="field"><label for="h-name">Habit</label><input class="input" id="h-name" name="name" maxlength="60" value="' + M.esc(h.name) + '" placeholder="Small and specific — e.g. Read 10 pages" autofocus></div>' +
      '<div class="field"><label for="h-cue">When — after or during something you already do</label><input class="input" id="h-cue" name="cue" maxlength="80" value="' + M.esc(h.cue) + '" placeholder="After I brush my teeth"><span class="hint">Linking a new habit to an existing routine makes it much more likely to happen.</span></div>' +
      '<div class="field"><label for="h-place">Where (optional)</label><input class="input" id="h-place" name="place" maxlength="60" value="' + M.esc(h.place) + '" placeholder="At my desk"></div>' +
      '<div class="field"><label for="h-backup">Backup plan — if something gets in the way</label><input class="input" id="h-backup" name="backup" maxlength="120" value="' + M.esc(h.backup) + '" placeholder="If it rains, I’ll walk around the house for 10 minutes"><span class="hint">An if–then plan roughly doubles follow-through in studies.</span></div>' +
      '<div class="field"><span class="label">Days</span><div class="choice-row">' + order.map(function (d) {
        return '<label class="choice"><input type="checkbox" data-multi name="days" value="' + d + '"' + (h.days.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + M.DAY_SHORT[d] + '</span></label>';
      }).join('') + '</div></div>' +
      '<div class="field"><label for="h-why">Why it matters to you (optional)</label><input class="input" id="h-why" name="why" maxlength="120" value="' + M.esc(h.why) + '"></div>' +
      '<p class="err hidden" role="alert"></p></form>';
    var foot = (isNew ? '' : '<button type="button" class="btn btn-danger" data-del>' + M.icon('trash') + 'Delete</button><span class="spacer"></span>') +
      '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>' + (isNew ? 'Add habit' : 'Save') + '</button>';
    M.sheet({
      title: isNew ? 'New habit' : 'Edit habit', body: body, foot: foot,
      onOpen: function (dlg) {
        var f = dlg.querySelector('form');
        M.$$('[data-idea]', dlg).forEach(function (b) {
          b.addEventListener('click', function () {
            var x = M.habitIdeas()[+b.getAttribute('data-idea')];
            f.name.value = x.name; f.cue.value = x.cue; f.backup.value = x.backup; h.cat = x.cat;
            M.$$('[data-idea]', dlg).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          });
        });
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          var d = M.formData(f);
          var err = dlg.querySelector('.err');
          if (!d.name.trim()) { err.textContent = 'Name your habit.'; err.classList.remove('hidden'); f.name.focus(); return; }
          if (!d.days || !d.days.length) { err.textContent = 'Pick at least one day.'; err.classList.remove('hidden'); return; }
          h.name = d.name.trim(); h.cue = d.cue.trim() || 'Any time'; h.place = d.place.trim(); h.backup = d.backup.trim(); h.why = d.why.trim();
          h.days = d.days.map(Number);
          if (isNew) M.state.habits.push(h);
          else M.state.habits = M.state.habits.map(function (x) { return x.id === h.id ? h : x; });
          M.save(); M.haptic('success'); dlg.close('ok'); M.refresh();
          M.toast(isNew ? 'Habit added — start tiny.' : 'Habit saved');
        });
        var del = dlg.querySelector('[data-del]');
        if (del) del.addEventListener('click', function () {
          dlg.close();
          M.confirm('Delete “' + h.name + '”?', 'Its history will be deleted too.', 'Delete', true).then(function (ok) {
            if (!ok) return;
            M.state.habits = M.state.habits.filter(function (x) { return x.id !== h.id; });
            Object.keys(M.state.habitLog).forEach(function (k) {
              M.state.habitLog[k] = M.state.habitLog[k].filter(function (id) { return id !== h.id; });
              if (!M.state.habitLog[k].length) delete M.state.habitLog[k];
            });
            M.save(); M.refresh();
          });
        });
      }
    });
  }

  M.views.habits = {
    head: function () { return { title: 'Habits', sub: 'Small, specific, easy to repeat' }; },
    render: function (el) {
      var today = M.today();
      var hs = M.state.habits.filter(function (h) { return !h.archived; });
      var wk = M.weekKeys(today);
      var wd = M.weekday(today);
      var d = M.parseKey(today);
      var fresh = wd === 1 || d.getDate() === 1;

      var totalS = 0, totalD = 0;
      var cards = hs.map(function (h) {
        var s = stats(h, today);
        totalS += s.wkSched; totalD += s.wkDone;
        var scheduledToday = h.days.indexOf(wd) >= 0;
        var on = isDone(today, h.id);
        var dots = wk.map(function (k) {
          var sch = h.days.indexOf(M.weekday(k)) >= 0;
          var done = isDone(k, h.id);
          var future = k > today;
          var cls = 'wd' + (done ? ' done' : '') + (k === today ? ' today' : '') + (!sch ? ' off' : '');
          var lab = M.DAY_LONG[M.weekday(k)] + ': ' + (done ? 'done' : !sch ? 'not scheduled' : future ? 'upcoming' : 'not done');
          return '<button type="button" class="' + cls + '" style="background:none;border:0;padding:0;cursor:' + (future ? 'default' : 'pointer') + '" data-action="dot" data-k="' + k + '" data-id="' + M.esc(h.id) + '"' + (future ? ' disabled' : '') + ' aria-label="' + M.esc(lab) + '"><i>' + (done ? M.icon('check') : '') + '</i>' + M.DAY_LETTER[M.weekday(k)] + '</button>';
        }).join('');
        var stage = s.age < 21 ? 'Starting' : s.age < 66 ? 'Building' : 'Settling in';
        return '<article class="habit">' +
          '<div class="habit-head">' +
          (scheduledToday ? '<button type="button" class="habit-check" data-action="toggle" data-id="' + M.esc(h.id) + '" aria-pressed="' + on + '" aria-label="' + M.esc(h.name) + ' today: ' + (on ? 'done' : 'not done') + '">' + M.icon('check') + '</button>'
            : '<span class="habit-check" style="opacity:.5;cursor:default" title="Not scheduled today" aria-hidden="true">' + M.icon('minus') + '</span>') +
          '<div class="habit-title"><strong>' + M.esc(h.name) + '</strong><span class="cue">' + M.esc(h.cue) + (h.place ? ' · ' + M.esc(h.place) : '') + '</span></div>' +
          '<button type="button" class="icon-btn sm" data-action="edit" data-id="' + M.esc(h.id) + '" aria-label="Edit ' + M.esc(h.name) + '">' + M.icon('edit') + '</button></div>' +
          '<div class="week-dots" role="group" aria-label="This week">' + dots + '</div>' +
          (h.backup ? '<div class="habit-plan"><strong>Backup:</strong> ' + M.esc(h.backup) + '</div>' : '') +
          (s.missedLast && !on && scheduledToday ? U.note('info', '<p><strong>Never miss twice.</strong> Last time slipped — that’s normal. Doing it today keeps the habit on track.</p>') : '') +
          '<div class="habit-foot"><span><strong class="num">' + s.wkDone + '/' + s.wkSched + '</strong> this week</span>' +
          (s.pct28 !== null && s.age >= 7 ? '<span><strong class="num">' + s.pct28 + '%</strong> last 4 weeks</span>' : '') +
          '<span>' + stage + ' · day ' + s.age + '</span></div>' +
          '</article>';
      }).join('');

      var pct = totalS ? Math.round(totalD / totalS * 100) : null;
      el.innerHTML =
        (fresh ? U.note('accent', '<p><strong>' + (wd === 1 ? 'New week' : 'New month') + ', fresh start.</strong> Whatever happened last week, this is a good moment to recommit — pick the one habit that matters most and make it easy.</p>') + '<div style="height:16px"></div>' : '') +
        '<div class="split wide-first">' +
        '<div><div class="section-head" style="margin-top:0"><div><h2>Your habits</h2><p>Tap the box to check off today</p></div><button type="button" class="btn btn-primary" data-action="add">' + M.icon('plus') + 'New habit</button></div>' +
        (hs.length ? '<div class="panel">' + cards + '</div>' : '<div class="empty">' + M.icon('habits') + '<p><strong>No habits yet.</strong></p><p>Pick one small thing, attach it to something you already do every day, and plan what you’ll do if it gets skipped.</p><button type="button" class="btn btn-primary" data-action="add">' + M.icon('plus') + 'Add your first habit</button></div>') +
        '</div>' +
        '<div class="stack">' +
        '<div class="panel"><div class="stats">' +
        '<div class="stat"><span class="label">This week</span><span class="value">' + (pct === null ? '—' : pct + '%') + '</span><span class="sub">' + totalD + ' of ' + totalS + ' scheduled check-ins</span></div>' +
        '<div class="stat"><span class="label">Active habits</span><span class="value">' + hs.length + '</span><span class="sub">' + (hs.length > 3 ? 'Plenty — keep them easy' : 'Start with 1–3') + '</span></div></div></div>' +
        '<div class="panel tint"><h3 style="margin-bottom:10px">How habits really form</h3><ul class="checks">' +
        '<li class="info">' + M.icon('spark') + '<span>It takes about <strong>2 months</strong> on average for a habit to feel automatic — anywhere from 18 to 254 days.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span><strong>Missing a day doesn’t reset anything.</strong> Just don’t miss twice in a row.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Tie it to a <strong>cue you already have</strong> (after brushing your teeth, after dinner) and plan a backup.</span></li>' +
        '<li class="info">' + M.icon('spark') + '<span>Mizan shows weekly consistency, not streaks — so one bad day can’t wipe your progress.</span></li></ul>' +
        U.sourceLine([['Lally et al. 2010', 'https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit'], ['Gollwitzer & Sheeran 2006', 'https://en.wikipedia.org/wiki/Implementation_intention']]) + '</div>' +
        '<a class="btn btn-block" href="#/review">' + M.icon('list') + 'Weekly review</a>' +
        '</div>' +
        '</div>';

      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'add') habitSheet(null);
        else if (act === 'edit') habitSheet(M.state.habits.filter(function (x) { return x.id === a.getAttribute('data-id'); })[0]);
        else if (act === 'toggle') {
          var hid = a.getAttribute('data-id');
          var nowOn = M.toggleHabit(today, hid);
          if (nowOn) { M.haptic('success'); M.flashAfterRender('.habit-check[data-id="' + hid + '"]', 'pop'); }
          M.refresh(); if (nowOn) M.toast('Checked off');
        }
        else if (act === 'dot') { var on2 = M.toggleHabit(a.getAttribute('data-k'), a.getAttribute('data-id')); if (on2) M.haptic('success'); M.refresh(); }
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Weekly review                                                       */
  /* ------------------------------------------------------------------ */
  var reviewOffset = 0;
  M.views.review = {
    head: function () { return { title: 'Weekly review', sub: 'Look back kindly, adjust one thing' }; },
    render: function (el) {
      var today = M.today();
      var anchor = M.addDays(today, reviewOffset * 7);
      var days = M.weekKeys(anchor).filter(function (k) { return k <= today; });
      var wkId = M.isoWeek(anchor);
      var planned = {}, done = {};
      M.CATS.forEach(function (c) { planned[c.id] = 0; done[c.id] = 0; });
      var blocksPlanned = 0, blocksDone = 0, blocksChecked = 0;
      days.forEach(function (k) {
        var r = M.calc.routineFor(k);
        if (!r) return;
        var res = M.calc.resolveBlocks(r, k);
        var ci = M.state.checkins[k] || {};
        res.forEach(function (x) {
          if (k === today && (x.start < x.end ? x.end > M.nowMin() : true)) return; // only count finished blocks today
          planned[x.b.cat] += x.dur; blocksPlanned++;
          var c = ci[x.b.id];
          if (c) {
            blocksChecked++;
            if (c.s === 'done') { done[x.b.cat] += x.dur; blocksDone++; }
            else if (c.s === 'partial') done[x.b.cat] += x.dur / 2;
          }
        });
      });
      var focus = days.reduce(function (a, k) { return a + (M.state.focus[k] || 0); }, 0);
      var water = days.map(function (k) { return M.state.water[k] || 0; });
      var waterAvg = water.length ? water.reduce(function (a, b) { return a + b; }, 0) / water.length : 0;
      var hs = M.state.habits.filter(function (h) { return !h.archived; });
      var hS = 0, hD = 0;
      days.forEach(function (k) { hs.forEach(function (h) { if (k >= (h.created || k) && h.days.indexOf(M.weekday(k)) >= 0) { hS++; if (isDone(k, h.id)) hD++; } }); });
      var series = M.calc.trend(M.state.weights);
      var inWeek = series.filter(function (s) { return days.indexOf(s.d) >= 0; });
      var wChange = inWeek.length >= 2 ? inWeek[inWeek.length - 1].trend - inWeek[0].trend : null;
      var misses = [];
      days.forEach(function (k) { (M.state.misses[k] || []).forEach(function (m) { misses.push(m); }); });
      var reasons = {};
      misses.forEach(function (m) { reasons[m.reason] = (reasons[m.reason] || 0) + 1; });
      var topReasons = Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; });
      var refl = M.state.reflections[wkId] || { well: '', obstacle: '', plan: '' };

      var meters = M.CATS.filter(function (c) { return planned[c.id] > 0; }).map(function (c) {
        var p = planned[c.id], d = done[c.id];
        return '<div class="meter-row"><span class="name"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + M.catVar(c.id) + ';flex-shrink:0" aria-hidden="true"></span><span class="t">' + M.esc(c.label) + '</span></span>' +
          '<div class="meter" role="img" aria-label="' + M.esc(c.label) + ': ' + M.fmtDurShort(d) + ' done of ' + M.fmtDurShort(p) + ' planned"><span style="width:' + M.clamp(d / p * 100, 0, 100).toFixed(1) + '%"></span></div>' +
          '<span class="val">' + M.fmtDurShort(d) + ' / ' + M.fmtDurShort(p) + '</span></div>';
      }).join('');

      el.innerHTML =
        '<div class="row between wrap seg-wrap"><div class="row"><button type="button" class="icon-btn" data-action="prev" aria-label="Previous week">' + M.icon('left') + '</button>' +
        '<strong>' + M.fmtDate(M.startOfWeek(anchor), 'short') + ' – ' + M.fmtDate(M.addDays(M.startOfWeek(anchor), 6), 'short') + '</strong>' +
        '<button type="button" class="icon-btn" data-action="next" aria-label="Next week"' + (reviewOffset >= 0 ? ' disabled' : '') + '>' + M.icon('right') + '</button></div>' +
        (reviewOffset ? '<button type="button" class="btn btn-sm" data-action="this">This week</button>' : '') + '</div>' +
        '<div class="panel"><div class="stats four">' +
        '<div class="stat"><span class="label">Blocks done</span><span class="value">' + (blocksPlanned ? Math.round(blocksDone / blocksPlanned * 100) + '%' : '—') + '</span><span class="sub">' + blocksDone + ' of ' + blocksPlanned + ' finished blocks · ' + blocksChecked + ' checked in</span></div>' +
        '<div class="stat"><span class="label">Habits</span><span class="value">' + (hS ? Math.round(hD / hS * 100) + '%' : '—') + '</span><span class="sub">' + hD + ' of ' + hS + ' check-ins</span></div>' +
        '<div class="stat"><span class="label">Focus time</span><span class="value">' + M.fmtDurShort(focus) + '</span><span class="sub">from the focus timer</span></div>' +
        '<div class="stat"><span class="label">Average weight</span><span class="value">' + (wChange === null ? '—' : (wChange > 0 ? '+' : '') + M.showW(wChange, 1)) + (wChange === null ? '' : '<small>' + M.wUnit() + '</small>') + '</span><span class="sub">' + (wChange === null ? 'Needs 2+ weigh-ins this week' : 'change in average weight') + '</span></div>' +
        '</div></div>' +
        '<div class="split" style="margin-top:16px">' +
        '<div class="stack">' +
        '<div class="panel"><div class="panel-title"><h3>Planned vs done</h3></div>' + (meters || '<p class="muted">Check in on blocks from Today to see this fill up.</p>') + '<p class="hint muted" style="margin-top:12px">Half done counts as half. Unchecked blocks count as not done — check in from Today to keep this honest.</p></div>' +
        '<div class="panel"><div class="panel-title"><h3>What got in the way</h3></div>' +
        (misses.length ? '<ul class="list">' + topReasons.map(function (r) { return '<li><div class="li-main"><strong>' + M.esc(r) + '</strong></div><span class="badge">' + reasons[r] + '×</span></li>'; }).join('') + '</ul>' +
          (misses.some(function (m) { return m.plan; }) ? '<h4 style="margin:14px 0 6px">Your if–then plans</h4><ul class="checks">' + misses.filter(function (m) { return m.plan; }).map(function (m) { return '<li class="info">' + M.icon('spark') + '<span>' + M.esc(m.plan) + ' <span class="muted">(' + M.esc(m.title) + ')</span></span></li>'; }).join('') + '</ul>' : '')
          : '<p class="muted" style="margin:0">No skipped blocks noted this week. When you mark something as skipped, you can note why — patterns show up here.</p>') +
        '</div></div>' +
        '<div class="panel"><div class="panel-title"><h3>Reflect & plan</h3></div>' +
        '<p class="soft" style="font-size:var(--fs-sm)">Be as kind to yourself as you would be to a friend — people who respond to setbacks with self-compassion are more motivated to improve, not less.</p>' +
        '<form class="stack" id="refl">' +
        '<div class="field"><label for="rf-well">What went well this week?</label><textarea class="textarea" id="rf-well" name="well" maxlength="500">' + M.esc(refl.well) + '</textarea></div>' +
        '<div class="field"><label for="rf-ob">What was the main obstacle?</label><textarea class="textarea" id="rf-ob" name="obstacle" maxlength="500">' + M.esc(refl.obstacle) + '</textarea></div>' +
        '<div class="field"><label for="rf-plan">Next week: if that obstacle shows up, I will…</label><textarea class="textarea" id="rf-plan" name="plan" maxlength="500" placeholder="If I feel too tired to study at 16:10, I will do just 15 minutes and then decide.">' + M.esc(refl.plan) + '</textarea></div>' +
        '<button type="submit" class="btn btn-primary">Save reflection</button></form>' +
        '<p class="source">Wish–Outcome–Obstacle–Plan (WOOP) and self-compassion research: <a href="https://woopmylife.org/en/science" target="_blank" rel="noopener">WOOP</a>, <a href="https://www.psychologytoday.com/us/blog/the-science-of-willpower/201206/does-self-compassion-or-criticism-motivate-self-improvement" target="_blank" rel="noopener">Breines &amp; Chen 2012</a>.</p></div>' +
        '</div>' +
        '<p class="muted" style="margin-top:16px;font-size:var(--fs-sm)">Water this week: ' + M.fmt(waterAvg / 1000, 1) + ' L a day on average.</p>';

      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'prev') { reviewOffset--; M.refresh(); }
        else if (act === 'next' && reviewOffset < 0) { reviewOffset++; M.refresh(); }
        else if (act === 'this') { reviewOffset = 0; M.refresh(); }
      });
      M.$('#refl', el).addEventListener('submit', function (e) {
        e.preventDefault();
        M.state.reflections[wkId] = M.formData(e.target);
        M.save();
        M.toast('Reflection saved');
      });
    }
  };
})();
