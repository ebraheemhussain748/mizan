/* Mizan — exercise library and workout plan builder (v3.1).

   Library: ~230 practical exercises, screened from the open free-exercise-db (876 exercises, public domain)
   and wger (872, CC-BY-SA) databases and arranged as easier → harder ladders per movement pattern.
   Difficulty 1–10 uses measured loads where they exist: push-ups lift ~41% of body weight with hands
   61 cm up, 49% on the knees, 64% standard, 70–74% feet-up (Ebben 2011, Suprak 2011); inverted rows
   ~37–79% from 30° to 75° (Gulmez 2017); the front leg carries ~85% in a Bulgarian split squat.

   Programming: intensity changes the EXERCISES and the session format, not just the reps —
   Low = easier variations, straight sets, 3–4 reps in reserve; Medium = standard variations, supersets
   for accessories (≈ 30–37% less time, same results: Zhang/Weakley 2025 meta-analysis);
   High = harder variations (one leg/arm, pauses, more leverage), power moves, supersets or circuits,
   an interval finisher and, for experienced adults, one intensifier set (drop sets / rest-pause give
   similar growth in less time: Sødal 2023). Bodyweight progressions build muscle and strength like
   weights when sets end near failure (Kikuchi 2017, Kotarsky 2018). ≥10 hard sets per muscle per week
   for growth, each muscle twice a week, 2–3 reps in reserve is enough (ACSM 2026 position stand).
   Teens (NSCA 2009, Lloyd 2014): technique first, ≥2 reps in reserve, no drop sets, limited jumps,
   strength on 2–3 non-consecutive days. Calories use the 2024 Adult Compendium of Physical Activities. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  /* [id, name, pattern, equipment (0 none · 1 dumbbells · 2 gym), difficulty 1–10, flags, cues]
     flags: u one side at a time · s timed hold · j1 small jumps · j2 big jumps · K knee-heavy ·
            B loads the lower back · S shoulder-heavy · bar needs a pull-up bar · band needs a band ·
            L trains the muscle at a long length · T slow tempo · P pause · H uses household items ·
            pow power/explosive · up upper body · e/r/l/f/c core type (extension, rotation, lateral, flexion, carry) */
  var RAW = [
    // ---------------- Squat (knee-dominant) ----------------
    ['chair-squat', 'Sit-to-stand from a chair', 'squat', 0, 1, 'H', 'Sit on the front half of a sturdy chair, feet flat|Lean forward and stand up without using your hands|Sit back down slowly — touch, don’t drop'],
    ['bw-squat', 'Bodyweight squat', 'squat', 0, 2, '', 'Feet shoulder-width, toes slightly out|Sit down between your heels, chest up|Knees follow your toes; stand tall at the top'],
    ['wall-sit', 'Wall sit', 'squat', 0, 2, 's H', 'Back flat on a wall, slide down until knees are about 90°|Knees over ankles, weight in your heels|Breathe; stand up if your knees hurt'],
    ['tempo-squat', 'Slow squat (3 s down)', 'squat', 0, 3, 'T', 'Take 3 full seconds to lower|Pause for a moment at the bottom|Stand up at normal speed'],
    ['pause-squat', 'Pause squat (bodyweight)', 'squat', 0, 3, 'P', 'Squat down and hold 2 seconds at the bottom|Stay tight — don’t relax at the bottom|Drive up through the whole foot'],
    ['backpack-squat', 'Backpack squat', 'squat', 0, 3, 'H', 'Wear a backpack filled with books or water bottles|Squat as deep as you can control|Chest up, weight over the middle of your foot'],
    ['one-half-squat', '1½ squat', 'squat', 0, 4, '', 'Squat all the way down, come halfway up|Go back to the bottom|Then stand all the way up — that’s one rep'],
    ['assisted-pistol', 'Assisted pistol squat (hold a door frame)', 'squat', 0, 5, 'u K H', 'Stand on one leg, other leg out in front|Hold a door frame and lower slowly on one leg|Use your arms only as much as you need'],
    ['box-pistol', 'One-leg squat to a chair', 'squat', 0, 6, 'u K H', 'Stand in front of a chair on one leg|Lower until you sit lightly on the chair|Stand back up on the same leg without rocking'],
    ['shrimp-squat', 'Shrimp squat', 'squat', 0, 7, 'u K', 'Hold one foot behind you|Lower the back knee to a cushion on the floor|Drive up through the front heel'],
    ['pistol', 'Pistol squat', 'squat', 0, 8, 'u K', 'Arms forward, free leg straight out|Sit down slowly on one leg, heel flat|Stand up without the knee caving in'],
    ['goblet-box-squat', 'Goblet squat to a chair', 'squat', 1, 2, '', 'Hold one dumbbell at your chest|Sit back until you touch the chair, then stand|Keep the weight close to your body'],
    ['goblet-squat', 'Goblet squat', 'squat', 1, 3, '', 'Hold one dumbbell at your chest|Elbows inside the knees at the bottom|Keep the weight over mid-foot'],
    ['db-squat', 'Dumbbell squat (dumbbells on shoulders)', 'squat', 1, 4, '', 'Rest a dumbbell on each shoulder|Squat down with your chest up|Push the floor away to stand'],
    ['heel-goblet', 'Heels-raised goblet squat', 'squat', 1, 4, 'K', 'Heels on a thin book or weight plate|Lets the knees travel forward — more front-thigh work|Go slowly at the bottom'],
    ['goblet-pause', 'Goblet squat with a 3-second pause', 'squat', 1, 5, 'P', 'Lower with control|Hold 3 seconds at the bottom, staying tight|Stand up strongly'],
    ['leg-press', 'Leg press', 'squat', 2, 2, '', 'Feet mid-platform, shoulder-width|Lower until your hips start to tuck, then stop|Don’t lock the knees hard at the top'],
    ['hack-squat', 'Hack squat (machine)', 'squat', 2, 3, 'K', 'Shoulders under the pads, feet mid-platform|Lower until thighs are at least parallel|Push through the whole foot'],
    ['bb-box-squat', 'Barbell box squat', 'squat', 2, 4, 'B', 'Bar on your upper back, box or bench behind you|Sit back until you touch the box lightly|Stand up without rocking'],
    ['back-squat', 'Barbell back squat', 'squat', 2, 5, 'B', 'Bar on upper back, brace your belly|Hips and knees bend together|Use a rack with safety arms'],
    ['front-squat', 'Front squat', 'squat', 2, 6, 'B', 'Bar on the front of your shoulders, elbows high|Sit straight down, chest up|Use a rack with safety arms'],
    ['pause-back-squat', 'Pause back squat', 'squat', 2, 7, 'B P', 'Lighter than your normal squat|Hold 2 seconds at the bottom without bouncing|Drive up hard; safety arms set'],

    // ---------------- Hinge (hip-dominant) ----------------
    ['glute-bridge', 'Glute bridge', 'hinge', 0, 1, '', 'Lie on your back, feet flat, knees bent|Push through heels, lift hips to a straight line|Squeeze glutes 1 second at the top'],
    ['march-bridge', 'Marching glute bridge', 'hinge', 0, 2, '', 'Hold a bridge with hips level|Lift one foot a little, then the other|Don’t let the hips drop or twist'],
    ['sl-bridge', 'Single-leg glute bridge', 'hinge', 0, 3, 'u', 'One foot on the floor, other leg straight|Keep hips level as you lift|Slow on the way down'],
    ['couch-thrust', 'Hip thrust (shoulders on a sofa)', 'hinge', 0, 3, 'H', 'Upper back on the sofa edge, feet flat|Lift hips until your body is flat like a table|Chin tucked; squeeze glutes at the top'],
    ['backpack-rdl', 'Backpack Romanian deadlift', 'hinge', 0, 3, 'H', 'Hold a backpack filled with books|Push hips back, slight knee bend, flat back|Stop when you feel the hamstrings stretch'],
    ['sl-thrust', 'Single-leg hip thrust (shoulders on a sofa)', 'hinge', 0, 4, 'u H', 'One foot down, the other knee pulled in|Lift until hips are level and straight|Don’t let the hips twist'],
    ['bw-sl-rdl', 'Single-leg Romanian deadlift', 'hinge', 0, 4, 'u', 'Stand on one leg, slight knee bend|Tip forward from the hips, back leg reaching back|Touch a wall at first if you wobble'],
    ['db-rdl', 'Dumbbell Romanian deadlift', 'hinge', 1, 3, 'L B', 'Dumbbells slide down the front of your thighs|Hips back, back flat, knees soft|Stand up by squeezing your glutes'],
    ['db-hip-thrust', 'Dumbbell hip thrust', 'hinge', 1, 3, '', 'Upper back on a bench or bed edge|Dumbbell across your hips|Chin tucked, ribs down, lift to a straight line'],
    ['db-kickstand-rdl', 'Dumbbell kickstand RDL', 'hinge', 1, 4, 'u L', 'Back toe on the floor just for balance|Most of your weight on the front leg|Hinge until you feel a stretch'],
    ['db-sl-rdl', 'Dumbbell single-leg RDL', 'hinge', 1, 5, 'u L', 'Dumbbell in the hand opposite the standing leg|Hips stay square to the floor|Slow down, strong up'],
    ['db-sl-thrust', 'Dumbbell single-leg hip thrust', 'hinge', 1, 5, 'u', 'Dumbbell on the working hip|Drive through the heel|Pause 1 second at the top'],
    ['pull-through', 'Cable pull-through', 'hinge', 2, 2, '', 'Face away from a low cable, rope between your legs|Push hips back, then snap them forward|Arms just hold — hips do the work'],
    ['back-ext', '45° back extension', 'hinge', 2, 3, 'B', 'Pad just below your hip bones, body straight|Lower by bending at the hips|Lift until straight — don’t over-arch'],
    ['trap-deadlift', 'Trap-bar deadlift', 'hinge', 2, 4, 'B', 'Stand in the middle of the bar|Brace, then push the floor away|Stand tall; lower with control'],
    ['bb-thrust', 'Barbell hip thrust', 'hinge', 2, 4, '', 'Upper back on a bench, padded bar over your hips|Lift to a flat body line|Pause and squeeze at the top'],
    ['bb-rdl', 'Barbell Romanian deadlift', 'hinge', 2, 5, 'B L', 'Bar close to the legs the whole time|Push hips back until hamstrings are tight|Neutral spine — no rounding'],
    ['deadlift', 'Deadlift', 'hinge', 2, 6, 'B', 'Bar over mid-foot, grip just outside knees|Brace, pull the slack out, push the floor away|Lock out with glutes, not by leaning back'],

    // ---------------- Lunge / single leg ----------------
    ['supported-split', 'Split squat holding a chair', 'lunge', 0, 2, 'u H', 'Long stance, hold a chair for balance|Drop the back knee straight down|Push up through the front foot'],
    ['step-up', 'Step-up (stairs or sturdy chair)', 'lunge', 0, 2, 'u H', 'Whole foot on the step|Drive through the top leg — don’t push off the bottom one|Control the way down'],
    ['reverse-lunge', 'Reverse lunge', 'lunge', 0, 3, 'u', 'Step back, lower the back knee toward the floor|Front knee stays over the foot|Push through the front heel to stand'],
    ['static-split', 'Split squat', 'lunge', 0, 3, 'u', 'Long stance, feet hip-width apart|Lower the back knee close to the floor|Torso tall, front heel down'],
    ['lateral-lunge', 'Side lunge', 'lunge', 0, 4, 'u', 'Step wide to one side and sit back into that hip|The other leg stays straight|Push back to the start'],
    ['walking-lunge', 'Walking lunge', 'lunge', 0, 4, 'u', 'Long, controlled steps|Back knee close to the floor|Stay tall; slow down if you wobble'],
    ['deficit-lunge', 'Deficit reverse lunge (front foot on a step)', 'lunge', 0, 5, 'u L H', 'Front foot on a low step or thick book|Step back and sink deeper than usual|Drive up through the front heel'],
    ['high-step-up', 'High step-up (knee-height)', 'lunge', 0, 5, 'u H', 'Step about knee-height, sturdy and still|Lean forward and drive through the top heel|Lower slowly — no jumping off'],
    ['split-squat', 'Bulgarian split squat', 'lunge', 0, 5, 'u L H K', 'Back foot on a bench, bed or sofa|Drop straight down; front leg does about 85% of the work|Lean slightly forward for more glute work'],
    ['pause-bss', 'Bulgarian split squat with a 2-second pause', 'lunge', 0, 6, 'u L P H K', 'Back foot up, lower slowly|Hold 2 seconds just above the floor|Stand up without bouncing'],
    ['skater-squat', 'Skater squat', 'lunge', 0, 6, 'u K', 'Stand on one leg, other knee bent behind you|Lower the back knee to a cushion|Arms forward to balance'],
    ['db-lunge', 'Dumbbell reverse lunge', 'lunge', 1, 4, 'u', 'Dumbbells at your sides|Step back and lower with control|Keep your torso tall'],
    ['db-step-up', 'Dumbbell step-up', 'lunge', 1, 4, 'u', 'Dumbbells at your sides|Whole foot on the step|Drive through the top leg only'],
    ['db-split', 'Dumbbell split squat', 'lunge', 1, 4, 'u', 'Dumbbells at your sides, long stance|Lower straight down|Front heel stays planted'],
    ['db-walking-lunge', 'Dumbbell walking lunge', 'lunge', 1, 5, 'u', 'Dumbbells at your sides|Long steps, back knee close to the floor|Stay tall'],
    ['db-lateral-lunge', 'Dumbbell side lunge', 'lunge', 1, 5, 'u', 'Hold one dumbbell at your chest|Step wide and sit back into that hip|Push back to the start'],
    ['db-bss', 'Dumbbell Bulgarian split squat', 'lunge', 1, 6, 'u L K', 'Back foot on a bench, dumbbells at your sides|Drop straight down|Push through the front heel'],
    ['db-deficit-lunge', 'Dumbbell deficit reverse lunge', 'lunge', 1, 6, 'u L', 'Front foot on a low step|Step back and sink deep|Drive up through the front heel'],

    // ---------------- Front thighs (isolation) ----------------
    ['leg-extension', 'Leg extension (machine)', 'quad', 2, 2, '', 'Pad on your lower shins|Straighten the knees fully, squeeze|Lower slowly'],
    ['sissy-squat', 'Sissy squat (hold a door frame)', 'quad', 0, 6, 'K L H', 'Hold a door frame, rise onto your toes|Lean back as your knees go forward|Only as deep as feels good for your knees'],

    // ---------------- Horizontal push ----------------
    ['wall-pushup', 'Wall push-up', 'hpush', 0, 1, '', 'Hands on a wall at chest height|Body straight from head to heels|Bring your chest to the wall, then push away'],
    ['incline-pushup', 'Incline push-up', 'hpush', 0, 2, 'H', 'Hands on a table, bench or sturdy chair|Body in one straight line|Lower your chest to the edge, then press'],
    ['knee-pushup', 'Knee push-up', 'hpush', 0, 3, '', 'Knees down, body straight from knees to head|Lower your chest close to the floor|Elbows about 45° from your body'],
    ['pushup', 'Push-up', 'hpush', 0, 4, '', 'Hands under shoulders, core tight|Elbows about 45° from your body|Chest to a fist-height above the floor'],
    ['tempo-pushup', 'Slow push-up (3 s down)', 'hpush', 0, 5, 'T', 'Take 3 full seconds to lower|Pause just above the floor|Press up at normal speed'],
    ['deficit-pushup', 'Deficit push-up (hands on books)', 'hpush', 0, 5, 'L H S', 'Hands on two stacks of books|Lower your chest below your hands|A bigger stretch for the chest'],
    ['decline-pushup', 'Feet-up push-up', 'hpush', 0, 5, 'H', 'Feet on a step or chair|Body straight — don’t let the hips sag|Lower your chest to the floor'],
    ['diamond-pushup', 'Close-hand push-up', 'hpush', 0, 6, '', 'Hands close together under your chest|Elbows brush your sides|More work for the triceps'],
    ['backpack-pushup', 'Backpack push-up', 'hpush', 0, 6, 'H', 'Wear a filled backpack, straps tight|Normal push-up form|Add books to make it harder'],
    ['archer-pushup', 'Archer push-up', 'hpush', 0, 7, 'u', 'Very wide hands|Lower toward one hand; the other arm stays straight|Alternate sides'],
    ['pseudo-planche', 'Pseudo-planche push-up', 'hpush', 0, 8, 'S', 'Hands by your waist, fingers turned out|Lean forward over your hands|Keep the lean as you lower and press'],
    ['one-arm-pushup', 'One-arm push-up', 'hpush', 0, 9, 'u', 'Feet wide, one hand under your chest|Brace hard so your hips don’t twist|Start with hands on a bench'],
    ['db-floor-press', 'Dumbbell floor press', 'hpush', 1, 3, '', 'Lie on the floor, knees bent|Lower until your upper arms touch the floor|Press up and slightly in'],
    ['db-press', 'Dumbbell bench press', 'hpush', 1, 4, 'L', 'Shoulder blades squeezed together|Lower to chest level with control|Press up and slightly in'],
    ['incline-db', 'Incline dumbbell press', 'hpush', 1, 4, 'inc', 'Bench at 20–30°|Lower to the upper chest|Press without flaring the elbows'],
    ['db-tempo-press', 'Dumbbell bench press, 3 s down', 'hpush', 1, 5, 'T L', 'Take 3 seconds to lower|Slight pause at the chest|Press up strongly'],
    ['sa-db-press', 'Single-arm dumbbell bench press', 'hpush', 1, 6, 'u', 'One dumbbell; the other hand on your belly|Don’t let your body roll|Your core works hard too'],
    ['machine-press', 'Chest press machine', 'hpush', 2, 2, '', 'Handles at chest height|Press without locking hard|Slow on the way back'],
    ['bench-press', 'Bench press', 'hpush', 2, 5, '', 'Eyes under the bar, feet planted|Touch the lower chest, elbows tucked a little|Always use a spotter or safety arms'],
    ['incline-bench', 'Incline barbell bench press', 'hpush', 2, 6, '', 'Bench at about 30°|Lower to the upper chest|Safety arms set'],
    ['dips', 'Dips (parallel bars)', 'hpush', 2, 6, 'S bw', 'Lean slightly forward|Lower until shoulders are level with elbows|Stop earlier if shoulders complain'],
    ['pause-bench', 'Pause bench press', 'hpush', 2, 7, 'P', 'Lighter than usual|Hold 1–2 seconds on the chest|Press up hard; use a spotter'],

    // ---------------- Chest (isolation) ----------------
    ['db-fly', 'Dumbbell fly', 'fly', 1, 4, 'L', 'Slight bend in the elbows, like hugging a tree|Lower until you feel a chest stretch|Bring the dumbbells together over your chest'],
    ['cable-fly', 'Cable fly', 'fly', 2, 3, 'L', 'Handles at shoulder height, step forward|Arms open wide with a soft bend|Squeeze together in front of you'],

    // ---------------- Vertical push ----------------
    ['wall-press', 'Wall-supported shoulder taps', 'core', 0, 1, 'r', 'High plank with hands on a wall or table|Tap the opposite shoulder without twisting|Keep hips still'],
    ['backpack-press', 'Backpack overhead press', 'vpush', 0, 3, 'H S', 'Hold a filled backpack at chest height|Press it straight overhead|Ribs down — don’t lean back'],
    ['incline-pike', 'Pike push-up, hands on a chair', 'vpush', 0, 3, 'S H', 'Hands on a sturdy chair, hips high|Lower your head toward the chair|Press back up'],
    ['pike-pushup', 'Pike push-up', 'vpush', 0, 4, 'S', 'Hips high, body in an upside-down V|Lower the top of your head toward the floor|Press back up'],
    ['feet-up-pike', 'Feet-up pike push-up', 'vpush', 0, 6, 'S H', 'Feet on a chair, hips stacked over hands|Lower your head between your hands|Press back up'],
    ['wall-hs-hold', 'Wall handstand hold', 'vpush', 0, 6, 's S', 'Walk your feet up a wall, belly facing it|Arms straight, push the floor away|Come down by walking out — never twist'],
    ['hspu-neg', 'Wall handstand push-up, lowering only', 'vpush', 0, 7, 'S', 'Kick or walk up a wall|Lower your head slowly to a cushion|Come down and start again'],
    ['wall-hspu', 'Wall handstand push-up', 'vpush', 0, 8, 'S', 'Hands just wider than shoulders|Lower your head to a cushion|Press back to straight arms'],
    ['hk-db-press', 'Half-kneeling one-arm dumbbell press', 'vpush', 1, 3, 'u S', 'Kneel on one knee, squeeze that glute|Press the dumbbell up on the kneeling side|Ribs down, no leaning'],
    ['db-ohp', 'Seated dumbbell shoulder press', 'vpush', 1, 4, 'S', 'Back supported, core braced|Dumbbells at ear height|Press up without arching your back'],
    ['standing-db-press', 'Standing dumbbell press', 'vpush', 1, 5, 'S', 'Feet hip-width, glutes tight|Press both dumbbells overhead|Don’t lean back'],
    ['arnold-press', 'Arnold press', 'vpush', 1, 5, 'S', 'Start with palms facing you at chin height|Turn your palms out as you press up|Reverse it on the way down'],
    ['landmine-press', 'Landmine press', 'vpush', 2, 3, 'u', 'One end of the bar in a corner or landmine|Press the other end up and forward|Shoulder-friendly angle'],
    ['machine-shoulder', 'Shoulder press machine', 'vpush', 2, 3, 'S', 'Handles at shoulder height|Press up without locking hard|Lower with control'],
    ['ohp', 'Overhead press', 'vpush', 2, 6, 'S', 'Bar at the collarbones|Squeeze glutes, press straight up|Head through at the top'],

    // ---------------- Horizontal pull ----------------
    ['towel-row', 'Door towel row', 'hpull', 0, 2, 'H', 'Knot a towel and shut the knot in the hinge side of a solid door that opens away from you — lock it|Hold both ends, lean back with straight arms and a straight body|Pull your chest toward the door'],
    ['backpack-row', 'Backpack bent-over row', 'hpull', 0, 2, 'H', 'Hinge forward, back flat|Pull the backpack to your belly|Squeeze shoulder blades, lower slowly'],
    ['backpack-sa-row', 'One-arm backpack row', 'hpull', 0, 3, 'u H', 'Free hand on a chair, back flat|Pull the backpack to your hip|Lower slowly'],
    ['towel-row-steep', 'Door towel row, feet closer', 'hpull', 0, 3, 'H', 'Towel shut in a locked door, as for the door towel row|Walk your feet closer so you lean back more|The more you lean, the harder it is'],
    ['towel-row-pause', 'Door towel row with a 2-second squeeze', 'hpull', 0, 4, 'P H', 'Towel shut in a locked door; lean back as far as you can control|Hold 2 seconds at the top|Lower slowly'],
    ['table-row', 'Under-table row', 'hpull', 0, 5, 'H', 'Only under a heavy, solid table that can’t tip|Lie under it, grip the edge|Pull your chest to the table, body straight'],
    ['db-row', 'One-arm dumbbell row', 'hpull', 1, 3, 'u', 'Hand and knee on a bench|Pull the dumbbell toward your hip|Don’t twist the torso'],
    ['chest-sup-row', 'Chest-supported dumbbell row', 'hpull', 1, 3, 'inc', 'Lie chest-down on an incline bench|Pull both dumbbells to your ribs|Easy on the lower back'],
    ['bent-db-row', 'Bent-over dumbbell row', 'hpull', 1, 5, 'B', 'Hinge forward, back flat|Pull both dumbbells to your belly|Pause, then lower slowly'],
    ['db-row-pause', 'One-arm dumbbell row with a 2-second squeeze', 'hpull', 1, 5, 'u P', 'Pull to your hip|Hold 2 seconds with the shoulder blade back|Lower slowly to a full stretch'],
    ['cable-row', 'Seated cable row', 'hpull', 2, 2, 'L', 'Sit tall, slight knee bend|Pull the handle to your lower ribs|Let shoulders reach forward on the return'],
    ['machine-row', 'Chest-supported machine row', 'hpull', 2, 3, '', 'Chest on the pad|Pull elbows back past your body|Slow on the way out'],
    ['sa-cable-row', 'One-arm cable row', 'hpull', 2, 4, 'u L', 'Reach forward to a full stretch|Pull your elbow back to your hip|Keep your chest facing forward'],
    ['inverted-row', 'Inverted row (low bar or rings)', 'hpull', 2, 4, 'bw', 'Hang under a low bar, body straight|Pull your chest to the bar|Lower the bar or walk your feet in to make it easier'],
    ['feet-up-row', 'Feet-up inverted row', 'hpull', 2, 6, 'bw', 'Feet on a bench, body straight|Pull your chest to the bar|Lower slowly'],
    ['bb-row', 'Barbell bent-over row', 'hpull', 2, 6, 'B', 'Hinge forward, back flat|Pull the bar to your belly|No jerking'],
    ['archer-row', 'Archer row (rings or low bar)', 'hpull', 2, 8, 'u bw', 'Wide grip, pull toward one hand|The other arm stays almost straight|Alternate sides'],

    // ---------------- Vertical pull ----------------
    ['prone-y', 'Prone Y-raise', 'vpull', 0, 1, '', 'Lie face down, arms overhead in a Y|Lift arms by squeezing your upper back|Thumbs up, neck relaxed'],
    ['prone-w', 'Prone W-raise', 'vpull', 0, 2, '', 'Lie face down, elbows bent like a W|Squeeze your shoulder blades down and back|Hold 2 seconds each rep'],
    ['backpack-pullover', 'Lying backpack pullover', 'vpull', 0, 3, 'L H S', 'Lie on your back holding a backpack over your chest|Lower it behind your head with arms almost straight|Pull it back over your chest with your lats'],
    ['towel-face-pull', 'Door towel face pull', 'rear', 0, 3, 'H', 'Towel shut in a locked door at chest height|Lean back and pull your hands to your face|Elbows high, squeeze the upper back'],
    ['dead-hang', 'Dead hang', 'vpull', 0, 2, 's bar', 'Hang from the bar, arms straight|Shoulders gently pulled down|Builds grip for pull-ups'],
    ['scap-pull', 'Scapular pull-up', 'vpull', 0, 2, 'bar', 'Hang with straight arms|Pull your shoulders down without bending the elbows|Hold 1 second, relax up'],
    ['band-pullup', 'Band-assisted pull-up', 'vpull', 0, 4, 'bar band', 'Loop a band over the bar, knee or foot in it|Pull your chest toward the bar|Thinner band as you get stronger'],
    ['feet-pullup', 'Feet-assisted pull-up (feet on a chair)', 'vpull', 0, 4, 'bar H', 'Chair under the bar, feet on it|Pull with your arms, push with your legs as needed|Use less leg each week'],
    ['flexed-hang', 'Flexed-arm hang', 'vpull', 0, 4, 's bar', 'Start with your chin over the bar (step up)|Hold as long as you can with control|Lower slowly at the end'],
    ['pullup-neg', 'Pull-up negatives (lowering only)', 'vpull', 0, 5, 'bar', 'Step up so your chin is over the bar|Lower yourself over 3–5 seconds|Step up again — no jumping down'],
    ['chinup', 'Chin-up (palms facing you)', 'vpull', 0, 6, 'bar', 'Shoulder-width grip, palms toward you|Pull until your chin passes the bar|Lower all the way'],
    ['pullup', 'Pull-up', 'vpull', 0, 7, 'bar', 'Start from a dead hang|Pull elbows down toward your ribs|Lower all the way each rep'],
    ['archer-pullup', 'Archer pull-up', 'vpull', 0, 8, 'u bar', 'Wide grip|Pull toward one hand, the other arm nearly straight|Alternate sides'],
    ['db-pullover', 'Dumbbell pullover', 'vpull', 1, 3, 'L S', 'Lie across a bench holding one dumbbell over your chest|Lower it behind your head, arms nearly straight|Pull it back over your chest'],
    ['lat-pulldown', 'Lat pulldown', 'vpull', 2, 3, '', 'Grip a little wider than shoulders|Pull the bar to your upper chest|Control it back up'],
    ['straight-pulldown', 'Straight-arm cable pulldown', 'vpull', 2, 3, 'L', 'Arms nearly straight, slight hinge|Sweep the bar down to your thighs|Feel the lats stretch on the way up'],
    ['assisted-pullup', 'Assisted pull-up machine', 'vpull', 2, 4, 'bar', 'Knees on the pad|Pull your chin over the bar|Less help each week'],
    ['sa-pulldown', 'One-arm cable pulldown', 'vpull', 2, 4, 'u L', 'Reach up to a full stretch|Pull your elbow down to your side|Don’t lean away'],
    ['weighted-pullup', 'Weighted pull-up', 'vpull', 2, 9, 'bar', 'Dumbbell between your feet or a belt|Full range each rep|Only once 10+ clean pull-ups are easy'],

    // ---------------- Rear shoulders & upper back ----------------
    ['prone-t', 'Prone T-raise', 'rear', 0, 2, '', 'Lie face down, arms out like a T|Lift your arms by squeezing your shoulder blades|Thumbs up, slow'],
    ['band-pull-apart', 'Band pull-apart', 'rear', 0, 2, 'band', 'Hold a band at chest height, arms straight|Pull it apart until it touches your chest|Slow on the way back'],
    ['db-rear-fly', 'Dumbbell rear-delt fly', 'rear', 1, 3, '', 'Hinge forward or lie chest-down on a bench|Raise the dumbbells out to the sides|Light weight, slow'],
    ['face-pull', 'Face pull (cable)', 'rear', 2, 3, '', 'Rope at face height|Pull to your face, elbows high|Squeeze the upper back'],

    // ---------------- Side shoulders ----------------
    ['bottle-lateral', 'Water-bottle lateral raise', 'lat', 0, 2, 'H', 'A full water bottle in each hand|Raise to shoulder height|Lead with the elbows'],
    ['lateral-raise', 'Lateral raise', 'lat', 1, 3, '', 'Slight bend in the elbows|Raise to shoulder height|Lead with the elbows, not the hands'],
    ['lean-lateral', 'Lean-away lateral raise', 'lat', 1, 5, 'u L', 'Hold a door frame and lean away|Raise the dumbbell to shoulder height|Starts the muscle at a longer length'],
    ['cable-lateral', 'Cable lateral raise', 'lat', 2, 4, 'u L', 'Low cable, handle in the far hand|Raise out to shoulder height|Slow on the way down'],

    // ---------------- Biceps ----------------
    ['backpack-curl', 'Backpack curl', 'curl', 0, 2, 'H', 'Hold the backpack by the straps|Elbows still|Slow on the way down'],
    ['band-curl', 'Band curl', 'curl', 0, 3, 'band', 'Stand on the band|Curl up, elbows by your sides|Slow on the way down'],
    ['towel-curl', 'Door towel curl', 'curl', 0, 4, 'H', 'Towel shut in a locked door that opens away from you; lean back|Curl your body up by bending only the elbows|Keep elbows pointing at the door'],
    ['db-curl', 'Dumbbell curl', 'curl', 1, 3, '', 'Elbows by your sides|Curl without swinging|Lower slowly'],
    ['hammer-curl', 'Hammer curl', 'curl', 1, 3, '', 'Palms facing each other|Curl up, elbows still|Works the forearms too'],
    ['incline-curl', 'Incline dumbbell curl', 'curl', 1, 5, 'L inc', 'Sit back on an incline bench, arms hanging|Curl without moving your elbows forward|Starts the biceps at a long length'],
    ['cable-curl', 'Cable curl', 'curl', 2, 3, '', 'Low cable, straight bar or rope|Elbows still|Squeeze at the top'],
    ['ez-curl', 'EZ-bar curl', 'curl', 2, 4, '', 'Grip the angled parts of the bar|Curl without swinging|Lower slowly'],

    // ---------------- Triceps ----------------
    ['bench-dip', 'Bench dip', 'tri', 0, 3, 'S H', 'Hands on a sturdy chair behind you|Lower until elbows are about 90°|Keep shoulders away from ears'],
    ['close-pushup', 'Close-grip push-up, hands on a bench', 'tri', 0, 4, 'H', 'Hands shoulder-width on a bench or table|Elbows brush your sides|Press back up'],
    ['bw-tri-ext', 'Bodyweight triceps extension (hands on a table)', 'tri', 0, 6, 'L H', 'Hands on a solid table, body straight|Bend only the elbows, forehead toward the table|Push back to straight arms'],
    ['db-kickback', 'Dumbbell kickback', 'tri', 1, 3, '', 'Hinge forward, elbow tucked by your side|Straighten your arm back|Squeeze, then lower'],
    ['db-ext', 'Overhead triceps extension', 'tri', 1, 4, 'L S', 'One dumbbell held with both hands overhead|Lower behind your head|Elbows point forward — more growth than pushdowns'],
    ['db-skull', 'Dumbbell skull crusher', 'tri', 1, 5, 'L', 'Lie on a bench, dumbbells over your shoulders|Bend the elbows to lower beside your head|Straighten without moving the elbows'],
    ['cable-pushdown', 'Cable pushdown', 'tri', 2, 3, '', 'Elbows pinned to your sides|Push down to straight arms|Slow on the way up'],
    ['cable-oh-ext', 'Cable overhead triceps extension', 'tri', 2, 4, 'L S', 'Face away from the cable, rope behind your head|Straighten your arms forward and up|Full stretch each rep'],

    // ---------------- Hamstrings (knee bend) ----------------
    ['ham-walkout', 'Hamstring walkouts', 'hamcurl', 0, 3, '', 'Start in a glute bridge|Walk your heels out in small steps, hips up|Walk back in'],
    ['towel-slide', 'Towel hamstring curl', 'hamcurl', 0, 5, 'H', 'Heels on a towel on a smooth floor, hips up|Pull your heels toward you|Slide back out slowly'],
    ['sl-towel-slide', 'One-leg towel hamstring curl', 'hamcurl', 0, 6, 'u H', 'One heel on the towel, hips up|Pull the heel in|Slide out slowly'],
    ['nordic-assisted', 'Assisted Nordic curl', 'hamcurl', 0, 7, 'H', 'Kneel with your feet hooked under a sofa|Lower your body slowly, hands ready on a chair|Push off with your hands to come back up'],
    ['nordic-neg', 'Nordic curl, lowering only', 'hamcurl', 0, 8, 'H', 'Feet hooked under something heavy|Lower as slowly as you can|Catch yourself with your hands'],
    ['nordic', 'Nordic curl', 'hamcurl', 0, 9, 'H', 'Feet anchored|Lower slowly and pull yourself back up with the hamstrings|Only when the lowering-only version is easy'],
    ['db-leg-curl', 'Lying dumbbell leg curl', 'hamcurl', 1, 4, '', 'Lie face down; ask someone to place a light dumbbell between your feet|Curl your heels up, but stop before your shins are vertical|Lower slowly'],
    ['leg-curl', 'Seated leg curl (or lying)', 'hamcurl', 2, 3, 'L', 'Pad just above the heels|Curl fully, pause|Seated works the hamstrings longer — a bit more growth'],

    // ---------------- Calves ----------------
    ['calf-raise', 'Calf raise', 'calf', 0, 2, '', 'On a step edge if you have one|Full stretch at the bottom|Pause at the top'],
    ['calf-pause', 'Calf raise with a pause at the bottom', 'calf', 0, 3, 'L P H', 'Heels hanging off a step|Hold 2 seconds in the deep stretch|Rise all the way up'],
    ['sl-calf', 'Single-leg calf raise on a step', 'calf', 0, 4, 'u L H', 'One foot on a step, hold a wall|Lower into a full stretch|Rise as high as you can'],
    ['db-calf', 'Dumbbell single-leg calf raise', 'calf', 1, 5, 'u L', 'Dumbbell in one hand, hold a wall with the other|Deep stretch at the bottom|Pause at the top'],
    ['seated-calf', 'Seated calf raise', 'calf', 2, 3, '', 'Pad on your thighs|Lower into a stretch|Rise and squeeze'],
    ['machine-calf', 'Standing calf raise machine', 'calf', 2, 4, 'L', 'Shoulders under the pads|Deep stretch, 1-second pause|Rise all the way up'],

    // ---------------- Core ----------------
    ['dead-bug', 'Dead bug', 'core', 0, 2, 'e', 'Lower back pressed into the floor|Extend opposite arm and leg slowly|Stop before your back lifts'],
    ['knee-plank', 'Plank on the knees', 'core', 0, 2, 's e', 'Forearms down, knees down|Straight line from knees to head|Squeeze glutes, breathe'],
    ['plank', 'Plank', 'core', 0, 3, 's e', 'Elbows under shoulders|Squeeze glutes, ribs down|Breathe — don’t hold your breath'],
    ['long-plank', 'Long-lever plank (squeeze hard)', 'core', 0, 5, 's e', 'Elbows a little in front of your shoulders|Tuck your hips and squeeze everything|Much harder than a normal plank — short holds'],
    ['hollow', 'Hollow hold', 'core', 0, 5, 's e', 'Lower back glued to the floor|Arms and legs extended, low|Bend knees to make it easier'],
    ['body-saw', 'Body saw (feet on a towel)', 'core', 0, 6, 'e H', 'Forearm plank with feet on a towel|Slide your body back a little, then forward|Hips stay level'],
    ['ab-wheel-knee', 'Ab wheel rollout from the knees', 'core', 2, 7, 'e', 'Kneel, hands on the wheel|Roll out only as far as your back stays flat|Pull back with your abs'],
    ['ab-wheel', 'Ab wheel rollout from the feet', 'core', 2, 9, 'e B', 'Only when knee rollouts are easy|Roll out with a flat back|Pull back with your abs'],
    ['bird-dog', 'Bird dog', 'core', 0, 2, 'r', 'On hands and knees|Reach opposite arm and leg long|Keep hips level — imagine a cup on your back'],
    ['band-pallof', 'Band Pallof press', 'core', 0, 3, 'r band', 'Band anchored at chest height to your side|Press your hands straight out|Don’t let the band twist you'],
    ['shoulder-tap', 'Plank shoulder taps', 'core', 0, 4, 'r', 'High plank, feet wide|Tap the opposite shoulder|Hips stay still'],
    ['cable-pallof', 'Cable Pallof press', 'core', 2, 3, 'r', 'Stand side-on to the cable|Press the handle straight out|Resist the twist'],
    ['renegade-row', 'Renegade row', 'core', 1, 7, 'r', 'High plank on two hex dumbbells that can’t roll, feet wide|Row one dumbbell without twisting|Light weights'],
    ['knee-side-plank', 'Side plank on the knees', 'core', 0, 2, 's l', 'Elbow under shoulder, knees bent|Hips up in a straight line|Both sides'],
    ['side-plank', 'Side plank', 'core', 0, 4, 's l', 'Elbow under shoulder|Hips high, body straight|Both sides'],
    ['side-plank-lift', 'Side plank with top-leg lift', 'core', 0, 6, 's l', 'Hold a side plank|Lift the top leg and hold|Both sides'],
    ['copenhagen', 'Copenhagen plank (knee on a bench)', 'core', 0, 6, 's l H', 'Side plank with your top knee on a bench|Lift the bottom leg up to it|Strong inner thighs; both sides'],
    ['farmer-carry', 'Farmer carry', 'core', 1, 3, 's c', 'A heavy dumbbell in each hand|Walk tall with small steps|Shoulders down, don’t lean'],
    ['suitcase-carry', 'Suitcase carry (one dumbbell)', 'core', 1, 4, 's l', 'Heavy dumbbell in one hand only|Walk without leaning to that side|Switch hands halfway'],
    ['curl-up', 'McGill curl-up', 'core', 0, 2, 'f', 'One knee bent, hands under your lower back|Lift head and shoulders a little, hold 5–10 s|Back-friendly'],
    ['reverse-crunch', 'Reverse crunch', 'core', 0, 3, 'f', 'Lie on your back, knees bent up|Roll your hips off the floor|Lower slowly — no swinging'],
    ['hollow-rock', 'Hollow rocks', 'core', 0, 6, 'f', 'Hold a hollow body shape|Rock gently back and forth|Keep the shape the whole time'],
    ['cable-crunch', 'Cable crunch', 'core', 2, 4, 'f B', 'Kneel facing the cable, rope by your head|Curl your ribs toward your hips|Hips stay still'],
    ['hanging-knee', 'Hanging knee raise', 'core', 0, 6, 'f bar', 'Hang from a bar|Lift your knees to your chest, curling your hips|No swinging'],
    ['hanging-leg', 'Hanging leg raise', 'core', 0, 8, 'f bar B', 'Hang with straight legs|Lift your legs to hip height or higher|Lower slowly'],

    // ---------------- Power (jumps, throws, swings) ----------------
    ['speed-squat', 'Speed squat (fast up, no jump)', 'plyo', 0, 2, 'pow', 'Lower under control|Stand up as fast as you can, onto your toes|Quiet — no jumping'],
    ['pogo', 'Pogo hops', 'plyo', 0, 2, 'j1 pow', 'Small, quick bounces on the balls of your feet|Knees almost straight|Quiet, springy landings'],
    ['step-jump', 'Jump onto a step, step down', 'plyo', 0, 3, 'j1 pow H', 'Jump onto a low, stable step|Land softly with bent knees|Step down — don’t jump down'],
    ['squat-jump', 'Squat jump (land and hold)', 'plyo', 0, 3, 'j2 pow', 'Quarter squat, then jump straight up|Land softly and hold 2 seconds|Knees over toes on landing'],
    ['cmj', 'Jump and reach', 'plyo', 0, 4, 'j2 pow', 'Dip quickly and jump as high as you can|Reach up with both arms|Land softly, reset each rep'],
    ['line-hops', 'Side-to-side line hops', 'plyo', 0, 4, 'j1 pow', 'Feet together beside a line|Hop quickly side to side|Light, quick feet'],
    ['broad-jump', 'Broad jump (stick the landing)', 'plyo', 0, 5, 'j2 pow', 'Swing your arms and jump forward|Land softly and hold still|Walk back and reset'],
    ['skater-bound', 'Skater bounds', 'plyo', 0, 6, 'j2 u pow', 'Leap sideways from one foot to the other|Land softly and pause|Push off strongly'],
    ['jump-lunge', 'Jumping lunges', 'plyo', 0, 6, 'j2 u K pow', 'Lunge, jump and switch legs in the air|Land softly in a lunge|Only with good lunge form'],
    ['tuck-jump', 'Tuck jumps', 'plyo', 0, 7, 'j2 pow', 'Jump and pull your knees up|Land softly|Hard on the knees — few reps'],
    ['sl-hop', 'Single-leg hops', 'plyo', 0, 8, 'j2 u pow', 'Hop forward on one leg|Land softly and hold|Both legs'],
    ['explosive-pushup', 'Explosive incline push-up (hands on a bench)', 'plyo', 0, 4, 'pow up H S', 'Hands on a sturdy bench|Push up so fast your hands leave it|Catch softly with bent elbows'],
    ['clap-pushup', 'Clap push-up', 'plyo', 0, 8, 'pow up S', 'Explode up, clap, catch softly|Only with strong push-ups|Few reps, full rest'],
    ['db-swing', 'Dumbbell swing', 'plyo', 1, 4, 'pow B', 'Fixed dumbbell, or check the collars are tight first|Hike it back between your legs, then snap your hips|Arms just guide it — hips power it'],
    ['db-push-press', 'Dumbbell push press', 'plyo', 1, 5, 'pow up S', 'Dip your knees slightly|Drive up and press the dumbbells overhead|Lower with control'],
    ['ball-chest-pass', 'Medicine-ball chest pass (against a wall)', 'plyo', 2, 3, 'pow up', 'Stand 1–2 m from a solid wall|Throw the ball hard from your chest|Catch and reset'],
    ['ball-slam', 'Medicine-ball slam', 'plyo', 2, 4, 'pow B', 'Lift the ball overhead|Slam it into the floor with your whole body|Bend your knees to pick it up'],
    ['kb-swing', 'Kettlebell swing', 'plyo', 2, 5, 'pow B', 'Hike the bell back between your legs|Snap your hips forward to float it to chest height|Flat back, no squatting'],

    // ---------------- Conditioning (finishers & circuits) ----------------
    ['march', 'Fast marching (knees high, no jump)', 'cond', 0, 1, '', 'March on the spot, knees high|Swing your arms|Quiet and joint-friendly'],
    ['step-jack', 'Step jacks (no jump)', 'cond', 0, 2, '', 'Step one foot out while raising your arms|Step back in and switch|Speed up when it gets easy'],
    ['shadow-box', 'Shadow boxing', 'cond', 0, 2, '', 'Light on your feet, hands up|Quick straight punches|Breathe out with each punch'],
    ['stairs', 'Stair climbing (or fast step-ups)', 'cond', 0, 3, 'H', 'Climb at a steady quick pace|Use the handrail|Walk down for the easy part'],
    ['incline-climber', 'Mountain climbers, hands on a chair', 'cond', 0, 3, 'H', 'Hands on a sturdy chair|Drive your knees toward your chest in turn|Hips stay level'],
    ['stepback-burpee', 'Step-back burpee (no jump)', 'cond', 0, 3, '', 'Squat down, hands on the floor|Step back to a plank, then step in|Stand up tall'],
    ['skater-step', 'Speed skaters (step, no hop)', 'cond', 0, 3, '', 'Step wide to one side, the other leg crossing behind|Swap quickly|Low and light'],
    ['bear-crawl', 'Bear crawl', 'cond', 0, 4, '', 'Hands and feet, knees just off the floor|Crawl forward and back|Back flat, small steps'],
    ['jumping-jack', 'Jumping jacks', 'cond', 0, 4, 'j1', 'Jump feet out and arms up|Jump back in|Light landings'],
    ['climber', 'Mountain climbers', 'cond', 0, 5, '', 'High plank|Drive your knees in fast, one after the other|Hips low'],
    ['high-knees', 'High knees (running on the spot)', 'cond', 0, 5, 'j2', 'Run on the spot|Knees to hip height|Quick arms'],
    ['burpee-nopu', 'Burpee (no push-up)', 'cond', 0, 5, 'j2', 'Squat, jump your feet back to a plank|Jump them in|Jump up with arms overhead'],
    ['sprint', 'Sprints or shuttle runs (outdoors)', 'cond', 0, 7, 'j2', 'Warm up first|Run fast for the time given|Walk back slowly to recover'],
    ['skipping', 'Skipping (with or without a rope)', 'cond', 0, 6, 'j1', 'Small bounces on the balls of your feet|Turn the rope with your wrists|No rope? Do the same movement'],
    ['burpee', 'Burpee with a push-up', 'cond', 0, 7, 'j2', 'Squat, jump back, push-up|Jump the feet in|Jump up'],
    ['db-thruster', 'Dumbbell thruster', 'cond', 1, 6, 'S', 'Dumbbells at your shoulders|Squat, then drive up and press overhead|One smooth movement'],
    ['bike-sprint', 'Exercise bike, fast', 'cond', 2, 3, '', 'Seat at hip height|Pedal hard for the time given|Easy spin to recover'],
    ['rower', 'Rowing machine', 'cond', 2, 4, '', 'Legs, then body, then arms|Back in reverse order|Strong push, smooth return']
  ];

  var EX = RAW.map(function (r) {
    var f = r[5] ? r[5].split(' ') : [];
    var has = function (x) { return f.indexOf(x) >= 0; };
    var e = { id: r[0], name: r[1], pat: r[2], eq: r[3], d: r[4], cues: r[6].split('|'), flags: f };
    if (has('s')) e.unit = 's';
    if (has('u')) e.uni = true;
    e.imp = has('j2') ? 2 : has('j1') ? 1 : 0;
    ['K', 'B', 'S', 'L', 'T', 'P', 'H'].forEach(function (k) { if (has(k)) e[k] = true; });
    if (has('bar')) e.bar = true;
    if (has('band')) e.band = true;
    if (has('pow')) e.pow = true;
    if (has('bw')) e.bw = true;
    if (has('inc')) e.inc = true;
    if (has('up')) e.up = true;
    ['e', 'r', 'l', 'f', 'c'].forEach(function (k) { if (has(k)) e.core = k; });
    e.lvl = e.d >= 5 ? 1 : 0; // kept for anything that used the old 0/1 level
    return e;
  });
  var BY_ID = {};
  EX.forEach(function (e) { BY_ID[e.id] = e; });
  M.EXERCISES = EX;
  M.exercise = function (id) { return BY_ID[id]; };

  M.PATTERNS = {
    squat: { label: 'Squat', muscles: 'Front thighs & glutes', region: 'lower' },
    hinge: { label: 'Hip hinge', muscles: 'Glutes & hamstrings', region: 'lower' },
    lunge: { label: 'Single leg', muscles: 'Legs, glutes & balance', region: 'lower' },
    quad: { label: 'Front thighs', muscles: 'Front thighs', region: 'lower' },
    hamcurl: { label: 'Hamstrings', muscles: 'Hamstrings', region: 'lower' },
    calf: { label: 'Calves', muscles: 'Calves', region: 'lower' },
    hpush: { label: 'Push', muscles: 'Chest, shoulders & triceps', region: 'upper', push: true },
    fly: { label: 'Chest', muscles: 'Chest', region: 'upper', push: true },
    vpush: { label: 'Overhead push', muscles: 'Shoulders & triceps', region: 'upper', push: true },
    hpull: { label: 'Row', muscles: 'Upper back & biceps', region: 'upper', pull: true },
    vpull: { label: 'Pull-down', muscles: 'Lats & biceps', region: 'upper', pull: true },
    rear: { label: 'Rear shoulders', muscles: 'Rear shoulders & upper back', region: 'upper', pull: true },
    lat: { label: 'Side shoulders', muscles: 'Side shoulders', region: 'upper', push: true },
    curl: { label: 'Biceps', muscles: 'Biceps', region: 'upper', pull: true },
    tri: { label: 'Triceps', muscles: 'Triceps', region: 'upper', push: true },
    core: { label: 'Core', muscles: 'Core', region: 'core' },
    plyo: { label: 'Power', muscles: 'Power & speed', region: 'power' },
    cond: { label: 'Conditioning', muscles: 'Heart & lungs', region: 'cond' }
  };

  var EQUIP = { none: 0, dumbbells: 1, gym: 2 };
  M.EQUIPMENT = [
    { id: 'none', label: 'No equipment', desc: 'Bodyweight, a backpack, stairs, a chair — perfect for the park or home.' },
    { id: 'dumbbells', label: 'Dumbbells at home', desc: 'A pair of adjustable dumbbells and a bench or sturdy bed.' },
    { id: 'gym', label: 'Full gym', desc: 'Barbells, machines, cables, pull-up bar and kettlebells.' }
  ];
  M.WO_EXTRAS = [['bar', 'Pull-up bar'], ['band', 'Resistance band'], ['incline', 'Adjustable (incline) bench']];
  M.WO_JOINTS = [['knee', 'Knees'], ['back', 'Lower back'], ['shoulder', 'Shoulders']];

  M.INTENSITY = [
    { id: 'low', label: 'Low — easy', desc: 'Easier versions of each exercise, one at a time with full rest, stopping with 3–4 reps left. For starting out, busy or tired weeks, or an easy week.' },
    { id: 'medium', label: 'Medium — steady', desc: 'Standard versions, with smaller exercises done in pairs (supersets) to save time. Stop 2–3 reps before you’d fail.' },
    { id: 'high', label: 'High — hard', desc: 'Harder versions (one leg or arm, pauses, more advanced moves), a power exercise, supersets or circuits and a hard finisher. Stop 1–2 reps before failure. Only when you’re rested.' }
  ];

  /* ------------------------------------------------------------------ */
  /* Who can do what                                                     */
  /* ------------------------------------------------------------------ */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

  function context(o) {
    var age = o.age === undefined ? null : o.age;
    var minor = age !== null && age < 18;
    var inter = o.experience === 'intermediate';
    var intensity = o.intensity === 'low' || o.intensity === 'high' ? o.intensity : 'medium';
    var extras = {}; (o.extras || []).forEach(function (x) { extras[x] = true; });
    var joints = {}; (o.joints || []).forEach(function (x) { joints[x] = true; });
    var eq = EQUIP[o.equipment] !== undefined ? EQUIP[o.equipment] : 0;
    var base = inter ? 5 : 3;
    var shift = intensity === 'low' ? (inter ? -1 : -2) : intensity === 'high' ? (inter && !minor ? 2 : 1) : 0;
    return {
      goal: ['lose', 'gain', 'strength', 'health'].indexOf(o.goal) >= 0 ? o.goal : 'health',
      minor: minor, inter: inter, intensity: intensity, eq: eq, extras: extras, joints: joints,
      quiet: !!o.quiet, minutes: M.clamp(+o.minutes || 45, 20, 90), seed: String(o.seed || ''),
      target: M.clamp(base + shift, 1, 9),
      cap: minor ? 7 : inter ? 9 : 6, // hardest move allowed (beginners: no pistols, archers, Nordics; teens: no full Nordics or one-arm work)
      plyoCap: minor ? 6 : inter ? 7 : 4,
      weight: o.weight || 65
    };
  }
  /* is this exercise safe and possible with this person's equipment, joints and noise rules? */
  function allowed(e, c) {
    if (e.eq > c.eq) return false;
    if (e.bar && !(c.eq === 2 || c.extras.bar)) return false;
    if (e.band && !(c.extras.band || c.eq === 2)) return false;
    if (e.inc && !(c.extras.incline || c.eq === 2)) return false;
    if (c.quiet && e.imp) return false;
    if (c.joints.knee && (e.K || e.imp)) return false;
    if (c.joints.back && e.B) return false;
    if (c.joints.shoulder && e.S) return false;
    if (e.pat === 'plyo' || e.pat === 'cond') { if (e.d > c.plyoCap + (e.pat === 'cond' ? 2 : 0)) return false; }
    else if (e.d > c.cap) return false;
    if (c.minor && e.pat === 'plyo' && e.imp === 2 && e.d > 6) return false;
    return true;
  }
  M.exAllowed = function (e, o) { return allowed(e, o.cap ? o : context(o)); };

  /* the best exercise for a slot */
  function pick(pat, role, c, sessionIds, weekUse, opts) {
    opts = opts || {};
    var heavy = role === 'main' || role === 'second';
    var target = role === 'iso' || role === 'core' ? Math.min(c.target, c.inter ? 5 : 4) : c.target;
    if (opts.target !== undefined) target = opts.target;
    var cands = EX.filter(function (e) {
      if (e.pat !== pat || !allowed(e, c) || sessionIds.indexOf(e.id) >= 0) return false;
      if (opts.core && e.core !== opts.core && !(opts.core === 'l' && e.core === 'c')) return false;
      if (opts.up !== undefined && !!e.up !== opts.up) return false;
      return true;
    });
    if (!cands.length && opts.core) return pick(pat, role, c, sessionIds, weekUse, { target: opts.target });
    if (!cands.length) return null;
    // with weights you make it harder with load, so aim for the hardest *loaded* version, not a gymnastics skill
    var loaded = pat === 'core' || pat === 'plyo' || pat === 'cond' ? [] : cands.filter(function (e) { return e.eq > 0; });
    if (c.eq > 0 && loaded.length) target = Math.min(target, Math.max.apply(null, loaded.map(function (e) { return e.d; })));
    var score = function (e) {
      var s = Math.abs(e.d - target);
      if (!e.bar) s += (c.eq - e.eq) * (pat === 'core' ? 0.2 : heavy ? 1.0 : 0.6); // use the equipment people have
      if (e.H) s += c.eq * 1.4;                         // no backpack rows when there are dumbbells
      if (e.uni) s += heavy ? (c.goal === 'strength' ? 1.2 : 0.3) : c.intensity === 'high' ? -0.35 : c.intensity === 'low' ? 0.5 : 0;
      if ((e.T || e.P) && c.intensity === 'low') s += 0.6;
      if (e.L && (c.goal === 'gain' || role === 'iso')) s -= 0.35; // long-length training: a bit more growth
      if (c.goal === 'strength' && role === 'main' && (e.L || e.T || e.bw)) s += 1.2; // strength: the plain heavy lift
      if (role === 'second' && e.B) s += 0.8;            // the lower back already worked in the main lift
      if (e.unit === 's' && heavy) s += 1;
      if (e.bar && e.eq === 0 && c.eq < 2) s -= 0.4;   // they told us they have a bar: use it
      s += (weekUse[e.id] || 0) * (heavy ? 0.4 : 1.1);  // main lifts may repeat in the week; small exercises vary
      s += hash(c.seed + e.id) * 0.5;                   // small, stable shuffle
      return s;
    };
    cands.sort(function (a, b) { return score(a) - score(b); });
    return cands[0];
  }

  /* ------------------------------------------------------------------ */
  /* Prescriptions                                                       */
  /* ------------------------------------------------------------------ */
  function fmtRest(s) { return s >= 120 ? (s % 60 ? (s / 60).toFixed(1).replace('.0', '') : s / 60) + ' min' : s >= 60 && s % 60 === 0 ? s / 60 + ' min' : s + ' s'; }
  function isLoaded(e) { return (e.eq > 0 && !e.bw) || /backpack/.test(e.id); }
  /* bodyweight: harder moves get fewer reps (sets should end near failure within ~5–20 reps) */
  function bwReps(e) { return e.d >= 6 ? '5–10' : e.d >= 4 ? '8–15' : '12–20'; }
  function rx(e, role, c) {
    var I = c.intensity, out = {};
    var loaded = isLoaded(e);
    var heavyGoal = c.goal === 'strength' || c.goal === 'gain';
    var table = {
      low: { main: 2, second: 2, acc: 2, iso: c.inter ? 2 : 1, core: 2, power: 2 },
      medium: { main: 3, second: 3, acc: c.inter ? 3 : 2, iso: c.inter ? 3 : 2, core: c.inter ? 3 : 2, power: 3 },
      high: { main: c.inter && heavyGoal ? (c.goal === 'strength' ? 5 : 4) : 3, second: c.inter && heavyGoal ? 4 : 3, acc: 3, iso: 3, core: 3, power: 3 }
    };
    out.sets = table[I][role] || 2;
    if (c.minor) out.sets = Math.min(out.sets, c.inter ? 3 : 2);
    var side = e.uni ? ' each side' : '';
    if (e.unit === 's') {
      var hold = /carry/.test(e.id) ? (I === 'low' ? '20–30 s' : '30–40 s') : I === 'low' ? '20–30 s' : I === 'high' ? (c.minor ? '30–40 s' : '40–60 s') : '30–45 s';
      if (e.id === 'long-plank') hold = I === 'high' ? '15–25 s' : '10–20 s';
      if (e.id === 'wall-hs-hold' || e.id === 'flexed-hang' || e.id === 'dead-hang') hold = I === 'low' ? '10–20 s' : '20–30 s';
      out.reps = hold + (e.uni || e.core === 'l' ? ' each side' : '');
    } else if (role === 'power') out.reps = (e.up ? '4–6' : '3–5') + side;
    else if (c.minor) out.reps = (!loaded && e.d >= 6 ? '6–10' : c.inter ? '8–12' : '10–15') + side;
    else if (c.goal === 'strength') out.reps = (role === 'main' ? (loaded ? (e.uni ? '6–8' : c.inter ? '4–6' : '6–8') : '5–8') : role === 'second' ? (loaded ? '6–10' : '5–10') : role === 'iso' ? '10–15' : loaded ? '8–12' : bwReps(e)) + side;
    else if (c.goal === 'gain') out.reps = (role === 'main' ? (loaded ? '6–10' : bwReps(e)) : role === 'iso' ? '10–15' : loaded ? '8–12' : bwReps(e)) + side;
    else out.reps = (role === 'iso' ? '10–15' : loaded ? (role === 'acc' ? '10–15' : '8–12') : bwReps(e)) + side;
    if (e.pat === 'core' && e.unit !== 's') out.reps = (I === 'low' ? '6–8' : '8–12') + (e.uni || e.core === 'r' ? ' each side' : '');
    if (/nordic/.test(e.id)) out.reps = (I === 'high' ? '4–6' : '3–5');
    if (e.id === 'curl-up') out.reps = '3–5 (10-s holds)';
    out.rir = c.minor ? (I === 'low' ? '3–4' : '2–3') : I === 'low' ? '3–4' : I === 'medium' ? '2–3' : role === 'iso' ? '0–1' : '1–2';
    if (role === 'power' || e.unit === 's') out.rir = '—';
    var restS = { main: c.goal === 'strength' ? 180 : c.goal === 'gain' ? 120 : 90, second: c.goal === 'strength' ? 150 : 90, acc: 75, iso: 60, core: 45, power: 75 }[role] || 60;
    if (I === 'low' && role !== 'main') restS += 15;
    if (I === 'high' && (role === 'acc' || role === 'iso')) restS -= 15;
    if (c.minor) restS = Math.max(60, Math.min(restS, 120));
    out.restS = restS; out.rest = fmtRest(restS);
    return out;
  }
  function repMid(r) { var m = /(\d+)(?:–(\d+))?/.exec(r || ''); if (!m) return 10; return m[2] ? (+m[1] + +m[2]) / 2 : +m[1]; }
  function workSec(e, item) {
    var n = repMid(item.reps), sides = / each side/.test(item.reps) ? 2 : 1;
    if (e.unit === 's') return n * sides + 10;
    if (/10-s holds/.test(item.reps)) return 50;
    var per = e.T ? 5 : e.P ? 4.5 : e.pow ? 2.5 : 3;
    return n * per * sides + 8;
  }
  M.repTop = function (r) { var m = /(\d+)(?:–(\d+))?/.exec(r || ''); return m ? +(m[2] || m[1]) : null; };
  M.repLow = function (r) { var m = /(\d+)/.exec(r || ''); return m ? +m[1] : null; };

  /* ------------------------------------------------------------------ */
  /* Session templates                                                   */
  /* ------------------------------------------------------------------ */
  // [pattern, role, options]; listed in priority order — the end of the list is dropped first when time is short
  var T = {
    fullA: { name: 'Full body A', slots: [['squat', 'main'], ['hpush', 'main'], ['hpull', 'second'], ['hinge', 'acc'], ['core', 'core', { core: 'e' }], ['calf', 'iso'], ['curl', 'iso'], ['lat', 'iso'], ['lunge', 'acc']] },
    fullB: { name: 'Full body B', slots: [['hinge', 'main'], ['vpull', 'main'], ['vpush', 'second'], ['lunge', 'acc'], ['core', 'core', { core: 'l' }], ['tri', 'iso'], ['rear', 'iso'], ['hamcurl', 'iso'], ['hpush', 'acc']] },
    fullC: { name: 'Full body C', slots: [['lunge', 'main'], ['hpull', 'main'], ['hpush', 'second'], ['squat', 'acc'], ['core', 'core', { core: 'r' }], ['hamcurl', 'iso'], ['curl', 'iso'], ['calf', 'iso'], ['vpush', 'acc']] },
    upperA: { name: 'Upper A', slots: [['hpush', 'main'], ['hpull', 'main'], ['vpush', 'second'], ['vpull', 'second'], ['lat', 'iso'], ['curl', 'iso'], ['tri', 'iso'], ['fly', 'iso'], ['rear', 'iso']] },
    lowerA: { name: 'Lower A', slots: [['squat', 'main'], ['hinge', 'second'], ['lunge', 'acc'], ['hamcurl', 'iso'], ['core', 'core', { core: 'e' }], ['calf', 'iso'], ['quad', 'iso'], ['core', 'core', { core: 'f' }]] },
    upperB: { name: 'Upper B', slots: [['vpush', 'main'], ['vpull', 'main'], ['hpush', 'second'], ['hpull', 'second'], ['rear', 'iso'], ['tri', 'iso'], ['curl', 'iso'], ['lat', 'iso'], ['fly', 'iso']] },
    lowerB: { name: 'Lower B', slots: [['hinge', 'main'], ['squat', 'second'], ['lunge', 'acc'], ['calf', 'iso'], ['core', 'core', { core: 'l' }], ['hamcurl', 'iso'], ['quad', 'iso'], ['core', 'core', { core: 'r' }]] },
    push: { name: 'Push', slots: [['hpush', 'main'], ['vpush', 'second'], ['hpush', 'acc'], ['lat', 'iso'], ['tri', 'iso'], ['fly', 'iso'], ['core', 'core', { core: 'e' }]] },
    pull: { name: 'Pull', slots: [['vpull', 'main'], ['hpull', 'second'], ['vpull', 'acc'], ['rear', 'iso'], ['curl', 'iso'], ['core', 'core', { core: 'r' }], ['curl', 'iso']] },
    legs: { name: 'Legs', slots: [['squat', 'main'], ['hinge', 'second'], ['lunge', 'acc'], ['hamcurl', 'iso'], ['calf', 'iso'], ['quad', 'iso'], ['core', 'core', { core: 'l' }]] }
  };
  var SPLITS = {
    2: ['fullA', 'fullB'], 3: ['fullA', 'fullB', 'fullC'], 4: ['upperA', 'lowerA', 'upperB', 'lowerB'],
    5: ['upperA', 'lowerA', 'push', 'pull', 'legs'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs']
  };
  var DAY_SPREAD = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

  /* ------------------------------------------------------------------ */
  /* Blocks: power, main lifts, supersets / circuit, core, finisher      */
  /* ------------------------------------------------------------------ */
  var CHANGE = [30, 45, 75]; // seconds to set up the next exercise: bodyweight, dumbbells, gym
  function region(e) { return (M.PATTERNS[e.pat] || {}).region || 'core'; }
  function competing(a, b) {
    if (a.B && b.B) return true; // two lower-back-heavy lifts back to back: no
    var ra = region(a), rb = region(b);
    if (ra !== rb) return false;
    if (ra === 'upper') { var A = M.PATTERNS[a.pat], B = M.PATTERNS[b.pat]; return !!(A.push && B.push || A.pull && B.pull); }
    return ra === 'lower';
  }
  function finMin(f) { return f.kind === 'tabata' ? (f.blocks === 2 ? 9 : 4) : f.kind === 'carry' ? f.rounds * 1.3 : f.kind === 'active' ? 45 : f.rounds * (f.on + f.off) / 60; }
  function finTitle(f) {
    if (f.kind === 'tabata') return 'Finisher: 20 s hard, 10 s rest × 8' + (f.blocks === 2 ? ' — twice' : '');
    if (f.kind === 'carry') return 'Finisher: loaded carries × ' + f.rounds;
    if (f.kind === 'speed') return 'Finisher: speed & fun — ' + f.rounds + ' × 10 s fast';
    return 'Finisher: ' + f.on + ' s ' + (f.on <= 20 ? 'hard' : f.hard ? 'hard' : 'on') + ', ' + f.off + ' s easy × ' + f.rounds;
  }
  function blockTime(b, c) {
    var t = 0;
    var ch = function (e) { return CHANGE[Math.min(e.eq, c.eq)] || 30; };
    if (b.type === 'finisher') return finMin(b) * 60;
    if (b.type === 'active') return b.min * 60;
    if (b.type === 'straight' || b.type === 'main' || b.type === 'power') {
      b.items.forEach(function (it) { var e = M.exercise(it.ex); t += it.sets * workSec(e, it) + (it.sets - 1) * it.restS + ch(e); });
      if (b.type === 'main') b.items.forEach(function (it) { var e = M.exercise(it.ex); t += isLoaded(e) ? 100 : 40; }); // lighter warm-up sets
    } else if (b.type === 'super') {
      var rounds = Math.max.apply(null, b.items.map(function (it) { return it.sets; }));
      var w = b.items.reduce(function (s, it) { return s + workSec(M.exercise(it.ex), it) + 15; }, 0);
      t = rounds * w + (rounds - 1) * b.restS + b.items.reduce(function (s, it) { return s + ch(M.exercise(it.ex)); }, 0);
      if (b.items.some(function (it) { return it.role === 'main'; })) t += 120;
    } else if (b.type === 'circuit') {
      var w2 = b.items.reduce(function (s, it) { return s + workSec(M.exercise(it.ex), it) + 20; }, 0);
      t = b.rounds * w2 + (b.rounds - 1) * b.restS + b.items.reduce(function (s, it) { return s + ch(M.exercise(it.ex)); }, 0) / 2;
    }
    return t;
  }
  function warmMin(c) { return c.minor ? (c.minutes <= 30 ? 6 : 7) : c.minutes <= 30 ? 4 : c.minutes <= 45 ? 5 : c.minutes <= 60 ? 6 : 7; }
  function coolMin(c) { return c.minutes <= 30 ? 2 : 3; }
  function sessionMinutes(s, c) {
    var sec = (warmMin(c) + coolMin(c)) * 60;
    s.blocks.forEach(function (b) { sec += blockTime(b, c); });
    return sec / 60;
  }

  /* finisher for the goal and intensity */
  var FIN_PREF = ['burpee', 'burpee-nopu', 'high-knees', 'jumping-jack', 'skipping', 'climber', 'bear-crawl', 'db-thruster', 'rower', 'bike-sprint', 'stepback-burpee', 'skater-step', 'incline-climber', 'shadow-box', 'stairs', 'step-jack', 'march'];
  function finMoves(c, sessionIds, n, maxD) {
    var list = EX.filter(function (e) { return e.pat === 'cond' && e.id !== 'sprint' && allowed(e, c) && e.d <= maxD && sessionIds.indexOf(e.id) < 0; });
    var eqFirst = function (e) { return e.eq === c.eq ? 0 : e.eq > 0 ? 1 : 2; };
    list.sort(function (a, b) { return eqFirst(a) - eqFirst(b) || (b.d - a.d) || ((hash(c.seed + a.id) - hash(c.seed + b.id))); });
    return list.slice(0, n);
  }
  function finisher(c, sessionIds) {
    var I = c.intensity;
    if (I === 'low') return null;
    var mk = function (o, list, reps) { if (!list.length) return null; o.type = 'finisher'; o.items = list.map(function (e) { return { ex: e.id, reps: reps }; }); return o; };
    if (c.minor) {
      var sp = EX.filter(function (e) { return (c.quiet ? ['skater-step', 'march', 'shadow-box'] : ['sprint', 'skipping', 'skater-step']).indexOf(e.id) >= 0 && allowed(e, c); }).slice(0, 2);
      return mk({ kind: 'speed', rounds: I === 'high' ? 8 : 6, on: 10, off: 50, note: 'Fast but relaxed, then 50 s of easy walking — full recovery every time.', met: 7 }, sp, '10 s fast');
    }
    if (c.goal === 'strength') {
      if (I !== 'high') return null;
      var carry = EX.filter(function (e) { return (e.id === 'farmer-carry' || e.id === 'suitcase-carry') && allowed(e, c) && sessionIds.indexOf(e.id) < 0; }).slice(0, 1);
      return mk({ kind: 'carry', rounds: 3, note: '30–40 s heavy carry, 60 s rest. Builds grip and a strong core.', met: 6 }, carry, '30–40 s');
    }
    if (c.goal === 'gain' && I === 'medium') return null;
    if (I === 'medium') return mk({ kind: 'i', on: 30, off: 30, rounds: 6, note: 'Alternate the moves. Hard enough to breathe fast, not all-out.', met: 7 }, finMoves(c, sessionIds, 2, c.inter ? 5 : 4), '30 s');
    var hv = finMoves(c, sessionIds, 3, c.inter ? 7 : 5);
    if (c.goal === 'gain') return mk({ kind: 'i', on: 20, off: 40, rounds: 5, hard: true, note: 'Short and sharp, so it doesn’t eat into recovery.', met: 8 }, hv.slice(0, 2), '20 s');
    if (c.inter) return mk({ kind: 'tabata', blocks: 2, note: '4 minutes, 1 minute easy, then 4 minutes again. Hard, but keep good form.', met: 11 }, hv, '20 s');
    return mk({ kind: 'i', on: 30, off: 30, rounds: 8, hard: true, note: 'Rotate the moves.', met: 9 }, hv, '30 s');
  }
  function shrinkFinisher(f) {
    if (f.kind === 'i' && f.rounds > 4) { f.rounds -= 2; return true; }
    if (f.kind === 'tabata' && f.blocks === 2) { f.blocks = 1; return true; }
    if (f.kind === 'speed' && f.rounds > 4) { f.rounds -= 2; return true; }
    if (f.kind === 'carry' && f.rounds > 2) { f.rounds -= 1; return true; }
    return false;
  }

  /* power exercise first in the session (High) */
  function powerBlock(c, sessionIds, weekUse, upperDay) {
    if (c.intensity !== 'high') return null;
    var t = Math.min(c.plyoCap, c.inter ? 5 : 3);
    var e = pick('plyo', 'power', c, sessionIds, weekUse, { up: !!upperDay, target: t }) || (upperDay ? pick('plyo', 'power', c, sessionIds, weekUse, { up: false, target: t }) : null);
    if (!e) return null;
    var r = rx(e, 'power', c);
    if (c.minor || !c.inter) r.sets = 2;
    return { type: 'power', title: 'Power', note: 'Fresh and fast — full rest. Stop when the jumps or throws slow down.', items: [Object.assign({ ex: e.id, role: 'power' }, r)] };
  }

  function letters(blocks) {
    var L = 'ABCDEFGHIJ', i = 0;
    blocks.forEach(function (b) {
      if (b.type === 'finisher' || b.type === 'active') return;
      var ch = L[i++] || '?';
      b.tag = ch;
      if (b.items.length === 1) b.items[0].tag = ch;
      else b.items.forEach(function (it, k) { it.tag = ch + (k + 1); });
    });
  }

  /* group the chosen exercises into blocks for this intensity */
  function assemble(chosen, c, power, fin) {
    var blocks = [];
    var I = c.intensity;
    var item = function (x) { return Object.assign({ ex: x.e.id, role: x.role }, x.rx); };
    var maxRest = function (grp) { return Math.max.apply(null, grp.map(function (x) { return x.rx.restS; })); };
    if (power) blocks.push(power);
    var mains = chosen.filter(function (x) { return x.role === 'main'; });
    var seconds = chosen.filter(function (x) { return x.role === 'second'; });
    var rest = chosen.filter(function (x) { return x.role !== 'main' && x.role !== 'second'; });
    // main lifts: one at a time with full rest (a short, hard session pairs two that don't compete)
    if (mains.length === 2 && I === 'high' && c.minutes <= 30 && !competing(mains[0].e, mains[1].e)) blocks.push({ type: 'super', restS: 90, items: mains.map(item), title: 'Superset' });
    else mains.forEach(function (x) { blocks.push({ type: 'main', items: [item(x)] }); });
    // second compound lifts: push + pull pair up; heavy leg lifts stay on their own
    var circuit = I !== 'low' && c.goal === 'lose' && !c.minor;
    if (circuit) rest = seconds.concat(rest);
    else if (I !== 'low' && seconds.length === 2 && !competing(seconds[0].e, seconds[1].e) && region(seconds[0].e) === 'upper') blocks.push({ type: 'super', restS: maxRest(seconds), items: seconds.map(item), title: 'Superset' });
    else seconds.forEach(function (x) { blocks.push({ type: 'straight', items: [item(x)] }); });
    // everything else
    if (I === 'low') rest.forEach(function (x) { blocks.push({ type: 'straight', items: [item(x)] }); });
    else if (circuit && rest.length >= 2) {
      var rounds = Math.max.apply(null, rest.map(function (x) { return x.rx.sets; }));
      blocks.push({ type: 'circuit', rounds: rounds, restS: I === 'high' ? 60 : 90, items: rest.map(function (x) { var it = item(x); it.restS = 20; it.rest = '20 s'; return it; }), title: 'Circuit' });
    } else {
      var pool = rest.slice();
      while (pool.length) {
        var a = pool.shift(), j = -1;
        for (var k = 0; k < pool.length; k++) if (!competing(a.e, pool[k].e)) { j = k; break; }
        if (j >= 0) {
          var b = pool.splice(j, 1)[0], grp = [a, b];
          if (I === 'high' && pool.length === 1 && !competing(pool[0].e, a.e) && !competing(pool[0].e, b.e)) grp.push(pool.shift());
          blocks.push({ type: 'super', restS: c.minor ? Math.max(75, maxRest(grp)) : maxRest(grp), items: grp.map(item), title: grp.length === 3 ? 'Tri-set' : 'Superset' });
        } else blocks.push({ type: 'straight', items: [item(a)] });
      }
    }
    // one intensifier set for adults on High
    if (I === 'high' && !c.minor) {
      var target = null;
      blocks.forEach(function (bl) { if (bl.type !== 'main' && bl.type !== 'power') bl.items.forEach(function (it) { if (it.role === 'iso' && M.exercise(it.ex).unit !== 's') target = it; }); });
      if (target) {
        var te = M.exercise(target.ex);
        if (c.inter) target.note = isLoaded(te) || te.band ? 'Last set: drop set — when you’re about 1 rep from failing, drop the weight by about a quarter and keep going.' : 'Last set: rest-pause — near failure, rest 15 s, then do as many clean reps as you can; once more.';
        else target.note = 'Last set: lower each rep over 3 seconds.';
      }
    }
    if (fin) { fin.min = finMin(fin); fin.title = finTitle(fin); blocks.push(fin); }
    letters(blocks);
    return blocks;
  }

  function flatten(s) { var out = []; (s.blocks || []).forEach(function (b) { if (b.type !== 'finisher' && b.type !== 'active') b.items.forEach(function (it) { out.push(it); }); }); return out; }
  M.sessionItems = function (s) { return s.blocks ? flatten(s) : (s.items || []); };

  /* warm-up and cool-down written for the day's exercises */
  function warmupFor(s, c) {
    var items = flatten(s).map(function (it) { return M.exercise(it.ex); }).filter(Boolean);
    var lower = items.some(function (e) { return region(e) === 'lower'; }), upper = items.some(function (e) { return region(e) === 'upper'; });
    var raise = c.quiet || c.joints.knee ? 'fast marching or step jacks' : 'skipping, jumping jacks or a brisk walk';
    var mob = [];
    if (lower) mob.push('leg swings', 'hip circles', '10 bodyweight squats', '10 glute bridges');
    if (upper) mob.push('arm circles', (c.extras.band || c.eq === 2 ? '15 band pull-aparts' : '10 prone Y-raises'), '8 push-ups against a wall');
    var first = items.filter(function (e) { return e.pat !== 'plyo'; })[0];
    var pot = first ? (isLoaded(first) ? '1–2 lighter sets of ' + first.name.toLowerCase() + ' (about half, then three-quarters of your working weight)' : '1 easy set of ' + first.name.toLowerCase() + ' or an easier version') : '';
    return [
      { t: 'Raise', d: '2 min of ' + raise + ' — get warm and breathe a bit faster.' },
      { t: 'Mobilise', d: mob.slice(0, 5).join(', ') + '.' },
      { t: 'Ramp up', d: pot ? pot + '.' : 'Start your first exercise gently.' }
    ];
  }
  function cooldownFor(s) {
    var items = flatten(s).map(function (it) { return M.exercise(it.ex); }).filter(Boolean);
    var st = [];
    if (items.some(function (e) { return e.pat === 'squat' || e.pat === 'lunge' || e.pat === 'quad'; })) st.push('front-thigh stretch');
    if (items.some(function (e) { return e.pat === 'hinge' || e.pat === 'hamcurl'; })) st.push('hamstring stretch');
    if (items.some(function (e) { return e.pat === 'hpush' || e.pat === 'fly'; })) st.push('doorway chest stretch');
    if (items.some(function (e) { return e.pat === 'vpull' || e.pat === 'hpull'; })) st.push('child’s pose');
    if (items.some(function (e) { return e.pat === 'calf'; })) st.push('calf stretch on a wall');
    return '2–3 minutes of easy walking, then 30 s each: ' + (st.slice(0, 3).join(', ') || 'gentle stretches for what you trained') + '.';
  }

  var FALLBACK = { vpush: 'hpush', fly: 'hpush', lat: 'rear', tri: 'core', vpull: 'hpull', curl: 'rear', quad: 'lunge', hamcurl: 'hinge', calf: 'core', rear: 'hpull' };
  /* ------------------------------------------------------------------ */
  /* Build a session to fit the time                                     */
  /* ------------------------------------------------------------------ */
  function buildSession(key, c, weekUse) {
    var tpl = T[key];
    var ids = [];
    var all = [];
    var upperDay = /upper|push|pull/i.test(tpl.name), lowerDay = /lower|legs/i.test(tpl.name);
    var power = powerBlock(c, ids, weekUse, upperDay && !lowerDay);
    if (power) ids.push(power.items[0].ex);
    tpl.slots.forEach(function (sl) {
      if (c.goal === 'strength' && sl[1] === 'main' && sl[0] === 'lunge') sl = ['squat', 'main'];
      var e = pick(sl[0], sl[1], c, ids, weekUse, sl[2]);
      // nothing safe or possible for this slot (sore shoulder, no kit…)? use a neighbouring movement instead
      if (!e && FALLBACK[sl[0]]) { sl = [FALLBACK[sl[0]], sl[1] === 'main' ? 'second' : sl[1] === 'iso' ? 'acc' : sl[1]]; e = pick(sl[0], sl[1], c, ids, weekUse); }
      if (!e) return;
      ids.push(e.id);
      all.push({ e: e, role: sl[1], rx: rx(e, sl[1], c) });
    });
    var fin = finisher(c, ids);
    if (fin) fin.items.forEach(function (it) { ids.push(it.ex); });
    var start = { low: [4, 5, 6, 7], medium: [5, 6, 8, 9], high: [4, 6, 7, 8] }[c.intensity][c.minutes <= 30 ? 0 : c.minutes <= 45 ? 1 : c.minutes <= 60 ? 2 : 3];
    var chosen = all.slice(0, start);
    var minItems = Math.min(chosen.length, c.minutes <= 30 ? 3 : 4);
    var s = { name: tpl.name, key: key };
    var fit = function () { s.blocks = assemble(chosen, c, power, fin); return sessionMinutes(s, c); };
    var est = fit(), guard = 0;
    var keepFin = c.goal === 'lose' || c.goal === 'health';
    while (est > c.minutes + 2 && guard++ < 60) {
      if (fin && shrinkFinisher(fin)) { est = fit(); continue; }
      var trim = null, i;
      for (i = chosen.length - 1; i >= 0; i--) { if (chosen[i].role !== 'main' && chosen[i].role !== 'second' && chosen[i].rx.sets > 2) { trim = chosen[i]; break; } }
      if (!trim) for (i = chosen.length - 1; i >= 0; i--) { if (chosen[i].rx.sets > 3) { trim = chosen[i]; break; } }
      if (trim) { trim.rx.sets -= 1; est = fit(); continue; }
      if (fin && !keepFin) { fin = null; est = fit(); continue; }
      if (chosen.length > minItems) { chosen.pop(); est = fit(); continue; }
      if (fin) { fin = null; est = fit(); continue; }
      if (power) { power = null; est = fit(); continue; }
      var big = chosen.filter(function (x) { return x.rx.sets > 2; })[0];
      if (big) { big.rx.sets -= 1; est = fit(); continue; }
      break;
    }
    // room left? add the next exercise from the plan, as long as it still fits
    var most = c.intensity === 'low' ? Math.min(all.length, start + 1) : all.length;
    while (est < c.minutes - 7 && chosen.length < most && guard++ < 80) {
      chosen.push(all[chosen.length]);
      var e2 = fit();
      if (e2 > c.minutes + 2) { chosen.pop(); est = fit(); break; }
      est = e2;
    }
    // still short (a long session with few exercise slots): one more set on the lifts that matter most
    if (c.intensity !== 'low') {
      var capOf = function (x) { return c.minor ? 3 : x.role === 'main' || x.role === 'second' ? 4 : 3; };
      while (est < c.minutes - 8 && guard++ < 120) {
        var cand = chosen.filter(function (x) { return x.rx.sets < capOf(x); }).sort(function (a, b) { return a.rx.sets - b.rx.sets || (a.role === 'main' ? -1 : 1); })[0];
        if (!cand) break;
        cand.rx.sets += 1;
        var e3 = fit();
        if (e3 > c.minutes + 2) { cand.rx.sets -= 1; est = fit(); break; }
        est = e3;
      }
    }
    s.min = Math.round(est);
    s.warmup = warmupFor(s, c);
    s.cooldown = cooldownFor(s);
    s.kcal = kcalOf(s, c);
    s.items = flatten(s);
    return s;
  }

  /* energy (2024 Adult Compendium): straight sets 3.5–5 MET, supersets/circuits 5.8, bodyweight vigorous 6.5, HIIT 7–11 */
  function kcalOf(s, c) {
    var kcal = 0, kg = c.weight;
    kcal += 3.5 * kg * (warmMin(c) + coolMin(c)) / 60;
    s.blocks.forEach(function (b) {
      var min = blockTime(b, c) / 60;
      var met = b.met || (b.type === 'circuit' ? (c.intensity === 'high' ? 6.5 : 5.8) : b.type === 'super' ? 5.8 : b.type === 'power' ? 6 : c.intensity === 'high' ? 6 : c.intensity === 'low' ? 3.5 : 5);
      kcal += met * kg * min / 60;
    });
    return Math.round(kcal / 10) * 10;
  }

  /* teens with 4+ days: strength on 3 non-consecutive days, the rest are active days */
  function activeDay(c) {
    var pref = ['sprint', 'skipping', 'bear-crawl', 'shadow-box', 'skater-step', 'stairs', 'march'];
    var moves = pref.map(M.exercise).filter(function (e) { return e && allowed(e, c); }).slice(0, 3);
    return { name: 'Active day', key: 'active', min: 45, kcal: 0, warmup: [], cooldown: '',
      blocks: [{ type: 'active', min: 45, title: 'Play, sport or skills — 30–60 minutes', note: 'Football, cricket, badminton, cycling, swimming, dancing or games — anything that gets you moving and a bit out of breath. Add a few minutes of these:', items: moves.map(function (e) { return { ex: e.id, reps: '1–2 min' }; }) }], items: [] };
  }

  /* opts: { goal, experience, equipment, days, minutes, age, intensity, extras[], joints[], quiet, seed, weight } */
  M.buildWorkoutPlan = function (o) {
    var c = context(o);
    var days = M.clamp(+o.days || 3, 2, 6);
    var keys = SPLITS[days].slice();
    var dayList = DAY_SPREAD[days].slice();
    var teenActive = c.minor && days >= 4;
    if (teenActive) {
      // strength Mon / Wed / Fri; other days are active days
      var str = [1, 3, 5];
      if (days === 4) dayList = [1, 3, 5, 6];
      keys = dayList.map(function (d, i) { return str.indexOf(d) >= 0 ? ['fullA', 'fullB', 'fullC'][str.indexOf(d)] : 'active'; });
    }
    var weekUse = {};
    var sessions = keys.map(function (k) {
      if (k === 'active') return activeDay(c);
      var s = buildSession(k, c, weekUse);
      flatten(s).forEach(function (it) { weekUse[it.ex] = (weekUse[it.ex] || 0) + 1; });
      return s;
    });
    var cardio;
    if (c.intensity === 'low') cardio = c.minor ? 'Stay active every day in ways you enjoy — walking, cycling, games — and build up towards 60 minutes a day.' : 'Easy movement only: daily walks (6,000–8,000 steps) and 10–20 minutes of easy cycling or swimming if you like. You should be able to chat the whole time.';
    else if (c.goal === 'lose') cardio = 'Walk 7,000–10,000 steps a day, plus 20–30 minutes of easy cardio (you can talk in full sentences) on 2–3 non-lifting days.';
    else if (c.goal === 'gain') cardio = 'Keep 6,000–8,000 daily steps for health. Hard cardio can stay light while you focus on lifting and eating enough.';
    else if (c.minor) cardio = 'Aim for about 60 minutes of activity every day — sport, cycling, running, games — with vigorous play on at least 3 days.';
    else cardio = 'Add up to 150–300 minutes a week of moderate cardio (brisk walking, cycling, swimming), split however you like.';
    if (c.intensity === 'high' && !c.minor && c.goal !== 'gain') cardio += ' Once a week you can add 10-20-30 intervals on a non-lifting day: 30 s easy, 20 s steady, 10 s fast, five times in a row; rest 2 min; do 2–3 blocks.';
    var progression = c.minor
      ? 'Master the form first. When every set reaches the top of the rep range with clean reps, use the harder version (tap Swap) — with an adult or coach checking your technique.'
      : 'Double progression: when every set reaches the top of the rep range with good form twice in a row, add a little weight — or move to the harder version (tap Swap). If you can’t reach the bottom of the range, use the easier version.';
    var effort = {
      low: 'Effort about 5–6 out of 10: each set ends with 3–4 reps still in you. Easier versions, full rest.',
      medium: 'Effort about 7–8 out of 10: the last reps are slow but clean, with 2–3 reps still in you.',
      high: c.minor ? 'Effort about 8 out of 10 — harder versions and fast power work, always with clean technique and 2 reps still in you. Never to failure.' : 'Effort about 8–9 out of 10: main lifts stop 1–2 reps before failure; the last set of one small exercise can go to failure. Perfect form, full rest on main lifts.'
    }[c.intensity];
    return {
      v: 2, created: M.today(), settings: Object.assign({}, o), intensity: c.intensity, effort: effort, sessions: sessions,
      days: dayList, cardio: cardio, progression: progression, minor: c.minor,
      finisher: '', warmup: '5 minutes: raise your heart rate, move the joints you’ll use, then a lighter set of your first exercise.'
    };
  };

  /* the options a plan was built with — from the plan, or (for older plans) from the profile */
  M.workoutOpts = function (wp, p) {
    p = p || M.state.profile;
    var base = { goal: p.goal === 'lose' ? 'lose' : p.goal === 'gain' ? 'gain' : 'health', experience: p.experience || 'beginner', equipment: p.equipment || 'none', days: p.workoutDays || 3, minutes: p.sessionMin || 45, extras: p.workoutExtras || [], joints: p.workoutJoints || [], quiet: !!p.workoutQuiet };
    var o = Object.assign(base, (wp && wp.settings) || {});
    o.age = M.ageFrom(p);
    o.weight = M.latestWeight ? M.latestWeight() || 65 : 65;
    return o;
  };

  /* easier / harder / same-level options for one exercise in this plan */
  M.exAlternatives = function (id, o, inSession) {
    var e = M.exercise(id); if (!e) return { easier: [], harder: [], same: [] };
    var c = context(o);
    var others = (inSession || []).filter(function (x) { return x !== id; });
    var pool = EX.filter(function (x) { return x.pat === e.pat && x.id !== id && allowed(x, c) && others.indexOf(x.id) < 0 && (e.pat !== 'core' || !e.core || x.core === e.core || Math.abs(x.d - e.d) <= 1); });
    var near = function (a, b) { return Math.abs(a.d - e.d) - Math.abs(b.d - e.d) || (b.eq - a.eq); };
    return {
      easier: pool.filter(function (x) { return x.d < e.d; }).sort(near).slice(0, 3),
      harder: pool.filter(function (x) { return x.d > e.d; }).sort(near).slice(0, 3),
      same: pool.filter(function (x) { return x.d === e.d; }).slice(0, 4)
    };
  };

  /* swap one exercise in a plan; keeps sets and role, re-works reps for the new exercise */
  M.swapExercise = function (wp, si, tag, newId) {
    var s = wp.sessions[si]; if (!s || !s.blocks) return false;
    var c = context(M.workoutOpts(wp));
    var done = false;
    s.blocks.forEach(function (b) {
      b.items.forEach(function (it, i) {
        if (done || it.tag !== tag) return;
        var e = M.exercise(newId); if (!e) return;
        var r = rx(e, it.role || 'acc', c);
        b.items[i] = Object.assign({}, it, { ex: newId, reps: r.reps, rir: r.rir, swapped: true });
        if (b.type === 'circuit') { b.items[i].restS = 20; b.items[i].rest = '20 s'; } else { b.items[i].restS = it.restS; b.items[i].rest = it.rest; }
        done = true;
      });
    });
    if (done) { s.min = Math.round(sessionMinutes(s, c)); s.items = flatten(s); s.warmup = warmupFor(s, c); s.cooldown = cooldownFor(s); s.kcal = kcalOf(s, c); }
    return done;
  };

  /* "Push-up → Archer push-up": what changed between two plans, matched by movement and role */
  M.workoutDiff = function (a, b) {
    var out = [];
    if (!a || !b) return out;
    var keyed = function (s) {
      var seen = {}, map = {};
      M.sessionItems(s).forEach(function (it) {
        var e = M.exercise(it.ex); if (!e || it.role === 'power') return;
        var k = e.pat + '|' + (it.role || ''); seen[k] = (seen[k] || 0) + 1;
        map[k + '|' + seen[k]] = it.ex;
      });
      return map;
    };
    (b.sessions || []).forEach(function (s, si) {
      var A = a.sessions && a.sessions[si]; if (!A || out.length >= 4) return;
      var ka = keyed(A), kb = keyed(s);
      Object.keys(kb).forEach(function (k) {
        if (out.length >= 4 || !ka[k] || ka[k] === kb[k]) return;
        if (out.some(function (o) { return o.to === kb[k] || o.from === ka[k]; })) return;
        out.push({ from: ka[k], to: kb[k] });
      });
    });
    return out;
  };
  M.workoutDescribe = function (wp) {
    var s = (wp.sessions || []).filter(function (x) { return x.blocks && x.key !== 'active'; })[0];
    if (!s) return '';
    var types = s.blocks.map(function (b) { return b.type; });
    var parts = [];
    if (types.indexOf('power') >= 0) parts.push('a power exercise first');
    if (types.indexOf('circuit') >= 0) parts.push('a circuit');
    else if (types.indexOf('super') >= 0) parts.push(s.blocks.some(function (b) { return b.title === 'Tri-set'; }) ? 'supersets and a tri-set' : 'supersets');
    else parts.push('one exercise at a time with full rest');
    if (types.indexOf('finisher') >= 0) parts.push('a finisher');
    return parts.join(', ');
  };
  M.WO_TIME = { sessionMinutes: function (s, o) { return sessionMinutes(s, context(o)); } };
})();
