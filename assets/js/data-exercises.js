/* Mizan — exercise library and workout plan builder.
   Programming follows: WHO 2020 activity guidelines; ≥10 weekly sets per muscle for growth
   (Schoenfeld 2017); each muscle ~2×/week (Schoenfeld 2016); effort near failure with 1–3 reps
   in reserve; longer rests on big lifts (Schoenfeld 2016); youth: 1–2 sets of 10–15, supervised (NSCA). */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  /* equip: 0 = bodyweight/home, 1 = dumbbells, 2 = full gym */
  var EX = [
    // Squat pattern
    { id: 'bw-squat', name: 'Bodyweight squat', pat: 'squat', eq: 0, lvl: 0, cues: ['Feet shoulder-width, toes slightly out', 'Sit down between your heels, chest up', 'Knees follow your toes; stand tall at the top'] },
    { id: 'pause-squat', name: 'Pause squat (bodyweight)', pat: 'squat', eq: 0, lvl: 1, cues: ['Squat down and hold 2 seconds at the bottom', 'Stay tight — don’t relax at the bottom', 'Drive up through the whole foot'] },
    { id: 'goblet-squat', name: 'Goblet squat', pat: 'squat', eq: 1, lvl: 0, cues: ['Hold one dumbbell at your chest', 'Elbows inside the knees at the bottom', 'Keep the weight over mid-foot'] },
    { id: 'back-squat', name: 'Barbell back squat', pat: 'squat', eq: 2, lvl: 1, cues: ['Bar on upper back, brace your belly', 'Hips and knees bend together', 'Depth you can control with a neutral back'] },
    { id: 'leg-press', name: 'Leg press', pat: 'squat', eq: 2, lvl: 0, cues: ['Feet mid-platform, shoulder-width', 'Lower until hips start to tuck, then stop', 'Don’t lock the knees hard at the top'] },
    // Hinge
    { id: 'glute-bridge', name: 'Glute bridge', pat: 'hinge', eq: 0, lvl: 0, cues: ['Lie on your back, feet flat, knees bent', 'Push through heels, lift hips to a straight line', 'Squeeze glutes 1 second at the top'] },
    { id: 'sl-bridge', name: 'Single-leg glute bridge', pat: 'hinge', eq: 0, lvl: 1, cues: ['One foot on the floor, other leg straight', 'Keep hips level as you lift', 'Slow on the way down'] },
    { id: 'backpack-rdl', name: 'Backpack Romanian deadlift', pat: 'hinge', eq: 0, lvl: 0, cues: ['Hold a backpack filled with books', 'Push hips back, slight knee bend, flat back', 'Stop when you feel the hamstrings stretch'] },
    { id: 'db-rdl', name: 'Dumbbell Romanian deadlift', pat: 'hinge', eq: 1, lvl: 0, cues: ['Dumbbells slide down the front of your thighs', 'Hips back, back flat, knees soft', 'Stand up by squeezing your glutes'] },
    { id: 'db-hip-thrust', name: 'Dumbbell hip thrust', pat: 'hinge', eq: 1, lvl: 0, cues: ['Upper back on a bench or bed edge', 'Dumbbell across your hips', 'Chin tucked, ribs down, lift to a straight line'] },
    { id: 'bb-rdl', name: 'Barbell Romanian deadlift', pat: 'hinge', eq: 2, lvl: 1, cues: ['Bar close to the legs the whole time', 'Push hips back until hamstrings are tight', 'Neutral spine — no rounding'] },
    { id: 'deadlift', name: 'Deadlift', pat: 'hinge', eq: 2, lvl: 1, cues: ['Bar over mid-foot, grip just outside knees', 'Brace, pull the slack out, push the floor away', 'Lock out with glutes, not by leaning back'] },
    // Lunge / single leg
    { id: 'reverse-lunge', name: 'Reverse lunge', pat: 'lunge', eq: 0, lvl: 0, cues: ['Step back, lower the back knee toward the floor', 'Front knee stays over the foot', 'Push through the front heel to stand'] },
    { id: 'step-up', name: 'Step-up (stairs or sturdy chair)', pat: 'lunge', eq: 0, lvl: 0, cues: ['Whole foot on the step', 'Drive through the top leg — don’t push off the bottom one', 'Control the way down'] },
    { id: 'split-squat', name: 'Bulgarian split squat', pat: 'lunge', eq: 0, lvl: 1, cues: ['Back foot on a bench or bed', 'Drop straight down', 'Lean slightly forward for more glute work'] },
    { id: 'db-lunge', name: 'Dumbbell reverse lunge', pat: 'lunge', eq: 1, lvl: 0, cues: ['Dumbbells at your sides', 'Step back and lower with control', 'Keep your torso tall'] },
    { id: 'walking-lunge', name: 'Walking lunge', pat: 'lunge', eq: 2, lvl: 1, cues: ['Long, controlled steps', 'Back knee close to the floor', 'Hold dumbbells when bodyweight is easy'] },
    // Horizontal push
    { id: 'incline-pushup', name: 'Incline push-up', pat: 'hpush', eq: 0, lvl: 0, cues: ['Hands on a table, bench or wall', 'Body in one straight line', 'Lower your chest to the edge, then press'] },
    { id: 'pushup', name: 'Push-up', pat: 'hpush', eq: 0, lvl: 1, cues: ['Hands under shoulders, core tight', 'Elbows about 45° from your body', 'Chest to a fist-height above the floor'] },
    { id: 'db-press', name: 'Dumbbell floor or bench press', pat: 'hpush', eq: 1, lvl: 0, cues: ['Shoulder blades squeezed together', 'Lower to chest level with control', 'Press up and slightly in'] },
    { id: 'bench-press', name: 'Bench press', pat: 'hpush', eq: 2, lvl: 1, cues: ['Eyes under the bar, feet planted', 'Touch the lower chest, elbows tucked a little', 'Always use a spotter or safety arms'] },
    { id: 'incline-db', name: 'Incline dumbbell press', pat: 'hpush', eq: 1, lvl: 1, cues: ['Bench at 20–30°', 'Lower to upper chest', 'Press without flaring the elbows'] },
    // Vertical push
    { id: 'pike-pushup', name: 'Pike push-up', pat: 'vpush', eq: 0, lvl: 1, cues: ['Hips high, body in an upside-down V', 'Lower the top of your head toward the floor', 'Press back up'] },
    { id: 'wall-press', name: 'Wall-supported shoulder taps', pat: 'vpush', eq: 0, lvl: 0, cues: ['High plank with hands on a wall or table', 'Tap opposite shoulder without twisting', 'Keep hips still'] },
    { id: 'db-ohp', name: 'Dumbbell shoulder press', pat: 'vpush', eq: 1, lvl: 0, cues: ['Seated or standing, core braced', 'Dumbbells at ear height', 'Press up without arching your back'] },
    { id: 'ohp', name: 'Overhead press', pat: 'vpush', eq: 2, lvl: 1, cues: ['Bar at the collarbones', 'Squeeze glutes, press straight up', 'Head through at the top'] },
    // Horizontal pull
    { id: 'backpack-row', name: 'Backpack bent-over row', pat: 'hpull', eq: 0, lvl: 0, cues: ['Hinge forward, back flat', 'Pull the backpack to your belly', 'Squeeze shoulder blades, lower slowly'] },
    { id: 'towel-row', name: 'Door-frame towel row', pat: 'hpull', eq: 0, lvl: 0, cues: ['Loop a towel around a solid door frame', 'Lean back, arms straight, body straight', 'Pull your chest toward the frame'] },
    { id: 'db-row', name: 'One-arm dumbbell row', pat: 'hpull', eq: 1, lvl: 0, cues: ['Hand and knee on a bench', 'Pull the dumbbell toward your hip', 'Don’t twist the torso'] },
    { id: 'cable-row', name: 'Seated cable row', pat: 'hpull', eq: 2, lvl: 0, cues: ['Sit tall, slight knee bend', 'Pull the handle to your lower ribs', 'Let shoulders reach forward on the return'] },
    // Vertical pull
    { id: 'prone-y', name: 'Prone Y-raise', pat: 'vpull', eq: 0, lvl: 0, cues: ['Lie face down, arms overhead in a Y', 'Lift arms by squeezing upper back', 'Thumbs up, neck relaxed'] },
    { id: 'pullup', name: 'Pull-up or chin-up (bar)', pat: 'vpull', eq: 1, lvl: 1, cues: ['Start from a dead hang', 'Pull elbows down toward your ribs', 'Use a band or slow negatives if you can’t do one yet'] },
    { id: 'lat-pulldown', name: 'Lat pulldown', pat: 'vpull', eq: 2, lvl: 0, cues: ['Grip a little wider than shoulders', 'Pull the bar to your upper chest', 'Control it back up'] },
    // Core
    { id: 'plank', name: 'Plank', pat: 'core', eq: 0, lvl: 0, unit: 's', cues: ['Elbows under shoulders', 'Squeeze glutes, ribs down', 'Breathe — don’t hold your breath'] },
    { id: 'dead-bug', name: 'Dead bug', pat: 'core', eq: 0, lvl: 0, cues: ['Lower back pressed into the floor', 'Extend opposite arm and leg slowly', 'Stop before your back lifts'] },
    { id: 'side-plank', name: 'Side plank', pat: 'core', eq: 0, lvl: 0, unit: 's', cues: ['Elbow under shoulder', 'Hips high, body straight', 'Start from knees if needed'] },
    { id: 'bird-dog', name: 'Bird dog', pat: 'core', eq: 0, lvl: 0, cues: ['On hands and knees', 'Reach opposite arm and leg long', 'Keep hips level — pretend there’s a cup on your back'] },
    { id: 'hollow', name: 'Hollow hold', pat: 'core', eq: 0, lvl: 1, unit: 's', cues: ['Lower back glued to the floor', 'Arms and legs extended, low', 'Bend knees to make it easier'] },
    // Calves & arms
    { id: 'calf-raise', name: 'Calf raise', pat: 'calf', eq: 0, lvl: 0, cues: ['On a step edge if you have one', 'Full stretch at the bottom', 'Pause at the top'] },
    { id: 'db-curl', name: 'Dumbbell curl', pat: 'curl', eq: 1, lvl: 0, cues: ['Elbows by your sides', 'Curl without swinging', 'Lower slowly'] },
    { id: 'backpack-curl', name: 'Backpack curl', pat: 'curl', eq: 0, lvl: 0, cues: ['Hold the backpack by the straps', 'Elbows still', 'Slow on the way down'] },
    { id: 'bench-dip', name: 'Bench dip', pat: 'tri', eq: 0, lvl: 0, cues: ['Hands on a sturdy chair behind you', 'Lower until elbows are about 90°', 'Keep shoulders away from ears'] },
    { id: 'db-ext', name: 'Overhead triceps extension', pat: 'tri', eq: 1, lvl: 0, cues: ['One dumbbell held with both hands overhead', 'Lower behind your head', 'Elbows point forward'] },
    { id: 'lateral-raise', name: 'Lateral raise', pat: 'lat', eq: 1, lvl: 0, cues: ['Slight bend in the elbows', 'Raise to shoulder height', 'Lead with the elbows, not the hands'] },
    { id: 'leg-curl', name: 'Lying or seated leg curl', pat: 'hamcurl', eq: 2, lvl: 0, cues: ['Pad just above the heels', 'Curl fully, pause', 'Slow on the way back'] }
  ];
  var BY_ID = {};
  EX.forEach(function (e) { BY_ID[e.id] = e; });
  M.EXERCISES = EX;
  M.exercise = function (id) { return BY_ID[id]; };

  var EQUIP = { none: 0, dumbbells: 1, gym: 2 };
  M.EQUIPMENT = [
    { id: 'none', label: 'No equipment', desc: 'Bodyweight, a backpack, stairs, a chair — perfect for the park or home.' },
    { id: 'dumbbells', label: 'Dumbbells at home', desc: 'A pair of adjustable dumbbells and a bench or sturdy bed.' },
    { id: 'gym', label: 'Full gym', desc: 'Barbells, machines and cables.' }
  ];

  /* pick the best exercise for a pattern given equipment level and experience;
     prefers the most "specific" equipment available, falls back to bodyweight */
  function choose(pat, eqLevel, lvl, variant) {
    var cands = EX.filter(function (e) { return e.pat === pat && e.eq <= eqLevel && e.lvl <= lvl; });
    if (!cands.length) cands = EX.filter(function (e) { return e.pat === pat && e.eq <= eqLevel; });
    if (!cands.length) return null;
    cands.sort(function (a, b) { return (b.eq - a.eq) || (b.lvl - a.lvl); });
    return cands[Math.min(variant || 0, cands.length - 1)];
  }

  var SPLITS = {
    2: [['Full body A', ['squat', 'hpush', 'hpull', 'hinge', 'core', 'lunge', 'calf']], ['Full body B', ['hinge', 'vpush', 'vpull', 'lunge', 'core', 'squat', 'curl']]],
    3: [['Full body A', ['squat', 'hpush', 'hpull', 'hinge', 'core', 'calf', 'curl']], ['Full body B', ['hinge', 'vpush', 'vpull', 'lunge', 'core', 'tri', 'lat']], ['Full body C', ['lunge', 'hpush', 'hpull', 'squat', 'core', 'hinge', 'calf']]],
    4: [['Upper A', ['hpush', 'hpull', 'vpush', 'vpull', 'curl', 'tri', 'lat']], ['Lower A', ['squat', 'hinge', 'lunge', 'calf', 'core', 'hamcurl']], ['Upper B', ['vpush', 'vpull', 'hpush', 'hpull', 'lat', 'curl', 'tri']], ['Lower B', ['hinge', 'squat', 'lunge', 'hamcurl', 'core', 'calf']]],
    5: [['Upper A', ['hpush', 'hpull', 'vpush', 'vpull', 'curl', 'tri']], ['Lower A', ['squat', 'hinge', 'lunge', 'calf', 'core']], ['Push', ['hpush', 'vpush', 'lat', 'tri', 'core']], ['Pull', ['vpull', 'hpull', 'curl', 'core', 'hinge']], ['Legs', ['hinge', 'squat', 'lunge', 'hamcurl', 'calf']]],
    6: [['Push A', ['hpush', 'vpush', 'lat', 'tri', 'core']], ['Pull A', ['vpull', 'hpull', 'curl', 'core']], ['Legs A', ['squat', 'hinge', 'lunge', 'calf', 'core']], ['Push B', ['vpush', 'hpush', 'lat', 'tri']], ['Pull B', ['hpull', 'vpull', 'curl', 'core']], ['Legs B', ['hinge', 'squat', 'lunge', 'hamcurl', 'calf']]]
  };
  var DAY_SPREAD = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };
  var BIG = { squat: 1, hinge: 1, hpush: 1, hpull: 1, vpush: 1, vpull: 1, lunge: 1 };

  /* opts: { goal: lose|maintain|gain|strength|health, experience: beginner|intermediate, equipment, days, minutes, age } */
  M.buildWorkoutPlan = function (o) {
    var days = M.clamp(o.days || 3, 2, 6);
    var minor = o.age !== null && o.age !== undefined && o.age < 18;
    var inter = o.experience === 'intermediate' && !minor;
    var eqLevel = EQUIP[o.equipment] !== undefined ? EQUIP[o.equipment] : 0;
    var lvl = inter ? 1 : 0;
    var nEx = o.minutes <= 30 ? 4 : o.minutes <= 45 ? 5 : o.minutes <= 60 ? 6 : 7;
    var split = SPLITS[days];
    var sessions = split.map(function (s, si) {
      var used = {};
      var list = [];
      s[1].forEach(function (pat, pi) {
        if (list.length >= nEx) return;
        var variant = (si + (used[pat] || 0)) % 2;
        var ex = choose(pat, eqLevel, lvl, variant);
        if (!ex || list.some(function (x) { return x.ex === ex.id; })) ex = choose(pat, eqLevel, lvl, 1 - variant);
        if (!ex || list.some(function (x) { return x.ex === ex.id; })) return;
        used[pat] = (used[pat] || 0) + 1;
        var big = !!BIG[pat] && pi < 4;
        var rx = prescription(o.goal, inter, minor, big, ex);
        list.push({ ex: ex.id, sets: rx.sets, reps: rx.reps, rest: rx.rest, rir: rx.rir });
      });
      return { name: s[0], items: list };
    });
    var cardio;
    if (o.goal === 'lose') cardio = 'Walk 7,000–10,000 steps a day, plus 20–30 minutes of easy cardio (you can talk in full sentences) on 2–3 non-lifting days.';
    else if (o.goal === 'gain') cardio = 'Keep 6,000–8,000 daily steps for health. Hard cardio can stay light while you focus on lifting and eating enough.';
    else if (minor) cardio = 'Aim for about 60 minutes of activity every day — sport, cycling, running, games — with vigorous play on at least 3 days.';
    else cardio = 'Add up to 150–300 minutes a week of moderate cardio (brisk walking, cycling, swimming), split however you like.';
    var warmup = '5 minutes of easy movement (brisk walk, skipping, marching), then leg swings, arm circles and hip circles. Do 1–2 lighter practice sets of your first exercise.';
    var progression = minor
      ? 'Master the form first. When you can do all sets with 15 clean reps, make the exercise a bit harder (slower tempo, harder variation or a little more weight) — with an adult or coach checking your technique.'
      : 'Use double progression: when you hit the top of the rep range on every set with good form, add a little weight (or a harder variation) next time and work back up.';
    return {
      created: M.today(), settings: o, sessions: sessions,
      days: DAY_SPREAD[days].slice(), cardio: cardio, warmup: warmup, progression: progression, minor: minor
    };
  };

  function prescription(goal, inter, minor, big, ex) {
    if (minor) return { sets: big ? 2 : 1, reps: ex.unit === 's' ? '20–30 s' : '10–15', rest: 'about 1 min', rir: '3+' };
    if (ex.unit === 's') return { sets: inter ? 3 : 2, reps: inter ? '30–45 s' : '20–30 s', rest: '45 s', rir: '—' };
    if (goal === 'strength' && big) return { sets: inter ? 4 : 3, reps: inter ? '4–6' : '6–8', rest: '2–3 min', rir: '2' };
    if (big) return { sets: inter ? 3 : 2, reps: goal === 'gain' ? '6–12' : '8–12', rest: '2–3 min', rir: inter ? '1–2' : '2–3' };
    return { sets: inter ? 3 : 2, reps: '10–15', rest: '60–90 s', rir: inter ? '1–2' : '2–3' };
  }
})();
