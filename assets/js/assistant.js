/* Mizan — the assistant ("Mizo" by default).
   Works fully offline: a guided conversation (yes/no, topic buttons, how-to answers with action
   buttons) plus a small language-matching algorithm for typed questions, and answers that use the
   person's own data (what's next, BMI, water…). Name, look, greeting and extra replies are all
   customizable in Settings → Assistant. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var C = M.calc;

  var cfg = function () { return M.state.settings.bot; };
  var botName = function () { return cfg().name || 'Mizo'; };
  var firstName = function () { var n = M.state.profile.name; return n ? n.split(' ')[0] : ''; };

  /* ------------------------------------------------------------------ */
  /* Topics and answers                                                   */
  /* Each node: say (text or fn), opts [{label, go}], acts (buttons       */
  /* inside the answer), kw (words used to match typed questions)          */
  /* ------------------------------------------------------------------ */
  var TOPICS = [
    { id: 'timetable', label: 'My timetable', icon: 'plan' },
    { id: 'study', label: 'Study & focus', icon: 'book' },
    { id: 'sleep', label: 'Sleep', icon: 'moon' },
    { id: 'weight', label: 'Weight & BMI', icon: 'scale' },
    { id: 'food', label: 'Food & diet', icon: 'food' },
    { id: 'exercise', label: 'Exercise & running', icon: 'run' },
    { id: 'water', label: 'Water', icon: 'water' },
    { id: 'habits', label: 'Habits & motivation', icon: 'habits' },
    { id: 'looks', label: 'Skin, face & grooming', icon: 'face' },
    { id: 'app', label: 'Using Mizan', icon: 'settings' }
  ];

  var ACTS = {
    setup: { label: 'Answer the 5 questions', icon: 'refresh', run: function () { M.startSetup(); } },
    custom: { label: 'Build it step by step', icon: 'chat', run: function () { startBuilder(); } },
    special: { label: 'Plan specific days', icon: 'calday', run: function () { M.special.open([]); } },
    calAlarms: { label: 'Phone alarms', icon: 'bell', run: function () { M.calendar.open(); } },
    remindSet: { label: 'Reminder settings', icon: 'settings', href: '#/settings/timetable' },
    plan: { label: 'Open Plan', icon: 'plan', href: '#/plan' },
    today: { label: 'My whole day', icon: 'clock', href: '#/day' },
    dashboard: { label: 'Open Today', icon: 'today', href: '#/today' },
    health: { label: 'Open Health', icon: 'heart', href: '#/health' },
    me: { label: 'Open Me', icon: 'user', href: '#/me' },
    addBlock: { label: 'Add a block now', icon: 'plus', run: function () { var r = C.routineFor(M.today()); if (r) { M.go('plan'); setTimeout(function () { U.editBlock(r, null, function () { M.refresh(); }); }, 250); } else M.startSetup(); } },
    review: { label: 'Weekly review', icon: 'list', href: '#/review' },
    focus: { label: 'Start focus timer', icon: 'timer', run: function () { U.focusTimer(''); } },
    habits: { label: 'Add a habit', icon: 'habits', href: '#/habits' },
    goal: { label: 'Goal & calorie planner', icon: 'target', href: '#/body/goal' },
    calories: { label: 'Calorie calculator', icon: 'calc', href: '#/body/tools/calories' },
    body: { label: 'Weight & BMI', icon: 'scale', href: '#/body' },
    meal: { label: 'Make a meal plan', icon: 'food', href: '#/food/plan' },
    workout: { label: 'Workout plan', icon: 'dumbbell', href: '#/body/workouts' },
    move: { label: 'Track a walk or run', icon: 'run', href: '#/move' },
    moveHistory: { label: 'Records & history', icon: 'trophy', href: '#/move/history' },
    moveSettings: { label: 'Walk & run settings', icon: 'shield', href: '#/settings/move' },
    water1: { label: '+1 glass of water', icon: 'water', run: function () { M.water.drink(); if (M.currentRoute && M.currentRoute.name === 'today') M.refresh(); } },
    waterSet: { label: 'Water reminders', icon: 'bell', href: '#/settings/water' },
    looks: { label: 'Open the looks guide', icon: 'face', href: '#/looks' },
    look: { label: 'Appearance settings', icon: 'palette', href: '#/settings/look' },
    tabs: { label: 'Tabs & Today', icon: 'dash', href: '#/settings/home' },
    cards: { label: 'Today cards', icon: 'list', href: '#/settings/home' },
    showAll: { label: 'Show all options', icon: 'settings', run: function () { M.state.settings.showAll = true; M.save(); M.toast('All options are shown'); if (M.currentRoute) M.refresh(); } },
    backup: { label: 'Backup & restore', icon: 'cloud', href: '#/settings/data' },
    botSet: { label: 'Assistant settings', icon: 'chat', href: '#/settings/assistant' },
    install: { label: 'Install as an app', icon: 'download', run: function () { M.install(); } },
    profile: { label: 'Update my profile', icon: 'user', href: '#/settings/profile' },
    logWeight: { label: 'Log my weight', icon: 'scale', run: function () { U.weightSheet(function () { M.refresh(); }); } },
    about: { label: 'Help & helplines', icon: 'heart', href: '#/about' }
  };

  /* "Make a custom timetable" — always first in the topic lists (or "Continue" when a draft is waiting) */
  function builderOpt(long) {
    var s = M.state.tb;
    if (s && (s.blocks.length || s.wake !== null)) return { label: 'Continue my timetable', tb: { a: 'resume' }, icon: 'plan', main: true };
    return { label: long ? 'Build it with me, step by step' : 'Make a custom timetable', tb: { a: 'start' }, icon: 'plan', main: true };
  }

  function sleepNeedText() {
    var age = M.ageFrom(M.state.profile), n = C.sleepNeed(age);
    var r = C.routineFor(M.today()), planned = 0;
    if (r) C.resolveBlocks(r, M.today()).forEach(function (x) { if (x.b.cat === 'sleep') planned += x.dur; });
    return '**' + n.label + ' need ' + n.lo + '–' + n.hi + ' hours** of sleep a night.' + (planned ? '\nYour timetable gives you **' + M.fmtDur(planned) + '**' + (planned < n.lo * 60 ? ' — a bit short. Try moving bedtime earlier by 15 minutes every few days.' : ' — nicely inside the range. 👍') : '');
  }

  var N = {
    hello: {
      say: function () {
        var g = cfg().greeting && cfg().greeting.trim();
        if (g) return g.replace(/\{name\}/g, firstName() || 'there').replace(/\{bot\}/g, botName());
        return 'Hi' + (firstName() ? ' ' + firstName() : '') + '! 👋 I’m **' + botName() + '**.\nIs there something you’re **struggling with**, or something you’d like to **add** to your day?';
      },
      opts: [{ label: 'Yes, help me', go: 'topics' }, { label: 'No, thanks', go: 'no' }]
    },
    no: { say: function () { return 'No problem! I’m here whenever you need me — just tap ' + (cfg().avatar && cfg().avatar !== 'icon' ? cfg().avatar : 'the chat button') + ' any time.'; }, opts: [{ label: 'Actually, yes', go: 'topics' }, { label: 'What can you do?', go: 'about' }] },
    about: {
      say: 'I can help you:\n• build or change your **timetable**\n• study better, sleep better and build **habits**\n• understand your **BMI**, calories, food and exercise\n• look after your **skin** and choose a **hairstyle**\n• find anything in **Mizan** — settings, backup and more\nTap a topic, or just type your question.',
      opts: [{ label: 'Show topics', go: 'topics' }]
    },
    topics: {
      say: 'What would you like help with?',
      opts: function () {
        var hidden = cfg().hidden || [];
        return [builderOpt()].concat(TOPICS.filter(function (t) { return hidden.indexOf(t.id) < 0; }).map(function (t) { return { label: t.label, go: 't-' + t.id, icon: t.icon }; })).concat([{ label: 'Something else — I’ll type it', go: 'type' }]);
      }
    },
    type: { say: 'Sure — type your question below. For example: “I can’t wake up early”, “how much water should I drink?” or “what’s next?”.', opts: [{ label: 'Show topics', go: 'topics' }] },
    thanks: { say: function () { return ['You’re welcome! 😊', 'Anytime!', 'Glad I could help. 💪'][Math.floor(Math.random() * 3)]; }, opts: [{ label: 'Something else', go: 'topics' }] },

    /* --- Timetable --- */
    't-timetable': { say: 'Your timetable — what’s happening?', opts: function () { return [builderOpt(), { label: 'How do I make my timetable?', go: 'tt-make' }, { label: 'Add something to my day', go: 'tt-add' }, { label: 'I keep falling behind', go: 'tt-behind' }, { label: 'My day feels too packed', go: 'tt-packed' }, { label: 'My school / work hours changed', go: 'tt-hours' }, { label: 'Plan specific days differently', sd: { a: 'start' } }, { label: 'Reminders & phone alarms', go: 'tt-remind' }, { label: 'A different plan for weekends', go: 'tt-weekend' }]; } },
    'tt-make': {
      kw: 'make create build new timetable schedule routine plan day how set up start',
      say: 'There are two ways — pick the one you like:\n1. **Build it with me, step by step** ✍️ — tell me when you wake up, then what you do and until when, block by block, until all 24 hours are planned. At the end I tell you what’s good, what could be better and how to fix it — and fix it for you if you want.\n2. **Answer 5 quick questions** ⚡ — your day type, sleep, school or work hours, goal, exercise and study. I build the whole timetable in seconds.\nEither way, you can change any block later in **Plan**.',
      opts: function () { return [builderOpt(true), { label: 'Answer 5 quick questions', act: 'setup' }, { label: 'Another topic', go: 'topics' }]; }
    },
    'tt-add': {
      kw: 'add new block activity something tuition class gym hobby insert put',
      say: 'To add something to your day:\n1. Open **Plan** and tap **Add block** (or tap a “… unplanned” gap).\n2. Give it a name, a start and end time, and a category.\n3. If it overlaps another block, Plan shows it in red — shorten the other block.\nTip: put new habits right **after something you already do** (“after dinner, I…”) — that’s when they stick.',
      acts: ['addBlock', 'plan']
    },
    'tt-behind': {
      kw: 'behind late fall falling follow keep up miss missed fail stick',
      say: 'Falling behind is normal — most plans are too optimistic. Try this:\n• Add **10-minute short breaks** before and after big blocks.\n• **Never miss twice**: if you skip something, do a tiny version next time.\n• Put the hardest block at the time you feel sharpest.\n• Check in honestly on Today — the weekly review shows what keeps getting in the way.',
      acts: ['plan', 'review']
    },
    'tt-packed': {
      kw: 'packed busy full tired overwhelmed too much free time',
      say: 'If the day feels too full:\n• **Protect sleep first** — everything else gets harder without it.\n• Shorten long study blocks to 50–60 minutes with real breaks.\n• Keep at least 30–60 minutes of **free time** — rest isn’t wasted time.\n• Look at **Tips for your day** in Plan.',
      acts: ['plan']
    },
    'tt-hours': {
      kw: 'change changed school hours work timing new shift college',
      say: 'Easiest way: answer the 5 questions again with your new hours — Mizan rebuilds the whole timetable. Or build it yourself, step by step, with me. To change just one thing, open Plan and edit the **School / Work** block.',
      acts: ['setup', 'custom', 'plan']
    },
    'tt-weekend': {
      kw: 'weekend weekends sunday saturday every week weekly different off',
      say: 'Each day of the week follows one timetable. In **Plan**, tap **+** next to the timetable tabs to make a new one, then choose which days it’s for in its **Settings**. The 5 questions already make a separate timetable for your days off.\nOnly **one** day is different — a holiday, an exam, a trip? Use **Plan specific days** instead.',
      opts: function () { return [{ label: 'Plan specific days', sd: { a: 'start' }, icon: 'calday' }, { label: 'Another topic', go: 'topics' }]; },
      acts: ['plan']
    },
    'tt-remind': {
      kw: 'remind reminder reminders alarm alarms notify notification notifications ring before end ends ending task tasks block blocks class closed background calendar phone',
      say: function () { var on = M.state.settings.blockRemind && M.state.settings.blockRemind.on !== false, st = M.calendar ? M.calendar.status() : {}; return 'Two kinds of timetable reminders:\n• **While Mizan is open** — ' + ((M.state.settings.blockRemind || {}).before || 5) + ' minutes before a block ends you get a banner, a chime and a vibration, with what’s next. It’s **' + (on ? 'on' : 'off') + '** now.\n• **While Mizan is closed** — a website can’t ring by itself, but your phone’s calendar can. Tap **Phone alarms** in Plan: Mizan makes a calendar file with your reminders, and you add it to your calendar once.' + (st.exported ? (st.stale ? '\n⚠️ Your timetable changed since you added it — update the phone alarms.' : '\nYour calendar has reminders until **' + M.fmtDate(st.until, 'short') + '**.') : ''); },
      opts: function () { return [{ label: 'Set up phone alarms', act: 'calAlarms', main: true }, { label: 'Reminder settings', act: 'remindSet' }, { label: 'Something else', go: 'topics' }]; }
    },
    'tt-special': {
      kw: 'specific particular certain date dates holiday holidays vacation chhutti chutti trip leave festival different differently special one day calendar off',
      say: 'Any day can have its own plan — a **holiday**, an **exam day**, a **trip** or a festival — without changing your usual week.\n1. In **Plan**, tap **Plan specific days**.\n2. Tap the days on the calendar.\n3. Choose **Day off / holiday** (pick your wake-up time — no school or work), **Copy my usual day** (then change what’s different) or **Step by step** with me.\nOn those dates the special plan replaces your usual one; every other day stays the same. You can also just tell me, like “tomorrow is a holiday” or “plan 5 to 8 Oct differently”.',
      opts: function () { return [{ label: 'Plan specific days now', sd: { a: 'start' }, icon: 'calday', main: true }, { label: 'Another topic', go: 'topics' }]; }
    },

    /* --- Study --- */
    't-study': { say: 'Study & focus — pick the closest one:', opts: [{ label: 'I can’t focus', go: 'st-focus' }, { label: 'I forget what I study', go: 'st-remember' }, { label: 'I keep procrastinating', go: 'st-procrast' }, { label: 'I have an exam soon', go: 'st-exam' }] },
    'st-focus': {
      kw: 'focus concentrate concentration distract distracted phone attention study',
      say: 'To focus better:\n• Put your **phone in another room** — even a silent phone on the desk pulls attention.\n• Use a **25/5 focus timer**: 25 minutes on one task, 5 minutes to stand up and move.\n• Write down the one thing you’ll do before you start.\n• Hard to start? Promise yourself just **2 minutes** — starting is the hardest part.',
      acts: ['focus']
    },
    'st-remember': {
      kw: 'forget forgot remember memory memorise memorize revise revision recall learn study studied',
      say: 'Re-reading feels productive but doesn’t stick. What works:\n• **Test yourself**: close the book and write or say what you remember.\n• **Space it out**: revise after 1 day, 3 days and 1 week.\n• **Teach it** to someone (or to an empty chair).\n• Mix different types of questions instead of doing 20 of the same.',
      acts: ['plan']
    },
    'st-procrast': {
      kw: 'procrastinate procrastinating procrastination lazy delay later postpone aalas',
      say: 'Procrastination is usually about the task feeling too big. Try:\n• Make the first step **tiny**: “open the book to page 42”.\n• Make an **if–then plan**: “If it’s 4:10 pm, then I start maths.”\n• Remove the easy distraction first (phone, YouTube tab).\n• Reward yourself after, not before.',
      acts: ['focus', 'habits']
    },
    'st-exam': {
      kw: 'exam test exams board boards paper preparation prepare marks',
      say: 'For an upcoming exam:\n1. List the chapters and plan backwards from the exam date.\n2. Do **past papers** under time limits — the closest thing to the real exam.\n3. Spend extra time on weak topics, not the ones you already know.\n4. Sleep 8+ hours the week before — memory is saved during sleep.',
      acts: ['plan', 'focus']
    },

    /* --- Sleep --- */
    't-sleep': { say: 'Sleep — what’s the problem?', opts: [{ label: 'I can’t fall asleep', go: 'sl-cant' }, { label: 'I can’t wake up early', go: 'sl-wake' }, { label: 'How much sleep do I need?', go: 'sl-how' }] },
    'sl-cant': {
      kw: 'cant sleep fall asleep insomnia awake night bed',
      say: 'To fall asleep more easily:\n• Wake up at the **same time every day** — even on weekends.\n• **Screens off 30–60 minutes** before bed (your “wind down” block).\n• Keep the room dark and cool.\n• No tea, coffee or energy drinks after 2 pm.\n• Awake for 20+ minutes? Get up and read somewhere dim, then try again.',
      acts: ['plan']
    },
    'sl-wake': {
      kw: 'wake early morning alarm snooze get up oversleep uthna',
      say: 'Waking up early starts the night before:\n• Move bedtime earlier by **15 minutes every 2–3 days** until you get enough sleep.\n• Put the alarm **across the room** so you have to stand up.\n• Get **daylight** in the first 30 minutes — it resets your body clock.\n• Keep the same wake-up time on weekends (±30 minutes).',
      acts: ['setup', 'plan']
    },
    'sl-how': { kw: 'how much sleep hours need enough', say: sleepNeedText, acts: ['plan'] },

    /* --- Weight --- */
    't-weight': { say: 'Weight & BMI — what would you like to know?', opts: [{ label: 'What’s my BMI?', go: 'bmi-mine' }, { label: 'How do I lose weight?', go: 'wt-lose' }, { label: 'How do I gain weight / muscle?', go: 'wt-gain' }, { label: 'How many calories do I need?', go: 'wt-cal' }] },
    'bmi-mine': {
      kw: 'bmi body mass index healthy weight fat thin overweight underweight',
      say: function () {
        var b = M.bmiInfo();
        if (b.missing) return 'I need your **' + b.missing.join(' and ') + '** to work out your BMI. Add them and ask me again!';
        if (b.needSex) return 'Your BMI is **' + M.fmt(b.bmi, 1) + '**. Under 20, it’s judged by age and sex — add your sex in your profile to see what it means for you.';
        return 'Your BMI is **' + M.fmt(b.bmi, 1) + '** — **' + b.label + '**' + (b.teen ? ' (' + Math.round(b.pct) + 'th percentile for your age)' : '') + '.\nA healthy weight for your height is about **' + M.showW(b.range.min) + '–' + M.showW(b.range.max) + ' ' + M.wUnit() + '**.\n' + b.advice + '\nBMI is a quick check — it can’t tell muscle from fat.';
      },
      acts: ['body', 'logWeight', 'profile']
    },
    'wt-lose': {
      kw: 'lose weight loss fat slim belly reduce kam',
      say: function () {
        var age = M.ageFrom(M.state.profile);
        if (age !== null && age < 18) return 'While you’re still growing, focus on **habits, not dieting**:\n• Be active for about **60 minutes a day** — sport, walking, cycling.\n• Fewer sugary drinks, packaged snacks and fried food.\n• Regular meals with plenty of vegetables and some protein.\n• Enough sleep — tired bodies crave junk.\nIf you’re worried about your weight, talk to a doctor or a parent.';
        return 'Steady weight loss that lasts:\n• Aim for about **0.5 kg a week** — a daily deficit of ~300–500 kcal.\n• **Protein at every meal** (dal, paneer, eggs, curd, chana) keeps you full.\n• Half your plate vegetables; smaller portions of rice and roti.\n• **Walk** every day, and do strength training 2–3 times a week.\n• Sleep 7–9 hours — short sleep increases hunger.';
      },
      acts: ['goal', 'meal', 'move']
    },
    'wt-gain': {
      kw: 'gain weight muscle bulk mass skinny thin build muscles strong',
      say: 'To gain weight the healthy way:\n• Eat about **300–500 kcal more** than you burn — add a snack or two (milk, peanuts, banana, paneer, eggs).\n• **Protein** around 1.2–1.6 g per kg of body weight a day.\n• **Strength training 3 times a week** — it tells your body to build muscle, not just fat.\n• Gain slowly: about 0.25–0.5 kg a week.\n• Sleep 8+ hours — muscle is built while you rest.',
      acts: ['workout', 'meal', 'goal']
    },
    'wt-cal': {
      kw: 'calories calorie kcal eat tdee bmr maintenance',
      say: function () {
        var p = M.state.profile, w = M.latestWeight(), age = M.ageFrom(p);
        if (!w || !p.heightCm || !age) return 'I need your age, height and weight to estimate that. Add them in your profile, or use the calorie calculator.';
        var bmr = C.bmrMifflin(w, p.heightCm, age, p.sex), act = C.activity(p.activity);
        return 'At about **' + M.fmt(M.round(bmr * act.f, 10)) + ' kcal a day** your weight should stay steady (' + act.label.toLowerCase() + ').\nTo lose: ~300–500 less. To gain: ~300–500 more.' + (age < 18 ? '\nYou’re still growing, so treat this as a rough guide — growing bodies often need more.' : '');
      },
      acts: ['calories', 'goal']
    },

    /* --- Food --- */
    't-food': { say: 'Food & diet — what do you need?', opts: [{ label: 'Make me a meal plan', go: 'fd-plan' }, { label: 'What’s a healthy plate?', go: 'fd-plate' }, { label: 'Good protein sources', go: 'fd-protein' }, { label: 'I eat too much junk food', go: 'fd-junk' }] },
    'fd-plan': { kw: 'meal plan diet food menu weekly', say: 'Mizan can make a **7-day meal plan** for your calories, diet (veg, egg, non-veg or vegan), cuisine and allergies — with a grocery list. Open the meal plan and tap **Make my plan**.', acts: ['meal'] },
    'fd-plate': { kw: 'healthy plate balanced food thali nutrition', say: 'A simple healthy plate (from India’s ICMR-NIN guidelines):\n• **Half**: vegetables and fruit\n• **A quarter**: whole grains — roti, rice, millets\n• **A quarter**: protein — dal, beans, paneer, eggs, fish or chicken\n• Plus a bowl of **curd or milk**\nGo easy on sugar, salt, and fried or packaged food.', acts: ['meal'] },
    'fd-protein': { kw: 'protein sources veg vegetarian eggs paneer dal soya', say: 'Good protein sources (roughly):\n• Paneer 100 g — **18 g**\n• Soya chunks 30 g dry — **16 g**\n• 2 eggs — **12 g**\n• Dal or rajma, 1 katori cooked — **7–9 g**\n• Milk, 1 glass — **6 g**\n• Curd, 1 katori — **5 g**\n• Peanuts 30 g — **7 g**\nSpread protein across your meals instead of one big serving.', acts: ['meal'] },
    'fd-junk': { kw: 'junk chips sweets sugar cravings snacks fast', say: 'To cut down on junk without feeling deprived:\n• Don’t keep it at home — you eat what’s in front of you.\n• **Plan snacks**: fruit, roasted chana, peanuts, curd.\n• Eat **regular meals** — skipping meals leads to cravings.\n• Drink a glass of water first; thirst often feels like hunger.\n• Enjoy a treat sometimes — slowly, without guilt.', acts: ['meal', 'water1'] },

    /* --- Exercise --- */
    't-exercise': { say: 'Exercise & running — what would help?', opts: [{ label: 'How do I start exercising?', go: 'ex-start' }, { label: 'Start running from zero', go: 'ex-c25k' }, { label: 'Make my workout easier or harder', go: 'ex-intensity' }, { label: 'Swap an exercise', go: 'ex-swap' }, { label: 'Track a walk or run', go: 'ex-run' }, { label: 'Is the distance accurate?', go: 'ex-gps' }, { label: 'Staying safe on walks', go: 'ex-safe' }, { label: 'My records & badges', go: 'ex-records' }, { label: 'I don’t have time to exercise', go: 'ex-time' }] },
    'ex-start': {
      kw: 'start exercise begin beginner fitness',
      say: function () {
        var age = M.ageFrom(M.state.profile);
        return 'Start small and build up:\n• **Walk** 20–30 minutes most days.\n• **Strength** 2–3 times a week — squats, push-ups, rows (Mizan makes a plan for your equipment).\n• Add a little each week: a few more minutes or a few more reps.\n• Most days should feel comfortable — you should be able to talk.' + (age !== null && age < 18 ? '\nFor teens, the goal is about **60 minutes of activity a day** — sport counts!' : '\nAdults: aim for **150–300 minutes** a week.');
      },
      acts: ['workout', 'move']
    },
    'ex-intensity': { kw: 'intensity intense harder easier tougher lighter low medium high level workout difficulty hard easy', say: 'Your workout plan has 3 intensities — and each one changes the **exercises**, not just the reps:\n• **Low — easy**: easier versions (incline push-ups, sit-to-stands, glute bridges), one exercise at a time, full rest, 3–4 reps left.\n• **Medium — steady**: standard versions, smaller exercises in supersets to save time, 2–3 reps left.\n• **High — hard**: harder versions (one leg or arm, pauses, feet-up push-ups, Bulgarian split squats…), a power move first, supersets or a circuit and a finisher, 1–2 reps left.\nSwitch any time on the plan, or tell me “make my workout harder” or “easier”. Every 5–6 weeks, an easy week helps you come back stronger.', acts: ['workout'] },
    'ex-swap': { kw: 'swap replace change exercise too hard cant can\'t cannot do one pull-up pullup push-up pushup easier version harder version alternative instead hurts no bar', say: 'Any exercise in your plan can be swapped: tap the **swap button** next to it (two arrows). You’ll see **easier**, **similar** and **harder** versions of the same movement, so the plan stays balanced.\n• Can’t do a push-up yet? Incline push-ups (hands on a table) lift about 40–55% of your weight; knee push-ups about 50%.\n• No pull-up bar? Towel rows on a door frame and backpack pullovers work the same muscles. Tell the plan you have a bar under **Change plan → More options**.\n• When you can do the top of the rep range easily, Mizan suggests the harder version next time.', acts: ['workout'] },
    'ex-run': { kw: 'track run walk distance steps km gps', say: 'Open **Run & walk**, pick Walk or Run and tap **Start**. Keep Mizan open with the screen on — it shows distance, time, pace, steps and calories, and you can pause any time. Tap **Stop** to see your summary.', acts: ['move'] },
    'ex-c25k': { kw: 'couch 5k c25k start running beginner from zero never run program plan interval jog jogging first', say: function () { var nx = M.c25k && M.c25k.next(), p = nx && M.c25k.parse(nx); return '**Couch to 5K** takes you from the sofa to running 30 minutes without stopping in **9 weeks** — 3 runs a week, about 30 minutes each, with walking breaks at first (NHS plan).\nIn **Run & walk**, tap **Start this run** on the Couch to 5K card. I tell you when to run and when to walk — with voice, tones and vibration — and tick off each run.' + (p ? '\nYour next one: **Week ' + p.w + ', run ' + p.r + '** — ' + M.c25k.describe(nx) + '.' : '\nYou’ve finished the plan — brilliant! 🎉'); }, acts: ['move'] },
    'ex-gps': { kw: 'accurate accuracy wrong distance gps strava garmin watch off incorrect short long precise', say: 'Mizan works like the big running apps: it filters each GPS fix while you move, then **re-measures the whole track** when you finish (fixes before and after each point make corners and wobble clearer — Strava does this after upload too). It learns your **step length** from GPS walks, like a watch does.\nFor the best result:\n• Open **Run & walk** a minute early, outdoors — wait for **GPS ready**.\n• Keep the screen on (Mizan does this) — a website gets no GPS with the screen locked.\n• Carry the phone high (hand or armband), not deep in a bag.\n• Tall buildings and trees make any phone less accurate. Watches with dual-band GPS do better there.\n• On a treadmill, type the treadmill’s distance at the end — Mizan calibrates from it.', acts: ['move'] },
    'ex-safe': { kw: 'safe safety alone night share location emergency contact help alarm family track me', say: 'For walks and runs:\n• In **Me → Settings → Walk & run**, add a **safety contact**. While you’re out, tap **Share my location** — I open a message with a map link, you press Send.\n• Turn on **Alarm if I stop moving**: if you don’t move for a few minutes I ask “Are you OK?”; no answer → a loud alarm so people nearby notice, and one tap to text your contact.\n• A website can’t send messages or share your location in the background by itself — apps with a server (like Strava Beacon) can.\n• Tell someone your route, carry ID, and pick lit, busy routes at night.', opts: function () { return [{ label: 'Open safety settings', act: 'moveSettings' }, { label: 'Something else', go: 'topics' }]; } },
    'ex-records': { kw: 'record records best fastest pr personal badge badges achievement achievements medal trophy', say: function () { var r = M.move && M.move.records ? M.move.records('run') : null, k = r && r.best['5 km']; return 'After every GPS walk or run, Mizan finds your **fastest 400 m, 1 km, 1 mile, 5 km, 10 km**… inside it, and tells you when you beat a record. **Badges** come for firsts, streaks, total distance, Couch to 5K and more.' + (k ? '\nYour best 5 km run: **' + Math.floor(k.sec / 60) + ':' + M.pad(k.sec % 60) + '**.' : '') + '\nSee them in **Run & walk → Records & history**.'; }, acts: ['moveHistory'] },
    'ex-time': { kw: 'no time busy exercise short', say: 'No time? Small bits add up:\n• **10-minute** walks after meals count.\n• Take the stairs; walk while on phone calls.\n• A 7-minute bodyweight circuit at home.\n• Put a short exercise block in your timetable so it has a fixed time.', acts: ['addBlock', 'move'] },

    /* --- Water --- */
    't-water': { say: 'Water — what would you like?', opts: [{ label: 'How much should I drink?', go: 'wa-how' }, { label: 'Remind me to drink water', go: 'wa-remind' }, { label: 'Log a glass now', go: 'wa-log' }] },
    'wa-how': {
      kw: 'how much water drink glasses litres liters hydration',
      say: function () { var g = M.water.goalGlasses(), ml = M.water.glassMl(); return 'For you, about **' + g + ' glasses** a day (' + M.fmt(g * ml / 1000, 1) + ' L with ' + ml + ' ml glasses). Drink more when it’s hot or you exercise.\nToday so far: **' + M.water.glasses() + ' glasses**. A good sign: pale yellow urine.'; },
      acts: ['water1', 'waterSet']
    },
    'wa-remind': { kw: 'remind reminder water alert notify notification forget', say: function () { var w = M.state.settings.water; return 'Water reminders are **' + (w.remind ? 'on' : 'off') + '**.' + (w.remind ? '\nEvery time you log a glass, the countdown starts again. ' + M.fmtDur(w.everyMin) + ' later you get a reminder with a vibration' + (w.sound !== false ? ' and a chime' : '') + ' — tap **I drank a glass** or **In 15 min**. ' + M.water.nextText() + '.' : '') + '\nChange the time, sound and notifications in Water settings.'; }, acts: ['waterSet'] },
    'wa-log': { say: function () { M.water.add(1); M.state.waterSnooze = 0; M.waterReminder.check(); return 'Done — **' + M.water.glasses() + ' of ' + M.water.goalGlasses() + '** glasses today. 💧\n' + M.water.nextText() + '.'; } },

    /* --- Habits --- */
    't-habits': { say: 'Habits & motivation — what’s going on?', opts: [{ label: 'Start a new habit', go: 'hb-start' }, { label: 'I’ve lost motivation', go: 'hb-motiv' }, { label: 'I feel stressed or low', go: 'hb-stress' }] },
    'hb-start': { kw: 'habit new start build daily', say: 'A habit that sticks has 3 parts:\n1. **Tiny** — so small you can’t fail (“1 page”, “5 push-ups”).\n2. **A cue** you already have — “After I brush my teeth, I…”\n3. **A backup plan** — “If I’m late, I’ll do it before bed.”\nIt takes about 2 months to feel automatic — missing one day doesn’t reset anything.', acts: ['habits'] },
    'hb-motiv': { kw: 'motivation unmotivated give up quit discipline consistency consistent bored', say: 'Motivation usually comes **after** you start, not before. Try:\n• Shrink the goal for this week until it feels easy.\n• **Never miss twice** — one missed day is fine.\n• Look at what you *did* do in your weekly review.\n• Be kind to yourself — people who are self-compassionate get back on track faster.', acts: ['review', 'habits'] },
    'hb-stress': { kw: 'stress stressed anxious anxiety sad low depressed lonely tension worried cry upset', say: 'I’m sorry you’re feeling this way. A few things can help right now:\n• Breathe slowly: in for 4, out for 6, for one minute.\n• Step outside or take a short walk.\n• **Talk to someone you trust** — a friend, parent or teacher.\nIf things feel very heavy, please reach out: in India call **Tele MANAS 14416** (free, 24/7), or find a helpline in your country at **findahelpline.com**. In an emergency, call **112**.', acts: ['about'] },

    /* --- Looks --- */
    't-looks': { say: 'Skin, face & grooming — what would you like?', opts: [{ label: 'Make my personal guide', go: 'lk-guide' }, { label: 'Pimples / acne', go: 'lk-acne' }, { label: 'Which hairstyle suits me?', go: 'lk-hair' }, { label: 'Oily or dry skin', go: 'lk-skin' }] },
    'lk-guide': { kw: 'skin care guide skincare routine face grooming looks glow', say: 'The **Looks guide** asks a few quick questions and (if you like) looks at a photo **on your phone** to find your face shape. You get a morning and night skincare routine, what to use, and hairstyle and beard ideas for your face shape. The photo is never uploaded.', acts: ['looks'] },
    'lk-acne': { kw: 'pimple acne breakout breakouts spots blackheads whiteheads', say: 'For pimples:\n• Wash your face **twice a day** with a gentle cleanser — not more.\n• Use an oil-free, **non-comedogenic** moisturiser and **sunscreen**.\n• Look for **salicylic acid** (0.5–2%) or **benzoyl peroxide** (2.5%) — start every other day.\n• **Don’t pick or squeeze** — it leaves marks.\n• Change pillowcases often; keep your phone screen clean.\nIf acne is painful, leaves scars or doesn’t improve in 2–3 months, see a dermatologist.', acts: ['looks'] },
    'lk-hair': { kw: 'hairstyle haircut style beard suit face shape', say: 'It depends mostly on your **face shape** and hair type. The Looks guide can find your face shape from a photo (on your phone only) and suggest hairstyles and, if you want, beard styles.', acts: ['looks'] },
    'lk-skin': { kw: 'oily dry combination sensitive skin type', say: '• **Oily**: gel cleanser, light oil-free moisturiser, niacinamide, gel sunscreen.\n• **Dry**: cream cleanser, a thicker moisturiser with ceramides, avoid hot water.\n• **Combination**: gentle cleanser, light moisturiser, extra on dry patches.\n• **Sensitive**: fragrance-free everything, patch-test new products.\nEveryone: **sunscreen SPF 30+** in the day.', acts: ['looks'] },

    /* --- Using Mizan --- */
    't-app': { say: 'Using Mizan — what would you like to do?', opts: [{ label: 'Change how Mizan looks', go: 'app-look' }, { label: 'Change tabs or Today cards', go: 'app-tabs' }, { label: 'Where did something go?', go: 'app-where' }, { label: 'Back up my data / new phone', go: 'app-backup' }, { label: 'Change how you look', go: 'app-bot' }, { label: 'Install Mizan as an app', go: 'app-install' }, { label: 'Is my data private?', go: 'app-privacy' }] },
    'app-look': { kw: 'theme dark mode color appearance font text size customize design', say: 'Go to **Me → Settings → Appearance**. You can change the theme (light/dark), highlight colour and text size — and under **More options**: corners, spacing, animations, the font and every category colour.', acts: ['look'] },
    'app-tabs': { kw: 'tabs bottom bar navigation dashboard cards home screen', say: '**Me → Settings → Tabs & Today** lets you choose up to 5 bottom tabs (any screen can be a tab), which screen Mizan opens on, and which cards Today shows and in what order. Cards that are off are still one tap away under **Show more cards** on Today.', acts: ['tabs', 'cards'] },
    'app-where': { kw: 'where moved find gone missing dashboard body old layout version 3 new look simpler more options advanced', say: 'Mizan 3.0 is simpler, but **nothing was removed**:\n• **Today** is the old Dashboard. The dial and every block are under **See my whole day**.\n• **Health** has Weight & BMI, Food, Workouts, Walk & run, Looks and Calculators.\n• **Me** has Habits, Weekly review, Records & badges and Settings.\n• Plan → **More** has Build step by step, Plan specific days, Phone alarms, Templates and Print.\n• Extra fields are under **More options** — or turn on **Show all options**.\n• The ☰ menu at the top lists every screen.', acts: ['health', 'me', 'showAll'] },
    'app-backup': { kw: 'backup restore phone lose data google drive transfer', say: 'Go to **Me → Settings → Backup & restore**:\n• **Google Drive** — connect once and Mizan saves a private backup in your own Drive.\n• **Backup file** — save a file (optionally with a password) anywhere you like.\nOn a new phone, open Mizan and tap **Restore my data**.', acts: ['backup'] },
    'app-bot': { kw: 'assistant chatbot bot name avatar bubble', say: 'You can rename me, change my avatar, bubble colours and shape, text size, where my button sits, my first message — and teach me your own replies. It’s all in **Me → Settings → Assistant** (style and replies are under **More options**).', acts: ['botSet'] },
    'app-install': { kw: 'install app home screen download apk play store mobile phone iphone android', say: 'Tap **Install as an app** below — Mizan shows the exact steps for your phone and browser:\n• **Android (Chrome)**: ⋮ menu → **Add to Home screen** / **Install app**.\n• **iPhone (Safari)**: Share → **Add to Home Screen** → Add.\n• Opened from **Instagram or WhatsApp**? Open Mizan in Chrome or Safari first — apps can’t be installed from inside other apps.', acts: ['install'] },
    'app-privacy': { kw: 'privacy private data safe secure share server account', say: 'Your data stays **on your device**. There’s no Mizan account, server, ads or tracking. Backups only go where you choose — a file you keep, or a private folder in your own Google Drive. Photos in the looks guide are analysed on the phone and never uploaded.', acts: ['backup'] },

    /* --- Answers from the person's own data (for typed questions) --- */
    'q-now': {
      kw: 'now current right doing',
      say: function () {
        var d = M.dayNow();
        if (d.none) return 'You don’t have a timetable yet — want to build one?';
        if (!d.cur) return 'Nothing is planned right now.' + (d.upcoming[0] ? ' Next: **' + d.upcoming[0].b.title + '** at ' + M.fmtTime(d.upcoming[0].start) + '.' : '');
        return 'Right now: **' + d.cur.b.title + '** (' + M.fmtTime(d.cur.start) + '–' + M.fmtTime(d.cur.end) + ') — **' + M.fmtDur(Math.round(d.loc.left)) + ' left**.' + (d.cur.b.notes ? '\n' + d.cur.b.notes : '');
      },
      acts: ['dashboard']
    },
    'q-next': {
      kw: 'next after upcoming left until',
      say: function () {
        var d = M.dayNow();
        if (d.none || !d.upcoming.length) return 'Nothing else is planned today.';
        var n = d.upcoming[0], inMin = (n.start - d.now + 1440) % 1440;
        return 'Next: **' + n.b.title + '** at ' + M.fmtTime(n.start) + ' — in **' + M.fmtDur(Math.max(1, inMin)) + '**.' + (d.upcoming[1] ? '\nAfter that: ' + d.upcoming[1].b.title + ' at ' + M.fmtTime(d.upcoming[1].start) + '.' : '');
      },
      acts: ['today']
    },
    'q-water-today': { kw: 'water today drank glasses', say: function () { return 'Today: **' + M.water.glasses() + ' of ' + M.water.goalGlasses() + ' glasses**. ' + M.water.sinceText() + '.'; }, acts: ['water1'] },
    'q-ran': { kw: 'far ran walked distance week km steps', say: function () { var t = M.activityToday ? M.activityToday() : { km: 0, steps: 0 }, w = M.activityWeek ? M.activityWeek() : { km: 0, n: 0 }; return 'Today: **' + M.fmt(t.km, 2) + ' km** and about **' + M.fmt(t.steps) + ' steps** tracked. This week: **' + M.fmt(w.km, 1) + ' km** in ' + w.n + ' ' + M.plural(w.n, 'session') + '.'; }, acts: ['move'] }
  };

  /* ------------------------------------------------------------------ */
  /* Understanding typed messages                                         */
  /* ------------------------------------------------------------------ */
  var SYN = {
    schedule: 'timetable', routine: 'timetable', timetabl: 'timetable', plan: 'timetable',
    pimpl: 'pimple', zit: 'pimple', acn: 'acne',
    nahi: 'cant', nahin: 'cant', neend: 'sleep', nind: 'sleep', slep: 'sleep', sleepy: 'sleep', insomnia: 'sleep', sleeping: 'sleep',
    paani: 'water', pani: 'water', hydrat: 'water',
    padhai: 'study', parhai: 'study', studi: 'study', studying: 'study',
    wazan: 'weight', vajan: 'weight', motapa: 'fat', mota: 'fat', patla: 'thin',
    khana: 'food', diet: 'food', meal: 'food', eat: 'food', eating: 'food',
    gym: 'exercise', workout: 'exercise', excercise: 'exercise', exercis: 'exercise', jogging: 'run', jog: 'run', running: 'run', runn: 'run',
    haircut: 'hairstyle', hair: 'hairstyle', dadhi: 'beard',
    colour: 'color', customise: 'customize', customiz: 'customize'
  };
  var STOP = 'i me my a an the to of and or is am are be it in on for with do does did can could how what whats which why when please want would like just really very so need should get got have has this that there you your im dont'.split(' ');
  function stem(w) {
    if (SYN[w]) return SYN[w];
    var s = w.replace(/(ing|ed|es|s)$/, '');
    if (s.length < 3) s = w;
    return SYN[s] || s;
  }
  function tokens(text) {
    return String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).filter(function (w) { return STOP.indexOf(w) < 0; }).map(stem);
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  var INDEX = null, DF = {};
  function index() {
    if (!INDEX) {
      INDEX = Object.keys(N).filter(function (id) { return N[id].kw; }).map(function (id) { return { id: id, kw: tokens(N[id].kw) }; });
      INDEX.forEach(function (e) { e.kw.forEach(function (k, i, a) { if (a.indexOf(k) === i) DF[k] = (DF[k] || 0) + 1; }); });
    }
    return INDEX;
  }
  /* words that appear in many answers (like "time") count for less */
  function weight(k) { return 1 / Math.sqrt(DF[k] || 1); }
  /* Score every answer by how many of the message's words it knows (with typo tolerance) → [{id, score}] */
  function understand(text) {
    var tk = tokens(text);
    if (!tk.length) return [];
    return index().map(function (e) {
      var score = 0;
      tk.forEach(function (t) {
        var best = 0;
        e.kw.forEach(function (k) {
          var w = weight(k);
          if (k === t) best = Math.max(best, w);
          else if (t.length >= 5 && k.length >= 5 && lev(t, k) <= 1) best = Math.max(best, 0.7 * w);
          else if (t.length >= 4 && k.length >= 4 && (k.indexOf(t) === 0 || t.indexOf(k) === 0)) best = Math.max(best, 0.5 * w);
        });
        score += best;
      });
      return { id: e.id, score: score / Math.sqrt(tk.length + 1) };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
  }
  function customReply(text) {
    var t = ' ' + String(text).toLowerCase() + ' ';
    var list = cfg().custom || [];
    for (var i = 0; i < list.length; i++) {
      var trig = (list[i].q || '').toLowerCase().split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (trig.some(function (w) { return t.indexOf(w) >= 0; })) return list[i].a;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */
  function md(s) {
    var h = M.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    var out = '', list = null;
    h.split('\n').forEach(function (l) {
      var bullet = /^[•-]\s+(.*)$/.exec(l), num = /^(\d+)\.\s+(.*)$/.exec(l);
      if (bullet || num) {
        var tag = bullet ? 'ul' : 'ol';
        if (list !== tag) { if (list) out += '</' + list + '>'; out += '<' + tag + '>'; list = tag; }
        out += '<li>' + (bullet ? bullet[1] : num[2]) + '</li>';
      } else {
        if (list) { out += '</' + list + '>'; list = null; }
        if (l.trim()) out += '<p>' + l + '</p>';
      }
    });
    if (list) out += '</' + list + '>';
    return out;
  }
  function ava() { var a = cfg().avatar || '✨'; return a === 'icon' ? M.icon('chat') : M.esc(a); }

  var hosts = [];
  var chatDlg = null;
  function history() { return M.state.chat || (M.state.chat = []); }
  function persist() {
    if (history().length > 80) M.state.chat = history().slice(-80);
    if (cfg().remember !== false) M.save();
  }
  function nodeMsg(id) {
    var n = N[id];
    if (!n) return null;
    var say = typeof n.say === 'function' ? n.say() : n.say;
    var opts = typeof n.opts === 'function' ? n.opts() : (n.opts || null);
    if (!opts) opts = [{ label: 'That helps, thanks', go: 'thanks' }, { label: 'Another topic', go: 'topics' }];
    return { from: 'bot', text: say, node: id, opts: opts, acts: n.acts || [], t: Date.now() };
  }
  function bubble(m, isLast) {
    if (m.from === 'me') return '<div class="msg me"><div class="bubble">' + M.esc(m.text) + '</div></div>';
    var acts = (m.acts || []).map(function (a) { var A = ACTS[a]; return A ? '<button type="button" class="chat-act" data-act="' + a + '">' + M.icon(A.icon) + M.esc(A.label) + '</button>' : ''; }).join('');
    var opts = isLast && m.opts && m.opts.length ? '<div class="chat-opts" role="group" aria-label="Choose a reply">' + m.opts.map(function (o, i) { return '<button type="button" class="chat-opt' + (o.main ? ' main' : '') + '" data-opt="' + i + '">' + (o.icon ? M.icon(o.icon) : '') + M.esc(o.label) + '</button>'; }).join('') + '</div>' : '';
    var extra = (m.prog ? progHtml(m.prog) : '') + (m.day ? dayHtml(m.day, isLast) : '');
    if (isLast && m.cal && sd()) { if (!sdCal) sdCal = M.special.calState(sd().dates, { done: 'Next' }); extra += '<div class="chat-cal">' + M.special.calHtml(sdCal) + '</div>'; }
    var picker = isLast && m.picker ? '<form class="chat-time"><input class="input" type="time" name="t" required value="' + M.esc(m.picker.value || '') + '" aria-label="' + M.esc(m.picker.label || 'Time') + '"><button type="submit" class="btn btn-primary btn-sm">' + M.icon('check') + 'Set</button></form>' : '';
    return '<div class="msg bot"><span class="ava" aria-hidden="true">' + ava() + '</span><div class="bot-col"><div class="bubble' + (m.day ? ' has-day' : '') + '">' + md(m.text) + extra + (acts ? '<div class="chat-acts">' + acts + '</div>' : '') + '</div>' + opts + picker + '</div></div>';
  }
  /* 24 hours as a bar that fills from wake-up, while building */
  function progHtml(p) {
    var used = 0;
    var segs = p.blocks.map(function (b) {
      var h = '<span style="left:' + (used / 14.4).toFixed(3) + '%;width:' + (b.dur / 14.4).toFixed(3) + '%;--cat:' + M.catVar(b.cat) + '"></span>';
      used += b.dur; return h;
    }).join('');
    return '<div class="tb-prog"><div class="tb-ends" aria-hidden="true"><span>' + M.fmtTime(p.wake) + '</span><span>' + M.fmtTime(p.wake) + '</span></div>' +
      '<div class="tb-bar" role="img" aria-label="' + M.esc(M.fmtDur(used) + ' of 24 hours planned') + '">' + segs + '</div>' +
      '<p class="tb-left"><strong>' + M.fmtDurShort(used) + '</strong> planned · <strong>' + M.fmtDurShort(1440 - used) + '</strong> to go</p></div>';
  }
  function dayHtml(d, open) {
    var res = M.tt.resolved(d);
    return '<div class="tb-day">' + U.dayStrip(res, { now: null }) +
      '<details class="preview-list"' + (open ? ' open' : '') + '><summary>All ' + res.length + ' blocks</summary><ol class="mini-agenda">' + res.map(function (x) {
        return '<li style="--cat:' + M.catVar(x.b.cat) + '"><span class="num">' + M.fmtTime(x.start) + '</span><i aria-hidden="true"></i><span>' + M.esc(x.b.title) + '</span><em>' + M.fmtDurShort(x.dur) + '</em></li>';
      }).join('') + '</ol></details></div>';
  }
  function paint() {
    var h = history();
    hosts = hosts.filter(function (x) { return document.contains(x); });
    hosts.forEach(function (host) {
      var log = host.querySelector('.chat-log');
      log.innerHTML = h.map(function (m, i) { return bubble(m, i === h.length - 1); }).join('') +
        (host._typing ? '<div class="msg bot typing" aria-label="' + M.esc(botName()) + ' is typing"><span class="ava" aria-hidden="true">' + ava() + '</span><div class="bubble"><i></i><i></i><i></i></div></div>' : '');
      if (log.querySelector('.daystrip')) U.fitStrip(log);
      var inp = host.querySelector('.chat-input input');
      if (inp) inp.placeholder = placeholder();
      log.scrollTop = log.scrollHeight;
    });
  }
  function deliver(m, instant, done) {
    var go = function () { hosts.forEach(function (x) { x._typing = false; }); history().push(m); persist(); paint(); if (done) done(); };
    if (instant || M.reduceMotion() || !hosts.length) { go(); return; }
    hosts.forEach(function (x) { x._typing = true; }); paint();
    setTimeout(go, Math.min(850, 260 + m.text.length * 2));
  }
  function botSay(id, instant) { var m = nodeMsg(id); if (m) deliver(m, instant); }
  function botText(text, opts, acts) { deliver({ from: 'bot', text: text, opts: opts || [{ label: 'Show topics', go: 'topics' }], acts: acts || [], t: Date.now() }); }
  function userSay(text) { history().push({ from: 'me', text: text, t: Date.now() }); persist(); paint(); }
  function labelFor(id) {
    var found = null;
    Object.keys(N).forEach(function (k) { var o = typeof N[k].opts === 'function' ? N[k].opts() : N[k].opts; if (Array.isArray(o)) o.forEach(function (x) { if (x.go === id) found = x.label; }); });
    return found || { 'q-now': 'What should I do now?', 'q-next': 'What’s next?', 'q-water-today': 'Water today', 'q-ran': 'How far did I walk?' }[id] || id;
  }

  /* ------------------------------------------------------------------ */
  /* Custom timetable, built step by step in the chat                     */
  /* wake-up → "what do you do?" → "until when?" → … until all 24 hours   */
  /* are planned → what's good / what could be better / how to fix it →   */
  /* fix all, fix some or keep it → which days → saved as a routine.      */
  /* The draft lives in M.state.tb, so it survives closing the app.       */
  /* ------------------------------------------------------------------ */
  var FIXLABEL = {
    'no-sleep': 'Add sleep', sleep: 'More sleep', 'sleep-long': 'A bit less sleep', exercise: 'Add exercise', breakfast: 'Add breakfast',
    meals: 'Add a meal', 'study-split': 'Split long study', 'screen-bed': 'No screens before bed', 'screen-much': 'Less screen time',
    free: 'Add free time', 'late-dinner': 'Earlier dinner', buffers: 'Add short breaks'
  };
  var DAYSETS = [
    { label: 'Every day', d: [0, 1, 2, 3, 4, 5, 6], name: 'My timetable' },
    { label: 'Mon–Fri', d: [1, 2, 3, 4, 5], name: 'My weekdays' },
    { label: 'Mon–Sat', d: [1, 2, 3, 4, 5, 6], name: 'My week' },
    { label: 'Sat & Sun', d: [6, 0], name: 'My weekend' }
  ];
  var lastSave = null; // for "Undo" right after saving (this visit only)

  function tb() { return M.state.tb || null; }
  function tbUsed(s) { return s.blocks.reduce(function (a, b) { return a + b.dur; }, 0); }
  function tbAge() { return M.ageFrom(M.state.profile); }
  function snap(s) { return { wake: s.wake, blocks: s.blocks.map(function (b) { return { title: b.title, cat: b.cat, dur: b.dur, notes: b.notes || '' }; }) }; }
  function tbRole() {
    var a = M.state.setup && M.state.setup.answers;
    if (a && a.role) return a.role;
    var age = tbAge();
    return age !== null && age < 18 ? 'school' : age !== null && age < 23 ? 'college' : 'work';
  }
  function hhmm(min) { return M.fromMin(min); }
  function tbMsg(text, opts, extra, done) {
    deliver(Object.assign({ from: 'bot', text: text, opts: opts || [{ label: 'Show topics', go: 'topics' }], acts: [], t: Date.now() }, extra || {}), false, done);
  }
  var OPT_LATER = { label: 'Finish later', tb: { a: 'pause' } };

  function tbStart(fresh, target) {
    var s = tb();
    if (s && !fresh && (s.blocks.length || s.wake !== null)) {
      if (target) {
        M.state.tbPending = target; persist();
        tbMsg('You already have a timetable in progress — **' + M.fmtDur(tbUsed(s)) + '** planned so far. Start the plan for **' + M.special.label(target.dates, 3, true) + '** instead? Your draft will be replaced.',
          [{ label: 'Yes, plan ' + (target.dates.length > 1 ? 'those days' : 'that day'), tb: { a: 'starttarget' }, main: true }, { label: 'Carry on my draft', tb: { a: 'resume' } }]);
        return;
      }
      tbMsg('You already have a timetable in progress — **' + M.fmtDur(tbUsed(s)) + '** planned so far. Carry on, or start again?',
        [{ label: 'Carry on', tb: { a: 'resume' } }, { label: 'Start again', tb: { a: 'restart' } }]);
      return;
    }
    M.state.tb = { step: 'wake', wake: null, blocks: [], pending: null, before: null, target: target || null };
    M.state.sdChat = null;
    persist();
    askWake(true);
  }
  function askWake(intro) {
    var a = M.state.setup && M.state.setup.answers;
    var tg = tb() && tb().target;
    tbMsg((intro ? (tg ? 'Let’s plan **' + M.special.label(tg.dates, 3, true) + '** together, one block at a time. 🧩\nI’ll ask **what you’ll do** and **until when** — from waking up until you’re back in bed, all **24 hours**. Then I’ll check the day and fix it for you if you like. Your usual days stay as they are.\n' : 'Let’s build your timetable together, one block at a time. 🧩\nI’ll ask **what you do** and **until when** — from the moment you wake up until you’re back in bed, all **24 hours**. Then I’ll tell you what’s good about your day, what could be better, and fix it for you if you like.\n') : '') + (tg ? '**What time will you wake up' + (tg.dates.length > 1 ? ' on those days' : '') + '?** ⏰' : '**What time do you wake up?** ⏰'),
      [300, 330, 360, 390, 420, 450, 480].map(function (m) { return { label: M.fmtTime(m), tb: { a: 'wake', min: m } }; }).concat([OPT_LATER]),
      { picker: { value: a && a.wake ? a.wake : '06:30', label: 'Wake-up time' } });
  }
  function setWake(min) {
    var s = tb();
    var had = s.wake !== null && s.blocks.length;
    s.wake = ((min % 1440) + 1440) % 1440;
    s.step = 'what';
    persist();
    askWhat(had ? 'Wake-up time changed to **' + M.fmtTime(s.wake) + '** — your blocks now start from there.' : null);
  }
  function askWhat(prefix) {
    var s = tb(), off = tbUsed(s), clock = (s.wake + off) % 1440;
    var sug = M.tt.suggest(clock, s.blocks, tbRole());
    var late = off >= 720 && (clock >= 20 * 60 || clock < 4 * 60);
    if (late) sug = ['Sleep'].concat(sug.filter(function (x) { return x !== 'Sleep'; }));
    var text = (prefix ? prefix + '\n' : '') + (s.blocks.length
      ? 'What do you do **from ' + M.fmtTime(clock) + '**?'
      : 'You wake up at **' + M.fmtTime(s.wake) + '**. ☀️\nWhat’s the **first thing** you do?') +
      (s.blocks.length < 2 ? '\nTap one, or type your own — like “Tuition till 6 pm”.' : '');
    var opts = sug.slice(0, 7).map(function (n) { return { label: n, tb: { a: 'what', name: n } }; });
    opts.push(s.blocks.length ? { label: 'Undo last', tb: { a: 'undo' } } : { label: 'Change wake-up time', tb: { a: 'rewake' } });
    opts.push(OPT_LATER);
    tbMsg(text, opts, s.blocks.length ? { prog: snap(s) } : null);
  }
  function tbWhat(raw) {
    var s = tb();
    var sp = M.tt.splitActivity(raw);
    var clean = function (n) {
      return String(n || '').replace(/^(and |then |after that |next |i will |i |we |go for |do )+/i, '')
        .replace(/\s+(from\s+)?\d{1,2}([:.]\d{2})?\s*(am|pm)?$/i, '').replace(/[.!?]+$/, '').trim();
    };
    var name = clean(sp.name), off = tbUsed(s), left = 1440 - off;
    var end = null;
    if (sp.end) {
      end = endFromText(sp.end);
      if (end.err) { name = clean(raw); end = null; } // "Go to gym": "to" wasn't a time
    }
    if (!name || /^[\d:.\s]*(am|pm)?$/i.test(name)) { askWhat('Tell me **what** you do — like “Study”, “Breakfast” or “School”.'); return; }
    var title = M.tt.tidyTitle(name).slice(0, 40), cat = M.tt.guessCat(name);
    if (cat === 'sleep' && left <= 720 && !end && !sp.dur) {
      s.blocks.push({ title: title, cat: 'sleep', dur: left });
      s.pending = null;
      persist();
      tbDone('**' + title + '** from ' + M.fmtTime(s.wake + off) + ' until you wake up at ' + M.fmtTime(s.wake) + ' — **' + M.fmtDur(left) + '**. 😴');
      return;
    }
    s.pending = { title: title, cat: cat };
    if (end && end.off) { tbUntil(end.off); return; }
    if (sp.dur) { tbUntil(off + sp.dur); return; }
    s.step = 'until';
    persist();
    askUntil();
  }
  /* typed end: "6 pm", "18:30", "45 min", "till I wake up" → {off} (minutes after waking) or {err} */
  function endFromText(text) {
    var s = tb(), off = tbUsed(s), low = String(text).toLowerCase();
    if (/wake|get up|morning tak|subah|end of (the )?day|rest of (the )?day/.test(low)) return { off: 1440 };
    var d = M.tt.parseDur(text);
    if (d) return { off: off + d };
    var o = M.tt.offsetFor(text, s.wake, off);
    if (o !== null) return { off: o };
    if (M.tt.clockCandidates(text)) return { err: 'past' };
    return { err: 'none' };
  }
  function askUntil(prefix) {
    var s = tb(), p = s.pending, off = tbUsed(s), clock = (s.wake + off) % 1440, left = 1440 - off;
    var u = Math.max(5, Math.min(M.tt.usual(p.title, p.cat), left));
    var durs = M.tt.isLong(p.title, p.cat) ? [u - 60, u - 30, u, u + 30, u + 60, u + 90] : [u].concat([15, 30, 45, 60, 90, 120]);
    var seen = {};
    durs = durs.filter(function (d) { if (d < 5 || d > left || seen[d]) return false; seen[d] = 1; return true; });
    if (!M.tt.isLong(p.title, p.cat)) durs = [durs[0]].concat(durs.slice(1).sort(function (a, b) { return a - b; })).filter(Boolean);
    var opts = durs.slice(0, 6).map(function (d) { return { label: M.fmtDurShort(d) + ' · till ' + M.fmtTime(clock + d), tb: { a: 'until', off: off + d } }; });
    if (left <= 360 || p.cat === 'sleep') opts.push({ label: 'Till I wake up (' + M.fmtTime(s.wake) + ')', tb: { a: 'until', off: 1440 } });
    opts.push({ label: 'Change activity', tb: { a: 'back' } });
    tbMsg((prefix ? prefix + '\n' : '') + '**' + p.title + '** from **' + M.fmtTime(clock) + '** — until when?\nPick a time, or type one (“5:30 pm” or “45 min”).', opts,
      { picker: { value: hhmm(clock + u), label: 'Until' } });
  }
  function tbUntil(endOff) {
    var s = tb(), p = s.pending, off = tbUsed(s);
    if (!p) { askWhat(); return; }
    if (endOff > 1440) { s.step = 'until'; persist(); askUntil('That goes past your wake-up time (**' + M.fmtTime(s.wake) + '**) — your day ends when you wake up again.'); return; }
    var dur = Math.round(endOff - off);
    if (dur < 5) { s.step = 'until'; persist(); askUntil('That’s not after **' + M.fmtTime(s.wake + off) + '** — pick a later time.'); return; }
    s.blocks.push({ title: p.title, cat: p.cat, dur: dur });
    s.pending = null;
    persist();
    var line = '**' + p.title + '** ' + M.fmtTime(s.wake + off) + '–' + M.fmtTime(s.wake + endOff) + ' ✓';
    if (endOff >= 1440) { tbDone(line); return; }
    s.step = 'what';
    persist();
    askWhat(line);
  }
  function tbUndo() {
    var s = tb();
    s.pending = null;
    if (!s.blocks.length) { s.step = 'wake'; persist(); askWake(false); return; }
    var b = s.blocks.pop();
    s.before = null;
    s.step = 'what';
    persist();
    askWhat('Removed “' + b.title + '”.');
  }

  /* ---- all 24 hours planned: celebrate, then review ---- */
  function tbDone(prefix) {
    var s = tb();
    s.step = 'review';
    persist();
    tbMsg((prefix ? prefix + '\n\n' : '') + '🎉 **That’s all 24 hours planned!** Here’s your day:', [], { day: snap(s) }, function () { showReview(); });
  }
  function reviewText(r) {
    var t = '';
    if (r.pros.length) t += '**👍 What’s good**\n' + r.pros.map(function (x) { return '• ' + x; }).join('\n');
    if (r.cons.length) {
      t += (t ? '\n\n' : '') + '**⚠️ What could be better**\n' + r.cons.map(function (c, i) { return (i + 1) + '. ' + c.text; }).join('\n') +
        '\n\n**🔧 How to fix it**\n' + r.cons.map(function (c, i) { return (i + 1) + '. ' + c.how; }).join('\n');
    }
    return t;
  }
  function showReview(prefix) {
    var s = tb(), r = M.tt.review(snap(s), tbAge());
    var fixable = r.cons.filter(function (c) { return c.fix; });
    s.step = 'review';
    persist();
    var text = (prefix ? prefix + '\n\n' : '') + reviewText(r);
    var opts;
    if (!r.cons.length) {
      text += '\n\n**No big problems — this is a well-balanced day!** 🌟 Shall I save it?';
      opts = [{ label: 'Save it', tb: { a: 'save' }, main: true }, { label: 'Go back a step', tb: { a: 'undo' } }, { label: 'Start again', tb: { a: 'restart' } }];
    } else if (fixable.length) {
      text += '\n\n**Shall I fix ' + (fixable.length === r.cons.length ? (fixable.length === 1 ? 'it' : 'these') : 'the ones I can') + ' for you?** Or keep your timetable just as it is — it’s your day.';
      opts = [{ label: fixable.length === 1 ? 'Yes, fix it' : 'Yes, fix them all', tb: { a: 'fixall' }, main: true }];
      if (fixable.length > 1) opts.push({ label: 'Let me choose', tb: { a: 'choose' } });
      opts.push({ label: 'No, keep it as it is', tb: { a: 'keep' } }, { label: 'Go back a step', tb: { a: 'undo' } });
    } else {
      text += '\n\nThat one is up to you — I can’t change it without moving your wake-up time. Save it like this?';
      opts = [{ label: 'Save it', tb: { a: 'save' }, main: true }, { label: 'Change wake-up time', tb: { a: 'rewake' } }, { label: 'Go back a step', tb: { a: 'undo' } }];
    }
    tbMsg(text, opts);
  }
  function tbFix(ids) {
    var s = tb(), day = snap(s), age = tbAge();
    var res = M.tt.fix(day, ids, age);
    if (!res.changes.length) {
      tbMsg('I couldn’t find a good way to change that automatically. You can save it and adjust the blocks yourself in **Plan**.',
        [{ label: 'Save it', tb: { a: 'save' }, main: true }, { label: 'Go back a step', tb: { a: 'undo' } }]);
      return;
    }
    if (!s.before) s.before = day.blocks;
    s.blocks = res.day.blocks;
    s.step = 'fixed';
    persist();
    var rv = M.tt.review(res.day, age), left = rv.cons.filter(function (c) { return c.fix; });
    var text = '✅ **Done! Here’s what I changed:**\n' + res.changes.map(function (c) { return '• ' + c; }).join('\n') +
      (rv.cons.length ? '\n\n**Still worth knowing**\n' + rv.cons.map(function (c) { return '• ' + c.text + ' ' + c.how; }).join('\n') : '\n\nNo problems left. 🌟');
    var opts = [{ label: 'Save it', tb: { a: 'save' }, main: true }].concat(left.map(function (c) { return { label: 'Fix: ' + (FIXLABEL[c.id] || c.id), tb: { a: 'fix1', id: c.id } }; }))
      .concat([{ label: 'Undo the fixes', tb: { a: 'undofix' } }]);
    tbMsg(text, opts, { day: snap(s) });
  }
  function tbChoose() {
    var s = tb(), r = M.tt.review(snap(s), tbAge());
    var fixable = r.cons.filter(function (c) { return c.fix; });
    s.step = 'choose';
    persist();
    tbMsg('Which ones should I fix? Tap one — I’ll show you the change, then you can pick more.',
      fixable.map(function (c) { return { label: 'Fix: ' + (FIXLABEL[c.id] || c.id), tb: { a: 'fix1', id: c.id } }; })
        .concat([{ label: 'None — keep it as it is', tb: { a: 'keep' } }]));
  }
  function askDays(prefix) {
    var s = tb();
    if (s.target) { tbSaveDated(prefix); return; }
    s.step = 'days';
    persist();
    var has = M.state.routines && M.state.routines.length;
    tbMsg((prefix ? prefix + '\n\n' : '') + '**Which days is this timetable for?**' + (has ? '\nIt replaces your current plan on those days.' : ''),
      DAYSETS.map(function (x, i) { return { label: x.label, tb: { a: 'days', i: i } }; }).concat([OPT_LATER]));
  }
  function tbSave(set) {
    var s = tb();
    var day = snap(s);
    lastSave = { routines: M.deepClone(M.state.routines || []), setup: M.state.setup ? M.deepClone(M.state.setup) : null, draft: M.deepClone(s) };
    var r = { id: M.uid(), name: set.name, days: set.d.slice().sort(), blocks: M.tt.toRoutineBlocks(day) };
    var rest = (M.state.routines || []).filter(function (x) {
      if (M.special.isDated(x)) return true; // special days keep their own plans
      x.days = x.days.filter(function (d) { return set.d.indexOf(d) < 0; });
      return x.days.length;
    });
    M.state.routines = [r].concat(rest);
    M.state.setup = { answers: (M.state.setup && M.state.setup.answers) || null, at: M.today(), custom: true };
    var wasOnboarded = M.state.settings.onboarded;
    M.state.settings.onboarded = true;
    M.state.tb = null;
    M.save(true);
    M.haptic('success');
    if (!wasOnboarded) { if (M.requestPersist) M.requestPersist(); M.renderNav(); M.go(M.state.settings.nav.start || 'today'); fab(); }
    else if (M.currentRoute && M.currentRoute.name === 'setup') M.go('plan');
    else if (M.currentRoute && ['plan', 'today', 'day'].indexOf(M.currentRoute.name) >= 0) M.refresh();
    var cur = set.d.indexOf(M.weekday(M.today())) >= 0 ? C.locate(C.resolveBlocks(r, M.today()), M.nowMin()) : null;
    tbMsg('✅ **Saved!** “' + r.name + '” is now your timetable for **' + set.label.toLowerCase() + '**.' +
      (cur && cur.cur ? '\nRight now: **' + cur.cur.b.title + '**.' : '') +
      '\nYou can change any block in **Plan**, and **Today** shows what to do now and what’s next.',
      [{ label: 'Undo', tb: { a: 'unsave' } }, { label: 'Something else', go: 'topics' }], { acts: ['dashboard', 'plan'] });
  }
  /* the custom builder, saved to chosen dates instead of weekdays */
  function tbSaveDated(prefix) {
    var s = tb(), day = snap(s), tg = s.target;
    lastSave = { routines: M.deepClone(M.state.routines || []), setup: M.state.setup ? M.deepClone(M.state.setup) : null, draft: M.deepClone(s) };
    var r = M.special.create(tg.dates, M.tt.toRoutineBlocks(day), tg.name || 'Special day');
    M.state.tb = null;
    M.save(true);
    M.haptic('success');
    afterPlanChange();
    var n = r.dates.length;
    tbMsg((prefix ? prefix + '\n\n' : '') + '✅ **Saved!** “' + r.name + '” is your plan for **' + M.special.label(r.dates, 4, true) + '**. On ' + (n > 1 ? 'those days' : 'that day') + ' it replaces your usual timetable — every other day stays the same.' + nowLine(r),
      [{ label: 'Open it in Plan', sd: { a: 'open', id: r.id }, main: true }, { label: 'Undo', tb: { a: 'unsave' } }, { label: 'Something else', go: 'topics' }]);
  }
  function afterPlanChange() {
    if (M.currentRoute && ['plan', 'today', 'day'].indexOf(M.currentRoute.name) >= 0) M.refresh();
  }
  function nowLine(r) {
    var t = M.today();
    if (r.dates.indexOf(t) < 0) return '';
    var cur = C.locate(C.resolveBlocks(r, t), M.nowMin());
    return cur && cur.cur ? '\nRight now: **' + cur.cur.b.title + '**.' : '';
  }
  function tbUnsave() {
    if (!lastSave) { botText('There’s nothing to undo.'); return; }
    M.state.routines = lastSave.routines;
    M.state.setup = lastSave.setup;
    if (lastSave.sd) {
      M.state.sdChat = lastSave.sd; lastSave = null; M.save(true); afterPlanChange();
      sdAskWay('↩️ Undone — ' + (M.state.sdChat.dates.length > 1 ? 'those days are' : 'that day is') + ' back to your usual plan.');
      return;
    }
    if (lastSave.draft && lastSave.draft.target) {
      M.state.tb = lastSave.draft; lastSave = null; M.save(true); afterPlanChange();
      showReview('↩️ Undone — ' + (M.state.tb.target.dates.length > 1 ? 'those days are' : 'that day is') + ' back to your usual plan. Your plan is still here as a draft.');
      return;
    }
    M.state.tb = lastSave.draft;
    M.state.tb.step = 'days';
    lastSave = null;
    M.save(true);
    if (M.currentRoute && ['plan', 'today', 'day'].indexOf(M.currentRoute.name) >= 0) M.refresh();
    askDays('Undone — your previous timetable is back. Your new one is still here as a draft.');
  }
  function tbPause() {
    var s = tb();
    if (s) { s.paused = true; persist(); }
    tbMsg(s && (s.blocks.length || s.wake !== null) ? 'No problem — I’ve kept what you have so far' + (s.blocks.length ? ' (**' + M.fmtDur(tbUsed(s)) + '** planned)' : '') + '. Tap **Continue my timetable** any time to carry on.' : 'No problem — tap **Make a custom timetable** whenever you’re ready.',
      [{ label: 'Continue now', tb: { a: 'resume' } }, { label: 'Show topics', go: 'topics' }]);
  }
  /* ask again whatever the current step needs */
  function tbResume() {
    var s = tb();
    if (!s) { tbStart(true); return; }
    s.paused = false;
    persist();
    if (s.step === 'wake' || s.wake === null) askWake(false);
    else if (s.step === 'until' && s.pending) askUntil();
    else if (s.step === 'what') askWhat(s.blocks.length ? 'Welcome back! You’ve planned **' + M.fmtDur(tbUsed(s)) + '** so far.' : null);
    else if (s.step === 'days') askDays();
    else if (s.step === 'choose') tbChoose();
    else showReview();
  }
  function tbAct(p) {
    if (p.a === 'start') { tbStart(false); return; }
    if (p.a === 'restart') { M.state.tb = null; tbStart(true); return; }
    if (p.a === 'resume') { tbResume(); return; }
    if (p.a === 'unsave') { tbUnsave(); return; }
    if (p.a === 'starttarget') { var tgt = M.state.tbPending; M.state.tbPending = null; M.state.tb = null; tbStart(true, tgt); return; }
    if (p.a === 'pause') { tbPause(); return; }
    var s = tb();
    if (!s) { tbStart(true); return; }
    s.paused = false;
    if (p.a === 'wake') setWake(p.min);
    else if (p.a === 'rewake') { s.step = 'wake'; persist(); askWake(false); }
    else if (p.a === 'what') tbWhat(p.name);
    else if (p.a === 'until') tbUntil(p.off);
    else if (p.a === 'back') { s.pending = null; s.step = 'what'; persist(); askWhat(); }
    else if (p.a === 'undo') tbUndo();
    else if (p.a === 'fixall') tbFix('all');
    else if (p.a === 'fix1') tbFix([p.id]);
    else if (p.a === 'choose') tbChoose();
    else if (p.a === 'undofix') { if (s.before) s.blocks = s.before; s.before = null; persist(); showReview('↩️ Undone — back to exactly what you made.'); }
    else if (p.a === 'keep') askDays('👍 Okay — keeping it exactly as you made it. You can change any block later in **Plan**.');
    else if (p.a === 'save') askDays();
    else if (p.a === 'days') tbSave(DAYSETS[p.i] || DAYSETS[0]);
  }
  /* typed messages while building */
  function tbText(text) {
    var s = tb(), low = text.toLowerCase().trim();
    if (/^(stop|cancel|exit|quit|pause|later|finish later|band karo|ruko|baad me)\b/.test(low)) { tbPause(); return true; }
    if (s.step === 'wake') {
      var c = M.tt.clockCandidates(text);
      if (!c) { tbMsg('I didn’t catch a time there. Type something like **6:30 am**, or pick one below.', [390, 420, 450].map(function (m) { return { label: M.fmtTime(m), tb: { a: 'wake', min: m } }; }).concat([OPT_LATER]), { picker: { value: '06:30', label: 'Wake-up time' } }); return true; }
      setWake(c[0]);
      return true;
    }
    if (/^(undo|go back|back|oops|wrong|galat)\b/.test(low)) { if (s.step === 'until') tbAct({ a: 'back' }); else tbUndo(); return true; }
    if (s.step === 'what') { tbWhat(text); return true; }
    if (s.step === 'until') {
      var e = endFromText(text);
      if (e.off) tbUntil(e.off);
      else askUntil(e.err === 'past' ? 'That goes past your wake-up time (**' + M.fmtTime(s.wake) + '**) — pick an earlier time.' : 'I didn’t catch that. Try a time like **5:30 pm** or a length like **45 min**.');
      return true;
    }
    if (s.step === 'review' || s.step === 'choose' || s.step === 'fixed') {
      // "save it for weekdays" / just "weekdays" → save straight away for those days
      var di = daysIdx(low);
      if (di >= 0 && !/\b(not|except|but|without)\b/.test(low)) { tbSave(DAYSETS[di]); return true; }
      if (/^(yes|yeah|yep|ok|okay|haan|sure|fix)\b/.test(low) && s.step === 'review') { tbAct({ a: 'fixall' }); return true; }
      if (/^(no|nope|nah|nahi|keep|leave)\b/.test(low)) { tbAct({ a: 'keep' }); return true; }
      if (/^(save|done|finish)\b/.test(low)) { tbAct({ a: 'save' }); return true; }
    }
    if (s.step === 'days') {
      if (/\b(not|except|but|without)\b/.test(low)) { askDays('Just tap one of these, please:'); return true; }
      var i = daysIdx(low);
      if (i >= 0) { tbSave(DAYSETS[i]); return true; }
    }
    return false;
  }
  /* which DAYSETS entry a phrase means: 0 every day, 1 Mon–Fri, 2 Mon–Sat, 3 weekend, -1 none */
  function daysIdx(low) {
    return /\bweekends?\b|\bsat(urday)?s?\s*(and|&|\+)\s*sun(day)?s?\b/.test(low) ? 3
      : /\bmon(day)?s?\s*(-|–|to|till|through)\s*sat(urday)?s?\b/.test(low) ? 2
      : /\bmon(day)?s?\s*(-|–|to|till|through)\s*fri(day)?s?\b|\bweek ?days?\b/.test(low) ? 1
      : /\b(every ?day|everyday|daily|all days|all week|roz|har din)\b/.test(low) ? 0 : -1;
  }
  function tbPicked(min) {
    if (sd() && sd().step === 'wake') { sdMakeOff(min); return; }
    var s = tb();
    if (!s) return;
    if (s.step === 'wake') { setWake(min); return; }
    if (s.step === 'until') { var off = (min - s.wake + 1440) % 1440; tbUntil(off === 0 ? 1440 : off); }
  }
  function placeholder() {
    var s = tb();
    if (!s || s.paused) return 'Type your question…';
    return { wake: 'Type a time, e.g. 6:30 am', what: 'What do you do next? e.g. Study', until: 'Until when? e.g. 5:30 pm or 45 min' }[s.step] || 'Type your reply…';
  }
  function startBuilder(target) {
    var onPage = M.currentRoute && M.currentRoute.name === 'assistant';
    if (!onPage && !(chatDlg && chatDlg.open)) M.assistant.open();
    if (target && target.dates && target.dates.length) { userSay('Plan ' + M.special.label(target.dates, 3) + ' step by step'); tbStart(false, target); return; }
    var s = tb();
    userSay(s && (s.blocks.length || s.wake !== null) ? 'Continue my timetable' : 'Make a custom timetable');
    if (s && (s.blocks.length || s.wake !== null)) tbResume(); else tbStart(true);
  }

  /* ------------------------------------------------------------------ */
  /* Plan specific days differently, in the chat                          */
  /* which days (calendar or typed) → how: day off / copy my usual day /  */
  /* step by step → saved as a special plan for those dates.              */
  /* ------------------------------------------------------------------ */
  var sdCal = null; // the chat calendar while picking days
  function sd() { return M.state.sdChat || null; }
  function sdStart(dates, way) {
    M.state.sdChat = { dates: dates || [], step: 'days', way: way || null };
    if (tb()) tb().paused = true;
    persist();
    if (!dates || !dates.length) sdAskDays(); else sdAfterDays();
  }
  function sdAfterDays() {
    var s = sd();
    if (s.way === 'off') sdAskWake();
    else if (s.way === 'chat') { var d = s.dates.slice(); M.state.sdChat = null; persist(); tbStart(false, { dates: d, name: 'Special day' }); }
    else sdAskWay();
  }
  function sdAskDays(prefix) {
    var s = sd();
    s.step = 'days';
    persist();
    sdCal = M.special.calState(s.dates, { done: 'Next' });
    var t = M.today();
    tbMsg((prefix ? prefix + '\n\n' : '') + '📅 **Which days do you want to plan differently?** Tap them on the calendar — or type them, like “tomorrow”, “friday” or “5 to 8 Oct”.',
      [{ label: 'Tomorrow', sd: { a: 'days', d: [M.addDays(t, 1)] } }, { label: 'This weekend', sd: { a: 'days', d: M.special.parseDates('this weekend') } }, { label: 'Cancel', sd: { a: 'cancel' } }], { cal: true });
  }
  function sdAskWay(prefix) {
    var s = sd();
    s.step = 'way';
    persist();
    var usual = M.special.usualFor(s.dates[0]), n = s.dates.length;
    var has = s.dates.filter(function (k) { return M.special.forDate(k); });
    tbMsg((prefix ? prefix + '\n\n' : '') + 'Planning **' + M.special.label(s.dates, 4) + '**' + (has.length ? ' (this replaces the special plan already there)' : '') + '. How do you want to plan ' + (n > 1 ? 'them' : 'it') + '?\n' +
      '• **Day off / holiday** — no school or work; you pick the wake-up time and I fill in the rest.\n' +
      '• **Copy my usual day** — start from ' + (usual ? '“' + usual.name + '”' : 'your usual plan') + ' and change what’s different in Plan.\n' +
      '• **Step by step** — tell me what you’ll do, block by block.',
      [{ label: 'Day off / holiday', sd: { a: 'way', w: 'off' }, main: true }, { label: 'Copy my usual day', sd: { a: 'way', w: 'copy' } }, { label: 'Step by step', sd: { a: 'way', w: 'chat' } }, { label: 'Change the days', sd: { a: 'redays' } }, { label: 'Cancel', sd: { a: 'cancel' } }]);
  }
  function sdAskWake(prefix) {
    var s = sd();
    s.step = 'wake';
    var u = M.special.usualTimes(s.dates[0]), w = M.toMin(u.wake);
    s.bed = u.bed;
    persist();
    tbMsg((prefix ? prefix + '\n\n' : '') + '🌴 Day off: **' + M.special.label(s.dates, 3) + '**. **What time will you wake up?** ⏰\nUsually it’s **' + M.fmtTime(w) + '**. Bedtime stays at **' + M.fmtTime(M.toMin(u.bed)) + '**.',
      [0, 30, 60, 90, 120].map(function (x) { var m = (w + x) % 1440; return { label: M.fmtTime(m), sd: { a: 'wake', min: m } }; }).concat([{ label: 'Cancel', sd: { a: 'cancel' } }]),
      { picker: { value: M.fromMin((w + 60) % 1440), label: 'Wake-up time' } });
  }
  function sdMakeOff(wakeMin) {
    var s = sd();
    var wake = M.fromMin(wakeMin), bed = s.bed || M.special.usualTimes(s.dates[0]).bed;
    if (M.special.timesProblem(wake, bed)) bed = M.fromMin(wakeMin + 16 * 60); // keep about 16 h awake when the usual bedtime doesn't fit
    sdSave(M.special.dayOffBlocks(wake, bed), 'Day off', 'wake up at **' + M.fmtTime(wakeMin) + '**, bed at **' + M.fmtTime(M.toMin(bed)) + '**, and no school or work — meals, free time and the rest are filled in.');
  }
  function sdSave(blocks, name, what) {
    var s = sd();
    lastSave = { routines: M.deepClone(M.state.routines || []), setup: M.state.setup ? M.deepClone(M.state.setup) : null, draft: null, sd: M.deepClone(s) };
    var r = M.special.create(s.dates, blocks, name);
    M.state.sdChat = null;
    M.save(true);
    M.haptic('success');
    afterPlanChange();
    var n = r.dates.length;
    tbMsg('✅ **Done!** “' + r.name + '” is planned for **' + M.special.label(r.dates, 4, true) + '**: ' + what + nowLine(r) + '\nOn ' + (n > 1 ? 'those days' : 'that day') + ' it replaces your usual plan; every other day stays the same. Change any block in **Plan**.',
      [{ label: 'Open it in Plan', sd: { a: 'open', id: r.id }, main: true }, { label: 'Undo', tb: { a: 'unsave' } }, { label: 'Something else', go: 'topics' }]);
  }
  function sdAct(p) {
    if (p.a === 'start') { sdStart(p.d || [], p.w || null); return; }
    if (p.a === 'open') { M.planSelect = p.id; go('plan'); return; }
    if (p.a === 'cancel') { M.state.sdChat = null; sdCal = null; persist(); botText('Okay — nothing changed. Your usual plan stays.', [{ label: 'Something else', go: 'topics' }]); return; }
    var s = sd();
    if (!s) { sdStart([]); return; }
    if (p.a === 'days') { if (!p.d || !p.d.length) { sdAskDays(); return; } s.dates = p.d.slice(); sdAfterDays(); }
    else if (p.a === 'redays') { s.way = null; sdAskDays(); }
    else if (p.a === 'way') {
      s.way = p.w;
      if (p.w === 'off') sdAskWake();
      else if (p.w === 'copy') {
        var u = M.special.usualFor(s.dates[0]);
        sdSave(M.special.copyBlocks(s.dates[0]), 'Special day', 'a copy of ' + (u ? '“' + u.name + '”' : 'your usual day') + ' — now change what’s different.');
      } else sdAfterDays();
    } else if (p.a === 'wake') sdMakeOff(p.min);
  }
  /* typed replies while planning special days */
  function sdText(text) {
    var s = sd(), low = text.toLowerCase().trim();
    if (/^(stop|cancel|exit|quit|never ?mind|rehne do|chhodo|leave it)\b/.test(low)) { sdAct({ a: 'cancel' }); return true; }
    var d = M.special.parseDates(text);
    if (s.step === 'days') { if (d.length) { s.dates = d; sdAfterDays(); return true; } return false; }
    if (s.step === 'way') {
      if (/\b(off|holiday|chhutti|chutti|free day|no school|no work|rest day)\b/.test(low)) { sdAct({ a: 'way', w: 'off' }); return true; }
      if (/\b(copy|usual|same|normal)\b/.test(low)) { sdAct({ a: 'way', w: 'copy' }); return true; }
      if (/\b(step|myself|build|custom|khud|block)\b/.test(low)) { sdAct({ a: 'way', w: 'chat' }); return true; }
      if (d.length) { s.dates = d; sdAskWay(); return true; }
      return false;
    }
    if (s.step === 'wake') { var c = M.tt.clockCandidates(text); if (c) { sdMakeOff(c[0]); return true; } }
    return false;
  }
  /* "tomorrow is a holiday", "plan 5 to 8 Oct differently", "exam on monday, change my day"… */
  function sdIntent(text) {
    var low = String(text).toLowerCase().replace(/[’']/g, '');
    if (/\b(every|weekends|weekly|each week|har)\b/.test(low)) return false; // that's a weekly routine
    var offWord = /\b(holiday|holidays|chhutti|chutti|day off|days off|off day|vacation|no school|no college|no work|school band|bandh)\b/.test(low);
    var diff = offWord || /\b(differen(t|tly)|special|specific|particular|alag|exam day|trip|travel day|festival|leave)\b/.test(low);
    if (!diff) return false;
    var dates = M.special.parseDates(text);
    var planWord = /\b(plan|timetable|time table|schedule|routine|day|days|date|dates)\b/.test(low);
    if (!dates.length && !planWord && !offWord) return false;
    if (/^(how|can i|can you|is there|kaise|where)\b/.test(low) && !dates.length) { botSay('tt-special'); return true; }
    sdStart(dates, offWord ? 'off' : null);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Typed answers to the buttons on screen                               */
  /* "yes", "the second one", "fix them", "weekdays", a few words of a    */
  /* button — all pick that button.                                       */
  /* ------------------------------------------------------------------ */
  var ORD = { first: 0, '1st': 0, one: 0, pehla: 0, second: 1, '2nd': 1, two: 1, doosra: 1, dusra: 1, third: 2, '3rd': 2, three: 2, fourth: 3, '4th': 3, four: 3, fifth: 4, '5th': 4, five: 4 };
  function lastOpts() {
    var h = history();
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].from === 'bot') return h[i].opts || []; if (i < h.length - 2) break; }
    return [];
  }
  function matchOption(text) {
    var opts = lastOpts();
    if (!opts.length) return null;
    var t = String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    var m = /^(?:the |option |number |no )?(first|1st|one|pehla|second|2nd|two|doosra|dusra|third|3rd|three|fourth|4th|four|fifth|5th|five|last|\d)(?: one| option| wala| vala)?$/.exec(t);
    if (m) { var k = m[1] === 'last' ? opts.length - 1 : /^\d$/.test(m[1]) ? +m[1] - 1 : ORD[m[1]]; return opts[k] ? k : null; }
    var yes = /^(yes|yeah|yep|ya|yup|haan|han|ha|sure|ok|okay|okk|please|yes please|of course|go ahead|do it|theek hai|thik hai)\b/.test(t) && t.length < 24;
    var no = /^(no|nope|nah|nahi|nahin|not now|no thanks|leave it|skip)\b/.test(t) && t.length < 24;
    for (var i = 0; i < opts.length; i++) {
      var L = opts[i].label.toLowerCase();
      if (yes && /^(yes|carry on|continue|save it|actually, yes)/.test(L)) return i;
      if (no && /^(no|not now|finish later|none)/.test(L)) return i;
    }
    if (yes || no) return null;
    var tt = tokens(t);
    if (!tt.length) return null;
    var best = -1, bestScore = 0, second = 0;
    opts.forEach(function (o, i) {
      var lab = o.label.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
      var lt = tokens(lab);
      var sc = 0;
      if (lab === t) sc = 2;
      else if (t.length >= 4 && lab.indexOf(t) >= 0) sc = 1 + 0.5 * t.length / lab.length + (lab.indexOf(t) === 0 ? 0.3 : 0);
      else if (lab.length >= 4 && t.indexOf(lab) >= 0 && t.split(' ').length <= lab.split(' ').length + 2) sc = 1.1;
      else if (lt.length) {
        var hit = tt.filter(function (w) { return lt.some(function (x) { return x === w || (w.length >= 5 && x.length >= 5 && lev(w, x) <= 1); }); }).length;
        sc = hit / Math.max(lt.length, tt.length * 0.8);
      }
      if (sc > bestScore) { second = bestScore; bestScore = sc; best = i; } else if (sc > second) second = sc;
    });
    return bestScore >= 0.6 && bestScore - second >= 0.15 ? best : null;
  }
  function runOption(o) {
    if (/^undo-water-\d+$/.test(o.go || '')) { var n = +o.go.split('-')[2]; for (var k = 0; k < n; k++) M.water.add(-1); if (M.waterReminder) M.waterReminder.check(); botText('Undone — ' + M.water.glasses() + ' of ' + M.water.goalGlasses() + ' glasses today.'); return; }
    if (o.sd) sdAct(o.sd);
    else if (o.tb) tbAct(o.tb);
    else if (o.act) { runAct(o.act); botText('Opening it now. 👍', [{ label: 'Something else', go: 'topics' }]); }
    else if (o.go) botSay(o.go);
  }

  /* ------------------------------------------------------------------ */
  /* Things you can just say: "I drank 2 glasses", "I weigh 68 kg",       */
  /* "remind me every hour", "dark mode", "open the plan", "call me Ali"… */
  /* ------------------------------------------------------------------ */
  var NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ek: 1, do: 2, teen: 3, char: 4 };
  var PAGES = [
    [/workout|exercise|gym/, 'body/workouts', 'Workout plan'], [/meal|food|diet/, 'food', 'Food'], [/goal|calorie/, 'body/goal', 'Goal planner'],
    [/whole day|full day|dial|checklist/, 'day', 'My whole day'], [/dashboard|home|today/, 'today', 'Today'], [/plan|timetable|time table|routine|schedule/, 'plan', 'Plan'],
    [/health/, 'health', 'Health'], [/\bme\b|my page|profile page/, 'me', 'Me'], [/weight|bmi/, 'body', 'Weight & BMI'],
    [/habit/, 'habits', 'Habits'], [/calculator/, 'body/tools', 'Calculators'], [/look|skin|face|beard|hair/, 'looks', 'Looks'],
    [/run|walk|tracker|steps/, 'move', 'Walk & run'], [/review/, 'review', 'Weekly review'], [/setting/, 'settings', 'Settings'],
    [/backup|restore/, 'settings/data', 'Backup'], [/science|source/, 'science', 'Science & sources'], [/profile/, 'settings/profile', 'Profile']
  ];
  function go(path) { if (chatDlg && chatDlg.open) chatDlg.close(); M.go(path); }
  function smartAction(text) {
    var t = String(text).toLowerCase().replace(/[’]/g, "'").trim();
    var q = /\?$|^(how|what|why|when|should|can|could|is|are|do|does|which|kya|kitna|kaise)\b/.test(t);
    var polite = /^(can|could|would|will) you\b|\bplease\b|\bplz\b/.test(t); // "can you remind me every hour?" is a request
    var ask = q && !polite;
    var neg = /\b(not|no|never|haven'?t|hasn'?t|didn'?t|don'?t|dont|havent|didnt|nahi|nahin|na)\b|n't\b/.test(t);
    var m, p = M.state.profile;
    // water logged
    if (!ask && !neg && !/remind/.test(t) && /\b(drank|had|have had|drunk|finished|pi liya|pi li|piya|pee liya|pi hai|logged|log|added|add)\b/.test(t) && /\b(water|paani|pani|glass(?:es)?|bottles?)\b/.test(t)) {
      m = /(\d+|a|an|one|two|three|four|five|six|ek|do|teen|char)\s*(?:more\s+)?(glass(?:es)?|bottles?|cups?)/.exec(t);
      var n = m ? (NUMW[m[1]] || parseInt(m[1], 10)) : 1;
      if (m && /bottle/.test(m[2])) n = n * Math.max(1, Math.round(1000 / M.water.glassMl()));
      n = Math.max(1, Math.min(n || 1, 8));
      for (var i = 0; i < n; i++) M.water.add(1);
      M.state.waterSnooze = 0; M.save(); if (M.waterReminder) M.waterReminder.check();
      if (M.currentRoute && M.currentRoute.name === 'today') M.refresh();
      botText('💧 Logged ' + n + ' ' + M.plural(n, 'glass', 'glasses') + ' — **' + M.water.glasses() + ' of ' + M.water.goalGlasses() + '** today.\n' + M.water.nextText() + '.', [{ label: 'Undo', go: 'undo-water-' + n }, { label: 'Something else', go: 'topics' }]);
      return true;
    }
    // weight
    if (!q && (m = /\b(?:i weigh|my weight is|my weight|weight is|i am|i'm|im|weight|wazan|vajan)\s*(?:is|hai|now|today|:)?\s*(\d{1,3}(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|kilograms?|lb|lbs|pounds?)\b/.exec(t) || /\b(?:i weigh|my weight is|weight is|wazan)\s*(\d{1,3}(?:\.\d+)?)\b()/.exec(t))) {
      var v = parseFloat(m[1]), u = m[2] || (M.imperial() ? 'lb' : 'kg');
      var kg = /lb|pound/.test(u) ? v * 0.45359237 : v;
      var err = C.checkBody({ weightKg: kg, heightCm: p.heightCm, age: M.ageFrom(p) }).filter(function (x) { return x.key === 'weightKg'; })[0];
      if (err) { botText('Hmm — ' + err.msg); return true; }
      M.logWeight(kg);
      var b = M.bmiInfo();
      botText('⚖️ Saved **' + M.showW(kg) + ' ' + M.wUnit() + '** for today.' + (b && !b.missing && !b.needSex ? '\nYour BMI is now **' + M.fmt(b.bmi, 1) + '** — ' + b.label + '.' : ''), [{ label: 'What’s my BMI?', go: 'bmi-mine' }, { label: 'Something else', go: 'topics' }], ['body']);
      return true;
    }
    // height: "170 cm", "1.7 m", "5 ft 7", "5'7"
    if (!q && /\b(height|tall|lamba|lambai|i am|i'm|im)\b/.test(t) && (m = /(\d(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(\d{1,2}(?:\.\d+)?)?\s*(?:in|inch|inches|")?|(\d{2,3}(?:\.\d+)?)\s*(cm|centimet(?:er|re)s?)|(\d(?:\.\d+)?)\s*(m|metres?|meters?)\b/.exec(t))) {
      var cm = m[1] ? (+m[1]) * 30.48 + (m[2] ? +m[2] : 0) * 2.54 : m[3] ? +m[3] : (+m[5]) * 100;
      var e2 = C.checkBody({ heightCm: cm, age: M.ageFrom(p) }).filter(function (x) { return x.key === 'heightCm'; })[0];
      if (e2) { botText('Hmm — ' + e2.msg); return true; }
      p.heightCm = Math.round(cm * 10) / 10; M.save();
      botText('📏 Saved your height: **' + M.showH(p.heightCm) + '**.', [{ label: 'What’s my BMI?', go: 'bmi-mine' }, { label: 'Something else', go: 'topics' }]);
      return true;
    }
    // age
    if (!q && (m = /\b(?:i am|i'm|im|my age is|age is|age)\s*(\d{1,3})\s*(?:years?|yrs?|y\/?o|saal)?(?:\s*old)?\s*$/.exec(t)) && (/year|yr|old|age|saal/.test(t) || +m[1] <= 99)) {
      var ag = +m[1];
      if (ag < 5 || ag > 120) { botText('Hmm — Mizan is made for ages 5 to 120.'); return true; }
      p.age = ag; p.dob = ''; M.save();
      botText('🎂 Got it — you’re **' + ag + '**. Sleep, calorie and exercise advice now uses your age.', [{ label: 'How much sleep do I need?', go: 'sl-how' }, { label: 'Something else', go: 'topics' }]);
      return true;
    }
    // timetable reminders ("remind me before my class ends", "turn off task reminders", "set alarms for my timetable")
    var blk = !/\b(water|paani|pani|drink|glass)\b/.test(t) && /\b(task|tasks|block|blocks|timetable|time table|schedule|class|classes|period|periods|activity|activities|before (it|each|every|my|the) ?\w* ?(ends?|finish(es)?|over))\b/.test(t);
    if (blk && !ask && (/\b(stop|turn off|switch off|disable|no more|band karo|mat)\b.*\bremind/.test(t) || /\bremind\w*\b.*\b(off|stop)\b/.test(t))) {
      M.state.settings.blockRemind = Object.assign({}, M.state.settings.blockRemind, { on: false }); M.save();
      botText('🔕 Timetable reminders are off. Say “turn on timetable reminders” any time.', [{ label: 'Something else', go: 'topics' }], ['remindSet']); return true;
    }
    if (blk && !ask && /\b(turn on|switch on|enable|start|remind me|alert me|notify me)\b/.test(t) && !/\b(alarm|alarms|calendar|closed)\b/.test(t)) {
      M.state.settings.blockRemind = Object.assign({}, M.state.settings.blockRemind, { on: true }); M.save();
      botText('🔔 Done — while Mizan is open, I’ll remind you **' + (M.state.settings.blockRemind.before || 5) + ' minutes before each block ends**, with what’s next.\nWant reminders even when Mizan is closed? Your phone’s calendar can ring for you.', [{ label: 'Set up phone alarms', act: 'calAlarms', main: true }, { label: 'Something else', go: 'topics' }]); return true;
    }
    if (/\b(alarm|alarms|ring|calendar)\b/.test(t) && (blk || /\b(closed|background|band|app (is )?closed|when .* closed|phone)\b/.test(t))) { botSay('tt-remind'); return true; }
    // water reminders
    if (!ask && (m = /\bremind\w*\b.*\bevery\s*(\d+(?:\.\d+)?|an|a|half an?)?\s*(min|mins|minutes?|hours?|hrs?|h|ghant[ae])\b/.exec(t))) {
      var mins = /half/.test(m[1] || '') ? 30 : (m[1] && !/^an?$/.test(m[1]) ? parseFloat(m[1]) : 1) * (/^(h|hour|hours|hr|hrs|ghant)/.test(m[2]) ? 60 : 1);
      var choices = [30, 45, 60, 90, 120, 150, 180];
      var pick = choices.reduce(function (a, c) { return Math.abs(c - mins) < Math.abs(a - mins) ? c : a; }, 90);
      var w = M.state.settings.water; w.remind = true; w.everyMin = pick; M.save(); if (M.waterReminder) M.waterReminder.check();
      botText('⏰ Done — I’ll remind you to drink water **' + M.fmtDur(pick) + '** after each glass' + (pick !== Math.round(mins) ? ' (the closest setting)' : '') + '.\n' + M.water.nextText() + '.', [{ label: 'Something else', go: 'topics' }], ['waterSet']);
      return true;
    }
    if (!ask && (/\b(stop|turn off|switch off|disable|no more|band karo|mat)\b.*\bremind/.test(t) || /\bremind\w*\b.*\b(off|stop)\b/.test(t))) {
      M.state.settings.water.remind = false; M.save(); if (M.waterReminder) M.waterReminder.check();
      botText('🔕 Water reminders are off. Say “turn on water reminders” any time.', [{ label: 'Something else', go: 'topics' }], ['waterSet']);
      return true;
    }
    if (!ask && /\b(turn on|switch on|enable|start)\b.*\bremind/.test(t)) {
      M.state.settings.water.remind = true; M.save(); if (M.waterReminder) M.waterReminder.check();
      botText('🔔 Water reminders are on — every ' + M.fmtDur(M.state.settings.water.everyMin || 90) + ' after a glass.\n' + M.water.nextText() + '.', [{ label: 'Something else', go: 'topics' }], ['waterSet']);
      return true;
    }
    // theme
    if (!ask && (m = /\b(dark|light|night|day|system|auto)\s*(mode|theme)\b|\b(?:switch|change|turn)\s*(?:to|on)?\s*(dark|light)\b/.exec(t))) {
      var th = (m[1] || m[3]) === 'night' ? 'dark' : (m[1] || m[3]) === 'day' ? 'light' : (m[1] || m[3]) === 'auto' ? 'system' : (m[1] || m[3]);
      M.state.settings.theme = th; M.save(); M.applyTheme();
      botText(th === 'system' ? 'Done — Mizan now follows your phone’s light or dark setting.' : 'Done — ' + th + ' mode is on. 🌓', [{ label: 'More appearance options', act: 'look' }, { label: 'Something else', go: 'topics' }]);
      return true;
    }
    // workout intensity
    if (!ask && /\b(workout|training|exercise|gym)\b/.test(t) && (m = /\b(harder|tougher|more intense|intense|high intensity|heavier|easier|lighter|less intense|low intensity|gentler|medium|normal|moderate)\b/.exec(t))) {
      var lvl = /hard|tough|more intense|^intense|high|heav/.test(m[1]) ? 'high' : /eas|light|less|low|gentl/.test(m[1]) ? 'low' : 'medium';
      var wp = M.state.workoutPlan;
      if (!wp) { botText('You don’t have a workout plan yet. Build one and pick **Low, Medium or High** intensity.', [{ label: 'Something else', go: 'topics' }], ['workout']); return true; }
      var nw = M.buildWorkoutPlan(Object.assign(M.workoutOpts(wp, p), { intensity: lvl }));
      nw.created = wp.created; if (wp.easyDismissed) nw.easyDismissed = wp.easyDismissed;
      var ch = M.workoutDiff(wp, nw);
      M.state.workoutPlan = nw;
      p.workoutIntensity = lvl; M.save();
      botText('💪 Your workout plan is now **' + lvl + ' intensity** — ' + M.workoutDescribe(nw) + '.' + (ch.length ? '\n' + ch.slice(0, 3).map(function (x) { return '• ' + M.exercise(x.from).name + ' → **' + M.exercise(x.to).name + '**'; }).join('\n') : '') + '\n' + nw.effort, [{ label: 'Something else', go: 'topics' }], ['workout']);
      return true;
    }
    // names
    if (!ask && (m = /\b(?:call me|my name is|mera naam)\s+([a-z][a-z .'-]{0,28}?)(?:\s+hai)?\s*$/.exec(t))) {
      var nm = m[1].replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
      p.name = nm; M.save();
      botText('Nice to meet you, **' + nm.split(' ')[0] + '**! 👋', [{ label: 'Show topics', go: 'topics' }]);
      return true;
    }
    if ((m = /\b(?:your name is|i('ll| will) call you|rename you to|change your name to|be called)\s+([a-z][a-z0-9 .'-]{0,18})\s*$/.exec(t))) {
      var bn = (m[2] || '').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      if (bn) { cfg().name = bn; M.save(); applyLook(); botText('I like it — I’m **' + bn + '** now. 😊', [{ label: 'More ways to customise me', act: 'botSet' }, { label: 'Show topics', go: 'topics' }]); return true; }
    }
    // start things
    if (/\b(start|begin|track)\b.*\b(walk|run|jog|running|walking|jogging)\b/.test(t)) { botText('Opening Run & walk — pick Walk or Run and tap Start. 🏃', [{ label: 'Something else', go: 'topics' }]); setTimeout(function () { go('move'); }, 500); return true; }
    if (/\b(start|begin|set)\b.*\b(focus|pomodoro|study timer|timer)\b/.test(t)) { if (chatDlg && chatDlg.open) chatDlg.close(); U.focusTimer(''); return true; }
    // open a page
    if ((m = /\b(?:open|go to|goto|show me|show|take me to|launch|kholo)\s+(?:the\s+|my\s+)?([a-z &]+?)(?:\s+(?:page|screen|tab))?\s*$/.exec(t))) {
      for (var j = 0; j < PAGES.length; j++) if (PAGES[j][0].test(m[1])) { botText('Opening **' + PAGES[j][2] + '**.', [{ label: 'Something else', go: 'topics' }]); var path = PAGES[j][1]; setTimeout(function () { go(path); }, 450); return true; }
    }
    // small talk
    if (/\b(what('s| is)? the time|what time is it|time now|current time|time kya|kitne baje|samay kya)\b/.test(t)) { botText('It’s **' + M.fmtTime(M.nowMin()) + '**.' + (M.dayNow && !M.dayNow().none && M.dayNow().cur ? ' You should be on: **' + M.dayNow().cur.b.title + '**.' : '')); return true; }
    if (/\b(what('s| is)? (the )?(date|day)( today)?|aaj kya date)\b/.test(t)) { botText('Today is **' + M.fmtDate(M.today()) + '**.'); return true; }
    if (/^(bye|goodbye|good night|see you|tata|alvida|gn)\b/.test(t)) { botText('Bye' + (firstName() ? ' ' + firstName() : '') + '! Have a good one. 👋', [{ label: 'Actually, one more thing', go: 'topics' }]); return true; }
    if (/\b(who|what) are you\b|\bare you (a |an )?(bot|robot|human|ai|real)\b|who (made|built|created) you/.test(t)) { botText('I’m **' + botName() + '**, the assistant inside Mizan. I run entirely on your phone — no internet or account needed — so I can’t chat about everything, but I know Mizan and healthy routines well.', [{ label: 'What can you do?', go: 'about' }]); return true; }
    return false;
  }
  function handleText(text) {
    text = String(text || '').trim();
    if (!text) return;
    userSay(text);
    var low = text.toLowerCase();
    var s = tb();
    if (s && !s.paused && tbText(text)) return;
    if (sd() && sdText(text)) return;
    // plain commands first ("I drank 2 glasses of water" shouldn't just pick the "Water" button), then the buttons on screen
    if (smartAction(text)) return;
    if (sdIntent(text)) return;
    var oi = matchOption(text);
    if (oi !== null) { runOption(lastOpts()[oi]); return; }
    if (/\b(continue|resume|carry on)\b.*\b(time ?table|schedule|routine)\b/.test(low) && s) { tbResume(); return; }
    if (/\b(custom|own|khud|apna|step by step|from scratch|myself|manually)\b.*\b(time ?table|schedule|routine|plan|day)\b|\b(time ?table|schedule|routine)\b.*\b(custom|myself|step by step|khud|manually)\b/.test(low)) { tbStart(false); return; }
    var custom = customReply(text);
    if (custom) { botText(custom); return; }
    if (/^(hi+|hello|hey+|namaste|salaam|salam|hola|yo)\b/.test(low) && low.length < 25) { botText('Hi' + (firstName() ? ' ' + firstName() : '') + '! 👋 What can I help you with?', N.topics.opts()); return; }
    if (/\b(thanks|thank you|thx|shukriya|dhanyavad)\b/.test(low)) { botSay('thanks'); return; }
    if (/^(yes|yeah|yep|ok|okay|haan|sure)\b/.test(low) && low.length < 12) { botSay('topics'); return; }
    if (/^(no|nope|nah|nahi)\b/.test(low) && low.length < 12) { botSay('no'); return; }
    if (/^(help|what can you do)/.test(low) && low.length < 22) { botSay('about'); return; }
    var r = understand(text);
    if (r.length && r[0].score >= 0.4) { botSay(r[0].id); return; }
    // still building a timetable: keep its buttons instead of changing the subject
    if ((s && !s.paused && /^(review|choose|fixed|days)$/.test(s.step)) || sd()) {
      var lo = lastOpts();
      if (lo.length) { tbMsg('I didn’t catch that — tap one of these, or type **stop** to finish later.', lo); return; }
    }
    var sug = r.slice(0, 3).filter(function (x) { return x.score > 0.15; });
    botText('I’m not sure I understood that' + (sug.length ? ' — did you mean one of these?' : '. Could you say it another way, or pick a topic?') +
      '\nYou can also just tell me things, like “I drank 2 glasses”, “I weigh 68 kg”, “remind me every hour”, “make my workout easier”, “dark mode” or “open the plan”.',
      sug.map(function (x) { return { label: labelFor(x.id), go: x.id }; }).concat([{ label: 'Show topics', go: 'topics' }]));
  }
  function choose(i) {
    var h = history(), last = h[h.length - 1];
    if (!last || !last.opts || !last.opts[i]) return;
    var o = last.opts[i];
    userSay(o.label);
    runOption(o);
  }
  function runAct(a) {
    var A = ACTS[a];
    if (!A) return;
    if (chatDlg && chatDlg.open && (A.href || a === 'setup' || a === 'addBlock' || a === 'special' || a === 'calAlarms')) chatDlg.close();
    if (A.href) { location.hash = A.href; return; }
    if (A.run) A.run();
  }

  function mount(host) {
    var inDialog = !!host.closest('dialog');
    host.innerHTML = '<div class="chat">' +
      '<div class="chat-head"><span class="ava big" aria-hidden="true">' + ava() + '</span><div class="grow"><strong>' + M.esc(botName()) + '</strong><span>Your Mizan assistant · works offline</span></div>' +
      '<button type="button" class="icon-btn sm" data-chat="restart" aria-label="Start over" title="Start over">' + M.icon('refresh') + '</button>' +
      '<a class="icon-btn sm" href="#/settings/assistant" data-chat="settings" aria-label="Customize the assistant" title="Customize">' + M.icon('palette') + '</a>' +
      (inDialog ? '<button type="button" class="icon-btn sm" data-close aria-label="Close">' + M.icon('x') + '</button>' : '') + '</div>' +
      '<div class="chat-log" role="log" aria-live="polite" aria-label="Conversation" tabindex="0"></div>' +
      '<form class="chat-input"><input class="input" name="msg" autocomplete="off" maxlength="300" placeholder="Type your question…" aria-label="Message to ' + M.esc(botName()) + '"><button type="submit" class="btn btn-primary" aria-label="Send">' + M.icon('send') + '</button></form></div>';
    hosts.push(host);
    applyLook(cfg(), host);
    host.addEventListener('click', function (e) {
      var o = e.target.closest('[data-opt]'); if (o) { choose(+o.getAttribute('data-opt')); return; }
      var cc = e.target.closest('.chat-cal');
      if (cc && sdCal) {
        if (e.target.closest('[data-cal-done]')) { if (!sdCal.sel.length || !sd()) return; userSay(M.special.label(sdCal.sel, 4)); sd().dates = sdCal.sel.slice(); sdAfterDays(); return; }
        if (M.special.calClick(e, sdCal)) { if (sd()) { sd().dates = sdCal.sel.slice(); persist(); } M.special.calRedraw(cc, sdCal); }
        return;
      }
      var a = e.target.closest('.chat-act'); if (a) { runAct(a.getAttribute('data-act')); return; }
      var c = e.target.closest('[data-chat]');
      if (c && c.getAttribute('data-chat') === 'restart') { M.state.chat = []; M.state.sdChat = null; if (tb()) tb().paused = true; persist(); botSay('hello', true); }
      if (c && c.getAttribute('data-chat') === 'settings' && chatDlg && chatDlg.open) chatDlg.close();
    });
    host.addEventListener('submit', function (e) {
      var f = e.target.closest('.chat-time');
      if (!f) return;
      e.preventDefault();
      var v = f.t.value;
      if (!v) return;
      userSay(M.fmtTime(v));
      tbPicked(M.toMin(v));
    });
    host.querySelector('.chat-input').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = e.target.msg, v = inp.value; inp.value = '';
      handleText(v);
    });
    var h = history();
    var stale = h.length && Date.now() - (h[h.length - 1].t || 0) > 6 * 3600000;
    if (!h.length || stale) { M.state.chat = []; M.state.sdChat = null; if (tb()) tb().paused = true; botSay('hello', true); } else paint();
  }

  /* ------------------------------------------------------------------ */
  /* Look                                                                 */
  /* ------------------------------------------------------------------ */
  function styleEl(el, b) {
    if (b.color) { el.style.setProperty('--bot-bg', b.color); el.style.setProperty('--bot-ink', M.textOn(b.color)); } else { el.style.removeProperty('--bot-bg'); el.style.removeProperty('--bot-ink'); }
    if (b.userColor) { el.style.setProperty('--me-bg', b.userColor); el.style.setProperty('--me-ink', M.textOn(b.userColor)); } else { el.style.removeProperty('--me-bg'); el.style.removeProperty('--me-ink'); }
    el.setAttribute('data-bubble', b.bubble || 'round');
    el.setAttribute('data-size', b.size || 'm');
  }
  function applyLook(b, only) {
    b = b || cfg();
    (only ? [only] : M.$$('.chat-host')).forEach(function (el) { styleEl(el, b); });
    fab();
  }
  function fab() {
    if (!M.state) return;
    var b = cfg();
    var el = M.$('.chat-fab');
    var route = M.currentRoute ? M.currentRoute.name : '';
    var show = b.showButton !== false && M.state.settings.onboarded && ['assistant', 'welcome', 'move', 'setup'].indexOf(route) < 0;
    document.body.classList.toggle('has-fab', show);
    if (!show) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('button');
      el.type = 'button'; el.className = 'chat-fab';
      el.addEventListener('click', function () { M.assistant.open(); });
      document.body.appendChild(el);
    }
    el.setAttribute('aria-label', 'Ask ' + botName());
    el.classList.toggle('left', b.position === 'left');
    el.innerHTML = '<span aria-hidden="true">' + ava() + '</span>';
    styleEl(el, b);
  }

  /* ------------------------------------------------------------------ */
  /* Settings → Assistant                                                 */
  /* ------------------------------------------------------------------ */
  var AVATARS = ['✨', '🤖', '🌿', '🦉', '💬', '🙂', '⭐', '🧠', 'icon'];
  var COLORS = ['', '#1b1a17', '#3d62d6', '#0a968c', '#6a9a1e', '#c8509c', '#d9612b', '#5e3a9e'];
  var COLOR_NAMES = ['Default', 'Ink', 'Blue', 'Teal', 'Green', 'Pink', 'Orange', 'Purple'];
  function settingsHtml() {
    var b = cfg();
    var sw = function (path, title, desc) { return '<label class="switch"><span class="sw-text"><strong>' + title + '</strong>' + (desc ? '<span>' + desc + '</span>' : '') + '</span><input type="checkbox" data-bot="' + path + '"' + (b[path] !== false ? ' checked' : '') + '></label>'; };
    var colorRow = function (key, label) {
      var v = b[key] || '';
      return '<fieldset class="field"><legend class="label">' + label + '</legend><div class="swatches">' + COLORS.map(function (c, i) {
        return '<label class="swatch"><input type="radio" name="' + key + '" value="' + c + '"' + (v === c ? ' checked' : '') + '><span style="--sw:' + (c || 'var(--surface-3)') + '"></span><em>' + COLOR_NAMES[i] + '</em></label>';
      }).join('') + '<label class="swatch"><input type="color" class="sw-pick" data-botcolor="' + key + '" value="' + (v || '#888888') + '" aria-label="Custom colour: ' + label + '"><em>Custom</em></label></div></fieldset>';
    };
    var style = '<div class="field"><label for="bot-ava">Avatar (emoji or letters)</label><input class="input" id="bot-ava" data-botval="avatar" maxlength="4" value="' + M.esc(b.avatar === 'icon' ? '' : b.avatar || '') + '"></div>' +
      '<fieldset class="field"><legend class="label">Quick avatars</legend><div class="choice-row">' + AVATARS.map(function (a) { return '<label class="choice"><input type="radio" name="avatar" value="' + a + '"' + ((b.avatar || '✨') === a ? ' checked' : '') + '><span>' + (a === 'icon' ? 'Icon' : a) + '</span></label>'; }).join('') + '</div></fieldset>' +
      colorRow('color', 'My bubble colour') + colorRow('userColor', 'Your bubble colour') +
      '<fieldset class="field"><legend class="label">Bubble shape</legend>' + U.radios('bubble', [['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']], b.bubble || 'round') + '</fieldset>' +
      '<fieldset class="field"><legend class="label">Chat text size</legend>' + U.radios('size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], b.size || 'm') + '</fieldset>' +
      '<fieldset class="field"><legend class="label">Button position</legend>' + U.radios('position', [['right', 'Right'], ['left', 'Left']], b.position || 'right') + '</fieldset>';
    var talk = '<div class="field"><label for="bot-greet">First message</label><textarea class="textarea" id="bot-greet" data-botval="greeting" maxlength="300" placeholder="Hi {name}! 👋 I’m {bot}. Is there something you’re struggling with, or something you’d like to add to your day?">' + M.esc(b.greeting || '') + '</textarea><span class="hint">Leave empty for the default. {name} = your first name, {bot} = my name.</span></div>' +
      '<fieldset class="field"><legend class="label">Topics I show</legend><div class="choice-row">' + TOPICS.map(function (t) { return '<label class="choice"><input type="checkbox" data-topic="' + t.id + '"' + ((b.hidden || []).indexOf(t.id) < 0 ? ' checked' : '') + '><span>' + M.esc(t.label) + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<fieldset class="field"><legend class="label">Teach me your own replies</legend><p class="hint" style="margin:0 0 8px">When a message contains one of the trigger words, I answer with your reply. Separate trigger words with commas.</p><ul class="custom-replies">' +
      (b.custom || []).map(function (c, i) { return '<li><div class="grow"><strong>' + M.esc(c.q) + '</strong><span>' + M.esc(c.a) + '</span></div><button type="button" class="icon-btn sm" data-del-reply="' + i + '" aria-label="Delete reply for ' + M.esc(c.q) + '">' + M.icon('trash') + '</button></li>'; }).join('') + '</ul>' +
      '<div class="form-grid"><div class="field"><label for="cr-q">Trigger words</label><input class="input" id="cr-q" maxlength="80" placeholder="e.g. tuition, coaching"></div><div class="field"><label for="cr-a">My reply</label><input class="input" id="cr-a" maxlength="300" placeholder="e.g. Tuition is Mon, Wed, Fri at 5 pm."></div></div>' +
      '<button type="button" class="btn" data-bot-act="add-reply">' + M.icon('plus') + 'Add reply</button></fieldset>' +
      '<button type="button" class="btn btn-danger" data-bot-act="reset">' + M.icon('refresh') + 'Reset assistant</button>';
    return '<div class="stack">' +
      '<div class="bot-preview chat-host"><div class="chat-log"><div class="msg bot"><span class="ava" aria-hidden="true">' + ava() + '</span><div class="bot-col"><div class="bubble"><p>Hi! I’m <strong>' + M.esc(botName()) + '</strong>. This is how I’ll look.</p></div></div></div><div class="msg me"><div class="bubble">Looks great!</div></div></div></div>' +
      '<div class="field"><label for="bot-name">Name</label><input class="input" id="bot-name" data-botval="name" maxlength="20" value="' + M.esc(botName()) + '"></div>' +
      sw('showButton', 'Show the assistant button', 'The round button that floats above every screen.') +
      sw('remember', 'Remember our chat', 'Keeps the conversation on this device between visits.') +
      '<div class="row wrap"><button type="button" class="btn btn-primary" data-bot-act="open">' + M.icon('chat') + 'Open chat</button><button type="button" class="btn" data-bot-act="clear">' + M.icon('trash') + 'Clear chat</button></div>' +
      M.moreOpts(style, 'Look: avatar, colours, bubbles', 'bot-look') +
      M.moreOpts(talk, 'Greeting, topics & your own replies', 'bot-talk') + '</div>';
  }
  function settingsBind(el) {
    var b = cfg();
    var pv = function () { return M.$('.bot-preview', el); };
    var done = function (rerender) { M.save(); applyLook(b); if (pv()) styleEl(pv(), b); if (rerender) M.refresh(); };
    el.addEventListener('input', function (e) {
      var t = e.target, k = t.getAttribute('data-botval');
      if (k) {
        b[k] = t.value.trim() || (k === 'name' ? 'Mizo' : k === 'avatar' ? '✨' : '');
        done(false);
        if (pv() && (k === 'name' || k === 'avatar')) { pv().querySelector('.ava').innerHTML = ava(); pv().querySelector('strong').textContent = botName(); }
      }
      var ck = t.getAttribute('data-botcolor');
      if (ck) { b[ck] = t.value; done(false); }
    });
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (t.type === 'radio' && ['bubble', 'size', 'position', 'avatar', 'color', 'userColor'].indexOf(t.name) >= 0) { b[t.name] = t.value; done(true); M.toast('Saved'); }
      var p = t.getAttribute('data-bot'); if (p) { b[p] = t.checked; if (p === 'remember' && !t.checked) M.state.chat = []; done(false); M.toast('Saved'); }
      var tp = t.getAttribute('data-topic'); if (tp) { b.hidden = b.hidden || []; if (t.checked) b.hidden = b.hidden.filter(function (x) { return x !== tp; }); else b.hidden.push(tp); done(false); }
      if (t.getAttribute('data-botval') || t.getAttribute('data-botcolor')) M.toast('Saved');
    });
    el.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del-reply]');
      if (d) { b.custom.splice(+d.getAttribute('data-del-reply'), 1); done(true); return; }
      var a = e.target.closest('[data-bot-act]'); if (!a) return;
      var act = a.getAttribute('data-bot-act');
      if (act === 'add-reply') {
        var q = M.$('#cr-q', el).value.trim(), r = M.$('#cr-a', el).value.trim();
        if (!q || !r) { M.haptic('error'); M.toast('Add trigger words and a reply.'); return; }
        b.custom = b.custom || []; b.custom.push({ q: q, a: r }); M.haptic('success'); done(true); M.toast('Reply added');
      }
      if (act === 'open') M.assistant.open();
      if (act === 'clear') { M.state.chat = []; M.save(); M.toast('Chat cleared'); }
      if (act === 'reset') { M.state.settings.bot = { name: 'Mizo', avatar: '✨', color: '', userColor: '', bubble: 'round', size: 'm', position: 'right', showButton: true, greeting: '', custom: [], hidden: [], remember: true }; M.save(); applyLook(); M.toast('Assistant reset'); M.refresh(); }
    });
  }

  /* ------------------------------------------------------------------ */
  M.assistant = {
    open: function () {
      if (chatDlg && chatDlg.open) return;
      chatDlg = M.sheet({ title: botName(), body: '<div class="chat-host in-sheet"></div>', noAutofocus: true, onOpen: function (dlg) { dlg.classList.add('chat-sheet'); mount(dlg.querySelector('.chat-host')); } });
    },
    applyLook: applyLook, fab: fab,
    settingsHtml: settingsHtml, settingsBind: settingsBind,
    understand: understand, handleText: handleText, nodes: N,
    startBuilder: startBuilder
  };

  M.views.assistant = {
    head: function () { return { title: botName(), sub: 'Your Mizan assistant' }; },
    render: function (el) { el.innerHTML = '<div class="chat-host page"></div>'; mount(el.querySelector('.chat-host')); }
  };

  // keep the floating button in sync with the current screen
  window.addEventListener('hashchange', function () { setTimeout(fab, 0); });
  setTimeout(fab, 0);
})();
