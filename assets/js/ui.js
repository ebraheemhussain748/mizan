/* Mizan — shared UI components: day dial, weight chart, block editor, focus timer */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = (M.ui = {});

  /* ------------------------------------------------------------------ */
  /* Geometry                                                            */
  /* ------------------------------------------------------------------ */
  function ang(min) { return ((min - 720) / 1440) * 360; } // noon at the top
  function pt(cx, cy, r, deg) { var a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; }
  function arcPath(cx, cy, r, a0, a1) {
    var sweep = a1 - a0; if (sweep < 0) sweep += 360;
    var p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a0 + sweep);
    var large = sweep > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  U.arcPath = arcPath;

  /* ------------------------------------------------------------------ */
  /* Category chip                                                       */
  /* ------------------------------------------------------------------ */
  U.catChip = function (id) {
    var c = M.cat(id);
    return '<span class="chip" style="--dot:' + M.catVar(c.id) + '"><span class="dot"></span>' + M.esc(c.label) + '</span>';
  };
  U.legend = function () {
    return '<div class="legend">' + M.CATS.map(function (c) { return U.catChip(c.id); }).join('') + '</div>';
  };

  /* ------------------------------------------------------------------ */
  /* Day dial                                                            */
  /* ------------------------------------------------------------------ */
  /* resolved: [{b,start,end,dur}], opts: { date, checkins, nowMin, sun: {rise,set} } */
  U.dial = function (resolved, opts) {
    var S = 360, cx = 180, cy = 180, R = 146, W = 26;
    var now = opts.nowMin;
    var isToday = opts.isToday;
    var html = '<svg class="dial" viewBox="0 0 ' + S + ' ' + S + '" role="group" aria-label="Your day as a 24-hour dial, noon at the top">';
    // sky: day and night bands on the inner ring
    var rise = opts.sun ? opts.sun.rise : 360, set = opts.sun ? opts.sun.set : 1080;
    html += '<path d="' + arcPath(cx, cy, 116, ang(rise), ang(set)) + '" stroke="var(--day)" stroke-width="5" fill="none" stroke-linecap="round"/>';
    html += '<path d="' + arcPath(cx, cy, 116, ang(set), ang(rise)) + '" stroke="var(--night)" stroke-width="5" fill="none" stroke-linecap="round" opacity=".45"/>';
    var sp = pt(cx, cy, 116, ang(rise)), ss = pt(cx, cy, 116, ang(set));
    html += '<circle cx="' + sp[0] + '" cy="' + sp[1] + '" r="4" fill="var(--sun)"><title>Sunrise ' + M.fmtTime(rise) + '</title></circle>';
    html += '<circle cx="' + ss[0] + '" cy="' + ss[1] + '" r="4" fill="var(--sun)"><title>Sunset ' + M.fmtTime(set) + '</title></circle>';
    // ticks & labels
    for (var h = 0; h < 24; h++) {
      var a = ang(h * 60);
      var major = h % 6 === 0;
      var p0 = pt(cx, cy, R + W / 2 + 4, a), p1 = pt(cx, cy, R + W / 2 + (major ? 12 : 8), a);
      html += '<line class="tick' + (major ? ' major' : '') + '" x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) + '" x2="' + p1[0].toFixed(1) + '" y2="' + p1[1].toFixed(1) + '"/>';
      if (h % 3 === 0) {
        var lp = pt(cx, cy, R + W / 2 + 22, a);
        var lab = M.state.settings.clock === '12' ? (h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? (h - 12) + 'p' : h + 'a') : M.pad(h);
        html += '<text class="hour-label" x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 4).toFixed(1) + '" text-anchor="middle">' + lab + '</text>';
      }
    }
    // track
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="var(--surface-3)" stroke-width="' + W + '"/>';
    // segments
    var gapDeg = 0.7;
    resolved.forEach(function (r, i) {
      var a0 = ang(r.start), sweep = r.dur / 1440 * 360;
      if (sweep < gapDeg * 3) return;
      var s0 = a0 + gapDeg, s1 = a0 + sweep - gapDeg;
      var ci = opts.checkins && opts.checkins[r.b.id];
      var state;
      var inside = r.start < r.end ? (now >= r.start && now < r.end) : (now >= r.start || now < r.end);
      var past;
      if (!isToday) past = !!opts.isPast;
      else past = r.start < r.end ? r.end <= now : false; // overnight blocks count as tonight's
      if (isToday && inside) state = 'now';
      else if (ci && ci.s === 'done') state = 'done';
      else if (ci && ci.s === 'partial') state = 'partial';
      else if (ci && ci.s === 'skipped') state = 'skipped';
      else if (past) state = 'past';
      else state = 'future';
      var color = { now: 'var(--now)', done: 'var(--ink-2)', partial: 'var(--ink-3)', skipped: 'var(--past)', past: 'var(--past)', future: 'var(--future)' }[state];
      var label = r.b.title + ', ' + M.fmtTime(r.start) + ' to ' + M.fmtTime(r.end) + ', ' + ({ now: 'happening now', done: 'done', partial: 'partly done', skipped: 'skipped', past: 'not checked in', future: 'upcoming' }[state]);
      html += '<path class="seg-arc" tabindex="0" role="button" data-block="' + M.esc(r.b.id) + '" aria-label="' + M.esc(label) + '" d="' + arcPath(cx, cy, R, s0, s1) + '" stroke="' + color + '" stroke-width="' + (state === 'now' ? W + 6 : (state === 'past' || state === 'skipped') ? Math.round(W * 0.45) : W) + '" fill="none"' + (state === 'skipped' ? ' stroke-dasharray="3 4"' : '') + '/>';
    });
    // now hand
    if (isToday) {
      var na = ang(now);
      var h0 = pt(cx, cy, 58, na), h1 = pt(cx, cy, R + W / 2 + 2, na);
      html += '<line x1="' + h0[0].toFixed(1) + '" y1="' + h0[1].toFixed(1) + '" x2="' + h1[0].toFixed(1) + '" y2="' + h1[1].toFixed(1) + '" stroke="var(--now)" stroke-width="2.5" stroke-linecap="round"/>';
      html += '<circle cx="' + h1[0].toFixed(1) + '" cy="' + h1[1].toFixed(1) + '" r="6" fill="var(--now)" stroke="var(--surface)" stroke-width="2"/>';
    }
    html += '</svg>';
    return html;
  };

  /* ------------------------------------------------------------------ */
  /* Day strip: 24 hours as one horizontal band (Plan)                   */
  /* ------------------------------------------------------------------ */
  /* resolved blocks → absolutely positioned segments; wide ones get an icon and a label */
  U.dayStrip = function (resolved, opts) {
    opts = opts || {};
    var pct = function (m) { return (m / 1440 * 100).toFixed(3) + '%'; };
    var segs = [];
    resolved.forEach(function (x) {
      if (x.start < x.end) segs.push([x.start, x.end, x]);
      else { segs.push([x.start, 1440, x]); if (x.end > 0) segs.push([0, x.end, x]); }
    });
    var totalsLabel = [];
    var html = '<div class="daystrip" role="img" aria-label="' + M.esc(U.stripSummary(resolved)) + '">';
    // daylight band when sun times are on
    var tm = M.sun.timeMap(opts.date || M.today());
    if (tm.sunrise !== undefined && tm.sunset !== undefined) {
      html += '<div class="ds-sky" aria-hidden="true"><span style="left:' + pct(tm.sunrise) + ';width:' + pct(Math.max(0, tm.sunset - tm.sunrise)) + '" title="Daylight ' + M.fmtTime(tm.sunrise) + '–' + M.fmtTime(tm.sunset) + '"></span></div>';
    }
    html += '<div class="ds-track" aria-hidden="true">';
    segs.forEach(function (s) {
      var x = s[2], w = s[1] - s[0];
      var c = M.cat(x.b.cat);
      var inner = '';
      if (w >= 150) inner = M.icon(c.icon) + '<b>' + M.esc(x.b.title) + '</b>';
      else if (w >= 55) inner = M.icon(c.icon);
      var past = opts.now !== null && opts.now !== undefined && s[1] <= opts.now && x.start < x.end;
      html += '<span class="ds-seg' + (past ? ' is-past' : '') + '" data-action="edit" data-id="' + M.esc(x.b.id) + '" data-seg="' + M.esc(x.b.id) + '" title="' + M.esc(x.b.title + ' · ' + M.fmtTime(x.start) + '–' + M.fmtTime(x.end) + ' · ' + M.fmtDurShort(x.dur)) + '" style="left:' + pct(s[0]) + ';width:' + pct(w) + ';--cat:' + M.catVar(x.b.cat) + ';--on-cat:' + M.onCatVar(x.b.cat) + '">' + inner + '</span>';
    });
    html += '</div>';
    if (opts.now !== null && opts.now !== undefined) html += '<span class="ds-now" style="left:' + pct(opts.now) + '" aria-hidden="true"></span>';
    html += '<div class="ds-scale" aria-hidden="true">' + [0, 180, 360, 540, 720, 900, 1080, 1260, 1440].map(function (m) {
      var lab = M.state.settings.clock === '12' ? (function (h) { return h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h > 12 ? (h - 12) + 'p' : h + 'a'; })(m / 60) : M.pad(m / 60 % 24 === 0 && m ? 24 : m / 60);
      return '<span style="left:' + pct(m) + '">' + lab + '</span>';
    }).join('') + '</div>';
    html += '</div>';
    return html;
  };
  /* Drop labels (then icons) that don't fit their segment, instead of showing "Sl…" */
  U.fitStrip = function (root) {
    var fit = function () {
      M.$$('.ds-seg', root).forEach(function (seg) {
        var b = seg.querySelector('b');
        if (b && b.scrollWidth > b.clientWidth + 1) { b.hidden = true; }
        var svg = seg.querySelector('svg');
        if (svg && seg.clientWidth < 26) svg.style.display = 'none';
      });
    };
    requestAnimationFrame(fit);
  };
  U.stripSummary = function (resolved) {
    var t = {};
    resolved.forEach(function (r) { t[r.b.cat] = (t[r.b.cat] || 0) + r.dur; });
    return '24-hour overview: ' + Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).map(function (k) { return M.cat(k).label + ' ' + M.fmtDur(t[k]); }).join(', ') + '. The list below has every block.';
  };

  U.bindDial = function (wrap, resolved, onPick) {
    var tip = document.createElement('div');
    tip.className = 'dial-tip';
    tip.hidden = true;
    wrap.appendChild(tip);
    var byId = {};
    resolved.forEach(function (r) { byId[r.b.id] = r; });
    var show = function (el, x, y) {
      var r = byId[el.getAttribute('data-block')];
      if (!r) return;
      tip.innerHTML = '<strong>' + M.esc(r.b.title) + '</strong>' + M.fmtTime(r.start) + '–' + M.fmtTime(r.end) + ' · ' + M.fmtDurShort(r.dur);
      tip.hidden = false;
      var rect = wrap.getBoundingClientRect();
      tip.style.left = M.clamp(x - rect.left, 80, rect.width - 80) + 'px';
      tip.style.top = Math.max(36, y - rect.top) + 'px';
    };
    wrap.addEventListener('pointermove', function (e) {
      var el = e.target.closest('.seg-arc');
      if (el) show(el, e.clientX, e.clientY); else tip.hidden = true;
    });
    wrap.addEventListener('pointerleave', function () { tip.hidden = true; });
    wrap.addEventListener('focusin', function (e) {
      var el = e.target.closest('.seg-arc');
      if (!el) return;
      var b = el.getBoundingClientRect();
      show(el, b.left + b.width / 2, b.top + b.height / 2);
    });
    wrap.addEventListener('focusout', function () { tip.hidden = true; });
    var pick = function (e) {
      var el = e.target.closest('.seg-arc');
      if (!el) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onPick(el.getAttribute('data-block'));
    };
    wrap.addEventListener('click', pick);
    wrap.addEventListener('keydown', pick);
  };

  /* ------------------------------------------------------------------ */
  /* Weight chart                                                        */
  /* ------------------------------------------------------------------ */
  var chartNow = null, chartResizeBound = false;
  U.weightChart = function (host, series, goalKg) {
    if (!series.length) { host.innerHTML = ''; return; }
    // draw at the container's real pixel size so text stays readable on phones and desktops
    var W = Math.max(280, Math.round(host.clientWidth || 640)), H = W < 520 ? 220 : 280, L = 40, Rp = 52, T = 14, B = 30;
    // one resize listener for the whole app, redrawing whichever chart is on screen
    chartNow = { host: host, series: series, goalKg: goalKg, w: W };
    if (!chartResizeBound) {
      chartResizeBound = true;
      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          var c = chartNow;
          if (!c || !c.host.isConnected) return;
          if (Math.abs((c.host.clientWidth || 0) - c.w) > 24) U.weightChart(c.host, c.series, c.goalKg);
        }, 150);
      });
    }
    var imp = M.imperial();
    var conv = function (kg) { return imp ? M.kgToLb(kg) : kg; };
    var vals = [];
    series.forEach(function (s) { vals.push(conv(s.kg), conv(s.trend)); });
    if (goalKg) vals.push(conv(goalKg));
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = Math.max(0.5, (hi - lo) * 0.12);
    lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    var d0 = series[0].d, d1 = series[series.length - 1].d;
    var span = Math.max(1, M.daysBetween(d0, d1));
    var x = function (d) { return L + (M.daysBetween(d0, d) / span) * (W - L - Rp); };
    var y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Weight over time: daily weigh-ins and smoothed trend">';
    // grid (4 ticks)
    var step = niceStep((hi - lo) / 4);
    for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - Rp) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      svg += '<text class="axis-label" x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + M.fmt(v, step < 1 ? 1 : 0) + '</text>';
    }
    // x labels: first, middle, last
    [d0, span > 2 ? M.addDays(d0, Math.round(span / 2)) : null, d1].forEach(function (d, i) {
      if (!d) return;
      svg += '<text class="axis-label" x="' + x(d).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '">' + M.fmtDate(d, 'short') + '</text>';
    });
    // goal
    if (goalKg && conv(goalKg) >= lo && conv(goalKg) <= hi) {
      var gy = y(conv(goalKg)).toFixed(1);
      svg += '<line class="goal-line" x1="' + L + '" x2="' + (W - Rp) + '" y1="' + gy + '" y2="' + gy + '"/>';
      svg += '<text class="goal-label" x="' + (W - Rp + 6) + '" y="' + (+gy + 4) + '">Goal</text>';
    }
    // raw dots
    series.forEach(function (s) {
      svg += '<circle class="raw-dot" cx="' + x(s.d).toFixed(1) + '" cy="' + y(conv(s.kg)).toFixed(1) + '" r="3"/>';
    });
    // trend
    if (series.length > 1) {
      var dpath = series.map(function (s, i) { return (i ? 'L' : 'M') + x(s.d).toFixed(1) + ' ' + y(conv(s.trend)).toFixed(1); }).join(' ');
      svg += '<path class="trend-line" d="' + dpath + '"/>';
    }
    var last = series[series.length - 1];
    svg += '<circle class="end-dot" cx="' + x(last.d).toFixed(1) + '" cy="' + y(conv(last.trend)).toFixed(1) + '" r="5"/>';
    svg += '<text class="end-label" x="' + (x(last.d) + 9).toFixed(1) + '" y="' + (y(conv(last.trend)) + 4).toFixed(1) + '">' + M.fmt(conv(last.trend), 1) + '</text>';
    svg += '<line class="crosshair" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/>';
    svg += '<rect x="' + L + '" y="' + T + '" width="' + (W - L - Rp) + '" height="' + (H - T - B) + '" fill="transparent" class="hit"/>';
    svg += '</svg>';
    var unit = M.wUnit();
    var table = '<details class="table-view"><summary>Show as a table</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table class="data"><thead><tr><th>Date</th><th class="n">Weigh-in (' + unit + ')</th><th class="n">Trend (' + unit + ')</th></tr></thead><tbody>' +
      series.slice().reverse().map(function (s) { return '<tr><td>' + M.fmtDate(s.d, 'weekday') + '</td><td class="n">' + M.fmt(conv(s.kg), 1) + '</td><td class="n">' + M.fmt(conv(s.trend), 1) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details>';
    host.innerHTML = '<div class="chart">' + svg + '<div class="chart-tip" hidden></div></div>' +
      '<div class="chart-legend"><span><i style="background:var(--c-study)"></i>Trend (smoothed)</span><span><i class="dot" style="background:var(--ink-3)"></i>Daily weigh-in</span>' + (goalKg ? '<span><i style="background:var(--now)"></i>Goal</span>' : '') + '</div>' + table;
    // hover
    var chart = host.querySelector('.chart');
    var svgEl = chart.querySelector('svg');
    var tip = chart.querySelector('.chart-tip');
    var cross = svgEl.querySelector('.crosshair');
    var move = function (clientX) {
      var r = svgEl.getBoundingClientRect();
      var sx = (clientX - r.left) / r.width * W;
      var best = null, bd = Infinity;
      series.forEach(function (s) { var dx = Math.abs(x(s.d) - sx); if (dx < bd) { bd = dx; best = s; } });
      if (!best) return;
      var px = x(best.d);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = '<div class="tv">' + M.fmt(conv(best.trend), 1) + ' ' + unit + '</div>' +
        '<div class="tr"><i style="background:var(--c-study)"></i>Trend</div>' +
        '<div class="tr"><i style="background:var(--ink-3)"></i>Weigh-in ' + M.fmt(conv(best.kg), 1) + '</div>' +
        '<div class="tr">' + M.fmtDate(best.d, 'weekday') + '</div>';
      var left = px / W * r.width;
      tip.style.left = M.clamp(left + 12, 0, r.width - 140) + 'px';
      tip.style.top = '8px';
    };
    svgEl.addEventListener('pointermove', function (e) { move(e.clientX); });
    svgEl.addEventListener('pointerleave', function () { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  };
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var n = raw / p;
    var s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return s * p;
  }

  /* ------------------------------------------------------------------ */
  /* Scale bar (for BMI / WHtR / body fat bands)                         */
  /* ------------------------------------------------------------------ */
  /* bands: [{label, from, to}], value */
  U.scale = function (bands, value, activeIndex, fmtLabel) {
    var min = bands[0].from, max = bands[bands.length - 1].to;
    var total = max - min;
    var pos = M.clamp((value - min) / total, 0, 1) * 100;
    var track = bands.map(function (b, i) {
      return '<span class="' + (i === activeIndex ? 'on' : '') + '" style="flex:' + ((b.to - b.from) / total) + '"></span>';
    }).join('');
    var labels = bands.map(function (b) { return '<span style="flex:' + ((b.to - b.from) / total) + '">' + M.esc(fmtLabel ? fmtLabel(b) : b.label) + '</span>'; }).join('');
    return '<div class="scale" aria-hidden="true"><div class="scale-track">' + track + '<i class="scale-marker" style="left:' + pos.toFixed(1) + '%"></i></div><div class="scale-labels">' + labels + '</div></div>';
  };

  /* ------------------------------------------------------------------ */
  /* Field helpers                                                       */
  /* ------------------------------------------------------------------ */
  /* ---- Measurement fields: tap the unit to type in another one ----
     The code still gets the value in the unit it asked for (a hidden input with the field's name);
     what the person sees and types can be cm, m, ft + in, in, kg, lb, st, ml, L, fl oz, cups, km, mi or m. */
  var KINDS = {
    height: { units: [['cm', 'cm', 1], ['m', 'm', 100], ['ftin', 'ft + in', null], ['in', 'in', 2.54]] },
    length: { units: [['cm', 'cm', 1], ['in', 'in', 2.54]] },
    weight: { units: [['kg', 'kg', 1], ['lb', 'lb', 0.45359237], ['st', 'st', 6.35029318]] },
    load: { units: [['kg', 'kg', 1], ['lb', 'lb', 0.45359237]] },
    volume: { units: [['ml', 'ml', 1], ['L', 'L', 1000], ['floz', 'fl oz', 29.5735], ['cup', 'cups', 240]] },
    distance: { units: [['km', 'km', 1], ['mi', 'mi', 1.609344], ['m', 'm', 0.001]] }
  };
  var DEC = { cm: 1, m: 2, in: 1, kg: 1, lb: 1, st: 2, ml: 0, L: 2, floz: 1, cup: 2, km: 2, mi: 2 };
  function kindFor(name, unit, opts) {
    if (opts.kind !== undefined) return opts.kind;
    if (unit === 'cm' || unit === 'in') return name === 'h' ? 'height' : 'length';
    if (unit === 'kg' || unit === 'lb') return name === 'lw' ? 'load' : 'weight';
    if (unit === 'ml' || unit === 'L') return 'volume';
    if (unit === 'km') return 'distance';
    return null;
  }
  function fac(kind, u) { var x = KINDS[kind].units.filter(function (a) { return a[0] === u; })[0]; return x ? x[2] : null; }
  U.toBase = function (kind, u, v) { if (v === null || v === undefined || v === '' || isNaN(v)) return null; return u === 'ftin' ? null : v * fac(kind, u); };
  U.fromBase = function (kind, u, b) { return b === null ? null : b / fac(kind, u); };
  function round(v, d) { var k = Math.pow(10, d); return Math.round(v * k) / k; }
  function prefUnit(kind, code) {
    var p = M.state && M.state.settings.unitPrefs && M.state.settings.unitPrefs[kind];
    return p && KINDS[kind].units.some(function (a) { return a[0] === p; }) ? p : code;
  }
  function dispValues(kind, disp, base) {
    if (base === null) return ['', ''];
    if (disp === 'ftin') { var tin = round(base / 2.54, 1), ft = Math.floor(tin / 12), inch = round(tin - ft * 12, 1); return [String(ft), String(inch)]; }
    return [String(round(U.fromBase(kind, disp, base), DEC[disp] === undefined ? 2 : DEC[disp])), ''];
  }
  function measureField(name, label, value, unit, opts, kind) {
    var id = 'f-' + name + '-' + M.uid();
    var disp = prefUnit(kind, unit);
    var base = U.toBase(kind, unit, M.num(value));
    var dv = dispValues(kind, disp, base);
    return '<div class="field measure' + (opts.full ? ' full' : '') + '" data-kind="' + kind + '" data-code="' + unit + '" data-disp="' + disp + '"><label for="' + id + '">' + M.esc(label) + '</label>' +
      '<div class="input-group"><input class="input m-a" id="' + id + '" type="number" inputmode="decimal" step="any" value="' + M.esc(dv[0]) + '"' + (disp === 'ftin' ? ' placeholder="ft"' : opts.placeholder ? ' placeholder="' + M.esc(opts.placeholder) + '"' : '') + ' aria-describedby="' + id + '-e">' +
      '<input class="input m-b" type="number" inputmode="decimal" step="any" placeholder="in" aria-label="' + M.esc(label) + ', inches" value="' + M.esc(dv[1]) + '"' + (disp === 'ftin' ? '' : ' hidden') + '>' +
      '<select class="unit unit-sel" aria-label="' + M.esc(label) + ' unit">' + KINDS[kind].units.map(function (u) { return '<option value="' + u[0] + '"' + (u[0] === disp ? ' selected' : '') + '>' + u[1] + '</option>'; }).join('') + '</select>' +
      '<input type="hidden" name="' + name + '" value="' + (base === null ? '' : round(U.fromBase(kind, unit, base), 4)) + '"></div>' +
      (opts.hint ? '<span class="hint">' + opts.hint + '</span>' : '') + '<span class="field-err" id="' + id + '-e" hidden></span></div>';
  }
  /* read what's typed → the hidden value in the code's unit */
  function syncMeasure(f) {
    var kind = f.getAttribute('data-kind'), code = f.getAttribute('data-code'), disp = f.getAttribute('data-disp');
    var a = M.num(f.querySelector('.m-a').value), b = M.num(f.querySelector('.m-b').value);
    var base = disp === 'ftin' ? (a === null && b === null ? null : (a || 0) * 30.48 + (b || 0) * 2.54) : U.toBase(kind, disp, a);
    f.querySelector('input[type=hidden]').value = base === null ? '' : round(U.fromBase(kind, code, base), 4);
  }
  /* code that listens for 'change' on a field by its name gets it from the hidden input */
  function hiddenChanged(f) {
    var h = f.querySelector('input[type=hidden]'), ev;
    try { ev = new Event('change', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('change', true, false); }
    h.dispatchEvent(ev);
  }
  // capture phase: runs before the form's own input/change handlers read the value
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.measure .m-a, .measure .m-b')) syncMeasure(t.closest('.measure'));
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.measure .m-a, .measure .m-b')) { var mf = t.closest('.measure'); syncMeasure(mf); setTimeout(function () { hiddenChanged(mf); }, 0); return; }
    if (!(t.matches && t.matches('.measure .unit-sel'))) return;
    var f = t.closest('.measure'), kind = f.getAttribute('data-kind'), code = f.getAttribute('data-code');
    var hid = f.querySelector('input[type=hidden]');
    var base = U.toBase(kind, code, M.num(hid.value));
    var disp = t.value;
    f.setAttribute('data-disp', disp);
    var dv = dispValues(kind, disp, base);
    var ia = f.querySelector('.m-a'), ib = f.querySelector('.m-b');
    ia.value = dv[0]; ib.value = dv[1]; ib.hidden = disp !== 'ftin';
    ia.placeholder = disp === 'ftin' ? 'ft' : '';
    if (M.state) { M.state.settings.unitPrefs = M.state.settings.unitPrefs || {}; M.state.settings.unitPrefs[kind] = disp; M.save(); }
  }, true);
  /* show / clear an error under a field (by the field's name) */
  U.fieldError = function (root, name, msg) {
    var inp = root.querySelector('[name="' + name + '"]');
    var f = inp && inp.closest('.field');
    if (!f) return;
    var err = f.querySelector('.field-err');
    if (!err) { err = document.createElement('span'); err.className = 'field-err'; err.id = 'fe-' + M.uid(); f.appendChild(err); var vi = f.querySelector('input:not([type=hidden])'); if (vi) vi.setAttribute('aria-describedby', err.id); }
    f.classList.toggle('has-err', !!msg);
    err.hidden = !msg; err.textContent = msg || '';
    M.$$('input:not([type=hidden])', f).forEach(function (x) {
      if (msg) { x.setAttribute('aria-invalid', 'true'); if (!x.getAttribute('aria-describedby')) x.setAttribute('aria-describedby', err.id); } else x.removeAttribute('aria-invalid');
    });
  };
  U.clearErrors = function (root) { M.$$('.field.has-err', root).forEach(function (f) { var n = f.querySelector('[name]'); if (n) U.fieldError(root, n.getAttribute('name'), ''); }); };
  /* in the person's chosen unit, for messages: "50–250 cm" / "1 ft 8 in – 8 ft 2 in" */
  U.fmtIn = function (kind, base) {
    var u = prefUnit(kind, kind === 'weight' || kind === 'load' ? (M.imperial() ? 'lb' : 'kg') : kind === 'volume' ? 'ml' : kind === 'distance' ? 'km' : (M.imperial() ? 'in' : 'cm'));
    if (u === 'ftin') { var ti = Math.round(base / 2.54); return Math.floor(ti / 12) + ' ft ' + (ti % 12) + ' in'; }
    var x = KINDS[kind].units.filter(function (a) { return a[0] === u; })[0];
    var v = round(U.fromBase(kind, u, base), u === 'm' || u === 'L' ? 2 : 1);
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + x[1];
  };

  U.numField = function (name, label, value, unit, opts) {
    opts = opts || {};
    var kind = kindFor(name, unit, opts);
    if (kind && KINDS[kind]) return measureField(name, label, value, unit, opts, kind);
    var id = 'f-' + name + '-' + M.uid();
    return '<div class="field' + (opts.full ? ' full' : '') + '"><label for="' + id + '">' + M.esc(label) + '</label>' +
      '<div class="input-group"><input class="input" id="' + id + '" name="' + name + '" type="number" inputmode="decimal" step="' + (opts.step || 'any') + '"' +
      (opts.min !== undefined ? ' min="' + opts.min + '"' : '') + (opts.max !== undefined ? ' max="' + opts.max + '"' : '') +
      ' value="' + (value === null || value === undefined || value === '' ? '' : M.esc(value)) + '"' + (opts.placeholder ? ' placeholder="' + M.esc(opts.placeholder) + '"' : '') + '>' +
      (unit ? '<span class="unit">' + M.esc(unit) + '</span>' : '') + '</div>' +
      (opts.hint ? '<span class="hint">' + opts.hint + '</span>' : '') + '<span class="field-err" id="' + id + '-e" hidden></span></div>';
  };
  U.selectField = function (name, label, options, value, opts) {
    opts = opts || {};
    var id = 'f-' + name + '-' + M.uid();
    return '<div class="field' + (opts.full ? ' full' : '') + '"><label for="' + id + '">' + M.esc(label) + '</label>' +
      '<select class="select" id="' + id + '" name="' + name + '">' +
      options.map(function (o) { return '<option value="' + M.esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + M.esc(o[1]) + '</option>'; }).join('') +
      '</select>' + (opts.hint ? '<span class="hint">' + opts.hint + '</span>' : '') + '</div>';
  };
  U.radios = function (name, options, value, block) {
    return '<div class="' + (block ? 'choice-grid' : 'choice-row') + '" role="radiogroup">' + options.map(function (o) {
      return '<label class="choice' + (block ? ' block' : '') + '"><input type="radio" name="' + name + '" value="' + M.esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' checked' : '') + '><span>' + M.esc(o[1]) + '</span>' + (o[2] ? '<small>' + M.esc(o[2]) + '</small>' : '') + '</label>';
    }).join('') + '</div>';
  };
  U.checks = function (name, options, values) {
    values = values || [];
    return '<div class="choice-row">' + options.map(function (o) {
      return '<label class="choice"><input type="checkbox" data-multi name="' + name + '" value="' + M.esc(o[0]) + '"' + (values.indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + M.esc(o[1]) + '</span></label>';
    }).join('') + '</div>';
  };
  U.note = function (kind, html) {
    var ic = { good: 'good', warn: 'alert', bad: 'alert', info: 'info', accent: 'spark' }[kind] || 'info';
    return '<div class="note ' + kind + '">' + M.icon(ic) + '<div>' + html + '</div></div>';
  };
  U.sourceLine = function (items) {
    return '<p class="source">Based on ' + items.map(function (s) { return '<a href="' + M.esc(s[1]) + '" target="_blank" rel="noopener">' + M.esc(s[0]) + '</a>'; }).join(', ') + '. More on the <a href="#/science">Science page</a>.</p>';
  };

  /* Profile gate: returns html prompting to complete the profile, or '' */
  U.needProfile = function (fields) {
    var p = M.state.profile;
    var missing = [];
    var w = M.latestWeight();
    if (fields.indexOf('weight') >= 0 && !w) missing.push('weight');
    if (fields.indexOf('height') >= 0 && !p.heightCm) missing.push('height');
    if (fields.indexOf('age') >= 0 && !M.ageFrom(p)) missing.push('age');
    if (fields.indexOf('sex') >= 0 && !p.sex) missing.push('sex');
    if (!missing.length) return '';
    return '<div class="empty">' + M.icon('user') + '<p><strong>Add your ' + missing.join(', ') + ' to see this.</strong></p><p class="muted">It stays on this device.</p><button type="button" class="btn btn-primary" data-action="edit-profile">Complete profile</button></div>';
  };

  /* ------------------------------------------------------------------ */
  /* Block editor                                                        */
  /* ------------------------------------------------------------------ */
  U.editBlock = function (routine, block, onDone, prefill) {
    var isNew = !block;
    var b = block ? M.deepClone(block) : { id: M.uid(), start: '', end: '', title: '', cat: 'routine', notes: '', anchor: null };
    if (isNew && prefill) {
      b.start = prefill.start; b.end = prefill.end;
    } else if (isNew) {
      // start where the last non-sleep block ends
      var res = M.calc.resolveBlocks(routine, M.today()).filter(function (r) { return r.b.cat !== 'sleep'; });
      var last = res[res.length - 1];
      b.start = last ? M.fromMin(last.end) : '08:00';
      b.end = M.fromMin(M.toMin(b.start) + 30);
    }
    var timesOn = M.sun.active();
    // an anchored block shows today's real times, so what you see is what you edit
    if (b.anchor && timesOn) {
      var tmap = M.sun.timeMap(M.today());
      if (tmap[b.anchor.to] !== undefined) {
        var d0 = M.dur(b.start, b.end), st0 = Math.round(tmap[b.anchor.to] + (b.anchor.offset || 0));
        b.start = M.fromMin(st0); b.end = M.fromMin(st0 + d0);
      }
    }
    var anchorList = timesOn ? M.sun.anchors() : [];
    var anchorOpts = [['', 'Fixed time']].concat(anchorList.map(function (x) { return [x.id, 'Starts at ' + x.label]; }));
    if (b.anchor && !anchorList.some(function (x) { return x.id === b.anchor.to; })) anchorOpts.push([b.anchor.to, 'Starts at ' + M.sun.anchorLabel(b.anchor.to) + ' (turn on sun times)']);
    var body =
      '<form class="stack" novalidate>' +
      '<div class="field"><label for="blk-title">Name</label><input class="input" id="blk-title" name="title" maxlength="80" value="' + M.esc(b.title) + '" placeholder="e.g. Study block — maths" autofocus></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="blk-start">Starts</label><input class="input" id="blk-start" name="start" type="time" value="' + M.esc(b.start) + '" required></div>' +
      '<div class="field"><label for="blk-end">Ends</label><input class="input" id="blk-end" name="end" type="time" value="' + M.esc(b.end) + '" required></div>' +
      '</div>' +
      '<p class="hint muted" id="blk-dur" aria-live="polite"></p>' +
      '<div class="field"><span class="label" id="blk-cat-l">Category</span><div class="choice-row" role="radiogroup" aria-labelledby="blk-cat-l">' +
      M.CATS.map(function (c) { return '<label class="choice"><input type="radio" name="cat" value="' + c.id + '"' + (b.cat === c.id ? ' checked' : '') + '><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + M.catVar(c.id) + '"></span><span>' + M.esc(c.label) + '</span></label>'; }).join('') +
      '</div></div>' +
      (timesOn ? '<div class="form-grid">' + U.selectField('anchor', 'Move with the sun', anchorOpts, b.anchor ? b.anchor.to : '', { hint: 'The block keeps its length and follows this time every day.' }) +
        U.numField('offset', 'Minutes after', b.anchor ? b.anchor.offset : 0, 'min', { step: 1 }) + '</div>'
        : '<p class="hint muted">Tip: turn on sun times in Settings to let a block follow sunrise or sunset through the seasons.</p>') +
      '<div class="field"><label for="blk-notes">Notes</label><textarea class="textarea" id="blk-notes" name="notes" maxlength="400" placeholder="What to do, where, and your backup plan">' + M.esc(b.notes) + '</textarea></div>' +
      '<p class="err hidden" id="blk-err" role="alert"></p>' +
      '</form>';
    var foot = (isNew ? '' : '<button type="button" class="btn btn-danger" data-del>' + M.icon('trash') + 'Delete</button><span class="spacer"></span>') +
      '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>' + (isNew ? 'Add block' : 'Save') + '</button>';
    M.sheet({
      title: isNew ? 'New block' : 'Edit block',
      body: body, foot: foot,
      onOpen: function (dlg) {
        var f = dlg.querySelector('form');
        var durEl = dlg.querySelector('#blk-dur');
        var upd = function () {
          var s = f.start.value, e = f.end.value;
          var anch = f.anchor && f.anchor.value;
          durEl.textContent = s && e ? 'Length: ' + M.fmtDur(M.dur(s, e)) + (M.toMin(e) <= M.toMin(s) ? ' (runs past midnight)' : '') +
            (anch ? ' · Start follows ' + M.sun.anchorLabel(anch) + ' — change it to "Fixed time" to type your own start.' : '') : '';
        };
        f.start.addEventListener('input', function () {
          // typing a new start time means "fixed time" — otherwise the anchor would silently override it
          if (f.anchor && f.anchor.value) { f.anchor.value = ''; M.toast('Switched to a fixed start time'); }
          upd();
        });
        f.end.addEventListener('input', upd);
        if (f.anchor) f.anchor.addEventListener('change', upd);
        upd();
        var save = function () {
          var d = M.formData(f);
          var err = dlg.querySelector('#blk-err');
          var fail = function (msg, focusEl) { err.textContent = msg; err.classList.remove('hidden'); M.haptic('error'); if (focusEl) focusEl.focus(); };
          if (!d.title.trim()) return fail('Give the block a name.', f.title);
          if (!d.start || !d.end) return fail('Set both a start and an end time.');
          if (d.start === d.end) return fail('Start and end can’t be the same time.');
          b.title = d.title.trim(); b.start = d.start; b.end = d.end; b.cat = d.cat || 'routine'; b.notes = d.notes.trim();
          if (timesOn) b.anchor = d.anchor ? { to: d.anchor, offset: M.num(d.offset) || 0 } : null;
          if (isNew) routine.blocks.push(b);
          else {
            for (var i = 0; i < routine.blocks.length; i++) if (routine.blocks[i].id === b.id) routine.blocks[i] = b;
          }
          routine.blocks.sort(function (x, y) { return M.toMin(x.start) - M.toMin(y.start); });
          M.save();
          M.haptic('success');
          dlg.close('saved');
          if (onDone) onDone(b, isNew ? 'added' : 'saved');
          M.toast((isNew ? 'Added: ' : 'Saved: ') + b.title + ' · ' + M.fmtTime(b.start) + '–' + M.fmtTime(b.end));
        };
        dlg.querySelector('[data-save]').addEventListener('click', save);
        f.addEventListener('submit', function (e) { e.preventDefault(); save(); });
        var del = dlg.querySelector('[data-del]');
        if (del) del.addEventListener('click', function () {
          var idx = routine.blocks.findIndex(function (x) { return x.id === b.id; });
          var removed = routine.blocks.splice(idx, 1)[0];
          M.save();
          M.haptic('warning');
          dlg.close('deleted');
          if (onDone) onDone(removed, 'deleted');
          M.toast('Deleted: ' + removed.title, { label: 'Undo', fn: function () { routine.blocks.splice(idx, 0, removed); M.save(); M.haptic('success'); if (onDone) onDone(removed, 'restored'); } });
        });
      }
    });
  };

  /* ------------------------------------------------------------------ */
  /* Focus timer                                                         */
  /* ------------------------------------------------------------------ */
  U.focusTimer = function (label) {
    var presets = [[25, 5, 'Classic 25 / 5'], [50, 10, 'Deep 50 / 10'], [15, 3, 'Warm-up 15 / 3']];
    var cfg = presets[0];
    var phase = 'focus', total = cfg[0] * 60, left = total, timer = null, running = false, rounds = 0;
    var C = 2 * Math.PI * 120;
    var body = '<p class="soft" style="margin-bottom:8px">' + (label ? 'For: <strong>' + M.esc(label) + '</strong>. ' : '') + 'Put your phone out of reach. When the break starts, stand up and move.</p>' +
      '<div class="seg" role="tablist" aria-label="Timer length">' + presets.map(function (p, i) { return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-p="' + i + '">' + p[2] + '</button>'; }).join('') + '</div>' +
      '<div class="focus-ring"><svg viewBox="0 0 260 260"><circle class="track" cx="130" cy="130" r="120" fill="none" stroke-width="12"/><circle class="bar" cx="130" cy="130" r="120" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="0"/></svg>' +
      '<div class="time"><strong id="ft-time" aria-live="off">25:00</strong><span id="ft-phase">Focus</span></div></div>' +
      '<p class="muted" style="text-align:center" id="ft-rounds" aria-live="polite"></p>';
    var foot = '<button type="button" class="btn" data-reset>' + M.icon('refresh') + 'Reset</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-toggle>' + M.icon('play') + 'Start</button>';
    M.sheet({
      title: 'Focus timer', body: body, foot: foot, noAutofocus: true,
      onOpen: function (dlg) {
        var tEl = dlg.querySelector('#ft-time'), phEl = dlg.querySelector('#ft-phase'), bar = dlg.querySelector('.bar'), rEl = dlg.querySelector('#ft-rounds');
        var tg = dlg.querySelector('[data-toggle]');
        var draw = function () {
          var m = Math.floor(left / 60), s = left % 60;
          tEl.textContent = M.pad(m) + ':' + M.pad(s);
          phEl.textContent = phase === 'focus' ? 'Focus' : 'Break — move around';
          bar.setAttribute('stroke-dashoffset', (C * (1 - left / total)).toFixed(1));
          rEl.textContent = rounds ? rounds + ' focus ' + M.plural(rounds, 'round') + ' done' : '';
        };
        var beep = function () {
          try {
            var ac = new (window.AudioContext || window.webkitAudioContext)();
            var o = ac.createOscillator(), g = ac.createGain();
            o.connect(g); g.connect(ac.destination); o.frequency.value = 660; g.gain.value = 0.08;
            o.start(); setTimeout(function () { o.stop(); ac.close(); }, 350);
          } catch (e) { /* ignore */ }
          if (navigator.vibrate) navigator.vibrate(200);
        };
        var endAt = 0;
        var tick = function () {
          left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
          if (left <= 0) {
            beep();
            if (phase === 'focus') {
              rounds++;
              var k = M.today();
              M.state.focus[k] = (M.state.focus[k] || 0) + cfg[0];
              M.save();
              phase = 'break'; total = cfg[1] * 60;
            } else { phase = 'focus'; total = cfg[0] * 60; }
            left = total; endAt = Date.now() + total * 1000;
          }
          draw();
        };
        var start = function () { running = true; endAt = Date.now() + left * 1000; timer = setInterval(tick, 250); tg.innerHTML = M.icon('pause') + 'Pause'; };
        var pause = function () { running = false; clearInterval(timer); tg.innerHTML = M.icon('play') + 'Resume'; };
        tg.addEventListener('click', function () { if (running) pause(); else start(); });
        dlg.querySelector('[data-reset]').addEventListener('click', function () { pause(); phase = 'focus'; total = cfg[0] * 60; left = total; tg.innerHTML = M.icon('play') + 'Start'; draw(); });
        M.$$('[data-p]', dlg).forEach(function (b) {
          b.addEventListener('click', function () {
            if (running) return;
            cfg = presets[+b.getAttribute('data-p')];
            M.$$('[data-p]', dlg).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
            phase = 'focus'; total = cfg[0] * 60; left = total; draw();
          });
        });
        dlg.addEventListener('close', function () { clearInterval(timer); });
        draw();
      }
    });
  };

  /* ------------------------------------------------------------------ */
  /* Weights helpers                                                     */
  /* ------------------------------------------------------------------ */
  M.latestWeight = function () {
    var w = M.state.weights;
    if (!w.length) return null;
    var s = w.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    return s[s.length - 1].kg;
  };
  M.logWeight = function (kg, d) {
    d = d || M.today();
    var w = M.state.weights.filter(function (x) { return x.d !== d; });
    w.push({ d: d, kg: Math.round(kg * 10) / 10 });
    w.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    M.state.weights = w;
    M.save();
  };

  U.weightSheet = function (onDone) {
    var last = M.latestWeight();
    M.sheet({
      title: 'Log weight',
      body: '<form class="stack" novalidate>' +
        '<div class="form-grid">' + U.numField('w', 'Weight', last ? (M.imperial() ? M.fmt(M.kgToLb(last), 1) : last) : '', M.wUnit(), { step: 0.1, min: 20, max: 400 }) +
        '<div class="field"><label for="wd">Date</label><input class="input" id="wd" type="date" name="d" value="' + M.today() + '" max="' + M.today() + '"></div></div>' +
        '<p class="hint muted">Weigh at the same time each day — after waking and using the bathroom. Daily numbers jump around with water; Mizan shows a smoothed trend so you can ignore the noise.</p>' +
        '<p class="err hidden" role="alert"></p></form>',
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save</button>',
      onOpen: function (dlg) {
        var f = dlg.querySelector('form');
        var save = function () {
          var d = M.formData(f);
          var kg = M.inW(d.w);
          var err = dlg.querySelector('.err');
          var p = M.state.profile;
          var bad = !kg ? [{ key: 'weightKg', msg: 'Enter your weight.' }] : M.calc.checkBody({ weightKg: kg, heightCm: p.heightCm, age: M.ageFrom(p) });
          bad = bad.filter(function (x) { return x.key === 'weightKg'; });
          U.fieldError(f, 'w', bad.length ? bad[0].msg : '');
          if (bad.length) { M.haptic('error'); return; }
          M.logWeight(kg, d.d || M.today());
          dlg.close('ok');
          M.toast('Weight saved');
          if (onDone) onDone();
        };
        dlg.querySelector('[data-save]').addEventListener('click', save);
        f.addEventListener('submit', function (e) { e.preventDefault(); save(); });
      }
    });
  };
})();
