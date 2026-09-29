/* Mizan — Science & sources, Privacy & about */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;

  /* ------------------------------------------------------------------ */
  /* Science & sources                                                   */
  /* ------------------------------------------------------------------ */
  var REFS = [
    ['Habits & self-management', [
      ['Lally et al. (2010) — habits took 66 days on average (18–254); missing one day didn’t matter', 'https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit'],
      ['Gollwitzer & Sheeran (2006) — if–then plans, meta-analysis d = 0.65', 'https://en.wikipedia.org/wiki/Implementation_intention'],
      ['Milne, Orbell & Sheeran (2002) — exercise plans: 91% vs 35–38% follow-through', 'https://habi.app/insights/habit-tracker-statistics/'],
      ['Harkin et al. (2016) — monitoring progress helps, more when recorded and shared (138 studies)', 'https://www.sciencedaily.com/releases/2015/10/151029101349.htm'],
      ['Buehler et al. (1994) — the planning fallacy: 34 days planned, 55 taken', 'https://en.wikipedia.org/wiki/Planning_fallacy'],
      ['Dai, Milkman & Riis (2014) — the fresh start effect', 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2204126'],
      ['Breines & Chen (2012) — self-compassion increases motivation to improve', 'https://www.psychologytoday.com/us/blog/the-science-of-willpower/201206/does-self-compassion-or-criticism-motivate-self-improvement'],
      ['Oettingen — WOOP / mental contrasting with implementation intentions', 'https://woopmylife.org/en/science'],
      ['Fogg Behavior Model — behaviour = motivation × ability × prompt', 'https://behaviormodel.org/'],
      ['Bedtime procrastination and MCII (33 vs 14 minutes earlier to bed)', 'https://en.wikipedia.org/wiki/Bedtime_procrastination']
    ]],
    ['Body size & composition', [
      ['WHO — obesity and overweight fact sheet; BMI cut-offs', 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight'],
      ['CDC — adult BMI categories and BMI-for-age percentiles (2–19)', 'https://www.cdc.gov/bmi/child-teen-calculator/bmi-categories.html'],
      ['WHO — BMI-for-age reference, 5–19 years', 'https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age'],
      ['Revised definition of obesity in Asian Indians (2025) — BMI 23, waist 90/80 cm', 'https://www.cmcendovellore.org/pub/2025/revised-definition-of-obesity-in-asian-indians-living-in-india.pdf'],
      ['NHS — lower BMI thresholds for South Asian and other groups; waist under half your height', 'https://www.nhs.uk/conditions/obesity/'],
      ['Waist-to-height ratio (NICE 2022 boundaries 0.4 / 0.5 / 0.6)', 'https://en.wikipedia.org/wiki/Waist-to-height_ratio'],
      ['Harvard Health — limits of BMI', 'https://www.health.harvard.edu/blog/how-useful-is-the-body-mass-index-bmi-201603309339'],
      ['US Navy circumference method and body-fat ranges', 'https://en.wikipedia.org/wiki/Body_fat_percentage']
    ]],
    ['Energy & weight change', [
      ['Mifflin–St Jeor equation (1990)', 'https://mifflinstjeor.com/mifflin-st-jeor-equation/'],
      ['Activity multipliers and why people overestimate them', 'https://www.calculatemytdee.org/blog/activity-level-multipliers'],
      ['Hall — why the 3,500 kcal rule overestimates weight loss', 'https://www.nature.com/articles/ijo2013112'],
      ['Hall — metabolic adaptation and appetite after weight loss', 'https://www.obesityaction.org/wp-content/uploads/Why-is-it-So-Hard-to-Lose-Weight-and-Keep-it-off.pdf'],
      ['CDC — losing 1–2 lb a week is easier to keep off', 'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html'],
      ['Helms et al. (2014) — lose 0.5–1% of body weight a week', 'https://link.springer.com/article/10.1186/1550-2783-11-20'],
      ['Iraki et al. (2019) — gain 0.25–0.5% a week in a lean bulk', 'https://www.mdpi.com/2075-4663/7/7/154'],
      ['NHS — healthy weight gain for underweight adults (+300–500 kcal)', 'https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/advice-for-underweight-adults/'],
      ['The Hacker’s Diet — smoothing daily weight into a trend', 'https://www.fourmilab.ch/hackdiet/e4/signalnoise.html'],
      ['Ultra-processed diets led to ~500 kcal/day more eating (NIH RCT)', 'https://www.nih.gov/node/40356'],
      ['BMJ 2025 — intermittent fasting works about as well as daily calorie restriction', 'https://bmjgroup.com/intermittent-fasting-comparable-to-traditional-diets-for-weight-loss/']
    ]],
    ['Nutrition', [
      ['ICMR-NIN Dietary Guidelines for Indians (2024) — My Plate for the Day', 'https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf'],
      ['ICMR-NIN Nutrient Requirements (2020) — protein RDA 0.83 g/kg', 'https://www.nin.res.in/rdabook/brief_note.pdf'],
      ['WHO — healthy diet (sugar, salt, fat, fruit & veg)', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet'],
      ['ISSN position stand — protein and exercise (2017)', 'https://link.springer.com/article/10.1186/s12970-017-0177-8'],
      ['Morton et al. (2018) — protein benefits plateau around 1.6 g/kg', 'https://www.scinergy.io/learn/how-much-protein-for-muscle-gain'],
      ['Hydration: EFSA and IOM intakes', 'https://www.gssiweb.org/sports-science-exchange/article/hydration-for-health-and-wellness'],
      ['FDA — caffeine: up to 400 mg a day for adults', 'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much']
    ]],
    ['Movement & training', [
      ['WHO 2020 guidelines on physical activity and sedentary behaviour', 'https://pureadmin.qub.ac.uk/ws/files/226236258/WorldHealth.pdf'],
      ['Paluch et al. (2022) — steps and mortality', 'https://www.sciencedaily.com/releases/2022/03/220303112207.htm'],
      ['Schoenfeld et al. (2017) — 10+ weekly sets per muscle', 'https://www.ageingmuscle.be/sites/bams/files/publications/Dose%20response%20relationship%20between%20weekly%20resistance%20training%20volume%20and%20increases.pdf'],
      ['Schoenfeld et al. (2016) — train each muscle twice a week', 'https://link.springer.com/article/10.1007/s40279-016-0543-8'],
      ['Loading and the repetition continuum (2021)', 'https://www.mdpi.com/2075-4663/9/2/32'],
      ['Longer rests (3 min) on big lifts', 'https://brookbushinstitute.com/articles/longer-interset-rest-periods-enhance-muscle-strength-hypertrophy-resistance-trained-men'],
      ['NSCA — youth resistance training position statement', 'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'],
      ['Heart-rate formulas (Tanaka, Karvonen)', 'https://en.wikipedia.org/wiki/Heart_rate'],
      ['One-rep max formulas (Epley, Brzycki)', 'https://en.wikipedia.org/wiki/One-repetition_maximum'],
      ['METs — energy cost of activities', 'https://en.wikipedia.org/wiki/Metabolic_equivalent_of_task']
    ]],
    ['Walk & run tracker', [
      ['2024 Adult Compendium of Physical Activities — METs for walking and running speeds', 'https://pacompendium.com/'],
      ['Haversine formula — distance between two GPS points', 'https://en.wikipedia.org/wiki/Haversine_formula'],
      ['Step length is about 41–45% of height when walking', 'https://en.wikipedia.org/wiki/Gait'],
      ['W3C Screen Wake Lock API — keeping the screen on while tracking', 'https://www.w3.org/TR/screen-wake-lock/']
    ]],
    ['Skin care & grooming', [
      ['American Academy of Dermatology — acne: tips for managing', 'https://www.aad.org/public/diseases/acne/skin-care/tips'],
      ['American Academy of Dermatology — how to select a sunscreen', 'https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen'],
      ['American Academy of Dermatology — dark spots and hyperpigmentation', 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots'],
      ['Niacinamide in dermatology (review)', 'https://pubmed.ncbi.nlm.nih.gov/24993939/'],
      ['face-api (MIT licence) — on-device face landmarks used for face shape', 'https://github.com/vladmandic/face-api']
    ]],
    ['Sleep & screens', [
      ['CDC — how much sleep you need by age', 'https://www.cdc.gov/sleep/about/index.html'],
      ['AASM — pediatric sleep recommendations', 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866'],
      ['CDC (2025) — screen time and teen health', 'https://www.cdc.gov/pcd/issues/2025/24_0537.htm'],
      ['Adolescent sleep and circadian timing', 'https://en.wikipedia.org/wiki/Adolescent_sleep']
    ]],
    ['Designing a safe health app', [
      ['Diet & fitness apps and eating-disorder behaviours (BJPsych Open)', 'https://www.cambridge.org/core/journals/bjpsych-open/article/effects-of-diet-and-fitness-apps-on-eating-disorder-behaviours-qualitative-study/2D1EE739D97AB3EFC6573835E4C527BD'],
      ['National Center for Health Research — tracking apps and eating disorders', 'https://www.center4research.org/fitness-tracking-apps-eating-disorders/'],
      ['Duke Psychiatry — the trouble with tracking', 'https://psychiatry.duke.edu/blog/trouble-tracking'],
      ['EASO — person-first, non-stigmatising language', 'https://easo.org/wp-content/uploads/2024/05/Person-First-Language-guide-addressing-Weight-Bias.pdf'],
      ['W3C WCAG 2.2 — contrast and target size', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'],
      ['NOAA solar calculator — how sunrise and sunset are calculated', 'https://gml.noaa.gov/grad/solcalc/']
    ]]
  ];

  M.views.science = {
    head: function () { return { title: 'Science & sources', sub: 'What Mizan is built on' }; },
    render: function (el) {
      var principles = [
        ['plan', 'Plan for real life', 'People underestimate how long things take. Mizan checks your plan for buffers, sleep and overlaps, and compares planned with done.'],
        ['habits', 'Consistency over streaks', 'Habits take about two months to settle and one missed day doesn’t matter — so Mizan shows weekly consistency and helps you avoid missing twice.'],
        ['target', 'If–then plans', 'Every habit has a cue and a backup plan, and skipped blocks ask what got in the way. Specific plans roughly double follow-through.'],
        ['heart', 'Kind, not harsh', 'No red-and-green food grades or shame. Self-compassion after a slip predicts getting back on track.'],
        ['scale', 'Right numbers for the right person', 'Asian BMI cut-offs, percentiles for under-20s, safety floors on calories, and no weight-loss targets for teens.'],
        ['lock', 'Private', 'No accounts, no analytics, no servers. Your data never leaves your device unless you download a backup.']
      ];
      var total = REFS.reduce(function (a, g) { return a + g[1].length; }, 0);
      el.innerHTML = '<div class="split">' +
        '<div class="stack"><p class="lede">Mizan was designed after reviewing more than 120 studies, clinical guidelines and expert sources on habits, body composition, nutrition, exercise, sleep and safe app design. The key ones (' + total + ') are listed here.</p>' +
        '<div class="panel">' + principles.map(function (x) {
          return '<div class="principle"><span class="pi">' + M.icon(x[0]) + '</span><div><strong>' + x[1] + '</strong><p>' + x[2] + '</p></div></div>';
        }).join('') + '</div>' +
        U.note('info', '<p><strong>Not medical advice.</strong> Calculators give population estimates. If you are pregnant, have a medical condition, take medication that affects weight, or are under 18 and worried about your weight, talk to a doctor.</p>') +
        '</div>' +
        '<div class="stack">' + REFS.map(function (g) {
          return '<section class="panel"><h3 style="margin-bottom:6px">' + M.esc(g[0]) + '</h3><ul class="ref-list">' + g[1].map(function (r) {
            return '<li><a href="' + M.esc(r[1]) + '" target="_blank" rel="noopener">' + M.esc(r[0]) + '</a></li>';
          }).join('') + '</ul></section>';
        }).join('') + '</div></div>';
    }
  };

  /* ------------------------------------------------------------------ */
  /* About / privacy                                                     */
  /* ------------------------------------------------------------------ */
  M.views.about = {
    head: function () { return { title: 'Privacy & about', sub: 'How Mizan treats you and your data' }; },
    render: function (el) {
      el.innerHTML = '<div class="split"><div class="stack prose">' +
        '<div class="brand-hero">' + M.logo(56) + '<div><strong>Mizan</strong><span>Balance your day, body &amp; plate</span></div></div>' +
        '<p class="lede">Mizan means balance — of your day, your body and your plate.</p>' +
        '<h2>Your privacy</h2><ul>' +
        '<li>No sign-up and no account needed. Mizan works offline once loaded.</li>' +
        '<li>Everything you enter is saved on this device. There is no Mizan server, no ads and no analytics.</li>' +
        '<li>Backups go only where you choose: a file you keep, or a private folder in your own Google Drive.</li>' +
        '<li>Your location is used only for walks and runs (and sun times, if you turn them on), and never leaves the device.</li>' +
        '<li>Photos for the looks guide are analysed on the device and never uploaded.</li>' +
        '<li>You can back up or erase everything any time in <a href="#/settings/data">Settings</a>. Full details: <a href="privacy.html">privacy policy</a>.</li></ul>' +
        '<h2>Health note</h2><p>Mizan offers general, evidence-based guidance for healthy people. It is not a medical device and doesn’t diagnose or treat anything. Calorie and body-fat numbers are estimates.</p>' +
        '</div><div class="stack">' +
        '<section class="panel"><h3 style="margin-bottom:8px">If food, weight or mood feel hard</h3><p class="soft" style="font-size:var(--fs-sm)">You don’t have to handle it alone. Talking to someone helps.</p><ul class="list">' +
        '<li><div class="li-main"><strong>India — Tele MANAS</strong><span>Call 14416 · free, 24/7, many languages</span></div></li>' +
        '<li><div class="li-main"><strong>United States — National Alliance for Eating Disorders</strong><span>Call 866-662-1235 · weekdays</span></div></li>' +
        '<li><div class="li-main"><strong>Anywhere</strong><span><a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a> lists free helplines by country</span></div></li>' +
        '<li><div class="li-main"><strong>Emergency</strong><span>Call your local emergency number (112 in India)</span></div></li></ul></section>' +
        '<section class="panel"><h3 style="margin-bottom:8px">Credits</h3><p class="soft" style="font-size:var(--fs-sm);margin:0">Typefaces: Bricolage Grotesque and Atkinson Hyperlegible Next (SIL Open Font License). Growth reference: CDC 2000 BMI-for-age (public domain). Sun times: U.S. Naval Observatory approximation of the sun’s position. Food values: USDA FoodData Central, IFCT 2017 summaries, product labels.</p></section>' +
        '<a class="btn" href="#/science">' + M.icon('book') + 'Science & sources</a></div></div>';
    }
  };
})();
