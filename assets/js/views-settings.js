/* Mizan — Settings: every part of the app can be changed here (☰ → Settings) */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var C = M.calc;

  /* ------------------------------------------------------------------ */
  /* Appearance                                                          */
  /* ------------------------------------------------------------------ */
  M.ACCENTS = [
    { id: '', label: 'Lime', l: '#c2ea45', d: '#c6f04e' },
    { id: 'sky', label: 'Sky', l: '#5cc8f5', d: '#6fd0f7' },
    { id: 'mint', label: 'Mint', l: '#5ee0b0', d: '#6fe6bb' },
    { id: 'amber', label: 'Amber', l: '#ffc53d', d: '#ffcf5c' },
    { id: 'coral', label: 'Coral', l: '#ff8a65', d: '#ff9a7a' },
    { id: 'rose', label: 'Rose', l: '#ff8fb8', d: '#ff9ec2' },
    { id: 'violet', label: 'Violet', l: '#b69cff', d: '#c2adff' },
    { id: 'ink', label: 'Mono', l: '#1b1a17', d: '#edf0e7', onL: '#fffdf8', onD: '#151a17' }
  ];
  function lum(hex) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  M.textOn = function (hex) { var L = lum(hex); return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#ffffff' : '#1b1a17'; };

  M.applyLook = function () {
    var L = M.state.settings.look || {};
    var root = document.documentElement, st = root.style;
    ['--acc-l', '--acc-d', '--acc-on-l', '--acc-on-d'].forEach(function (k) { st.removeProperty(k); });
    root.removeAttribute('data-accent');
    if (L.accent) {
      var pre = M.ACCENTS.filter(function (a) { return a.id === L.accent; })[0];
      var l = pre ? pre.l : L.accent, d = pre ? pre.d : L.accent;
      st.setProperty('--acc-l', l); st.setProperty('--acc-d', d);
      st.setProperty('--acc-on-l', pre && pre.onL ? pre.onL : M.textOn(l));
      st.setProperty('--acc-on-d', pre && pre.onD ? pre.onD : M.textOn(d));
      root.setAttribute('data-accent', '');
    }
    st.fontSize = L.fontScale && L.fontScale !== 1 ? (L.fontScale * 100) + '%' : '';
    root.setAttribute('data-radius', L.radius || 'soft');
    root.setAttribute('data-density', L.density || 'comfortable');
    root.setAttribute('data-motion', L.motion || 'full');
    root.setAttribute('data-font', L.font || 'default');
    M.CATS.forEach(function (c) {
      var v = L.catColors && L.catColors[c.id];
      if (v) { st.setProperty('--c-' + c.id, v); st.setProperty('--on-c-' + c.id, M.textOn(v)); }
      else { st.removeProperty('--c-' + c.id); st.removeProperty('--on-c-' + c.id); }
    });
    var b = M.state.settings.bot || {};
    if (M.assistant && M.assistant.applyLook) M.assistant.applyLook(b);
  };
  var baseReduce = M.reduceMotion;
  M.reduceMotion = function () { var m = M.state && M.state.settings.look && M.state.settings.look.motion; return m === 'off' || m === 'reduced' || baseReduce(); };

  /* Browser notifications — only while Mizan is open (a web page can't wake itself up) */
  M.notify = function (title, body) {
    try {
      if (!M.state.settings.water.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, { body: body, icon: 'assets/icons/icon-192.png', tag: 'mizan-' + title }); });
      else new Notification(title, { body: body, icon: 'assets/icons/icon-192.png' });
    } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a && a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'); var last = ks.pop(); var t = ks.reduce(function (a, k) { if (!a[k] || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o); t[last] = v; }
  var S = function () { return M.state.settings; };
  var saveTimer = null;
  function saved(msg) { M.save(); clearTimeout(saveTimer); saveTimer = setTimeout(function () { M.toast(msg || 'Saved'); }, 250); }

  function sw(path, title, desc) {
    return '<label class="switch"><span class="sw-text"><strong>' + title + '</strong>' + (desc ? '<span>' + desc + '</span>' : '') + '</span><input type="checkbox" data-set="' + path + '"' + (getPath(S(), path) ? ' checked' : '') + '></label>';
  }
  function radios(path, label, opts) {
    var v = getPath(S(), path);
    return '<fieldset class="field"><legend class="label">' + label + '</legend><div class="choice-row">' + opts.map(function (o) {
      return '<label class="choice"><input type="radio" name="r-' + path + '" data-set="' + path + '" value="' + M.esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' checked' : '') + '><span>' + M.esc(o[1]) + '</span></label>';
    }).join('') + '</div></fieldset>';
  }
  function select(path, label, opts, hint) {
    var v = getPath(S(), path), id = 'sel-' + path.replace(/\./g, '-');
    return '<div class="field"><label for="' + id + '">' + label + '</label><select class="select" id="' + id + '" data-set="' + path + '">' + opts.map(function (o) { return '<option value="' + M.esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + M.esc(o[1]) + '</option>'; }).join('') + '</select>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function coerce(el) {
    if (el.type === 'checkbox') return el.checked;
    var v = el.value;
    if (el.getAttribute('data-num') !== null || el.type === 'range' || el.type === 'number') return v === '' ? null : Number(v);
    if (/^-?\d+(\.\d+)?$/.test(v) && el.tagName === 'SELECT' && el.getAttribute('data-str') === null) return Number(v);
    return v;
  }

  /* ------------------------------------------------------------------ */
  /* Sections                                                            */
  /* ------------------------------------------------------------------ */
  var SECTIONS = [
    { group: 'You', id: 'profile', icon: 'user', title: 'Profile', desc: 'Name, age, height, weight, activity' },
    { group: 'You', id: 'timetable', icon: 'plan', title: 'Timetable & day', desc: 'Rebuild from 5 questions, templates, clock' },
    { group: 'You', id: 'water', icon: 'water', title: 'Water', desc: 'Goal, glass size and reminders' },
    { group: 'You', id: 'move', icon: 'run', title: 'Walk & run', desc: 'GPS, steps, voice and vibration' },
    { group: 'Look & feel', id: 'look', icon: 'palette', title: 'Appearance', desc: 'Theme, colours, text size, corners, motion' },
    { group: 'Look & feel', id: 'home', icon: 'dash', title: 'Home & tabs', desc: 'Start screen and bottom bar' },
    { group: 'Look & feel', id: 'dashboard', icon: 'list', title: 'Dashboard', desc: 'Which cards show, and their order' },
    { group: 'Look & feel', id: 'assistant', icon: 'chat', title: 'Assistant', desc: 'Name, look, greeting, your own replies' },
    { group: 'Look & feel', id: 'touch', icon: 'vibrate', title: 'Sound & touch', desc: 'Haptic feedback' },
    { group: 'Data', id: 'data', icon: 'cloud', title: 'Backup & restore', desc: 'Google Drive, backup file, erase' },
    { group: 'Data', id: 'units', icon: 'ruler', title: 'Units & health', desc: 'kg or lb, BMI cut-offs, numbers-light' },
    { group: 'Data', id: 'sun', icon: 'sun', title: 'Sun times', desc: 'Sunrise and sunset for your location' },
    { group: 'Data', id: 'about', icon: 'info', title: 'About & privacy', desc: 'Version, privacy policy, sources' }
  ];

  var R = {}; // renderers: return html; B = binders

  R.profile = function () {
    var st = M.state, p = st.profile, imp = M.imperial(), w = M.latestWeight();
    return '<form id="prof-form" class="stack" novalidate>' +
      '<div class="form-grid"><div class="field"><label for="st-name">First name</label><input class="input" id="st-name" name="name" maxlength="40" value="' + M.esc(p.name) + '"></div>' +
      '<div class="field"><label for="st-dob">Date of birth</label><input class="input" id="st-dob" type="date" name="dob" value="' + M.esc(p.dob) + '" max="' + M.today() + '"><span class="hint">Or just enter your age →</span></div>' +
      U.numField('age', 'Age', p.dob ? '' : (p.age || ''), 'years', { step: 1, min: 2, max: 110, placeholder: p.dob ? String(M.ageFrom(p)) : '' }) +
      '<fieldset class="field"><legend class="label">Sex</legend>' + U.radios('sex', [['female', 'Female'], ['male', 'Male'], ['', 'Not set']], p.sex) + '</fieldset>' +
      U.numField('h', 'Height', p.heightCm ? (imp ? M.fmt(M.cmToIn(p.heightCm), 1) : M.fmt(p.heightCm, 1)) : '', imp ? 'in' : 'cm', { step: 0.1 }) +
      U.numField('w', 'Weight today', w ? (imp ? M.fmt(M.kgToLb(w), 1) : w) : '', M.wUnit(), { step: 0.1, hint: 'Saving a new value logs a weigh-in for today.' }) +
      U.numField('waist', 'Waist', p.waistCm ? M.showLen(p.waistCm) : '', M.lenUnit(), { step: 0.1 }) +
      U.numField('neck', 'Neck', p.neckCm ? M.showLen(p.neckCm) : '', M.lenUnit(), { step: 0.1 }) +
      U.numField('hip', 'Hips', p.hipCm ? M.showLen(p.hipCm) : '', M.lenUnit(), { step: 0.1 }) +
      U.numField('rest', 'Resting heart rate', p.restingHr || '', 'bpm', { step: 1 }) + '</div>' +
      U.selectField('activity', 'Activity level', C.ACTIVITY.map(function (a) { return [a.id, a.label + ' — ' + a.desc]; }), p.activity) +
      '<button type="submit" class="btn btn-primary">Save profile</button></form>';
  };
  R.profileBind = function (el) {
    var p = M.state.profile, imp = M.imperial();
    M.$('#prof-form', el).addEventListener('submit', function (e) {
      e.preventDefault();
      var d = M.formData(e.target);
      p.name = d.name.trim(); p.dob = d.dob || '';
      if (!p.dob) p.age = M.num(d.age) ? Math.round(M.num(d.age)) : p.age;
      p.sex = d.sex || '';
      var h = M.num(d.h); p.heightCm = h ? (imp ? M.inToCm(h) : h) : null;
      var kg = M.inW(d.w); if (kg && kg > 20 && kg < 350 && Math.abs(kg - (M.latestWeight() || 0)) > 0.05) M.logWeight(kg);
      p.waistCm = M.inLen(d.waist); p.neckCm = M.inLen(d.neck); p.hipCm = M.inLen(d.hip);
      p.restingHr = M.num(d.rest); p.activity = d.activity || p.activity;
      M.save(); M.haptic('success'); M.toast('Profile saved'); M.refresh();
    });
  };

  R.timetable = function () {
    var a = M.state.setup && M.state.setup.answers;
    var role = a && M.ROLES.filter(function (r) { return r.id === a.role; })[0];
    return '<div class="stack">' +
      '<div class="inset"><strong>Make a custom timetable</strong><p class="soft" style="margin:4px 0 12px;font-size:var(--fs-sm)">Plan every hour yourself with the assistant: when you wake up, then what you do and until when — block by block. At the end you see what’s good, what could be better and how to fix it, and it can fix it for you.</p>' +
      '<button type="button" class="btn btn-primary" data-act="custom">' + M.icon('chat') + 'Build it step by step</button></div>' +
      '<div class="inset"><strong>Rebuild my timetable</strong><p class="soft" style="margin:4px 0 12px;font-size:var(--fs-sm)">Answer the 5 questions again (school or work hours, sleep, goal, exercise and study time) and Mizan builds a new timetable.' +
      (a ? ' Last time: ' + M.esc(role ? role.label : '') + ', up at ' + M.fmtTime(a.wake) + ', asleep at ' + M.fmtTime(a.bed) + (a.start ? ', ' + M.fmtTime(a.start) + '–' + M.fmtTime(a.end) : '') + '.' : '') + '</p>' +
      '<button type="button" class="btn" data-act="setup">' + M.icon('refresh') + 'Answer the 5 questions</button></div>' +
      '<div class="row wrap"><button type="button" class="btn" data-act="templates">' + M.icon('copy') + 'Start from a template</button><a class="btn" href="#/plan">' + M.icon('edit') + 'Edit blocks in Plan</a></div>' +
      radios('clock', 'Clock', [['24', '24-hour'], ['12', '12-hour']]) + '</div>';
  };
  R.timetableBind = function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.getAttribute('data-act') === 'setup') M.startSetup();
      if (b.getAttribute('data-act') === 'custom' && M.assistant) M.assistant.startBuilder();
      if (b.getAttribute('data-act') === 'templates') { M.go('plan'); setTimeout(function () { if (M.openTemplates) M.openTemplates(); }, 150); }
    });
  };

  R.water = function () {
    var s = S();
    return '<div class="stack">' +
      '<div class="form-grid">' + U.numField('glassMl', 'Glass size', s.glassMl || 250, 'ml', { step: 10, min: 100, max: 1000 }) +
      U.numField('waterGoal', 'Daily goal (optional)', s.waterGoalMl ? s.waterGoalMl / 1000 : '', 'L', { step: 0.1, hint: 'Leave empty to use the suggested amount (' + M.water.goalGlasses() + ' glasses).' }) + '</div>' +
      sw('water.remind', 'Remind me to drink water', 'The dashboard turns orange and the phone vibrates when it’s been too long.') +
      select('water.everyMin', 'Remind me after', [[45, '45 minutes'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [150, '2½ hours'], [180, '3 hours']]) +
      sw('water.quietInSleep', 'Quiet while I’m asleep', 'No reminders during your sleep block.') +
      ('Notification' in window ? sw('water.notify', 'Show a notification', 'Only while Mizan is open on your screen or in a tab. The phone app will be able to remind you in the background.') : '') +
      '</div>';
  };
  R.waterBind = function (el) {
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'glassMl') { S().glassMl = M.clamp(M.num(t.value) || 250, 100, 1000); saved(); }
      if (t.name === 'waterGoal') { var g = M.num(t.value); S().waterGoalMl = g ? Math.round(g * 1000) : null; saved(); }
      if (t.getAttribute('data-set') === 'water.notify' && t.checked && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(function (p) { if (p !== 'granted') { S().water.notify = false; M.save(); M.toast('Notifications are blocked in your browser settings.'); M.refresh(); } });
      }
    });
  };

  R.move = function () {
    var s = S().move;
    return '<div class="stack">' +
      radios('move.type', 'Default activity', [['walk', 'Walk'], ['run', 'Run'], ['treadmill', 'Treadmill / indoor']]) +
      sw('move.keepAwake', 'Keep the screen on while tracking', 'GPS stops when the screen locks, so this keeps it running. Uses more battery.') +
      sw('move.autoPause', 'Auto-pause when I stop', 'Pauses the timer at traffic lights and restarts when you move.') +
      sw('move.voice', 'Spoken updates every kilometre', 'Distance, time and pace, read aloud.') +
      sw('move.splitHaptic', 'Vibrate every kilometre') +
      U.numField('stepCm', 'Step length (optional)', s.stepCm || '', 'cm', { step: 1, min: 30, max: 200, hint: 'Leave empty and Mizan estimates it from your height. Used when the motion sensor isn’t available.' }) +
      select('move.minAccuracy', 'GPS accuracy filter', [[20, 'Strict (20 m)'], [30, 'Normal (30 m)'], [50, 'Relaxed (50 m) — for tall buildings']]) +
      '</div>';
  };
  R.moveBind = function (el) {
    el.addEventListener('change', function (e) { if (e.target.name === 'stepCm') { var v = M.num(e.target.value); S().move.stepCm = v ? M.clamp(Math.round(v), 30, 200) : null; saved(); } });
  };

  R.look = function () {
    var L = S().look;
    var sw8 = M.ACCENTS.map(function (a) {
      var on = (L.accent || '') === a.id;
      return '<label class="swatch" title="' + a.label + '"><input type="radio" name="accent" value="' + a.id + '"' + (on ? ' checked' : '') + '><span style="--sw:' + a.l + '"></span><em>' + a.label + '</em></label>';
    }).join('');
    var custom = L.accent && L.accent.charAt(0) === '#';
    return '<div class="stack">' +
      radios('theme', 'Theme', [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']]) +
      '<fieldset class="field"><legend class="label">Highlight colour</legend><div class="swatches">' + sw8 +
      '<label class="swatch" title="Custom"><input type="radio" name="accent" value="custom"' + (custom ? ' checked' : '') + '><span class="custom" style="--sw:' + (custom ? L.accent : '#888') + '"></span><em>Custom</em></label></div>' +
      '<div class="row" style="margin-top:8px"><label for="acc-pick" class="muted" style="font-size:var(--fs-sm)">Custom colour</label><input type="color" id="acc-pick" value="' + (custom ? L.accent : '#c2ea45') + '"></div></fieldset>' +
      '<div class="field"><label for="fs-range">Text size: <span id="fs-val">' + Math.round((L.fontScale || 1) * 100) + '%</span></label><input class="range" id="fs-range" type="range" min="85" max="130" step="5" value="' + Math.round((L.fontScale || 1) * 100) + '"></div>' +
      radios('look.radius', 'Corners', [['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']]) +
      radios('look.density', 'Spacing', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']]) +
      radios('look.motion', 'Animations', [['full', 'On'], ['reduced', 'Fewer'], ['off', 'Off']]) +
      radios('look.font', 'Font', [['default', 'Mizan (easy to read)'], ['system', 'My phone’s font']]) +
      '<fieldset class="field"><legend class="label">Category colours</legend><ul class="cat-colors">' + M.CATS.map(function (c) {
        var v = (L.catColors && L.catColors[c.id]) || '';
        return '<li><span class="dot" style="background:' + M.catVar(c.id) + '"></span><span class="grow">' + M.esc(c.label) + '</span><input type="color" aria-label="Colour for ' + M.esc(c.label) + '" data-cat="' + c.id + '" value="' + (v || getComputedStyle(document.documentElement).getPropertyValue('--c-' + c.id).trim() || '#888888') + '">' +
          (v ? '<button type="button" class="btn btn-sm btn-ghost" data-reset-cat="' + c.id + '">Reset</button>' : '') + '</li>';
      }).join('') + '</ul><span class="hint">Tip: keep neighbouring blocks (like meals and exercise) clearly different.</span></fieldset>' +
      '<div class="look-preview" aria-hidden="true"><div class="panel"><strong>Preview</strong><p class="soft" style="margin:4px 0 10px">Buttons, chips and your day strip.</p><div class="row wrap"><span class="btn btn-primary btn-sm">Primary</span><span class="btn btn-sm">Secondary</span><span class="chip"><span class="dot" style="--dot:var(--c-study)"></span>Study</span></div>' +
      '<div class="ds-track" style="height:28px;margin-top:12px">' + M.CATS.map(function (c, i) { return '<span class="ds-seg" style="left:' + (i * 100 / 9) + '%;width:' + (100 / 9) + '%;--cat:' + M.catVar(c.id) + '"></span>'; }).join('') + '</div></div></div>' +
      '<button type="button" class="btn btn-danger" data-act="reset-look">' + M.icon('refresh') + 'Reset appearance</button></div>';
  };
  R.lookBind = function (el) {
    var L = S().look;
    el.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'fs-range') { L.fontScale = +t.value / 100; M.$('#fs-val', el).textContent = t.value + '%'; M.applyLook(); M.save(); }
      if (t.id === 'acc-pick') { L.accent = t.value; M.applyLook(); M.save(); var r = el.querySelector('input[name=accent][value=custom]'); if (r) r.checked = true; }
      if (t.getAttribute('data-cat')) { L.catColors = L.catColors || {}; L.catColors[t.getAttribute('data-cat')] = t.value; M.applyLook(); M.save(); }
    });
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'accent') { L.accent = t.value === 'custom' ? M.$('#acc-pick', el).value : t.value; M.applyLook(); saved(); }
      if (t.getAttribute('data-cat')) M.refresh();
      if (t.getAttribute('data-set') === 'theme') M.applyTheme();
    });
    el.addEventListener('click', function (e) {
      var rc = e.target.closest('[data-reset-cat]');
      if (rc) { delete L.catColors[rc.getAttribute('data-reset-cat')]; M.applyLook(); M.save(); M.refresh(); }
      if (e.target.closest('[data-act="reset-look"]')) {
        S().look = { accent: '', fontScale: 1, radius: 'soft', density: 'comfortable', motion: 'full', catColors: {}, font: 'default' };
        S().theme = 'system'; M.applyTheme(); M.applyLook(); M.save(); M.toast('Appearance reset'); M.refresh();
      }
    });
  };

  R.home = function () {
    var s = S().nav;
    var all = M.NAV;
    var ordered = s.tabs.map(M.nav).filter(Boolean).concat(all.filter(function (n) { return s.tabs.indexOf(n.id) < 0; }));
    return '<div class="stack">' +
      select('nav.start', 'Open Mizan on', all.filter(function (n) { return n.id !== 'assistant'; }).map(function (n) { return [n.id, n.label]; })) +
      '<fieldset class="field"><legend class="label">Bottom bar (2–5 tabs, in this order)</legend><ul class="order-list">' + ordered.map(function (n) {
        var on = s.tabs.indexOf(n.id) >= 0, i = s.tabs.indexOf(n.id);
        return '<li class="' + (on ? 'on' : '') + '"><label class="row grow" style="gap:10px;cursor:pointer"><input type="checkbox" data-tab="' + n.id + '"' + (on ? ' checked' : '') + '>' + M.icon(n.icon) + '<span>' + M.esc(n.label) + '</span></label>' +
          (on ? '<button type="button" class="icon-btn sm" data-move-tab="' + n.id + '" data-dir="-1" aria-label="Move ' + M.esc(n.label) + ' left"' + (i === 0 ? ' disabled' : '') + '>' + M.icon('up') + '</button><button type="button" class="icon-btn sm" data-move-tab="' + n.id + '" data-dir="1" aria-label="Move ' + M.esc(n.label) + ' right"' + (i === s.tabs.length - 1 ? ' disabled' : '') + '>' + M.icon('down') + '</button>' : '') + '</li>';
      }).join('') + '</ul><span class="hint">Everything else is in the ☰ menu at the top right.</span></fieldset>' +
      '<button type="button" class="btn" data-act="reset-tabs">' + M.icon('refresh') + 'Reset to default</button></div>';
  };
  R.homeBind = function (el) {
    var s = S().nav;
    var after = function () { M.save(); M.renderNav(); M.refresh(); M.render(true); };
    el.addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-tab');
      if (!id) return;
      if (e.target.checked) { if (s.tabs.length >= 5) { e.target.checked = false; M.haptic('error'); M.toast('The bottom bar holds up to 5 tabs. Turn one off first.'); return; } s.tabs.push(id); }
      else { if (s.tabs.length <= 2) { e.target.checked = true; M.haptic('error'); M.toast('Keep at least 2 tabs.'); return; } s.tabs = s.tabs.filter(function (t) { return t !== id; }); }
      after();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move-tab]');
      if (b) { var id = b.getAttribute('data-move-tab'), dir = +b.getAttribute('data-dir'), i = s.tabs.indexOf(id), j = i + dir; if (j >= 0 && j < s.tabs.length) { s.tabs.splice(i, 1); s.tabs.splice(j, 0, id); after(); } }
      if (e.target.closest('[data-act="reset-tabs"]')) { s.tabs = ['dashboard', 'today', 'plan', 'habits', 'body']; s.start = 'dashboard'; after(); M.toast('Tabs reset'); }
    });
    el.addEventListener('change', function (e) { if (e.target.getAttribute('data-set') === 'nav.start') M.renderNav(); });
  };

  R.dashboard = function () {
    var cards = S().dash.cards;
    return '<div class="stack"><p class="soft" style="margin:0">Turn cards on or off and move them up or down. The dashboard shows them in this order.</p><ul class="order-list">' + cards.map(function (c, i) {
      var meta = M.DASH_CARDS.filter(function (x) { return x.id === c.id; })[0] || { label: c.id };
      return '<li class="' + (c.on ? 'on' : '') + '"><label class="row grow" style="gap:10px;cursor:pointer"><input type="checkbox" data-card="' + c.id + '"' + (c.on ? ' checked' : '') + '><span>' + M.esc(meta.label) + '</span></label>' +
        '<button type="button" class="icon-btn sm" data-move-card="' + i + '" data-dir="-1" aria-label="Move ' + M.esc(meta.label) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + M.icon('up') + '</button><button type="button" class="icon-btn sm" data-move-card="' + i + '" data-dir="1" aria-label="Move ' + M.esc(meta.label) + ' down"' + (i === cards.length - 1 ? ' disabled' : '') + '>' + M.icon('down') + '</button></li>';
    }).join('') + '</ul><div class="row wrap"><a class="btn btn-primary" href="#/dashboard">' + M.icon('dash') + 'See dashboard</a><button type="button" class="btn" data-act="reset-cards">' + M.icon('refresh') + 'Reset</button></div></div>';
  };
  R.dashboardBind = function (el) {
    var d = S().dash;
    el.addEventListener('change', function (e) { var id = e.target.getAttribute('data-card'); if (!id) return; d.cards.forEach(function (c) { if (c.id === id) c.on = e.target.checked; }); saved(); M.refresh(); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-move-card]');
      if (b) { var i = +b.getAttribute('data-move-card'), j = i + +b.getAttribute('data-dir'); var x = d.cards.splice(i, 1)[0]; d.cards.splice(j, 0, x); M.save(); M.refresh(); M.flashAfterRender('.order-list li:nth-child(' + (j + 1) + ')'); }
      if (e.target.closest('[data-act="reset-cards"]')) { d.cards = M.DASH_CARDS.map(function (c) { return { id: c.id, on: c.on !== false }; }); saved('Dashboard reset'); M.refresh(); }
    });
  };

  R.assistant = function () { return M.assistant ? M.assistant.settingsHtml() : '<p class="muted">The assistant is loading…</p>'; };
  R.assistantBind = function (el) { if (M.assistant) M.assistant.settingsBind(el); };

  R.touch = function () {
    return '<div class="stack">' + sw('haptics', 'Haptic feedback', 'Small vibrations when you tap, finish or delete something. Works on Android, and on iPhone with iOS 18 or later.') +
      '<button type="button" class="btn" data-act="test-haptic">' + M.icon('vibrate') + 'Test vibration</button></div>';
  };
  R.touchBind = function (el) { el.addEventListener('click', function (e) { if (e.target.closest('[data-act="test-haptic"]')) M.haptic('success'); }); };

  R.data = function () {
    var b = S().backup, dv = b.drive;
    var hasClient = !!(M.CONFIG && M.CONFIG.googleClientId);
    var last = function (t) { return t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'never'; };
    return '<div class="stack">' +
      '<section class="inset bk-card"><div class="row between wrap"><div class="row">' + M.icon('cloud', 'style="width:26px;height:26px"') + '<div><strong>Google Drive</strong><div class="muted" style="font-size:var(--fs-sm)">' + (dv.connected ? 'Connected · last backup ' + last(dv.lastAt) : 'Not connected') + '</div></div></div>' +
      (dv.connected ? '<span class="badge good">' + M.icon('good') + 'On</span>' : '') + '</div>' +
      '<p class="soft" style="font-size:var(--fs-sm);margin:10px 0">Saves one private backup file in a hidden Mizan folder in <em>your</em> Google Drive. Mizan can’t see your other files, and nothing goes to any Mizan server. On a new phone, choose “Restore my data”.</p>' +
      (hasClient ? (dv.connected ?
        '<div class="btn-row"><button type="button" class="btn btn-primary" data-drive="backup">' + M.icon('upload') + 'Back up now</button><button type="button" class="btn" data-drive="restore">' + M.icon('download') + 'Restore</button></div>' +
        sw('backup.drive.auto', 'Back up automatically', 'A minute after changes, while you’re signed in. Google asks you to sign in again about once an hour.') +
        '<div class="btn-row"><button type="button" class="btn btn-ghost" data-drive="remove">' + M.icon('trash') + 'Delete Drive backup</button><button type="button" class="btn btn-ghost" data-drive="disconnect">Disconnect</button></div>'
        : '<button type="button" class="btn btn-primary" data-drive="connect">' + M.icon('cloud') + 'Connect Google Drive</button>')
        : '<p class="muted">Google Drive isn’t set up in this copy of Mizan.</p>') + '</section>' +
      '<section class="inset bk-card"><div class="row">' + M.icon('download', 'style="width:26px;height:26px"') + '<div><strong>Backup file</strong><div class="muted" style="font-size:var(--fs-sm)">Last saved ' + last(b.lastFileAt) + '</div></div></div>' +
      '<p class="soft" style="font-size:var(--fs-sm);margin:10px 0">A file you keep yourself — optionally locked with a password.</p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary" data-act="save-file">' + M.icon('download') + 'Save backup file</button><button type="button" class="btn" data-act="open-file">' + M.icon('upload') + 'Restore from file</button></div></section>' +
      select('backup.remindDays', 'Remind me to back up', [[0, 'Never'], [3, 'Every 3 days'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month']]) +
      (M.storageOK ? '' : U.note('warn', '<p>This browser is blocking storage (private mode?). Changes will be lost when you close the page.</p>')) +
      '<div class="danger-zone"><strong>Erase everything</strong><p class="soft" style="font-size:var(--fs-sm);margin:4px 0 10px">Deletes all your data from this device. Backups you saved are not touched.</p><button type="button" class="btn btn-danger" data-act="erase">' + M.icon('trash') + 'Erase everything</button></div></div>';
  };
  R.dataBind = function (el) {
    if (M.backup) M.backup.drive.loadGis().catch(function () {});
    el.addEventListener('click', function (e) {
      var d = e.target.closest('[data-drive]');
      if (d && M.backup) {
        var act = d.getAttribute('data-drive'), D = M.backup.drive;
        if (act === 'connect') D.connect().catch(M.backup.fail);
        else if (act === 'backup') D.backupNow().catch(M.backup.fail);
        else if (act === 'restore') D.restore().catch(M.backup.fail);
        else if (act === 'remove') M.confirm('Delete the Drive backup?', 'The backup file in your Google Drive will be deleted. Your data on this device stays.', 'Delete', true).then(function (ok) { if (ok) D.remove().catch(M.backup.fail); });
        else if (act === 'disconnect') D.disconnect();
      }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'save-file') M.backup.saveSheet();
      else if (a === 'open-file') M.backup.pickFile();
      else if (a === 'erase') {
        M.confirm('Erase everything?', 'This deletes your routines, check-ins, habits, weights, runs, food logs and settings from this device. Save a backup first if you might want them.', 'Erase everything', true).then(function (ok) {
          if (!ok) return;
          M.resetAll(); M.applyTheme(); M.applyLook(); M.renderNav(); M.go('welcome'); M.toast('All data erased');
        });
      }
    });
  };

  R.units = function () {
    return '<div class="stack">' + radios('units', 'Units', [['metric', 'kg & cm'], ['imperial', 'lb & inches']]) +
      radios('bmiStandard', 'Adult BMI cut-offs', [['who', 'WHO (global)'], ['asian', 'Asian Indian / South Asian']]) +
      sw('numbersLight', 'Numbers-light mode', 'Hides calories in plans and logs, and shows a simple plate check instead. Helpful if tracking numbers feels stressful.') + '</div>';
  };

  R.sun = function () {
    var sn = S().sun;
    var t = M.sun.times(M.today());
    return '<form id="sun-form" class="stack" novalidate>' +
      '<label class="switch"><span class="sw-text"><strong>Show sunrise and sunset</strong><span>On the Today dial and the plan strip. Calculated on your device — your location is never sent anywhere.</span></span><input type="checkbox" name="enabled"' + (sn.enabled ? ' checked' : '') + '></label>' +
      '<div class="row wrap"><button type="button" class="btn" data-act="locate">' + M.icon('pin') + 'Use my location</button><span class="muted" style="font-size:var(--fs-sm)">' + (sn.lat !== null ? M.esc(sn.place || 'Saved') + ' (' + sn.lat + ', ' + sn.lng + ')' : 'No location yet') + '</span></div>' +
      '<details><summary class="muted" style="cursor:pointer;font-weight:700;font-size:var(--fs-sm)">Enter coordinates manually</summary><div class="form-grid" style="margin-top:10px">' +
      '<div class="field full"><label for="sn-place">Place name</label><input class="input" id="sn-place" name="place" maxlength="40" value="' + M.esc(sn.place) + '" placeholder="e.g. your town"></div>' +
      U.numField('lat', 'Latitude', sn.lat !== null ? sn.lat : '', '°', { step: 0.0001, min: -90, max: 90 }) + U.numField('lng', 'Longitude', sn.lng !== null ? sn.lng : '', '°', { step: 0.0001, min: -180, max: 180 }) + '</div></details>' +
      '<button type="submit" class="btn btn-primary">Save</button>' +
      (t.length ? '<div class="inset"><strong>Today' + (sn.place ? ' in ' + M.esc(sn.place) : '') + '</strong><dl class="kv" style="margin-top:8px">' + t.map(function (x) { return '<dt>' + x.label + '</dt><dd>' + M.fmtTime(x.at) + '</dd>'; }).join('') + '</dl><p class="hint muted" style="margin-top:8px">In Plan, a block can start at sunrise or sunset so it moves with the seasons.</p></div>' : '') +
      '</form>';
  };
  R.sunBind = function (el) {
    var sn = S().sun;
    M.$('#sun-form', el).addEventListener('submit', function (e) {
      e.preventDefault();
      var d = M.formData(e.target);
      sn.enabled = !!d.enabled; sn.place = (d.place || '').trim();
      var la = M.num(d.lat), lo = M.num(d.lng);
      if (la !== null && lo !== null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { sn.lat = la; sn.lng = lo; }
      if (sn.enabled && sn.lat === null) { M.haptic('warning'); M.toast('Add a location so the times can be calculated.'); } else M.haptic('success');
      M.save(); M.refresh(); M.toast('Saved');
    });
    el.addEventListener('click', function (e) {
      if (!e.target.closest('[data-act="locate"]')) return;
      if (!navigator.geolocation) { M.toast('Location isn’t available — enter coordinates instead.'); return; }
      M.toast('Finding your location…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        sn.lat = Math.round(pos.coords.latitude * 10000) / 10000; sn.lng = Math.round(pos.coords.longitude * 10000) / 10000;
        sn.enabled = true; if (!sn.place) sn.place = 'My location';
        M.save(); M.refresh(); M.toast('Location saved on this device');
      }, function () { M.toast('Couldn’t get your location. You can type coordinates instead.'); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 86400000 });
    });
  };

  R.about = function () {
    return '<div class="stack"><div class="brand-hero">' + M.logo(56) + '<div><strong>Mizan</strong><span>Version ' + M.VERSION + '</span></div></div>' +
      '<ul class="list">' +
      '<li><a class="row grow" href="privacy.html" style="text-decoration:none;color:inherit;gap:12px">' + M.icon('lock') + '<span class="li-main"><strong>Privacy policy</strong><span>What is stored, where, and why</span></span></a></li>' +
      '<li><a class="row grow" href="#/about" style="text-decoration:none;color:inherit;gap:12px">' + M.icon('info') + '<span class="li-main"><strong>About Mizan</strong><span>Health note and helplines</span></span></a></li>' +
      '<li><a class="row grow" href="#/science" style="text-decoration:none;color:inherit;gap:12px">' + M.icon('book') + '<span class="li-main"><strong>Science & sources</strong><span>The research behind every feature</span></span></a></li>' +
      (M.installed && M.installed()
        ? '<li><span class="row grow" style="gap:12px">' + M.icon('good') + '<span class="li-main"><strong>Installed as an app</strong><span>You’re using Mizan from your home screen</span></span></span></li>'
        : '<li><button type="button" class="row grow restore-opt" data-action="install">' + M.icon('download') + '<span class="li-main"><strong>Install as an app</strong><span>Home screen, full screen, works offline — steps for your phone</span></span></button></li>') + '</ul></div>';
  };

  /* ------------------------------------------------------------------ */
  function bindGeneric(el) {
    el.addEventListener('change', function (e) {
      var t = e.target, path = t.getAttribute('data-set');
      if (!path) return;
      if (t.type === 'radio' && !t.checked) return;
      setPath(S(), path, coerce(t));
      if (path === 'theme') M.applyTheme();
      if (path.indexOf('look.') === 0) M.applyLook();
      if (path === 'units' || path === 'clock') M.refresh();
      if (path === 'haptics' && t.checked) M.haptic('success');
      saved();
    });
  }

  M.views.settings = {
    head: function (parts) {
      var sec = parts && SECTIONS.filter(function (x) { return x.id === parts[0]; })[0];
      return sec ? { title: sec.title, sub: 'Settings' } : { title: 'Settings', sub: 'Make Mizan work your way' };
    },
    render: function (el, parts) {
      var id = parts && parts[0];
      var sec = SECTIONS.filter(function (x) { return x.id === id; })[0];
      var groups = [];
      SECTIONS.forEach(function (x) { if (groups.indexOf(x.group) < 0) groups.push(x.group); });
      var nav = groups.map(function (g) {
        return '<h2 class="set-group">' + g + '</h2><ul class="set-list">' + SECTIONS.filter(function (x) { return x.group === g; }).map(function (x) {
          return '<li><a href="#/settings/' + x.id + '"' + (sec && sec.id === x.id ? ' aria-current="page"' : '') + '><span class="set-ico">' + M.icon(x.icon) + '</span><span class="li-main"><strong>' + x.title + '</strong><span>' + x.desc + '</span></span>' + M.icon('right', 'class="set-chev"') + '</a></li>';
        }).join('') + '</ul>';
      }).join('');
      if (!sec) {
        el.innerHTML = '<div class="settings-wrap"><nav class="set-nav" aria-label="Settings sections">' + nav + '</nav><div class="set-body set-empty"><div class="empty">' + M.icon('settings') + '<p><strong>Choose a section</strong></p><p class="muted">Everything in Mizan can be changed here.</p></div></div></div>';
        return;
      }
      el.innerHTML = '<div class="settings-wrap has-section"><nav class="set-nav" aria-label="Settings sections">' + nav + '</nav>' +
        '<section class="set-body panel" aria-labelledby="set-h"><a class="set-back" href="#/settings">' + M.icon('left') + 'All settings</a><h2 id="set-h">' + sec.title + '</h2><p class="muted set-desc">' + sec.desc + '</p>' + R[sec.id]() + '</section></div>';
      var body = M.$('.set-body', el);
      bindGeneric(body);
      if (R[sec.id + 'Bind']) R[sec.id + 'Bind'](body);
    }
  };
})();
