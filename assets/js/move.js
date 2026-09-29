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
  /* MET by speed (km/h) — Compendium of Physical Activities (2024), walking and running rows */
  var MET = [[0, 2.0], [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 6.8], [8.0, 8.3], [8.4, 9.0], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.8], [12.9, 12.3], [13.8, 12.8], [14.5, 14.5], [16.1, 16.0], [17.7, 19.0]];
  function metFor(kmh) {
    if (!kmh || kmh < 0) return 2;
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
  function fmtPace(secPerKm) { if (!secPerKm || !isFinite(secPerKm) || secPerKm > 3600) return '–:––'; return Math.floor(secPerKm / 60) + ':' + M.pad(Math.round(secPerKm % 60) % 60); }
  M.fmtPace = fmtPace;

  function kcalOf(km, sec, type) {
    if (!sec) return 0;
    var kmh = km / (sec / 3600);
    if (type === 'treadmill' && !km) kmh = 5;
    return Math.round(metFor(kmh) * weightKg() * sec / 3600);
  }

  /* ------------------------------------------------------------------ */
  /* Live session                                                        */
  /* ------------------------------------------------------------------ */
  function newSession(type) {
    return {
      id: M.uid(), type: type, startAt: Date.now(), status: 'active', paused: false, autoPaused: false,
      movingMs: 0, lastTick: Date.now(), km: 0, steps: 0, sensorSteps: 0, hasSensor: false,
      route: [], last: null, lastAcc: null, lastT: null, lastMoveAt: null, moved: false,
      splits: [], lastSplitMs: 0, gps: type === 'treadmill' ? 'off' : 'searching', acc: null, gaps: 0,
      recent: [] // [t, km] for current pace
    };
  }
  function persist(force) {
    if (!S) return;
    if (!force && Date.now() - lastPersist < 4000) return;
    lastPersist = Date.now();
    try { var c = Object.assign({}, S); c.recent = []; localStorage.setItem(LIVE, JSON.stringify(c)); } catch (e) { /* ignore */ }
  }
  function clearLive() { try { localStorage.removeItem(LIVE); } catch (e) { /* ignore */ } }
  function savedLive() { try { var r = localStorage.getItem(LIVE); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

  function speak(text) {
    if (!M.state.settings.move.voice || !window.speechSynthesis) return;
    try { var u = new SpeechSynthesisUtterance(text); u.rate = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }

  function addDistance(m) {
    var before = S.km;
    S.km += m / 1000;
    S.lastMoveAt = Date.now(); S.moved = true; S.autoPaused = false;
    S.recent.push([Date.now(), S.km]);
    while (S.recent.length && Date.now() - S.recent[0][0] > 40000) S.recent.shift();
    if (Math.floor(S.km) > Math.floor(before)) {
      var split = (S.movingMs - S.lastSplitMs) / 1000;
      S.splits.push(Math.round(split));
      S.lastSplitMs = S.movingMs;
      if (M.state.settings.move.splitHaptic) M.haptic('success');
      speak(Math.floor(S.km) + ' kilometre' + (Math.floor(S.km) > 1 ? 's' : '') + '. Time ' + Math.floor(S.movingMs / 60000) + ' minutes. Pace ' + fmtPace(split).replace(':', ' ') + ' per kilometre.');
    }
  }

  function onPos(p) {
    if (!S || S.status === 'done') return;
    var c = p.coords, pt = [c.latitude, c.longitude], t = p.timestamp || Date.now(), acc = c.accuracy || 50;
    S.acc = Math.round(acc);
    var limit = M.state.settings.move.minAccuracy || 30;
    if (acc > limit) { S.gps = 'weak'; paintLive(); return; }
    S.gps = 'good';
    if (!S.last) { S.last = pt; S.lastAcc = acc; S.lastT = t; if (!S.paused) S.route.push([+pt[0].toFixed(5), +pt[1].toFixed(5)]); paintLive(); return; }
    var d = hav(S.last, pt), dt = Math.max(1, (t - S.lastT) / 1000);
    var maxSpeed = S.type === 'run' ? 9 : 6; // m/s — anything faster is a GPS jump (or a vehicle)
    if (d / dt > maxSpeed) { paintLive(); return; }
    var gate = Math.max(3, (acc + S.lastAcc) / 4);
    if (d < gate) { paintLive(); return; } // standing still: GPS wobble
    if (!S.paused) {
      if (dt > 20 && d > 30) S.gaps++;
      addDistance(d);
      S.route.push([+pt[0].toFixed(5), +pt[1].toFixed(5)]);
      if (S.route.length > 1500) S.route = S.route.filter(function (_, i) { return i % 2 === 0 || i === S.route.length - 1; });
    }
    S.last = pt; S.lastAcc = acc; S.lastT = t;
    paintLive();
    persist();
  }
  function onErr(e) {
    if (!S) return;
    S.gps = e && e.code === 1 ? 'denied' : 'weak';
    paintLive();
  }

  /* steps from the accelerometer: peaks in the smoothed acceleration */
  var lp = null, base = 9.8, above = false, lastStep = 0, firstMotion = 0;
  function onMotion(e) {
    if (!S || S.status === 'done') return;
    var a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (!firstMotion) firstMotion = Date.now();
    S.hasSensor = true;
    lp = lp === null ? mag : lp + 0.25 * (mag - lp);
    base = base + 0.02 * (lp - base);
    var now = Date.now();
    if (!above && lp - base > 1.3 && now - lastStep > 260) { above = true; lastStep = now; if (!S.paused) { S.sensorSteps++; if (S.type === 'treadmill') { S.km += stepLenM('walk') / 1000; S.lastMoveAt = now; S.moved = true; S.autoPaused = false; } } }
    else if (above && lp - base < 0.4) above = false;
  }
  function startMotion() {
    if (motionOn || !('DeviceMotionEvent' in window)) return Promise.resolve();
    var go = function () { window.addEventListener('devicemotion', onMotion); motionOn = true; };
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      return DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') go(); }).catch(function () {});
    }
    go(); return Promise.resolve();
  }
  function stopMotion() { window.removeEventListener('devicemotion', onMotion); motionOn = false; lp = null; }

  function wake() {
    if (!M.state.settings.move.keepAwake || !('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  function unwake() { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; } }

  var wasHidden = false;
  function tick() {
    if (!S) return;
    var now = Date.now(), dt = now - S.lastTick;
    S.lastTick = now;
    if (S.status === 'active' && !S.paused) {
      var auto = M.state.settings.move.autoPause && S.moved && !wasHidden && S.type !== 'treadmill' && now - (S.lastMoveAt || now) > 12000;
      S.autoPaused = auto;
      if (!auto) S.movingMs += Math.min(dt, wasHidden ? 6 * 3600000 : 5000);
    }
    wasHidden = false;
    S.steps = S.hasSensor ? S.sensorSteps : Math.round(S.km * 1000 / stepLenM(S.type));
    paintLive();
    persist();
  }
  document.addEventListener('visibilitychange', function () {
    if (!S) return;
    if (document.hidden) wasHidden = true;
    else { wake(); tick(); }
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
    if (resume) { S.recent = []; S.last = null; } // don't join a straight line across the reload
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
    if (!S.paused) { S.last = null; S.lastMoveAt = Date.now(); } // restart the line where you are now
    M.haptic(S.paused ? 'warning' : 'success');
    persist(true); paintLive(true);
  }
  function finish(manualKm) {
    if (!S) return null;
    tick();
    stopAll();
    var km = manualKm !== undefined && manualKm !== null ? manualKm : S.km;
    var sec = Math.round(S.movingMs / 1000);
    var steps = S.hasSensor ? S.sensorSteps : Math.round(km * 1000 / stepLenM(S.type));
    var a = {
      id: S.id, type: S.type, date: M.dateKey(new Date(S.startAt)), startAt: S.startAt, endAt: Date.now(),
      movingSec: sec, km: Math.round(km * 1000) / 1000, steps: steps, stepsSource: S.hasSensor ? 'sensor' : 'estimate',
      kcal: kcalOf(km, sec, S.type), splits: S.splits.slice(), route: S.route.slice(), gaps: S.gaps
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
    set('.lv-steps', M.fmt(S.hasSensor ? S.sensorSteps : Math.round(S.km * 1000 / stepLenM(S.type))));
    set('.lv-gps', gpsChip());
    set('.lv-state', S.paused ? 'Paused' : S.autoPaused ? 'Auto-paused — start moving to resume' : '');
    host.classList.toggle('is-paused', !!(S.paused || S.autoPaused));
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
    if (S && M.dateKey(new Date(S.startAt)) === k) { km += S.km; steps += S.hasSensor ? S.sensorSteps : Math.round(S.km * 1000 / stepLenM(S.type)); }
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
      '<p class="eyebrow">' + M.icon(a.type === 'treadmill' ? 'steps' : 'run') + TYPE[a.type] + ' · ' + M.fmtDate(a.date, 'weekday') + ' · ' + new Date(a.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</p>' +
      '<h2 id="ms-h">' + (fresh ? 'Well done! 🎉' : TYPE[a.type]) + '</h2>' +
      '<div class="ms-big"><span class="num">' + M.fmt(a.km, 2) + '</span><small>km</small></div>' +
      '<div class="stats move-stats"><div class="stat"><span class="label">Time</span><span class="value num">' + fmtClock(a.movingSec) + '</span></div>' +
      '<div class="stat"><span class="label">Avg pace</span><span class="value num">' + fmtPace(pace) + '<small>/km</small></span></div>' +
      '<div class="stat"><span class="label">Calories</span><span class="value num">' + M.fmt(a.kcal) + '<small>kcal</small></span></div>' +
      '<div class="stat"><span class="label">Steps</span><span class="value num">' + M.fmt(a.steps) + '</span><span class="sub">' + (a.stepsSource === 'sensor' ? 'counted' : 'estimated') + '</span></div></div>' +
      (a.route && a.route.length > 1 ? '<div class="route-box">' + routeSvg(a.route, 360, 200) + '</div>' : '') +
      (a.splits && a.splits.length ? '<div class="table-wrap" tabindex="0" role="region" aria-label="Kilometre splits" style="margin-top:14px"><table class="data"><thead><tr><th>Km</th><th class="n">Time</th><th class="n">Pace</th></tr></thead><tbody>' + a.splits.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="n">' + fmtClock(s) + '</td><td class="n">' + fmtPace(s) + ' /km</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<p class="muted" style="font-size:var(--fs-xs);margin:12px 0 0">Calories are an estimate from your speed and weight (' + M.showW(weightKg(), 0) + ' ' + M.wUnit() + ').' + (a.gaps ? ' The screen was off for part of it, so some distance was joined in a straight line.' : '') + '</p>' +
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
    el.innerHTML =
      (saved && saved.status !== 'done' ? U.note('warn', '<p><strong>You have an unfinished ' + (TYPE[saved.type] || 'session').toLowerCase() + '</strong> — ' + M.fmt(saved.km, 2) + ' km in ' + fmtClock(saved.movingMs / 1000) + '.</p><div class="btn-row" style="margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-mv="resume">Resume</button><button type="button" class="btn btn-sm" data-mv="finish-saved">Finish & save</button><button type="button" class="btn btn-sm btn-ghost" data-mv="discard-saved">Discard</button></div>') + '<div style="height:16px"></div>' : '') +
      '<section class="panel move-start" aria-labelledby="mv-h"><h2 id="mv-h">Ready?</h2><p class="soft">Pick what you’re doing and tap Start. Keep Mizan open — the screen stays on while tracking.</p>' +
      '<fieldset class="field"><legend class="sr-only">Activity</legend><div class="seg move-type" role="radiogroup">' + ['walk', 'run', 'treadmill'].map(function (x) { return '<label><input type="radio" name="mtype" value="' + x + '"' + (type === x ? ' checked' : '') + '><span>' + M.icon(x === 'treadmill' ? 'steps' : x === 'run' ? 'run' : 'steps') + TYPE[x] + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<button type="button" class="btn btn-primary move-go" data-mv="start">' + M.icon('play') + 'Start</button>' +
      (!geoOK ? '<p class="hint">This browser can’t use GPS — Treadmill mode still counts steps.</p>' : '<p class="hint">Walk and Run use GPS — best outdoors with a clear sky. Treadmill uses the motion sensor.</p>') + '</section>' +
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
          begin(type);
        } else if (act === 'pause') togglePause();
        else if (act === 'stop') stopSheet();
        else if (act === 'resume') { var sv = savedLive(); if (sv) { sv.paused = true; begin(sv.type, sv); } }
        else if (act === 'finish-saved') { var s2 = savedLive(); if (s2) { S = s2; var fa = finish(); if (fa) M.go('move/s/' + fa.id + '/new'); } }
        else if (act === 'discard-saved') { clearLive(); M.render(true); }
      });
    },
    leave: function () { if (S) showPill(true); }
  };

  M.move = { hav: hav, metFor: metFor, kcalOf: kcalOf, active: function () { return S; }, finish: finish, stepLenM: stepLenM, _feed: onPos };
})();
