/* Mizan — walk & run tracker.
   GPS distance (with noise and jump filtering), moving time with pause / auto-pause, steps from the
   motion sensor (or estimated from distance), calories from speed-based METs, km splits, a route
   drawing, and a treadmill mode. Everything stays on the device. The live session is saved every few
   seconds so a reload or crash doesn't lose it. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var LIVE = 'mizan.live';

  var S = null;            // live session
  var watchId = null, tickId = null, wakeLock = null, motionOn = false, lastPersist = 0, pill = null;

  /* ------------------------------------------------------------------ */
  /* Maths                                                               */
  /* ------------------------------------------------------------------ */
  function hav(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  /* MET by speed (km/h) — Compendium of Physical Activities (2024), walking and running rows.
     Below ~1 km/h you're standing, which is resting energy (1 MET), not exercise. */
  var MET = [[1.0, 1.0], [2.0, 2.0], [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 6.8], [8.0, 8.3], [8.4, 9.0], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.8], [12.9, 12.3], [13.8, 12.8], [14.5, 14.5], [16.1, 16.0], [17.7, 19.0]];
  function metFor(kmh) {
    if (!kmh || kmh <= MET[0][0]) return 1;
    for (var i = 1; i < MET.length; i++) if (kmh <= MET[i][0]) { var a = MET[i - 1], b = MET[i]; return a[1] + (b[1] - a[1]) * (kmh - a[0]) / (b[0] - a[0]); }
    return MET[MET.length - 1][1];
  }
  M.metFor = metFor;
  function weightKg() { return M.latestWeight() || 65; }
  /* step length: what you typed in Settings, else what Mizan learned from your GPS walks and runs
     (distance ÷ counted steps — how watches calibrate), else an estimate from your height */
  function stepLenM(type) {
    var s = M.state.settings.move;
    if (s.stepCm) return s.stepCm / 100;
    var t = type === 'run' ? 'run' : 'walk';
    if (s.cal && s.cal[t] && s.cal[t].n) return s.cal[t].m;
    var h = M.state.profile.heightCm || 165;
    return h * (t === 'run' ? 0.0065 : 0.00415);
  }
  function learnStride(type, km, steps) {
    var s = M.state.settings.move;
    s.cal = s.cal || {};
    var m = km * 1000 / steps, t = type === 'run' ? 'run' : 'walk';
    if (!(m >= (t === 'run' ? 0.6 : 0.4) && m <= (t === 'run' ? 2.0 : 1.2))) return;
    var c = s.cal[t];
    s.cal[t] = c && c.n ? { m: Math.round((c.m * 0.7 + m * 0.3) * 1000) / 1000, n: c.n + 1 } : { m: Math.round(m * 1000) / 1000, n: 1 };
  }
  function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + M.pad(m) : m) + ':' + M.pad(s); }
  function fmtPace(secPerKm) { if (!secPerKm || !isFinite(secPerKm) || secPerKm > 3600 || secPerKm < 60) return '–:––'; /* faster than 1 min/km isn't on foot */ return Math.floor(secPerKm / 60) + ':' + M.pad(Math.round(secPerKm % 60) % 60); }
  M.fmtPace = fmtPace;

  /* Active calories — what the movement burns on top of resting: (MET − 1) × kg × hours */
  function kcalRate(kmh) { return Math.max(0, metFor(kmh) - 1) * weightKg(); } // kcal per hour
  function kcalOf(km, sec, type) {
    if (!sec) return 0;
    var kmh = km / (sec / 3600);
    if (type === 'treadmill' && !km) kmh = 5;
    return Math.round(kcalRate(kmh) * sec / 3600);
  }
  var TYPICAL = { walk: 1.35, run: 2.8, treadmill: 1.35 }; // m/s, used to estimate time for distance covered while the screen was off

  /* ------------------------------------------------------------------ */
  /* Live session                                                        */
  /* ------------------------------------------------------------------ */
  function newSession(type) {
    return {
      id: M.uid(), type: type, startAt: Date.now(), status: 'active', paused: false, autoPaused: false, waiting: type !== 'treadmill',
      movingMs: 0, lastTick: Date.now(), km: 0, steps: 0, sensorSteps: 0, hasSensor: false,
      route: [], kf: null, anchor: null, win: [], jumps: 0, jumpPts: [], lastMoveAt: null, moved: false, firstFixAt: null,
      splits: [], lastSplitMs: 0, gps: type === 'treadmill' ? 'off' : 'searching', acc: null, gaps: 0, gapKm: 0, gap: null,
      motionAt: 0, lastShakeAt: 0, lastStepAt: 0,
      trk: [],  // every good fix while not paused: [sec since start, lat, lng, accuracy, altitude?]; 'g' = screen-off gap, 'p' = pause
      dist: [], // [moving seconds, km] each time distance is added — for splits and best efforts
      recent: [] // [t, km] for current pace and calories
    };
  }
  function persist(force) {
    if (!S) return;
    if (!force && Date.now() - lastPersist < 4000) return;
    lastPersist = Date.now();
    try { var c = Object.assign({}, S); c.recent = []; c.win = []; localStorage.setItem(LIVE, JSON.stringify(c)); } catch (e) { /* ignore */ }
  }
  function clearLive() { try { localStorage.removeItem(LIVE); } catch (e) { /* ignore */ } }
  function savedLive() { try { var r = localStorage.getItem(LIVE); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

  function speak(text, always) {
    if ((!always && !M.state.settings.move.voice) || !window.speechSynthesis) return;
    try { var u = new SpeechSynthesisUtterance(text); u.rate = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
  /* short tones (coach changes, chases, the safety alarm). The audio is unlocked by the Start tap. */
  var actx = null;
  function audioOn() {
    try { if (!actx) { var A = window.AudioContext || window.webkitAudioContext; if (A) actx = new A(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { /* ignore */ }
  }
  function tones(seq, vol) {
    if (!actx || actx.state !== 'running') return;
    try {
      seq.forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + n[1], len = n[2] || 0.3;
        o.type = n[3] || 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + len + 0.05);
      });
    } catch (e) { /* ignore */ }
  }
  var CUE = { run: [[660, 0], [880, 0.14], [1175, 0.28]], walk: [[880, 0], [660, 0.16]], done: [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45, 0.5]], chase: [[220, 0, 0.18, 'square'], [220, 0.25, 0.18, 'square'], [330, 0.5, 0.3, 'square']], alarm: [[1400, 0, 0.25, 'square'], [1000, 0.3, 0.25, 'square'], [1400, 0.6, 0.25, 'square']] };
  function coachVoice() { return M.state.settings.move.coachVoice !== false; }

  /* ---- Couch to 5K (NHS plan): 9 weeks × 3 runs, each with a 5-minute warm-up and cool-down walk ----
     Voice + tone + vibration at every change; the clock follows real time (a quick stop doesn't pause it,
     the Pause button does), like guided runs in other apps. */
  function R(s) { return ['run', s]; }
  function W(s) { return ['walk', s]; }
  function rpt(n, list) { var o = []; for (var i = 0; i < n; i++) o = o.concat(list); return o; }
  var C25K = [
    [rpt(8, [R(60), W(90)])], [rpt(6, [R(90), W(120)])], [rpt(2, [R(90), W(90), R(180), W(180)])],
    [[R(180), W(90), R(300), W(150), R(180), W(90), R(300)]],
    [[R(300), W(180), R(300), W(180), R(300)], [R(480), W(300), R(480)], [R(1200)]],
    [[R(300), W(180), R(480), W(180), R(300)], [R(600), W(180), R(600)], [R(1500)]],
    [[R(1500)]], [[R(1680)]], [[R(1800)]]
  ];
  function c25kSegs(w, r) { var wk = C25K[w - 1]; var main = wk[Math.min(r, wk.length) - 1]; return [['warm', 300]].concat(main).concat([['cool', 300]]); }
  M.c25k = {
    weeks: 9,
    id: function (w, r) { return 'c25k-w' + w + 'r' + r; },
    parse: function (id) { var m = /^c25k-w(\d)r(\d)$/.exec(id || ''); return m ? { w: +m[1], r: +m[2] } : null; },
    segs: function (id) { var p = M.c25k.parse(id); return p ? c25kSegs(p.w, p.r) : null; },
    total: function (id) { return (M.c25k.segs(id) || []).reduce(function (a, x) { return a + x[1]; }, 0); },
    done: function () { return (M.state.coach && M.state.coach.c25k) || {}; },
    next: function () { var d = M.c25k.done(); for (var w = 1; w <= 9; w++) for (var r = 1; r <= 3; r++) if (!d[M.c25k.id(w, r)]) return M.c25k.id(w, r); return null; },
    describe: function (id) {
      var sg = M.c25k.segs(id); if (!sg) return '';
      var main = sg.slice(1, -1), runs = main.filter(function (x) { return x[0] === 'run'; });
      var dur = function (s) { return s % 60 ? (s >= 60 ? Math.floor(s / 60) + ' min ' + (s % 60) + ' s' : s + ' s') : s / 60 + ' min'; };
      if (main.length === 1) return '5 min warm-up walk, ' + dur(main[0][1]) + ' run, 5 min cool-down';
      var pat = main.slice(0, 2), reps = 0;
      for (var i = 0; i + 1 < main.length; i += 2) if (main[i][1] === pat[0][1] && main[i + 1][1] === pat[1][1]) reps++; else { reps = 0; break; }
      if (reps * 2 === main.length) return '5 min warm-up walk, then ' + dur(pat[0][1]) + ' run / ' + dur(pat[1][1]) + ' walk × ' + reps + ', 5 min cool-down';
      return '5 min warm-up walk, then ' + main.map(function (x) { return (x[0] === 'run' ? 'run ' : 'walk ') + dur(x[1]); }).join(', ') + ', 5 min cool-down · ' + runs.length + ' runs';
    }
  };
  var SEGNAME = { warm: 'Warm-up walk', walk: 'Walk', run: 'Run', cool: 'Cool-down walk' };
  function coachNew(id) { var sg = M.c25k.segs(id); return sg ? { id: id, segs: sg, startAt: Date.now(), pausedMs: 0, pauseAt: null, i: -1, done: false, half: false } : null; }
  function coachElapsed(now) { var c = S.coach; return now - c.startAt - c.pausedMs - (c.pauseAt ? now - c.pauseAt : 0); }
  function coachWhere(now) {
    var c = S.coach, e = coachElapsed(now) / 1000, acc = 0;
    for (var i = 0; i < c.segs.length; i++) { if (e < acc + c.segs[i][1]) return { i: i, left: acc + c.segs[i][1] - e, into: e - acc, total: acc }; acc += c.segs[i][1]; }
    return { i: c.segs.length, left: 0, into: 0, total: acc };
  }
  function durWords(sec) { var m = Math.floor(sec / 60), s2 = sec % 60, mw = m === 1 ? '1 minute' : m + ' minutes'; return s2 ? (m ? mw + ' ' + s2 + ' seconds' : s2 + ' seconds') : mw; }
  function coachTick(now) {
    var c = S.coach; if (!c || c.done || S.paused) return;
    var w = coachWhere(now);
    if (w.i !== c.i) {
      c.i = w.i;
      if (w.i >= c.segs.length) {
        c.done = true; tones(CUE.done); M.haptic('success');
        speak('Workout complete. Brilliant work! Tap Finish to save it.', coachVoice());
        return;
      }
      var sg = c.segs[w.i], nxt = c.segs[w.i + 1];
      tones(sg[0] === 'run' ? CUE.run : CUE.walk); try { if (navigator.vibrate) navigator.vibrate(sg[0] === 'run' ? [200, 100, 200] : [400]); } catch (e) { /* ignore */ }
      var say = sg[0] === 'warm' ? 'Warm up with a brisk walk for 5 minutes.' : sg[0] === 'cool' ? 'Great running! Now cool down with an easy walk for 5 minutes.' : sg[0] === 'run' ? 'Run now, for ' + durWords(sg[1]) + '.' : 'Walk now, for ' + durWords(sg[1]) + '.';
      if (sg[0] === 'run' && !nxt) say += ' Last one!';
      speak(say, coachVoice());
    }
    var runs = c.segs.filter(function (x) { return x[0] === 'run'; }).length, sgc = c.segs[w.i];
    if (!c.half && runs > 1 && w.total + w.into >= c.segs.reduce(function (a, x) { return a + x[1]; }, 0) / 2) { c.half = true; if (sgc && sgc[0] === 'walk') speak('You’re halfway there.', coachVoice()); }
    if (sgc && sgc[0] === 'run' && sgc[1] >= 120 && Math.round(w.left) === 30 && c.warned !== w.i) { c.warned = w.i; speak('30 seconds left.', coachVoice()); }
  }

  /* ---- Chase mode: surprise sprints, like the chases in gamified running apps ----
     Every few minutes: speed up to 20 % faster than your last 30 seconds and hold it for 60 seconds. */
  function chaseNew() { return { next: Date.now() + (150 + Math.random() * 90) * 1000, on: null, won: 0, lost: 0 }; }
  /* speed between the first and last counted points since t0 — distance is counted in steps of ~10–20 m,
     so measuring point to point avoids losing part of a step at either end */
  function speedFrom(t0) {
    var pts = S.recent.filter(function (r) { return r[0] >= t0; });
    if (pts.length < 2) return null;
    var a = pts[0], z = pts[pts.length - 1], dt = (z[0] - a[0]) / 1000;
    return dt >= 10 ? (z[1] - a[1]) * 1000 / dt : null;
  }
  function speedSince(ms) { return speedFrom(Date.now() - ms); }
  function chaseTick(now) {
    var c = S.chase; if (!c || S.paused || S.status !== 'active' || (S.coach && !S.coach.done && S.coach.i >= 0 && S.coach.segs[S.coach.i] && S.coach.segs[S.coach.i][0] !== 'run')) return;
    if (!c.on && now >= c.next) {
      var base = speedSince(45000);
      if (!base || base < (S.type === 'run' ? 1.6 : 0.8)) { c.next = now + 30000; return; } // not moving yet: try again soon
      c.on = { at: now, km0: S.km, need: base * 1.2 };
      tones(CUE.chase, 0.3); try { if (navigator.vibrate) navigator.vibrate([150, 80, 150, 80, 300]); } catch (e) { /* ignore */ }
      speak('Chase! Speed up — stay about 20 percent faster for one minute.', true);
      paintLive(true);
    } else if (c.on && now - c.on.at >= 60000) {
      var got = speedFrom(c.on.at);
      if (got === null) got = (S.km - c.on.km0) * 1000 / ((now - c.on.at) / 1000);
      if (got >= c.on.need) { c.won++; tones(CUE.done, 0.22); speak('You escaped! Ease back to your normal pace.', true); }
      else { c.lost++; tones(CUE.walk, 0.22); speak('Caught this time — shake it off. Another chase comes soon.', true); }
      c.last = { won: got >= c.on.need, got: got, need: c.on.need, at: now };
      c.on = null; c.next = now + (240 + Math.random() * 180) * 1000;
      paintLive(true);
    }
  }

  /* ---- Safety: share where you are; an alarm if you stop moving for a while ----
     A website can't send messages or call by itself — Mizan opens a ready message for you, and the alarm
     is loud so people nearby notice. */
  function safety() { return M.state.settings.move.safety || {}; }
  function locLink(f) { return 'https://maps.google.com/?q=' + f[0].toFixed(5) + ',' + f[1].toFixed(5); }
  function locMessage() {
    var f = S && S.lastFix, me = M.state.profile.name ? M.state.profile.name : 'me';
    var what = S ? (S.type === 'run' ? 'run' : 'walk') : 'walk';
    return 'Hi, it’s ' + me + '. I’m out for a ' + what + ' (tracking with Mizan).' + (f ? ' I’m here: ' + locLink(f) + ' — at ' + M.fmtTime(M.nowMin()) + '.' : ' My location isn’t available right now.');
  }
  function smsHref(phone, body) { var ios = M.device && M.device().ios; return 'sms:' + encodeURIComponent(phone || '').replace(/%2B/g, '+') + (ios ? '&' : '?') + 'body=' + encodeURIComponent(body); }
  function shareSheet(urgent) {
    var sf = safety(), msg = (urgent ? 'I may need help. ' : '') + locMessage();
    var btns = (sf.phone ? '<a class="btn btn-primary" href="' + M.esc(smsHref(sf.phone, msg)) + '" data-x="sms">' + M.icon('send') + 'Text ' + M.esc(sf.name || 'my contact') + '</a><a class="btn" href="tel:' + M.esc(sf.phone) + '">' + M.icon('phone') + 'Call ' + M.esc(sf.name || 'my contact') + '</a>' : '') +
      (navigator.share ? '<button type="button" class="btn" data-x="share">' + M.icon('share') + 'Share…</button>' : '') + '<button type="button" class="btn btn-ghost" data-x="copy">' + M.icon('copy') + 'Copy</button>';
    M.sheet({
      title: urgent ? 'Get help' : 'Share where you are',
      body: '<p class="soft">' + M.esc(msg) + '</p>' + (S && S.lastFix ? '' : U.note('warn', '<p>No GPS position yet — the message says so. Try again outdoors in a moment.</p>')) +
        (sf.phone ? '' : '<p class="hint">Add a safety contact in <a href="#/settings/move">Settings → Walk & run</a> to text or call them in one tap.</p>') +
        '<p class="hint">Mizan opens the message — you press Send. A website can’t send texts or keep sharing your location by itself.</p>',
      foot: '<div class="btn-row" style="width:100%">' + btns + '</div>', noAutofocus: true,
      onOpen: function (dlg) {
        dlg.addEventListener('click', function (e) {
          var b = e.target.closest('[data-x]'); if (!b) return;
          var x = b.getAttribute('data-x');
          if (x === 'share') { navigator.share({ text: msg }).catch(function () {}); }
          if (x === 'copy') { try { navigator.clipboard.writeText(msg).then(function () { M.toast('Copied — paste it into any app'); }); } catch (er) { M.toast('Couldn’t copy here'); } }
        });
      }
    });
  }
  var alarmDlg = null, alarmTimer = null;
  function alarmTick(now) {
    var sf = safety();
    if (!sf.stopAlarm || !S || S.paused || S.status !== 'active' || !S.moved || alarmDlg) return;
    var still = now - Math.max(S.lastEvidenceAt || 0, S.alarmOkAt || 0, S.lastStepAt || 0);
    if (still >= (sf.stopMin || 5) * 60000) raiseAlarm();
  }
  function raiseAlarm() {
    var sf = safety(), loud = false, left = 60;
    tones(CUE.alarm, 0.35); try { if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]); } catch (e) { /* ignore */ }
    speak('Are you OK? Tap I’m OK.', true);
    alarmDlg = M.sheet({
      title: 'Are you OK?',
      body: '<p class="soft">You haven’t moved for ' + (sf.stopMin || 5) + ' minutes during your ' + (S.type === 'run' ? 'run' : 'walk') + '.</p><p class="alarm-count" aria-live="assertive"><strong class="ac-n">60</strong> s until the alarm gets loud</p>',
      foot: '<div class="btn-row" style="width:100%"><button type="button" class="btn btn-primary" data-al="ok">' + M.icon('check') + 'I’m OK</button><button type="button" class="btn btn-danger" data-al="help">' + M.icon('alert') + 'Get help</button></div>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.addEventListener('click', function (e) {
          var b = e.target.closest('[data-al]'); if (!b) return;
          if (b.getAttribute('data-al') === 'ok') { if (S) S.alarmOkAt = Date.now(); dlg.close(); }
          else { dlg.close(); shareSheet(true); }
        });
      },
      onClose: function () { clearInterval(alarmTimer); alarmTimer = null; alarmDlg = null; if (S) S.alarmOkAt = Date.now(); try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* ignore */ } }
    });
    alarmTimer = setInterval(function () {
      left--;
      var n = alarmDlg && alarmDlg.querySelector('.ac-n'); if (n) n.textContent = Math.max(0, left);
      if (left <= 0 && !loud) { loud = true; var t = alarmDlg && alarmDlg.querySelector('.alarm-count'); if (t) t.innerHTML = '<strong>Alarm on</strong> — so people nearby notice. Tap I’m OK to stop it.'; }
      if (loud && left % 2 === 0 && left > -180) { tones(CUE.alarm, 0.6); try { if (navigator.vibrate) navigator.vibrate([700, 300]); } catch (e) { /* ignore */ } }
      if (left <= -180) { clearInterval(alarmTimer); alarmTimer = null; }
    }, 1000);
  }

  /* a sign that you're moving right now (GPS movement, GPS speed, regular steps, counted distance) keeps the clock running */
  function evidence(now, pendingM, sinceT) {
    if (S.autoPaused) {
      // moving again after an auto-pause: if the not-yet-counted distance came at a walking pace, you never really stopped
      var waited = Math.max(0, now - (S.autoAt || now));
      if (pendingM !== undefined && waited > 0 && !S.gap) {
        var secs = Math.max(1, (now - (sinceT || S.autoAt || now)) / 1000);
        if (pendingM / secs >= (S.type === 'run' ? 1.2 : 0.5)) S.movingMs += waited;
      }
      S.autoPaused = false; S.autoAt = null;
    }
    S.lastEvidenceAt = now; S.evMs = S.movingMs;
  }
  function addDistance(m) {
    var now = Date.now(), before = S.km;
    // distance counted after an auto-pause: if it came at a walking pace the whole wait was walking
    // (slow walk, weak GPS); if not, you stood still and then walked — count only the time those metres take
    if (S.autoPaused && S.autoAt && !S.gap) {
      var waited = Math.max(0, now - S.autoAt), implied = m / Math.max(1, waited / 1000);
      var slowest = S.type === 'run' ? 1.2 : 0.5;
      S.movingMs += implied >= slowest ? waited : Math.min(waited, m / (S.type === 'run' ? 2.2 : 1.0) * 1000);
    }
    S.autoAt = null; S.autoPaused = false;
    var msBefore = S.lastAddMs === undefined ? S.lastSplitMs : S.lastAddMs;
    S.km += m / 1000;
    evidence(now);
    S.lastMoveAt = now; S.moved = true;
    S.recent.push([now, S.km]);
    while (S.recent.length > 2 && now - S.recent[1][0] > 60000) S.recent.shift();
    // a split for every kilometre passed, timed by where inside this stretch the kilometre fell
    while (Math.floor(S.km) > S.splits.length) {
      var b = S.splits.length + 1;
      var frac = Math.min(1, Math.max(0, (b - before) / Math.max(1e-9, S.km - before)));
      var at = msBefore + (S.movingMs - msBefore) * frac;
      var split = Math.max(1, (at - S.lastSplitMs) / 1000);
      S.splits.push(Math.round(split));
      S.lastSplitMs = at;
      if (M.state.settings.move.splitHaptic) M.haptic('success');
      speak(b + ' kilometre' + (b > 1 ? 's' : '') + '. Time ' + Math.floor(at / 60000) + ' minutes. Pace ' + fmtPace(split).replace(':', ' ') + ' per kilometre.');
    }
    S.lastAddMs = S.movingMs;
    distSample();
  }
  function distSample() {
    S.dist = S.dist || [];
    S.dist.push([Math.round(S.movingMs / 100) / 10, Math.round(S.km * 10000) / 10000]);
    if (S.dist.length > 12000) S.dist = S.dist.filter(function (_, i) { return i % 2 === 0; });
  }
  function trkMark(m) { if (S && S.trk && S.trk.length && typeof S.trk[S.trk.length - 1] !== 'string') S.trk.push(m); }
  function tmFactor() { var c = M.state.settings.move.cal; return c && c.tm ? c.tm : 1; } // learned from treadmill distances you typed in
  function cadenceType(times) { // treadmill: running cadence → running stride
    return times.length >= 4 && times.length / 15 * 60 > 140 ? 'run' : 'walk';
  }

  /* ---- GPS ----
     1. Fixes worse than the accuracy limit are ignored ("GPS weak").
     2. A small Kalman filter smooths the wobble of each fix (heavier smoothing when the fix is less accurate).
     3. A fix that jumps faster than a person can move is ignored; three odd fixes that agree mean the
        old position was wrong, so tracking restarts there without adding the jump.
     4. Distance is only added while you're really moving: the phone's GPS speed when it gives one,
        the motion sensor (a phone lying still isn't walking), and how far you got over the last seconds.
        Standing still, GPS wobble adds nothing; slow walking is never lost — it's added once it's clear. */
  function kfStep(kf, lat, lng, acc, t, q) {
    var dt = kf ? Math.max(0, (t - kf.t) / 1000) : 0;
    if (!kf || dt > 30) return { lat: lat, lng: lng, v: acc * acc, t: t }; // first fix, or after a long gap: start from this fix
    if (dt > 0) { kf.v += dt * q * q; kf.t = t; }
    var K = kf.v / (kf.v + acc * acc);
    kf.lat += K * (lat - kf.lat); kf.lng += K * (lng - kf.lng);
    kf.v = (1 - K) * kf.v;
    return kf;
  }
  function isMoving(c, acc) {
    var now = Date.now();
    var sp = c.speed;
    if (typeof sp === 'number' && isFinite(sp) && sp >= 0) {
      if (sp >= 0.6) return true;              // GPS speed is reliable when it says you're moving
      if (sp < 0.3 && acc <= 25) return false; // and when a good fix says you're standing
    }
    // phone perfectly still (lying on a table, in a parked car) — not walking
    if (S.hasSensor && now - S.motionAt < 2000 && now - S.lastShakeAt > 6000) return false;
    var w = S.win;
    if (w.length < 2) return false;
    var a = w[0], b = w[w.length - 1], span = (b[0] - a[0]) / 1000;
    if (span < 8) return false;
    var net = hav([a[1], a[2]], [b[1], b[2]]), path = 0;
    for (var i = 1; i < w.length; i++) path += hav([w[i - 1][1], w[i - 1][2]], [w[i][1], w[i][2]]);
    // walking goes somewhere; GPS wobble wanders back and forth around the same spot
    return net / span >= 0.35 && net >= Math.max(6, acc * 0.5) && net >= path * 0.5;
  }
  function onPos(p) {
    if (!S || S.status === 'done') return;
    var c = p.coords, t = p.timestamp || Date.now(), acc = c.accuracy || 50;
    var raw = [c.latitude, c.longitude];
    S.acc = Math.round(acc);
    var limit = M.state.settings.move.minAccuracy || 30;
    if (acc > limit) { S.gps = 'weak'; paintLive(); return; }
    S.gps = 'good';
    S.lastFix = [raw[0], raw[1], t];
    if (!S.firstFixAt) { S.firstFixAt = Date.now(); S.firstFixT = t; S.waiting = false; }
    var maxSpeed = S.type === 'run' ? 9 : 6; // m/s — anything faster is a GPS jump (or a vehicle)
    if (S.kf) {
      var dtk = Math.max(1, (t - S.kf.t) / 1000), dj = hav([S.kf.lat, S.kf.lng], raw);
      if (dj > acc + 15 && dj / dtk > maxSpeed) {
        S.jumps++; S.jumpPts = S.jumpPts.concat([raw]).slice(-3);
        if (S.jumps >= 3 && hav(S.jumpPts[0], S.jumpPts[2]) < 3 * acc + 10) {
          // could you have got here from the last counted point? then it's real distance; if not, it was a jump
          var reach = S.anchor && S.anchorT ? hav(S.anchor, raw) / Math.max(1, (t - S.anchorT) / 1000) : Infinity;
          S.kf = null; S.win = [];
          if (!(reach <= maxSpeed)) { S.anchor = null; trkMark('p'); }
        } else { paintLive(); return; }
      }
      S.jumps = 0; S.jumpPts = [];
    }
    if (!S.paused) {
      S.trk = S.trk || [];
      var fx = [Math.round((t - S.startAt) / 100) / 10, +raw[0].toFixed(6), +raw[1].toFixed(6), Math.round(acc)];
      if (typeof c.altitude === 'number' && isFinite(c.altitude) && (c.altitudeAccuracy === null || c.altitudeAccuracy === undefined || c.altitudeAccuracy <= 25)) fx.push(Math.round(c.altitude * 10) / 10);
      S.trk.push(fx);
      if (S.trk.length > 14400) S.trk = S.trk.filter(function (x, i) { return typeof x === 'string' || i % 2 === 0; }); // over 4 h: keep every other fix
    }
    S.kf = kfStep(S.kf, raw[0], raw[1], acc, t, S.type === 'run' ? 4 : 2);
    var sm = [S.kf.lat, S.kf.lng];
    S.win = S.win.filter(function (x) { return t - x[0] <= 15000; });
    S.win.push([t, sm[0], sm[1]]);
    if (!S.anchor || S.paused) {
      S.anchor = sm; S.anchorT = t;
      if (!S.paused && !S.route.length) S.route.push([+sm[0].toFixed(5), +sm[1].toFixed(5)]);
      paintLive(); return;
    }
    var d = hav(S.anchor, sm);
    var gate = Math.max(S.type === 'run' ? 12 : 8, Math.min(20, acc)); // longer steps between counted points = less zig-zag from GPS noise
    var moving = isMoving(c, acc);
    S.movRun = moving ? (S.movRun || 0) + 1 : 0; // two fixes in a row, so one wobble doesn't start the clock
    if (S.movRun >= 2 && !S.paused) evidence(Date.now(), d, S.anchorT ? Date.now() - (t - S.anchorT) : undefined);
    // far from the last counted point for several fixes in a row = really moved, even if slowly
    S.far = d > Math.max(25, 2 * acc) ? (S.far || 0) + 1 : 0;
    if (!S.moved && !moving && d < gate && t - (S.firstFixT || t) < 10000) { S.anchor = sm; S.anchorT = t; } // just after the first fix, follow the filter while it settles
    else if (d >= gate && (moving || S.far >= 5)) {
      S.far = 0;
      if (S.gap && S.gap.back) settleGap(Date.now(), d / 1000); // time for the screen-off stretch first, so splits come out right
      addDistance(d);
      S.anchor = sm; S.anchorT = t;
      S.route.push([+sm[0].toFixed(5), +sm[1].toFixed(5)]);
      if (S.route.length > 1500) S.route = S.route.filter(function (_, i) { return i % 2 === 0 || i === S.route.length - 1; });
    }
    paintLive();
    persist();
  }
  /* ---- After the session: measure the whole track again ----
     While you move, each fix is judged on what came before it. Afterwards every fix can be judged on the
     fixes before AND after it: a forward Kalman pass plus a backward (Rauch–Tung–Striebel) pass over a
     constant-velocity model. Wobble cancels out, corners keep their shape, and standing still adds
     nothing. This is the same idea as Strava re-calculating distance after upload. */
  function rts(pts, q) {
    var n = pts.length, q2 = q * q;
    function axis(key) {
      var xf = [], Pf = [], xp = [], Pp = [];
      var x = [pts[0][key], 0], P = [[pts[0].r, 0], [0, 4]];
      for (var i = 0; i < n; i++) {
        if (i > 0) {
          var dt = Math.max(0.2, pts[i].t - pts[i - 1].t), dt2 = dt * dt;
          x = [x[0] + dt * x[1], x[1]];
          P = [[P[0][0] + dt * (P[1][0] + P[0][1]) + dt2 * P[1][1] + q2 * dt2 * dt / 3, P[0][1] + dt * P[1][1] + q2 * dt2 / 2],
            [P[1][0] + dt * P[1][1] + q2 * dt2 / 2, P[1][1] + q2 * dt]];
        }
        xp.push(x); Pp.push(P);
        var R = pts[i].r, Sv = P[0][0] + R, K0 = P[0][0] / Sv, K1 = P[1][0] / Sv, yv = pts[i][key] - x[0];
        x = [x[0] + K0 * yv, x[1] + K1 * yv];
        P = [[(1 - K0) * P[0][0], (1 - K0) * P[0][1]], [P[1][0] - K1 * P[0][0], P[1][1] - K1 * P[0][1]]];
        xf.push(x); Pf.push(P);
      }
      var xs = new Array(n); xs[n - 1] = xf[n - 1];
      for (var k = n - 2; k >= 0; k--) {
        var d = Math.max(0.2, pts[k + 1].t - pts[k].t), A = Pf[k], B = Pp[k + 1];
        var det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
        if (!(Math.abs(det) > 1e-12)) { xs[k] = xf[k]; continue; }
        var i00 = B[1][1] / det, i01 = -B[0][1] / det, i10 = -B[1][0] / det, i11 = B[0][0] / det;
        var a00 = A[0][0] + d * A[0][1], a01 = A[0][1], a10 = A[1][0] + d * A[1][1], a11 = A[1][1]; // P·Fᵀ
        var c00 = a00 * i00 + a01 * i10, c01 = a00 * i01 + a01 * i11, c10 = a10 * i00 + a11 * i10, c11 = a10 * i01 + a11 * i11;
        var e0 = xs[k + 1][0] - xp[k + 1][0], e1 = xs[k + 1][1] - xp[k + 1][1];
        xs[k] = [xf[k][0] + c00 * e0 + c01 * e1, xf[k][1] + c10 * e0 + c11 * e1];
      }
      return xs;
    }
    var X = axis('x'), Y = axis('y');
    return pts.map(function (p, i) { return { t: p.t, x: X[i][0], y: Y[i][0], v: Math.sqrt(X[i][1] * X[i][1] + Y[i][1] * Y[i][1]), alt: p.alt }; });
  }
  /* trk → { km, segs: [[{t,x,y,v}]], lat0, lng0 } — distance of the smoothed track (gaps joined in a straight line) */
  function refine(trk, type, tune) {
    tune = tune || {};
    var fixes = (trk || []).filter(function (x) { return typeof x !== 'string'; });
    if (fixes.length < 10) return null;
    var lat0 = fixes[0][1], lng0 = fixes[0][2], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110574;
    var segs = [], cur = [], breaks = [];
    trk.forEach(function (f) {
      if (typeof f === 'string') { if (cur.length) { segs.push(cur); breaks.push(f); } cur = []; return; }
      var sd = Math.max(1.5, f[3] / 1.515); // accuracy is a 68 % radius → spread per axis
      cur.push({ t: f[0], x: (f[2] - lng0) * kx, y: (f[1] - lat0) * ky, r: sd * sd, alt: f[4] });
    });
    if (cur.length) { segs.push(cur); breaks.push(null); }
    var q = tune.q || (type === 'run' ? 1.0 : 0.5), vmin = tune.vmin || (type === 'run' ? 0.6 : 0.3), gate = tune.gate || 0, m = 0, out = [];
    segs.forEach(function (sg, si) {
      var sm = sg.length >= 3 ? rts(sg, q) : sg.map(function (p) { return { t: p.t, x: p.x, y: p.y, v: 0, alt: p.alt }; });
      out.push(sm);
      var ax = sm[0].x, ay = sm[0].y;
      for (var i = 1; i < sm.length; i++) {
        if ((sm[i].v + sm[i - 1].v) / 2 < vmin) { ax = sm[i].x; ay = sm[i].y; continue; }
        var dd = Math.sqrt(Math.pow(sm[i].x - ax, 2) + Math.pow(sm[i].y - ay, 2));
        if (dd >= gate) { m += dd; ax = sm[i].x; ay = sm[i].y; }
      }
      // a screen-off gap: you went from where it stopped to where it started again (as the live count does)
      if (si > 0 && breaks[si - 1] === 'g') {
        var a = out[si - 1][out[si - 1].length - 1], b = sm[0];
        var gd = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        if (gd > 15) m += gd;
      }
    });
    return { km: m / 1000, segs: out, lat0: lat0, lng0: lng0, kx: kx, ky: ky };
  }
  /* the distance to keep: the re-measured one, within sensible limits of the live count
     (corners and wobble move it a few per cent; a big difference means something odd — keep the live one) */
  function finalKm(live, r) {
    if (!r || !(r.km > 0) || live < 0.05) return live;
    var ratio = r.km / live;
    if (ratio > 1.25 || ratio < 0.8) return live;
    return Math.min(r.km, live * 1.08); // the smoother can only add a little; GPS jitter can make a track look longer than it was
  }
  /* climb from altitude readings: averaged over ~20 s, counted only when it rises 4 m past the last low point */
  function climbOf(segs) {
    var alts = [];
    segs.forEach(function (sg) { sg.forEach(function (p) { if (typeof p.alt === 'number') alts.push([p.t, p.alt]); }); });
    var total = segs.reduce(function (a, sg) { return a + sg.length; }, 0);
    if (alts.length < 30 || alts.length < total * 0.6) return null;
    var avg = alts.map(function (p, i) { var s = 0, n = 0; for (var j = i; j >= 0 && p[0] - alts[j][0] <= 10; j--) { s += alts[j][1]; n++; } for (j = i + 1; j < alts.length && alts[j][0] - p[0] <= 10; j++) { s += alts[j][1]; n++; } return s / n; });
    var gain = 0, low = avg[0], high = avg[0];
    avg.forEach(function (h) {
      if (h < low) low = h;
      if (h - low >= 4) { gain += h - low; low = h; }
      high = Math.max(high, h);
    });
    return Math.round(gain);
  }
  /* km splits from the [seconds, km] series */
  function splitsFrom(series) {
    var out = [], last = 0, next = 1;
    for (var i = 1; i < series.length; i++) {
      var a = series[i - 1], b = series[i];
      while (b[1] >= next && next <= 500) {
        var f = (next - a[1]) / Math.max(1e-9, b[1] - a[1]), at = a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, f));
        out.push(Math.max(1, Math.round(at - last))); last = at; next++;
      }
    }
    return out;
  }
  /* fastest time for each distance inside the session (two-pointer over the series) */
  var EFFORTS = [[0.4, '400 m'], [1, '1 km'], [1.609, '1 mile'], [5, '5 km'], [10, '10 km'], [21.0975, 'Half marathon'], [42.195, 'Marathon']];
  function bestEfforts(series) {
    var out = {};
    if (!series || series.length < 2) return out;
    var total = series[series.length - 1][1];
    EFFORTS.forEach(function (e) {
      var D = e[0];
      if (total < D) return;
      var best = Infinity, j = 0;
      for (var i = 0; i < series.length; i++) {
        while (j < series.length - 1 && series[j][1] - series[i][1] < D) j++;
        if (series[j][1] - series[i][1] < D) break;
        var a = series[j - 1] || series[j], b = series[j];
        var f = b[1] === a[1] ? 1 : (series[i][1] + D - a[1]) / (b[1] - a[1]);
        var tEnd = a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, f));
        best = Math.min(best, tEnd - series[i][0]);
      }
      if (isFinite(best) && best > D * 1000 / 12) out[e[1]] = Math.round(best); // faster than 12 m/s isn't on foot
    });
    return out;
  }
  /* the smoothed track, small enough to keep: every ~5 s (more at turns), as [sec, lat, lng, alt?] */
  function compactTrack(r) {
    if (!r) return [];
    var pts = [];
    r.segs.forEach(function (sg, si) {
      var lastT = -1e9, lastH = null;
      sg.forEach(function (p, i) {
        var keep = i === 0 || i === sg.length - 1 || p.t - lastT >= 5;
        if (!keep && i > 0) { var h = Math.atan2(p.y - sg[i - 1].y, p.x - sg[i - 1].x); if (lastH !== null && Math.abs(((h - lastH + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.5 && p.t - lastT >= 2) keep = true; }
        if (!keep) return;
        if (i > 0) lastH = Math.atan2(p.y - sg[i - 1].y, p.x - sg[i - 1].x);
        lastT = p.t;
        var row = [Math.round(p.t), +(r.lat0 + p.y / r.ky).toFixed(6), +(r.lng0 + p.x / r.kx).toFixed(6)];
        if (typeof p.alt === 'number') row.push(Math.round(p.alt));
        pts.push(row);
      });
      if (si < r.segs.length - 1) pts.push(0); // segment break
    });
    while (pts.length > 1800) pts = pts.filter(function (x, i) { return x === 0 || i % 2 === 0; });
    return pts;
  }

  function onErr(e) {
    if (!S) return;
    S.gps = e && e.code === 1 ? 'denied' : 'weak';
    paintLive();
  }

  /* ---- Steps from the accelerometer ----
     Peaks in the smoothed acceleration, with a threshold that adapts to how hard you step. A step only
     counts once 6 regular steps come in a row (0.25–2 s apart, similar rhythm) — so picking up the phone,
     shaking it or putting it in a pocket doesn't add steps. */
  var SD = null;
  function stepReset() { SD = { lp: null, base: null, above: false, amp: 1.5, lastPeakT: 0, cand: [], run: false }; }
  stepReset();
  function countStep(now) {
    if (!S || S.paused) return;
    S.sensorSteps++; S.lastStepAt = now;
    if (S.type !== 'treadmill') evidence(now);
    S.stepTimes = (S.stepTimes || []).filter(function (t) { return now - t <= 15000; }); S.stepTimes.push(now);
    if (S.type === 'treadmill') { S.km += stepLenM(cadenceType(S.stepTimes)) * tmFactor() / 1000; S.lastMoveAt = now; S.moved = true; S.autoPaused = false; if (S.sensorSteps % 10 === 0) distSample(); }
  }
  function candidate(now) {
    if (now - SD.lastPeakT < 250) return; // the same step bouncing
    var gap = now - SD.lastPeakT;
    SD.lastPeakT = now;
    if (gap > 2000) { SD.cand = [now]; SD.run = false; return; }
    if (SD.run) {
      // still the same rhythm? shaking or bumping the phone breaks it and nothing is counted until 6 regular steps again
      if (gap < SD.med * 0.7 || gap > SD.med * 1.45) { SD.run = false; SD.cand = [now]; return; }
      SD.med = SD.med * 0.8 + gap * 0.2;
      countStep(now); return;
    }
    SD.cand.push(now);
    if (SD.cand.length >= 6) {
      var iv = [];
      for (var i = 1; i < SD.cand.length; i++) iv.push(SD.cand[i] - SD.cand[i - 1]);
      var med = iv.slice().sort(function (a, b) { return a - b; })[Math.floor(iv.length / 2)];
      var regular = iv.every(function (x) { return x > med * 0.7 && x < med * 1.4; });
      if (regular) { SD.run = true; SD.med = med; SD.cand.forEach(function (t) { countStep(t); }); SD.cand = []; }
      else SD.cand.shift();
    }
  }
  function onMotion(e) {
    if (!S || S.status === 'done') return;
    var a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.x === undefined) return;
    var now = Date.now();
    var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    S.hasSensor = true; S.motionAt = now;
    if (SD.lp === null) { SD.lp = mag; SD.base = mag; }
    SD.lp += 0.3 * (mag - SD.lp);          // smooth sensor jitter
    SD.base += 0.015 * (SD.lp - SD.base);  // slow baseline ≈ gravity
    var x = SD.lp - SD.base;
    if (Math.abs(x) > 0.35) S.lastShakeAt = now;
    SD.amp = Math.max(SD.amp * 0.997, Math.abs(x));
    var th = Math.max(0.9, SD.amp * 0.4);
    if (!SD.above && x > th) { SD.above = true; candidate(now); }
    else if (SD.above && x < th * 0.3) SD.above = false;
  }
  function startMotion() {
    stepReset();
    if (motionOn || !('DeviceMotionEvent' in window)) return Promise.resolve();
    var go = function () { window.addEventListener('devicemotion', onMotion); motionOn = true; };
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      return DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') go(); }).catch(function () {});
    }
    go(); return Promise.resolve();
  }
  function stopMotion() { window.removeEventListener('devicemotion', onMotion); motionOn = false; stepReset(); }

  function wake() {
    if (!M.state.settings.move.keepAwake || !('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  function unwake() { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; } }

  /* ---- Time ----
     The clock starts at the first good GPS fix, pauses when you stop (auto-pause), and only counts time
     you were moving. While the screen was off the phone gets no GPS: when it comes back, time for that
     gap is counted from the distance you covered (standing still with the screen off adds nothing). */
  function tick() {
    if (!S) return;
    var now = Date.now(), dt = now - S.lastTick;
    S.lastTick = now;
    if (S.gap && !S.gap.back) dt = 0; // hidden: handled when the screen comes back
    if (S.gap && S.gap.back && now - S.gap.back > 20000) settleGap(now, 0);
    if (S.status === 'active' && !S.paused && !(S.gap && !S.gap.back)) {
      var last = S.lastEvidenceAt || 0;
      var idle = S.type === 'treadmill' ? S.moved && now - (S.lastStepAt || now) > 15000
        : last ? now - last > 12000 : !!S.firstFixAt && now - S.firstFixAt > 10000; // standing at the start doesn't count either
      var auto = M.state.settings.move.autoPause && idle;
      if (auto && !S.autoPaused && S.type !== 'treadmill') {
        // just stopped: take back the seconds counted since the last sign of movement, and remember when that was
        S.movingMs = last ? Math.min(S.movingMs, S.evMs || 0) : 0;
        S.autoAt = last || S.firstFixAt;
      }
      S.autoPaused = auto;
      S.waiting = S.type !== 'treadmill' && !S.firstFixAt;
      if (!auto && !S.waiting && dt > 0) {
        S.movingMs += Math.min(dt, 5000);
      }
    }
    if (S.coach) coachTick(now);
    if (S.chase) chaseTick(now);
    alarmTick(now);
    S.steps = stepsNow();
    paintLive();
    persist();
  }
  function settleGap(now, pendingKm) {
    var g = S.gap; S.gap = null; S.autoAt = null;
    var hiddenMs = g.back - g.at;
    var km = Math.max(0, S.km + (pendingKm || 0) - g.km);
    if (km < 0.02 || S.paused) return;
    var typical = TYPICAL[S.type] || 1.35;
    var implied = km * 1000 / (hiddenMs / 1000);
    var creditMs = implied >= typical * 0.6 ? hiddenMs : Math.min(hiddenMs, km * 1000 / typical * 1000);
    S.movingMs += creditMs;
    S.gapKm += km; S.gaps++;
    S.lastMoveAt = now;
    evidence(now);
  }
  function stepsNow() {
    var est = Math.round(S.km * 1000 / stepLenM(S.type));
    if (!S.hasSensor) return est;
    return S.sensorSteps + Math.round((S.gapKm || 0) * 1000 / stepLenM(S.type));
  }
  document.addEventListener('visibilitychange', function () {
    if (!S || S.status === 'done') return;
    if (document.hidden) { if (!S.gap) { S.gap = { at: Date.now(), km: S.km }; trkMark('g'); } }
    else {
      if (S.gap && !S.gap.back) S.gap.back = Date.now();
      S.lastTick = Date.now(); S.win = [];
      wake(); tick();
    }
  });

  function startWatch() {
    if (S.type === 'treadmill' || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }
  function stopAll() {
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    clearInterval(tickId); tickId = null;
    if (alarmDlg) alarmDlg.close();
    stopMotion(); unwake();
    showPill(false);
  }

  function begin(type, resume, opts) {
    audioOn();
    S = resume || newSession(type);
    if (!resume && opts) { if (opts.coach) S.coach = coachNew(opts.coach); if (opts.chase && type !== 'treadmill') S.chase = chaseNew(); }
    S.lastTick = Date.now();
    if (resume) { S.recent = []; S.win = []; S.kf = null; S.anchor = null; S.gap = null; S.jumps = 0; S.jumpPts = []; S.trk = S.trk || []; S.dist = S.dist || []; trkMark('p'); } // don't join a straight line across the reload
    startWatch();
    startMotion();
    wake();
    clearInterval(tickId); tickId = setInterval(tick, 1000);
    M.haptic('success');
    persist(true);
    M.render(true);
  }
  function togglePause() {
    if (!S) return;
    S.paused = !S.paused;
    if (S.paused) trkMark('p');
    if (S.coach) { if (S.paused) S.coach.pauseAt = Date.now(); else if (S.coach.pauseAt) { S.coach.pausedMs += Date.now() - S.coach.pauseAt; S.coach.pauseAt = null; } }
    if (!S.paused) { S.anchor = null; S.win = []; S.lastMoveAt = Date.now(); S.autoAt = null; S.autoPaused = false; S.lastEvidenceAt = Date.now(); S.evMs = S.movingMs; } // restart the line where you are now
    M.haptic(S.paused ? 'warning' : 'success');
    persist(true); paintLive(true);
  }
  function finish(manualKm) {
    if (!S) return null;
    if (S.gap && S.gap.back) settleGap(Date.now(), 0);
    tick();
    stopAll();
    var liveKm = S.km, manual = manualKm !== undefined && manualKm !== null;
    // GPS: measure the whole track again now that every fix can be compared with the ones after it
    var r = !manual && S.type !== 'treadmill' ? refine(S.trk, S.type) : null;
    var km = manual ? manualKm : finalKm(liveKm, r);
    var factor = liveKm > 0.001 ? km / liveKm : 1;
    var series = (S.dist || []).map(function (x) { return [x[0], x[1] * factor]; });
    var sec = Math.round(S.movingMs / 1000);
    var est = Math.round(km * 1000 / stepLenM(S.type));
    var steps = S.hasSensor ? S.sensorSteps + Math.round((S.gapKm || 0) * 1000 / stepLenM(S.type)) : est, src = S.hasSensor ? 'sensor' : 'estimate';
    // a sensor count that doesn't fit the distance (e.g. the phone was in a bag) → use the estimate
    if (S.hasSensor && S.type !== 'treadmill' && km >= 0.3) {
      var stride = km * 1000 / Math.max(1, steps);
      if (stride < 0.35 || stride > 2.2) { steps = est; src = 'estimate'; }
    }
    if (sec > 0 && steps / (sec / 60) > 240) { steps = Math.round(sec / 60 * 240); }
    var kcal = kcalOf(km, sec, S.type);
    var a = {
      id: S.id, type: S.type, date: M.dateKey(new Date(S.startAt)), startAt: S.startAt, endAt: Date.now(),
      movingSec: sec, km: Math.round(km * 1000) / 1000, steps: steps, stepsSource: src,
      kcal: kcal, splits: series.length > 1 ? splitsFrom(series) : S.splits.slice(), route: S.route.slice(), gaps: S.gaps
    };
    if (Math.abs(km - liveKm) >= 0.005) a.liveKm = Math.round(liveKm * 1000) / 1000;   // re-measured after the session
    if (S.type !== 'treadmill' || manual) a.best = bestEfforts(series);
    if (r) { var cl = climbOf(r.segs); if (cl !== null) a.climb = cl; a.trk = compactTrack(r); }
    if (S.coach) a.coach = S.coach.id;
    if (S.chase) a.chase = { won: S.chase.won, lost: S.chase.lost };
    a.prs = newRecords(a);
    // learn your step length from a clean GPS session with counted steps; a treadmill distance you typed calibrates the treadmill
    if (S.type !== 'treadmill' && !S.coach && src === 'sensor' && S.sensorSteps >= 300 && km >= 0.4 && !S.gaps) learnStride(S.type, km, S.sensorSteps); // not coached runs: they mix walking and running
    if (S.type === 'treadmill' && manual && liveKm >= 0.3) {
      var cal = M.state.settings.move.cal = M.state.settings.move.cal || {}, f = M.clamp(manualKm / liveKm * tmFactor(), 0.6, 1.6);
      cal.tm = Math.round((cal.tm ? cal.tm * 0.6 + f * 0.4 : f) * 1000) / 1000;
    }
    if (S.coach) {
      var cw = coachWhere(Date.now()), tot = M.c25k.total(S.coach.id);
      if (S.coach.done || cw.total + cw.into >= tot * 0.9) { M.state.coach = M.state.coach || {}; M.state.coach.c25k = M.state.coach.c25k || {}; M.state.coach.c25k[S.coach.id] = a.date; a.coachDone = true; }
    }
    M.state.activities.push(a);
    // keep the list light: routes for the last 60 sessions, full tracks for the last 25
    var acts = M.state.activities;
    if (acts.length > 60) acts[acts.length - 61].route = [];
    if (acts.length > 25) delete acts[acts.length - 26].trk;
    M.save(true);
    checkBadges(a);
    S = null; clearLive();
    M.haptic('success');
    return a;
  }
  function discard() { stopAll(); S = null; clearLive(); M.toast('Session discarded'); }

  /* ---- Personal records and badges ---- */
  function records(type, exceptId) {
    var best = {}, longest = null, n = 0;
    (M.state.activities || []).forEach(function (x) {
      if (x.type !== type || x.id === exceptId) return;
      n++;
      Object.keys(x.best || {}).forEach(function (k) { if (!best[k] || x.best[k] < best[k].sec) best[k] = { sec: x.best[k], id: x.id, date: x.date }; });
      if (!x.manual && (!longest || x.km > longest.km)) longest = { km: x.km, id: x.id, date: x.date };
    });
    return { best: best, longest: longest, n: n };
  }
  M.moveRecords = records;
  function newRecords(a) {
    var prev = records(a.type, a.id), out = [];
    if (!prev.n) return out; // the very first one isn't a "record" yet
    Object.keys(a.best || {}).forEach(function (k) { if (!prev.best[k] || a.best[k] < prev.best[k].sec) out.push(k); });
    if (prev.longest && a.km > prev.longest.km && a.km >= 1) out.push('Longest');
    return out;
  }
  var BADGES = [
    ['first', '👟', 'First steps', 'Finish your first walk or run'],
    ['km5', '5️⃣', '5 km in one go', 'A single session of 5 km or more'],
    ['km10', '🔟', '10 km in one go', 'A single session of 10 km or more'],
    ['half', '🏅', 'Half marathon', '21.1 km in one session'],
    ['s10', '🔥', '10 sessions', 'Ten walks or runs'],
    ['s50', '💯', '50 sessions', 'Fifty walks or runs'],
    ['t50', '🗺️', '50 km in total', 'Every session added up'],
    ['t250', '🌍', '250 km in total', 'Every session added up'],
    ['streak7', '📅', '7-day streak', 'A walk or run 7 days in a row'],
    ['early', '🌅', 'Early bird', 'Start before 6 am'],
    ['climb', '⛰️', 'Hill climber', '100 m of climb in one session'],
    ['c25k', '🏁', 'Couch to 5K', 'Finish all 27 runs of the plan'],
    ['chase10', '🏃', 'Escape artist', 'Win 10 chases'],
    ['pr', '🏆', 'Record breaker', 'Beat one of your own records']
  ];
  M.moveBadges = BADGES;
  function earned() {
    var acts = (M.state.activities || []), out = {};
    var tot = acts.reduce(function (s2, x) { return s2 + x.km; }, 0), maxKm = acts.reduce(function (m, x) { return Math.max(m, x.manual ? 0 : x.km); }, 0);
    if (acts.length) out.first = 1;
    if (maxKm >= 5) out.km5 = 1; if (maxKm >= 10) out.km10 = 1; if (maxKm >= 21.0975) out.half = 1;
    if (acts.length >= 10) out.s10 = 1; if (acts.length >= 50) out.s50 = 1;
    if (tot >= 50) out.t50 = 1; if (tot >= 250) out.t250 = 1;
    var days = {}; acts.forEach(function (x) { days[x.date] = 1; });
    Object.keys(days).forEach(function (k) { var ok = true; for (var i = 1; i < 7 && ok; i++) ok = !!days[M.addDays(k, i)]; if (ok) out.streak7 = 1; });
    if (acts.some(function (x) { return !x.manual && new Date(x.startAt).getHours() < 6; })) out.early = 1;
    if (acts.some(function (x) { return x.climb >= 100; })) out.climb = 1;
    if (Object.keys(M.c25k.done()).length >= 27) out.c25k = 1;
    if (acts.reduce(function (n, x) { return n + (x.chase ? x.chase.won : 0); }, 0) >= 10) out.chase10 = 1;
    if (acts.some(function (x) { return x.prs && x.prs.length; })) out.pr = 1;
    return out;
  }
  function checkBadges(a) {
    var have = M.state.badges = M.state.badges || {}, now = earned(), got = [];
    BADGES.forEach(function (b) { if (now[b[0]] && !have[b[0]]) { have[b[0]] = a.date; got.push(b[0]); } });
    if (got.length) { a.badges = got; M.save(true); }
  }
  function badgeById(id) { return BADGES.filter(function (b) { return b[0] === id; })[0]; }

  /* A small "Tracking…" pill while you look at other screens */
  function showPill(on) {
    var wb = document.querySelector('.water-banner');
    if (wb) wb.classList.toggle('below-pill', !!on); // the water reminder moves down so both can be tapped
    if (!on) { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) {
      pill = document.createElement('a');
      pill.className = 'track-pill'; pill.href = '#/move';
      document.body.appendChild(pill);
    }
    pill.innerHTML = '<i></i>' + (S.paused ? 'Paused' : 'Tracking') + ' · ' + M.fmt(S.km, 2) + ' km · ' + fmtClock(S.movingMs / 1000);
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */
  /* route: [[lat, lng], …] — a 0 starts a new piece (a pause) */
  function routeSvg(route, w, h, replay) {
    w = w || 320; h = h || 180;
    var pts = (route || []).filter(function (p) { return p !== 0; });
    if (pts.length < 2) return '<div class="route-empty">' + M.icon('map') + '<span>Your route appears here as you move.</span></div>';
    var brk = {}, j = 0; (route || []).forEach(function (p) { if (p === 0) brk[j] = 1; else j++; });
    route = pts;
    var lat0 = route[0][0] * Math.PI / 180, k = Math.cos(lat0);
    var xs = route.map(function (p) { return p[1] * k; }), ys = route.map(function (p) { return -p[0]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 14, sw = (maxX - minX) || 1e-6, sh = (maxY - minY) || 1e-6;
    var sc = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh);
    var ox = (w - sw * sc) / 2, oy = (h - sh * sc) / 2;
    var P = route.map(function (_, i) { return [(xs[i] - minX) * sc + ox, (ys[i] - minY) * sc + oy]; });
    var d = P.map(function (p, i) { return (i && !brk[i] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var e = P[P.length - 1];
    return '<svg class="route" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Route drawing"><path class="rt-line" d="' + d + '" fill="none" stroke="var(--now)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      (replay ? '<circle class="rt-dot" r="7" cx="' + P[0][0].toFixed(1) + '" cy="' + P[0][1].toFixed(1) + '" fill="var(--accent)" stroke="var(--ink)" stroke-width="2.5" opacity="0"/>' : '') +
      '<circle cx="' + P[0][0].toFixed(1) + '" cy="' + P[0][1].toFixed(1) + '" r="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2.5"/>' +
      '<circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="6" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/></svg>';
  }

  function livePace() {
    if (!S || S.recent.length < 2) return null;
    var a = S.recent[0], b = S.recent[S.recent.length - 1];
    var dk = b[1] - a[1], dtS = (b[0] - a[0]) / 1000;
    return dk > 0.01 ? dtS / dk : null;
  }
  function gpsChip() {
    var m = { searching: ['Finding GPS…', 'warn'], good: ['GPS good' + (S.acc ? ' · ±' + S.acc + ' m' : ''), 'good'], weak: ['GPS weak' + (S.acc ? ' · ±' + S.acc + ' m' : '') + ' — move into the open', 'warn'], denied: ['Location is blocked', 'bad'], off: ['Treadmill — motion sensor', 'info'] }[S.gps] || ['', 'info'];
    return '<span class="badge ' + m[1] + '">' + M.icon(S.gps === 'off' ? 'steps' : 'pin') + m[0] + '</span>';
  }

  function paintLive(full) {
    if (!S) return;
    showPill(!(M.currentRoute && M.currentRoute.name === 'move'));
    var host = M.$('.live');
    if (!host) return;
    var sec = S.movingMs / 1000;
    var avg = S.km > 0.02 ? sec / S.km : null;
    var set = function (sel, v) { var el = host.querySelector(sel); if (el && el.innerHTML !== v) el.innerHTML = v; };
    set('.lv-km', M.fmt(S.km, 2));
    set('.lv-time', fmtClock(sec));
    set('.lv-pace', fmtPace(livePace() || avg));
    set('.lv-avg', fmtPace(avg));
    set('.lv-kcal', M.fmt(kcalOf(S.km, sec, S.type)));
    set('.lv-steps', M.fmt(stepsNow()));
    set('.lv-gps', gpsChip());
    var pt = M.$('#page-title');
    if (pt && M.currentRoute && M.currentRoute.name === 'move' && !(M.currentRoute.parts || []).length) { var ttl = S.paused ? 'Paused' : 'Tracking'; if (pt.textContent !== ttl) { pt.textContent = ttl; document.title = ttl + ' · Mizan'; } }
    set('.lv-state', S.paused ? 'Paused' : S.waiting ? 'Waiting for GPS — the clock starts when your position is found' : S.autoPaused ? 'Auto-paused — start moving to resume' : '');
    host.classList.toggle('is-paused', !!(S.paused || S.autoPaused || S.waiting));
    if (full || (S.route.length && S.route.length !== host._routeLen)) { host._routeLen = S.route.length; set('.lv-route', routeSvg(S.route)); }
    if (full) set('.lv-pausebtn', S.paused ? M.icon('play') + 'Resume' : M.icon('pause') + 'Pause');
    if (S.coach) set('.lv-coach', coachHtml());
    if (S.chase) set('.lv-chase', chaseHtml());
    if (S.gps === 'denied') set('.lv-help', U.note('bad', '<p><strong>Mizan can’t see your location.</strong> Allow location for this site in your browser or phone settings, then tap Resume — or use Treadmill mode.</p>'));
  }

  /* ------------------------------------------------------------------ */
  /* History helpers (also used by the dashboard and assistant)           */
  /* ------------------------------------------------------------------ */
  M.activityToday = function () {
    var k = M.today(), km = 0, steps = 0, n = 0;
    (M.state.activities || []).forEach(function (a) { if (a.date === k) { km += a.km; steps += a.steps || 0; n++; } });
    if (S && M.dateKey(new Date(S.startAt)) === k) { km += S.km; steps += stepsNow(); }
    return { km: km, steps: steps, n: n };
  };
  M.activityWeek = function () {
    var keys = M.weekKeys(M.today()), km = 0, n = 0, sec = 0, kcal = 0;
    (M.state.activities || []).forEach(function (a) { if (keys.indexOf(a.date) >= 0) { km += a.km; n++; sec += a.movingSec; kcal += a.kcal || 0; } });
    return { km: km, n: n, sec: sec, kcal: kcal, keys: keys };
  };
  var TYPE = { walk: 'Walk', run: 'Run', treadmill: 'Treadmill' };

  function summaryHtml(a, fresh) {
    var pace = a.km > 0 ? a.movingSec / a.km : null;
    return '<section class="panel move-summary" aria-labelledby="ms-h">' +
      '<p class="eyebrow">' + M.icon(a.type === 'treadmill' ? 'steps' : 'run') + TYPE[a.type] + ' · ' + M.fmtDate(a.date, 'weekday') + ' · ' + (a.manual ? 'logged by hand' : new Date(a.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</p>' +
      '<h2 id="ms-h">' + (fresh ? 'Well done! 🎉' : TYPE[a.type]) + '</h2>' +
      '<div class="ms-big"><span class="num">' + M.fmt(a.km, 2) + '</span><small>km</small></div>' +
      '<div class="stats move-stats"><div class="stat"><span class="label">Time</span><span class="value num">' + fmtClock(a.movingSec) + '</span></div>' +
      '<div class="stat"><span class="label">Avg pace</span><span class="value num">' + fmtPace(pace) + '<small>/km</small></span></div>' +
      '<div class="stat"><span class="label">Calories</span><span class="value num">' + M.fmt(a.kcal) + '<small>kcal</small></span></div>' +
      '<div class="stat"><span class="label">Steps</span><span class="value num">' + M.fmt(a.steps) + '</span><span class="sub">' + (a.stepsSource === 'sensor' ? 'counted' : 'estimated') + '</span></div>' +
      (a.climb !== undefined ? '<div class="stat"><span class="label">Climb</span><span class="value num">' + M.fmt(a.climb) + '<small>m</small></span><span class="sub">from GPS height, approx.</span></div>' : '') + '</div>' +
      highlights(a, fresh) +
      (drawRoute(a).length > 1 ? '<div class="route-box">' + routeSvg(drawRoute(a), 360, 200, true) + '<div class="rt-bar"><button type="button" class="btn btn-sm" data-mv="replay">' + M.icon('play') + 'Replay</button><span class="rt-km num" aria-live="off"></span>' + (a.trk && a.trk.length > 1 ? '<button type="button" class="btn btn-sm btn-ghost" data-mv="gpx">' + M.icon('download') + 'GPX file</button>' : '') + '</div></div>' : '') +
      effortsHtml(a) +
      (a.splits && a.splits.length ? '<div class="table-wrap" tabindex="0" role="region" aria-label="Kilometre splits" style="margin-top:14px"><table class="data"><thead><tr><th>Km</th><th class="n">Time</th><th class="n">Pace</th></tr></thead><tbody>' + a.splits.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="n">' + fmtClock(s) + '</td><td class="n">' + fmtPace(s) + ' /km</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<p class="muted" style="font-size:var(--fs-xs);margin:12px 0 0">' + (a.manual ? 'Logged by hand. ' : '') + 'Calories are active calories — burned by the movement, on top of what your body uses at rest — estimated from your speed and ' + (M.latestWeight() ? 'weight (' + M.showW(weightKg(), 0) + ' ' + M.wUnit() + ').' : 'an average weight of ' + M.showW(65, 0) + ' ' + M.wUnit() + ' — add your weight in your profile for a better estimate.') + (a.gaps ? ' The screen was off for part of it, so that distance was joined in a straight line and its time estimated.' : '') +
      (a.liveKm !== undefined ? ' Distance was re-measured after the ' + (a.type === 'run' ? 'run' : 'walk') + ' from the whole GPS track (' + M.fmt(a.liveKm, 2) + ' km while moving → ' + M.fmt(a.km, 2) + ' km) — corners and GPS wobble are judged better once every point is known.' : '') + '</p>' +
      '</section>';
  }
  function drawRoute(a) { return a.trk && a.trk.length > 1 ? a.trk.map(function (p) { return p === 0 ? 0 : [p[1], p[2]]; }) : (a.route || []); }
  /* records, badges, coach and chase results for one session */
  function highlights(a, fresh) {
    var out = [];
    if (a.prs && a.prs.length) out.push('<li>' + M.icon('trophy') + '<span><strong>New personal record' + (a.prs.length > 1 ? 's' : '') + ':</strong> ' + a.prs.map(function (k) { return k === 'Longest' ? 'longest ' + (a.type === 'run' ? 'run' : a.type === 'walk' ? 'walk' : 'session') + ' (' + M.fmt(a.km, 2) + ' km)' : 'fastest ' + k + ' (' + fmtClock(a.best[k]) + ')'; }).join(', ') + '</span></li>');
    if (a.coach) { var cp = M.c25k.parse(a.coach); if (cp) out.push('<li>' + M.icon('flag') + '<span><strong>Couch to 5K · Week ' + cp.w + ', run ' + cp.r + '</strong> — ' + (a.coachDone ? 'done ✓' : 'not finished — try it again next time') + '</span></li>'); }
    if (a.chase && (a.chase.won || a.chase.lost)) out.push('<li>' + M.icon('run') + '<span><strong>Chases:</strong> ' + a.chase.won + ' escaped, ' + a.chase.lost + ' caught</span></li>');
    if (fresh && a.badges && a.badges.length) out.push('<li>' + M.icon('medal') + '<span><strong>New badge' + (a.badges.length > 1 ? 's' : '') + ':</strong> ' + a.badges.map(function (id) { var b = badgeById(id); return b ? b[1] + ' ' + M.esc(b[2]) : ''; }).join(', ') + '</span></li>');
    return out.length ? '<ul class="ms-high">' + out.join('') + '</ul>' : '';
  }
  function effortsHtml(a) {
    var ks = Object.keys(a.best || {});
    if (!ks.length) return '';
    var rec = records(a.type);
    return '<div class="table-wrap" tabindex="0" role="region" aria-label="Best efforts" style="margin-top:14px"><table class="data"><thead><tr><th>Best effort</th><th class="n">Time</th><th class="n">Pace</th></tr></thead><tbody>' + ks.map(function (k) {
      var isPr = rec.best[k] && rec.best[k].id === a.id;
      var D = EFFORTS.filter(function (e) { return e[1] === k; })[0][0];
      return '<tr><td>' + k + (isPr ? ' <span class="badge accent">' + M.icon('trophy') + 'Best</span>' : '') + '</td><td class="n">' + fmtClock(a.best[k]) + '</td><td class="n">' + fmtPace(a.best[k] / D) + ' /km</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  /* GPX 1.1 — opens in Strava, Garmin Connect, Google Earth and most map apps */
  function gpxOf(a) {
    var x = function (v) { return String(v).replace(/[<&>"]/g, function (c) { return { '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var name = TYPE[a.type] + ' · ' + M.fmtDate(a.date, 'weekday');
    var segs = [[]];
    (a.trk || []).forEach(function (p) { if (p === 0) segs.push([]); else segs[segs.length - 1].push(p); });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mizan" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>' + x(name) + '</name><time>' + new Date(a.startAt).toISOString() + '</time></metadata>\n<trk><name>' + x(name) + '</name><type>' + (a.type === 'run' ? 'running' : 'walking') + '</type>\n' +
      segs.filter(function (sg) { return sg.length; }).map(function (sg) {
        return '<trkseg>\n' + sg.map(function (p) { return '<trkpt lat="' + p[1] + '" lon="' + p[2] + '">' + (p[3] !== undefined ? '<ele>' + p[3] + '</ele>' : '') + '<time>' + new Date(a.startAt + p[0] * 1000).toISOString() + '</time></trkpt>'; }).join('\n') + '\n</trkseg>';
      }).join('\n') + '\n</trk>\n</gpx>\n';
  }
  function downloadGpx(a) {
    var blob = new Blob([gpxOf(a)], { type: 'application/gpx+xml' }), name = 'mizan-' + a.type + '-' + a.date + '.gpx';
    try {
      var file = typeof File === 'function' ? new File([blob], name, { type: 'application/gpx+xml' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && M.device && M.device().mobile) { navigator.share({ files: [file], title: name }).catch(function () {}); return; }
    } catch (e) { /* fall back to a download */ }
    var url = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    M.toast('GPX file saved — upload it to Strava or Garmin Connect, or open it in a map app.');
  }
  /* Replay: a dot runs along the route while the distance counts up */
  function replay(root, a) {
    var path = root.querySelector('.rt-line'), dot = root.querySelector('.rt-dot'), lab = root.querySelector('.rt-km');
    if (!path || !dot || !path.getTotalLength) return;
    var L = path.getTotalLength(), dur = M.reduceMotion() ? 0 : Math.min(9000, 4000 + a.km * 600), t0 = null;
    dot.setAttribute('opacity', '1');
    var step = function (ts) {
      if (!document.contains(dot)) return;
      if (t0 === null) t0 = ts;
      var f = dur ? Math.min(1, (ts - t0) / dur) : 1, pt = path.getPointAtLength(L * f);
      dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1));
      if (lab) lab.textContent = M.fmt(a.km * f, 2) + ' km';
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */
  function startScreen(el) {
    var type = M.state.settings.move.type || 'walk';
    var t = M.activityToday(), w = M.activityWeek();
    var recent = (M.state.activities || []).slice(-3).reverse();
    var saved = savedLive();
    var geoOK = 'geolocation' in navigator;
    var desktop = M.device && !M.device().mobile;
    el.innerHTML =
      (saved && saved.status !== 'done' ? U.note('warn', '<p><strong>You have an unfinished ' + (TYPE[saved.type] || 'session').toLowerCase() + '</strong> — ' + M.fmt(saved.km, 2) + ' km in ' + fmtClock(saved.movingMs / 1000) + '.</p><div class="btn-row" style="margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-mv="resume">Resume</button><button type="button" class="btn btn-sm" data-mv="finish-saved">Finish & save</button><button type="button" class="btn btn-sm btn-ghost" data-mv="discard-saved">Discard</button></div>') + '<div style="height:16px"></div>' : '') +
      '<section class="panel move-start" aria-labelledby="mv-h"><h2 id="mv-h">Ready?</h2><p class="soft">Pick what you’re doing and tap Start. Keep Mizan open — the screen stays on while tracking.</p>' +
      (desktop ? U.note('warn', '<p><strong>Use your phone for walks and runs.</strong> Computers don’t have GPS — they guess their position from Wi-Fi, which can be hundreds of metres off, so distance, pace and calories would be wrong. You can log a walk or run by hand below.</p>') : '') +
      '<fieldset class="field"><legend class="sr-only">Activity</legend><div class="seg move-type" role="radiogroup">' + ['walk', 'run', 'treadmill'].map(function (x) { return '<label><input type="radio" name="mtype" value="' + x + '"' + (type === x ? ' checked' : '') + '><span>' + M.icon(x === 'treadmill' ? 'steps' : x === 'run' ? 'run' : 'steps') + TYPE[x] + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<div class="gps-ready" aria-live="polite"></div>' +
      '<button type="button" class="btn btn-primary move-go" data-mv="start">' + M.icon('play') + 'Start</button>' +
      (!geoOK ? '<p class="hint">This browser can’t use GPS — Treadmill mode still counts steps.</p>' : '<p class="hint">Walk and Run use GPS — best outdoors with a clear sky. Give it a minute in the open before you start, like sports watches do. Treadmill uses the motion sensor. For steps, keep the phone in your pocket or hand.</p>') +
      '<label class="switch mv-chase"><span class="sw-text"><strong>Chase mode</strong><span>Surprise sprints: hold 20% faster for a minute to escape</span></span><input type="checkbox" data-mv-opt="chase"' + (M.state.settings.move.chase ? ' checked' : '') + '></label>' +
      safetyLine() +
      '<button type="button" class="btn btn-ghost btn-sm" data-mv="manual" style="margin-top:10px">' + M.icon('edit') + 'Log one by hand</button></section>' +
      planCard() +
      '<div class="grid-2" style="margin-top:16px"><section class="panel" aria-labelledby="mv-t"><div class="panel-title"><h3 id="mv-t">Today</h3></div><div class="stats"><div class="stat"><span class="label">Distance</span><span class="value">' + M.fmt(t.km, 2) + '<small>km</small></span></div><div class="stat"><span class="label">Steps</span><span class="value">' + M.fmt(t.steps) + '</span></div></div></section>' +
      '<section class="panel" aria-labelledby="mv-w"><div class="panel-title"><h3 id="mv-w">This week</h3><a class="btn btn-sm btn-ghost" href="#/move/history">Records & history</a></div>' + weekBars(w) + '</section></div>' +
      (recent.length ? '<section class="panel" style="margin-top:16px" aria-labelledby="mv-r"><div class="panel-title"><h3 id="mv-r">Recent</h3></div>' + listHtml(recent) + '</section>' : '');
  }
  function safetyLine() {
    var sf = safety();
    return '<p class="mv-safety">' + M.icon('shield') + (sf.phone ? '<span>Safety contact: <strong>' + M.esc(sf.name || sf.phone) + '</strong>' + (sf.stopAlarm ? ' · stop alarm after ' + (sf.stopMin || 5) + ' min' : '') + '</span>' : '<span>No safety contact yet.</span>') + ' <a href="#/settings/move">' + (sf.phone ? 'Change' : 'Add one') + '</a></p>';
  }
  /* Couch to 5K card */
  function planCard() {
    var nx = M.c25k.next(), done = Object.keys(M.c25k.done()).length;
    var p = nx ? M.c25k.parse(nx) : null;
    return '<section class="panel c25k-card" style="margin-top:16px" aria-labelledby="c25-h"><div class="panel-title"><div><p class="eyebrow">' + M.icon('flag') + 'Training plan</p><h3 id="c25-h">Couch to 5K</h3></div><span class="badge">' + done + ' / 27 runs</span></div>' +
      '<p class="soft" style="margin-top:0">From the sofa to running 30 minutes without stopping in 9 weeks — 3 runs a week, walking breaks at first. Mizan tells you when to run and when to walk.</p>' +
      '<div class="c25k-bar" aria-hidden="true"><i style="width:' + (done / 27 * 100).toFixed(1) + '%"></i></div>' +
      (p ? '<div class="inset c25k-next"><strong>Next: Week ' + p.w + ', run ' + p.r + '</strong><span>' + M.esc(M.c25k.describe(nx)) + ' · about ' + Math.round(M.c25k.total(nx) / 60) + ' min</span></div>' +
        '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-primary" data-mv="coach" data-id="' + nx + '">' + M.icon('play') + 'Start this run</button><button type="button" class="btn" data-mv="plan-all">All 27 runs</button></div>'
        : '<p><strong>Plan complete 🎉</strong> You can run 5 km. Repeat any run, or keep going with 3 runs a week.</p><div class="btn-row"><button type="button" class="btn" data-mv="plan-all">All 27 runs</button></div>') +
      '<p class="hint" style="margin:10px 0 0">Based on the NHS Couch to 5K plan. On a treadmill? Pick Treadmill above first. Rest a day between runs. Talk to a doctor first if you have a heart, lung or joint condition.</p></section>';
  }
  function planSheet(start) {
    var d = M.c25k.done(), nx = M.c25k.next();
    var body = '<ol class="c25k-list">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (w) {
      return '<li><strong>Week ' + w + '</strong><ul>' + [1, 2, 3].map(function (r) {
        var id = M.c25k.id(w, r);
        return '<li class="' + (d[id] ? 'is-done' : id === nx ? 'is-next' : '') + '"><span class="c25k-tick" aria-hidden="true">' + (d[id] ? M.icon('check') : '') + '</span><span class="li-main"><strong>Run ' + r + (d[id] ? ' · done ' + M.fmtDate(d[id], 'short') : id === nx ? ' · next' : '') + '</strong><span>' + M.esc(M.c25k.describe(id)) + '</span></span><button type="button" class="btn btn-sm" data-c25="' + id + '" aria-label="Start week ' + w + ' run ' + r + '">' + M.icon('play') + '</button></li>';
      }).join('') + '</ul></li>';
    }).join('') + '</ol>';
    M.sheet({
      title: 'Couch to 5K — all runs', body: body, wide: true, noAutofocus: true,
      foot: '<button type="button" class="btn btn-ghost" data-close>Close</button>',
      onOpen: function (dlg) { dlg.addEventListener('click', function (e) { var b = e.target.closest('[data-c25]'); if (!b) return; var id = b.getAttribute('data-c25'); dlg.close(); start(id); }); }
    });
  }

  /* ---- GPS warm-up on the start screen: get a fix before you start (it's what watches wait for) ---- */
  var warm = { id: null, acc: null, state: 'off', go: null };
  function warmStart() {
    if (S || warm.id !== null || !navigator.geolocation || (M.device && !M.device().mobile)) { paintWarm(); return; }
    warm.go = function () {
      if (warm.id !== null || S) return;
      warm.state = 'searching'; paintWarm();
      try {
        warm.id = navigator.geolocation.watchPosition(function (p) {
          warm.acc = Math.round(p.coords.accuracy || 99);
          warm.state = warm.acc <= 20 ? 'ready' : 'weak'; paintWarm();
        }, function (e) { warm.state = e && e.code === 1 ? 'denied' : 'weak'; paintWarm(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
      } catch (e) { warm.state = 'off'; }
    };
    var ask = function () { warm.state = 'ask'; paintWarm(); };
    try {
      if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(function (r) { if (r.state === 'granted') warm.go(); else if (r.state === 'denied') { warm.state = 'denied'; paintWarm(); } else ask(); }).catch(ask);
      else ask();
    } catch (e) { ask(); }
  }
  function warmStop() {
    try { if (warm.id !== null && navigator.geolocation) navigator.geolocation.clearWatch(warm.id); } catch (e) { /* ignore */ }
    warm.id = null; warm.state = 'off';
  }
  function paintWarm() {
    var h = M.$('.gps-ready'); if (!h) return;
    var type = (M.$('input[name=mtype]:checked') || {}).value || M.state.settings.move.type;
    if (type === 'treadmill' || (M.device && !M.device().mobile) || !navigator.geolocation) { h.innerHTML = ''; return; }
    var m = {
      ask: '<button type="button" class="btn btn-sm" data-mv="gpscheck">' + M.icon('pin') + 'Check GPS signal</button><span class="hint">Do this outdoors a minute before you start.</span>',
      searching: '<span class="badge warn">' + M.icon('pin') + 'Finding GPS…</span><span class="hint">Stay in the open — the first fix can take up to a minute.</span>',
      weak: '<span class="badge warn">' + M.icon('pin') + 'GPS weak' + (warm.acc ? ' · ±' + warm.acc + ' m' : '') + '</span><span class="hint">Wait a moment away from buildings and trees — or start anyway; distance counts once it’s good.</span>',
      ready: '<span class="badge good">' + M.icon('pin') + 'GPS ready · ±' + warm.acc + ' m</span>',
      denied: '<span class="badge bad">' + M.icon('pin') + 'Location is blocked</span><span class="hint">Allow location for this site in your browser settings — or use Treadmill.</span>'
    }[warm.state] || '';
    if (h.innerHTML !== m) h.innerHTML = m;
  }

  function recordsHtml() {
    var rows = [];
    ['run', 'walk', 'treadmill'].forEach(function (t) {
      var r = records(t);
      var ks = EFFORTS.map(function (e) { return e[1]; }).filter(function (k) { return r.best[k]; });
      if (!ks.length && !r.longest) return;
      rows.push('<div class="rec-type"><h4>' + TYPE[t] + '</h4><ul class="rec-list">' + ks.map(function (k) {
        return '<li><a href="#/move/s/' + M.esc(r.best[k].id) + '"><span>' + k + '</span><strong class="num">' + fmtClock(r.best[k].sec) + '</strong><em>' + M.fmtDate(r.best[k].date, 'short') + '</em></a></li>';
      }).join('') + (r.longest ? '<li><a href="#/move/s/' + M.esc(r.longest.id) + '"><span>Longest</span><strong class="num">' + M.fmt(r.longest.km, 2) + ' km</strong><em>' + M.fmtDate(r.longest.date, 'short') + '</em></a></li>' : '') + '</ul></div>');
    });
    return '<section class="panel" style="margin-top:16px" aria-labelledby="mh-rec"><div class="panel-title"><h3 id="mh-rec">' + M.icon('trophy') + ' Personal records</h3></div>' +
      (rows.length ? '<div class="rec-grid">' + rows.join('') + '</div><p class="hint" style="margin:10px 0 0">Your fastest time over each distance inside any GPS session — like “best efforts” in other running apps.</p>' : '<p class="muted" style="margin:0">Finish a GPS walk or run and your fastest 400 m, 1 km, 5 km… show up here.</p>') + '</section>';
  }
  function badgesHtml() {
    var have = M.state.badges = M.state.badges || {}, now = earned(), changed = false;
    BADGES.forEach(function (b) { if (now[b[0]] && !have[b[0]]) { have[b[0]] = M.today(); changed = true; } }); // earned before badges existed
    if (changed) M.save();
    var n = Object.keys(have).length;
    return '<section class="panel" style="margin-top:16px" aria-labelledby="mh-bd"><div class="panel-title"><h3 id="mh-bd">' + M.icon('medal') + ' Badges</h3><span class="badge">' + n + ' / ' + BADGES.length + '</span></div><ul class="badge-grid">' + BADGES.map(function (b) {
      var got = have[b[0]];
      return '<li class="' + (got ? 'got' : 'locked') + '"><span class="bd-ico" aria-hidden="true">' + b[1] + '</span><strong>' + M.esc(b[2]) + '</strong><span>' + (got ? 'Earned ' + M.fmtDate(got, 'short') : M.esc(b[3])) + '</span></li>';
    }).join('') + '</ul></section>';
  }
  function weekBars(w) {
    var per = w.keys.map(function (k) { var km = 0; (M.state.activities || []).forEach(function (a) { if (a.date === k) km += a.km; }); return km; });
    var max = Math.max.apply(null, per.concat([1]));
    return '<div class="week-bars" role="img" aria-label="Kilometres each day this week: ' + per.map(function (x, i) { return M.DAY_SHORT[M.weekday(w.keys[i])] + ' ' + M.fmt(x, 1); }).join(', ') + '">' + per.map(function (km, i) {
      return '<div class="wb"><span class="wb-bar"><i style="height:' + (km / max * 100).toFixed(0) + '%"></i></span><span class="wb-l">' + M.DAY_LETTER[M.weekday(w.keys[i])] + '</span></div>';
    }).join('') + '</div><p class="muted" style="margin:8px 0 0;font-size:var(--fs-sm)"><strong style="color:var(--ink)">' + M.fmt(w.km, 1) + ' km</strong> · ' + w.n + ' ' + M.plural(w.n, 'session') + ' · ' + M.fmt(w.kcal) + ' kcal</p>';
  }
  function listHtml(list) {
    return '<ul class="list">' + list.map(function (a) {
      var pace = a.km > 0 ? a.movingSec / a.km : null;
      return '<li><a class="row grow" href="#/move/s/' + M.esc(a.id) + '" style="text-decoration:none;color:inherit;gap:12px"><span class="set-ico">' + M.icon(a.type === 'treadmill' ? 'steps' : 'run') + '</span><span class="li-main"><strong>' + M.fmt(a.km, 2) + ' km ' + TYPE[a.type].toLowerCase() + '</strong><span>' + M.fmtDate(a.date, 'weekday') + ' · ' + fmtClock(a.movingSec) + ' · ' + fmtPace(pace) + ' /km · ' + M.fmt(a.kcal) + ' kcal</span></span>' + M.icon('right', 'class="set-chev"') + '</a></li>';
    }).join('') + '</ul>';
  }
  function coachHtml() {
    var c = S.coach, now = Date.now(), w = coachWhere(now), p = M.c25k.parse(c.id) || { w: '?', r: '?' };
    var tot = c.segs.reduce(function (a, x) { return a + x[1]; }, 0), el = Math.min(tot, coachElapsed(now) / 1000);
    var head = '<div class="cz-head"><span>' + M.icon('flag') + 'Couch to 5K · Week ' + p.w + ', run ' + p.r + '</span><span class="num">' + fmtClock(el) + ' / ' + fmtClock(tot) + '</span></div>';
    var acc = 0;
    var bar = '<div class="cz-bar" aria-hidden="true">' + c.segs.map(function (x, i) { var h = '<i class="cz-s ' + (x[0] === 'run' ? 'run' : 'walk') + (i === w.i ? ' on' : '') + '" style="left:' + (acc / tot * 100).toFixed(2) + '%;width:' + (x[1] / tot * 100).toFixed(2) + '%"></i>'; acc += x[1]; return h; }).join('') + '<b class="cz-pos" style="left:' + (el / tot * 100).toFixed(2) + '%"></b></div>';
    if (c.done || w.i >= c.segs.length) return head + '<div class="cz-now done"><strong>Workout complete 🎉</strong><span>Tap Finish to save it.</span></div>' + bar;
    var sg = c.segs[w.i], nx = c.segs[w.i + 1];
    return head + '<div class="cz-now ' + (sg[0] === 'run' ? 'run' : 'walk') + '"><strong>' + SEGNAME[sg[0]] + '</strong><span class="num cz-left">' + fmtClock(w.left) + '</span><em>' + (nx ? 'Then ' + SEGNAME[nx[0]].toLowerCase() + ' · ' + fmtClock(nx[1]) : 'Last part') + '</em></div>' + bar +
      (S.paused ? '<p class="hint" style="margin:6px 0 0">Paused — the coach waits for you.</p>' : '');
  }
  function chaseHtml() {
    var c = S.chase, now = Date.now();
    if (c.on) {
      var left = Math.max(0, 60 - (now - c.on.at) / 1000), got = (S.km - c.on.km0) * 1000 / Math.max(1, (now - c.on.at) / 1000);
      return '<div class="chase on" role="status"><strong>' + M.icon('run') + 'Chase! Hold it for ' + Math.ceil(left) + ' s</strong><span>Now ' + M.fmt(got * 3.6, 1) + ' km/h · need ' + M.fmt(c.on.need * 3.6, 1) + '</span></div>';
    }
    if (c.last && now - c.last.at < 15000) return '<div class="chase ' + (c.last.won ? 'won' : 'lost') + '"><strong>' + (c.last.won ? 'Escaped! 🎉' : 'Caught this time') + '</strong><span>' + c.won + ' escaped · ' + c.lost + ' caught</span></div>';
    return '<div class="chase idle"><span>' + M.icon('run') + 'Chase mode on — be ready to speed up' + (c.won + c.lost ? ' · ' + c.won + ' escaped, ' + c.lost + ' caught' : '') + '</span></div>';
  }
  function liveScreen(el) {
    el.innerHTML = '<section class="panel live" aria-live="off" aria-labelledby="lv-h">' +
      '<div class="row between wrap"><h2 id="lv-h" class="sr-only">' + TYPE[S.type] + ' in progress</h2><span class="lv-gps"></span><span class="badge">' + M.icon(S.type === 'treadmill' ? 'steps' : 'run') + TYPE[S.type] + '</span></div>' +
      (S.coach ? '<div class="lv-coach"></div>' : '') + (S.chase ? '<div class="lv-chase"></div>' : '') +
      '<div class="lv-main"><span class="lv-km num">0.00</span><small>km</small></div><p class="lv-state" aria-live="polite"></p>' +
      '<div class="lv-grid"><div><span class="label">Time</span><strong class="lv-time num">0:00</strong></div><div><span class="label">Pace now</span><strong class="lv-pace num">–:––</strong></div><div><span class="label">Avg pace</span><strong class="lv-avg num">–:––</strong></div><div><span class="label">Calories</span><strong class="lv-kcal num">0</strong></div><div><span class="label">Steps</span><strong class="lv-steps num">0</strong></div></div>' +
      '<div class="lv-route">' + routeSvg(S.route) + '</div><div class="lv-help"></div>' +
      '<div class="lv-btns"><button type="button" class="btn lv-pausebtn" data-mv="pause"></button><button type="button" class="btn btn-danger lv-stop" data-mv="stop">' + M.icon('stop') + 'Finish</button></div>' +
      (S.type !== 'treadmill' ? '<div class="lv-safe"><button type="button" class="btn btn-sm btn-ghost" data-mv="share">' + M.icon('shield') + 'Share my location</button>' + (safety().stopAlarm ? '<span class="muted">Stop alarm on · ' + (safety().stopMin || 5) + ' min</span>' : '') + '</div>' : '') + '</section>';
    paintLive(true);
  }

  function stopSheet() {
    M.sheet({
      title: 'Finish this ' + TYPE[S.type].toLowerCase() + '?',
      body: '<p class="soft">' + M.fmt(S.km, 2) + ' km in ' + fmtClock(S.movingMs / 1000) + '.</p>' + (S.type === 'treadmill' ? U.numField('mkm', 'Distance from the treadmill (optional)', '', 'km', { step: 0.01, hint: 'If the treadmill shows the distance, type it for a more accurate record.' }) : ''),
      foot: '<button type="button" class="btn btn-ghost" data-mv-x="discard">Discard</button><span class="spacer"></span><button type="button" class="btn" data-close>Keep going</button><button type="button" class="btn btn-primary" data-mv-x="finish">Finish & save</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.querySelector('[data-mv-x=finish]').addEventListener('click', function () {
          var mk = dlg.querySelector('[name=mkm]'); var v = mk ? M.num(mk.value) : null;
          dlg.close(); var a = finish(v && v > 0 ? v : undefined); if (a) M.go('move/s/' + a.id + '/new');
        });
        dlg.querySelector('[data-mv-x=discard]').addEventListener('click', function () {
          dlg.close();
          M.confirm('Discard this session?', 'It won’t be saved.', 'Discard', true).then(function (ok) { if (ok) { discard(); M.render(true); } });
        });
      }
    });
  }

  function coachType(el) { var t = (M.$('input[name=mtype]:checked', el) || {}).value; return t === 'treadmill' ? 'treadmill' : 'run'; } // on a treadmill the coach works the same
  function startType(type, opts) {
    if (type !== 'treadmill' && !navigator.geolocation) { M.toast('GPS isn’t available here — try Treadmill mode.'); return; }
    if (type !== 'treadmill' && M.device && !M.device().mobile) {
      M.confirm('This computer has no GPS', 'Computers guess where they are from Wi-Fi, which can be hundreds of metres off — so distance, pace and calories would be wrong. Use Mizan on your phone, or log the walk by hand.', 'Start anyway').then(function (ok) { if (ok) { warmStop(); startNew(type, opts); } });
      return;
    }
    warmStop();
    startNew(type, opts);
  }
  /* starting again while an unfinished session waits: save that one to History first, never throw it away */
  function startNew(type, opts) {
    var sv = savedLive();
    if (sv && sv.status !== 'done' && !S) {
      S = sv; var old = finish();
      if (old) M.toast('Your unfinished ' + (TYPE[old.type] || 'session').toLowerCase() + ' (' + M.fmt(old.km, 2) + ' km) was saved to History.');
    }
    begin(type, null, opts);
  }

  /* Log a walk or run by hand — for a computer, a forgotten phone, or a treadmill's own numbers */
  function manualSheet() {
    var type = M.state.settings.move.type || 'walk';
    M.sheet({
      title: 'Log a walk or run',
      body: '<form class="stack" id="mv-manual" novalidate>' +
        '<fieldset class="field"><legend class="label">Activity</legend>' + U.radios('mtype2', [['walk', 'Walk'], ['run', 'Run'], ['treadmill', 'Treadmill']], type) + '</fieldset>' +
        '<div class="form-grid"><div class="field"><label for="mm-date">Date</label><input class="input" id="mm-date" type="date" name="date" value="' + M.today() + '" max="' + M.today() + '"></div>' +
        U.numField('km', 'Distance', '', 'km', { step: 0.01, min: 0.05, max: 100 }) +
        U.numField('min', 'Time', '', 'min', { step: 1, min: 1, max: 720 }) +
        U.numField('steps', 'Steps (optional)', '', 'steps', { step: 1, min: 0, max: 100000 }) + '</div>' +
        '<p class="err hidden" id="mm-err" role="alert"></p></form>',
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-mm-save>Save</button>',
      onOpen: function (dlg) {
        dlg.querySelector('[data-mm-save]').addEventListener('click', function () {
          var f = dlg.querySelector('#mv-manual'), d = M.formData(f), err = dlg.querySelector('#mm-err');
          var t = d.mtype2 || 'walk', km = M.num(d.km), min = M.num(d.min), st = M.num(d.steps);
          var bad = function (m) { err.textContent = m; err.classList.remove('hidden'); M.haptic('error'); };
          if (!d.date || d.date > M.today()) return bad('Pick a date that isn’t in the future.');
          if (!km || km < 0.05 || km > 100) return bad('Distance should be between 0.05 and 100 km.');
          if (!min || min < 1 || min > 720) return bad('Time should be between 1 minute and 12 hours.');
          var kmh = km / (min / 60), top = t === 'run' ? 25 : 10;
          if (kmh > top) return bad('That’s ' + M.fmt(kmh, 1) + ' km/h — faster than anyone can ' + (t === 'run' ? 'run for that long' : 'walk') + '. Check the distance and time' + (t === 'run' ? '.' : ', or choose Run.'));
          if (kmh < 1) return bad('That’s under 1 km/h — slower than walking. Check the distance and time.');
          if (st !== null && st !== undefined && d.steps !== '' && (st < 0 || st / min > 240)) return bad('That’s more steps per minute than anyone can take. Check the steps.');
          var est = Math.round(km * 1000 / stepLenM(t === 'run' ? 'run' : 'walk'));
          var start = M.parseKey(d.date).getTime();
          var a = { id: M.uid(), type: t, date: d.date, startAt: start, endAt: start + min * 60000, movingSec: Math.round(min * 60), km: Math.round(km * 1000) / 1000,
            steps: d.steps !== '' && st ? Math.round(st) : est, stepsSource: d.steps !== '' && st ? 'manual' : 'estimate', kcal: kcalOf(km, min * 60, t), splits: [], route: [], gaps: 0, manual: true };
          M.state.activities.push(a);
          M.state.activities.sort(function (x, y) { return x.startAt - y.startAt; });
          M.save(true); M.haptic('success');
          dlg.close();
          M.go('move/s/' + a.id + '/new');
        });
      }
    });
  }

  M.views.move = {
    head: function (parts) {
      if (parts[0] === 'history') return { title: 'Records & history', sub: 'Walks & runs' };
      if (parts[0] === 's') return { title: 'Summary', sub: 'Walks & runs' };
      return { title: S ? (S.paused ? 'Paused' : 'Tracking') : 'Run & walk', sub: S ? TYPE[S.type] : 'Distance, time, steps and calories' };
    },
    render: function (el, parts) {
      if (parts[0] === 'history') {
        var all = (M.state.activities || []).slice().reverse();
        var tot = all.reduce(function (x, a) { return { km: x.km + a.km, sec: x.sec + a.movingSec }; }, { km: 0, sec: 0 });
        el.innerHTML = '<section class="panel"><div class="stats three"><div class="stat"><span class="label">All time</span><span class="value">' + M.fmt(tot.km, 1) + '<small>km</small></span></div><div class="stat"><span class="label">Sessions</span><span class="value">' + all.length + '</span></div><div class="stat"><span class="label">Time</span><span class="value">' + M.fmtDurShort(Math.round(tot.sec / 60)) + '</span></div></div></section>' +
          recordsHtml() + badgesHtml() +
          '<section class="panel" style="margin-top:16px" aria-labelledby="mh-all"><div class="panel-title"><h3 id="mh-all">All sessions</h3></div>' + (all.length ? listHtml(all) : '<p class="muted" style="margin:0">No walks or runs yet.</p>') + '</section>' +
          '<div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="#/move">' + M.icon('run') + 'Start a new one</a></div>';
        return;
      }
      if (parts[0] === 's') {
        var a = (M.state.activities || []).filter(function (x) { return x.id === parts[1]; })[0];
        if (!a) { el.innerHTML = '<div class="empty"><p>Session not found.</p><a class="btn" href="#/move/history">History</a></div>'; return; }
        el.innerHTML = summaryHtml(a, parts[2] === 'new') + '<div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="#/move">Done</a><a class="btn" href="#/move/history">History</a><button type="button" class="btn btn-danger" data-mv="delete">' + M.icon('trash') + 'Delete</button></div>';
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-mv=replay]')) { replay(el, a); return; }
          if (e.target.closest('[data-mv=gpx]')) { downloadGpx(a); return; }
          if (!e.target.closest('[data-mv=delete]')) return;
          M.confirm('Delete this session?', 'It will be removed from your history.', 'Delete', true).then(function (ok) {
            if (!ok) return;
            M.state.activities = M.state.activities.filter(function (x) { return x.id !== a.id; }); M.save(); M.go('move/history'); M.toast('Deleted');
          });
        });
        return;
      }
      if (S) liveScreen(el); else startScreen(el);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mv]'); if (!b) return;
        var act = b.getAttribute('data-mv');
        if (act === 'start') {
          var type = (M.$('input[name=mtype]:checked', el) || {}).value || 'walk';
          M.state.settings.move.type = type; M.save();
          startType(type, { chase: !!M.state.settings.move.chase && type !== 'treadmill' });
        } else if (act === 'coach') startType(coachType(el), { coach: b.getAttribute('data-id'), chase: false });
        else if (act === 'plan-all') planSheet(function (id) { startType(coachType(el), { coach: id, chase: false }); });
        else if (act === 'gpscheck') { if (warm.go) warm.go(); }
        else if (act === 'share') shareSheet(false);
        else if (act === 'pause') togglePause();
        else if (act === 'stop') stopSheet();
        else if (act === 'resume') { var sv = savedLive(); if (sv) { sv.paused = true; begin(sv.type, sv); } }
        else if (act === 'finish-saved') { var s2 = savedLive(); if (s2) { S = s2; var fa = finish(); if (fa) M.go('move/s/' + fa.id + '/new'); } }
        else if (act === 'discard-saved') { clearLive(); M.render(true); }
        else if (act === 'manual') manualSheet();
      });
      el.addEventListener('change', function (e) {
        if (e.target.getAttribute('data-mv-opt') === 'chase') { M.state.settings.move.chase = e.target.checked; M.save(); }
        if (e.target.name === 'mtype') paintWarm();
      });
      if (!S) warmStart();
    },
    leave: function () { warmStop(); if (S) showPill(true); }
  };

  M.move = { hav: hav, metFor: metFor, kcalOf: kcalOf, active: function () { return S; }, finish: finish, stepLenM: stepLenM, _feed: onPos, _motion: onMotion, _tick: tick, _refine: refine, _finalKm: finalKm, _efforts: bestEfforts, _splits: splitsFrom, _climb: climbOf, gpx: gpxOf, records: records, earned: earned };
})();
