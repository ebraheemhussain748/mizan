/* Mizan — calculators and planning math.
   Every formula here is documented on the Science page with its source. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var C = (M.calc = {});

  /* ------------------------------------------------------------------ */
  /* BMI                                                                 */
  /* ------------------------------------------------------------------ */
  C.bmi = function (kg, cm) {
    if (!kg || !cm) return null;
    var m = cm / 100;
    return kg / (m * m);
  };

  C.BMI_STANDARDS = {
    who: {
      name: 'WHO (global)',
      bands: [
        { max: 18.5, key: 'under', label: 'Underweight' },
        { max: 25, key: 'healthy', label: 'Healthy weight' },
        { max: 30, key: 'over', label: 'Overweight' },
        { max: 35, key: 'ob1', label: 'Obesity class 1' },
        { max: 40, key: 'ob2', label: 'Obesity class 2' },
        { max: Infinity, key: 'ob3', label: 'Obesity class 3' }
      ],
      healthyMax: 24.9
    },
    asian: {
      name: 'Asian Indian / South Asian',
      bands: [
        { max: 18.5, key: 'under', label: 'Underweight' },
        { max: 23, key: 'healthy', label: 'Healthy weight' },
        { max: 25, key: 'over', label: 'Overweight' },
        { max: 30, key: 'ob1', label: 'Obesity class 1' },
        { max: Infinity, key: 'ob2', label: 'Obesity class 2' }
      ],
      healthyMax: 22.9
    }
  };

  C.bmiCategory = function (bmi, std) {
    var s = C.BMI_STANDARDS[std] || C.BMI_STANDARDS.who;
    for (var i = 0; i < s.bands.length; i++) if (bmi < s.bands[i].max) return { index: i, key: s.bands[i].key, label: s.bands[i].label, standard: s };
    return null;
  };

  C.healthyRange = function (cm, std) {
    var s = C.BMI_STANDARDS[std] || C.BMI_STANDARDS.who;
    var m = cm / 100;
    return { min: 18.5 * m * m, max: s.healthyMax * m * m };
  };

  /* Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf) */
  C.normCdf = function (z) {
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  };

  /* CDC 2000 BMI-for-age, ages 2–19 */
  C.bmiForAge = function (bmi, sex, ageMonths) {
    if (!M.GROWTH || !bmi || !ageMonths || (sex !== 'male' && sex !== 'female')) return null;
    var tab = M.GROWTH[sex];
    var idx = ageMonths - M.GROWTH.startMonths;
    if (idx < 0 || idx > tab.length - 1) return null;
    var i0 = Math.floor(idx), i1 = Math.min(tab.length - 1, i0 + 1), f = idx - i0;
    var r = [0, 1, 2, 3].map(function (k) { return tab[i0][k] + (tab[i1][k] - tab[i0][k]) * f; });
    var L = r[0], Mv = r[1], S = r[2], P95 = r[3];
    var z = Math.abs(L) < 1e-6 ? Math.log(bmi / Mv) / S : (Math.pow(bmi / Mv, L) - 1) / (L * S);
    var pct = C.normCdf(z) * 100;
    var bmiAtPct = function (p) {
      // inverse via bisection on z
      var lo = -5, hi = 5;
      for (var k = 0; k < 60; k++) { var mid = (lo + hi) / 2; if (C.normCdf(mid) * 100 < p) lo = mid; else hi = mid; }
      var zz = (lo + hi) / 2;
      return Math.abs(L) < 1e-6 ? Mv * Math.exp(S * zz) : Mv * Math.pow(1 + L * S * zz, 1 / L);
    };
    var cat;
    if (pct < 5) cat = { key: 'under', label: 'Underweight' };
    else if (pct < 85) cat = { key: 'healthy', label: 'Healthy weight' };
    else if (pct < 95) cat = { key: 'over', label: 'Overweight' };
    else if (bmi >= 1.2 * P95 || bmi >= 35) cat = { key: 'ob2', label: 'Severe obesity' };
    else cat = { key: 'ob1', label: 'Obesity' };
    return { z: z, pct: pct, p95: P95, category: cat, p5: bmiAtPct(5), p85: bmiAtPct(85), p95b: bmiAtPct(95) };
  };

  /* ------------------------------------------------------------------ */
  /* Energy                                                              */
  /* ------------------------------------------------------------------ */
  C.ACTIVITY = [
    { id: 'sedentary', f: 1.2, label: 'Mostly sitting', desc: 'Desk or classroom most of the day, under ~5,000 steps, little exercise.' },
    { id: 'light', f: 1.375, label: 'Lightly active', desc: '5,000–7,500 steps or light exercise 1–3 days a week.' },
    { id: 'moderate', f: 1.55, label: 'Moderately active', desc: '7,500–10,000 steps or exercise 3–5 days a week.' },
    { id: 'very', f: 1.725, label: 'Very active', desc: '10,000+ steps or hard exercise 6–7 days a week.' },
    { id: 'extra', f: 1.9, label: 'Extremely active', desc: 'Physical job plus training, or training twice a day.' }
  ];
  C.activity = function (id) { for (var i = 0; i < C.ACTIVITY.length; i++) if (C.ACTIVITY[i].id === id) return C.ACTIVITY[i]; return C.ACTIVITY[1]; };

  C.bmrMifflin = function (kg, cm, age, sex) {
    var base = 10 * kg + 6.25 * cm - 5 * age;
    if (sex === 'male') return base + 5;
    if (sex === 'female') return base - 161;
    return base - 78; // midpoint when sex isn't specified
  };
  C.bmrKatch = function (leanKg) { return 370 + 21.6 * leanKg; };

  C.tdee = function (p, kg) {
    var age = M.ageFrom(p);
    if (!kg || !p.heightCm || !age) return null;
    var bmr = C.bmrMifflin(kg, p.heightCm, age, p.sex);
    var f = C.activity(p.activity).f;
    return { bmr: bmr, tdee: bmr * f, factor: f };
  };

  /* ------------------------------------------------------------------ */
  /* Body composition                                                    */
  /* ------------------------------------------------------------------ */
  C.navyBodyFat = function (sex, cm, neck, waist, hip) {
    var log = Math.log10;
    if (!cm || !neck || !waist) return null;
    if (sex === 'male') {
      if (waist - neck <= 0) return null;
      return 495 / (1.0324 - 0.19077 * log(waist - neck) + 0.15456 * log(cm)) - 450;
    }
    if (sex === 'female') {
      if (!hip || waist + hip - neck <= 0) return null;
      return 495 / (1.29579 - 0.35004 * log(waist + hip - neck) + 0.221 * log(cm)) - 450;
    }
    return null;
  };
  C.bodyFatBand = function (sex, bf) {
    var bands = sex === 'female'
      ? [[14, 'Essential fat'], [21, 'Athletic'], [25, 'Fitness'], [32, 'Average'], [Infinity, 'High']]
      : [[6, 'Essential fat'], [14, 'Athletic'], [18, 'Fitness'], [25, 'Average'], [Infinity, 'High']];
    for (var i = 0; i < bands.length; i++) if (bf < bands[i][0]) return { index: i, label: bands[i][1], bands: bands };
    return null;
  };

  C.whtr = function (waist, cm) { return waist && cm ? waist / cm : null; };
  C.whtrBand = function (r) {
    if (r < 0.4) return { index: 0, key: 'low', label: 'Below 0.4 — check you’re not underweight' };
    if (r < 0.5) return { index: 1, key: 'healthy', label: 'Healthy — no action needed' };
    if (r < 0.6) return { index: 2, key: 'care', label: 'Increased health risk — take care' };
    return { index: 3, key: 'action', label: 'High health risk — take action' };
  };
  C.waistRisk = function (sex, waist, std) {
    if (!waist || (sex !== 'male' && sex !== 'female')) return null;
    if (std === 'asian') {
      var lim = sex === 'male' ? 90 : 80;
      return waist >= lim ? { level: 'high', text: 'At or above ' + lim + ' cm — abdominal obesity by Asian Indian criteria.' } : { level: 'ok', text: 'Below the ' + lim + ' cm Asian Indian threshold.' };
    }
    var a = sex === 'male' ? [94, 102] : [80, 88];
    if (waist >= a[1]) return { level: 'high', text: a[1] + ' cm or more — substantially increased risk.' };
    if (waist >= a[0]) return { level: 'mid', text: a[0] + '–' + (a[1] - 1) + ' cm — increased risk.' };
    return { level: 'ok', text: 'Below ' + a[0] + ' cm.' };
  };

  C.ibwDevine = function (sex, cm) {
    if (!cm) return null;
    var inches = cm / 2.54;
    var over = inches - 60;
    if (sex === 'male') return 50 + 2.3 * over;
    if (sex === 'female') return 45.5 + 2.3 * over;
    return 47.75 + 2.3 * over;
  };

  /* ------------------------------------------------------------------ */
  /* Protein, water, sleep                                               */
  /* ------------------------------------------------------------------ */
  /* Reference weight: for BMI ≥ 30 we use the weight at the top of the healthy range,
     so protein targets stay realistic. */
  C.refWeight = function (kg, cm, std) {
    var b = C.bmi(kg, cm);
    if (b && b >= 30) return C.healthyRange(cm, std).max;
    return kg;
  };
  C.proteinRange = function (p, kg) {
    var age = M.ageFrom(p);
    var ref = p.heightCm ? C.refWeight(kg, p.heightCm, M.state.settings.bmiStandard) : kg;
    var lo, hi, why;
    if (age !== null && age < 18) { lo = 1.0; hi = 1.4; why = 'Growing teens: at least the RDA (~0.85–1 g/kg), more if you train — from normal meals.'; }
    else if (p.goal === 'lose') { lo = 1.6; hi = 2.2; why = 'Higher protein helps keep muscle while eating less.'; }
    else if (p.goal === 'gain') { lo = 1.6; hi = 2.2; why = 'About 1.6 g/kg covers most people building muscle; up to 2.2 g/kg for some.'; }
    else if (p.activity === 'sedentary') { lo = 0.83; hi = 1.2; why = 'ICMR’s RDA for Indian adults is 0.83 g/kg; a little more is fine.'; }
    else { lo = 1.2; hi = 1.6; why = 'Active adults do well between 1.2 and 1.6 g/kg.'; }
    return { lo: lo * ref, hi: hi * ref, perKg: [lo, hi], ref: ref, why: why };
  };

  C.waterGoal = function (p, kg, exerciseMin, hot) {
    var age = M.ageFrom(p) || 25;
    var sex = p.sex;
    var totLo, totHi; // litres of total water (food + drinks)
    if (age < 9) { totLo = 1.6; totHi = 1.7; }
    else if (age < 14) { totLo = sex === 'female' ? 1.9 : 2.1; totHi = sex === 'female' ? 2.1 : 2.4; }
    else { totLo = sex === 'female' ? 2.0 : sex === 'male' ? 2.5 : 2.25; totHi = sex === 'female' ? 2.7 : sex === 'male' ? 3.7 : 3.2; }
    // about 80% of total water comes from drinks
    var lo = totLo * 0.8, hi = totHi * 0.8;
    var extra = (exerciseMin || 0) / 60 * 0.6 + (hot ? 0.5 : 0);
    return { lo: lo + extra, hi: hi + extra, goal: Math.round(((lo + hi) / 2 + extra) * 4) / 4, extra: extra };
  };

  C.sleepNeed = function (age) {
    if (age === null || age === undefined) return { lo: 7, hi: 9, label: 'Adults' };
    if (age < 1) return { lo: 12, hi: 16, label: 'Babies (4–12 months)' };
    if (age < 3) return { lo: 11, hi: 14, label: 'Ages 1–2' };
    if (age < 6) return { lo: 10, hi: 13, label: 'Ages 3–5' };
    if (age < 13) return { lo: 9, hi: 12, label: 'Ages 6–12' };
    if (age < 18) return { lo: 8, hi: 10, label: 'Ages 13–17' };
    if (age < 26) return { lo: 7, hi: 9, label: 'Ages 18–25' };
    if (age < 65) return { lo: 7, hi: 9, label: 'Ages 26–64' };
    return { lo: 7, hi: 8, label: 'Ages 65+' };
  };

  /* ------------------------------------------------------------------ */
  /* Training                                                            */
  /* ------------------------------------------------------------------ */
  C.hrMax = function (age) { return 208 - 0.7 * age; };
  C.hrZones = function (age, rest) {
    var max = C.hrMax(age);
    var names = [
      ['Zone 1', 'Very light — warm-up, recovery'],
      ['Zone 2', 'Light — easy, can talk in full sentences'],
      ['Zone 3', 'Moderate — can speak in short phrases'],
      ['Zone 4', 'Hard — a few words at a time'],
      ['Zone 5', 'Maximum — short bursts only']
    ];
    var pcts = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.0]];
    return {
      max: max,
      method: rest ? 'reserve' : 'max',
      zones: pcts.map(function (pc, i) {
        var f = function (x) { return rest ? rest + (max - rest) * x : max * x; };
        return { name: names[i][0], desc: names[i][1], lo: f(pc[0]), hi: f(pc[1]), pct: pc };
      })
    };
  };
  C.oneRM = function (w, r) {
    if (!w || !r || r < 1) return null;
    if (r === 1) return w;
    var epley = w * (1 + r / 30);
    var brzycki = r < 37 ? w * 36 / (37 - r) : epley;
    return (epley + brzycki) / 2;
  };
  C.loadForReps = function (orm, reps) { return reps <= 1 ? orm : orm / (1 + reps / 30); };

  C.METS = [
    { id: 'walk-slow', label: 'Walking, slow (~3 km/h)', met: 2.8 },
    { id: 'walk', label: 'Walking, moderate (~5 km/h)', met: 3.5 },
    { id: 'walk-brisk', label: 'Walking, brisk (~6.5 km/h)', met: 5.0 },
    { id: 'jog', label: 'Jogging (~8 km/h)', met: 8.3 },
    { id: 'run', label: 'Running (~10 km/h)', met: 9.8 },
    { id: 'cycle', label: 'Cycling, easy', met: 4.0 },
    { id: 'cycle-mod', label: 'Cycling, moderate (~20 km/h)', met: 8.0 },
    { id: 'swim', label: 'Swimming, leisurely', met: 6.0 },
    { id: 'skip', label: 'Skipping rope, moderate', met: 11.8 },
    { id: 'weights', label: 'Strength training, general', met: 3.5 },
    { id: 'weights-hard', label: 'Strength training, vigorous', met: 6.0 },
    { id: 'yoga', label: 'Yoga (hatha)', met: 2.5 },
    { id: 'football', label: 'Football, casual', met: 7.0 },
    { id: 'cricket', label: 'Cricket (batting, bowling)', met: 4.8 },
    { id: 'badminton', label: 'Badminton, social', met: 5.5 },
    { id: 'basketball', label: 'Basketball, general', met: 6.5 },
    { id: 'dance', label: 'Dancing, general', met: 5.0 },
    { id: 'stairs', label: 'Climbing stairs, slow', met: 4.0 },
    { id: 'chores', label: 'Household cleaning', met: 3.3 },
    { id: 'study', label: 'Sitting, studying', met: 1.3 }
  ];
  C.metKcal = function (met, kg, minutes) { return met * kg * minutes / 60; };

  /* ------------------------------------------------------------------ */
  /* Goal planner                                                        */
  /* ------------------------------------------------------------------ */
  C.PACES = {
    lose: [
      { id: 'gentle', label: 'Gentle', pct: 0.25, desc: 'About 0.25% of body weight a week — easiest to stick with.' },
      { id: 'steady', label: 'Steady', pct: 0.5, desc: 'About 0.5% a week — a good balance for most people.' },
      { id: 'faster', label: 'Faster', pct: 0.75, desc: 'About 0.75% a week — harder; watch energy, sleep and strength.' }
    ],
    gain: [
      { id: 'gentle', label: 'Gentle', surplus: 150, desc: '+150 kcal a day — slow, mostly lean gain for trained lifters.' },
      { id: 'steady', label: 'Steady', surplus: 300, desc: '+300 kcal a day — typical lean bulk, or for underweight adults.' },
      { id: 'faster', label: 'Faster', surplus: 500, desc: '+500 kcal a day — for beginners or if you’re underweight and struggling to gain.' }
    ]
  };

  C.goalPlan = function (p, kg) {
    var st = M.state.settings;
    var age = M.ageFrom(p);
    var out = { ok: false, warnings: [], blocks: [], notes: [] };
    if (!kg || !p.heightCm || !age) { out.missing = true; return out; }
    var t = C.tdee(p, kg);
    out.bmr = t.bmr; out.tdee = t.tdee;
    var bmi = C.bmi(kg, p.heightCm);
    out.bmi = bmi;
    var range = C.healthyRange(p.heightCm, st.bmiStandard);
    out.range = range;
    var minor = age < 18;
    out.minor = minor;
    var goal = p.goal || 'maintain';
    var target = p.targetKg;
    var floor = p.sex === 'male' ? 1500 : p.sex === 'female' ? 1200 : 1350;
    var kcal = t.tdee;
    var rateKgWk = 0;

    if (goal === 'lose') {
      if (minor) {
        out.blocks.push('Calorie cutting isn’t recommended while you’re still growing. Mizan keeps your food at your estimated needs and helps with activity, sleep and regular meals instead. If you’re worried about your weight, talk to a doctor — they use growth charts, not adult numbers.');
        goal = 'maintain';
      } else if (bmi < 18.5) {
        out.blocks.push('Your BMI is already below 18.5, so a weight-loss plan isn’t safe. If you want to change how your body looks or feels, strength training with enough food is the better route — and please talk to a doctor if you’ve lost weight without trying.');
        goal = 'maintain';
      } else if (target && target >= kg) {
        out.warnings.push('Your target is not below your current weight, so this is treated as maintenance.');
        goal = 'maintain';
      }
    }
    if (goal === 'gain' && target && target <= kg) {
      out.warnings.push('Your target is not above your current weight, so this is treated as maintenance.');
      goal = 'maintain';
    }

    if (goal === 'lose') {
      if (target && target < range.min) {
        out.warnings.push('A target of ' + M.showW(target) + ' ' + M.wUnit() + ' would put you under a BMI of 18.5. Mizan plans to ' + M.showW(Math.ceil(range.min)) + ' ' + M.wUnit() + ' instead.');
        target = Math.ceil(range.min * 10) / 10;
      }
      var pace = C.PACES.lose.filter(function (x) { return x.id === p.pace; })[0] || C.PACES.lose[1];
      rateKgWk = kg * pace.pct / 100;
      var deficit = rateKgWk * 7700 / 7;
      deficit = Math.min(deficit, 1000, t.tdee * 0.3);
      kcal = t.tdee - deficit;
      if (kcal < floor) {
        out.warnings.push('This pace would take you below ' + floor + ' kcal a day, the usual safe minimum without medical supervision. Calories were raised to ' + floor + ' kcal, so progress will be a little slower.');
        kcal = floor;
        deficit = t.tdee - kcal;
        rateKgWk = deficit * 7 / 7700;
      }
      out.deficit = deficit;
      out.pace = pace;
    } else if (goal === 'gain') {
      var gp = C.PACES.gain.filter(function (x) { return x.id === p.pace; })[0] || C.PACES.gain[1];
      var surplus = minor ? Math.min(gp.surplus, 300) : gp.surplus;
      kcal = t.tdee + surplus;
      rateKgWk = surplus * 7 / 7700;
      out.surplus = surplus;
      out.pace = gp;
      if (minor) out.notes.push('For teens, the focus is regular meals, enough protein and a supervised strength programme — not a big surplus.');
    }

    if (minor) out.notes.push('Calorie equations were built on adults, so for teens this is a rough guide — growing bodies often need more. Let hunger guide you and eat regular meals.');
    out.goal = goal;
    out.kcal = Math.round(kcal / 10) * 10;
    out.rateKgWk = rateKgWk;
    out.target = target;
    if ((goal === 'lose' || goal === 'gain') && target && rateKgWk > 0) {
      var weeks = Math.abs(kg - target) / rateKgWk;
      out.weeks = weeks;
      out.weeksHi = weeks * 1.35; // progress slows as the body adapts (Hall 2011)
      var d = new Date(); d.setDate(d.getDate() + Math.round(weeks * 7));
      var d2 = new Date(); d2.setDate(d2.getDate() + Math.round(weeks * 1.35 * 7));
      out.eta = d; out.etaHi = d2;
    }
    // macros
    var prot = C.proteinRange(Object.assign({}, p, { goal: goal }), kg);
    var protein = Math.round((prot.lo + prot.hi) / 2 / 5) * 5;
    var fatPct = 0.28;
    var fat = Math.max(out.kcal * fatPct / 9, 0.6 * kg);
    var carbs = Math.max(0, (out.kcal - protein * 4 - fat * 9) / 4);
    out.macros = { protein: protein, proteinRange: prot, fat: Math.round(fat), carbs: Math.round(carbs), fiber: Math.max(25, Math.round(out.kcal / 1000 * 14)) };
    out.ok = true;
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Weight trend (exponentially smoothed, 10% per day)                  */
  /* ------------------------------------------------------------------ */
  C.trend = function (weights) {
    var w = weights.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var out = [];
    var tr = null, last = null;
    w.forEach(function (e) {
      if (tr === null) tr = e.kg;
      else {
        var gap = Math.max(1, M.daysBetween(last, e.d));
        var alpha = 1 - Math.pow(0.9, gap);
        tr = tr + alpha * (e.kg - tr);
      }
      last = e.d;
      out.push({ d: e.d, kg: e.kg, trend: tr });
    });
    return out;
  };
  C.weeklyRate = function (series) {
    if (series.length < 3) return null;
    var lastD = series[series.length - 1].d;
    var pts = series.filter(function (s) { return M.daysBetween(s.d, lastD) <= 21; });
    if (pts.length < 3) return null;
    var span = M.daysBetween(pts[0].d, lastD);
    if (span < 6) return null;
    var xs = pts.map(function (s) { return M.daysBetween(pts[0].d, s.d); });
    var ys = pts.map(function (s) { return s.trend; });
    var n = xs.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; }
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return slope * 7;
  };

  /* ------------------------------------------------------------------ */
  /* Routine analysis                                                    */
  /* ------------------------------------------------------------------ */
  /* Resolve a routine's blocks for a given date: applies sunrise / sunset anchors, returns
     sorted blocks with absolute minute ranges on a 0..1440 (+ wrap) axis.
     An anchor that isn't available (sun times off) falls back to the fixed time. */
  C.resolveBlocks = function (routine, dateKey) {
    var pt = M.sun ? M.sun.timeMap(dateKey) : {};
    return (routine ? routine.blocks : []).map(function (b) {
      var s = M.toMin(b.start), e = M.toMin(b.end);
      var d = M.dur(b.start, b.end);
      var anchored = false;
      if (b.anchor && b.anchor.to && pt[b.anchor.to] !== undefined && pt[b.anchor.to] !== null) {
        s = Math.round(pt[b.anchor.to] + (b.anchor.offset || 0));
        e = s + d;
        anchored = true;
      }
      s = ((s % 1440) + 1440) % 1440;
      e = ((e % 1440) + 1440) % 1440;
      return { b: b, start: s, end: e, dur: d, anchored: anchored };
    }).sort(function (a, b) { return a.start - b.start; });
  };

  C.routineFor = function (dateKey) {
    var rs = M.state.routines;
    var wd = M.weekday(dateKey);
    for (var i = 0; i < rs.length; i++) if (rs[i].days.indexOf(wd) >= 0) return rs[i];
    return rs[0] || null;
  };

  /* Where are we right now? Handles blocks that cross midnight. */
  C.locate = function (resolved, nowMin) {
    var cur = null, next = null, idx = -1;
    for (var i = 0; i < resolved.length; i++) {
      var r = resolved[i];
      var inside = r.start < r.end ? (nowMin >= r.start && nowMin < r.end) : (nowMin >= r.start || nowMin < r.end);
      if (inside) { cur = r; idx = i; break; }
    }
    // next = the block with the smallest positive start distance
    var best = Infinity;
    resolved.forEach(function (r) {
      if (cur && r === cur) return;
      var dist = (r.start - nowMin + 1440) % 1440;
      if (dist > 0 && dist < best) { best = dist; next = r; }
    });
    var left = null, elapsed = null;
    if (cur) {
      left = (cur.end - nowMin + 1440) % 1440;
      elapsed = cur.dur - left;
    }
    return { cur: cur, next: next, idx: idx, left: left, elapsed: elapsed, untilNext: next ? best : null };
  };

  C.analyzeRoutine = function (routine, p, dateKey) {
    var res = C.resolveBlocks(routine, dateKey || M.today());
    var out = { gaps: [], overlaps: [], totals: {}, total: 0, checks: [] };
    M.CATS.forEach(function (c) { out.totals[c.id] = 0; });
    res.forEach(function (r) { out.totals[r.b.cat] = (out.totals[r.b.cat] || 0) + r.dur; out.total += r.dur; });
    for (var i = 0; i < res.length; i++) {
      var a = res[i], b = res[(i + 1) % res.length];
      if (res.length < 2) break;
      var aEnd = a.start + a.dur;
      var bStart = b.start + (i === res.length - 1 ? 1440 : 0);
      var diff = bStart - aEnd;
      if (diff > 0) out.gaps.push({ after: a, before: b, min: diff, at: aEnd % 1440 });
      else if (diff < 0) out.overlaps.push({ a: a, b: b, min: -diff, at: b.start });
    }
    var age = M.ageFrom(p);
    var need = C.sleepNeed(age);
    var sleep = out.totals.sleep || 0;
    var buffers = res.filter(function (r) { return r.b.cat === 'routine' && r.dur <= 20; }).length;
    var longStudy = res.filter(function (r) { return r.b.cat === 'study' && r.dur > 100; });
    var screen = out.totals.screen || 0;
    var exercise = out.totals.exercise || 0;
    var free = out.totals.free || 0;

    if (out.overlaps.length) out.checks.push({ level: 'bad', text: out.overlaps.length + ' ' + M.plural(out.overlaps.length, 'overlap') + ' — two blocks claim the same time.' });
    if (out.total !== 1440 && !out.overlaps.length) {
      var missing = 1440 - out.total;
      if (missing > 0) out.checks.push({ level: 'warn', text: M.fmtDur(missing) + ' of the day isn’t planned. That’s fine if it’s on purpose.' });
    } else if (!out.overlaps.length) out.checks.push({ level: 'ok', text: 'Every minute of the 24 hours has a place.' });

    if (sleep === 0) out.checks.push({ level: 'bad', text: 'No sleep block. Add one so the rest of the day can be planned around it.' });
    else if (sleep < need.lo * 60) out.checks.push({ level: 'warn', text: 'Sleep is ' + M.fmtDur(sleep) + '. ' + need.label + ' need ' + need.lo + '–' + need.hi + ' hours.' });
    else if (sleep > need.hi * 60 + 30) out.checks.push({ level: 'warn', text: 'Sleep is ' + M.fmtDur(sleep) + ' — more than the usual ' + need.lo + '–' + need.hi + ' hours.' });
    else out.checks.push({ level: 'ok', text: 'Sleep: ' + M.fmtDur(sleep) + ' — within the ' + need.lo + '–' + need.hi + ' hours recommended for ' + need.label.toLowerCase() + '.' });

    if (buffers >= 3) out.checks.push({ level: 'ok', text: buffers + ' short buffers between blocks — small delays won’t knock the day over.' });
    else out.checks.push({ level: 'warn', text: 'Only ' + buffers + ' short ' + M.plural(buffers, 'buffer') + '. Plans usually take longer than expected — add 5–15 minute cushions.' });

    if (longStudy.length) out.checks.push({ level: 'warn', text: longStudy.length + ' study ' + M.plural(longStudy.length, 'block is', 'blocks are') + ' longer than 100 minutes. Split with a short break to keep focus.' });
    if (exercise === 0) out.checks.push({ level: 'warn', text: 'No exercise block. ' + (age !== null && age < 18 ? 'Teens need about 60 minutes of activity a day.' : 'Adults need 150–300 minutes a week.') });
    else {
      var needEx = age !== null && age < 18 ? 60 : 22;
      out.checks.push({ level: exercise >= needEx ? 'ok' : 'warn', text: 'Exercise: ' + M.fmtDur(exercise) + ' on this day' + (age !== null && age < 18 ? ' (teens: aim for 60 min daily).' : ' (adults: 150–300 min a week).') });
    }
    if (free === 0) out.checks.push({ level: 'warn', text: 'No free time. Unstructured time is part of recovery, not wasted time.' });

    // wind-down check: a screen block right before sleep
    var sleepIdx = res.findIndex(function (r) { return r.b.cat === 'sleep'; });
    if (sleepIdx > 0) {
      var before = res[sleepIdx - 1];
      if (before.b.cat === 'screen') out.checks.push({ level: 'warn', text: 'Screen time ends right at bedtime. Screens off 30–60 minutes before sleep helps you fall asleep.' });
    }
    out.resolved = res;
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Realistic limits for body numbers                                    */
  /* Values outside these can't belong to a real person (usually a typo  */
  /* or the wrong unit). Children are checked against their age: the     */
  /* height ranges are about ±5 SD around WHO / CDC growth references,    */
  /* both sexes together — generous, but a 2-year-old can't be 170 cm.    */
  /* ------------------------------------------------------------------ */
  C.LIMITS = {
    age: [2, 120], heightCm: [50, 250], weightKg: [2, 400], waistCm: [30, 250], neckCm: [15, 80], hipCm: [40, 250],
    restingHr: [30, 120], bodyFat: [2, 70], liftKg: [1, 500], exMin: [0, 600]
  };
  var H_AGE = { 0: [40, 85], 1: [62, 100], 2: [70, 106], 3: [76, 116], 4: [82, 125], 5: [87, 134], 6: [92, 142], 7: [96, 149], 8: [100, 156], 9: [104, 163], 10: [108, 170], 11: [112, 178], 12: [116, 186], 13: [120, 194], 14: [124, 201], 15: [127, 206], 16: [129, 209], 17: [130, 211] };
  C.heightRange = function (age) {
    if (age === null || age === undefined || age >= 18) return C.LIMITS.heightCm;
    return H_AGE[Math.max(0, Math.floor(age))] || C.LIMITS.heightCm;
  };
  // weight by age (kg), about ±5 SD around WHO / CDC references — generous on the heavy side
  var W_AGE = { 0: [1.5, 15], 1: [6, 20], 2: [7, 25], 3: [8, 30], 4: [9, 38], 5: [10, 45], 6: [11, 55], 7: [12, 65], 8: [14, 75], 9: [15, 85], 10: [17, 95], 11: [19, 105], 12: [21, 115], 13: [22, 130], 14: [24, 150], 15: [26, 160], 16: [28, 170], 17: [30, 180] };
  C.weightRange = function (age) {
    if (age === null || age === undefined || age >= 18) return C.LIMITS.weightKg;
    return W_AGE[Math.max(0, Math.floor(age))] || C.LIMITS.weightKg;
  };
  C.bmiRange = function (age) {
    if (age === null || age === undefined || age >= 18) return [10, 100];
    if (age < 6) return [9, 35];
    if (age < 10) return [9, 45];
    if (age < 14) return [9, 55];
    return [10, 70];
  };
  var ageWord = function (a) { return a < 1 ? 'baby under 1' : Math.floor(a) + '-year-old'; };
  /* v: { age, heightCm, weightKg, waistCm, neckCm, hipCm, restingHr, bodyFat, liftKg, exMin } (any may be null)
     opts: { minAge, minAgeMsg } → [{ key, msg }] */
  C.checkBody = function (v, opts) {
    opts = opts || {};
    var L = C.LIMITS, out = [], U = M.ui;
    var has = function (x) { return x !== null && x !== undefined && x !== '' && !isNaN(x); };
    var len = function (cm) { return U.fmtIn('height', cm); }, wt = function (kg) { return U.fmtIn('weight', kg); }, ln = function (cm) { return U.fmtIn('length', cm); };
    var age = has(v.age) ? v.age : null;
    if (age !== null) {
      var minA = opts.minAge !== undefined ? opts.minAge : L.age[0];
      if (age < 0 || age > L.age[1]) out.push({ key: 'age', msg: 'Age must be between ' + minA + ' and ' + L.age[1] + ' years.', short: minA + '–' + L.age[1] + ' years' });
      else if (age < minA) out.push({ key: 'age', msg: opts.minAgeMsg || 'This works for ages ' + minA + ' and up.', short: 'For ages ' + minA + ' and up', young: true });
    }
    // a real age is still used to check height and weight, even when this tool isn't made for that age
    var okAge = age !== null && age >= 0 && age <= L.age[1] ? age : null;
    if (has(v.heightCm)) {
      var hr = C.heightRange(okAge);
      if (v.heightCm < L.heightCm[0] || v.heightCm > L.heightCm[1]) out.push({ key: 'heightCm', msg: 'Height must be between ' + len(L.heightCm[0]) + ' and ' + len(L.heightCm[1]) + '. Check the number and the unit.', short: len(L.heightCm[0]) + ' – ' + len(L.heightCm[1]) });
      else if (v.heightCm < hr[0] || v.heightCm > hr[1]) out.push({ key: 'heightCm', msg: len(v.heightCm) + ' isn’t possible for a ' + ageWord(okAge) + ' — at that age it’s between about ' + len(hr[0]) + ' and ' + len(hr[1]) + '. Check the height or the age.', short: okAge < 1 ? 'Not possible for a baby' : 'Not possible at age ' + Math.floor(okAge) });
    }
    if (has(v.weightKg)) {
      var wr = C.weightRange(okAge);
      if (v.weightKg < L.weightKg[0] || v.weightKg > L.weightKg[1]) out.push({ key: 'weightKg', msg: 'Weight must be between ' + wt(L.weightKg[0]) + ' and ' + wt(L.weightKg[1]) + '. Check the number and the unit.', short: wt(L.weightKg[0]) + ' – ' + wt(L.weightKg[1]) });
      else if (v.weightKg < wr[0] || v.weightKg > wr[1]) out.push({ key: 'weightKg', msg: wt(v.weightKg) + ' isn’t possible for a ' + ageWord(okAge) + ' — at that age it’s between about ' + wt(wr[0]) + ' and ' + wt(wr[1]) + '. Check the weight or the age.', short: okAge < 1 ? 'Not possible for a baby' : 'Not possible at age ' + Math.floor(okAge) });
      else if (has(v.heightCm) && !out.some(function (e) { return e.key === 'heightCm'; })) {
        var b = v.weightKg / Math.pow(v.heightCm / 100, 2), br = C.bmiRange(okAge);
        if (b < br[0] || b > br[1]) {
          var lo = br[0] * Math.pow(v.heightCm / 100, 2), hi = br[1] * Math.pow(v.heightCm / 100, 2);
          out.push({ key: 'weightKg', msg: wt(v.weightKg) + ' at ' + len(v.heightCm) + ' isn’t possible' + (okAge !== null && okAge < 18 ? ' for a ' + ageWord(okAge) : '') + ' — for that height it would be between about ' + wt(Math.max(L.weightKg[0], lo)) + ' and ' + wt(Math.min(L.weightKg[1], hi)) + '. Check the weight and the height.', short: 'Not possible for this height' });
        }
      }
    }
    [['waistCm', 'Waist'], ['neckCm', 'Neck'], ['hipCm', 'Hips']].forEach(function (x) {
      if (!has(v[x[0]])) return;
      var r = L[x[0]];
      if (v[x[0]] < r[0] || v[x[0]] > r[1]) out.push({ key: x[0], msg: x[1] + ' must be between ' + ln(r[0]) + ' and ' + ln(r[1]) + '.', short: ln(r[0]) + ' – ' + ln(r[1]) });
      else if (has(v.heightCm) && x[0] === 'neckCm' && has(v.waistCm) && v.neckCm >= v.waistCm) out.push({ key: 'neckCm', msg: 'Your neck should measure less than your waist — check both.', short: 'Less than your waist' });
    });
    if (has(v.restingHr) && (v.restingHr < L.restingHr[0] || v.restingHr > L.restingHr[1])) out.push({ key: 'restingHr', msg: 'Resting heart rate is usually between ' + L.restingHr[0] + ' and ' + L.restingHr[1] + ' beats a minute.', short: L.restingHr[0] + '–' + L.restingHr[1] + ' bpm' });
    if (has(v.bodyFat) && (v.bodyFat < L.bodyFat[0] || v.bodyFat > L.bodyFat[1])) out.push({ key: 'bodyFat', msg: 'Body fat must be between ' + L.bodyFat[0] + '% and ' + L.bodyFat[1] + '%.', short: L.bodyFat[0] + '–' + L.bodyFat[1] + '%' });
    if (has(v.liftKg) && (v.liftKg < L.liftKg[0] || v.liftKg > L.liftKg[1])) out.push({ key: 'liftKg', msg: 'Enter a weight between ' + U.fmtIn('load', L.liftKg[0]) + ' and ' + U.fmtIn('load', L.liftKg[1]) + '.', short: U.fmtIn('load', L.liftKg[0]) + ' – ' + U.fmtIn('load', L.liftKg[1]) });
    if (has(v.exMin) && (v.exMin < L.exMin[0] || v.exMin > L.exMin[1])) out.push({ key: 'exMin', msg: 'Minutes must be between 0 and 600.', short: '0–600 min' });
    return out;
  };
})();
