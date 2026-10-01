/* Mizan — beard styles you can see.
   Every style is drawn from the 68 face points (jaw, nose, mouth) that the face scanner finds, so the same
   drawing works on the person's own photo (a rough "try-on", made on the phone, never uploaded) and on an
   example face for their face shape when there's no photo. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  /* ------------------------------------------------------------------ */
  /* Styles                                                              */
  /* ------------------------------------------------------------------ */
  var STYLES = {
    stubble: { name: 'Stubble', region: 'full', thick: 0, stubble: 0.55, desc: 'A few days of growth, kept even with a trimmer (1–3 mm guard).', care: 'Trim every 2–3 days with the same guard; tidy the neckline and cheek line.' },
    'stubble-heavy': { name: 'Medium stubble', region: 'full', thick: 0.004, stubble: 0.9, desc: 'Designer stubble — about a week of growth (3–5 mm).', care: 'Trim to 3–5 mm twice a week; keep the neckline one finger above the Adam’s apple.' },
    boxed: { name: 'Short boxed beard', region: 'full', thick: 0.03, chin: 0.02, desc: 'A short full beard with clean, straight cheek lines and a neat neckline.', care: 'Guard 4–8 mm all over; shape the cheek line and neckline weekly.' },
    'full-soft': { name: 'Short, soft full beard', region: 'full', thick: 0.04, chin: 0.03, soft: true, desc: 'Full coverage kept short and rounded — softens a strong jaw.', care: 'Trim to 8–12 mm; round off the corners at the jaw.' },
    full: { name: 'Full beard', region: 'full', thick: 0.06, chin: 0.06, desc: 'Grown out and kept tidy — takes 6–12 weeks of growth.', care: 'Beard oil daily, shape every 2 weeks, keep the moustache off the lip.' },
    'full-chin': { name: 'Full beard, longer at the chin', region: 'full', thick: 0.035, chin: 0.12, desc: 'Shorter on the cheeks and longer at the chin — makes the face look longer.', care: 'Keep the sides at 6–10 mm and let the chin grow; taper between them.' },
    'full-sides': { name: 'Fuller at the sides', region: 'full', thick: 0.02, sides: 0.055, chin: -0.005, desc: 'Fullness at the sides and a short chin — adds width to a long face.', care: 'Let the sides grow, keep the chin short (4–6 mm).' },
    circle: { name: 'Circle beard', region: 'circle', thick: 0.02, desc: 'A moustache joined to a rounded goatee, cheeks shaved.', care: 'Shave the cheeks every 2–3 days; keep the circle 5–10 mm.' },
    goatee: { name: 'Goatee', region: 'goatee', thick: 0.04, desc: 'Hair on the chin only, cheeks and upper lip shaved.', care: 'Shave around it every 2–3 days; keep it as wide as your mouth.' },
    vandyke: { name: 'Van Dyke', region: 'vandyke', thick: 0.08, desc: 'A pointed chin beard with a separate moustache.', care: 'Keep a clear gap between moustache and chin; shape the point weekly.' },
    anchor: { name: 'Anchor beard', region: 'anchor', thick: 0.06, desc: 'A pointed chin beard that runs a little along the jaw, with a pencil moustache.', care: 'Shave the cheeks; trim the anchor shape every few days.' },
    strap: { name: 'Chin strap', region: 'strap', thick: 0.035, desc: 'A thin line of beard following the jaw from ear to ear.', care: 'Needs a steady hand — trim both edges every 2–3 days.' },
    curtain: { name: 'Chin curtain', region: 'strap', thick: 0.075, desc: 'A wider band along the jaw and chin, no moustache.', care: 'Trim to 6–10 mm; keep the top edge a straight line.' }
  };
  /* the names used in the face-shape advice → a style */
  var BY_NAME = {
    'Short boxed beard': 'boxed', 'Stubble': 'stubble', 'Full beard kept tidy': 'full', 'Goatee or Van Dyke': 'vandyke', 'Anchor beard': 'anchor',
    'Longer at the chin, shorter at the sides': 'full-chin', 'Rounded circle beard': 'circle', 'Short, soft full beard': 'full-soft', 'Goatee': 'goatee',
    'Fuller at the sides, short at the chin': 'full-sides', 'Short chin strap': 'strap', 'Full beard': 'full', 'Chin curtain': 'curtain', 'Medium stubble': 'stubble-heavy',
    'Full beard with fullness at the chin': 'full-chin', 'Fuller at the cheeks, short on the jaw': 'full-sides', 'Short stubble': 'stubble', 'Tidy short beard': 'boxed'
  };

  /* ------------------------------------------------------------------ */
  /* Geometry helpers                                                    */
  /* ------------------------------------------------------------------ */
  var add = function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; };
  var sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; };
  var mul = function (a, k) { return { x: a.x * k, y: a.y * k }; };
  var len = function (a) { return Math.hypot(a.x, a.y) || 1; };
  var unit = function (a) { var l = len(a); return { x: a.x / l, y: a.y / l }; };
  var lerp = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };

  function frame(P) {
    var W = len(sub(P[16], P[0]));
    var down = unit(sub(P[8], P[27]));
    var side = unit(sub(P[16], P[0])); // towards the person's left (right of the image)
    var C = lerp(P[27], P[8], 0.45);
    return { W: W, down: down, side: side, C: C };
  }
  /* a jaw point pushed outward (away from the face centre) by k × face width */
  function ext(P, f, i, k) { return add(P[i], mul(unit(sub(P[i], f.C)), k * f.W)); }
  function inward(P, f, i, k) { return add(P[i], mul(unit(sub(f.C, P[i])), k * f.W)); }
  var bell = function (i, c, w) { return Math.exp(-Math.pow((i - c) / w, 2)); };

  /* the moustache line just under the nose, and the mouth hole */
  function mous(P, f) {
    var d = f.down, W = f.W;
    return {
      topL: add(P[31], mul(d, 0.035 * W)), topC: add(P[33], mul(d, 0.03 * W)), topR: add(P[35], mul(d, 0.035 * W)),
      cornerL: add(lerp(P[48], P[31], 0.45), mul(f.side, -0.03 * W)), cornerR: add(lerp(P[54], P[35], 0.45), mul(f.side, 0.03 * W))
    };
  }
  function mouthHole(P, f) {
    var c = lerp(P[51], P[57], 0.5);
    return P.slice(48, 60).map(function (p) { return add(p, mul(unit(sub(p, c)), 0.012 * f.W)); });
  }

  /* → list of polygons (first = outline, rest = holes) for a style */
  function shapes(style, P) {
    var s = STYLES[style], f = frame(P), W = f.W, d = f.down, side = f.side, m = mous(P, f);
    var polys = [];
    var th = function (i) { return Math.max(0.004, (s.thick || 0) + (s.chin || 0) * bell(i, 8, 2.2) + (s.sides || 0) * bell(Math.abs(i - 8), 4.5, 1.6)); };
    if (s.region === 'full') {
      var outer = [];
      for (var i = 0; i <= 16; i++) outer.push(ext(P, f, i, i === 0 || i === 16 ? 0.005 : th(i)));
      if (s.soft) { /* round the corners at the jaw a little */ }
      var cheekR = add(lerp(P[14], P[35], 0.38), mul(d, -0.02 * W)), cheekL = add(lerp(P[2], P[31], 0.38), mul(d, -0.02 * W));
      var inner = [add(P[16], mul(side, -0.05 * W)), add(lerp(P[15], P[16], 0.5), mul(side, -0.06 * W)), cheekR, m.cornerR, m.topR, m.topC, m.topL, m.cornerL, cheekL, add(lerp(P[0], P[1], 0.5), mul(side, 0.06 * W)), add(P[0], mul(side, 0.05 * W))];
      polys.push(outer.concat(inner));
      polys.push(mouthHole(P, f));
    } else if (s.region === 'circle') {
      var bot = [10, 9, 8, 7, 6].map(function (i) { return ext(P, f, i, (i === 8 ? 0.035 : 0.02)); });
      polys.push([m.topL, m.topC, m.topR, add(P[54], mul(side, 0.055 * W)), add(lerp(P[54], P[10], 0.55), mul(side, 0.03 * W))].concat(bot, [add(lerp(P[48], P[6], 0.55), mul(side, -0.03 * W)), add(P[48], mul(side, -0.055 * W))]));
      polys.push(mouthHole(P, f));
    } else if (s.region === 'goatee' || s.region === 'vandyke' || s.region === 'anchor') {
      var point = s.region === 'goatee' ? 0.035 : s.region === 'anchor' ? 0.07 : 0.1;
      var lipL = add(P[59], mul(d, 0.02 * W)), lipR = add(P[55], mul(d, 0.02 * W)), lipC = add(P[57], mul(d, 0.015 * W));
      var g = [lipL, lipC, lipR];
      if (s.region === 'anchor') g = g.concat([add(lerp(P[55], P[11], 0.55), mul(side, 0.04 * W)), ext(P, f, 11, 0.02), ext(P, f, 10, 0.03)]);
      else g.push(add(lerp(P[55], P[10], 0.55), mul(side, 0.01 * W)), ext(P, f, 10, 0.015));
      g.push(ext(P, f, 9, point * 0.5), ext(P, f, 8, point), ext(P, f, 7, point * 0.5));
      if (s.region === 'anchor') g = g.concat([ext(P, f, 6, 0.03), ext(P, f, 5, 0.02), add(lerp(P[59], P[5], 0.55), mul(side, -0.04 * W))]);
      else g.push(ext(P, f, 6, 0.015), add(lerp(P[59], P[6], 0.55), mul(side, -0.01 * W)));
      polys.push(g);
      if (s.region !== 'goatee') {
        // a separate moustache: a band above the upper lip
        var pencil = s.region === 'anchor' ? 0.018 : 0.035;
        var top = [add(P[48], mul(side, -0.02 * W))].concat([49, 50, 51, 52, 53].map(function (i) { return add(P[i], mul(d, -pencil * W - 0.004 * W)); }), [add(P[54], mul(side, 0.02 * W))]);
        var lip = [53, 52, 51, 50, 49].map(function (i) { return add(P[i], mul(d, -0.004 * W)); });
        polys.push({ solo: top.concat(lip) });
      }
    } else if (s.region === 'strap') {
      var o = [], n = [];
      for (var j = 0; j <= 16; j++) { o.push(ext(P, f, j, 0.012)); }
      for (var k = 16; k >= 0; k--) n.push(inward(P, f, k, (k === 0 || k === 16 ? 0.03 : s.thick) * (0.7 + 0.3 * bell(k, 8, 3))));
      polys.push(o.concat(n));
    }
    return polys;
  }

  function pathOf(polys) {
    var p = new Path2D();
    polys.forEach(function (poly) {
      var pts = poly.solo || poly;
      smooth(p, pts);
    });
    return p;
  }
  /* closed curve through the points (midpoint quadratic smoothing) */
  function smooth(p, pts) {
    var n = pts.length;
    var m0 = lerp(pts[n - 1], pts[0], 0.5);
    p.moveTo(m0.x, m0.y);
    for (var i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n], mm = lerp(a, b, 0.5); p.quadraticCurveTo(a.x, a.y, mm.x, mm.y); }
    p.closePath();
  }

  /* ------------------------------------------------------------------ */
  /* Painting: a soft base tone plus hundreds of short hair strokes      */
  /* ------------------------------------------------------------------ */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function paintBeard(g, style, P, opts) {
    opts = opts || {};
    var s = STYLES[style]; if (!s) return;
    var f = frame(P), W = f.W;
    var polys = shapes(style, P);
    var path = pathOf(polys);
    var col = opts.color || [34, 26, 20];
    var rgba = function (a) { return 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')'; };
    // bounding box
    var xs = [], ys = [];
    polys.forEach(function (poly) { (poly.solo || poly).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    g.save();
    if (opts.photo) g.globalCompositeOperation = 'multiply';
    if ('filter' in g) g.filter = 'blur(' + Math.max(0.4, W / 400).toFixed(2) + 'px)';
    g.fillStyle = rgba(s.stubble ? 0.16 * s.stubble : opts.photo ? 0.42 : 0.72);
    g.fill(path, 'evenodd');
    if ('filter' in g) g.filter = 'none';
    g.clip(path, 'evenodd');
    var r = rng(7 + style.length * 131);
    var area = (x1 - x0) * (y1 - y0);
    var hairLen = s.stubble ? W * 0.006 : W * (0.018 + Math.min(0.03, (s.thick || 0) * 0.35));
    var count = Math.min(9000, Math.round(area / (s.stubble ? W * W * 0.00007 : W * W * 0.00016)));
    g.lineCap = 'round';
    for (var i = 0; i < count; i++) {
      var x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      // hair grows down and a little outward from the middle of the face
      var outX = (x - f.C.x) / W;
      var dir = unit(add(f.down, mul(f.side, outX * 0.9 + (r() - 0.5) * 0.35)));
      var L = hairLen * (0.6 + r() * 0.8);
      g.strokeStyle = rgba(s.stubble ? (0.25 + r() * 0.35) * s.stubble : (opts.photo ? 0.35 : 0.5) + r() * 0.4);
      g.lineWidth = Math.max(0.5, W * (s.stubble ? 0.0035 : 0.0045) * (0.7 + r() * 0.6));
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir.x * L, y + dir.y * L); g.stroke();
    }
    g.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Example faces for each face shape (68 points in a 200 × 240 box)     */
  /* ------------------------------------------------------------------ */
  var SHAPE_DIM = {
    oval: { cheek: 128, jaw: 102, chin: 48, chinY: 214, brow: 118 },
    round: { cheek: 142, jaw: 126, chin: 72, chinY: 204, brow: 126 },
    square: { cheek: 134, jaw: 132, chin: 86, chinY: 206, brow: 128 },
    oblong: { cheek: 116, jaw: 102, chin: 58, chinY: 230, brow: 112 },
    heart: { cheek: 134, jaw: 94, chin: 34, chinY: 212, brow: 134 },
    diamond: { cheek: 140, jaw: 96, chin: 44, chinY: 214, brow: 104 },
    triangle: { cheek: 118, jaw: 136, chin: 82, chinY: 208, brow: 104 }
  };
  function examplePoints(shape) {
    var s = SHAPE_DIM[shape] || SHAPE_DIM.oval, cx = 100, top = 98, H = s.chinY - top;
    var F = [0, 0.17, 0.35, 0.52, 0.66, 0.78, 0.88, 0.955, 1];
    var hw = [s.cheek / 2, s.cheek / 2 * 0.985, (s.cheek * 0.62 + s.jaw * 0.38) / 2, (s.cheek * 0.22 + s.jaw * 0.78) / 2, s.jaw / 2, (s.jaw * 0.55 + s.chin * 0.45) / 2, (s.jaw * 0.2 + s.chin * 0.8) / 2, s.chin / 2 * 0.62, 0];
    var P = [];
    for (var i = 0; i <= 16; i++) { var k = i <= 8 ? i : 16 - i, sg = i <= 8 ? -1 : 1; P[i] = { x: cx + sg * hw[k], y: top + F[k] * H }; }
    var eyeY = 96, mouthY = top + H * 0.6, noseY = top + H * 0.38;
    // brows 17–21, 22–26
    for (var b = 0; b < 5; b++) { var t2 = b / 4; P[17 + b] = { x: cx - (s.brow / 2) + t2 * (s.brow / 2 - 10), y: 82 - Math.sin(t2 * Math.PI) * 5 }; P[22 + b] = { x: cx + 10 + t2 * (s.brow / 2 - 10), y: 82 - Math.sin(t2 * Math.PI) * 5 }; }
    for (var n = 0; n < 4; n++) P[27 + n] = { x: cx, y: 92 + n * (noseY - 92) / 3 };
    [-12, -6, 0, 6, 12].forEach(function (dx, j) { P[31 + j] = { x: cx + dx, y: noseY + 6 - (Math.abs(dx) === 12 ? 3 : Math.abs(dx) === 6 ? 1 : 0) }; });
    var eye = function (ex, o) { var pts = [[-11, 0], [-5, -4], [4, -4], [11, 0], [4, 3], [-5, 3]]; pts.forEach(function (q, j) { P[o + j] = { x: ex + q[0], y: eyeY + q[1] }; }); };
    eye(cx - 26, 36); eye(cx + 26, 42);
    var mw = Math.min(24, s.jaw * 0.2);
    var outer = [[-1, 0], [-0.6, -0.28], [-0.2, -0.36], [0, -0.3], [0.2, -0.36], [0.6, -0.28], [1, 0], [0.6, 0.38], [0.2, 0.5], [0, 0.5], [-0.2, 0.5], [-0.6, 0.38]];
    outer.forEach(function (q, j) { P[48 + j] = { x: cx + q[0] * mw, y: mouthY + q[1] * 12 }; });
    var inner = [[-0.8, 0], [-0.3, -0.08], [0, -0.06], [0.3, -0.08], [0.8, 0], [0.3, 0.1], [0, 0.1], [-0.3, 0.1]];
    inner.forEach(function (q, j) { P[60 + j] = { x: cx + q[0] * mw, y: mouthY + q[1] * 12 }; });
    return P;
  }
  function drawExampleFace(g, P, shape) {
    var s = SHAPE_DIM[shape] || SHAPE_DIM.oval;
    var skin = '#c98f65', line = '#7a4b30', hair = '#231a14';
    // neck
    g.fillStyle = '#b97f57'; g.fillRect(100 - s.jaw * 0.28, P[8].y - 30, s.jaw * 0.56, 60);
    // ears
    g.fillStyle = skin; g.strokeStyle = line; g.lineWidth = 1.6;
    [[P[0], -1], [P[16], 1]].forEach(function (e) { g.beginPath(); g.ellipse(e[0].x + e[1] * 4, e[0].y + 6, 8, 16, 0, 0, 6.29); g.fill(); g.stroke(); });
    // face: forehead arc + jaw
    var p = new Path2D();
    var fw = s.cheek / 2 * (shape === 'heart' ? 1.02 : shape === 'triangle' || shape === 'diamond' ? 0.8 : 0.96);
    p.moveTo(P[0].x, P[0].y);
    p.bezierCurveTo(100 - fw, 40, 100 - fw * 0.6, 22, 100, 22);
    p.bezierCurveTo(100 + fw * 0.6, 22, 100 + fw, 40, P[16].x, P[16].y);
    for (var i = 15; i >= 0; i--) p.lineTo(P[i].x, P[i].y);
    p.closePath();
    g.fillStyle = skin; g.fill(p); g.stroke(p);
    // hair: a short crop
    g.fillStyle = hair;
    g.beginPath(); g.moveTo(P[0].x + 2, P[0].y - 26);
    g.bezierCurveTo(100 - fw - 4, 26, 100 - fw * 0.5, 8, 100, 10);
    g.bezierCurveTo(100 + fw * 0.5, 8, 100 + fw + 4, 26, P[16].x - 2, P[16].y - 26);
    g.bezierCurveTo(100 + fw * 0.7, 44, 100 + 10, 34, 100 - 6, 38);
    g.bezierCurveTo(100 - fw * 0.5, 42, 100 - fw * 0.8, 50, P[0].x + 2, P[0].y - 26);
    g.fill();
    // brows
    g.strokeStyle = hair; g.lineWidth = 3.2; g.lineCap = 'round';
    [[17, 21], [22, 26]].forEach(function (r) { g.beginPath(); for (var j = r[0]; j <= r[1]; j++) { if (j === r[0]) g.moveTo(P[j].x, P[j].y); else g.lineTo(P[j].x, P[j].y); } g.stroke(); });
    // eyes
    [[36, 41], [42, 47]].forEach(function (r) {
      g.fillStyle = '#fff'; g.beginPath(); for (var j = r[0]; j <= r[1]; j++) { if (j === r[0]) g.moveTo(P[j].x, P[j].y); else g.lineTo(P[j].x, P[j].y); } g.closePath(); g.fill();
      var c = { x: (P[r[0]].x + P[r[0] + 3].x) / 2, y: P[r[0]].y };
      g.fillStyle = '#3b2518'; g.beginPath(); g.arc(c.x, c.y, 3.2, 0, 6.29); g.fill();
    });
    // nose
    g.strokeStyle = line; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(P[31].x, P[31].y); g.quadraticCurveTo(P[33].x, P[33].y + 4, P[35].x, P[35].y); g.stroke();
    g.beginPath(); g.moveTo(P[27].x - 3, P[27].y + 6); g.quadraticCurveTo(P[29].x - 5, P[29].y, P[31].x + 2, P[31].y - 2); g.stroke();
    // lips
    g.fillStyle = '#a55a4d'; g.beginPath(); for (var k = 48; k < 60; k++) { if (k === 48) g.moveTo(P[k].x, P[k].y); else g.lineTo(P[k].x, P[k].y); } g.closePath(); g.fill();
    g.strokeStyle = '#6e332a'; g.lineWidth = 1; g.beginPath(); g.moveTo(P[48].x, P[48].y); g.lineTo(P[54].x, P[54].y); g.stroke();
  }

  /* ------------------------------------------------------------------ */
  /* Pictures                                                            */
  /* ------------------------------------------------------------------ */
  var CW = 160, CH = 190;
  /* example face for a face shape, with a beard style → data URL */
  function exampleImage(style, shape, scale) {
    scale = scale || 2;
    var cv = document.createElement('canvas');
    cv.width = CW * scale; cv.height = CH * scale;
    var g = cv.getContext('2d');
    g.scale(scale * CW / 200, scale * CW / 200);
    g.translate(0, -8);
    var P = examplePoints(shape);
    drawExampleFace(g, P, shape);
    if (style) paintBeard(g, style, P, {});
    return cv.toDataURL('image/png');
  }
  /* the person's photo (a canvas) cropped around the face, with a beard style → data URL */
  function photoImage(style, shot, scale) {
    scale = scale || 2;
    var P0 = shot.pts, f = frame(P0);
    var xs = P0.slice(0, 27).map(function (p) { return p.x; }), ys = P0.slice(0, 27).map(function (p) { return p.y; });
    var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    var top = Math.min.apply(null, ys) - f.W * 0.35, bottom = P0[8].y + f.W * 0.28;
    var h = bottom - top, w = h * CW / CH;
    var x0 = cx - w / 2;
    var cv = document.createElement('canvas');
    cv.width = CW * scale; cv.height = CH * scale;
    var g = cv.getContext('2d');
    var k = cv.width / w;
    g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(shot.canvas, x0, top, w, h, 0, 0, cv.width, cv.height);
    var P = P0.map(function (p) { return { x: (p.x - x0) * k, y: (p.y - top) * k }; });
    if (style) paintBeard(g, style, P, { photo: true });
    return cv.toDataURL('image/jpeg', 0.88);
  }

  M.beard = {
    STYLES: STYLES, byName: function (n) { return BY_NAME[n] || null; },
    examplePoints: examplePoints, shapes: shapes, paint: paintBeard,
    exampleImage: exampleImage, photoImage: photoImage
  };
})();
