/* Mizan — faith (optional) and sun-based times.
   Nothing here is on by default. People choose a faith (or none) in onboarding or Settings,
   and only then see the matching labels, suggestions and times. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var FAITHS = [
    { id: '', label: 'Prefer not to say' },
    { id: 'none', label: 'Not religious' },
    { id: 'spiritual', label: 'Spiritual, not religious' },
    { id: 'islam', label: 'Islam' },
    { id: 'hindu', label: 'Hinduism' },
    { id: 'sikh', label: 'Sikhism' },
    { id: 'christian', label: 'Christianity' },
    { id: 'buddhist', label: 'Buddhism' },
    { id: 'jain', label: 'Jainism' },
    { id: 'jewish', label: 'Judaism' }
  ];

  /* What the "faith" category is called for each choice */
  var CAT_LABEL = {
    '': 'Reflection', none: 'Reflection', spiritual: 'Meditation & reflection',
    islam: 'Prayer', hindu: 'Puja & prayer', sikh: 'Path & simran', christian: 'Prayer',
    buddhist: 'Meditation', jain: 'Samayik & prayer', jewish: 'Prayer'
  };

  /* The morning block used in starter routines */
  var MORNING = {
    '': ['Quiet start — plan your day', 'A glass of water, a stretch and a look at today’s plan.'],
    none: ['Quiet start — plan your day', 'A glass of water, a stretch and a look at today’s plan.'],
    spiritual: ['Morning meditation', 'A few minutes of slow breathing or journaling before the day starts.'],
    islam: ['Fajr prayer', 'Pray on time. Turn on sun & prayer times in Settings to see the exact Fajr time for your city.'],
    hindu: ['Morning puja', 'Light a diya, a short prayer and a few quiet minutes before the day starts.'],
    sikh: ['Nitnem — morning banis', 'Japji Sahib and the morning banis.'],
    christian: ['Morning prayer', 'A short prayer or a few verses before the day starts.'],
    buddhist: ['Morning meditation', 'Ten minutes of breathing meditation.'],
    jain: ['Navkar Mantra & morning prayer', 'Recite the Navkar Mantra and sit quietly for a few minutes.'],
    jewish: ['Shacharit — morning prayer', 'Morning prayers before the day starts.']
  };

  /* One habit idea per faith (shown alongside the general ideas) */
  var HABIT = {
    '': { name: 'Two minutes of quiet breathing', cue: 'Before I start studying', backup: 'If I forget, I do it before bed.' },
    none: { name: 'Two minutes of quiet breathing', cue: 'Before I start studying', backup: 'If I forget, I do it before bed.' },
    spiritual: { name: 'Write one line of gratitude', cue: 'After I get into bed', backup: 'If I’m too tired, I think of one thing instead.' },
    islam: { name: 'Pray on time', cue: 'As soon as the prayer time begins', backup: 'If I’m in class or travelling, I pray at the first free moment.' },
    hindu: { name: 'Light a diya and pray', cue: 'After my morning bath', backup: 'If I’m running late, I say a short prayer before leaving.' },
    sikh: { name: 'Morning Nitnem', cue: 'After I wake up and wash', backup: 'If I’m short on time, I recite Japji Sahib on the way.' },
    christian: { name: 'Read a few verses', cue: 'After breakfast', backup: 'If I miss the morning, I read before bed.' },
    buddhist: { name: 'Meditate for 10 minutes', cue: 'After I wake up', backup: 'If the morning is rushed, I meditate for 3 minutes before bed.' },
    jain: { name: 'Finish dinner before sunset', cue: 'When the sunset reminder shows', backup: 'If I’m out, I eat a simple early meal before leaving.' },
    jewish: { name: 'Morning prayer', cue: 'After I wake up and wash', backup: 'If I’m rushed, I say the short morning blessings.' }
  };

  M.FAITHS = FAITHS;
  M.faith = {
    id: function () { return (M.state && M.state.settings.faith) || ''; },
    label: function (id) { var f = FAITHS.filter(function (x) { return x.id === (id === undefined ? M.faith.id() : id); })[0]; return f ? f.label : 'Prefer not to say'; },
    catLabel: function () { return CAT_LABEL[M.faith.id()] || 'Reflection'; },
    catIcon: function () { var f = M.faith.id(); return f === 'islam' ? 'crescent' : (f === '' || f === 'none' || f === 'spiritual' || f === 'buddhist') ? 'lotus' : 'lamp'; },
    morning: function (id) { return MORNING[id === undefined ? M.faith.id() : id] || MORNING['']; },
    habitIdea: function () { var h = HABIT[M.faith.id()] || HABIT['']; return { name: h.name, cue: h.cue, backup: h.backup, cat: 'prayer' }; },
    isIslam: function () { return M.faith.id() === 'islam'; },

    /* Are times available (location set and turned on)? */
    active: function () {
      var pr = M.state.settings.prayer;
      return !!(pr.enabled && pr.lat !== null && pr.lng !== null && M.prayer);
    },

    /* Named times for a date, in order: [{id, label, at, note}] */
    times: function (dateKey) {
      if (!M.faith.active()) return [];
      var pr = M.state.settings.prayer;
      var cfg = { lat: pr.lat, lng: pr.lng, method: M.faith.isIslam() ? pr.method : 'MWL', asr: pr.asr };
      var t = M.prayer.times(dateKey, cfg);
      var f = M.faith.id();
      var list = [];
      var add = function (id, label, at, note) { if (at !== null && at !== undefined && isFinite(at)) list.push({ id: id, label: label, at: ((Math.round(at) % 1440) + 1440) % 1440, note: note || '' }); };
      var night = ((t.sunrise - t.sunset) % 1440 + 1440) % 1440; // minutes from sunset to next sunrise
      if (f === 'islam') {
        add('fajr', 'Fajr', t.fajr); add('sunrise', 'Sunrise', t.sunrise, 'Fajr ends'); add('dhuhr', 'Dhuhr', t.dhuhr);
        add('asr', 'Asr', t.asr); add('maghrib', 'Maghrib', t.maghrib); add('isha', 'Isha', t.isha);
      } else if (f === 'hindu') {
        add('brahma', 'Brahma muhurta', t.sunrise - 96, 'Until ' + M.fmtTime(t.sunrise - 48));
        add('sunrise', 'Sunrise', t.sunrise, 'Pratah sandhya');
        add('noon', 'Midday', t.dhuhr, 'Madhyahna sandhya');
        add('sunset', 'Sunset', t.sunset, 'Sayam sandhya');
      } else if (f === 'sikh') {
        add('amritvela', 'Amrit vela', t.sunrise - night / 4, 'Last pehar of the night');
        add('sunrise', 'Sunrise', t.sunrise);
        add('sunset', 'Sunset', t.sunset, 'Rehras Sahib');
      } else if (f === 'jain') {
        add('sunrise', 'Sunrise', t.sunrise);
        add('navkarsi', 'Navkarsi', t.sunrise + 48, '48 min after sunrise');
        add('sunset', 'Sunset', t.sunset, 'Chauvihar — finish eating');
      } else if (f === 'jewish') {
        add('sunrise', 'Sunrise', t.sunrise, 'Shacharit');
        if (M.weekday(dateKey) === 5) add('candles', 'Shabbat candles', t.sunset - 18, '18 min before sunset');
        add('sunset', 'Sunset', t.sunset, 'Mincha before');
        add('nightfall', 'Nightfall', t.nightfall, 'Maariv');
      } else {
        add('sunrise', 'Sunrise', t.sunrise);
        add('noon', 'Midday', t.dhuhr);
        add('sunset', 'Sunset', t.sunset);
      }
      list.sort(function (a, b) { return a.at - b.at; });
      list.sunrise = t.sunrise; list.sunset = t.sunset;
      return list;
    },

    /* id → minutes map, always including sunrise/sunset/noon when active */
    timeMap: function (dateKey) {
      var out = {};
      if (!M.faith.active()) return out;
      var pr = M.state.settings.prayer;
      var t = M.prayer.times(dateKey, { lat: pr.lat, lng: pr.lng, method: M.faith.isIslam() ? pr.method : 'MWL', asr: pr.asr });
      out.sunrise = t.sunrise; out.sunset = t.sunset; out.noon = t.dhuhr;
      M.faith.times(dateKey).forEach(function (x) { out[x.id] = x.at; });
      return out;
    },

    /* Anchors offered in the block editor */
    anchors: function () {
      var k = M.today();
      var seen = {};
      var list = [];
      M.faith.times(k).concat([{ id: 'sunrise', label: 'Sunrise' }, { id: 'sunset', label: 'Sunset' }]).forEach(function (x) {
        if (seen[x.id]) return; seen[x.id] = true; list.push({ id: x.id, label: x.label });
      });
      return list;
    },

    anchorLabel: function (id) {
      var names = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha', sunrise: 'sunrise', sunset: 'sunset', noon: 'midday', brahma: 'Brahma muhurta', amritvela: 'Amrit vela', navkarsi: 'Navkarsi', candles: 'Shabbat candles', nightfall: 'nightfall' };
      return names[id] || id;
    },

    /* Next upcoming time for Today */
    next: function () {
      var today = M.today();
      var now = M.nowMin();
      var list = M.faith.times(today);
      for (var i = 0; i < list.length; i++) if (list[i].at > now) return { item: list[i], inMin: list[i].at - now };
      var tm = M.faith.times(M.addDays(today, 1));
      if (!tm.length) return null;
      return { item: tm[0], inMin: tm[0].at + 1440 - now };
    },

    /* When someone changes faith, rename the starter morning block to match (only if it still has a starter title) */
    swapMorning: function (from, to) {
      if (from === to) return 0;
      var titles = {};
      Object.keys(MORNING).forEach(function (k) { titles[MORNING[k][0]] = k; });
      var n = 0;
      var m = MORNING[to] || MORNING[''];
      var cat = (to === '' || to === 'none') ? 'routine' : 'prayer';
      (M.state.routines || []).forEach(function (r) {
        (r.blocks || []).forEach(function (b) {
          if (titles[b.title] === undefined) return;
          var oldNote = (MORNING[titles[b.title]] || [])[1];
          b.title = m[0]; b.cat = cat;
          if (!b.notes || b.notes === oldNote || /Fajr time|prayer times in Settings/i.test(b.notes)) b.notes = b.notes ? m[1] : '';
          if (b.anchor && !M.faith.anchorOk(b.anchor.prayer, to)) b.anchor = null;
          n++;
        });
      });
      return n;
    },
    anchorOk: function (id, faith) {
      if (id === 'sunrise' || id === 'sunset' || id === 'noon') return true;
      var map = { islam: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], hindu: ['brahma'], sikh: ['amritvela'], jain: ['navkarsi'], jewish: ['candles', 'nightfall'] };
      return (map[faith] || []).indexOf(id) >= 0;
    },

    stripTitle: function () {
      var f = M.faith.id();
      return f === 'islam' ? 'Prayer times' : (f === '' || f === 'none') ? 'Sun times' : 'Your times';
    }
  };
})();
