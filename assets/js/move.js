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
  function stepLenM(type) {
    var s = M.state.settings.move;
    if (s.stepCm) return s.stepCm / 100;
    var h = M.state.profile.heightCm || 165;
    return h * (type === 'run' ? 0.0065 : 0.00415);
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

  function speak(text) {
    if (!M.state.settings.move.voice || !window.speechSynthesis) return;
    try { var u = new SpeechSynthesisUtterance(text); u.rate = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* ignore */ }
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
  }
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
          if (!(reach <= maxSpeed)) S.anchor = null;
        } else { paintLive(); return; }
      }
      S.jumps = 0; S.jumpPts = [];
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
    if (S.type === 'treadmill') { S.km += stepLenM(cadenceType(S.stepTimes)) / 1000; S.lastMoveAt = now; S.moved = true; S.autoPaused = false; }
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
    if (document.hidden) { if (!S.gap) S.gap = { at: Date.now(), km: S.km }; }
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
    stopMotion(); unwake();
    showPill(false);
  }

  function begin(type, resume) {
    S = resume || newSession(type);
    S.lastTick = Date.now();
    if (resume) { S.recent = []; S.win = []; S.kf = null; S.anchor = null; S.gap = null; S.jumps = 0; S.jumpPts = []; } // don't join a straight line across the reload
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
    if (!S.paused) { S.anchor = null; S.win = []; S.lastMoveAt = Date.now(); S.autoAt = null; S.autoPaused = false; S.lastEvidenceAt = Date.now(); S.evMs = S.movingMs; } // restart the line where you are now
    M.haptic(S.paused ? 'warning' : 'success');
    persist(true); paintLive(true);
  }
  function finish(manualKm) {
    if (!S) return null;
    if (S.gap && S.gap.back) settleGap(Date.now(), 0);
    tick();
    stopAll();
    var km = manualKm !== undefined && manualKm !== null ? manualKm : S.km;
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
      kcal: kcal, splits: S.splits.slice(), route: S.route.slice(), gaps: S.gaps
    };
    M.state.activities.push(a);
    // keep the list light: routes only for the last 60 sessions
    if (M.state.activities.length > 60) M.state.activities[M.state.activities.length - 61].route = [];
    M.save(true);
    S = null; clearLive();
    M.haptic('success');
    return a;
  }
  function discard() { stopAll(); S = null; clearLive(); M.toast('Session discarded'); }

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
  function routeSvg(route, w, h) {
    w = w || 320; h = h || 180;
    if (!route || route.length < 2) return '<div class="route-empty">' + M.icon('map') + '<span>Your route appears here as you move.</span></div>';
    var lat0 = route[0][0] * Math.PI / 180, k = Math.cos(lat0);
    var xs = route.map(function (p) { return p[1] * k; }), ys = route.map(function (p) { return -p[0]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var pad = 14, sw = (maxX - minX) || 1e-6, sh = (maxY - minY) || 1e-6;
    var sc = Math.min((w - 2 * pad) / sw, (h - 2 * pad) / sh);
    var ox = (w - sw * sc) / 2, oy = (h - sh * sc) / 2;
    var P = route.map(function (_, i) { return [(xs[i] - minX) * sc + ox, (ys[i] - minY) * sc + oy]; });
    var d = P.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var e = P[P.length - 1];
    return '<svg class="route" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Route drawing"><path d="' + d + '" fill="none" stroke="var(--now)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
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
      '<div class="stat"><span class="label">Steps</span><span class="value num">' + M.fmt(a.steps) + '</span><span class="sub">' + (a.stepsSource === 'sensor' ? 'counted' : 'estimated') + '</span></div></div>' +
      (a.route && a.route.length > 1 ? '<div class="route-box">' + routeSvg(a.route, 360, 200) + '</div>' : '') +
      (a.splits && a.splits.length ? '<div class="table-wrap" tabindex="0" role="region" aria-label="Kilometre splits" style="margin-top:14px"><table class="data"><thead><tr><th>Km</th><th class="n">Time</th><th class="n">Pace</th></tr></thead><tbody>' + a.splits.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="n">' + fmtClock(s) + '</td><td class="n">' + fmtPace(s) + ' /km</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<p class="muted" style="font-size:var(--fs-xs);margin:12px 0 0">' + (a.manual ? 'Logged by hand. ' : '') + 'Calories are active calories — burned by the movement, on top of what your body uses at rest — estimated from your speed and ' + (M.latestWeight() ? 'weight (' + M.showW(weightKg(), 0) + ' ' + M.wUnit() + ').' : 'an average weight of ' + M.showW(65, 0) + ' ' + M.wUnit() + ' — add your weight in your profile for a better estimate.') + (a.gaps ? ' The screen was off for part of it, so that distance was joined in a straight line and its time estimated.' : '') + '</p>' +
      '</section>';
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
      '<button type="button" class="btn btn-primary move-go" data-mv="start">' + M.icon('play') + 'Start</button>' +
      (!geoOK ? '<p class="hint">This browser can’t use GPS — Treadmill mode still counts steps.</p>' : '<p class="hint">Walk and Run use GPS — best outdoors with a clear sky. Treadmill uses the motion sensor. For steps, keep the phone in your pocket or hand.</p>') +
      '<button type="button" class="btn btn-ghost btn-sm" data-mv="manual" style="margin-top:10px">' + M.icon('edit') + 'Log one by hand</button></section>' +
      '<div class="grid-2" style="margin-top:16px"><section class="panel" aria-labelledby="mv-t"><div class="panel-title"><h3 id="mv-t">Today</h3></div><div class="stats"><div class="stat"><span class="label">Distance</span><span class="value">' + M.fmt(t.km, 2) + '<small>km</small></span></div><div class="stat"><span class="label">Steps</span><span class="value">' + M.fmt(t.steps) + '</span></div></div></section>' +
      '<section class="panel" aria-labelledby="mv-w"><div class="panel-title"><h3 id="mv-w">This week</h3><a class="btn btn-sm btn-ghost" href="#/move/history">History</a></div>' + weekBars(w) + '</section></div>' +
      (recent.length ? '<section class="panel" style="margin-top:16px" aria-labelledby="mv-r"><div class="panel-title"><h3 id="mv-r">Recent</h3></div>' + listHtml(recent) + '</section>' : '');
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
  function liveScreen(el) {
    el.innerHTML = '<section class="panel live" aria-live="off" aria-labelledby="lv-h">' +
      '<div class="row between wrap"><h2 id="lv-h" class="sr-only">' + TYPE[S.type] + ' in progress</h2><span class="lv-gps"></span><span class="badge">' + M.icon(S.type === 'treadmill' ? 'steps' : 'run') + TYPE[S.type] + '</span></div>' +
      '<div class="lv-main"><span class="lv-km num">0.00</span><small>km</small></div><p class="lv-state" aria-live="polite"></p>' +
      '<div class="lv-grid"><div><span class="label">Time</span><strong class="lv-time num">0:00</strong></div><div><span class="label">Pace now</span><strong class="lv-pace num">–:––</strong></div><div><span class="label">Avg pace</span><strong class="lv-avg num">–:––</strong></div><div><span class="label">Calories</span><strong class="lv-kcal num">0</strong></div><div><span class="label">Steps</span><strong class="lv-steps num">0</strong></div></div>' +
      '<div class="lv-route">' + routeSvg(S.route) + '</div><div class="lv-help"></div>' +
      '<div class="lv-btns"><button type="button" class="btn lv-pausebtn" data-mv="pause"></button><button type="button" class="btn btn-danger lv-stop" data-mv="stop">' + M.icon('stop') + 'Finish</button></div></section>';
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

  /* starting again while an unfinished session waits: save that one to History first, never throw it away */
  function startNew(type) {
    var sv = savedLive();
    if (sv && sv.status !== 'done' && !S) {
      S = sv; var old = finish();
      if (old) M.toast('Your unfinished ' + (TYPE[old.type] || 'session').toLowerCase() + ' (' + M.fmt(old.km, 2) + ' km) was saved to History.');
    }
    begin(type);
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
      if (parts[0] === 'history') return { title: 'Walks & runs', sub: 'History' };
      if (parts[0] === 's') return { title: 'Summary', sub: 'Walks & runs' };
      return { title: S ? (S.paused ? 'Paused' : 'Tracking') : 'Run & walk', sub: S ? TYPE[S.type] : 'Distance, time, steps and calories' };
    },
    render: function (el, parts) {
      if (parts[0] === 'history') {
        var all = (M.state.activities || []).slice().reverse();
        var tot = all.reduce(function (x, a) { return { km: x.km + a.km, sec: x.sec + a.movingSec }; }, { km: 0, sec: 0 });
        el.innerHTML = '<section class="panel"><div class="stats three"><div class="stat"><span class="label">All time</span><span class="value">' + M.fmt(tot.km, 1) + '<small>km</small></span></div><div class="stat"><span class="label">Sessions</span><span class="value">' + all.length + '</span></div><div class="stat"><span class="label">Time</span><span class="value">' + M.fmtDurShort(Math.round(tot.sec / 60)) + '</span></div></div></section>' +
          '<section class="panel" style="margin-top:16px">' + (all.length ? listHtml(all) : '<p class="muted" style="margin:0">No walks or runs yet.</p>') + '</section>' +
          '<div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="#/move">' + M.icon('run') + 'Start a new one</a></div>';
        return;
      }
      if (parts[0] === 's') {
        var a = (M.state.activities || []).filter(function (x) { return x.id === parts[1]; })[0];
        if (!a) { el.innerHTML = '<div class="empty"><p>Session not found.</p><a class="btn" href="#/move/history">History</a></div>'; return; }
        el.innerHTML = summaryHtml(a, parts[2] === 'new') + '<div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="#/move">Done</a><a class="btn" href="#/move/history">History</a><button type="button" class="btn btn-danger" data-mv="delete">' + M.icon('trash') + 'Delete</button></div>';
        el.addEventListener('click', function (e) {
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
          if (type !== 'treadmill' && !navigator.geolocation) { M.toast('GPS isn’t available here — try Treadmill mode.'); return; }
          if (type !== 'treadmill' && M.device && !M.device().mobile) {
            M.confirm('This computer has no GPS', 'Computers guess where they are from Wi-Fi, which can be hundreds of metres off — so distance, pace and calories would be wrong. Use Mizan on your phone, or log the walk by hand.', 'Start anyway').then(function (ok) { if (ok) startNew(type); });
            return;
          }
          startNew(type);
        } else if (act === 'pause') togglePause();
        else if (act === 'stop') stopSheet();
        else if (act === 'resume') { var sv = savedLive(); if (sv) { sv.paused = true; begin(sv.type, sv); } }
        else if (act === 'finish-saved') { var s2 = savedLive(); if (s2) { S = s2; var fa = finish(); if (fa) M.go('move/s/' + fa.id + '/new'); } }
        else if (act === 'discard-saved') { clearLive(); M.render(true); }
        else if (act === 'manual') manualSheet();
      });
    },
    leave: function () { if (S) showPill(true); }
  };

  M.move = { hav: hav, metFor: metFor, kcalOf: kcalOf, active: function () { return S; }, finish: finish, stepLenM: stepLenM, _feed: onPos, _motion: onMotion, _tick: tick };
})();
