/* Mizan — prayer time calculation.
   Astronomical method described at praytimes.org (sun position after the U.S. Naval Observatory
   approximation). Times are returned as minutes after local midnight. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var METHODS = {
    MWL: { name: 'Muslim World League', fajr: 18, isha: 17 },
    ISNA: { name: 'Islamic Society of North America', fajr: 15, isha: 15 },
    Egypt: { name: 'Egyptian General Authority of Survey', fajr: 19.5, isha: 17.5 },
    Makkah: { name: 'Umm al-Qura, Makkah', fajr: 18.5, ishaMin: 90 },
    Karachi: { name: 'University of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
    Tehran: { name: 'Institute of Geophysics, Tehran', fajr: 17.7, isha: 14, maghribAngle: 4.5 },
    Jafari: { name: 'Shia Ithna Ashari (Jafari)', fajr: 16, isha: 14, maghribAngle: 4 },
    Singapore: { name: 'Singapore / Malaysia / Indonesia', fajr: 20, isha: 18 },
    Turkey: { name: 'Diyanet, Turkey', fajr: 18, isha: 17 }
  };

  var dtr = function (d) { return d * Math.PI / 180; };
  var rtd = function (r) { return r * 180 / Math.PI; };
  var sin = function (d) { return Math.sin(dtr(d)); };
  var cos = function (d) { return Math.cos(dtr(d)); };
  var tan = function (d) { return Math.tan(dtr(d)); };
  var arcsin = function (x) { return rtd(Math.asin(x)); };
  var arccos = function (x) { return rtd(Math.acos(x)); };
  var arccot = function (x) { return rtd(Math.atan(1 / x)); };
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
    var eqt = q / 15 - fixHour(RA);
    var decl = arcsin(sin(e) * sin(L));
    return { declination: decl, equation: eqt };
  }

  M.PRAYER_METHODS = METHODS;
  M.PRAYER_NAMES = [
    { id: 'fajr', label: 'Fajr' },
    { id: 'sunrise', label: 'Sunrise' },
    { id: 'dhuhr', label: 'Dhuhr' },
    { id: 'asr', label: 'Asr' },
    { id: 'maghrib', label: 'Maghrib' },
    { id: 'isha', label: 'Isha' }
  ];

  /* dateKey 'YYYY-MM-DD', cfg { lat, lng, method, asr: 'Standard'|'Hanafi' } */
  function times(dateKey, cfg) {
    var p = dateKey.split('-');
    var y = +p[0], mo = +p[1], d = +p[2];
    var lat = +cfg.lat, lng = +cfg.lng;
    var tz = -new Date(y, mo - 1, d, 12, 0, 0).getTimezoneOffset() / 60;
    var method = METHODS[cfg.method] || METHODS.MWL;
    var asrFactor = cfg.asr === 'Hanafi' ? 2 : 1;
    var jDate = julian(y, mo, d) - lng / (15 * 24);

    function midDay(t) { var eqt = sunPosition(jDate + t).equation; return fixHour(12 - eqt); }
    function sunAngleTime(angle, t, ccw) {
      var decl = sunPosition(jDate + t).declination;
      var noon = midDay(t);
      var v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (v > 1 || v < -1) return NaN;
      var tt = arccos(v) / 15;
      return noon + (ccw ? -tt : tt);
    }
    function asrTime(factor, t) {
      var decl = sunPosition(jDate + t).declination;
      var angle = -arccot(factor + tan(Math.abs(lat - decl)));
      return sunAngleTime(angle, t);
    }

    var t0 = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
    var pt = function (h) { return h / 24; };
    var r = {
      fajr: sunAngleTime(method.fajr, pt(t0.fajr), true),
      sunrise: sunAngleTime(0.833, pt(t0.sunrise), true),
      dhuhr: midDay(pt(t0.dhuhr)),
      asr: asrTime(asrFactor, pt(t0.asr)),
      sunset: sunAngleTime(0.833, pt(t0.sunset)),
      maghrib: method.maghribAngle ? sunAngleTime(method.maghribAngle, pt(t0.maghrib)) : null,
      isha: method.isha ? sunAngleTime(method.isha, pt(t0.isha)) : null,
      nightfall: sunAngleTime(8.5, pt(t0.sunset))
    };
    // local time
    Object.keys(r).forEach(function (k) { if (r[k] !== null) r[k] += tz - lng / 15; });
    if (r.maghrib === null) r.maghrib = r.sunset; // 0 min after sunset
    if (r.isha === null) r.isha = r.maghrib + (method.ishaMin || 90) / 60;

    // high-latitude safety (middle of the night rule)
    var night = fixHour(r.sunrise - r.sunset);
    var portion = night / 2;
    var diffF = fixHour(r.sunrise - r.fajr);
    if (isNaN(r.fajr) || diffF > portion) r.fajr = r.sunrise - portion;
    var diffI = fixHour(r.isha - r.sunset);
    if (isNaN(r.isha) || diffI > portion) r.isha = r.sunset + portion;
    if (isNaN(r.maghrib)) r.maghrib = r.sunset;
    if (isNaN(r.nightfall)) r.nightfall = r.sunset + 0.5;

    var out = {};
    Object.keys(r).forEach(function (k) {
      var h = r[k];
      out[k] = isNaN(h) ? null : Math.round(fixHour(h) * 60);
    });
    return out;
  }

  var cache = {};
  M.prayer = {
    times: function (dateKey, cfg) {
      var key = dateKey + '|' + cfg.lat + '|' + cfg.lng + '|' + cfg.method + '|' + cfg.asr;
      if (!cache[key]) cache[key] = times(dateKey, cfg);
      return cache[key];
    },
    raw: times,
    next: function (cfg) {
      var today = M.today();
      var now = M.nowMin();
      var t = M.prayer.times(today, cfg);
      var order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
      for (var i = 0; i < order.length; i++) {
        var k = order[i];
        if (t[k] !== null && t[k] > now) return { id: k, at: t[k], inMin: t[k] - now, day: today };
      }
      var tm = M.prayer.times(M.addDays(today, 1), cfg);
      return { id: 'fajr', at: tm.fajr, inMin: tm.fajr + 1440 - now, day: M.addDays(today, 1) };
    }
  };
})();
