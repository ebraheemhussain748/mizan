/* Mizan — reminders for your timetable
   1. While Mizan is open: "5 min left" before a block ends, with what's next (banner, chime, vibration,
      and a notification if the app is in the background but still running).
   2. While Mizan is closed: a website can't wake itself up, but the phone's calendar can. Mizan writes a
      calendar file (.ics) with one short event per reminder; added to a calendar, those ring on time even
      when Mizan is closed. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var C = function () { return M.calc; };
  var U = function () { return M.ui; };

  /* ------------------------------------------------------------------ */
  /* 1. In-app: a block is about to end                                   */
  /* ------------------------------------------------------------------ */
  var BR = { el: null, key: null, endAt: 0, actx: null };
  var FIRED = 'mizan.br';
  function cfg() { return (M.state && M.state.settings.blockRemind) || {}; }
  function fired() { try { return JSON.parse(localStorage.getItem(FIRED) || '{}'); } catch (e) { return {}; } }
  function markFired(key) {
    try {
      var f = fired(), t = M.today();
      Object.keys(f).forEach(function (k) { if (k.slice(0, 10) < t) delete f[k]; }); // only today's
      f[key] = 1; localStorage.setItem(FIRED, JSON.stringify(f));
    } catch (e) { /* ignore */ }
  }
  function unlock() {
    try {
      if (!BR.actx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; BR.actx = new A(); }
      if (BR.actx.state === 'suspended') BR.actx.resume();
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('pointerdown', unlock, { passive: true });
  function chime() {
    var c = BR.actx;
    if (!c || c.state !== 'running' || cfg().sound === false) return;
    try {
      [[659.3, 0], [523.3, 0.18], [659.3, 0.36]].forEach(function (n) {
        var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + n[1];
        o.type = 'triangle'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35);
      });
    } catch (e) { /* ignore */ }
  }
  /* the block that ends within the next few minutes, if any */
  function dueNow() {
    if (!M.state || !M.state.routines || !M.state.routines.length) return null;
    var k = M.today(), r = C().routineFor(k); if (!r) return null;
    var res = C().resolveBlocks(r, k), now = M.nowMin(), loc = C().locate(res, now), x = loc && loc.cur;
    if (!x || x.b.cat === 'sleep' || x.dur < (cfg().minLen || 15)) return null;
    var left = (x.end - now + 1440) % 1440, before = cfg().before || 5;
    if (left <= 0 || left > before) return null;
    return { key: k + '|' + x.b.id + '|' + x.end, x: x, next: loc.next, left: left, endAt: Date.now() + left * 60000 };
  }
  function text(d) {
    var n = d.next;
    return { title: Math.max(1, Math.round(d.left)) + ' min left: ' + d.x.b.title, body: n ? 'Next: ' + n.b.title + ' at ' + M.fmtTime(n.start) : 'That’s the last block of the day.' };
  }
  function sysNotify(t) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(function (r) { r.showNotification('⏰ ' + t.title, { body: t.body, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: 'mizan-block', renotify: true, data: { kind: 'block' } }); });
      else new Notification('⏰ ' + t.title, { body: t.body, icon: 'assets/icons/icon-192.png', tag: 'mizan-block' });
    } catch (e) { /* ignore */ }
  }
  function show(d) {
    var t = text(d);
    if (!BR.el) {
      BR.el = document.createElement('div');
      BR.el.className = 'block-banner';
      BR.el.setAttribute('role', 'region');
      BR.el.setAttribute('aria-label', 'Timetable reminder');
      BR.el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-bb]'); if (!b) return;
        if (b.getAttribute('data-bb') === 'plan') M.go('today');
        hide();
      });
      document.body.appendChild(BR.el);
    }
    BR.el.innerHTML = '<span class="wb-ico" aria-hidden="true">' + M.icon('clock') + '</span><div class="wb-text"><strong>' + M.esc(t.title) + '</strong><span>' + M.esc(t.body) + '</span></div>' +
      '<div class="wb-btns"><button type="button" class="btn btn-primary btn-sm" data-bb="ok">' + M.icon('check') + 'OK</button><button type="button" class="btn btn-sm" data-bb="plan">See my day</button></div>' +
      '<button type="button" class="icon-btn sm wb-x" data-bb="close" aria-label="Close reminder">' + M.icon('x') + '</button>';
    BR.key = d.key; BR.endAt = d.endAt;
    place();
  }
  function place() {
    if (!BR.el) return;
    BR.el.classList.toggle('below-water', !!document.querySelector('.water-banner:not(.out)'));
    BR.el.classList.toggle('below-pill', !!document.querySelector('.track-pill'));
  }
  function hide() {
    if (!BR.el) return;
    var el = BR.el; BR.el = null; BR.key = null;
    if (M.reduceMotion && M.reduceMotion()) { el.remove(); return; }
    el.classList.add('out'); setTimeout(function () { el.remove(); }, 180);
  }
  function announce(s) {
    var live = document.getElementById('sr-alert');
    if (!live) { live = document.createElement('div'); live.id = 'sr-alert'; live.className = 'sr-only'; live.setAttribute('role', 'alert'); document.body.appendChild(live); }
    live.textContent = ''; setTimeout(function () { live.textContent = s; }, 50);
  }
  M.blockReminder = {
    check: function (test) {
      if (!M.state || !M.state.settings.onboarded || (M.currentRoute && M.currentRoute.name === 'welcome')) { hide(); return; }
      if (BR.el && Date.now() > BR.endAt + 60000) hide(); // the block has ended: the reminder goes too
      place();
      if (!test && cfg().on === false) return;
      var d = test ? testDue() : dueNow();
      if (!d || (!test && fired()[d.key])) return;
      if (!test) markFired(d.key);
      show(d);
      var t = text(d);
      announce(t.title + '. ' + t.body);
      M.haptic('warning'); chime();
      if (document.hidden || !document.hasFocus()) sysNotify(t);
    },
    due: dueNow
  };
  function testDue() {
    var k = M.today(), r = C().routineFor(k), res = r ? C().resolveBlocks(r, k) : [], loc = C().locate(res, M.nowMin());
    var x = (loc && loc.cur) || res[0];
    return x ? { key: 'test', x: x, next: loc && loc.next, left: cfg().before || 5, endAt: Date.now() + 120000 } : null;
  }
  setInterval(function () { M.blockReminder.check(); }, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { M.blockReminder.check(); }, 600); });

  /* ------------------------------------------------------------------ */
  /* 2. Calendar file (.ics) — reminders that work while Mizan is closed  */
  /* ------------------------------------------------------------------ */
  var WHEN = [
    ['end5', '5 min before each block ends', 'With what’s next — “5 min left: School · next: Lunch 2:35 pm”'],
    ['end10', '10 min before each block ends', 'Same, with a bit more time to wrap up'],
    ['start', 'When each block starts', '“Now: Study” — your blocks appear in the calendar too'],
    ['start5', '5 min before each block starts', 'A heads-up before each block']
  ];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'; }
  function utcStamp(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  function at(k, min) { var d = M.parseKey(k); d.setHours(0, 0, 0, 0); d.setMinutes(min); return d; }
  function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  /* lines longer than 75 bytes are folded (RFC 5545), without splitting a character */
  function fold(line) {
    var enc = window.TextEncoder ? new TextEncoder() : null, out = [], cur = '', len = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch >= '\ud800' && ch <= '\udbff' && i + 1 < line.length) { ch += line[++i]; }
      var b = enc ? enc.encode(ch).length : (ch.charCodeAt(0) > 127 ? 3 : 1);
      if (len + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function sig() {
    var s = JSON.stringify((M.state.routines || []).map(function (r) { return [r.id, r.days, r.dates || null, r.blocks.map(function (b) { return [b.start, b.end, b.title, b.cat, b.anchor ? b.anchor.to + (b.anchor.offset || 0) : '']; })]; }));
    var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  /* o: { when, weeks, wake, skipShort, blocks, cats: {cat: false to leave out} } → { ics, count, from, to } */
  function build(o) {
    o = Object.assign({ when: 'end5', weeks: 4, wake: true, skipShort: true, blocks: false, cats: {} }, o || {});
    var now = new Date(), today = M.today(), days = o.weeks * 7, ev = [], dtstamp = utcStamp(now), host = 'mizan.' + (location.hostname || 'app');
    var nowT = now.getTime();
    var add = function (uid, start, end, title, desc, alarmMin) {
      if (end.getTime() <= nowT) return;
      var L = ['BEGIN:VEVENT', 'UID:' + uid + '@' + host, 'DTSTAMP:' + dtstamp, 'DTSTART:' + stamp(start), 'DTEND:' + stamp(end), 'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(desc), 'TRANSP:TRANSPARENT', 'CATEGORIES:Mizan'];
      if (alarmMin !== null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'TRIGGER:' + (alarmMin ? '-PT' + alarmMin + 'M' : 'PT0M'), 'END:VALARM');
      L.push('END:VEVENT');
      ev.push(L);
    };
    var from = null, to = null;
    for (var i = 0; i < days; i++) {
      var k = M.addDays(today, i), r = C().routineFor(k);
      if (!r) continue;
      var res = C().resolveBlocks(r, k);
      res.forEach(function (x, j) {
        var b = x.b, nx = res[(j + 1) % res.length];
        var cross = x.end <= x.start;
        var s = at(k, x.start), e = cross ? at(M.addDays(k, 1), x.end) : at(k, x.end);
        if (b.cat === 'sleep') {
          // the wake-up alert: when this day's sleep ends (the morning part of the day's timeline)
          if (o.wake) { var w = at(k, x.end); add('wake-' + k, w, new Date(w.getTime() + 5 * 60000), '⏰ Wake up', 'Mizan timetable · ' + r.name, 0); }
          return;
        }
        if (o.cats[b.cat] === false) return;
        if (o.skipShort && x.dur < 15) return;
        var label = M.fmtTime(x.start) + '–' + M.fmtTime(x.end);
        if (o.when === 'start' || o.when === 'start5') {
          add(k + '-' + b.id + '-' + o.when, s, e, (o.when === 'start' ? '▶ ' : '') + b.title, 'Mizan timetable · ' + r.name + ' · ' + label + (b.notes ? '\n' + b.notes : ''), o.when === 'start' ? 0 : 5);
        } else {
          var n = o.when === 'end10' ? 10 : 5;
          var endToday = at(k, x.end); // where this block ends in this day's timeline
          var rs = new Date(endToday.getTime() - n * 60000);
          var nextTxt = nx && nx !== x ? ' · next: ' + nx.b.title + ' ' + M.fmtTime(nx.start) : '';
          add(k + '-' + b.id + '-' + o.when, rs, endToday, '⏰ ' + n + ' min left: ' + b.title + nextTxt, 'Mizan timetable · ' + r.name + ' · ' + b.title + ' ' + label, 0);
          if (o.blocks) add(k + '-' + b.id + '-block', s, e, b.title, 'Mizan timetable · ' + r.name + ' · ' + label + (b.notes ? '\n' + b.notes : ''), null);
        }
      });
      if (!from) from = k;
      to = k;
    }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mizan//Timetable reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mizan', 'X-WR-CALDESC:Reminders from your Mizan timetable'];
    ev.forEach(function (L) { lines = lines.concat(L); });
    lines.push('END:VCALENDAR');
    return { ics: lines.map(fold).join('\r\n') + '\r\n', count: ev.length, from: from, to: to };
  }
  function status() {
    var x = M.state.settings.calExport;
    if (!x || !x.at) return { exported: false };
    var t = M.today();
    return { exported: true, at: x.at, until: x.until, stale: x.sig !== sig(), ended: x.until < t, endsSoon: x.until >= t && M.daysBetween(t, x.until) <= 5 };
  }
  function download(text, name) {
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    try {
      var file = typeof File === 'function' ? new File([blob], name, { type: 'text/calendar' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && M.device && M.device().mobile && !(M.device().ios)) return { share: file };
    } catch (e) { /* fall back to a download */ }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    return { downloaded: true };
  }
  /* how to add the file, for the phone you're on */
  function stepsHtml() {
    var d = M.device ? M.device() : {};
    var google = '<li><strong>Google Calendar</strong> (most Android phones) — the app can’t open calendar files, so use the website once:<ol>' +
      '<li>On a computer — or in Chrome on your phone with <em>⋮ → Desktop site</em> on — open <strong>calendar.google.com</strong>.</li>' +
      '<li><em>Settings ⚙ → Add calendar → Create new calendar</em>, name it <strong>Mizan</strong>.</li>' +
      '<li>Open the Mizan calendar’s settings → <em>Event notifications</em> → <em>Add notification</em> → <strong>0 minutes before</strong>. (Google uses this instead of the alerts in the file.)</li>' +
      '<li><em>Settings → Import &amp; export → Import</em>: pick the file, choose <strong>Mizan</strong>, then <em>Import</em>.</li>' +
      '<li>In the Google Calendar app on your phone, make sure <strong>Mizan</strong> is ticked and notifications are on.</li></ol></li>';
    var other = '<li><strong>Samsung Calendar and other Android calendars</strong> — open the downloaded file (from the notification or the Files app), pick your calendar app and add the events.</li>';
    var ios = '<li><strong>iPhone / iPad</strong> — first make a calendar for them: <em>Calendar → Calendars → Add Calendar</em> → name it <strong>Mizan</strong>. Then open the downloaded file (Safari’s downloads ⤓ or the Files app) → <strong>Add All</strong> → choose <strong>Mizan</strong>. The alerts come with the file.</li>';
    var list = d.ios ? ios + google : d.android ? google + other + ios : google + ios + other;
    return '<ol class="cal-steps">' + list + '</ol>' +
      U().note('info', '<p><strong>When your timetable changes:</strong> delete the <strong>Mizan</strong> calendar (that removes all its events at once), make it again and import the new file. Importing twice makes double reminders.</p>') +
      '<p class="hint">Alerts use your calendar’s notification sound — set a louder sound for calendar notifications in your phone’s settings if you like. For a wake-up alarm that keeps ringing, use your phone’s Clock app.</p>';
  }
  function sheet() {
    var last = M.state.settings.calExport || {}, st = status();
    var o = Object.assign({ when: 'end5', weeks: 4, wake: true, skipShort: true, blocks: false, cats: {} }, last.opts || {});
    var used = {};
    (M.state.routines || []).forEach(function (r) { r.blocks.forEach(function (b) { if (b.cat !== 'sleep') used[b.cat] = 1; }); });
    var cats = M.CATS.filter(function (c) { return used[c.id]; });
    var body = '<form class="stack cal-form" novalidate>' +
      '<p class="soft" style="margin:0">A website can’t ring while it’s closed — your phone’s calendar can. Mizan makes a calendar file with a reminder for your blocks; add it to your calendar once, and the reminders come on time even when Mizan is closed.</p>' +
      (st.exported ? U().note(st.stale || st.ended ? 'warn' : 'info', '<p>' + (st.stale ? 'Your timetable changed since you last added it (' + M.fmtDate(st.at, 'short') + '). ' : st.ended ? 'Your calendar reminders ended on ' + M.fmtDate(st.until, 'short') + '. ' : 'Your calendar has reminders until ' + M.fmtDate(st.until, 'short') + '. ') + 'Make a new file, then replace the <strong>Mizan</strong> calendar (steps after the download).</p>') : '') +
      '<fieldset class="field"><legend class="label">Remind me</legend><div class="choice-grid">' + WHEN.map(function (w) {
        return '<label class="choice block"><input type="radio" name="when" value="' + w[0] + '"' + (o.when === w[0] ? ' checked' : '') + '><span><strong>' + w[1] + '</strong></span><small>' + M.esc(w[2]) + '</small></label>';
      }).join('') + '</div></fieldset>' +
      '<label class="switch"><span class="sw-text"><strong>Wake-up alert</strong><span>When your sleep block ends each morning</span></span><input type="checkbox" name="wake"' + (o.wake ? ' checked' : '') + '></label>' +
      '<label class="switch"><span class="sw-text"><strong>Skip short blocks</strong><span>Under 15 minutes, like buffers and breaks</span></span><input type="checkbox" name="skipShort"' + (o.skipShort ? ' checked' : '') + '></label>' +
      '<label class="switch cal-blocks"' + (/^end/.test(o.when) ? '' : ' hidden') + '><span class="sw-text"><strong>Also show my blocks in the calendar</strong><span>Your day appears as events, without extra alerts</span></span><input type="checkbox" name="blocks"' + (o.blocks ? ' checked' : '') + '></label>' +
      '<fieldset class="field"><legend class="label">Which blocks</legend><div class="choice-row">' + cats.map(function (c) {
        return '<label class="choice"><input type="checkbox" data-multi name="cat" value="' + c.id + '"' + (o.cats[c.id] === false ? '' : ' checked') + '><span>' + M.esc(c.label) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      '<div class="field"><label for="cal-weeks">For the next</label><select class="select" id="cal-weeks" name="weeks">' + [[2, '2 weeks'], [4, '4 weeks'], [8, '8 weeks'], [12, '12 weeks']].map(function (w) { return '<option value="' + w[0] + '"' + (+o.weeks === w[0] ? ' selected' : '') + '>' + w[1] + '</option>'; }).join('') + '</select><span class="hint">Special days you planned are included. Make a new file when the time is up.</span></div>' +
      '<p class="cal-count" aria-live="polite"></p></form>';
    M.sheet({
      title: 'Phone alarms for your timetable', body: body, wide: true, noAutofocus: true,
      foot: '<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-cal="make">' + M.icon('download') + 'Make the calendar file</button>',
      onOpen: function (dlg) {
        var read = function () {
          var f = dlg.querySelector('.cal-form'), d = M.formData(f), c = {};
          cats.forEach(function (x) { c[x.id] = false; });
          [].concat(d.cat || []).forEach(function (id) { c[id] = true; });
          return { when: d.when || 'end5', weeks: +d.weeks || 4, wake: !!f.wake.checked, skipShort: !!f.skipShort.checked, blocks: !!f.blocks.checked, cats: c };
        };
        var count = function () {
          var opt = read(), r = build(opt), el = dlg.querySelector('.cal-count');
          dlg.querySelector('.cal-blocks').hidden = !/^end/.test(opt.when);
          el.innerHTML = r.count ? '<strong>' + r.count + ' reminders</strong>' + (opt.blocks && /^end/.test(opt.when) ? ' and blocks' : '') + ' from ' + M.fmtDate(r.from, 'weekday') + ' to ' + M.fmtDate(r.to, 'weekday') + '.' : 'Nothing to remind — pick at least one kind of block.';
          dlg.querySelector('[data-cal=make]').disabled = !r.count;
          return { opt: opt, r: r };
        };
        count();
        dlg.addEventListener('change', count);
        dlg.addEventListener('click', function (e) {
          var b = e.target.closest('[data-cal]'); if (!b) return;
          var a = b.getAttribute('data-cal');
          if (a === 'make') {
            var x = count(); if (!x.r.count) return;
            var res = download(x.r.ics, 'mizan-timetable-reminders.ics');
            M.state.settings.calExport = { at: M.today(), until: x.r.to, sig: sig(), opts: x.opt, count: x.r.count };
            M.save(true); M.haptic('success');
            dlg.querySelector('.sheet-body').setAttribute('tabindex', '0'); // the steps can be long: let keyboards scroll them
            dlg.querySelector('.sheet-body').innerHTML = '<div class="stack"><p style="margin:0"><strong>' + (res.share ? 'Your calendar file is ready.' : 'Downloaded “mizan-timetable-reminders.ics”.') + '</strong> ' + x.r.count + ' reminders, ' + M.fmtDate(x.r.from, 'short') + ' – ' + M.fmtDate(x.r.to, 'short') + '. Now add it to your calendar:</p>' + stepsHtml() + '</div>';
            dlg.querySelector('.sheet-foot').innerHTML = '<span class="spacer"></span>' + (res.share ? '<button type="button" class="btn" data-cal="share">' + M.icon('share') + 'Send to a calendar app</button>' : '<button type="button" class="btn" data-cal="again">' + M.icon('download') + 'Download again</button>') + '<button type="button" class="btn btn-primary" data-close>Done</button>';
            dlg._file = res.share; dlg._ics = x.r.ics;
            if (M.currentRoute && ['plan', 'settings'].indexOf(M.currentRoute.name) >= 0) M.refresh();
          } else if (a === 'share' && dlg._file) navigator.share({ files: [dlg._file], title: 'Mizan timetable reminders' }).catch(function () {});
          else if (a === 'again' && dlg._ics) download(dlg._ics, 'mizan-timetable-reminders.ics');
        });
      }
    });
  }
  /* a short line for Plan / Settings: is the calendar up to date? */
  function noteHtml() {
    var st = status();
    if (!st.exported || !(st.stale || st.ended || st.endsSoon)) return '';
    var why = st.stale ? 'Your timetable changed — your phone’s calendar still has the old reminders.' : st.ended ? 'Your calendar reminders ended on ' + M.fmtDate(st.until, 'short') + '.' : 'Your calendar reminders end on ' + M.fmtDate(st.until, 'short') + '.';
    return U().note('warn', '<p>' + why + '</p><div class="btn-row" style="margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-calnote="1">' + M.icon('bell') + 'Update phone alarms</button></div>');
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-calnote]')) sheet(); });

  M.calendar = { open: sheet, build: build, status: status, sig: sig, note: noteHtml };
})();
