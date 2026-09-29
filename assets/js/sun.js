/* Mizan — sunrise, midday and sunset for the person's location (optional).
   Sun position after the U.S. Naval Observatory approximation. Times are minutes after local midnight.
   Everything is calculated on the device; the location never leaves it. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var dtr = function (d) { return d * Math.PI / 180; };
  var rtd = function (r) { return r * 180 / Math.PI; };
  var sin = function (d) { return Math.sin(dtr(d)); };
  var cos = function (d) { return Math.cos(dtr(d)); };
  var arcsin = function (x) { return rtd(Math.asin(x)); };
  var arccos = function (x) { return rtd(Math.acos(x)); };
  var arctan2 = function (y, x) { return rtd(Math.atan2(y, x)); };
  var fix = function (a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  var fixAngle = function (a) { return fix(a, 360); };
  var fixHour = function (a) { return fix(a, 24); };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fixAngle(357.529 + 0.98560028 * D);
    var q = fixAngle(280.459 + 0.98564736 * D);
    var L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    var e = 23.439 - 0.00000036 * D;
    var RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
    return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - fixHour(RA) };
  }

  /* { sunrise, noon, sunset, dawn, dusk } in minutes, or null when the sun doesn't rise/set */
  function calc(dateKey, lat, lng) {
    var p = dateKey.split('-');
    var y = +p[0], mo = +p[1], d = +p[2];
    var tz = -new Date(y, mo - 1, d, 12, 0, 0).getTimezoneOffset() / 60;
    var jDate = julian(y, mo, d) - lng / (15 * 24);
    function midDay(t) { return fixHour(12 - sunPosition(jDate + t).equation); }
    function angleTime(angle, t, before) {
      var decl = sunPosition(jDate + t).declination;
      var v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (v > 1 || v < -1) return NaN;
      var tt = arccos(v) / 15;
      return midDay(t) + (before ? -tt : tt);
    }
    var r = {
      dawn: angleTime(6, 5 / 24, true),
      sunrise: angleTime(0.833, 6 / 24, true),
      noon: midDay(12 / 24),
      sunset: angleTime(0.833, 18 / 24),
      dusk: angleTime(6, 18 / 24)
    };
    var out = {};
    Object.keys(r).forEach(function (k) {
      var h = r[k] + tz - lng / 15;
      out[k] = isNaN(h) ? null : Math.round(fixHour(h) * 60);
    });
    return out;
  }

  var cache = {};
  var LABELS = { sunrise: 'Sunrise', noon: 'Midday', sunset: 'Sunset' };

  M.sun = {
    calc: calc,
    /* on, with a location */
    active: function () {
      var s = M.state && M.state.settings.sun;
      return !!(s && s.enabled && s.lat !== null && s.lng !== null && s.lat !== undefined && s.lng !== undefined);
    },
    raw: function (dateKey) {
      var s = M.state.settings.sun;
      var key = dateKey + '|' + s.lat + '|' + s.lng;
      if (!cache[key]) cache[key] = calc(dateKey, +s.lat, +s.lng);
      return cache[key];
    },
    /* [{id, label, at}] in order — empty when off */
    times: function (dateKey) {
      if (!M.sun.active()) return [];
      var t = M.sun.raw(dateKey);
      return ['sunrise', 'noon', 'sunset'].filter(function (k) { return t[k] !== null; }).map(function (k) { return { id: k, label: LABELS[k], at: t[k] }; });
    },
    timeMap: function (dateKey) {
      var out = {};
      M.sun.times(dateKey).forEach(function (x) { out[x.id] = x.at; });
      return out;
    },
    anchors: function () { return M.sun.active() ? [{ id: 'sunrise', label: 'Sunrise' }, { id: 'noon', label: 'Midday' }, { id: 'sunset', label: 'Sunset' }] : []; },
    anchorLabel: function (id) { return (LABELS[id] || id).toLowerCase(); },
    next: function () {
      var today = M.today(), now = M.nowMin();
      var list = M.sun.times(today);
      for (var i = 0; i < list.length; i++) if (list[i].at > now) return { item: list[i], inMin: list[i].at - now };
      var tm = M.sun.times(M.addDays(today, 1));
      return tm.length ? { item: tm[0], inMin: tm[0].at + 1440 - now } : null;
    }
  };
})();
