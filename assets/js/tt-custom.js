/* Mizan — custom timetables, built block by block with the assistant.
   A day is kept as a list of blocks with durations, starting at wake-up and ending back at wake-up
   (so it always covers exactly 24 hours). This file has the pieces the chat needs: understanding
   typed times, guessing categories, suggesting the next block, and reviewing a finished day — the
   good parts, the weak parts, and automatic fixes that keep all 24 hours planned. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var C = M.calc;
  var DAY = 1440;
  var R5 = function (m) { return Math.round(m / 5) * 5; };

  /* ------------------------------------------------------------------ */
  /* Words → category                                                     */
  /* ------------------------------------------------------------------ */
  var CAT_WORDS = [
    ['sleep', /\b(sleep|sleeping|bed ?time|go to bed)\b/],
    ['meal', /\b(breakfast|lunch|dinner|supper|snack|snacks|eat|eating|meal|tea|brunch|tiffin|khana|nashta)\b/],
    ['school', /\b(school|college|class|classes|lecture|lectures|coaching|tuition|tution|work|office|job|shift|duty|lab|university|uni)\b/],
    ['study', /\b(study|studies|studying|homework|home work|revision|revise|practice|practise|exam|learn|learning|notes|assignment|padhai)\b/],
    ['exercise', /\b(exercise|gym|workout|work out|run|running|jog|jogging|walk|walking|yoga|sport|sports|cricket|football|badminton|swim|swimming|cycling|cycle|park|stretch|stretching)\b/],
    ['screen', /\b(phone|mobile|tv|television|youtube|instagram|reels|games|gaming|screen|netflix|social media|pubg|bgmi)\b/],
    ['personal', /\b(pray|prayer|prayers|namaz|puja|pooja|meditate|meditation|journal|journaling|reflect|quiet|gratitude|read quran|bible)\b/],
    ['free', /\b(free|play|playing|family|friends|hobby|hobbies|relax|music|reading|read|guitar|drawing|chill|outside)\b/],
    ['routine', /\b(freshen|fresh|wash|bath|shower|brush|get ready|ready|dress|travel|commute|bus|chores|cook|cooking|clean|wind down|prepare|pack|buffer|rest|nap|break)\b/]
  ];
  function guessCat(name) {
    var t = String(name || '').toLowerCase();
    for (var i = 0; i < CAT_WORDS.length; i++) if (CAT_WORDS[i][1].test(t)) return CAT_WORDS[i][0];
    return 'routine';
  }
  function tidyTitle(name) {
    var s = String(name || '').trim().replace(/\s+/g, ' ');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* Usual length of common activities (minutes) */
  var USUAL = [
    [/freshen|wash|brush/, 15], [/bath|shower/, 15], [/get ready|dress/, 20], [/travel|commute|bus/, 20],
    [/breakfast|nashta/, 20], [/lunch/, 30], [/dinner|supper/, 30], [/snack|tea/, 15],
    [/school/, 390], [/college|university|lecture/, 360], [/work|office|job|shift/, 480], [/tuition|coaching|class/, 60],
    [/study|homework|revision|practice/, 60], [/exercise|gym|workout|run|jog|walk|yoga|sport|park/, 45],
    [/screen|phone|tv|youtube|games/, 30], [/free|play|family|friends|hobby/, 60], [/rest|nap/, 30],
    [/wind down|prepare|pack/, 20], [/pray|prayer|namaz|puja|meditat/, 15], [/break/, 10]
  ];
  function usual(title, cat) {
    var t = String(title).toLowerCase();
    for (var i = 0; i < USUAL.length; i++) if (USUAL[i][0].test(t)) return USUAL[i][1];
    return { study: 60, exercise: 45, meal: 30, screen: 30, free: 60, school: 360, routine: 15, personal: 15 }[cat] || 30;
  }
  function isLong(title, cat) { return cat === 'school' && !/tuition|coaching|class\b/i.test(title); }

  /* ------------------------------------------------------------------ */
  /* Understanding typed times                                            */
  /* ------------------------------------------------------------------ */
  /* "6", "6:30", "630", "6.30", "6 am", "6:30pm", "18:30", "noon", "midnight" → list of candidate clock minutes */
  function clockCandidates(text) {
    var s = String(text).toLowerCase().trim().replace(/\s+/g, ' ');
    if (/\bnoon\b|\bdopahar\b/.test(s)) return [720];
    if (/\bmidnight\b/.test(s)) return [0];
    var h, mi, ap, m;
    // "630", "1830", "630pm" — hours and minutes written together
    m = /(?:^|[^\d:.])(\d{1,2})(\d{2})(?![\d:.])\s*(am|pm|a\.m\.|p\.m\.|a|p)?/.exec(s);
    if (m) { h = +m[1]; mi = +m[2]; ap = m[3] ? m[3].charAt(0) : ''; }
    else {
      m = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p|baje)?(?![\d])/.exec(s);
      if (!m) return null;
      h = +m[1]; mi = m[2] ? +m[2] : 0; ap = m[3] && m[3] !== 'baje' ? m[3].charAt(0) : '';
    }
    if (h > 24 || mi > 59) return null;
    if (h === 24) h = 0;
    if (ap === 'a') return [(h % 12) * 60 + mi];
    if (ap === 'p') return [((h % 12) + 12) * 60 + mi];
    if (h === 0 || h > 12) return [h * 60 + mi];
    return [(h % 12) * 60 + mi, ((h % 12) + 12) * 60 + mi];
  }
  /* Next occurrence (as minutes after waking) that is after `after`. Wake-up time itself means "end of day". */
  function offsetFor(text, wake, after) {
    var c = clockCandidates(text);
    if (!c) return null;
    var best = null;
    c.forEach(function (clock) {
      var off = (clock - wake + DAY) % DAY;
      if (off === 0) off = DAY;
      if (off > after && (best === null || off < best)) best = off;
    });
    return best;
  }
  /* "30 min", "1 hour", "1.5 h", "90m", "2 hrs", "half an hour", "1h 20m" → minutes */
  function parseDur(text) {
    var s = String(text).toLowerCase();
    if (/half an? hour|aadha ghanta/.test(s)) return 30;
    var total = 0, hit = false, m;
    var hr = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|ghanta|ghante)\b/.exec(s);
    var mn = /(\d+)\s*(m|min|mins|minute|minutes)\b/.exec(s);
    if (hr) { total += parseFloat(hr[1]) * 60; hit = true; }
    if (mn) { total += +mn[1]; hit = true; }
    if (!hit && (m = /^\+?(\d+)$/.exec(s.trim())) && +m[1] >= 5 && +m[1] <= 600 && s.indexOf('+') === 0) { total = +m[1]; hit = true; }
    return hit && total > 0 ? Math.round(total) : null;
  }
  /* "Tuition till 6 pm", "study from 4 to 5:30", "breakfast 20 min" → {name, end?|dur?} */
  function splitActivity(text) {
    var s = String(text).trim();
    var m = /^(.+?)\s+(?:from\s+\S+(?:\s*(?:am|pm))?\s+)?(?:till|until|untill|to|upto|up to|–|-|tak)\s+(.+)$/i.exec(s);
    if (m) return { name: m[1].trim(), end: m[2].trim() };
    m = /^(.+?)\s+(?:for\s+)?(\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|m|min|mins|minutes?))$/i.exec(s);
    if (m) return { name: m[1].trim(), dur: parseDur(m[2]) };
    return { name: s };
  }

  /* ------------------------------------------------------------------ */
  /* Suggestions for the next block                                       */
  /* ------------------------------------------------------------------ */
  function suggest(clockMin, blocks, role) {
    var has = function (re) { return blocks.some(function (b) { return re.test(b.title.toLowerCase()); }); };
    var h = clockMin / 60;
    var fixed = role === 'college' ? 'College' : role === 'work' ? 'Work' : role === 'home' ? 'Main tasks' : 'School';
    var list;
    if (!blocks.length) list = ['Freshen up', 'Exercise', 'Study', 'Breakfast', 'Get ready'];
    else if (h >= 4 && h < 10) list = ['Freshen up', 'Exercise', 'Breakfast', 'Get ready', 'Travel', fixed, 'Study'];
    else if (h >= 10 && h < 16) list = [fixed, 'Lunch', 'Study', 'Rest', 'Free time', 'Travel'];
    else if (h >= 16 && h < 19) list = ['Study', 'Snack', 'Exercise', 'Free time', 'Screen time', 'Tuition'];
    else if (h >= 19 && h < 22) list = ['Dinner', 'Study', 'Family time', 'Screen time', 'Wind down', 'Sleep'];
    else list = ['Wind down', 'Sleep', 'Study'];
    return list.filter(function (x) {
      if (/breakfast/i.test(x)) return !has(/breakfast/);
      if (/lunch/i.test(x)) return !has(/lunch/);
      if (/dinner/i.test(x)) return !has(/dinner/);
      if (/freshen/i.test(x)) return !has(/freshen|wash|bath/);
      if (x === fixed) return !has(new RegExp(fixed.toLowerCase()));
      return true;
    }).slice(0, 7);
  }

  /* ------------------------------------------------------------------ */
  /* Review: what's good, what could be better                            */
  /* ------------------------------------------------------------------ */
  function hasMeal(blocks, re) { return blocks.some(function (b) { return b.cat === 'meal' && re.test(b.title.toLowerCase()); }); }
  function missingMeal(blocks) {
    if (!hasMeal(blocks, /dinner|supper|khana/)) return 'dinner';
    if (!hasMeal(blocks, /lunch/)) return 'lunch';
    return 'snack';
  }
  function totals(blocks) {
    var t = {}; blocks.forEach(function (b) { t[b.cat] = (t[b.cat] || 0) + b.dur; }); return t;
  }
  function withTimes(day) {
    var s = 0;
    return day.blocks.map(function (b) { var o = Object.assign({}, b, { s: s, e: s + b.dur }); s += b.dur; return o; });
  }
  function review(day, age) {
    var B = withTimes(day), W = day.wake;
    var tot = totals(day.blocks);
    var need = C.sleepNeed(age);
    var pros = [], cons = [];
    var clock = function (off) { return M.fmtTime((W + off) % DAY); };
    var sleep = tot.sleep || 0;
    var sleepIdx = -1; B.forEach(function (b, i) { if (b.cat === 'sleep') sleepIdx = i; });
    var sleepBlock = sleepIdx >= 0 ? B[sleepIdx] : null;
    // sleep
    if (!sleep) cons.push({ id: 'no-sleep', text: 'There’s **no sleep** in this day.', how: 'Turn the last ' + need.lo + ' hours before your wake-up time into sleep.', fix: true });
    else if (sleep < need.lo * 60) cons.push({ id: 'sleep', text: 'Only **' + M.fmtDur(sleep) + '** of sleep — ' + need.label.toLowerCase() + ' need ' + need.lo + '–' + need.hi + ' hours.', how: 'Go to bed ' + M.fmtDur(need.lo * 60 - sleep) + ' earlier by trimming screen and free time in the evening.', fix: true });
    else if (sleep > need.hi * 60 + 30) cons.push({ id: 'sleep-long', text: '**' + M.fmtDur(sleep) + '** of sleep is more than the usual ' + need.lo + '–' + need.hi + ' hours.', how: 'Go to bed a little later and use that time for something you enjoy.', fix: true });
    else pros.push('**' + M.fmtDur(sleep) + '** of sleep — right for your age (' + need.lo + '–' + need.hi + ' h).');
    // bedtime for teens
    if (sleepBlock && age !== null && age < 18) {
      var bed = (W + sleepBlock.s) % DAY;
      if (bed >= 23 * 60 || bed < 3 * 60) cons.push({ id: 'late-bed', text: 'Bedtime is **' + clock(sleepBlock.s) + '** — late for a teenager with an early start.', how: 'Aim to be asleep by about 10:30 pm on school nights.', fix: false });
    }
    // exercise
    var ex = tot.exercise || 0;
    var exNeed = age !== null && age < 18 ? 60 : 30;
    if (!ex) cons.push({ id: 'exercise', text: '**No exercise** in the day.', how: 'Add a 30-minute walk, sport or workout in the afternoon or evening.', fix: true });
    else if (ex >= exNeed) pros.push('**' + M.fmtDur(ex) + '** of exercise — great for energy, mood and focus.');
    else pros.push('**' + M.fmtDur(ex) + '** of exercise — a good start' + (age !== null && age < 18 ? ' (teens: aim for about 60 minutes a day).' : '.'));
    // breakfast
    var bf = B.filter(function (b) { return b.cat === 'meal' && b.s < 180; });
    if (!bf.length) cons.push({ id: 'breakfast', text: '**No breakfast** in the first 3 hours after waking.', how: 'Add a 20-minute breakfast early in the morning.', fix: true });
    else pros.push('You start the day with **' + bf[0].title.toLowerCase() + '**.');
    var meals = B.filter(function (b) { return b.cat === 'meal'; }).length;
    var miss = missingMeal(day.blocks);
    if (meals >= 3) pros.push('**' + meals + ' meals / snacks** spread through the day.');
    else if (meals && bf.length) cons.push({ id: 'meals', text: 'Only **' + meals + ' ' + M.plural(meals, 'meal') + '**' + (miss === 'dinner' ? ' and **no dinner**' : miss === 'lunch' ? ' and **no lunch**' : '') + ' — long gaps without food make it hard to focus.', how: miss === 'dinner' ? 'Add dinner about 2 hours before bed.' : miss === 'lunch' ? 'Add lunch around midday.' : 'Add a snack in the afternoon.', fix: true });
    // study
    var longStudy = B.filter(function (b) { return b.cat === 'study' && b.dur > 100; });
    var study = tot.study || 0;
    if (longStudy.length) cons.push({ id: 'study-split', text: '“' + longStudy[0].title + '” is **' + M.fmtDur(longStudy[0].dur) + '** without a break — focus drops after about an hour.', how: 'Split it into two parts with a 10-minute break.', fix: true });
    else if (study >= 45) pros.push('**' + M.fmtDur(study) + '** of study in focused blocks.');
    // screens
    var screen = tot.screen || 0;
    var beforeSleep = sleepIdx > 0 ? B[sleepIdx - 1] : null;
    if (beforeSleep && beforeSleep.cat === 'screen') cons.push({ id: 'screen-bed', text: '**' + beforeSleep.title + '** right before sleep makes it harder to fall asleep.', how: 'Swap the last 30 minutes for a screen-free wind-down.', fix: true });
    if (screen > 150) cons.push({ id: 'screen-much', text: '**' + M.fmtDur(screen) + '** of screen time.', how: 'Keep it to about 2 hours and use the rest as free time.', fix: true });
    else if (screen && !(beforeSleep && beforeSleep.cat === 'screen')) pros.push('Screen time is limited to **' + M.fmtDur(screen) + '** and not right before bed.');
    // free time
    var free = (tot.free || 0) + (tot.personal || 0);
    if (free < 20) cons.push({ id: 'free', text: '**No free time** — rest and fun aren’t wasted time; they keep you going.', how: 'Add 30 minutes of free time.', fix: true });
    else pros.push('**' + M.fmtDur(free) + '** of free or personal time to recharge.');
    // wind down
    if (beforeSleep && (beforeSleep.cat === 'routine' || beforeSleep.cat === 'personal')) pros.push('You **wind down** (“' + beforeSleep.title + '”) before sleeping.');
    // late dinner
    var lastMeal = null; B.forEach(function (b, i) { if (b.cat === 'meal' && i < sleepIdx) lastMeal = b; });
    if (lastMeal && sleepBlock && sleepBlock.s - lastMeal.e < 60 && /dinner|supper|khana/i.test(lastMeal.title)) cons.push({ id: 'late-dinner', text: '**' + lastMeal.title + '** ends just ' + M.fmtDur(Math.max(0, sleepBlock.s - lastMeal.e)) + ' before sleep.', how: 'Have it earlier, so there’s at least an hour (ideally two) before bed.', fix: true });
    // buffers
    var buffers = B.filter(function (b) { return (b.cat === 'routine' || b.cat === 'free') && b.dur <= 20; }).length;
    if (buffers >= 2) pros.push('**' + buffers + ' short breaks** make the plan realistic.');
    else if (B.filter(function (b) { return b.cat !== 'sleep' && b.dur >= 60; }).length >= 2) cons.push({ id: 'buffers', text: 'Few **breaks between blocks** — one delay will push everything late.', how: 'Add 10-minute short breaks after your longest blocks.', fix: true });
    return { pros: pros, cons: cons };
  }

  /* ------------------------------------------------------------------ */
  /* Fixes — every fix keeps the day at exactly 24 hours                  */
  /* ------------------------------------------------------------------ */
  var MINS = { screen: 0, free: 15, routine: 10, study: 30, personal: 10, exercise: 20, meal: 15 };
  /* take up to `need` minutes from blocks of the given categories (biggest first) */
  function take(bl, need, cats, avoidIdx) {
    var got = 0;
    cats.forEach(function (cat) {
      if (got >= need) return;
      var cand = bl.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) { return x.b.cat === cat && x.i !== avoidIdx && x.b.dur > (MINS[cat] || 0); }).sort(function (a, b) { return b.b.dur - a.b.dur; });
      cand.forEach(function (x) {
        if (got >= need) return;
        var can = Math.min(need - got, x.b.dur - (MINS[cat] || 0));
        can = Math.floor(can / 5) * 5;
        if (can <= 0) return;
        x.b.dur -= can; got += can;
      });
    });
    for (var i = bl.length - 1; i >= 0; i--) if (bl[i].dur <= 0) bl.splice(i, 1);
    return got;
  }
  function idxOf(bl, cat, last) { var r = -1; bl.forEach(function (b, i) { if (b.cat === cat && (last || r < 0)) r = i; }); return r; }
  function eveningIdx(bl, wake, fromClock) {
    var s = 0;
    for (var i = 0; i < bl.length; i++) { var c = (wake + s) % DAY; if (c >= fromClock && bl[i].cat !== 'school' && bl[i].cat !== 'sleep') return i; s += bl[i].dur; }
    return Math.max(0, idxOf(bl, 'sleep', true));
  }

  /* add the most important missing meal: dinner, then lunch, then a snack → "dinner (30 min)" or null */
  function addMeal(d) {
    var bl = d.blocks, miss = missingMeal(bl);
    var got = take(bl, miss === 'snack' ? 15 : 30, ['free', 'screen', 'routine', 'study']);
    if (got < 10) return null;
    var at;
    if (miss === 'dinner') {
      // about 2½ hours before sleep starts
      var s = 0, si = idxOf(bl, 'sleep', true);
      for (var i = 0; i < si; i++) s += bl[i].dur;
      at = si >= 0 ? (d.wake + s - 150 + DAY) % DAY : 20 * 60;
    } else at = miss === 'lunch' ? 13 * 60 : 16 * 60 + 30;
    var title = miss === 'dinner' ? 'Dinner' : miss === 'lunch' ? 'Lunch' : 'Snack';
    bl.splice(eveningIdx(bl, d.wake, at), 0, { title: title, cat: 'meal', dur: got, notes: miss === 'snack' ? 'Fruit, roasted chana, peanuts or curd.' : '' });
    return title.toLowerCase() + ' (' + M.fmtDur(got) + ')';
  }

  var FIX = {
    'no-sleep': function (d, age) {
      var need = C.sleepNeed(age).lo * 60, bl = d.blocks, got = 0;
      while (bl.length && got < need) {
        var last = bl[bl.length - 1];
        var cut = Math.min(last.dur, need - got);
        last.dur -= cut; got += cut;
        if (last.dur <= 0) bl.pop();
      }
      bl.push({ title: 'Sleep', cat: 'sleep', dur: got });
      return 'Added **' + M.fmtDur(got) + ' of sleep** at the end of the day.';
    },
    sleep: function (d, age) {
      var need = C.sleepNeed(age).lo * 60 - (totals(d.blocks).sleep || 0);
      var si = idxOf(d.blocks, 'sleep', true);
      var got = take(d.blocks, R5(need), ['screen', 'free', 'routine', 'personal', 'study'], si);
      si = idxOf(d.blocks, 'sleep', true);
      if (!got || si < 0) return null;
      d.blocks[si].dur += got;
      return 'Moved bedtime **' + M.fmtDur(got) + ' earlier** (less screen and free time) for more sleep.';
    },
    'sleep-long': function (d, age) {
      var hi = C.sleepNeed(age).hi * 60, si = idxOf(d.blocks, 'sleep', true);
      var extra = R5(d.blocks[si].dur - hi);
      if (extra <= 0) return null;
      d.blocks[si].dur -= extra;
      d.blocks.splice(si, 0, { title: 'Free time', cat: 'free', dur: extra });
      return 'Moved bedtime **' + M.fmtDur(extra) + ' later** and added that as free time.';
    },
    exercise: function (d) {
      var bl = d.blocks;
      var donor = bl.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) { return (x.b.cat === 'free' || x.b.cat === 'screen') && x.b.dur >= 45; }).sort(function (a, b) { return b.b.dur - a.b.dur; })[0];
      if (donor) { donor.b.dur -= 30; bl.splice(donor.i, 0, { title: 'Exercise', cat: 'exercise', dur: 30, notes: 'A walk, sport or a short workout.' }); return 'Added **30 min of exercise** (from “' + donor.b.title + '”).'; }
      var got = take(bl, 30, ['screen', 'free', 'routine', 'study']);
      if (got < 15) return null;
      bl.splice(eveningIdx(bl, d.wake, 16 * 60), 0, { title: 'Exercise', cat: 'exercise', dur: got });
      return 'Added **' + M.fmtDur(got) + ' of exercise** in the evening.';
    },
    breakfast: function (d) {
      var bl = d.blocks;
      var early = function () { return bl[0] && bl[0].dur <= 30 && bl[0].cat !== 'meal' && bl[0].cat !== 'sleep' ? 1 : 0; };
      var old = -1; bl.forEach(function (b, i) { if (old < 0 && b.cat === 'meal' && /breakfast|nashta/i.test(b.title)) old = i; });
      if (old >= 0) {
        var b = bl.splice(old, 1)[0];
        bl.splice(early(), 0, b);
        return 'Moved **' + b.title.toLowerCase() + '** to right after waking up.';
      }
      var got = take(bl, 20, ['routine', 'free', 'screen', 'personal', 'study']);
      if (got < 10) return null;
      bl.splice(early(), 0, { title: 'Breakfast', cat: 'meal', dur: got, notes: 'Include some protein: milk, curd, eggs, paneer or dal.' });
      return 'Added a **' + M.fmtDur(got) + ' breakfast** right after waking up.';
    },
    meals: function (d) {
      var added = [];
      for (var n = 0; n < 2 && d.blocks.filter(function (b) { return b.cat === 'meal'; }).length < 3; n++) {
        var r = addMeal(d);
        if (!r) break;
        added.push(r);
      }
      return added.length ? 'Added **' + added.join('** and **') + '**.' : null;
    },
    'study-split': function (d) {
      var n = 0;
      for (var i = 0; i < d.blocks.length; i++) {
        var b = d.blocks[i];
        if (b.cat === 'study' && b.dur > 100) {
          var parts = Math.ceil(b.dur / 90), work = b.dur - 10 * (parts - 1);
          var each = Math.floor(work / parts / 5) * 5, pieces = [];
          for (var k = 0; k < parts; k++) {
            if (k) pieces.push({ title: 'Short break', cat: 'free', dur: 10, notes: 'Stand up, stretch, drink water.' });
            pieces.push({ title: b.title + ' (part ' + (k + 1) + ')', cat: 'study', dur: k === parts - 1 ? work - each * (parts - 1) : each, notes: k ? '' : b.notes || '' });
          }
          d.blocks.splice.apply(d.blocks, [i, 1].concat(pieces));
          i += pieces.length - 1; n++;
        }
      }
      return n ? 'Split ' + n + ' long study ' + M.plural(n, 'block') + ' into parts with **10-minute breaks**.' : null;
    },
    'screen-bed': function (d) {
      var si = idxOf(d.blocks, 'sleep', true), b = d.blocks[si - 1];
      if (!b || b.cat !== 'screen') return null;
      if (b.dur <= 30) { b.title = 'Wind down (no screens)'; b.cat = 'routine'; b.notes = 'Phone away, lights dim. Read or stretch.'; }
      else { b.dur -= 30; d.blocks.splice(si, 0, { title: 'Wind down (no screens)', cat: 'routine', dur: 30, notes: 'Phone away, lights dim. Read or stretch.' }); }
      return 'Made the last 30 minutes before sleep **screen-free**.';
    },
    'screen-much': function (d) {
      var over = (totals(d.blocks).screen || 0) - 120;
      if (over <= 0) return null;
      var moved = 0;
      d.blocks.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) { return x.b.cat === 'screen'; }).sort(function (a, b) { return b.b.dur - a.b.dur; }).forEach(function (x) {
        if (moved >= over) return;
        var cut = Math.min(over - moved, x.b.dur);
        x.b.dur -= cut; moved += cut;
        x.b._free = (x.b._free || 0) + cut;
      });
      for (var i = d.blocks.length - 1; i >= 0; i--) {
        var b = d.blocks[i];
        if (b._free) { d.blocks.splice(i + 1, 0, { title: 'Free time', cat: 'free', dur: b._free }); delete b._free; }
        if (b.dur <= 0) d.blocks.splice(i, 1);
      }
      return 'Cut screen time to **2 hours** and turned the rest into free time.';
    },
    free: function (d) {
      var bl = d.blocks;
      var got = take(bl, 30, ['screen', 'study', 'routine', 'school']);
      if (got < 15) return null;
      bl.splice(eveningIdx(bl, d.wake, 17 * 60), 0, { title: 'Free time', cat: 'free', dur: got });
      return 'Added **' + M.fmtDur(got) + ' of free time**.';
    },
    'late-dinner': function (d) {
      var bl = d.blocks, si = idxOf(bl, 'sleep', true), di = -1;
      bl.forEach(function (b, i) { if (b.cat === 'meal' && i < si && /dinner|supper|khana/i.test(b.title)) di = i; });
      if (di < 0) return null;
      var dinner = bl.splice(di, 1)[0];
      si = idxOf(bl, 'sleep', true);
      // walk back from bedtime (never past school/work) until there's about 2 hours between dinner and sleep
      var acc = 0, at = si;
      while (at > 0 && acc < 120) {
        var prev = bl[at - 1];
        if (prev.cat === 'school' || prev.cat === 'sleep') break;
        acc += prev.dur; at--;
      }
      if (acc < 60) { bl.splice(di, 0, dinner); return null; }
      bl.splice(at, 0, dinner);
      return 'Moved **' + dinner.title.toLowerCase() + ' earlier** — now ' + M.fmtDur(acc) + ' before bed.';
    },
    buffers: function (d) {
      var bl = d.blocks;
      var longest = bl.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) {
        var n = bl[x.i + 1];
        return x.b.cat !== 'sleep' && x.b.dur >= 60 && n && n.cat !== 'sleep' && !((n.cat === 'routine' || n.cat === 'free') && n.dur <= 20);
      }).sort(function (a, b) { return b.b.dur - a.b.dur; }).slice(0, 2).sort(function (a, b) { return b.i - a.i; });
      longest.forEach(function (x) { x.b.dur -= 10; bl.splice(x.i + 1, 0, { title: 'Short break', cat: 'routine', dur: 10, notes: 'Catch up, drink water, get ready for the next thing.' }); });
      return longest.length ? 'Added **10-minute short breaks** after your ' + longest.length + ' longest blocks.' : null;
    }
  };
  var ORDER = ['no-sleep', 'sleep', 'sleep-long', 'study-split', 'screen-much', 'screen-bed', 'breakfast', 'meals', 'late-dinner', 'exercise', 'free', 'buffers'];
  /* ids: list of problem ids to fix, or 'all' */
  function fix(day, ids, age) {
    var d = { wake: day.wake, blocks: day.blocks.map(function (b) { return Object.assign({}, b); }) };
    var changes = [];
    // two passes: a later fix can undo part of an earlier one (e.g. exercise taken from free time)
    for (var pass = 0; pass < 2; pass++) {
      ORDER.forEach(function (id) {
        if ((ids !== 'all' && ids.indexOf(id) < 0) || !FIX[id]) return;
        // only if it's still a problem: an earlier fix may already have solved it (less screen time → more free time),
        // and with 'all', problems that only show up after another fix (a first meal added → "only 2 meals") are fixed too
        if (!review(d, age).cons.some(function (c) { return c.id === id && c.fix; })) return;
        var r = FIX[id](d, age);
        if (r && changes.indexOf(r) < 0) changes.push(r);
      });
    }
    // safety: always exactly 24 hours
    var sum = d.blocks.reduce(function (a, b) { return a + b.dur; }, 0);
    if (sum !== DAY && d.blocks.length) d.blocks[d.blocks.length - 1].dur += DAY - sum;
    return { day: d, changes: changes };
  }

  /* ------------------------------------------------------------------ */
  function toRoutineBlocks(day) {
    var s = 0;
    return day.blocks.map(function (b) {
      var st = (day.wake + s) % DAY; s += b.dur;
      return { id: M.uid(), start: M.fromMin(st), end: M.fromMin((day.wake + s) % DAY), title: b.title, cat: b.cat, notes: b.notes || '', anchor: null };
    });
  }
  /* shape a day like resolveBlocks output, for the day strip */
  function resolved(day) {
    var s = 0;
    return day.blocks.map(function (b) {
      var st = (day.wake + s) % DAY; s += b.dur;
      return { b: { id: 'x' + s, title: b.title, cat: b.cat }, start: st, end: (day.wake + s) % DAY, dur: b.dur };
    });
  }

  M.tt = {
    DAY: DAY, guessCat: guessCat, tidyTitle: tidyTitle, usual: usual, isLong: isLong,
    clockCandidates: clockCandidates, offsetFor: offsetFor, parseDur: parseDur, splitActivity: splitActivity,
    suggest: suggest, review: review, fix: fix, toRoutineBlocks: toRoutineBlocks, resolved: resolved
  };
})();
