/* Mizan 3 — the Health and Me tabs, and small helpers used across the app:
   "More options" folds, "?" hints, favourites ("What do you want Mizan for?") and the one-time "What's new" card. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  /* ------------------------------------------------------------------ */
  /* More options: advanced fields stay one tap away.                    */
  /* Settings → Appearance → "Show all options" shows them always.       */
  /* ------------------------------------------------------------------ */
  M.moreOpts = function (html, label, key) {
    if (!html) return '';
    if (M.state.settings.showAll) return '<div class="more-opts is-all">' + html + '</div>';
    return '<details class="more-opts" data-mo="' + M.esc(key || label || 'more') + '"><summary><span>' + M.esc(label || 'More options') + '</span>' + M.icon('down', 'class="mo-chev"') + '</summary><div class="mo-body stack">' + html + '</div></details>';
  };

  /* ------------------------------------------------------------------ */
  /* "?" hints: a short plain-words explanation next to a word           */
  /* ------------------------------------------------------------------ */
  M.help = function (text, about) {
    return '<button type="button" class="help-btn" data-help="' + M.esc(text) + '" aria-expanded="false" aria-label="' + M.esc('What does “' + (about || 'this') + '” mean?') + '">?</button>';
  };
  var pop = null, popFor = null, popY = 0;
  function closePop() {
    if (pop) { pop.remove(); pop = null; }
    if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor.removeAttribute('aria-controls'); popFor = null; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.help-btn');
    if (!b) { if (pop && !e.target.closest('.help-pop')) closePop(); return; }
    e.preventDefault(); e.stopPropagation();
    if (popFor === b) { closePop(); return; }
    closePop();
    pop = document.createElement('div');
    pop.className = 'help-pop'; pop.id = 'help-pop'; pop.setAttribute('role', 'status');
    pop.textContent = b.getAttribute('data-help');
    document.body.appendChild(pop);
    var r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-controls', 'help-pop'); popFor = b; popY = window.scrollY;
    M.haptic('tap');
  }, true);
  window.addEventListener('scroll', function () { if (pop && Math.abs(window.scrollY - popY) > 40) closePop(); }, { passive: true });
  window.addEventListener('hashchange', closePop);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) { var b = popFor; closePop(); if (b) b.focus(); } });

  /* ------------------------------------------------------------------ */
  /* Favourites: "What do you want Mizan for?"                           */
  /* ------------------------------------------------------------------ */
  M.INTERESTS = [
    { id: 'body', label: 'Weight & BMI', icon: 'scale', desc: 'Track weight, see your BMI, set a goal' },
    { id: 'food', label: 'Food', icon: 'food', desc: 'A week of meals, a food log, nutrition' },
    { id: 'workouts', label: 'Workouts', icon: 'dumbbell', desc: 'A plan for your time and equipment' },
    { id: 'move', label: 'Walk & run', icon: 'run', desc: 'GPS tracker, Couch to 5K, records' },
    { id: 'looks', label: 'Looks', icon: 'face', desc: 'Skin care, hair and beard styles' },
    { id: 'tools', label: 'Calculators', icon: 'calc', desc: 'BMI, body fat, water, sleep and more' }
  ];
  M.interestsHtml = function (chosen) {
    chosen = chosen || [];
    return '<div class="choice-grid interest-grid">' + M.INTERESTS.map(function (x) {
      return '<label class="choice block"><input type="checkbox" data-multi name="interests" value="' + x.id + '"' + (chosen.indexOf(x.id) >= 0 ? ' checked' : '') + '>' +
        '<span class="row" style="gap:8px">' + M.icon(x.icon, 'style="width:20px;height:20px"') + '<strong>' + M.esc(x.label) + '</strong></span><small>' + M.esc(x.desc) + '</small></label>';
    }).join('') + '</div>';
  };
  M.readInterests = function (root) {
    return M.$$('input[name="interests"]:checked', root).map(function (i) { return i.value; });
  };
  M.interestsSheet = function (after) {
    M.sheet({
      title: 'What do you want Mizan for?',
      body: '<form class="stack" novalidate><p class="soft" style="margin:0">Pick any. They go first in Health. Everything else stays there too.</p>' + M.interestsHtml(M.state.settings.interests) + '</form>',
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          M.state.settings.interests = M.readInterests(dlg);
          M.save(); dlg.close('ok'); M.haptic('success'); M.toast('Favourites saved');
          if (after) after(); else M.refresh();
        });
      }
    });
  };

  /* ------------------------------------------------------------------ */
  /* What's new in 3.0 (shown once on Today to people who used 2.x)      */
  /* ------------------------------------------------------------------ */
  M.OLD_TABS = ['today', 'day', 'plan', 'habits', 'body']; // what the 2.x bottom bar showed, in 3.0 names
  M.whatsNewHtml = function () {
    if (!M.state.settings.whatsNew3) return '';
    return '<section class="panel whats-new" aria-labelledby="wn-h"><p class="eyebrow">' + M.icon('sparkles') + 'New in Mizan 3.0</p><h2 id="wn-h">A simpler Mizan — nothing removed</h2>' +
      '<ul class="wn-list">' +
      '<li>' + M.icon('today') + '<span><strong>Dashboard is now Today.</strong> The dial and every block are under “See my whole day”.</span></li>' +
      '<li>' + M.icon('heart') + '<span><strong>Health</strong> has Weight & BMI, Food, Workouts, Walk & run, Looks and Calculators.</span></li>' +
      '<li>' + M.icon('user') + '<span><strong>Me</strong> has Habits, Weekly review, Records & badges and Settings.</span></li>' +
      '<li>' + M.icon('settings') + '<span>Extra fields are under <strong>More options</strong>. Want them always? Settings → Appearance → Show all options.</span></li></ul>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary" data-wn="ok">Got it</button><button type="button" class="btn" data-wn="old">Use my old tabs</button></div></section>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-wn]');
    if (!b) return;
    var s = M.state.settings;
    s.whatsNew3 = false;
    if (b.getAttribute('data-wn') === 'old') {
      s.nav.tabs = M.OLD_TABS.slice();
      M.renderNav();
      M.toast('Your old tabs are back. Change them any time in Settings → Tabs & Today.');
    }
    M.save(); M.refresh();
  });

  /* ------------------------------------------------------------------ */
  /* Health                                                              */
  /* ------------------------------------------------------------------ */
  function plural(n, w) { return n + ' ' + M.plural(n, w); }
  var STATUS = {
    body: function () {
      var b = M.bmiInfo ? M.bmiInfo() : { missing: ['weight'] };
      if (b.missing) return 'Add your ' + b.missing.join(' and ') + ' to see your BMI';
      var w = M.latestWeight();
      return (w ? M.showW(w) + ' ' + M.wUnit() + ' · ' : '') + 'BMI ' + M.fmt(b.bmi, 1) + (b.label ? ' · ' + b.label : '');
    },
    food: function () {
      var n = (M.state.foodLog[M.today()] || []).length;
      if (n) return plural(n, 'food') + ' logged today';
      return M.state.mealPlan ? 'Your meal plan is ready' : 'Make a week of meals for your goal';
    },
    workouts: function () {
      var wp = M.state.workoutPlan;
      if (!wp) return 'Make a plan for your time and equipment';
      var k = M.today(), i = wp.days.indexOf(M.weekday(k));
      if (i < 0) return 'Rest day today';
      var ses = wp.sessions[i % wp.sessions.length];
      return 'Today: ' + ses.name + (M.state.workoutLog && M.state.workoutLog[k] ? ' · done' : '');
    },
    move: function () {
      var w = M.activityWeek ? M.activityWeek() : { n: 0, km: 0 };
      return w.n ? M.fmt(w.km, 1) + ' km this week · ' + plural(w.n, 'session') : 'Track a walk or run with GPS';
    },
    looks: function () {
      var L = M.state.looks;
      return L && L.quiz ? 'Your skin & grooming routine is ready' : 'A 2-minute skin & grooming quiz';
    },
    tools: function () { return 'BMI, body fat, water, sleep and more'; }
  };
  var TILE_HREF = { body: '#/body', food: '#/food', workouts: '#/body/workouts', move: '#/move', looks: '#/looks', tools: '#/body/tools' };

  M.views.health = {
    head: function () { return { title: 'Health', sub: 'Body, food, exercise and looks' }; },
    render: function (el) {
      var fav = M.state.settings.interests || [];
      var order = M.INTERESTS.filter(function (x) { return fav.indexOf(x.id) >= 0; }).concat(M.INTERESTS.filter(function (x) { return fav.indexOf(x.id) < 0; }));
      el.innerHTML = '<ul class="hub-tiles" aria-label="Health">' + order.map(function (x) {
        var st = ''; try { st = STATUS[x.id](); } catch (e) { st = x.desc; }
        var isFav = fav.indexOf(x.id) >= 0;
        return '<li><a class="hub-tile" href="' + TILE_HREF[x.id] + '" data-tile="' + x.id + '"><span class="ht-ico">' + M.icon(x.icon) + '</span><span class="ht-text"><strong>' + M.esc(x.label) + (isFav ? '<span class="ht-fav" role="img" aria-label="favourite">★</span>' : '') + '</strong><span>' + M.esc(st) + '</span></span>' + M.icon('right', 'class="set-chev"') + '</a></li>';
      }).join('') + '</ul>' +
        '<div class="hub-foot"><button type="button" class="btn btn-ghost" data-action="favs">' + M.icon('target') + (fav.length ? 'Change favourites' : 'Choose favourites') + '</button></div>';
      el.addEventListener('click', function (e) { if (e.target.closest('[data-action="favs"]')) M.interestsSheet(); });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Me                                                                  */
  /* ------------------------------------------------------------------ */
  function row(href, icon, title, sub, attrs) {
    var inner = '<span class="set-ico">' + M.icon(icon) + '</span><span class="li-main"><strong>' + title + '</strong><span>' + sub + '</span></span>' + M.icon(/^https?:|\.html$/.test(href || '') ? 'external' : 'right', 'class="set-chev"');
    return '<li>' + (href ? '<a href="' + href + '"' + (attrs || '') + '>' + inner + '</a>' : '<button type="button" class="set-row-btn"' + (attrs || '') + '>' + inner + '</button>') + '</li>';
  }
  M.views.me = {
    head: function () { var n = (M.state.profile.name || '').trim(); return { title: n ? n : 'Me', sub: 'Habits, progress and settings' }; },
    render: function (el) {
      var p = M.state.profile, k = M.today(), wd = M.weekday(k);
      var hs = M.state.habits.filter(function (h) { return !h.archived && h.days.indexOf(wd) >= 0; });
      var hl = M.state.habitLog[k] || [];
      var done = hs.filter(function (h) { return hl.indexOf(h.id) >= 0; }).length;
      var nb = Object.keys(M.state.badges || {}).length;
      var age = M.ageFrom(p);
      var facts = [age !== null ? age + ' years' : '', p.heightCm ? (M.imperial() ? M.fmt(M.cmToIn(p.heightCm), 0) + ' in' : Math.round(p.heightCm) + ' cm') : '', M.latestWeight() ? M.showW(M.latestWeight()) + ' ' + M.wUnit() : ''].filter(Boolean).join(' · ');
      var initial = ((p.name || '').trim().charAt(0) || '').toUpperCase();
      var bot = (M.state.settings.bot && M.state.settings.bot.name) || 'Mizo';
      el.innerHTML =
        '<section class="panel me-card"><span class="me-avatar" aria-hidden="true">' + (initial ? M.esc(initial) : M.icon('user')) + '</span><div class="grow"><strong>' + M.esc(p.name || 'You') + '</strong><span class="muted">' + M.esc(facts || 'Add your age, height and weight') + '</span></div><a class="btn btn-sm" href="#/settings/profile">' + M.icon('edit') + 'Edit profile</a></section>' +
        '<h2 class="set-group">Your progress</h2><ul class="set-list">' +
        row('#/habits', 'habits', 'Habits', hs.length ? done + ' of ' + hs.length + ' done today' : 'Add small daily habits') +
        row('#/review', 'list', 'Weekly review', 'How your week went, and one thing to change') +
        row('#/move/history', 'trophy', 'Records & badges', nb ? plural(nb, 'badge') + ' earned · your best times' : 'Your best times and badges from walks and runs') +
        '</ul>' +
        '<h2 class="set-group">Mizan</h2><ul class="set-list">' +
        row('#/settings', 'settings', 'Settings', 'Profile, reminders, look, tabs, backup') +
        row('#/assistant', 'chat', 'Ask ' + M.esc(bot), 'Questions about the app, health and your day') +
        (M.installed && M.installed() ? '' : row('', 'download', 'Install as an app', 'Home screen, full screen, works offline', ' data-action="install"')) +
        row('#/science', 'book', 'Science & sources', 'The research behind every feature') +
        row('#/about', 'info', 'About Mizan', 'Health note, helplines and credits') +
        row('privacy.html', 'lock', 'Privacy policy', 'What is stored, where, and why') +
        '</ul><p class="copyright">' + M.esc(M.COPYRIGHT) + ' · v' + M.esc(M.VERSION) + '</p>';
    }
  };
})();
