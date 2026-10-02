/* Mizan — skin, face care & grooming guide.
   The photo is analysed ON THE DEVICE with face-api (MIT, bundled in assets/vendor) to measure the face
   and estimate its shape. The photo is never uploaded or stored. Skin type comes from a short quiz,
   because a photo can't judge skin type reliably. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;

  /* ------------------------------------------------------------------ */
  /* Face measurements from 68 landmarks                                  */
  /* ------------------------------------------------------------------ */
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function avg(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p.x; y += p.y; }); return { x: x / pts.length, y: y / pts.length }; }

  /* pts: 68 {x,y}. Returns scale-free ratios, corrected for head tilt */
  function measure(pts) {
    var eyeL = avg(pts.slice(36, 42)), eyeR = avg(pts.slice(42, 48));
    var ang = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
    var c = Math.cos(-ang), s = Math.sin(-ang), o = mid(eyeL, eyeR);
    var P = pts.map(function (p) { var dx = p.x - o.x, dy = p.y - o.y; return { x: dx * c - dy * s, y: dx * s + dy * c }; });
    var cheek = dist(P[1], P[15]);
    var jaw = dist(P[4], P[12]);
    var chin = dist(P[6], P[10]);
    var brow = dist(P[17], P[26]);
    var browY = (P[19].y + P[24].y) / 2;
    // facial thirds: the forehead is about as tall as brow-to-nose-base, so the hairline sits that far above the brows
    var length = (P[8].y - browY) + (P[33].y - browY);
    var angleAt = function (a, b, cc) { var v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: cc.x - b.x, y: cc.y - b.y }; return Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))) * 180 / Math.PI; };
    var jawAngle = (angleAt(P[2], P[4], P[7]) + angleAt(P[14], P[12], P[9])) / 2;
    var left = dist(P[30], P[2]), right = dist(P[30], P[14]);
    return { R: length / cheek, J: jaw / cheek, F: brow / cheek, T: chin / jaw, jawAngle: jawAngle, yaw: Math.max(left, right) / Math.min(left, right), tilt: Math.abs(ang * 180 / Math.PI) };
  }

  /* Prototype ratios for each shape. Calibrated so an average, front-facing face lands on "oval"
     (measured on sample portraits); the others are pushed along the ratio that defines them. */
  var SHAPES = {
    oval: { label: 'Oval', R: 1.52, J: 0.80, F: 0.82, T: 0.60, A: 151, desc: 'Longer than wide, with a gently rounded jaw and a slightly narrower chin.' },
    round: { label: 'Round', R: 1.36, J: 0.85, F: 0.82, T: 0.65, A: 156, desc: 'About as long as wide, with full cheeks and a soft, rounded jaw.' },
    square: { label: 'Square', R: 1.38, J: 0.90, F: 0.85, T: 0.67, A: 144, desc: 'A strong, angular jaw about as wide as the forehead and cheeks.' },
    oblong: { label: 'Oblong', R: 1.72, J: 0.84, F: 0.83, T: 0.62, A: 149, desc: 'Noticeably longer than wide, with straight sides.' },
    heart: { label: 'Heart', R: 1.48, J: 0.73, F: 0.88, T: 0.54, A: 153, desc: 'A wider forehead and cheeks that taper to a narrower, pointed chin.' },
    diamond: { label: 'Diamond', R: 1.52, J: 0.73, F: 0.76, T: 0.56, A: 152, desc: 'Widest at the cheekbones, with a narrower forehead and jaw.' },
    triangle: { label: 'Triangle', R: 1.44, J: 0.92, F: 0.76, T: 0.66, A: 148, desc: 'A wider jaw with a narrower forehead.' }
  };
  var SCALE = { R: 0.12, J: 0.05, F: 0.05, T: 0.06, A: 8 };
  function classify(r) {
    return Object.keys(SHAPES).map(function (k) {
      var p = SHAPES[k], d = 0;
      ['R', 'J', 'F', 'T'].forEach(function (q) { d += Math.pow((r[q] - p[q]) / SCALE[q], 2); });
      if (r.jawAngle) d += 0.5 * Math.pow((r.jawAngle - p.A) / SCALE.A, 2);
      return { shape: k, d: Math.sqrt(d) };
    }).sort(function (a, b) { return a.d - b.d; });
  }

  /* ------------------------------------------------------------------ */
  /* Loading face-api only when needed                                    */
  /* ------------------------------------------------------------------ */
  var apiPromise = null;
  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      var done = function () {
        // the phone's graphics chip if possible, otherwise the (slower) processor
        var tf = faceapi.tf;
        var use = function (name) { return Promise.resolve(tf.setBackend(name)).then(function (ok) { if (!ok) throw new Error(name); return tf.ready(); }); };
        use('webgl').catch(function () { return use('cpu'); }).then(function () {
          return Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('assets/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('assets/models')
          ]);
        }).then(resolve, function (e) { apiPromise = null; reject(e); });
      };
      if (window.faceapi) { done(); return; }
      var sc = document.createElement('script');
      sc.src = 'assets/vendor/face-api/face-api.js?v=' + M.VERSION;
      sc.onload = done;
      sc.onerror = function () { apiPromise = null; reject(new Error('Couldn’t load the face scanner. Check your connection and try again.')); };
      document.head.appendChild(sc);
    });
    return apiPromise;
  }
  function analyse(img) {
    return loadApi().then(function () {
      return faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })).withFaceLandmarks();
    }).then(function (res) {
      if (!res || !res.length) throw new Error('No face found. Use a clear, front-facing photo in good light.');
      res.sort(function (a, b) { return b.detection.box.area - a.detection.box.area; });
      var pts = res[0].landmarks.positions.map(function (p) { return { x: p.x, y: p.y }; });
      return { pts: pts, box: res[0].detection.box, many: res.length > 1, ratios: measure(pts) };
    });
  }

  /* ------------------------------------------------------------------ */
  /* The skincare routine                                                 */
  /* ------------------------------------------------------------------ */
  var TYPE_LABEL = { dry: 'Dry', normal: 'Normal', combination: 'Combination', oily: 'Oily' };
  function routine(q, age) {
    var t = q.feel || 'normal', sens = q.react === 'often';
    var C = q.concerns || [];
    var acne = q.acne === 'often' || C.indexOf('acne') >= 0;
    var young = age !== null && age !== undefined && age < 16;
    var hot = q.climate === 'humid' || q.climate === 'hotdry';
    var am = [], pm = [], weekly = [], look, avoid;
    var cleanser = sens ? 'A gentle, fragrance-free, low-foam cleanser' : t === 'oily' ? 'A gel or foaming cleanser' + (acne ? ' with salicylic acid (0.5–2%)' : '') : t === 'dry' ? 'A creamy, non-foaming hydrating cleanser' : 'A gentle gel or cream cleanser';
    am.push({ step: 'Cleanse', what: t === 'dry' ? 'Just lukewarm water, or a little creamy cleanser' : cleanser, why: 'Removes sweat and oil from the night.' });
    if (!young && (t === 'oily' || t === 'combination' || C.indexOf('marks') >= 0 || C.indexOf('oil') >= 0 || C.indexOf('pores') >= 0)) am.push({ step: 'Serum (optional)', what: 'Niacinamide 2–5%', why: 'Controls oil, calms redness and fades marks over 8–12 weeks.' });
    else if (!young && !sens && (C.indexOf('dull') >= 0 || C.indexOf('tan') >= 0)) am.push({ step: 'Serum (optional)', what: 'Vitamin C (10–15%, or a gentler derivative)', why: 'Brightens and evens out tone. Use it under sunscreen.' });
    var moist = t === 'oily' ? 'An oil-free gel moisturiser (“non-comedogenic”)' : t === 'dry' ? 'A richer cream with ceramides, glycerin or shea' : t === 'combination' ? 'A light lotion, with a little extra on dry areas' : 'A light lotion';
    if (sens) moist += ', fragrance-free';
    am.push({ step: 'Moisturise', what: moist, why: 'Keeps the skin barrier healthy — even oily skin needs it.' });
    am.push({ step: 'Sunscreen', what: 'Broad-spectrum SPF 30–50, PA+++ or higher' + (t === 'oily' || hot ? ', gel or matte finish' : t === 'dry' ? ', cream' : '') + (sens ? ' (mineral: zinc oxide or titanium dioxide)' : ''), why: 'The most important step for tan, dark spots and early ageing. Reapply every 2–3 hours when outdoors.' });
    pm.push({ step: 'Cleanse', what: cleanser, why: 'Removes sunscreen, dust and oil from the day.' });
    if (acne) pm.push({ step: 'Treat pimples', what: young ? 'Benzoyl peroxide 2.5% gel, on pimples only' : 'Benzoyl peroxide 2.5% on spots, or adapalene 0.1% gel on the area (ask a pharmacist or doctor)', why: 'Start 2–3 nights a week. A little dryness at first is normal.' });
    else if (!young && C.indexOf('marks') >= 0) pm.push({ step: 'Treat marks', what: 'Azelaic acid 10% or niacinamide', why: 'Fades dark marks gently. Daily sunscreen makes it work faster.' });
    if (!sens && !acne && C.indexOf('blackheads') >= 0) pm.push({ step: 'Unclog pores (2–3× a week)', what: 'Salicylic acid (BHA) 1–2%', why: 'Clears blackheads from inside the pore.' });
    pm.push({ step: 'Moisturise', what: t === 'oily' ? 'The same gel moisturiser' : t === 'dry' ? 'A thicker cream (or a thin layer of petroleum jelly on very dry patches)' : 'Your moisturiser', why: 'Skin repairs itself overnight.' });
    if (C.indexOf('circles') >= 0) pm.push({ step: 'Under the eyes', what: 'A plain moisturiser, or an eye cream with caffeine or niacinamide', why: 'Sleep, water and less late-night screen time help most.' });
    if (C.indexOf('lips') >= 0 || t === 'dry') pm.push({ step: 'Lips', what: 'Lip balm with petroleum jelly or shea', why: 'Stops cracking.' });
    if (!sens && (C.indexOf('dull') >= 0 || t === 'oily' || t === 'combination')) weekly.push('Gentle exfoliation once a week — a lactic or mandelic acid toner. No harsh scrubs.');
    weekly.push('Change your pillowcase 1–2 times a week and wipe your phone screen.');
    if (C.indexOf('tan') >= 0) weekly.push('Tan fades in 4–8 weeks with daily sunscreen — skip lemon, bleach and strong “fairness” creams.');
    look = ['“Non-comedogenic” (won’t block pores)'];
    if (t === 'oily' || acne) look.push('Salicylic acid, niacinamide, benzoyl peroxide (for pimples)');
    if (t === 'dry') look.push('Ceramides, glycerin, hyaluronic acid, shea butter');
    if (sens) look.push('“Fragrance-free”, “for sensitive skin”, zinc oxide sunscreen');
    if (C.indexOf('marks') >= 0 || C.indexOf('tan') >= 0) look.push('Niacinamide, azelaic acid, vitamin C — plus daily sunscreen');
    avoid = ['Scrubs with crushed shells or beads', 'Toothpaste, lemon or baking soda on the face'];
    if (sens || t === 'dry') avoid.push('Alcohol-heavy toners and strong fragrance');
    if (t === 'oily' || acne) avoid.push('Heavy oils and thick creams where you break out');
    avoid.push('Steroid or “fairness” creams without a doctor — they can damage skin');
    return { type: t, sens: sens, acne: acne, am: am, pm: pm, weekly: weekly, look: look, avoid: avoid, young: young };
  }

  var HAIR = {
    oval: { yes: ['Textured crop', 'Quiff', 'Side part', 'Classic taper', 'Shoulder-length layers'], tip: 'Almost any style works — pick one that suits your hair type and how much time you want to spend.', avoid: 'heavy fringes that hide your face.' },
    round: { yes: ['Pompadour or quiff with height', 'Faux hawk', 'Undercut with volume on top', 'Side part with short sides', 'Long layers below the chin'], tip: 'Add height on top and keep the sides shorter — it makes the face look longer.', avoid: 'bowl cuts, round fringes and volume at the sides.' },
    square: { yes: ['Textured crop', 'Buzz cut', 'Messy quiff', 'Side part', 'Soft layers'], tip: 'A strong jaw looks great with short, tidy sides. Some texture on top softens the angles.', avoid: 'blunt cuts that end right at the jaw.' },
    oblong: { yes: ['Fringe / bangs', 'Side-swept styles', 'Medium textured cut', 'Chin-length layers', 'Curtains'], tip: 'Add width at the sides and keep height low — a fringe shortens a long face.', avoid: 'tall pompadours and very long straight hair without layers.' },
    heart: { yes: ['Side-swept fringe', 'Medium textured cut', 'Chin-length layers or bob', 'Longer fringe', 'Tousled waves'], tip: 'Balance a wider forehead with a fringe and some fullness near the chin.', avoid: 'very short sides with lots of volume on top.' },
    diamond: { yes: ['Textured fringe', 'Side-swept quiff', 'Fuller sides', 'Chin-length layers', 'Tucked-behind-ear styles'], tip: 'Add fullness at the forehead and chin to balance wide cheekbones.', avoid: 'slicked-back styles that show only the cheekbones.' },
    triangle: { yes: ['Textured quiff', 'Layered cut with volume on top', 'Side part with fuller top', 'Longer on top, tapered sides', 'Layers above the jaw'], tip: 'Add volume at the top and temples to balance a wider jaw.', avoid: 'flat tops with full sides.' }
  };
  var BEARD = {
    oval: ['Short boxed beard', 'Stubble', 'Full beard kept tidy'],
    round: ['Goatee or Van Dyke', 'Anchor beard', 'Longer at the chin, shorter at the sides'],
    square: ['Rounded circle beard', 'Short, soft full beard', 'Goatee'],
    oblong: ['Fuller at the sides, short at the chin', 'Short boxed beard', 'Short chin strap'],
    heart: ['Full beard', 'Chin curtain', 'Medium stubble'],
    diamond: ['Full beard with fullness at the chin', 'Short boxed beard', 'Goatee'],
    triangle: ['Fuller at the cheeks, short on the jaw', 'Short stubble', 'Tidy short beard']
  };
  var HAIR_TYPE_TIP = {
    straight: 'Straight hair falls flat easily — a little matte paste or blow-drying at the roots adds volume.',
    wavy: 'Medium lengths show waves best. Use a light cream and let it air-dry.',
    curly: 'Keep curls on top with tapered sides. Use a leave-in conditioner, don’t brush dry curls, and trim every 8–10 weeks.',
    coily: 'A tapered afro or twists work well. Moisture is key: leave-in conditioner and a satin pillowcase.'
  };
  function shapeSvg(k) {
    var d = {
      oval: 'M50 8c22 0 34 20 34 44s-14 44-34 44S16 76 16 52 28 8 50 8z',
      round: 'M50 12c24 0 36 18 36 38s-14 40-36 40-36-20-36-40 12-38 36-38z',
      square: 'M22 14h56c4 0 6 2 6 6v44c0 12-12 26-34 26S16 76 16 64V20c0-4 2-6 6-6z',
      oblong: 'M28 6h44c6 0 8 4 8 10v58c0 12-14 22-30 22S20 86 20 74V16c0-6 2-10 8-10z',
      heart: 'M16 22c0-10 14-14 34-14s34 4 34 14c0 26-18 66-34 72C34 88 16 48 16 22z',
      diamond: 'M50 6c10 10 34 26 34 44S62 88 50 94C38 88 16 68 16 50S40 16 50 6z',
      triangle: 'M34 10h32c6 0 8 6 12 30 4 26 6 50-28 54C16 90 18 66 22 40 26 16 28 10 34 10z'
    }[k];
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + d + '" fill="var(--accent-soft)" stroke="currentColor" stroke-width="3"/></svg>';
  }

  /* ------------------------------------------------------------------ */
  /* View                                                                */
  /* ------------------------------------------------------------------ */
  var draft = null; // quiz answers in progress
  var photo = null; // result card for the last photo — kept in memory only, never saved
  var shot = null;  // { canvas, pts } the last photo and its face points, for trying beards on — memory only

  function Q(name, legend, opts, val, multi) {
    return '<fieldset class="field"><legend class="label">' + legend + '</legend><div class="choice-row">' + opts.map(function (o) {
      var on = multi ? (val || []).indexOf(o[0]) >= 0 : val === o[0];
      return '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + o[0] + '"' + (multi ? ' data-multi' : '') + (on ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
    }).join('') + '</div></fieldset>';
  }
  function quizHtml(a) {
    return '<form id="lk-quiz" class="stack" novalidate>' +
      Q('feel', '1. About an hour after washing your face, it feels…', [['dry', 'Tight or flaky'], ['normal', 'Comfortable'], ['combination', 'Shiny on forehead & nose only'], ['oily', 'Shiny all over']], a.feel) +
      Q('acne', '2. How often do you get pimples?', [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']], a.acne) +
      Q('react', '3. Does your skin sting, itch or turn red with new products?', [['rarely', 'Rarely'], ['sometimes', 'Sometimes'], ['often', 'Often']], a.react) +
      Q('concerns', '4. What would you like to improve? (pick any)', [['acne', 'Pimples'], ['marks', 'Dark spots & marks'], ['tan', 'Tan / uneven tone'], ['dull', 'Dullness'], ['circles', 'Dark circles'], ['oil', 'Oiliness'], ['blackheads', 'Blackheads'], ['pores', 'Large pores'], ['lips', 'Dry lips']], a.concerns, true) +
      Q('climate', '5. Where you live is mostly…', [['humid', 'Hot & humid'], ['hotdry', 'Hot & dry'], ['cold', 'Cold'], ['mixed', 'Changes a lot']], a.climate) +
      Q('hair', 'Your hair type', [['straight', 'Straight'], ['wavy', 'Wavy'], ['curly', 'Curly'], ['coily', 'Coily']], a.hair) +
      Q('beard', 'Show beard ideas?', [['yes', 'Yes'], ['no', 'No thanks']], a.beard) +
      '<p class="err hidden" id="lk-err" role="alert"></p>' +
      '<button type="submit" class="btn btn-primary">' + M.icon('sparkles') + 'Make my guide</button></form>';
  }
  function faceBlock() {
    var L = M.state.looks || {};
    var shape = L.shape;
    return '<section class="panel" aria-labelledby="lk-face-h"><div class="panel-title"><h3 id="lk-face-h">Face shape</h3>' + (shape ? '<span class="badge accent">' + SHAPES[shape].label + (L.fromPhoto ? ' · from photo' : '') + '</span>' : '') + '</div>' +
      '<p class="soft" style="margin-top:0">Take a selfie or pick a photo: face the camera straight on, hair off your forehead, good light. It’s analysed <strong>on this phone</strong> and never uploaded or saved.</p>' +
      '<div class="btn-row"><label class="btn btn-primary" style="cursor:pointer">' + M.icon('camera') + 'Take a selfie<input type="file" accept="image/*" capture="user" class="sr-only" data-photo aria-label="Take a selfie"></label>' +
      '<label class="btn" style="cursor:pointer">' + M.icon('image') + 'Choose a photo<input type="file" accept="image/*" class="sr-only" data-photo aria-label="Choose a photo"></label></div>' +
      '<div class="lk-photo" aria-live="polite">' + (photo || '') + '</div>' +
      '<fieldset class="field" style="margin-top:14px"><legend class="label">Or choose it yourself</legend><div class="shape-grid">' + Object.keys(SHAPES).map(function (k) {
        return '<label class="shape-opt"><input type="radio" name="shape" value="' + k + '"' + (shape === k ? ' checked' : '') + '>' + shapeSvg(k) + '<span>' + SHAPES[k].label + '</span></label>';
      }).join('') + '</div></fieldset></section>';
  }
  function guideHtml() {
    var L = M.state.looks;
    var r = routine(L.quiz, M.ageFrom(M.state.profile));
    var shape = L.shape ? SHAPES[L.shape] : null, hair = L.shape ? HAIR[L.shape] : null;
    var steps = function (list) { return '<ol class="rt-list">' + list.map(function (x) { return '<li><strong>' + M.esc(x.step) + '</strong><span>' + M.esc(x.what) + '</span><em>' + M.esc(x.why) + '</em></li>'; }).join('') + '</ol>'; };
    var ul = function (list, cls) { return '<ul class="plain' + (cls ? ' ' + cls : '') + '">' + list.map(function (x) { return '<li>' + M.esc(x) + '</li>'; }).join('') + '</ul>'; };
    return '<section class="panel lk-result" aria-labelledby="lk-res-h">' +
      '<p class="eyebrow">' + M.icon('sparkles') + 'Your guide</p><h2 id="lk-res-h">' + TYPE_LABEL[r.type] + ' skin' + (r.sens ? ', sensitive' : '') + (r.acne ? ', prone to pimples' : '') + '</h2>' +
      (r.young ? U.note('info', '<p>At your age, keep it simple: a gentle cleanser, moisturiser and sunscreen. Use strong acids or retinoids only if a doctor suggests them.</p>') : '') +
      '<div class="grid-2" style="margin-top:12px"><div class="inset"><h4>' + M.icon('sun', 'class="h-ico"') + 'Morning</h4>' + steps(r.am) + '</div>' +
      '<div class="inset"><h4>' + M.icon('moon', 'class="h-ico"') + 'Night</h4>' + steps(r.pm) + '</div></div>' +
      '<h4 style="margin-top:16px">Each week</h4>' + ul(r.weekly) +
      '<div class="grid-2" style="margin-top:12px"><div><h4>Look for on the label</h4>' + ul(r.look, 'good') + '</div><div><h4>Avoid</h4>' + ul(r.avoid, 'bad') + '</div></div>' +
      '<h4 style="margin-top:12px">Every day helps too</h4>' + ul(['Water through the day, 7–9 hours of sleep and fewer sugary drinks show up on your skin.', 'Don’t pick or squeeze pimples — it leaves marks that last for months.', 'Give any new product 6–8 weeks, and add only one new product at a time.']) +
      U.note('warn', '<p>See a dermatologist if pimples are painful or leave scars, if a rash or patch doesn’t go away, or if a mole changes. This guide is general advice, not a diagnosis.</p>') +
      (shape ? '<hr><p class="eyebrow">' + M.icon('face') + 'Hair' + (L.quiz.beard === 'yes' ? ' & beard' : '') + '</p><div class="row" style="gap:14px;align-items:flex-start;margin-top:8px"><span class="shape-big">' + shapeSvg(L.shape) + '</span><div><h3>' + shape.label + ' face</h3><p class="soft" style="margin:4px 0 0">' + shape.desc + '</p></div></div>' +
        '<h4 style="margin-top:14px">Hairstyles that suit you</h4><div class="chip-row">' + hair.yes.map(function (x) { return '<span class="chip">' + M.esc(x) + '</span>'; }).join('') + '</div>' +
        '<p class="soft" style="margin:10px 0 0;font-size:var(--fs-sm)">' + M.esc(hair.tip) + ' <strong>Skip</strong> ' + M.esc(hair.avoid) + '</p>' +
        (L.quiz.hair ? '<p class="soft" style="margin:8px 0 0;font-size:var(--fs-sm)">' + M.esc(HAIR_TYPE_TIP[L.quiz.hair]) + '</p>' : '') +
        (L.quiz.beard === 'yes' ? beardBlock(L) : '') +
        '<p class="muted" style="margin:10px 0 0;font-size:var(--fs-xs)">Show these names to your barber or hairdresser and ask what works with your hair.</p>'
        : '<hr><p class="soft">Add your face shape to get hairstyle' + (L.quiz.beard === 'yes' ? ' and beard' : '') + ' ideas.</p>') +
      '</section>';
  }

  /* Beard styles with pictures: on the person's photo when there is one, otherwise on an example face of their shape */
  function beardImg(style, L, scale) {
    try { return shot ? M.beard.photoImage(style, shot, scale) : M.beard.exampleImage(style, L.shape, scale); } catch (e) { return ''; }
  }
  function beardCard(id, label, L) {
    var st = M.beard.STYLES[id];
    return '<button type="button" class="beard-card" data-beard="' + id + '"><img src="' + beardImg(id, L, 2) + '" alt="' + M.esc(st.name + (shot ? ' drawn on your photo' : ' on an example ' + SHAPES[L.shape].label.toLowerCase() + ' face')) + '" width="160" height="190"><span>' + M.esc(label || st.name) + '</span></button>';
  }
  function beardBlock(L) {
    var ids = [], names = {};
    BEARD[L.shape].forEach(function (n) { var id = M.beard.byName(n); if (id && ids.indexOf(id) < 0) { ids.push(id); names[id] = n; } });
    return '<h4 style="margin-top:16px">Beard styles for you</h4>' +
      '<p class="soft" style="margin:4px 0 10px;font-size:var(--fs-sm)">' + (shot ? M.icon('camera', 'class="h-ico"') + 'Tried on <strong>your photo</strong> — a rough preview, drawn on this phone.' : 'Shown on an example <strong>' + SHAPES[L.shape].label.toLowerCase() + '</strong> face. Add a photo (on the right) to try them on yourself.') + ' Tap one to see it bigger.</p>' +
      '<div class="beard-grid">' + ids.map(function (id) { return beardCard(id, names[id], L); }).join('') + '</div>' +
      '<button type="button" class="btn btn-sm" data-beard-all style="margin-top:10px">' + M.icon('face') + 'See all ' + Object.keys(M.beard.STYLES).length + ' beard styles</button>' +
      '<p class="soft" style="margin:10px 0 0;font-size:var(--fs-sm)">Patchy beard? Keep it short (stubble) while it fills in — that can take until your mid-20s. Trim the neckline about one finger above the Adam’s apple.</p>';
  }
  function beardSheet(id, L) {
    var st = M.beard.STYLES[id];
    var withB = beardImg(id, L, 3), without = beardImg(null, L, 3);
    M.sheet({
      title: st.name,
      body: '<div class="beard-big"><img src="' + withB + '" alt="' + M.esc(st.name + (shot ? ' on your photo' : ' on an example face')) + '" data-with="' + withB + '" data-without="' + without + '"></div>' +
        '<div class="seg beard-toggle" role="radiogroup" aria-label="Show"><label><input type="radio" name="bshow" value="with" checked><span>With beard</span></label><label><input type="radio" name="bshow" value="without"><span>Without</span></label></div>' +
        '<p style="margin:12px 0 0">' + M.esc(st.desc) + '</p><p class="soft" style="margin:8px 0 0;font-size:var(--fs-sm)"><strong>Upkeep:</strong> ' + M.esc(st.care) + '</p>' +
        '<p class="muted" style="margin:10px 0 0;font-size:var(--fs-xs)">' + (shot ? 'A rough drawing on your photo — real growth, colour and density will differ.' : 'An illustration — add a photo to see it on your own face.') + ' Show the name to your barber.</p>',
      foot: '<button type="button" class="btn btn-primary" data-close>Done</button>', noAutofocus: true,
      onOpen: function (dlg) {
        dlg.addEventListener('change', function (e) {
          if (e.target.name !== 'bshow') return;
          var im = dlg.querySelector('.beard-big img');
          im.src = im.getAttribute(e.target.value === 'with' ? 'data-with' : 'data-without');
        });
      }
    });
  }
  function allBeardsSheet(L) {
    M.sheet({
      title: 'All beard styles', wide: true,
      body: '<p class="soft" style="margin-top:0">' + (shot ? 'On your photo.' : 'On an example ' + SHAPES[L.shape].label.toLowerCase() + ' face.') + ' Tap one for details.</p><div class="beard-grid all">' + Object.keys(M.beard.STYLES).map(function (id) { return beardCard(id, null, L); }).join('') + '</div>',
      foot: '<button type="button" class="btn btn-primary" data-close>Done</button>', noAutofocus: true,
      onOpen: function (dlg) { dlg.addEventListener('click', function (e) { var c = e.target.closest('[data-beard]'); if (c) beardSheet(c.getAttribute('data-beard'), L); }); }
    });
  }

  function drawResult(img, res) {
    var cv = document.createElement('canvas');
    var sc = Math.min(1, 640 / img.naturalWidth);
    cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
    var g = cv.getContext('2d');
    g.drawImage(img, 0, 0, cv.width, cv.height);
    var P = res.pts.map(function (p) { return { x: p.x * sc, y: p.y * sc }; });
    var lw = Math.max(2, cv.width / 220);
    g.lineWidth = lw; g.lineJoin = 'round'; g.strokeStyle = '#c6f04e';
    g.beginPath(); P.slice(0, 17).forEach(function (p, i) { if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke();
    var line = function (a, b) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
    g.strokeStyle = '#ffffff'; g.setLineDash([lw * 2, lw * 2]);
    line(P[1], P[15]); line(P[4], P[12]); line(P[17], P[26]);
    g.setLineDash([]);
    g.fillStyle = '#c6f04e';
    P.forEach(function (p) { g.beginPath(); g.arc(p.x, p.y, lw * 0.9, 0, 6.3); g.fill(); });
    return cv.toDataURL('image/jpeg', 0.85);
  }

  function handlePhoto(file, el) {
    var box = M.$('.lk-photo', el);
    box.innerHTML = '<p class="muted">Looking at your photo on this phone… (the first time takes a few seconds)</p>';
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      analyse(img).then(function (res) {
        var r = res.ratios, ranked = classify(r), best = ranked[0].shape;
        M.looks._last = { ratios: r, ranked: ranked };
        var warn = [];
        if (r.yaw > 1.35) warn.push('Your head looks turned to one side — a straight-on photo gives a better result.');
        if (res.many) warn.push('More than one face was found — the largest one was used.');
        var outline = drawResult(img, res);
        // keep a clean copy of the photo (in memory only) to try beards on
        var sc = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        shot = { canvas: cv, pts: res.pts.map(function (q) { return { x: q.x * sc, y: q.y * sc }; }) };
        URL.revokeObjectURL(url);
        var L = M.state.looks || (M.state.looks = {});
        L.shape = best; L.fromPhoto = true; L.at = M.today();
        M.save(); M.haptic('success');
        photo = '<figure class="lk-fig"><img src="' + outline + '" alt="Your photo with the face outline Mizan measured"><figcaption>Closest match: <strong>' + SHAPES[best].label + '</strong>, then ' + SHAPES[ranked[1].shape].label.toLowerCase() + '. Length to width ' + r.R.toFixed(2) + ' · jaw to cheeks ' + r.J.toFixed(2) + '.</figcaption></figure>' +
          (warn.length ? U.note('warn', warn.map(function (x) { return '<p>' + x + '</p>'; }).join('')) : '') +
          '<p class="hint">Hair, angle and the camera lens can change how a face looks. If another shape fits you better, pick it below.</p>';
        M.render(true);
      }).catch(function (e) {
        URL.revokeObjectURL(url);
        M.haptic('error');
        box.innerHTML = U.note('warn', '<p>' + M.esc(e && e.message ? e.message : 'Couldn’t read that photo.') + ' You can also choose your face shape below.</p>');
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); box.innerHTML = U.note('warn', '<p>That file couldn’t be opened as a photo.</p>'); };
    img.src = url;
  }

  M.views.looks = {
    head: function () { return { title: 'Looks', sub: 'Skin, face care & grooming' }; },
    render: function (el) {
      var L = M.state.looks || {};
      if (!draft) draft = L.quiz ? M.deepClone(L.quiz) : { concerns: [], beard: (M.state.profile.sex === 'male' && (M.ageFrom(M.state.profile) || 18) >= 15) ? 'yes' : 'no' };
      var hasGuide = !!L.quiz;
      el.innerHTML = '<div class="split wide-first"><div class="stack">' +
        (hasGuide ? guideHtml() : '<section class="panel" aria-labelledby="lk-q-h"><h2 id="lk-q-h">A routine made for your skin</h2><p class="soft">Answer 5 quick questions. Add a photo if you’d like hairstyle and beard ideas for your face shape.</p>' + quizHtml(draft) + '</section>') +
        '</div><div class="stack">' + faceBlock() +
        (hasGuide ? '<section class="panel"><h3 style="margin-bottom:8px">Change your answers</h3><details><summary class="muted" style="cursor:pointer;font-weight:700">Skin quiz</summary><div style="margin-top:12px">' + quizHtml(draft) + '</div></details></section>' : '') +
        '</div></div>';
      el.addEventListener('click', function (e) {
        var c = e.target.closest('[data-beard]'); if (c) { beardSheet(c.getAttribute('data-beard'), M.state.looks); return; }
        if (e.target.closest('[data-beard-all]')) allBeardsSheet(M.state.looks);
      });
      el.addEventListener('change', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-photo') && t.files && t.files[0]) handlePhoto(t.files[0], el);
        if (t.name === 'shape') { var LL = M.state.looks || (M.state.looks = {}); LL.shape = t.value; LL.fromPhoto = false; M.save(); M.haptic('select'); M.render(true); }
      });
      var f = M.$('#lk-quiz', el);
      if (f) f.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = M.formData(f);
        if (!d.feel || !d.acne || !d.react) { var er = M.$('#lk-err', el); er.textContent = 'Please answer questions 1 to 3.'; er.classList.remove('hidden'); M.haptic('error'); return; }
        draft = { feel: d.feel, acne: d.acne, react: d.react, concerns: d.concerns || [], climate: d.climate || 'mixed', hair: d.hair || '', beard: d.beard || 'no' };
        var LL = M.state.looks || (M.state.looks = {});
        LL.quiz = M.deepClone(draft);
        M.save(); M.haptic('success'); M.toast('Your guide is ready');
        M.render();
      });
    }
  };

  M.looks = { measure: measure, classify: classify, routine: routine, SHAPES: SHAPES, analyse: analyse, loadApi: loadApi, hasShot: function () { return !!shot; } };
})();
