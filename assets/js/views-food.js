/* Mizan — Food: meal plan generator, food log, food database */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var dayIdx = 0;
  var logDate = null;
  var editingSettings = false;

  var SUBS = [['plan', 'Meal plan'], ['log', 'Food log'], ['foods', 'Foods']];
  function subnav(active) {
    return '<nav class="seg-wrap" aria-label="Food sections"><div class="seg">' + SUBS.map(function (s) {
      return '<a href="#/food/' + s[0] + '"' + (s[0] === active ? ' aria-current="page"' : '') + '>' + s[1] + '</a>';
    }).join('') + '</div></nav>';
  }

  function targets() {
    var p = M.state.profile;
    var kg = M.latestWeight();
    var plan = kg && p.heightCm && M.ageFrom(p) ? M.calc.goalPlan(p, kg) : null;
    if (M.state.mealPlan) return { kcal: M.state.mealPlan.settings.kcal, protein: M.state.mealPlan.settings.protein, fat: plan ? plan.macros.fat : null, carbs: plan ? plan.macros.carbs : null, fiber: plan ? plan.macros.fiber : 25 };
    if (plan) return { kcal: plan.kcal, protein: plan.macros.protein, fat: plan.macros.fat, carbs: plan.macros.carbs, fiber: plan.macros.fiber };
    return null;
  }
  M.foodTargets = targets;

  function macroMeters(t, target, light) {
    if (light) return '';
    var row = function (name, v, goal, unit) {
      var pct = goal ? M.clamp(v / goal * 100, 0, 100) : 0;
      return '<div class="meter-row"><span class="name"><span class="t">' + name + '</span></span><div class="meter" role="img" aria-label="' + name + ' ' + Math.round(v) + ' of ' + (goal ? Math.round(goal) : '—') + ' ' + unit + '"><span style="width:' + pct.toFixed(1) + '%"></span></div><span class="val">' + M.fmt(v) + (goal ? ' / ' + M.fmt(goal) : '') + ' ' + unit + '</span></div>';
    };
    return row('Energy', t.kcal, target && target.kcal, 'kcal') + row('Protein', t.p, target && target.protein, 'g') + row('Carbs', t.c, target && target.carbs, 'g') + row('Fat', t.f, target && target.fat, 'g') + row('Fibre', t.fib, target && target.fiber, 'g');
  }

  /* ---------------- Plan ---------------- */
  function settingsForm(el) {
    var p = M.state.profile;
    var tg = targets();
    var pre = M.foodPrefill || {};
    var cur = M.state.mealPlan ? M.state.mealPlan.settings : {};
    var kcal = pre.kcal || cur.kcal || (tg && tg.kcal) || '';
    var protein = pre.protein || cur.protein || (tg && tg.protein) || '';
    M.foodPrefill = null;
    var age = M.ageFrom(p);
    el.innerHTML += '<div class="split"><div class="panel"><h3 style="margin-bottom:12px">Build a 7-day meal plan</h3><form id="mp-form" class="stack" novalidate>' +
      '<div class="form-grid">' + U.numField('kcal', 'Calories per day', kcal, 'kcal', { step: 10, min: 1000, max: 5000, hint: tg ? 'From your Goal: ' + M.fmt(tg.kcal) + ' kcal' : '<a href="#/body/goal">Set a goal</a> to fill this in for you.' }) +
      U.numField('protein', 'Protein per day', protein, 'g', { step: 5, min: 20, max: 300 }) + '</div>' +
      '<div class="field"><span class="label">Diet</span>' + U.radios('diet', M.DIETS.map(function (d) { return [d.id, d.label, d.desc]; }), cur.diet || p.diet, true) + '</div>' +
      '<div class="field"><span class="label">Cuisine</span>' + U.radios('cuisine', [['in', 'Indian'], ['mixed', 'Indian + international'], ['intl', 'International']], cur.cuisine || p.cuisine) + '</div>' +
      '<div class="field"><span class="label">Meals a day</span>' + U.radios('meals', [['3', '3 meals'], ['4', '3 meals + snack'], ['5', '3 meals + 2 snacks']], String(cur.meals || p.mealsPerDay)) + '</div>' +
      '<div class="field"><span class="label">Avoid</span>' + U.checks('allergies', M.ALLERGENS.map(function (a) { return [a.id, a.label]; }), cur.allergies || p.allergies) + '</div>' +
      '<label class="switch"><span class="sw-text"><strong>Allow protein powder</strong><span>Only if you already use it — food first is fine.</span></span><input type="checkbox" name="supplements"' + ((cur.supplements || p.supplements) ? ' checked' : '') + '></label>' +
      '<p class="err hidden" role="alert"></p>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary">' + M.icon('spark') + 'Build my plan</button>' + (M.state.mealPlan ? '<button type="button" class="btn btn-ghost" data-action="cancel-settings">Cancel</button>' : '') + '</div></form></div>' +
      '<div class="stack"><div class="panel tint"><h3 style="margin-bottom:8px">How plans are built</h3><ul class="checks">' +
      '<li class="info">' + M.icon('spark') + '<span>Meals are real dishes — roti, dal, sabzi, poha, idli — sized to hit your calories and protein.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Plates follow ICMR-NIN 2024: vegetables and fruit about half, grains under ~45% of energy, pulses or other protein every meal.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Vegetarian protein comes from pairing grains with dals, plus curd, paneer, chana and soya.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Values are approximate — home recipes vary. Adjust portions to your hunger and your weight trend.</span></li></ul>' +
      U.sourceLine([['ICMR-NIN Dietary Guidelines 2024', 'https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf'], ['WHO healthy diet', 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet']]) + '</div>' +
      (age !== null && age < 18 ? U.note('info', '<p>For teens, the plan is built around your full energy needs — growing bodies shouldn’t be on a calorie-cut diet. Eat enough, and eat regularly.</p>') : '') +
      '</div></div>';
    var f = M.$('#mp-form', el);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = M.formData(f);
      var err = f.querySelector('.err');
      var k = M.num(d.kcal), pr = M.num(d.protein);
      if (!k || k < 1000 || k > 5000) { err.textContent = 'Enter calories between 1,000 and 5,000.'; err.classList.remove('hidden'); return; }
      if (!pr || pr < 20 || pr > 300) { err.textContent = 'Enter protein between 20 and 300 g.'; err.classList.remove('hidden'); return; }
      var s = { kcal: k, protein: pr, diet: d.diet || 'veg', cuisine: d.cuisine || 'in', meals: +(d.meals || 4), allergies: d.allergies || [], supplements: !!d.supplements, seed: Math.floor(Math.random() * 1e9) };
      p.diet = s.diet; p.cuisine = s.cuisine; p.mealsPerDay = s.meals; p.allergies = s.allergies; p.supplements = s.supplements;
      var plan = M.generatePlan(s);
      var empty = plan.days[0].meals.filter(function (m) { return m.empty; }).length;
      if (empty) { err.textContent = 'Not enough dishes match these choices. Try allowing more cuisines or fewer exclusions.'; err.classList.remove('hidden'); return; }
      M.state.mealPlan = plan;
      editingSettings = false; dayIdx = 0;
      M.save(); M.haptic('success'); M.refresh(); M.toast('Your 7-day plan is ready');
    });
  }

  function renderPlan(el) {
    var mp = M.state.mealPlan;
    if (!mp || editingSettings || M.foodPrefill) { settingsForm(el); return; }
    var light = M.state.settings.numbersLight;
    var s = mp.settings;
    var day = mp.days[dayIdx];
    var tot = M.dayTotals(day);
    var tg = { kcal: s.kcal, protein: s.protein, fat: s.kcal * 0.28 / 9, carbs: Math.max(0, (s.kcal - s.protein * 4 - s.kcal * 0.28) / 4), fiber: Math.max(25, s.kcal / 1000 * 14) };
    var startWd = M.weekday(M.today());
    var pills = '<div class="day-pills" role="tablist" aria-label="Plan days">' + mp.days.map(function (d, i) {
      return '<button type="button" role="tab" aria-selected="' + (i === dayIdx) + '" data-action="day" data-i="' + i + '">' + M.DAY_SHORT[(startWd + i) % 7] + '</button>';
    }).join('') + '</div>';
    var meals = day.meals.map(function (m, mi) {
      return '<section class="meal"><div class="meal-head"><h3>' + M.esc(m.label) + '</h3>' + (light ? '' : '<span class="mk">' + M.fmt(m.t.kcal) + ' kcal · ' + M.fmt(m.t.p) + ' g protein</span>') + '</div>' +
        '<div class="meal-name">' + M.esc(m.name || '') + '</div>' +
        '<ul class="food-lines">' + m.items.map(function (it) {
          var f = M.food(it.id);
          return '<li><span>' + M.esc(f.name) + (it.boost ? ' <span class="badge">protein top-up</span>' : '') + '</span><span class="fq">' + M.esc(M.fmtQty(f, it.q)) + (light ? '' : ' · ' + M.fmt(f.kcal * it.q) + ' kcal') + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="btn-row no-print" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="swap" data-m="' + mi + '">' + M.icon('swap') + 'Swap</button><button type="button" class="btn btn-sm btn-ghost" data-action="log-meal" data-m="' + mi + '">' + M.icon('plus') + 'Add to today’s log</button></div></section>';
    }).join('');
    el.innerHTML +=
      '<div class="row between wrap seg-wrap">' + pills + '<div class="btn-row no-print">' +
      '<button type="button" class="btn btn-sm" data-action="grocery">' + M.icon('cart') + 'Grocery list</button>' +
      '<button type="button" class="btn btn-sm" data-action="print">' + M.icon('print') + 'Print</button>' +
      '<button type="button" class="btn btn-sm" data-action="reshuffle">' + M.icon('refresh') + 'New plan</button>' +
      '<button type="button" class="btn btn-sm" data-action="settings">' + M.icon('settings') + 'Settings</button></div></div>' +
      '<div class="split"><div class="panel">' + meals + '</div>' +
      '<div class="stack"><div class="panel"><div class="panel-title"><h3>' + (light ? 'This day' : 'Day totals') + '</h3>' + (light ? '' : '<span class="badge">' + M.fmt(tot.kcal) + ' / ' + M.fmt(s.kcal) + ' kcal</span>') + '</div>' +
      (light ? '<p class="soft" style="margin:0">Numbers are hidden. Each meal has a protein food, vegetables or fruit, and a grain — eat until comfortably full.</p>' : macroMeters(tot, tg, false)) + '</div>' +
      '<div class="panel tint"><h3 style="margin-bottom:8px">Your plate, simply</h3><ul class="checks">' +
      '<li class="info">' + M.icon('spark') + '<span>Half the plate: vegetables, greens and fruit.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>A quarter: roti, rice or millets — whole grains most days.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>A quarter: dal, beans, paneer, curd, eggs, chicken or fish.</span></li>' +
      '<li class="info">' + M.icon('spark') + '<span>Limit added sugar (about 25 g a day), salt (under 5 g) and ultra-processed snacks.</span></li></ul></div>' +
      '<p class="hint muted">' + M.esc(M.DIETS.filter(function (d) { return d.id === s.diet; })[0].label) + ' · ' + ({ in: 'Indian', mixed: 'Indian + international', intl: 'International' }[s.cuisine]) + ' · ' + s.meals + ' eating times' + (s.allergies.length ? ' · avoids ' + s.allergies.join(', ') : '') + '. Built ' + M.fmtDate(mp.created, 'short') + '.</p>' +
      '</div></div>';

    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a) return;
      var act = a.getAttribute('data-action');
      if (act === 'day') { dayIdx = +a.getAttribute('data-i'); M.refresh(); }
      else if (act === 'swap') {
        if (M.swapMeal(mp, dayIdx, +a.getAttribute('data-m'))) { M.save(); M.haptic('select'); M.refresh(); M.toast('Meal swapped'); }
        else M.toast('No other dishes fit this slot with your settings.');
      } else if (act === 'reshuffle') {
        var s2 = Object.assign({}, mp.settings, { seed: Math.floor(Math.random() * 1e9) });
        M.state.mealPlan = M.generatePlan(s2); M.save(); M.haptic('success'); M.refresh(); M.toast('Fresh plan made');
      } else if (act === 'settings') { editingSettings = true; M.refresh(); }
      else if (act === 'cancel-settings') { editingSettings = false; M.refresh(); }
      else if (act === 'print') window.print();
      else if (act === 'grocery') grocerySheet(mp);
      else if (act === 'log-meal') {
        var m = day.meals[+a.getAttribute('data-m')];
        var slot = m.slot.charAt(0) === 's' ? 's' : m.slot;
        var k = M.today();
        var list = M.state.foodLog[k] || (M.state.foodLog[k] = []);
        m.items.forEach(function (it) { list.push({ id: M.uid(), food: it.id, q: it.q, meal: slot }); });
        M.save(); M.toast(m.label + ' added to today’s log');
      }
    });
  }

  function grocerySheet(mp) {
    var g = M.groceryList(mp);
    var html = '<p class="soft">Everything for the 7-day plan, as raw ingredients. Tick items off as you shop. Spices, salt, onion, tomato and garlic aren’t listed.</p><div class="grocery">' +
      Object.keys(g).sort().map(function (grp) {
        return '<div class="grocery-group"><h4>' + M.esc(grp) + '</h4>' + g[grp].map(function (e, i) {
          return '<label><input type="checkbox"><span>' + M.esc(e.name) + ' — <strong>' + M.esc(M.fmtGrocery(e)) + '</strong></span></label>';
        }).join('') + '</div>';
      }).join('') + '</div>';
    M.sheet({ title: 'Grocery list', body: html, wide: true, noAutofocus: true, foot: '<button type="button" class="btn" data-copy>' + M.icon('copy') + 'Copy as text</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-close>Done</button>',
      onOpen: function (dlg) {
        dlg.querySelector('[data-copy]').addEventListener('click', function () {
          var txt = 'Mizan grocery list\n' + Object.keys(g).sort().map(function (grp) { return '\n' + grp + '\n' + g[grp].map(function (e) { return '- ' + e.name + ': ' + M.fmtGrocery(e); }).join('\n'); }).join('\n');
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { M.toast('Copied'); }, function () { M.toast('Couldn’t copy — select and copy manually.'); });
          else M.toast('Copy isn’t available in this browser.');
        });
      }
    });
  }

  /* ---------------- Log ---------------- */
  function addFoodSheet(k, presetMeal, onDone) {
    var mealOpts = [['b', 'Breakfast'], ['l', 'Lunch'], ['s', 'Snack'], ['d', 'Dinner']];
    var body = '<div class="stack"><div class="field"><label for="fs-q">Search foods</label><input class="input" id="fs-q" type="search" placeholder="roti, dal, paneer, banana…" autocomplete="off" autofocus></div>' +
      '<div class="form-grid">' + U.selectField('meal', 'Meal', mealOpts, presetMeal || guessMeal()) + U.numField('qty', 'Portions', 1, '×', { step: 0.25, min: 0.25, max: 20 }) + '</div>' +
      '<div class="search-results" id="fs-res" role="listbox" aria-label="Matching foods"></div></div>';
    M.sheet({
      title: 'Add food', body: body,
      foot: '<a class="btn btn-ghost" href="#/food/foods" data-close>' + M.icon('plus') + 'Create a custom food</a><span class="spacer"></span><button type="button" class="btn" data-close>Done</button>',
      onOpen: function (dlg) {
        var q = dlg.querySelector('#fs-q'), res = dlg.querySelector('#fs-res');
        var draw = function () {
          var term = q.value.trim().toLowerCase();
          var list = M.allFoods().filter(function (f) { return !term || f.name.toLowerCase().indexOf(term) >= 0 || (M.FOOD_GROUPS[f.group] || '').toLowerCase().indexOf(term) >= 0; });
          list.sort(function (a, b) {
            var as = a.name.toLowerCase().indexOf(term) === 0 ? 0 : 1, bs = b.name.toLowerCase().indexOf(term) === 0 ? 0 : 1;
            return as - bs || a.name.localeCompare(b.name);
          });
          res.innerHTML = list.slice(0, 60).map(function (f) {
            return '<button type="button" role="option" data-food="' + M.esc(f.id) + '"><span><span class="sr-name">' + M.esc(f.name) + '</span><br><span class="sr-meta">' + M.esc(f.portion) + '</span></span><span class="sr-meta nowrap">' + M.fmt(f.kcal) + ' kcal · ' + M.fmt(f.p, 1) + ' g P</span></button>';
          }).join('') || '<p class="muted" style="padding:12px;margin:0">No match. You can add your own food from the Foods tab.</p>';
        };
        q.addEventListener('input', draw);
        res.addEventListener('click', function (e) {
          var b = e.target.closest('[data-food]');
          if (!b) return;
          var d = M.formData(dlg);
          var qty = M.num(d.qty) || 1;
          var list = M.state.foodLog[k] || (M.state.foodLog[k] = []);
          list.push({ id: M.uid(), food: b.getAttribute('data-food'), q: qty, meal: d.meal || 's' });
          M.save();
          M.toast('Added ' + M.food(b.getAttribute('data-food')).name);
          if (onDone) onDone();
        });
        draw();
      }
    });
  }
  function guessMeal() {
    var h = new Date().getHours();
    return h < 11 ? 'b' : h < 15 ? 'l' : h < 18 ? 's' : 'd';
  }

  function renderLog(el) {
    var k = logDate || M.today();
    var items = M.state.foodLog[k] || [];
    var light = M.state.settings.numbersLight;
    var tg = targets();
    var tot = M.totals(items.map(function (x) { return { id: x.food, q: x.q }; }));
    var groups = [['b', 'Breakfast'], ['l', 'Lunch'], ['s', 'Snacks'], ['d', 'Dinner']];
    var sections = groups.map(function (g) {
      var its = items.filter(function (x) { return (x.meal || 's') === g[0]; });
      var t = M.totals(its.map(function (x) { return { id: x.food, q: x.q }; }));
      return '<section class="meal"><div class="meal-head"><h3>' + g[1] + '</h3>' + (light || !its.length ? '' : '<span class="mk">' + M.fmt(t.kcal) + ' kcal · ' + M.fmt(t.p) + ' g protein</span>') + '</div>' +
        (its.length ? '<ul class="food-lines">' + its.map(function (x) {
          var f = M.food(x.food);
          if (!f) return '';
          return '<li><span>' + M.esc(f.name) + ' <span class="muted">' + M.esc(M.fmtQty(f, x.q)) + '</span></span><span class="row" style="gap:4px"><span class="fq">' + (light ? '' : M.fmt(f.kcal * x.q) + ' kcal') + '</span><button type="button" class="icon-btn sm" data-action="del" data-id="' + M.esc(x.id) + '" aria-label="Remove ' + M.esc(f.name) + '">' + M.icon('x') + '</button></span></li>';
        }).join('') + '</ul>' : '<p class="muted" style="margin:0 0 6px;font-size:var(--fs-sm)">Nothing logged.</p>') +
        '<button type="button" class="btn btn-sm btn-ghost" data-action="add" data-meal="' + g[0] + '">' + M.icon('plus') + 'Add to ' + g[1].toLowerCase() + '</button></section>';
    }).join('');
    var low = !light && tg && k < M.today() && items.length && tot.kcal < tg.kcal * 0.6;
    el.innerHTML +=
      '<div class="row between wrap seg-wrap"><div class="row"><button type="button" class="icon-btn" data-action="prev" aria-label="Previous day">' + M.icon('left') + '</button><strong>' + (k === M.today() ? 'Today' : M.fmtDate(k, 'weekday')) + '</strong>' +
      '<button type="button" class="icon-btn" data-action="next" aria-label="Next day"' + (k >= M.today() ? ' disabled' : '') + '>' + M.icon('right') + '</button></div>' +
      '<button type="button" class="btn btn-primary" data-action="add">' + M.icon('plus') + 'Add food</button></div>' +
      '<div class="split"><div class="panel">' + sections + '</div><div class="stack">' +
      '<div class="panel"><div class="panel-title"><h3>' + (light ? 'Balance check' : 'Totals') + '</h3></div>' +
      (light ? balance(items) : macroMeters(tot, tg, false) + (tg ? '' : '<p class="hint muted" style="margin-top:10px"><a href="#/body/goal">Set a goal</a> to see targets.</p>')) + '</div>' +
      (low ? U.note('warn', '<p><strong>That was a low-energy day.</strong> Eating far below your needs tends to backfire — more hunger, less energy, lost muscle. If this is on purpose, consider a gentler pace. If eating feels hard or stressful, talk to someone you trust.</p>') : '') +
      '<div class="panel tint"><p class="soft" style="margin:0;font-size:var(--fs-sm)">Logging is optional. Many people log for a couple of weeks to learn portions, then stop. If tracking starts to feel stressful, turn on <a href="#/settings">numbers-light mode</a> or take a break.</p></div>' +
      '</div></div>';
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a) return;
      var act = a.getAttribute('data-action');
      if (act === 'add') addFoodSheet(k, a.getAttribute('data-meal'), M.refresh);
      else if (act === 'del') {
        M.state.foodLog[k] = items.filter(function (x) { return x.id !== a.getAttribute('data-id'); });
        if (!M.state.foodLog[k].length) delete M.state.foodLog[k];
        M.save(); M.refresh();
      } else if (act === 'prev') { logDate = M.addDays(k, -1); M.refresh(); }
      else if (act === 'next') { var n = M.addDays(k, 1); logDate = n >= M.today() ? null : n; M.refresh(); }
    });
  }

  function balance(items) {
    var groups = {};
    items.forEach(function (x) { var f = M.food(x.food); if (f) groups[f.group] = true; });
    var has = function (arr) { return arr.some(function (g) { return groups[g]; }); };
    var rows = [
      [has(['pulse', 'dairy', 'egg', 'meat', 'supp']), 'A protein food (dal, curd, paneer, eggs, chicken…)'],
      [has(['veg']), 'Vegetables or greens'],
      [has(['fruit']), 'Fruit'],
      [has(['grain', 'dish']), 'Grains, roti or rice']
    ];
    return '<ul class="checks">' + rows.map(function (r) { return '<li class="' + (r[0] ? 'ok' : 'warn') + '">' + M.icon(r[0] ? 'good' : 'info') + '<span>' + r[1] + '</span></li>'; }).join('') + '</ul>';
  }

  /* ---------------- Foods ---------------- */
  var foodQ = '', foodG = '';
  function renderFoods(el) {
    var list = M.allFoods().filter(function (f) {
      return (!foodQ || f.name.toLowerCase().indexOf(foodQ.toLowerCase()) >= 0) && (!foodG || f.group === foodG);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    el.innerHTML +=
      '<div class="row wrap seg-wrap" style="gap:10px"><div class="field grow" style="min-width:200px"><label class="sr-only" for="fd-q">Search foods</label><input class="input" id="fd-q" type="search" placeholder="Search ' + M.allFoods().length + ' foods" value="' + M.esc(foodQ) + '"></div>' +
      '<div class="field" style="min-width:180px"><label class="sr-only" for="fd-g">Food group</label><select class="select" id="fd-g"><option value="">All groups</option>' + Object.keys(M.FOOD_GROUPS).map(function (g) { return '<option value="' + g + '"' + (g === foodG ? ' selected' : '') + '>' + M.esc(M.FOOD_GROUPS[g]) + '</option>'; }).join('') + '</select></div>' +
      '<button type="button" class="btn" data-action="custom">' + M.icon('plus') + 'Custom food</button></div>' +
      '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table class="data"><thead><tr><th>Food</th><th>Portion</th><th class="n">kcal</th><th class="n">Protein</th><th class="n">Carbs</th><th class="n">Fat</th><th class="n">Fibre</th></tr></thead><tbody>' +
      list.map(function (f) {
        return '<tr><td style="white-space:normal;min-width:180px"><strong>' + M.esc(f.name) + '</strong>' + (f.custom ? ' <span class="badge">yours</span>' : '') + '<br><span class="muted" style="font-size:var(--fs-xs)">' + M.esc(M.FOOD_GROUPS[f.group] || '') + ' · ' + ({ vg: 'vegan', v: 'vegetarian', e: 'contains egg', n: 'non-veg' }[f.diet] || '') + (f.allergens && f.allergens.length ? ' · ' + M.esc(f.allergens.join(', ')) : '') + '</span></td>' +
          '<td style="white-space:normal">' + M.esc(f.portion) + '</td><td class="n">' + M.fmt(f.kcal) + '</td><td class="n">' + M.fmt(f.p, 1) + ' g</td><td class="n">' + M.fmt(f.c, 1) + ' g</td><td class="n">' + M.fmt(f.f, 1) + ' g</td><td class="n">' + M.fmt(f.fib || 0, 1) + ' g</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint muted" style="margin-top:12px">Approximate values per portion from USDA FoodData Central, Indian Food Composition Tables (IFCT 2017) summaries and product labels. Home recipes vary, especially with oil and ghee.</p>';
    var q = M.$('#fd-q', el);
    q.addEventListener('input', function () { foodQ = q.value; var pos = q.selectionStart; M.refresh(); var nq = M.$('#fd-q'); if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e2) { /* ignore */ } } });
    M.$('#fd-g', el).addEventListener('change', function (e) { foodG = e.target.value; M.refresh(); });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="custom"]')) customFoodSheet();
    });
  }

  function customFoodSheet() {
    var body = '<form class="stack" novalidate>' +
      '<div class="field"><label for="cf-name">Name</label><input class="input" id="cf-name" name="name" maxlength="60" autofocus placeholder="e.g. Mum’s aloo paratha"></div>' +
      '<div class="form-grid"><div class="field"><label for="cf-portion">Portion</label><input class="input" id="cf-portion" name="portion" maxlength="40" placeholder="1 piece"></div>' + U.numField('g', 'Weight', '', 'g') + '</div>' +
      '<div class="form-grid">' + U.numField('kcal', 'Calories', '', 'kcal') + U.numField('p', 'Protein', '', 'g') + U.numField('c', 'Carbs', '', 'g') + U.numField('f', 'Fat', '', 'g') + U.numField('fib', 'Fibre', '', 'g') +
      U.selectField('group', 'Group', Object.keys(M.FOOD_GROUPS).map(function (g) { return [g, M.FOOD_GROUPS[g]]; }), 'dish') + '</div>' +
      '<div class="field"><span class="label">Type</span>' + U.radios('diet', [['vg', 'Vegan'], ['v', 'Vegetarian'], ['e', 'Contains egg'], ['n', 'Non-veg']], 'v') + '</div>' +
      '<p class="hint muted">Tip: check the nutrition label on packets — values are usually per 100 g.</p><p class="err hidden" role="alert"></p></form>';
    M.sheet({
      title: 'Custom food', body: body,
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save food</button>',
      onOpen: function (dlg) {
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          var d = M.formData(dlg.querySelector('form'));
          var err = dlg.querySelector('.err');
          if (!d.name.trim() || M.num(d.kcal) === null) { err.textContent = 'Add at least a name and calories.'; err.classList.remove('hidden'); return; }
          M.state.customFoods.push({ id: 'c-' + M.uid(), custom: true, name: d.name.trim(), portion: d.portion.trim() || '1 portion', g: M.num(d.g) || 0, kcal: M.num(d.kcal), p: M.num(d.p) || 0, c: M.num(d.c) || 0, f: M.num(d.f) || 0, fib: M.num(d.fib) || 0, group: d.group || 'dish', diet: d.diet || 'v', allergens: [], cuisine: 'both', step: 0.5, raw: null });
          M.save(); dlg.close('ok'); M.refresh(); M.toast('Custom food saved');
        });
      }
    });
  }

  M.views.food = {
    head: function (parts) {
      var sub = parts[0] || 'plan';
      return { title: 'Food', sub: { plan: 'A week of real meals that fit your goal', log: 'What you ate — optional, judgment-free', foods: 'Nutrition for common Indian and international foods' }[sub] };
    },
    render: function (el, parts) {
      var sub = parts[0] || 'plan';
      el.innerHTML = subnav(sub);
      if (sub === 'log') renderLog(el);
      else if (sub === 'foods') renderFoods(el);
      else renderPlan(el);
    }
  };
})();
