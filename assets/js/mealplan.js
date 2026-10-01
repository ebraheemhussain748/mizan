/* Mizan — meal plan generator, food totals and grocery list */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var SHARES = {
    3: [['b', 'Breakfast', 0.30], ['l', 'Lunch', 0.40], ['d', 'Dinner', 0.30]],
    4: [['b', 'Breakfast', 0.25], ['l', 'Lunch', 0.35], ['s', 'Snack', 0.12], ['d', 'Dinner', 0.28]],
    5: [['b', 'Breakfast', 0.22], ['s1', 'Morning snack', 0.10], ['l', 'Lunch', 0.30], ['s2', 'Evening snack', 0.10], ['d', 'Dinner', 0.28]]
  };
  M.MEAL_SLOTS = SHARES;
  M.MEAL_LABEL = { b: 'Breakfast', l: 'Lunch', d: 'Dinner', s: 'Snack', s1: 'Morning snack', s2: 'Evening snack' };

  function tplAllowed(t, s) {
    if (s.diet === 'vegan' && t.dietRank > 0) return false;
    if (s.diet === 'veg' && (t.hasEgg || t.hasMeat)) return false;
    if (s.diet === 'egg' && t.hasMeat) return false;
    if (s.cuisine === 'in' && t.cuisine === 'intl') return false;
    if (s.cuisine === 'intl' && t.cuisine === 'in') return false;
    for (var i = 0; i < (s.allergies || []).length; i++) if (t.allergens.indexOf(s.allergies[i]) >= 0) return false;
    if (!s.supplements && t.items.some(function (it) { return it[0] === 'whey'; })) return false;
    return true;
  }
  M.mealTplAllowed = tplAllowed;

  function foodAllowed(f, s) {
    if (!M.dietAllows(s.diet, f.diet)) return false;
    for (var i = 0; i < (s.allergies || []).length; i++) if (f.allergens.indexOf(s.allergies[i]) >= 0) return false;
    if (f.group === 'supp' && !s.supplements) return false;
    return true;
  }
  M.foodAllowed = foodAllowed;

  function roundStep(v, step) { return Math.max(step, Math.round(v / step) * step); }

  M.totals = function (items) {
    var t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
    items.forEach(function (it) {
      var f = M.food(it.id || it.food);
      if (!f) return;
      var q = it.q;
      t.kcal += f.kcal * q; t.p += f.p * q; t.c += f.c * q; t.f += f.f * q; t.fib += (f.fib || 0) * q;
    });
    return t;
  };

  function scaleMeal(t, targetK, targetP) {
    var items = t.items.map(function (it) {
      var f = M.FOODS[it[0]];
      return { id: it[0], q: it[1], role: it[2], step: f.step, base: it[1] };
    });
    var sumRole = function (role) {
      return items.filter(function (i) { return i.role === role; }).reduce(function (a, i) { return a + M.FOODS[i.id].kcal * i.q; }, 0);
    };
    var tot = M.totals(items);
    // 1) scale carbs/base
    var carbK = sumRole('c');
    if (carbK > 0) {
      var f1 = (targetK - (tot.kcal - carbK)) / carbK;
      f1 = M.clamp(f1, 0.4, 3);
      items.forEach(function (i) { if (i.role === 'c') i.q = roundStep(i.base * f1, i.step); });
      tot = M.totals(items);
    }
    // 2) then protein items if still far off
    var diff = targetK - tot.kcal;
    var protK = sumRole('p');
    if (Math.abs(diff) > targetK * 0.12 && protK > 0) {
      var f2 = M.clamp(1 + diff / protK, 0.5, 2.5);
      items.forEach(function (i) { if (i.role === 'p') i.q = roundStep(i.q * f2, i.step); });
      tot = M.totals(items);
    }
    // 3) protein nudge: add protein steps, trim carbs to stay on budget
    var guard = 0;
    while (tot.p < targetP * 0.85 && guard++ < 6) {
      var pi = items.filter(function (i) { return i.role === 'p' && i.q < i.base * 2.5; });
      if (!pi.length) break;
      pi[0].q = roundStep(pi[0].q + pi[0].step, pi[0].step);
      tot = M.totals(items);
      if (tot.kcal > targetK * 1.08) {
        var ci = items.filter(function (i) { return i.role === 'c' && i.q > i.step; });
        if (ci.length) { ci[0].q = roundStep(ci[0].q - ci[0].step, ci[0].step); tot = M.totals(items); }
      }
    }
    return { tpl: t.id, name: t.name, items: items.map(function (i) { return { id: i.id, q: +i.q.toFixed(2) }; }), t: tot };
  }

  var BOOSTERS = [
    ['curd', 1], ['paneer', 1], ['roasted-chana', 1], ['sprouts', 1], ['egg', 2], ['milk', 1],
    ['soya-chunks', 1], ['tofu', 1], ['greek-yogurt', 1], ['whey', 1], ['peanuts', 0.5]
  ];

  M.generatePlan = function (s) {
    var rand = M.rng(s.seed || 1);
    var slots = SHARES[s.meals] || SHARES[4];
    var pool = { b: [], m: [], s: [] };
    M.MEAL_TEMPLATES.forEach(function (t) { if (tplAllowed(t, s)) pool[t.slot].push(t); });
    ['b', 'm', 's'].forEach(function (k) { pool[k] = M.shuffle(pool[k], rand); });
    var ptr = { b: 0, m: 0, s: 0 };
    var pick = function (kind, avoid) {
      var list = pool[kind];
      if (!list.length) return null;
      for (var tries = 0; tries < list.length; tries++) {
        var t = list[ptr[kind] % list.length];
        ptr[kind]++;
        if (!avoid || avoid.indexOf(t.id) < 0) return t;
      }
      return list[0];
    };
    var days = [];
    for (var d = 0; d < 7; d++) {
      var used = [];
      var meals = slots.map(function (sl) {
        var kind = sl[0] === 'b' ? 'b' : (sl[0] === 'l' || sl[0] === 'd') ? 'm' : 's';
        var t = pick(kind, used);
        if (!t) return { slot: sl[0], label: sl[1], empty: true, items: [], t: M.totals([]) };
        used.push(t.id);
        var m = scaleMeal(t, s.kcal * sl[2], s.protein * sl[2]);
        m.slot = sl[0]; m.label = sl[1];
        return m;
      });
      var day = { meals: meals };
      boostDay(day, s);
      days.push(day);
    }
    return { created: M.today(), settings: s, days: days };
  };

  function dayTotals(day) {
    var all = [];
    day.meals.forEach(function (m) { all = all.concat(m.items); });
    return M.totals(all);
  }
  M.dayTotals = dayTotals;

  function boostDay(day, s) {
    var tot = dayTotals(day);
    var guard = 0;
    while (tot.p < s.protein * 0.9 && guard++ < 3) {
      var gap = s.protein - tot.p;
      var booster = null;
      for (var i = 0; i < BOOSTERS.length; i++) {
        var f = M.FOODS[BOOSTERS[i][0]];
        if (f && foodAllowed(f, s) && (s.cuisine !== 'in' || f.cuisine !== 'intl') && (s.cuisine !== 'intl' || f.cuisine !== 'in')) {
          var already = day.meals.some(function (m) { return m.items.some(function (it) { return it.id === f.id; }); });
          if (!already) { booster = BOOSTERS[i]; break; }
        }
      }
      if (!booster) break;
      var bf = M.FOODS[booster[0]];
      var q = M.clamp(roundStep(gap / bf.p, bf.step), bf.step, booster[1] * 2);
      // put boosters in a snack slot if there is one, else in lunch
      var target = day.meals.filter(function (m) { return m.slot.charAt(0) === 's'; })[0] || day.meals.filter(function (m) { return m.slot === 'l'; })[0] || day.meals[0];
      target.items.push({ id: bf.id, q: q, boost: true });
      target.t = M.totals(target.items);
      // trim carbs in the biggest meal to stay near budget
      tot = dayTotals(day);
      if (tot.kcal > s.kcal * 1.06) trimCarbs(day, tot.kcal - s.kcal);
      tot = dayTotals(day);
    }
    if (tot.kcal > s.kcal * 1.05) trimCarbs(day, tot.kcal - s.kcal);
    tot = dayTotals(day);
    if (tot.kcal > s.kcal * 1.06) trimAny(day, s);
  }

  /* Last resort: shave the least protein-dense portions until within ~5% of budget,
     without letting protein fall under 90% of its target */
  function trimAny(day, s) {
    var guard = 0;
    var tot = dayTotals(day);
    while (tot.kcal > s.kcal * 1.05 && guard++ < 12) {
      var best = null;
      day.meals.forEach(function (m) {
        m.items.forEach(function (it) {
          var f = M.FOODS[it.id];
          if (!f || f.group === 'veg' || it.q - f.step < f.step - 1e-9) return;
          var dens = f.p / Math.max(1, f.kcal);
          if (tot.p - f.p * f.step < s.protein * 0.9) return;
          if (!best || dens < best.dens) best = { it: it, f: f, m: m, dens: dens };
        });
      });
      if (!best) break;
      best.it.q = +(best.it.q - best.f.step).toFixed(2);
      best.m.t = M.totals(best.m.items);
      tot = dayTotals(day);
    }
  }

  function trimCarbs(day, over) {
    var guard = 0;
    while (over > 40 && guard++ < 8) {
      var best = null;
      day.meals.forEach(function (m) {
        m.items.forEach(function (it) {
          var f = M.FOODS[it.id];
          if (!f || it.boost) return;
          if (['grain', 'dish'].indexOf(f.group) < 0) return;
          if (it.q - f.step < f.step) return;
          if (!best || f.kcal * f.step > best.f.kcal * best.f.step) best = { it: it, f: f, m: m };
        });
      });
      if (!best) break;
      best.it.q = +(best.it.q - best.f.step).toFixed(2);
      best.m.t = M.totals(best.m.items);
      over -= best.f.kcal * best.f.step;
    }
  }

  /* Swap one meal for another template that fits the same slot */
  M.swapMeal = function (plan, dayIdx, mealIdx) {
    var s = plan.settings;
    var m = plan.days[dayIdx].meals[mealIdx];
    var kind = m.slot === 'b' ? 'b' : (m.slot === 'l' || m.slot === 'd') ? 'm' : 's';
    var inDay = plan.days[dayIdx].meals.map(function (x) { return x.tpl; });
    var options = M.MEAL_TEMPLATES.filter(function (t) { return t.slot === kind && tplAllowed(t, s) && inDay.indexOf(t.id) < 0; });
    if (!options.length) return false;
    var t = options[Math.floor(Math.random() * options.length)];
    var slots = SHARES[s.meals] || SHARES[4];
    var share = (slots.filter(function (x) { return x[0] === m.slot; })[0] || [0, 0, 0.25])[2];
    var nm = scaleMeal(t, s.kcal * share, s.protein * share);
    nm.slot = m.slot; nm.label = m.label;
    plan.days[dayIdx].meals[mealIdx] = nm;
    return true;
  };

  function frac(x) {
    x = Math.round(x * 100) / 100;
    var whole = Math.floor(x), rest = Math.round((x - whole) * 100) / 100;
    var sym = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[rest];
    if (rest === 0) return String(whole);
    if (sym) return (whole ? whole : '') + sym;
    return String(Math.round(x * 10) / 10);
  }
  M.frac = frac;
  /* Say quantities the way people speak: "2 medium", "1½ katori (225 g)", "60 g" */
  M.fmtQty = function (f, q) {
    var p = f.portion || '';
    var scaleParen = function (s, factor) {
      return s.replace(/\((\d+(?:\.\d+)?) (g|ml)\)/, function (m0, n, u) { return '(' + Math.round(+n * factor) + ' ' + u + ')'; });
    };
    var m1 = p.match(/^(\d+(?:\.\d+)?) (g|ml)$/);
    if (m1) return Math.round(+m1[1] * q) + ' ' + m1[2];
    var m2 = p.match(/^(\d+(?:\.\d+)?|½|¼|¾) (.+)$/);
    if (m2) {
      var n = m2[1] === '½' ? 0.5 : m2[1] === '¼' ? 0.25 : m2[1] === '¾' ? 0.75 : +m2[1];
      var rest = scaleParen(m2[2], q);
      if (n * q > 1) rest = rest.replace(/^(piece|glass|cup|slice|scoop|sandwich|wrap|omelette|bowl|plate|serving|can)\b/, function (w) { return /(ch|ss)$/.test(w) ? w + 'es' : w + 's'; });
      return frac(n * q) + ' ' + rest;
    }
    return q === 1 ? p : frac(q) + ' × ' + p;
  };

  /* Grocery list for the whole week */
  var COUNTABLE = { 'Eggs': 50, 'Bananas': 118, 'Apples': 182, 'Oranges': 130, 'Guavas': 100, 'Tender coconut': 1 };
  M.groceryList = function (plan) {
    var map = {};
    plan.days.forEach(function (d) {
      d.meals.forEach(function (m) {
        m.items.forEach(function (it) {
          var f = M.food(it.id);
          if (!f || !f.raw) return;
          var key = f.raw[0];
          if (!map[key]) map[key] = { name: key, g: 0, group: f.group };
          map[key].g += f.raw[1] * it.q;
        });
      });
    });
    var groups = {};
    Object.keys(map).forEach(function (k) {
      var e = map[k];
      var gname = aisle(e.name);
      (groups[gname] = groups[gname] || []).push(e);
    });
    Object.keys(groups).forEach(function (g) { groups[g].sort(function (a, b) { return a.name < b.name ? -1 : 1; }); });
    return groups;
  };
  var AISLES = [
    ['Grains & flours', /atta|flour|rice|millet|poha|rava|daliya|oats|bread|pasta|quinoa|muesli|batter|popcorn/i],
    ['Dals & legumes', /dal|rajma|chana|moong|soya|tofu|hummus|beans/i],
    ['Milk, dairy & eggs', /milk|curd|yogurt|paneer|cheese|whey|eggs|ghee|butter/i],
    ['Meat & fish', /chicken|fish|mutton|tuna|salmon/i],
    ['Fruit', /banana|apple|orange|papaya|guava|mango|pomegranate|grape|watermelon|dates|berries|coconut/i],
    ['Vegetables', /veg|cauliflower|bhindi|lauki|spinach|brinjal|salad|broccoli|potato/i],
    ['Nuts & seeds', /almond|walnut|cashew|peanut|makhana|flax|chia|pumpkin/i]
  ];
  function aisle(name) {
    for (var i = 0; i < AISLES.length; i++) if (AISLES[i][1].test(name)) return AISLES[i][0];
    return 'Other';
  }
  M.fmtGrocery = function (e) {
    if (COUNTABLE[e.name]) {
      var n = Math.ceil(e.g / COUNTABLE[e.name]);
      return n + (e.name === 'Tender coconut' ? ' ' + M.plural(n, 'coconut') : '');
    }
    if (/Milk|Soy milk|Buttermilk|juice|Soft drink/i.test(e.name)) {
      return e.g >= 1000 ? M.fmt(e.g / 1000, 1) + ' L' : M.round(e.g, 50) + ' ml';
    }
    return e.g >= 1000 ? M.fmt(e.g / 1000, 1) + ' kg' : Math.max(10, M.round(e.g, 10)) + ' g';
  };
})();
