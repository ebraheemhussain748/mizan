/* Mizan — starter routines and habit ideas */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  function B(start, end, title, cat, notes) {
    return { id: M.uid(), start: start, end: end, title: title, cat: cat, notes: notes || '', anchor: null };
  }

  var T = {};
  /* A neutral quiet start to the morning */
  function Morning(start, end, withNote) {
    return B(start, end, 'Quiet start — plan your day', 'personal', withNote ? 'A glass of water, a stretch and a look at today’s plan.' : '');
  }

  T.earlyRiser = function () {
    return [
      { id: M.uid(), name: 'School day', days: [1, 2, 3, 4, 5, 6], blocks: [
        B('04:00', '04:15', 'Wake up & wash', 'routine', 'Brush teeth and a quick wash — just enough to feel fresh.'),
        Morning('04:15', '04:25', true),
        B('04:25', '04:35', 'Light snack & water', 'meal', 'A small bite (banana, dates or toast) and a glass of water. The full breakfast comes after exercise.'),
        B('04:35', '04:50', 'Get dressed for exercise', 'routine', 'Workout clothes and shoes — laid out the night before.'),
        B('04:50', '05:00', 'Head to the park', 'routine', 'Walk over so you meet your friend right at 5:00.'),
        B('05:00', '06:00', 'Park & exercise', 'exercise', 'Walk or jog, a few exercises, then stretch. Keep most days comfortable — not maximum effort every day.'),
        B('06:00', '06:05', 'Cool down', 'routine', 'Catch your breath and drink water.'),
        B('06:05', '06:35', 'Shower & full breakfast', 'meal', 'A proper breakfast with some protein (milk, curd, eggs, paneer or dal cheela).'),
        B('06:35', '07:00', 'Get ready for school', 'routine', 'Dress, check your bag, leave on time.'),
        B('07:00', '14:00', 'School', 'school', 'Classes, learning and school activities.'),
        B('14:00', '14:15', 'Decompress', 'routine', 'Change, wash up, sit quietly for a few minutes.'),
        B('14:15', '14:45', 'Lunch', 'meal', 'Unrushed.'),
        B('14:45', '15:30', 'Free time', 'free', 'Hobby, play, family — no screen needed.'),
        B('15:30', '16:00', 'Screen time', 'screen', 'Kept to its own window so it doesn’t spill into rest or study.'),
        B('16:00', '16:10', 'Settle in', 'routine', 'Clear the desk and get your books out.'),
        B('16:10', '17:20', 'Study block 1 — homework', 'study', '70 focused minutes. Phone in another room.'),
        B('17:20', '17:35', 'Real break', 'free', 'Stand up, stretch, have a snack. Not scrolling.'),
        B('17:35', '18:45', 'Study block 2 — revision & practice', 'study', 'Test yourself instead of re-reading.'),
        B('18:45', '19:00', 'Wrap up', 'routine', 'Tidy up and note where you stopped.'),
        B('19:00', '19:30', 'Dinner', 'meal', 'Family time.'),
        B('19:30', '19:50', 'Prepare for tomorrow', 'routine', 'Pack your bag, lay out clothes and workout kit.'),
        B('19:50', '20:00', 'Wind down (screen-free)', 'routine', 'Phone away. Dim lights.'),
        B('20:00', '04:00', 'Sleep', 'sleep', '8 hours — recovery, growth and concentration depend on it.')
      ] },
      { id: M.uid(), name: 'Sunday', days: [0], blocks: [
        B('04:00', '04:15', 'Wake up & wash', 'routine'),
        Morning('04:15', '04:25'),
        B('04:25', '04:35', 'Light snack & water', 'meal'),
        B('04:35', '05:00', 'Get ready & head to the park', 'routine'),
        B('05:00', '06:00', 'Park & exercise', 'exercise', 'An easy session or a longer walk — Sunday is for recovery.'),
        B('06:00', '06:45', 'Shower & breakfast', 'meal'),
        B('06:45', '09:00', 'Free morning', 'free', 'Hobby, reading, time with family.'),
        B('09:00', '10:30', 'Weekly review of lessons', 'study', 'Light revision of the week — no new heavy topics.'),
        B('10:30', '12:30', 'Family time & errands', 'free'),
        B('12:30', '13:15', 'Lunch', 'meal'),
        B('13:15', '14:30', 'Rest', 'routine', 'A short nap (20–30 min) or quiet time.'),
        B('14:30', '16:00', 'Time with friends / outdoors', 'free'),
        B('16:00', '17:00', 'Screen time', 'screen'),
        B('17:00', '18:00', 'Plan the week & tidy up', 'routine', 'Look at next week’s tests and homework. Adjust this plan if needed.'),
        B('18:00', '19:00', 'Family time', 'free'),
        B('19:00', '19:30', 'Dinner', 'meal'),
        B('19:30', '19:50', 'Prepare for Monday', 'routine'),
        B('19:50', '20:00', 'Wind down (screen-free)', 'routine'),
        B('20:00', '04:00', 'Sleep', 'sleep')
      ] }
    ];
  };

  T.schoolStudent = function () {
    return [
      { id: M.uid(), name: 'School day', days: [1, 2, 3, 4, 5], blocks: [
        B('06:00', '06:20', 'Wake up & freshen up', 'routine'),
        B('06:20', '06:50', 'Morning movement', 'exercise', 'Walk, skip, stretch or a short home workout.'),
        B('06:50', '07:20', 'Breakfast', 'meal'),
        B('07:20', '07:40', 'Get ready & leave', 'routine'),
        B('07:40', '14:30', 'School', 'school'),
        B('14:30', '15:15', 'Lunch & rest', 'meal'),
        B('15:15', '16:15', 'Free time / play outside', 'free'),
        B('16:15', '17:30', 'Homework', 'study'),
        B('17:30', '17:45', 'Break', 'free'),
        B('17:45', '18:45', 'Revision', 'study'),
        B('18:45', '19:30', 'Screen time', 'screen'),
        B('19:30', '20:15', 'Dinner & family', 'meal'),
        B('20:15', '21:30', 'Hobby / reading', 'free'),
        B('21:30', '22:00', 'Wind down & pack bag', 'routine'),
        B('22:00', '06:00', 'Sleep', 'sleep', 'Teens need 8–10 hours.')
      ] },
      { id: M.uid(), name: 'Weekend', days: [0, 6], blocks: [
        B('07:00', '07:30', 'Wake up & freshen up', 'routine'),
        B('07:30', '08:30', 'Sport or long walk', 'exercise'),
        B('08:30', '09:15', 'Breakfast', 'meal'),
        B('09:15', '11:00', 'Weekly revision', 'study'),
        B('11:00', '13:00', 'Free time', 'free'),
        B('13:00', '14:00', 'Lunch', 'meal'),
        B('14:00', '17:00', 'Friends, family, hobbies', 'free'),
        B('17:00', '18:00', 'Screen time', 'screen'),
        B('18:00', '19:30', 'Free time', 'free'),
        B('19:30', '20:30', 'Dinner', 'meal'),
        B('20:30', '21:30', 'Plan the week', 'routine'),
        B('21:30', '22:00', 'Wind down', 'routine'),
        B('22:00', '07:00', 'Sleep', 'sleep')
      ] }
    ];
  };

  T.college = function () {
    return [
      { id: M.uid(), name: 'Class day', days: [1, 2, 3, 4, 5], blocks: [
        B('06:30', '06:50', 'Wake up & freshen up', 'routine'),
        B('06:50', '07:40', 'Workout', 'exercise'),
        B('07:40', '08:15', 'Breakfast', 'meal'),
        B('08:15', '09:00', 'Commute / buffer', 'routine'),
        B('09:00', '13:00', 'Classes', 'school'),
        B('13:00', '13:45', 'Lunch', 'meal'),
        B('13:45', '16:00', 'Classes / lab', 'school'),
        B('16:00', '16:45', 'Commute & snack', 'routine'),
        B('16:45', '18:15', 'Deep study', 'study'),
        B('18:15', '19:00', 'Break & walk', 'free'),
        B('19:00', '20:00', 'Study — practice problems', 'study'),
        B('20:00', '20:45', 'Dinner', 'meal'),
        B('20:45', '22:00', 'Free time & screens', 'screen'),
        B('22:00', '22:30', 'Wind down', 'routine'),
        B('22:30', '06:30', 'Sleep', 'sleep')
      ] },
      { id: M.uid(), name: 'Weekend', days: [0, 6], blocks: [
        B('07:30', '08:00', 'Wake up', 'routine'),
        B('08:00', '09:00', 'Long walk or sport', 'exercise'),
        B('09:00', '09:45', 'Breakfast', 'meal'),
        B('09:45', '12:00', 'Projects & revision', 'study'),
        B('12:00', '13:00', 'Lunch', 'meal'),
        B('13:00', '19:00', 'Free time', 'free'),
        B('19:00', '20:00', 'Dinner', 'meal'),
        B('20:00', '22:30', 'Free time', 'free'),
        B('22:30', '23:00', 'Wind down', 'routine'),
        B('23:00', '07:30', 'Sleep', 'sleep')
      ] }
    ];
  };

  T.office = function () {
    return [
      { id: M.uid(), name: 'Work day', days: [1, 2, 3, 4, 5], blocks: [
        B('06:30', '06:45', 'Wake up', 'routine'),
        B('06:45', '07:30', 'Workout', 'exercise'),
        B('07:30', '08:15', 'Shower & breakfast', 'meal'),
        B('08:15', '09:00', 'Commute', 'routine'),
        B('09:00', '13:00', 'Work — focus hours', 'school'),
        B('13:00', '13:45', 'Lunch & short walk', 'meal'),
        B('13:45', '18:00', 'Work', 'school'),
        B('18:00', '18:45', 'Commute', 'routine'),
        B('18:45', '19:30', 'Family time', 'free'),
        B('19:30', '20:15', 'Dinner', 'meal'),
        B('20:15', '21:30', 'Learning / hobby', 'study'),
        B('21:30', '22:00', 'Screen time', 'screen'),
        B('22:00', '22:30', 'Wind down', 'routine'),
        B('22:30', '06:30', 'Sleep', 'sleep')
      ] },
      { id: M.uid(), name: 'Weekend', days: [0, 6], blocks: [
        B('07:30', '08:00', 'Wake up', 'routine'),
        B('08:00', '09:15', 'Long workout / sport', 'exercise'),
        B('09:15', '10:00', 'Breakfast', 'meal'),
        B('10:00', '13:00', 'Errands & chores', 'routine'),
        B('13:00', '14:00', 'Lunch', 'meal'),
        B('14:00', '19:00', 'Free time', 'free'),
        B('19:00', '20:00', 'Dinner', 'meal'),
        B('20:00', '22:30', 'Free time', 'free'),
        B('22:30', '23:00', 'Wind down', 'routine'),
        B('23:00', '07:30', 'Sleep', 'sleep')
      ] }
    ];
  };

  T.blank = function () {
    return [
      { id: M.uid(), name: 'Every day', days: [0, 1, 2, 3, 4, 5, 6], blocks: [
        B('07:00', '07:30', 'Wake up', 'routine'),
        B('22:30', '23:00', 'Wind down', 'routine'),
        B('23:00', '07:00', 'Sleep', 'sleep')
      ] }
    ];
  };

  M.TEMPLATE_LIST = [
    { id: 'earlyRiser', name: 'Early-riser student', desc: 'Up at 4:00 for a calm start and a 5:00 park workout, school 7–2, two study blocks, asleep by 8.' },
    { id: 'schoolStudent', name: 'School student', desc: 'School 7:40–2:30, homework and revision in the afternoon, 8 hours of sleep.' },
    { id: 'college', name: 'College student', desc: 'Morning workout, classes 9–4, evening deep-study blocks.' },
    { id: 'office', name: 'Office 9–6', desc: 'Workout before work, focus hours in the morning, learning in the evening.' },
    { id: 'blank', name: 'Start from scratch', desc: 'Just wake-up and sleep — build the rest yourself.' }
  ];

  M.templates = {
    make: function (id) { return (T[id] || T.blank)(); },
    defaultRoutines: function () { return T.earlyRiser(); }
  };

  /* Evidence-based habit ideas — each has a cue (habit stacking) and a backup plan (if–then) */
  M.HABIT_IDEAS = [
    { name: 'Drink a glass of water', cue: 'Right after I wake up', backup: 'If I forget, I drink one with breakfast.', cat: 'meal' },
    { name: 'Two minutes of quiet breathing', cue: 'Before I start studying', backup: 'If I forget, I do it before bed.', cat: 'personal' },
    { name: 'Write one line of gratitude', cue: 'After I get into bed', backup: 'If I’m too tired, I think of one thing instead.', cat: 'personal' },
    { name: 'Walk 10 minutes after dinner', cue: 'After I finish dinner', backup: 'If it’s raining, I walk inside the house or climb stairs.', cat: 'exercise' },
    { name: 'Phone out of the bedroom', cue: 'When my wind-down block starts', backup: 'If I need an alarm, I use a clock or keep the phone across the room.', cat: 'screen' },
    { name: 'Read for 20 minutes', cue: 'After I get into bed', backup: 'If I’m very tired, I read just one page.', cat: 'free' },
    { name: 'Stretch for 5 minutes', cue: 'After I finish exercise', backup: 'If I skipped exercise, I stretch before dinner.', cat: 'exercise' },
    { name: 'Protein at breakfast', cue: 'When I plate my breakfast', backup: 'If there’s no egg or paneer, I add curd, milk or a dal cheela.', cat: 'meal' },
    { name: 'Test yourself for 10 minutes', cue: 'At the start of my revision block', backup: 'If I’m stuck, I explain the topic out loud instead.', cat: 'study' },
    { name: 'Plan tomorrow', cue: 'After I pack my school bag', backup: 'If I run late, I write just the top 3 tasks.', cat: 'routine' },
    { name: 'Eat one fruit', cue: 'With my afternoon snack', backup: 'If there’s no fruit, I have a handful of roasted chana.', cat: 'meal' }
  ];

  M.habitIdeas = function () { return M.HABIT_IDEAS; };

  M.MISS_REASONS = ['Too tired', 'Phone / screens', 'Ran late', 'Unexpected plan', 'Felt unwell', 'Forgot', 'Didn’t feel like it', 'Other'];
})();
