/* Mizan — food database and meal templates.
   Values are approximate per portion, drawn from USDA FoodData Central, the Indian Food
   Composition Tables (IFCT 2017) as summarised by Indian nutrition references, and product
   labels (e.g. Amul, Nutrela). Home recipes vary — treat these as good estimates, not facts.
   diet: vg = vegan, v = vegetarian (dairy), e = contains egg, n = meat/fish */
(function () {
  'use strict';
  var M = (window.M = window.M || {});

  var GROUPS = {
    grain: 'Grains & breads', pulse: 'Dals & legumes', dairy: 'Milk & dairy', egg: 'Eggs',
    meat: 'Meat & fish', veg: 'Vegetables', fruit: 'Fruit', nut: 'Nuts & seeds', fat: 'Oils & fats',
    snack: 'Snacks', sweet: 'Sweets & sugar', drink: 'Drinks', dish: 'Mixed dishes', supp: 'Supplements'
  };

  /* [id, name, portion, grams, kcal, protein, carbs, fat, fibre, group, diet, allergens, cuisine, step, raw]
     raw = [shopping item, grams per portion] for the grocery list */
  var ROWS = [
    // Grains & breads
    ['roti', 'Roti / chapati (no ghee)', '1 medium', 40, 95, 3.1, 18, 1, 2.7, 'grain', 'vg', ['gluten'], 'in', 1, ['Whole-wheat atta', 30]],
    ['roti-ghee', 'Roti with ghee', '1 medium', 45, 140, 3.1, 18, 6, 2.7, 'grain', 'v', ['gluten', 'dairy'], 'in', 1, ['Whole-wheat atta', 30]],
    ['phulka-multigrain', 'Multigrain roti', '1 medium', 40, 105, 3.6, 19, 1.5, 3.4, 'grain', 'vg', ['gluten'], 'in', 1, ['Multigrain atta', 30]],
    ['bajra-roti', 'Bajra roti', '1 medium', 40, 100, 3, 19, 1.5, 3, 'grain', 'vg', [], 'in', 1, ['Bajra flour', 30]],
    ['jowar-roti', 'Jowar roti', '1 medium', 40, 100, 3, 21, 1, 2.5, 'grain', 'vg', [], 'in', 1, ['Jowar flour', 30]],
    ['ragi-roti', 'Ragi roti', '1 medium', 40, 95, 2.5, 19, 1, 3, 'grain', 'vg', [], 'in', 1, ['Ragi flour', 30]],
    ['paratha', 'Plain paratha', '1 medium', 70, 200, 5, 28, 8, 3, 'grain', 'v', ['gluten', 'dairy'], 'in', 1, ['Whole-wheat atta', 45]],
    ['aloo-paratha', 'Aloo paratha', '1 medium', 120, 290, 6, 40, 12, 4, 'dish', 'v', ['gluten', 'dairy'], 'in', 1, ['Whole-wheat atta', 50]],
    ['paneer-paratha', 'Paneer paratha', '1 medium', 120, 320, 12, 34, 15, 3.5, 'dish', 'v', ['gluten', 'dairy'], 'in', 1, ['Paneer', 35]],
    ['rice', 'Rice, white, cooked', '1 katori (150 g)', 150, 195, 4, 42, 0.4, 0.6, 'grain', 'vg', [], 'both', 0.5, ['Rice', 50]],
    ['rice-brown', 'Rice, brown, cooked', '1 katori (150 g)', 150, 175, 3.9, 36, 1.4, 2.7, 'grain', 'vg', [], 'both', 0.5, ['Brown rice', 50]],
    ['millet', 'Millet (foxtail/little), cooked', '1 katori (150 g)', 150, 170, 5, 32, 2, 3, 'grain', 'vg', [], 'in', 0.5, ['Millet', 50]],
    ['poha', 'Vegetable poha', '1 plate (180 g)', 180, 250, 5, 40, 8, 2, 'dish', 'vg', [], 'in', 0.5, ['Poha (flattened rice)', 60]],
    ['upma', 'Rava upma', '1 bowl (200 g)', 200, 250, 6, 38, 8, 3, 'dish', 'vg', ['gluten'], 'in', 0.5, ['Rava (semolina)', 50]],
    ['daliya', 'Vegetable daliya', '1 bowl (200 g)', 200, 180, 6, 32, 3, 5, 'dish', 'vg', ['gluten'], 'in', 0.5, ['Daliya (broken wheat)', 45]],
    ['idli', 'Idli', '1 piece (50 g)', 50, 65, 2, 13, 0.3, 0.8, 'dish', 'vg', [], 'in', 1, ['Idli batter', 50]],
    ['dosa', 'Plain dosa', '1 medium', 100, 170, 4, 32, 3.5, 1.5, 'dish', 'vg', [], 'in', 1, ['Dosa batter', 90]],
    ['masala-dosa', 'Masala dosa', '1 medium', 200, 310, 7, 48, 10, 4, 'dish', 'vg', [], 'in', 1, ['Dosa batter', 90]],
    ['uttapam', 'Vegetable uttapam', '1 medium', 130, 170, 5, 27, 4.5, 2, 'dish', 'vg', [], 'in', 1, ['Dosa batter', 100]],
    ['oats', 'Oats, rolled (dry)', '40 g', 40, 150, 5.3, 27, 2.6, 4, 'grain', 'vg', [], 'both', 0.25, ['Rolled oats', 40]],
    ['bread-ww', 'Whole-wheat bread', '1 slice', 32, 80, 4, 14, 1, 2, 'grain', 'vg', ['gluten'], 'both', 1, ['Whole-wheat bread', 32]],
    ['khichdi', 'Moong dal khichdi', '1 katori (200 g)', 200, 230, 9, 38, 4.5, 4, 'dish', 'vg', [], 'in', 0.5, ['Rice', 35]],
    ['pasta', 'Pasta, cooked', '1 cup (140 g)', 140, 220, 8, 43, 1.3, 2.5, 'grain', 'vg', ['gluten'], 'intl', 0.5, ['Pasta (dry)', 55]],
    ['quinoa', 'Quinoa, cooked', '1 cup (185 g)', 185, 222, 8, 39, 3.6, 5, 'grain', 'vg', [], 'intl', 0.5, ['Quinoa', 60]],
    ['potato', 'Potato, boiled', '1 medium (150 g)', 150, 130, 3, 30, 0.2, 2.8, 'veg', 'vg', [], 'both', 0.5, ['Potatoes', 150]],
    ['sweet-potato', 'Sweet potato, boiled', '150 g', 150, 115, 2, 27, 0.2, 4, 'veg', 'vg', [], 'both', 0.5, ['Sweet potato', 150]],
    ['muesli', 'Muesli, no added sugar', '40 g', 40, 150, 4, 26, 3, 3.5, 'grain', 'vg', ['gluten', 'nuts'], 'both', 0.5, ['Muesli', 40]],

    // Dals & legumes
    ['dal-toor', 'Toor dal (tadka)', '1 katori (150 g)', 150, 160, 9, 20, 3, 5, 'pulse', 'vg', [], 'in', 0.5, ['Toor dal', 40]],
    ['dal-moong', 'Moong dal', '1 katori (150 g)', 150, 145, 9, 18, 3, 4, 'pulse', 'vg', [], 'in', 0.5, ['Moong dal', 40]],
    ['dal-masoor', 'Masoor dal', '1 katori (150 g)', 150, 150, 10, 19, 3, 5, 'pulse', 'vg', [], 'in', 0.5, ['Masoor dal', 40]],
    ['dal-chana', 'Chana dal', '1 katori (150 g)', 150, 180, 11, 22, 4, 6, 'pulse', 'vg', [], 'in', 0.5, ['Chana dal', 45]],
    ['dal-makhani', 'Dal makhani', '1 katori (150 g)', 150, 280, 11, 22, 14, 7, 'pulse', 'v', ['dairy'], 'in', 0.5, ['Whole urad dal', 40]],
    ['rajma', 'Rajma curry', '1 katori (150 g)', 150, 200, 11, 28, 4, 8, 'pulse', 'vg', [], 'in', 0.5, ['Rajma (kidney beans)', 50]],
    ['chole', 'Chole / chana masala', '1 katori (150 g)', 150, 220, 11, 30, 5, 8, 'pulse', 'vg', [], 'in', 0.5, ['Kabuli chana', 50]],
    ['sambar', 'Sambar', '1 katori (150 g)', 150, 100, 5, 16, 2, 4, 'pulse', 'vg', [], 'in', 0.5, ['Toor dal', 20]],
    ['sprouts', 'Moong sprouts chaat', '1 bowl (150 g)', 150, 150, 10, 24, 1.5, 6, 'pulse', 'vg', [], 'in', 0.5, ['Whole moong (for sprouting)', 55]],
    ['chickpeas', 'Chickpeas, boiled', '1 katori (150 g)', 150, 245, 13.4, 41, 3.9, 11, 'pulse', 'vg', [], 'both', 0.5, ['Kabuli chana', 60]],
    ['roasted-chana', 'Roasted chana', '30 g', 30, 110, 6.6, 17, 1.5, 5, 'pulse', 'vg', [], 'in', 0.5, ['Roasted chana', 30]],
    ['soya-chunks', 'Soya chunks (dry weight)', '30 g', 30, 106, 16, 10, 0.3, 4, 'pulse', 'vg', ['soy'], 'in', 0.5, ['Soya chunks', 30]],
    ['soya-curry', 'Soya chunk curry', '1 katori', 180, 180, 16, 14, 7, 5, 'dish', 'vg', ['soy'], 'in', 0.5, ['Soya chunks', 30]],
    ['tofu', 'Tofu, firm', '100 g', 100, 144, 17.3, 2.8, 8.7, 2.3, 'pulse', 'vg', ['soy'], 'both', 0.5, ['Tofu', 100]],
    ['tofu-bhurji', 'Tofu bhurji', '1 serving (150 g)', 150, 230, 20, 7, 14, 3, 'dish', 'vg', ['soy'], 'in', 0.5, ['Tofu', 120]],
    ['hummus', 'Hummus', '2 tbsp (30 g)', 30, 50, 2.4, 4.3, 2.9, 1.8, 'pulse', 'vg', [], 'intl', 1, ['Hummus', 30]],
    ['besan-chilla', 'Besan chilla', '1 medium', 70, 120, 7, 11, 5, 2.5, 'dish', 'vg', [], 'in', 1, ['Besan (gram flour)', 35]],
    ['moong-chilla', 'Moong dal chilla', '1 medium', 70, 90, 7, 9, 2, 2, 'dish', 'vg', [], 'in', 1, ['Moong dal', 30]],
    ['dhokla', 'Khaman dhokla', '2 pieces (80 g)', 80, 130, 5, 20, 3, 2, 'snack', 'vg', [], 'in', 1, ['Besan (gram flour)', 30]],

    // Dairy
    ['milk', 'Milk, toned', '1 glass (200 ml)', 200, 116, 6, 9.6, 6, 0, 'dairy', 'v', ['dairy'], 'both', 0.5, ['Milk (toned)', 200]],
    ['milk-dt', 'Milk, double-toned', '1 glass (200 ml)', 200, 90, 6.2, 9.6, 3, 0, 'dairy', 'v', ['dairy'], 'both', 0.5, ['Milk (double-toned)', 200]],
    ['milk-fc', 'Milk, full cream', '1 glass (200 ml)', 200, 172, 6.4, 10, 12, 0, 'dairy', 'v', ['dairy'], 'both', 0.5, ['Milk (full cream)', 200]],
    ['curd', 'Curd / dahi', '1 katori (150 g)', 150, 92, 5.3, 7, 5, 0, 'dairy', 'v', ['dairy'], 'in', 0.5, ['Curd', 150]],
    ['greek-yogurt', 'Greek yogurt, plain', '150 g', 150, 89, 15, 5.4, 0.6, 0, 'dairy', 'v', ['dairy'], 'intl', 0.5, ['Greek yogurt', 150]],
    ['paneer', 'Paneer', '50 g', 50, 129, 9.5, 0.9, 7.5, 0, 'dairy', 'v', ['dairy'], 'in', 0.5, ['Paneer', 50]],
    ['paneer-bhurji', 'Paneer bhurji', '1 serving (120 g)', 120, 300, 18, 8, 22, 1.5, 'dish', 'v', ['dairy'], 'in', 0.5, ['Paneer', 90]],
    ['palak-paneer', 'Palak paneer', '1 katori (150 g)', 150, 280, 13, 9, 21, 3, 'dish', 'v', ['dairy'], 'in', 0.5, ['Paneer', 60]],
    ['raita', 'Vegetable raita', '1 katori (150 g)', 150, 100, 4.5, 8, 5, 1, 'dairy', 'v', ['dairy'], 'in', 0.5, ['Curd', 120]],
    ['buttermilk', 'Buttermilk (chaas)', '1 glass (200 ml)', 200, 45, 2.3, 3.4, 2.2, 0, 'drink', 'v', ['dairy'], 'in', 0.5, ['Curd', 70]],
    ['lassi', 'Sweet lassi', '1 glass (250 ml)', 250, 190, 6, 28, 6, 0, 'drink', 'v', ['dairy'], 'in', 0.5, ['Curd', 150]],
    ['cheese', 'Cheese slice', '1 slice (20 g)', 20, 62, 3.8, 1, 4.8, 0, 'dairy', 'v', ['dairy'], 'intl', 1, ['Cheese slices', 20]],
    ['soy-milk', 'Soy milk, unsweetened', '1 glass (200 ml)', 200, 70, 6, 3, 3.8, 1, 'drink', 'vg', ['soy'], 'both', 0.5, ['Soy milk', 200]],
    ['whey', 'Whey protein', '1 scoop (30 g)', 30, 120, 24, 3, 1.5, 0, 'supp', 'v', ['dairy'], 'both', 0.5, ['Whey protein', 30]],

    // Eggs
    ['egg', 'Egg, boiled', '1 large', 50, 78, 6.3, 0.6, 5.3, 0, 'egg', 'e', ['egg'], 'both', 1, ['Eggs', 50]],
    ['egg-white', 'Egg white', '1 large', 33, 17, 3.6, 0.2, 0, 0, 'egg', 'e', ['egg'], 'both', 1, ['Eggs', 33]],
    ['omelette', 'Vegetable omelette (2 eggs)', '1 omelette', 130, 200, 12.5, 3, 15.5, 1, 'egg', 'e', ['egg'], 'both', 0.5, ['Eggs', 100]],
    ['egg-bhurji', 'Egg bhurji (2 eggs)', '1 serving', 140, 220, 13, 4, 16, 1, 'egg', 'e', ['egg'], 'in', 0.5, ['Eggs', 100]],
    ['egg-curry', 'Egg curry (2 eggs)', '1 katori', 200, 280, 14, 10, 21, 2, 'dish', 'e', ['egg'], 'in', 0.5, ['Eggs', 100]],

    // Meat & fish
    ['chicken', 'Chicken breast, cooked', '100 g', 100, 165, 31, 0, 3.6, 0, 'meat', 'n', [], 'both', 0.25, ['Chicken breast', 130]],
    ['chicken-curry', 'Chicken curry', '1 katori (≈100 g chicken)', 200, 250, 22, 6, 15, 1.5, 'dish', 'n', [], 'in', 0.5, ['Chicken (curry cut)', 150]],
    ['tandoori-chicken', 'Tandoori chicken', '100 g', 100, 175, 26, 3, 7, 0, 'meat', 'n', ['dairy'], 'in', 0.5, ['Chicken (curry cut)', 150]],
    ['chicken-biryani', 'Chicken biryani', '1 plate (250 g)', 250, 480, 22, 55, 18, 2, 'dish', 'n', ['dairy'], 'in', 0.5, ['Chicken (curry cut)', 100]],
    ['fish', 'Fish, grilled or steamed', '100 g', 100, 130, 22, 0, 4.5, 0, 'meat', 'n', ['fish'], 'both', 0.5, ['Fish', 130]],
    ['fish-curry', 'Fish curry', '1 katori (≈100 g fish)', 200, 200, 20, 5, 11, 1.5, 'dish', 'n', ['fish'], 'in', 0.5, ['Fish', 130]],
    ['mutton-curry', 'Mutton curry', '1 katori (≈100 g meat)', 200, 280, 22, 5, 19, 1.5, 'dish', 'n', [], 'in', 0.5, ['Mutton', 150]],
    ['tuna', 'Tuna, canned in water', '100 g', 100, 116, 26, 0, 0.8, 0, 'meat', 'n', ['fish'], 'intl', 0.5, ['Canned tuna', 100]],
    ['salmon', 'Salmon, cooked', '100 g', 100, 206, 22, 0, 12, 0, 'meat', 'n', ['fish'], 'intl', 0.5, ['Salmon', 120]],

    // Vegetables
    ['sabzi', 'Mixed vegetable sabzi', '1 katori (150 g)', 150, 130, 4, 14, 7, 5, 'veg', 'vg', [], 'in', 0.5, ['Mixed vegetables', 170]],
    ['aloo-gobi', 'Aloo gobi', '1 katori (150 g)', 150, 160, 4, 18, 8, 4, 'veg', 'vg', [], 'in', 0.5, ['Cauliflower & potato', 170]],
    ['bhindi', 'Bhindi sabzi', '1 katori (150 g)', 150, 120, 3, 12, 7, 5, 'veg', 'vg', [], 'in', 0.5, ['Bhindi (okra)', 170]],
    ['lauki', 'Lauki sabzi', '1 katori (150 g)', 150, 80, 2, 10, 4, 3, 'veg', 'vg', [], 'in', 0.5, ['Lauki (bottle gourd)', 180]],
    ['palak', 'Palak / saag sabzi', '1 katori (150 g)', 150, 110, 5, 9, 7, 5, 'veg', 'vg', [], 'in', 0.5, ['Spinach', 250]],
    ['baingan', 'Baingan bharta', '1 katori (150 g)', 150, 150, 3, 12, 10, 5, 'veg', 'vg', [], 'in', 0.5, ['Brinjal', 200]],
    ['salad', 'Salad (cucumber, tomato, onion, carrot)', '1 bowl (150 g)', 150, 35, 1.5, 7, 0.3, 2.5, 'veg', 'vg', [], 'both', 0.5, ['Salad vegetables', 150]],
    ['veg-soup', 'Vegetable soup', '1 bowl (250 ml)', 250, 80, 3, 12, 2, 3, 'veg', 'vg', [], 'both', 0.5, ['Soup vegetables', 150]],
    ['steamed-veg', 'Steamed vegetables', '1 cup (150 g)', 150, 55, 3.5, 10, 0.6, 4.5, 'veg', 'vg', [], 'both', 0.5, ['Broccoli / beans / carrots', 150]],

    // Fruit
    ['banana', 'Banana', '1 medium', 118, 105, 1.3, 27, 0.4, 3.1, 'fruit', 'vg', [], 'both', 1, ['Bananas', 118]],
    ['apple', 'Apple', '1 medium', 182, 95, 0.5, 25, 0.3, 4.4, 'fruit', 'vg', [], 'both', 1, ['Apples', 182]],
    ['orange', 'Orange', '1 medium', 130, 62, 1.2, 15.4, 0.2, 3.1, 'fruit', 'vg', [], 'both', 1, ['Oranges', 130]],
    ['papaya', 'Papaya', '1 cup (145 g)', 145, 62, 0.7, 16, 0.4, 2.5, 'fruit', 'vg', [], 'both', 0.5, ['Papaya', 145]],
    ['guava', 'Guava', '1 medium', 100, 68, 2.6, 14, 1, 5.4, 'fruit', 'vg', [], 'in', 1, ['Guavas', 100]],
    ['mango', 'Mango', '1 cup (165 g)', 165, 99, 1.4, 25, 0.6, 2.6, 'fruit', 'vg', [], 'both', 0.5, ['Mangoes', 165]],
    ['pomegranate', 'Pomegranate seeds', '½ cup (87 g)', 87, 72, 1.5, 16, 1, 3.5, 'fruit', 'vg', [], 'both', 0.5, ['Pomegranate', 150]],
    ['grapes', 'Grapes', '1 cup (150 g)', 150, 104, 1.1, 27, 0.2, 1.4, 'fruit', 'vg', [], 'both', 0.5, ['Grapes', 150]],
    ['watermelon', 'Watermelon', '2 cups (300 g)', 300, 90, 1.8, 23, 0.5, 1.2, 'fruit', 'vg', [], 'both', 0.5, ['Watermelon', 300]],
    ['dates', 'Dates', '2 small (16 g)', 16, 45, 0.4, 12, 0.1, 1.3, 'fruit', 'vg', [], 'both', 1, ['Dates', 16]],
    ['berries', 'Berries, mixed', '1 cup (150 g)', 150, 80, 1, 19, 0.5, 3.6, 'fruit', 'vg', [], 'intl', 0.5, ['Berries', 150]],

    // Nuts & seeds
    ['almonds', 'Almonds', '10 pieces (12 g)', 12, 70, 2.5, 2.6, 6, 1.5, 'nut', 'vg', ['nuts'], 'both', 1, ['Almonds', 12]],
    ['walnuts', 'Walnuts', '15 g', 15, 98, 2.3, 2, 9.8, 1, 'nut', 'vg', ['nuts'], 'both', 1, ['Walnuts', 15]],
    ['cashews', 'Cashews', '10 pieces (15 g)', 15, 83, 2.7, 4.5, 6.6, 0.5, 'nut', 'vg', ['nuts'], 'both', 1, ['Cashews', 15]],
    ['peanuts', 'Peanuts, roasted', '30 g', 30, 176, 7.1, 6.5, 14.9, 2.4, 'nut', 'vg', ['peanut'], 'both', 0.5, ['Peanuts', 30]],
    ['peanut-butter', 'Peanut butter', '1 tbsp (16 g)', 16, 94, 4, 3.2, 8, 1, 'nut', 'vg', ['peanut'], 'both', 1, ['Peanut butter', 16]],
    ['makhana', 'Makhana, dry-roasted', '30 g', 30, 105, 2.9, 23, 0.2, 2, 'snack', 'vg', [], 'in', 0.5, ['Makhana (fox nuts)', 30]],
    ['flax', 'Flaxseed, ground', '1 tbsp (7 g)', 7, 37, 1.3, 2, 2.9, 1.9, 'nut', 'vg', [], 'both', 1, ['Flaxseed', 7]],
    ['chia', 'Chia seeds', '1 tbsp (12 g)', 12, 58, 2, 5, 3.7, 4.1, 'nut', 'vg', [], 'both', 1, ['Chia seeds', 12]],
    ['pumpkin-seeds', 'Pumpkin seeds', '15 g', 15, 85, 4.5, 1.6, 7, 1, 'nut', 'vg', [], 'both', 1, ['Pumpkin seeds', 15]],

    // Fats
    ['oil', 'Cooking oil', '1 tsp (5 ml)', 5, 40, 0, 0, 4.5, 0, 'fat', 'vg', [], 'both', 1, ['Cooking oil', 5]],
    ['ghee', 'Ghee', '1 tsp (5 g)', 5, 45, 0, 0, 5, 0, 'fat', 'v', ['dairy'], 'in', 1, ['Ghee', 5]],
    ['butter', 'Butter', '1 tsp (5 g)', 5, 36, 0, 0, 4, 0, 'fat', 'v', ['dairy'], 'both', 1, ['Butter', 5]],

    // Snacks & dishes
    ['veg-sandwich', 'Vegetable sandwich (2 slices)', '1 sandwich', 150, 220, 8, 36, 5, 5, 'dish', 'vg', ['gluten'], 'both', 0.5, ['Whole-wheat bread', 64]],
    ['paneer-sandwich', 'Paneer sandwich (2 slices)', '1 sandwich', 170, 330, 16, 32, 15, 5, 'dish', 'v', ['gluten', 'dairy'], 'in', 0.5, ['Paneer', 50]],
    ['chicken-wrap', 'Grilled chicken wrap', '1 wrap', 220, 380, 30, 38, 12, 4, 'dish', 'n', ['gluten'], 'intl', 0.5, ['Chicken breast', 100]],
    ['pasta-veg', 'Pasta with tomato sauce & vegetables', '1 plate (300 g)', 300, 380, 12, 65, 8, 7, 'dish', 'vg', ['gluten'], 'intl', 0.5, ['Pasta (dry)', 80]],
    ['bean-bowl', 'Rice & bean bowl with salsa', '1 bowl (350 g)', 350, 420, 15, 72, 7, 12, 'dish', 'vg', [], 'intl', 0.5, ['Beans (dry or canned)', 60]],
    ['oats-porridge', 'Oats porridge with milk', '1 bowl', 250, 200, 9, 30, 5, 3.5, 'dish', 'v', ['dairy'], 'both', 0.5, ['Rolled oats', 30]],
    ['samosa', 'Samosa', '1 medium', 80, 220, 4, 25, 12, 2, 'snack', 'vg', ['gluten'], 'in', 1, ['Samosa', 80]],
    ['vada-pav', 'Vada pav', '1 piece', 130, 290, 6, 38, 13, 3, 'snack', 'vg', ['gluten'], 'in', 1, ['Vada pav', 130]],
    ['pav-bhaji', 'Pav bhaji', '1 plate', 350, 420, 9, 50, 20, 7, 'dish', 'v', ['gluten', 'dairy'], 'in', 0.5, ['Pav bhaji', 350]],
    ['namkeen', 'Namkeen / bhujia', '30 g', 30, 160, 4, 14, 10, 2, 'snack', 'vg', [], 'in', 0.5, ['Namkeen', 30]],
    ['biscuits', 'Marie-type biscuits', '4 pieces (28 g)', 28, 125, 2, 21, 3.5, 0.5, 'snack', 'v', ['gluten', 'dairy'], 'both', 1, ['Biscuits', 28]],
    ['popcorn', 'Popcorn, air-popped', '3 cups (24 g)', 24, 93, 3, 19, 1.1, 3.6, 'snack', 'vg', [], 'both', 0.5, ['Popcorn kernels', 24]],
    ['chikki', 'Peanut chikki', '1 piece (25 g)', 25, 125, 3.5, 13, 7, 1, 'sweet', 'vg', ['peanut'], 'in', 1, ['Peanut chikki', 25]],
    ['dark-choc', 'Dark chocolate', '20 g', 20, 120, 1.5, 9, 8.5, 2, 'sweet', 'vg', [], 'both', 1, ['Dark chocolate', 20]],
    ['gulab-jamun', 'Gulab jamun', '1 piece', 50, 180, 2, 25, 8, 0.3, 'sweet', 'v', ['dairy', 'gluten'], 'in', 1, ['Gulab jamun', 50]],
    ['kheer', 'Kheer', '1 katori', 150, 280, 7, 36, 11, 0.5, 'sweet', 'v', ['dairy'], 'in', 0.5, ['Milk (full cream)', 120]],
    ['sugar', 'Sugar', '1 tsp (4 g)', 4, 16, 0, 4, 0, 0, 'sweet', 'vg', [], 'both', 1, ['Sugar', 4]],
    ['honey', 'Honey', '1 tsp (7 g)', 7, 21, 0, 5.7, 0, 0, 'sweet', 'v', [], 'both', 1, ['Honey', 7]],
    ['jaggery', 'Jaggery', '10 g', 10, 38, 0, 9.8, 0, 0, 'sweet', 'vg', [], 'in', 1, ['Jaggery', 10]],

    // Drinks
    ['chai', 'Masala chai (milk & sugar)', '1 cup', 150, 80, 3, 10, 3, 0, 'drink', 'v', ['dairy'], 'in', 1, ['Tea leaves', 3]],
    ['coffee-milk', 'Coffee with milk & sugar', '1 cup', 150, 80, 3, 10, 3, 0, 'drink', 'v', ['dairy'], 'both', 1, ['Coffee', 3]],
    ['black-coffee', 'Black coffee / tea, no sugar', '1 cup', 200, 2, 0.3, 0, 0, 0, 'drink', 'vg', [], 'both', 1, ['Coffee / tea', 3]],
    ['coconut-water', 'Coconut water', '1 glass (240 ml)', 240, 46, 1.7, 9, 0.5, 2.6, 'drink', 'vg', [], 'both', 1, ['Tender coconut', 1]],
    ['juice', 'Fruit juice', '1 glass (200 ml)', 200, 90, 0.5, 21, 0.2, 0.4, 'drink', 'vg', [], 'both', 1, ['Fruit juice', 200]],
    ['soft-drink', 'Soft drink', '1 can (300 ml)', 300, 126, 0, 32, 0, 0, 'drink', 'vg', [], 'both', 1, ['Soft drink', 300]],
    ['banana-shake', 'Banana milkshake', '1 glass (250 ml)', 250, 237, 7.3, 46, 6.4, 3, 'drink', 'v', ['dairy'], 'both', 0.5, ['Bananas', 118]]
  ];

  var FOODS = {};
  ROWS.forEach(function (r) {
    FOODS[r[0]] = {
      id: r[0], name: r[1], portion: r[2], g: r[3], kcal: r[4], p: r[5], c: r[6], f: r[7], fib: r[8],
      group: r[9], diet: r[10], allergens: r[11], cuisine: r[12], step: r[13], raw: r[14]
    };
  });

  /* Meal templates: items = [foodId, quantity (portions), role]
     role: 'c' = carb/base (scaled first), 'p' = protein (scaled second), 'x' = fixed side */
  var TPL = [
    // Breakfasts — Indian
    { id: 'b-poha', slot: 'b', cuisine: 'in', name: 'Vegetable poha with curd', items: [['poha', 1, 'c'], ['curd', 1, 'p']] },
    { id: 'b-besan', slot: 'b', cuisine: 'in', name: 'Besan chilla with curd', items: [['besan-chilla', 2, 'c'], ['curd', 1, 'p']] },
    { id: 'b-moongchilla', slot: 'b', cuisine: 'in', name: 'Moong dal chilla with milk', items: [['moong-chilla', 3, 'c'], ['milk', 1, 'p']] },
    { id: 'b-idli', slot: 'b', cuisine: 'in', name: 'Idli with sambar', items: [['idli', 3, 'c'], ['sambar', 1, 'p']] },
    { id: 'b-dosa', slot: 'b', cuisine: 'in', name: 'Plain dosa with sambar', items: [['dosa', 1, 'c'], ['sambar', 1, 'p']] },
    { id: 'b-upma', slot: 'b', cuisine: 'in', name: 'Upma with roasted chana', items: [['upma', 1, 'c'], ['roasted-chana', 1, 'p']] },
    { id: 'b-paratha', slot: 'b', cuisine: 'in', name: 'Paneer paratha with curd', items: [['paneer-paratha', 1, 'c'], ['curd', 1, 'p']] },
    { id: 'b-daliya', slot: 'b', cuisine: 'in', name: 'Vegetable daliya with milk', items: [['daliya', 1, 'c'], ['milk', 1, 'p']] },
    { id: 'b-oatsmilk', slot: 'b', cuisine: 'both', name: 'Oats with milk, banana & almonds', items: [['oats', 1, 'c'], ['milk', 1, 'p'], ['banana', 1, 'x'], ['almonds', 1, 'x']] },
    { id: 'b-sprouts', slot: 'b', cuisine: 'in', name: 'Sprouts chaat with toast & milk', items: [['sprouts', 1, 'p'], ['bread-ww', 1, 'c'], ['milk', 1, 'x']] },
    { id: 'b-uttapam', slot: 'b', cuisine: 'in', name: 'Vegetable uttapam with sambar', items: [['uttapam', 1, 'c'], ['sambar', 1, 'p']] },
    { id: 'b-omelette', slot: 'b', cuisine: 'both', name: 'Vegetable omelette with toast & fruit', items: [['omelette', 1, 'p'], ['bread-ww', 2, 'c'], ['orange', 1, 'x']] },
    { id: 'b-eggbhurji', slot: 'b', cuisine: 'in', name: 'Egg bhurji with roti', items: [['egg-bhurji', 1, 'p'], ['roti', 2, 'c']] },
    { id: 'b-eggs-poha', slot: 'b', cuisine: 'in', name: 'Poha with boiled eggs', items: [['poha', 1, 'c'], ['egg', 2, 'p']] },
    { id: 'b-tofu', slot: 'b', cuisine: 'in', name: 'Tofu bhurji with roti', items: [['tofu-bhurji', 1, 'p'], ['roti', 2, 'c']] },
    { id: 'b-oatssoy', slot: 'b', cuisine: 'both', name: 'Oats with soy milk, banana & peanut butter', items: [['oats', 1, 'c'], ['soy-milk', 1, 'p'], ['banana', 1, 'x'], ['peanut-butter', 1, 'x']] },
    { id: 'b-greek', slot: 'b', cuisine: 'intl', name: 'Greek yogurt bowl with oats & berries', items: [['greek-yogurt', 1, 'p'], ['oats', 1, 'c'], ['berries', 1, 'x']] },
    { id: 'b-pbtoast', slot: 'b', cuisine: 'intl', name: 'Peanut butter toast with banana & milk', items: [['bread-ww', 2, 'c'], ['peanut-butter', 1, 'x'], ['banana', 1, 'x'], ['milk', 1, 'p']] },
    { id: 'b-eggtoast', slot: 'b', cuisine: 'intl', name: 'Boiled eggs on toast with fruit', items: [['egg', 2, 'p'], ['bread-ww', 2, 'c'], ['apple', 1, 'x']] },

    // Lunches & dinners — Indian vegetarian
    { id: 'm-dal-roti', slot: 'm', cuisine: 'in', name: 'Roti, toor dal, sabzi & salad', items: [['roti', 3, 'c'], ['dal-toor', 1, 'p'], ['sabzi', 1, 'x'], ['salad', 1, 'x']] },
    { id: 'm-rajma', slot: 'm', cuisine: 'in', name: 'Rajma chawal with salad & curd', items: [['rice', 1.5, 'c'], ['rajma', 1, 'p'], ['salad', 1, 'x'], ['curd', 1, 'x']] },
    { id: 'm-chole', slot: 'm', cuisine: 'in', name: 'Chole with roti & salad', items: [['roti', 3, 'c'], ['chole', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-palakpaneer', slot: 'm', cuisine: 'in', name: 'Palak paneer with roti & salad', items: [['roti', 3, 'c'], ['palak-paneer', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-khichdi', slot: 'm', cuisine: 'in', name: 'Moong dal khichdi with curd & salad', items: [['khichdi', 1.5, 'c'], ['curd', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-soya', slot: 'm', cuisine: 'in', name: 'Soya chunk curry with rice & salad', items: [['rice', 1.5, 'c'], ['soya-curry', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-dal-rice', slot: 'm', cuisine: 'in', name: 'Dal rice with bhindi & salad', items: [['rice', 1.5, 'c'], ['dal-masoor', 1, 'p'], ['bhindi', 1, 'x'], ['salad', 1, 'x']] },
    { id: 'm-sambar-rice', slot: 'm', cuisine: 'in', name: 'Sambar rice with vegetables & curd', items: [['rice', 1.5, 'c'], ['sambar', 1.5, 'p'], ['sabzi', 1, 'x'], ['curd', 1, 'x']] },
    { id: 'm-paneer-bhurji', slot: 'm', cuisine: 'in', name: 'Paneer bhurji with roti & salad', items: [['roti', 3, 'c'], ['paneer-bhurji', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-millet', slot: 'm', cuisine: 'in', name: 'Millet with moong dal & lauki', items: [['millet', 1.5, 'c'], ['dal-moong', 1, 'p'], ['lauki', 1, 'x']] },
    { id: 'm-bajra', slot: 'm', cuisine: 'in', name: 'Bajra roti with chana dal & palak', items: [['bajra-roti', 2, 'c'], ['dal-chana', 1, 'p'], ['palak', 1, 'x']] },
    { id: 'm-tofu-roti', slot: 'm', cuisine: 'in', name: 'Tofu bhurji with roti & salad', items: [['roti', 3, 'c'], ['tofu-bhurji', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-chickpea-rice', slot: 'm', cuisine: 'in', name: 'Chole rice with salad', items: [['rice', 1.5, 'c'], ['chole', 1, 'p'], ['salad', 1, 'x']] },

    // Egg & non-veg mains
    { id: 'm-eggcurry', slot: 'm', cuisine: 'in', name: 'Egg curry with rice & salad', items: [['rice', 1.5, 'c'], ['egg-curry', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-chicken', slot: 'm', cuisine: 'in', name: 'Chicken curry with roti & salad', items: [['roti', 3, 'c'], ['chicken-curry', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-chicken-rice', slot: 'm', cuisine: 'in', name: 'Chicken curry with rice & dal', items: [['rice', 1.5, 'c'], ['chicken-curry', 1, 'p'], ['dal-moong', 0.5, 'x']] },
    { id: 'm-fish', slot: 'm', cuisine: 'in', name: 'Fish curry with rice & sabzi', items: [['rice', 1.5, 'c'], ['fish-curry', 1, 'p'], ['sabzi', 1, 'x']] },
    { id: 'm-tandoori', slot: 'm', cuisine: 'in', name: 'Tandoori chicken with roti, dal & salad', items: [['roti', 2, 'c'], ['tandoori-chicken', 1.5, 'p'], ['dal-toor', 0.5, 'x'], ['salad', 1, 'x']] },
    { id: 'm-biryani', slot: 'm', cuisine: 'in', name: 'Chicken biryani with raita & salad', items: [['chicken-biryani', 1, 'c'], ['raita', 1, 'p'], ['salad', 1, 'x']] },
    { id: 'm-mutton', slot: 'm', cuisine: 'in', name: 'Mutton curry with roti & salad', items: [['roti', 3, 'c'], ['mutton-curry', 1, 'p'], ['salad', 1, 'x']] },

    // International mains
    { id: 'm-pasta', slot: 'm', cuisine: 'intl', name: 'Tomato & vegetable pasta with chickpeas', items: [['pasta-veg', 1, 'c'], ['chickpeas', 0.5, 'p']] },
    { id: 'm-beanbowl', slot: 'm', cuisine: 'intl', name: 'Rice & bean bowl with salad', items: [['bean-bowl', 1, 'c'], ['salad', 1, 'x']] },
    { id: 'm-quinoa-tofu', slot: 'm', cuisine: 'intl', name: 'Quinoa with tofu & steamed vegetables', items: [['quinoa', 1, 'c'], ['tofu', 1.5, 'p'], ['steamed-veg', 1, 'x']] },
    { id: 'm-chicken-plate', slot: 'm', cuisine: 'intl', name: 'Grilled chicken, potato & vegetables', items: [['potato', 1.5, 'c'], ['chicken', 1.5, 'p'], ['steamed-veg', 1, 'x']] },
    { id: 'm-salmon', slot: 'm', cuisine: 'intl', name: 'Salmon with rice & vegetables', items: [['rice', 1, 'c'], ['salmon', 1.2, 'p'], ['steamed-veg', 1, 'x']] },
    { id: 'm-wrap', slot: 'm', cuisine: 'intl', name: 'Chicken wrap with salad', items: [['chicken-wrap', 1, 'c'], ['salad', 1, 'x']] },
    { id: 'm-tuna', slot: 'm', cuisine: 'intl', name: 'Tuna, sweet potato & vegetables', items: [['sweet-potato', 1.5, 'c'], ['tuna', 1, 'p'], ['steamed-veg', 1, 'x']] },
    { id: 'm-soup-sandwich', slot: 'm', cuisine: 'both', name: 'Vegetable soup with paneer sandwich', items: [['paneer-sandwich', 1, 'c'], ['veg-soup', 1, 'x']] },

    // Snacks
    { id: 's-chana-fruit', slot: 's', cuisine: 'in', name: 'Roasted chana & an apple', items: [['roasted-chana', 1, 'p'], ['apple', 1, 'c']] },
    { id: 's-chaas-peanuts', slot: 's', cuisine: 'in', name: 'Buttermilk & peanuts', items: [['buttermilk', 1, 'x'], ['peanuts', 0.5, 'p']] },
    { id: 's-fruit-almonds', slot: 's', cuisine: 'both', name: 'Fruit & almonds', items: [['banana', 1, 'c'], ['almonds', 1, 'p']] },
    { id: 's-sprouts', slot: 's', cuisine: 'in', name: 'Sprouts chaat', items: [['sprouts', 1, 'p']] },
    { id: 's-makhana', slot: 's', cuisine: 'in', name: 'Roasted makhana & buttermilk', items: [['makhana', 1, 'c'], ['buttermilk', 1, 'p']] },
    { id: 's-milk', slot: 's', cuisine: 'both', name: 'A glass of milk & dates', items: [['milk', 1, 'p'], ['dates', 2, 'c']] },
    { id: 's-curd-fruit', slot: 's', cuisine: 'in', name: 'Curd with papaya', items: [['curd', 1, 'p'], ['papaya', 1, 'c']] },
    { id: 's-eggs', slot: 's', cuisine: 'both', name: 'Two boiled eggs & an orange', items: [['egg', 2, 'p'], ['orange', 1, 'c']] },
    { id: 's-dhokla', slot: 's', cuisine: 'in', name: 'Dhokla', items: [['dhokla', 1, 'c']] },
    { id: 's-soymilk', slot: 's', cuisine: 'both', name: 'Soy milk & a banana', items: [['soy-milk', 1, 'p'], ['banana', 1, 'c']] },
    { id: 's-guava-peanuts', slot: 's', cuisine: 'in', name: 'Guava & peanuts', items: [['guava', 1, 'c'], ['peanuts', 0.5, 'p']] },
    { id: 's-hummus', slot: 's', cuisine: 'intl', name: 'Hummus with carrots & popcorn', items: [['hummus', 2, 'p'], ['popcorn', 1, 'c']] },
    { id: 's-yogurt', slot: 's', cuisine: 'intl', name: 'Greek yogurt & berries', items: [['greek-yogurt', 1, 'p'], ['berries', 0.5, 'c']] }
  ];

  var DIET_RANK = { vg: 0, v: 1, e: 2, n: 3 };
  TPL.forEach(function (t) {
    var rank = 0, allergens = {};
    t.items.forEach(function (it) {
      var f = FOODS[it[0]];
      if (!f) { console.warn('Unknown food in template', t.id, it[0]); return; }
      // egg and meat are separate branches: an "egg" item inside a veg plan is not allowed
      rank = Math.max(rank, DIET_RANK[f.diet]);
      f.allergens.forEach(function (a) { allergens[a] = true; });
    });
    t.dietRank = rank;
    t.hasEgg = t.items.some(function (it) { return FOODS[it[0]] && FOODS[it[0]].diet === 'e'; });
    t.hasMeat = t.items.some(function (it) { return FOODS[it[0]] && FOODS[it[0]].diet === 'n'; });
    t.allergens = Object.keys(allergens);
  });

  M.FOOD_GROUPS = GROUPS;
  M.FOODS = FOODS;
  M.MEAL_TEMPLATES = TPL;
  M.DIETS = [
    { id: 'vegan', label: 'Vegan', desc: 'No animal foods' },
    { id: 'veg', label: 'Vegetarian', desc: 'Dairy yes, no eggs' },
    { id: 'egg', label: 'Eggetarian', desc: 'Vegetarian plus eggs' },
    { id: 'nonveg', label: 'Non-vegetarian', desc: 'Includes chicken, fish, meat' }
  ];
  M.ALLERGENS = [
    { id: 'dairy', label: 'Dairy' }, { id: 'gluten', label: 'Gluten / wheat' }, { id: 'nuts', label: 'Tree nuts' },
    { id: 'peanut', label: 'Peanuts' }, { id: 'soy', label: 'Soy' }, { id: 'egg', label: 'Eggs' }, { id: 'fish', label: 'Fish' }
  ];

  /* Is a food allowed for this diet? */
  M.dietAllows = function (diet, foodDiet) {
    if (diet === 'vegan') return foodDiet === 'vg';
    if (diet === 'veg') return foodDiet === 'vg' || foodDiet === 'v';
    if (diet === 'egg') return foodDiet !== 'n';
    return true;
  };
  M.allFoods = function () {
    var list = Object.keys(FOODS).map(function (k) { return FOODS[k]; });
    (M.state && M.state.customFoods || []).forEach(function (c) { list.push(c); });
    return list;
  };
  M.food = function (id) {
    if (FOODS[id]) return FOODS[id];
    var cf = (M.state && M.state.customFoods) || [];
    for (var i = 0; i < cf.length; i++) if (cf[i].id === id) return cf[i];
    return null;
  };
})();
