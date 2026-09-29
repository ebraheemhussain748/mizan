/* Mizan — core: helpers, icons, storage, routing, dialogs, toasts */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  M.VERSION = '2.1.1';
  M.views = {};

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  M.$ = function (sel, root) { return (root || document).querySelector(sel); };
  M.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  M.esc = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  };
  M.uid = function () {
    return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8);
  };
  M.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  M.round = function (v, step) { step = step || 1; return Math.round(v / step) * step; };
  M.num = function (v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  };
  M.fmt = function (v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    digits = digits === undefined ? 0 : digits;
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  M.plural = function (n, one, many) { return n === 1 ? one : (many || one + 's'); };
  M.deepClone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* Seeded RNG (mulberry32) for repeatable plan generation */
  M.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  M.shuffle = function (arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* ------------------------------------------------------------------ */
  /* Dates & times (all local time)                                      */
  /* ------------------------------------------------------------------ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  M.pad = pad;
  M.dateKey = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  M.today = function () { return M.dateKey(new Date()); };
  M.parseKey = function (k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0); };
  M.addDays = function (k, n) { var d = M.parseKey(k); d.setDate(d.getDate() + n); return M.dateKey(d); };
  M.daysBetween = function (a, b) { return Math.round((M.parseKey(b) - M.parseKey(a)) / 86400000); };
  M.weekday = function (k) { return M.parseKey(k).getDay(); }; // 0 = Sunday
  M.startOfWeek = function (k) {
    var d = M.parseKey(k); var day = d.getDay(); var diff = (day + 6) % 7; // Monday start
    d.setDate(d.getDate() - diff); return M.dateKey(d);
  };
  M.weekKeys = function (k) { var s = M.startOfWeek(k); var out = []; for (var i = 0; i < 7; i++) out.push(M.addDays(s, i)); return out; };
  M.isoWeek = function (k) {
    var d = M.parseKey(k); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var w1 = new Date(d.getFullYear(), 0, 4);
    var wk = 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + '-W' + pad(wk);
  };
  M.DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  M.DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  M.DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  M.MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  M.fmtDate = function (k, opts) {
    var d = M.parseKey(k);
    if (opts === 'short') return d.getDate() + ' ' + M.MONTH_SHORT[d.getMonth()];
    if (opts === 'weekday') return M.DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + M.MONTH_SHORT[d.getMonth()];
    return M.DAY_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + M.MONTH_SHORT[d.getMonth()];
  };

  M.toMin = function (hhmm) {
    if (typeof hhmm === 'number') return hhmm;
    if (!hhmm || hhmm.indexOf(':') < 0) return 0;
    var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]);
  };
  M.fromMin = function (min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  };
  M.nowMin = function () { var d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  M.dur = function (a, b) { var d = M.toMin(b) - M.toMin(a); if (d <= 0) d += 1440; return d; };
  M.fmtDur = function (min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + ' h ' + m + ' min';
    if (h) return h + ' h';
    return m + ' min';
  };
  M.fmtDurShort = function (min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  };
  M.fmtTime = function (v, withSuffix) {
    var min = typeof v === 'number' ? v : M.toMin(v);
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    if (M.state && M.state.settings.clock === '12') {
      var suf = h < 12 ? 'am' : 'pm';
      var hh = h % 12; if (hh === 0) hh = 12;
      return hh + ':' + pad(m) + (withSuffix === false ? '' : ' ' + suf);
    }
    return pad(h) + ':' + pad(m);
  };
  M.ageFrom = function (profile) {
    if (profile.dob) {
      var d = new Date(profile.dob), n = new Date();
      var a = n.getFullYear() - d.getFullYear();
      var md = n.getMonth() - d.getMonth();
      if (md < 0 || (md === 0 && n.getDate() < d.getDate())) a--;
      return a;
    }
    return profile.age || null;
  };
  M.ageMonths = function (profile) {
    if (profile.dob) {
      var d = new Date(profile.dob), n = new Date();
      return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()) + (n.getDate() - d.getDate()) / 30.4375;
    }
    return profile.age ? profile.age * 12 + 6 : null; // assume mid-year when only age in years is known
  };

  /* ------------------------------------------------------------------ */
  /* Icons (24×24, stroke = currentColor)                                */
  /* ------------------------------------------------------------------ */
  var P = {
    today: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/><path d="M12 1.8v1.4M12 20.8v1.4"/>',
    plan: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4M7.5 13.5h4M7.5 16.8h7"/>',
    habits: '<path d="M4 12.5l4.2 4.2L20 5"/><path d="M4 20h16" opacity=".5"/>',
    body: '<path d="M3 12h3.5l2.2-5 4 11 2.6-7 1.4 3H21"/>',
    food: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5"/>',
    more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l2 2"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    check: '<path d="M4.5 12.5l4.5 4.5L19.5 6.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    half: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    water: '<path d="M12 3.2s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 10.2 12 3.2 12 3.2z"/><path d="M9 15a3 3 0 0 0 3 3" />',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    dumbbell: '<path d="M6.5 7.5v9M3.5 9.5v5M17.5 7.5v9M20.5 9.5v5M6.5 12h11"/>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z"/>',
    ruler: '<rect x="2.8" y="7.5" width="18.4" height="9" rx="2"/><path d="M7 7.5v3M11 7.5v4.5M15 7.5v3M19 7.5v4.5"/>',
    scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9a6 6 0 0 1 8 0l-2.2 2.6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    alert: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    good: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.6 2.6L16.2 9"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5"/>',
    book: '<path d="M4 5.5A2 2 0 0 1 6 3.5h13.5v15H6a2 2 0 0 0-2 2z"/><path d="M4 20.5V5.5M8.5 8h7"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L3.5 9M4 13a8 8 0 0 0 14.3 4.3l2.2-2.3"/><path d="M3.5 4v5h5M20.5 20v-5h-5"/>',
    print: '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8.5" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    pin: '<path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 0 0-13 0c0 4.9 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    bed: '<path d="M3 18.5V6.5M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="11" r="1.8"/>',
    flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4.5-4-6.5-4.5-11-3 2-5.5 5-5.5 8.5-1-.7-1.5-2-1.5-3C5 11 6 13 6 15a6 6 0 0 0 6 6z"/>',
    leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19l7-7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 11.5h.5M11.8 11.5h.5M15 11.5h.5M8.5 15h.5M11.8 15h.5M15 15v3M8.5 18h.5M11.8 18h.5"/>',
    list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.2" cy="6.5" r="1"/><circle cx="4.2" cy="12" r="1"/><circle cx="4.2" cy="17.5" r="1"/>',
    dash: '<rect x="3.5" y="3.5" width="7.5" height="9" rx="2"/><rect x="13" y="3.5" width="7.5" height="5.5" rx="2"/><rect x="13" y="11" width="7.5" height="9.5" rx="2"/><rect x="3.5" y="14.5" width="7.5" height="6" rx="2"/>',
    run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2.5V21M6.5 12l2.5-3.5 4-1 2.5 3.5 3 1.5"/><path d="M11 15l1.5-5"/>',
    face: '<path d="M12 3.5c4.4 0 7 3.3 7 7.8 0 5-3.2 9.2-7 9.2s-7-4.2-7-9.2c0-4.5 2.6-7.8 7-7.8z"/><path d="M9.3 11.5v.4M14.7 11.5v.4M9.8 15.5c1.3 1 3.1 1 4.4 0"/>',
    chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 8.5h7M8.5 11.5h4.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.6 1.6A4 4 0 0 1 17.5 18.5z"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.6 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11.5" r="1.1"/><circle cx="10.2" cy="7.6" r="1.1"/><circle cx="14.6" cy="7.6" r="1.1"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    camera: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>',
    send: '<path d="M4 12 20 4l-6 16-2.5-6.5z"/><path d="M11.5 13.5 20 4"/>',
    steps: '<path d="M8 3.5c1.8 0 2.8 2.2 2.8 4.8S10 12.5 8.3 12.5 5.5 11 5.5 8.5 6.2 3.5 8 3.5zM6 15h4.5v1.8a2.3 2.3 0 0 1-4.5 0zM16 7.5c1.8 0 2.5 2 2.5 4.5s-1.2 4-2.8 4-2.5-1.3-2.5-3.7S14.2 7.5 16 7.5zM13.5 19h4.5v.2a2.3 2.3 0 0 1-4.5 0z"/>',
    map: '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    lotus: '<path d="M12 19c-2.6-1.6-4-4-4-7.2 0-2.2 1.3-4.2 4-6.3 2.7 2.1 4 4.1 4 6.3 0 3.2-1.4 5.6-4 7.2z"/><path d="M12 19c-4 .4-7.3-1.1-8.8-4.6 1.6-.7 3.2-.8 4.8-.3M12 19c4 .4 7.3-1.1 8.8-4.6-1.6-.7-3.2-.8-4.8-.3"/>',
    sparkles: '<path d="M10 3.5l1.5 4.5 4.5 1.5-4.5 1.5L10 15.5 8.5 11 4 9.5 8.5 8zM17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    vibrate: '<rect x="7.5" y="4" width="9" height="16" rx="2"/><path d="M4 8.5v7M20 8.5v7M1.8 10.5v3M22.2 10.5v3"/>',
    spark: '<path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    cart: '<path d="M3 4h2.5l2.3 11h10.4l2-7.5H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    swap: '<path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A3 3 0 0 0 8 18a2.5 2.5 0 0 0 4 1.5V5.5A2.5 2.5 0 0 0 9 4.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5A3 3 0 0 1 16 18a2.5 2.5 0 0 1-4 1.5"/>',
    school: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c3.5 2.5 7.5 2.5 11 0v-5M21.5 9v5"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5"/>',
    routine: '<path d="M4 12a8 8 0 1 1 2.3 5.7"/><path d="M4 18v-5h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8.5 10.5h-2a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2"/>',
    kebab: '<circle cx="12" cy="5.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/>',
    addsq: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    home: '<path d="M4 11 12 4.5 20 11"/><path d="M6 9.5v10h12v-10"/><path d="M10 19.5v-5h4v5"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'
  };
  M.icon = function (name, extra) {
    var p = P[name] || P.info;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (extra ? ' ' + extra : '') + '>' + p + '</svg>';
  };
  M.logo = function (size) {
    size = size || 32;
    return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' +
      '<circle cx="24" cy="24" r="21" fill="none" stroke="var(--ink)" stroke-width="3.2"/>' +
      '<path d="M5.5 29.5h37" stroke="var(--ink)" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M13 29.5a11 11 0 0 1 22 0" fill="var(--accent)"/>' +
      '<path d="M24 6.5v6" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round"/>' +
      '</svg>';
  };

  /* ------------------------------------------------------------------ */
  /* Categories                                                          */
  /* ------------------------------------------------------------------ */
  /* Order matters: it is the colour order of the validated palette, so neighbours in a day stay distinct */
  M.CATS = [
    { id: 'study', label: 'Study', icon: 'book' },
    { id: 'school', label: 'School / work', icon: 'school' },
    { id: 'free', label: 'Free time', icon: 'smile' },
    { id: 'exercise', label: 'Exercise', icon: 'dumbbell' },
    { id: 'sleep', label: 'Sleep', icon: 'moon' },
    { id: 'personal', label: 'Personal time', icon: 'sparkles' },
    { id: 'meal', label: 'Meals', icon: 'food' },
    { id: 'screen', label: 'Screen time', icon: 'phone' },
    { id: 'routine', label: 'Routine & buffer', icon: 'routine' }
  ];
  M.cat = function (id) { for (var i = 0; i < M.CATS.length; i++) if (M.CATS[i].id === id) return M.CATS[i]; return M.CATS[M.CATS.length - 1]; };
  M.catVar = function (id) { return 'var(--c-' + (M.cat(id).id) + ')'; };
  M.onCatVar = function (id) { return 'var(--on-c-' + (M.cat(id).id) + ')'; };

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */
  var KEY = 'mizan.v1';
  var storageOK = (function () {
    try { var k = '__mizan_test__'; localStorage.setItem(k, k); localStorage.removeItem(k); return true; } catch (e) { return false; }
  })();
  M.storageOK = storageOK;

  M.guessClock = function () {
    try {
      var s = new Date(2020, 0, 1, 15, 0).toLocaleTimeString([], { hour: 'numeric' });
      return /am|pm/i.test(s) ? '12' : '24';
    } catch (e) { return '24'; }
  };
  M.guessAsian = function () {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^Asia\//.test(tz);
    } catch (e) { return false; }
  };

  /* Every screen people can put in the bottom bar or open from the ☰ menu */
  M.NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dash', href: '#/dashboard' },
    { id: 'today', label: 'Today', icon: 'today', href: '#/today' },
    { id: 'plan', label: 'Plan', icon: 'plan', href: '#/plan' },
    { id: 'habits', label: 'Habits', icon: 'habits', href: '#/habits' },
    { id: 'body', label: 'Body', icon: 'body', href: '#/body' },
    { id: 'food', label: 'Food', icon: 'food', href: '#/food' },
    { id: 'move', label: 'Run & walk', icon: 'run', href: '#/move' },
    { id: 'looks', label: 'Looks', icon: 'face', href: '#/looks' },
    { id: 'assistant', label: 'Assistant', icon: 'chat', href: '#/assistant' },
    { id: 'review', label: 'Weekly review', icon: 'list', href: '#/review' },
    { id: 'tools', label: 'Calculators', icon: 'calc', href: '#/body/tools' },
    { id: 'workouts', label: 'Workout plan', icon: 'dumbbell', href: '#/body/workouts' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' }
  ];
  M.nav = function (id) { for (var i = 0; i < M.NAV.length; i++) if (M.NAV[i].id === id) return M.NAV[i]; return null; };

  /* Dashboard cards (people can hide and reorder them) */
  M.DASH_CARDS = [
    { id: 'now', label: 'Right now' },
    { id: 'next', label: 'Up next' },
    { id: 'water', label: 'Water' },
    { id: 'important', label: 'Important' },
    { id: 'bmi', label: 'BMI & body' },
    { id: 'progress', label: 'Today’s progress' },
    { id: 'activity', label: 'Walks & runs' },
    { id: 'actions', label: 'Quick actions' },
    { id: 'habits', label: 'Habits' },
    { id: 'sun', label: 'Sun times', on: false }
  ];

  M.defaultState = function () {
    return {
      v: 1,
      created: M.today(),
      profile: {
        name: '', sex: '', age: null, dob: '', heightCm: null, activity: 'light',
        goal: 'maintain', targetKg: null, pace: 'steady',
        diet: 'veg', cuisine: 'in', allergies: [], mealsPerDay: 4, supplements: false,
        waistCm: null, neckCm: null, hipCm: null, restingHr: null,
        experience: 'beginner', equipment: 'none', workoutDays: 3, sessionMin: 45
      },
      settings: {
        units: 'metric', clock: M.guessClock(), bmiStandard: M.guessAsian() ? 'asian' : 'who',
        theme: 'system', numbersLight: false, onboarded: false, haptics: true,
        sun: { enabled: false, lat: null, lng: null, place: '' },
        waterGoalMl: null, glassMl: 250,
        water: { remind: true, everyMin: 90, quietInSleep: true },
        nav: { tabs: ['dashboard', 'today', 'plan', 'habits', 'body'], start: 'dashboard' },
        dash: { cards: M.DASH_CARDS.map(function (c) { return { id: c.id, on: c.on !== false }; }) },
        look: { accent: '', fontScale: 1, radius: 'soft', density: 'comfortable', motion: 'full', catColors: {}, font: 'default' },
        bot: { name: 'Mizo', avatar: '✨', color: '', userColor: '', bubble: 'round', size: 'm', position: 'right', showButton: true, greeting: '', custom: [], hidden: [], remember: true },
        move: { keepAwake: true, autoPause: true, voice: false, splitHaptic: true, stepCm: null, minAccuracy: 30, type: 'walk' },
        backup: { remindDays: 7, lastFileAt: null, drive: { connected: false, lastAt: null, fileId: null, auto: true } }
      },
      setup: null,
      routines: M.templates ? M.templates.defaultRoutines() : [],
      checkins: {}, misses: {},
      habits: [], habitLog: {},
      reflections: {},
      weights: [], water: {}, waterLog: {}, foodLog: {}, customFoods: [],
      activities: [], looks: null, chat: [],
      mealPlan: null, workoutPlan: null, workoutLog: {}, focus: {}
    };
  };

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (saved[k] === undefined) return;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) {
        base[k] = merge(base[k], saved[k]);
      } else {
        base[k] = saved[k];
      }
    });
    Object.keys(saved).forEach(function (k) { if (base[k] === undefined) base[k] = saved[k]; });
    return base;
  }

  /* Bring older saved data (v1.x) up to date, and fill in anything new */
  M.upgrade = function (st) {
    var s = st.settings;
    // v1.x prayer / faith settings → plain sun times
    if (s.prayer) {
      if (!s.sun || s.sun.lat === null) s.sun = { enabled: !!s.prayer.enabled, lat: s.prayer.lat, lng: s.prayer.lng, place: s.prayer.place || '' };
      delete s.prayer;
    }
    delete s.faith;
    var SUN = ['sunrise', 'noon', 'sunset'];
    var fixCat = function (x) { if (x && x.cat === 'prayer') x.cat = 'personal'; };
    (st.routines || []).forEach(function (r) {
      (r.blocks || []).forEach(function (b) {
        fixCat(b);
        if (b.anchor) {
          var to = b.anchor.to || b.anchor.prayer;
          b.anchor = SUN.indexOf(to) >= 0 ? { to: to, offset: b.anchor.offset || 0 } : null;
        }
      });
    });
    (st.habits || []).forEach(fixCat);
    Object.keys(st.misses || {}).forEach(function (k) { (st.misses[k] || []).forEach(fixCat); });
    // make sure every dashboard card and nav tab is known
    var known = M.DASH_CARDS.map(function (c) { return c.id; });
    var have = (s.dash.cards || []).filter(function (c) { return known.indexOf(c.id) >= 0; });
    M.DASH_CARDS.forEach(function (c) { if (!have.some(function (h) { return h.id === c.id; })) have.push({ id: c.id, on: c.on !== false }); });
    s.dash.cards = have;
    var navIds = M.NAV.map(function (n) { return n.id; });
    s.nav.tabs = (s.nav.tabs || []).filter(function (t, i, a) { return navIds.indexOf(t) >= 0 && a.indexOf(t) === i; }).slice(0, 5);
    if (!s.nav.tabs.length) s.nav.tabs = ['dashboard', 'today', 'plan', 'habits', 'body'];
    if (navIds.indexOf(s.nav.start) < 0) s.nav.start = 'dashboard';
    if (!Array.isArray(st.activities)) st.activities = [];
    if (!st.waterLog || typeof st.waterLog !== 'object') st.waterLog = {};
    return st;
  };

  M.load = function () {
    var st = M.defaultState();
    if (storageOK) {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) st = M.upgrade(merge(st, JSON.parse(raw)));
      } catch (e) { console.warn('Mizan: could not read saved data', e); }
    }
    M.state = st;
    return st;
  };

  var saveTimer = null;
  M.save = function (immediate) {
    if (!storageOK) return false;
    var write = function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(M.state));
        M.lastSaveError = null;
        (M.afterSave || []).forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
      } catch (e) {
        M.lastSaveError = e;
        M.toast('Could not save — your browser storage is full or blocked.');
      }
    };
    clearTimeout(saveTimer);
    if (immediate) write(); else saveTimer = setTimeout(write, 120);
    return true;
  };
  window.addEventListener('pagehide', function () { if (saveTimer) { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(M.state)); } catch (e) { /* ignore */ } } });

  M.resetAll = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    M.state = M.defaultState();
    M.save(true);
  };

  /* Ask the browser to keep our data (best effort) */
  M.requestPersist = function () {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------------------------ */
  /* Units                                                               */
  /* ------------------------------------------------------------------ */
  M.imperial = function () { return M.state && M.state.settings.units === 'imperial'; };
  M.kgToLb = function (kg) { return kg * 2.2046226218; };
  M.lbToKg = function (lb) { return lb / 2.2046226218; };
  M.cmToIn = function (cm) { return cm / 2.54; };
  M.inToCm = function (inch) { return inch * 2.54; };
  M.wUnit = function () { return M.imperial() ? 'lb' : 'kg'; };
  M.showW = function (kg, d) { if (kg === null || kg === undefined) return '—'; return M.fmt(M.imperial() ? M.kgToLb(kg) : kg, d === undefined ? 1 : d); };
  M.inW = function (v) { var n = M.num(v); if (n === null) return null; return M.imperial() ? M.lbToKg(n) : n; };
  M.showH = function (cm) {
    if (!cm) return '—';
    if (M.imperial()) { var t = Math.round(M.cmToIn(cm)); return Math.floor(t / 12) + '′ ' + (t % 12) + '″'; }
    return M.fmt(cm, 0) + ' cm';
  };
  M.lenUnit = function () { return M.imperial() ? 'in' : 'cm'; };
  M.showLen = function (cm, d) { if (!cm) return ''; return M.fmt(M.imperial() ? M.cmToIn(cm) : cm, d === undefined ? 1 : d); };
  M.inLen = function (v) { var n = M.num(v); if (n === null) return null; return M.imperial() ? M.inToCm(n) : n; };

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */
  M.toast = function (msg, action) {
    var host = M.$('#toasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast';
    var span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    var gone = false;
    var leave = function () {
      if (gone) return; gone = true;
      if (M.reduceMotion()) { el.remove(); return; }
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 140);
    };
    if (action && action.label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', function () { action.fn(); leave(); });
      el.appendChild(b);
    }
    // keep at most two on screen
    var old = M.$$('.toast:not(.out)', host);
    if (old.length > 1) old[0].remove();
    setTimeout(function () { host.appendChild(el); }, 0);
    setTimeout(leave, action ? 6000 : 2600);
  };

  M.reduceMotion = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

  /* Briefly highlight something that just changed (after the next render too) */
  M.flash = function (target, cls) {
    cls = cls || 'flash';
    var els = typeof target === 'string' ? M.$$(target) : [target];
    els.forEach(function (el) {
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth; // restart the animation
      el.classList.add(cls);
      setTimeout(function () { el.classList.remove(cls); }, 1300);
    });
  };
  M.flashAfterRender = function (sel, cls) { M._flashSel = { sel: sel, cls: cls }; };

  /* ------------------------------------------------------------------ */
  /* Haptics                                                             */
  /* Android: Vibration API. iPhone (iOS 18+ Safari): toggling a native  */
  /* switch input gives a light system tap, so we click a hidden one.     */
  /* ------------------------------------------------------------------ */
  var PATTERNS = { tap: 6, select: 8, soft: 4, success: [10, 50, 16], warning: [18, 70, 18], error: [26, 50, 26, 50, 26], heavy: 22 };
  var isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var iosSwitch = null, lastTick = 0;
  function iosTick() {
    var now = Date.now();
    if (now - lastTick < 60) return;
    lastTick = now;
    try {
      if (!iosSwitch) {
        iosSwitch = document.createElement('label');
        iosSwitch.className = 'haptic-proxy';
        iosSwitch.setAttribute('aria-hidden', 'true');
        var inp = document.createElement('input');
        inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
        iosSwitch.appendChild(inp);
        document.body.appendChild(iosSwitch);
      }
      iosSwitch.click();
    } catch (e) { /* ignore */ }
  }
  M.isHapticProxy = function (el) { return !!(iosSwitch && el && iosSwitch.contains(el)); };
  M.haptic = function (kind) {
    if (!M.state || M.state.settings.haptics === false) return;
    var pat = PATTERNS[kind] || PATTERNS.tap;
    try {
      if (navigator.vibrate) { navigator.vibrate(pat); return; }
    } catch (e) { /* ignore */ }
    if (isIOS) {
      iosTick();
      if (kind === 'success' || kind === 'warning' || kind === 'error') setTimeout(iosTick, 90);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sheets (native <dialog>)                                            */
  /* ------------------------------------------------------------------ */
  /* opts: { title, body (html), foot (html), wide, onOpen(dlg), onClose(result) } */
  M.sheet = function (opts) {
    var dlg = document.createElement('dialog');
    dlg.className = 'sheet' + (opts.wide ? ' wide' : '');
    var tid = 'sh-' + M.uid();
    dlg.setAttribute('aria-labelledby', tid);
    dlg.innerHTML =
      '<div class="sheet-grip" aria-hidden="true"></div>' +
      '<div class="sheet-head"><h2 id="' + tid + '">' + M.esc(opts.title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="Close">' + M.icon('x') + '</button></div>' +
      '<div class="sheet-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="sheet-foot">' + opts.foot + '</div>' : '');
    document.body.appendChild(dlg);
    var opener = document.activeElement;
    var result;
    var closing = false;
    dlg.close = (function (orig) {
      return function (r) {
        if (closing) return;
        closing = true; result = r;
        if (M.reduceMotion() || !dlg.open) { orig.call(dlg); return; }
        dlg.classList.add('closing');
        var done = false;
        var fin = function () { if (done) return; done = true; orig.call(dlg); };
        dlg.addEventListener('animationend', function (e) { if (e.target === dlg) fin(); });
        setTimeout(fin, 180);
      };
    })(dlg.close);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); dlg.close(); }); // Esc: animate out too
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) { dlg.close(); return; } // backdrop click
      if (e.target.closest('[data-close]')) dlg.close();
    });
    dlg.addEventListener('close', function () {
      if (opts.onClose) opts.onClose(result);
      dlg.remove();
      if (opener && opener.focus && document.contains(opener)) { try { opener.focus(); } catch (e) { /* ignore */ } }
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (opts.onOpen) opts.onOpen(dlg);
    var first = dlg.querySelector('[autofocus]') || dlg.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea');
    if (first && !opts.noAutofocus) setTimeout(function () { try { first.focus(); } catch (e) { /* ignore */ } }, 30);
    return dlg;
  };

  M.confirm = function (title, message, okLabel, danger) {
    return new Promise(function (resolve) {
      M.sheet({
        title: title,
        body: '<p class="soft">' + M.esc(message) + '</p>',
        foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button>' +
          '<button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + M.esc(okLabel || 'OK') + '</button>',
        noAutofocus: true,
        onOpen: function (dlg) {
          dlg.querySelector('[data-ok]').addEventListener('click', function () { dlg.close('ok'); });
          setTimeout(function () { dlg.querySelector('[data-ok]').focus(); }, 30);
        },
        onClose: function (r) { resolve(r === 'ok'); }
      });
    });
  };

  /* Read a form's named fields into an object */
  M.formData = function (root) {
    var out = {};
    M.$$('[name]', root).forEach(function (el) {
      var n = el.name;
      if (el.type === 'checkbox') {
        if (el.dataset.multi !== undefined) { out[n] = out[n] || []; if (el.checked) out[n].push(el.value); }
        else out[n] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) out[n] = el.value;
        else if (out[n] === undefined) out[n] = out[n];
      } else out[n] = el.value;
    });
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */
  M.parseHash = function () {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('?')[0].split('/').filter(Boolean);
    return { name: parts[0] || '', parts: parts.slice(1) };
  };
  M.go = function (path) {
    if (location.hash === '#/' + path) M.render();
    else location.hash = '#/' + path;
  };

  M.render = function (keepScroll) {
    var r = M.parseHash();
    var st = M.state;
    if (!st.settings.onboarded && r.name !== 'welcome' && r.name !== 'science' && r.name !== 'about') {
      r = { name: 'welcome', parts: [] };
    }
    var name = r.name || st.settings.nav.start || 'dashboard';
    if (!M.views[name]) name = 'dashboard';
    var view = M.views[name];
    var main = M.$('#view');
    var sy = window.scrollY;
    if (M.currentView && M.currentView.leave) { try { M.currentView.leave(); } catch (e) { /* ignore */ } }
    M.currentView = view;
    M.currentRoute = { name: name, parts: r.parts };
    var head = view.head ? view.head(r.parts) : { title: view.title || 'Mizan' };
    M.$('#page-title').textContent = head.title;
    var sub = M.$('#page-sub');
    sub.textContent = head.sub || '';
    sub.hidden = !head.sub;
    document.title = head.title + ' · Mizan';
    main.innerHTML = '';
    // a fresh host per render, so event listeners never pile up
    var host = document.createElement('div');
    host.className = 'view view-' + name + (keepScroll ? '' : ' entering');
    main.appendChild(host);
    try {
      view.render(host, r.parts);
    } catch (e) {
      console.error(e);
      host.innerHTML = '<div class="empty">' + M.icon('alert') + '<p><strong>Something went wrong on this screen.</strong></p><p class="muted">' + M.esc(e.message) + '</p><a class="btn" href="#/dashboard">Go to Dashboard</a></div>';
    }
    // which nav item is "current" (Calculators and Workout plan live under Body)
    var navId = name === 'body' && r.parts[0] === 'tools' ? 'tools' : name === 'body' && r.parts[0] === 'workouts' ? 'workouts' : name;
    M.$$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === navId) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (M._flashSel) { var fs = M._flashSel; M._flashSel = null; M.flash(fs.sel, fs.cls); }
    if (!keepScroll) setTimeout(function () { host.classList.remove('entering'); }, 260);
    var hideNav = name === 'welcome';
    document.body.classList.toggle('is-welcome', hideNav);
    if (keepScroll) window.scrollTo(0, sy);
    else window.scrollTo(0, 0);
  };
  M.refresh = function () { M.render(true); };

  /* Bottom tabs (phone) and side rail (computer) are built from Settings → Home & tabs */
  M.renderNav = function () {
    var tabs = M.state.settings.nav.tabs.map(M.nav).filter(Boolean);
    var bar = M.$('.tabbar');
    if (bar) {
      bar.style.gridTemplateColumns = 'repeat(' + tabs.length + ', 1fr)';
      bar.innerHTML = tabs.map(function (n) {
        return '<a class="tab" href="' + n.href + '" data-nav="' + n.id + '"><span class="tab-ico">' + M.icon(n.icon) + '</span>' + M.esc(n.label) + '</a>';
      }).join('');
    }
    var rail = M.$('.rail .rail-links');
    if (rail) {
      var others = M.NAV.filter(function (n) { return M.state.settings.nav.tabs.indexOf(n.id) < 0 && n.id !== 'settings'; });
      rail.innerHTML = tabs.map(function (n) { return '<a class="nav" href="' + n.href + '" data-nav="' + n.id + '">' + M.icon(n.icon) + M.esc(n.label) + '</a>'; }).join('') +
        '<div class="rail-sep" role="separator"></div>' +
        others.map(function (n) { return '<a class="nav" href="' + n.href + '" data-nav="' + n.id + '">' + M.icon(n.icon) + M.esc(n.label) + '</a>'; }).join('') +
        '<div class="rail-sep" role="separator"></div><a class="nav" href="#/settings" data-nav="settings">' + M.icon('settings') + 'Settings</a>';
    }
    M.$$('.brand, .brand-mini').forEach(function (a) { a.setAttribute('href', '#/' + M.state.settings.nav.start); });
  };

  window.addEventListener('scroll', function () {
    var tb = M.$('.topbar');
    if (tb) tb.classList.toggle('scrolled', window.scrollY > 4);
  }, { passive: true });

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */
  M.applyTheme = function () {
    var t = M.state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var meta = M.$('meta[name="theme-color"]');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', dark ? '#0e1210' : '#f3f0e8');
  };
})();
