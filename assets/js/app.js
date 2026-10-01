/* Mizan — app bootstrap */
(function () {
  'use strict';
  var M = window.M;

  M.load();
  if (M.special) M.special.prune(); // forget special days long past
  M.applyTheme();
  M.applyLook();
  M.renderNav();
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (M.state.settings.theme === 'system') M.applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  } catch (e) { /* ignore */ }

  /* ---------- Install (PWA) ----------
     Chrome, Edge and Samsung Internet (Android and computers) give a real "Install" prompt.
     iPhone and iPad have no prompt: apps are added with Share → Add to Home Screen, so we show those steps.
     Inside Instagram, WhatsApp, Facebook and other apps nothing can be installed, so we help open Mizan
     in the phone's real browser first. */
  var deferredPrompt = null;
  var installDlg = null;
  M.installed = function () {
    var mm = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
    return mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)') || window.navigator.standalone === true;
  };
  M.device = function () {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    var inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|musical_ly|TikTok|BytedanceWebview|LinkedInApp|Twitter|Pinterest|WhatsApp|GSA\/|; wv\)/i.test(ua) || (ios && !/Safari\//.test(ua));
    var browser = /SamsungBrowser/i.test(ua) ? 'samsung' : /EdgA|EdgiOS|Edg\//.test(ua) ? 'edge' : /OPR\/|OPT\/|Opera/.test(ua) ? 'opera' :
      /FxiOS|Firefox\//.test(ua) ? 'firefox' : /MiuiBrowser|XiaoMi|HeyTapBrowser|VivoBrowser|UCBrowser|YaBrowser|Silk/i.test(ua) ? 'other' :
      /CriOS|Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
    return { ios: ios, android: android, mobile: ios || android || /Mobi/i.test(ua), inApp: inApp, browser: browser };
  };
  function pageUrl() { return location.origin + location.pathname.replace(/index\.html$/, ''); }
  function chromeIntent() { return 'intent://' + location.host + location.pathname.replace(/index\.html$/, '') + '#Intent;scheme=https;package=com.android.chrome;end'; }
  var ic = function (n, label) { return '<span class="is-ic"' + (label ? ' role="img" aria-label="' + label + '"' : '') + '>' + M.icon(n) + '</span>'; };
  function steps(list) {
    return '<ol class="install-steps">' + list.map(function (x, i) { return '<li><span class="is-n" aria-hidden="true">' + (i + 1) + '</span><span class="is-t">' + x + '</span></li>'; }).join('') + '</ol>';
  }
  var lead = function (t) { return '<p class="soft install-lead">' + t + '</p>'; };
  var note = function (t) { return '<p class="install-note">' + M.icon('info') + '<span>' + t + '</span></p>'; };
  function copyRow() {
    return '<div class="copy-row"><input class="input" readonly value="' + M.esc(pageUrl()) + '" aria-label="Link to Mizan"><button type="button" class="btn" data-copy-link>' + M.icon('copy') + 'Copy link</button></div>';
  }
  var openChrome = function () { return '<a class="btn btn-primary btn-block" href="' + M.esc(chromeIntent()) + '">' + M.icon('external') + 'Open in Chrome</a>'; };
  var CHROME_STEPS = ['Tap ' + ic('kebab', 'the three-dot menu') + ' at the top right of Chrome.', 'Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).', 'Tap <strong>Install</strong>. Mizan appears on your home screen and opens full screen, even offline.'];
  /* the right steps for this phone / browser */
  function installContent() {
    var d = M.device();
    if (M.installed()) return { title: 'Mizan is installed', html: '<p class="install-done">' + M.icon('good') + '<span>You’re already using Mizan as an app. Open it any time from your ' + (d.mobile ? 'home screen' : 'apps') + '.</span></p>' };
    if (d.inApp) {
      return {
        title: 'Open Mizan in your browser',
        html: lead('You opened Mizan inside another app (like Instagram, WhatsApp or Facebook). Apps can only be installed from your phone’s browser.') +
          (d.android ? openChrome() : '') +
          steps(d.ios
            ? ['Tap ' + ic('more', 'the menu') + ' or ' + ic('share', 'Share') + ' in this app.', 'Choose <strong>Open in Safari</strong> (or “Open in browser”).', 'In Safari, open <strong>☰ → Install as an app</strong> again.']
            : ['Or tap ' + ic('kebab', 'the three-dot menu') + ' at the top right.', 'Choose <strong>Open in Chrome</strong> (or “Open in browser”).', 'In Chrome, open <strong>☰ → Install as an app</strong> again.']) +
          copyRow()
      };
    }
    if (d.ios) {
      var safari = d.browser === 'safari';
      return {
        title: 'Add Mizan to your Home Screen',
        html: lead('On iPhone and iPad, websites become apps from the <strong>Share</strong> menu — it takes 3 taps.') +
          steps([
            'Tap <strong>Share</strong> ' + ic('share', 'Share') + (safari ? ' — at the bottom of the screen on iPhone (top right on iPad).' : d.browser === 'firefox' ? ' — open the ☰ menu first.' : ' — in the address bar.'),
            'Scroll down and tap <strong>Add to Home Screen</strong> ' + ic('addsq', 'Add to Home Screen') + '.',
            'Tap <strong>Add</strong>. Mizan appears on your home screen and opens full screen, even offline.'
          ]) +
          (safari ? note('Don’t see “Add to Home Screen”? Scroll to the bottom of the Share menu, tap <strong>Edit Actions…</strong> and add it.')
            : note('This needs iOS 16.4 or newer. If you don’t see it, open Mizan in <strong>Safari</strong> and try there.') + copyRow())
      };
    }
    if (d.android) {
      if (d.browser === 'chrome') return { title: 'Install Mizan', html: lead('Add Mizan to your home screen — it opens full screen and works offline, like any other app.') + '<div class="install-now"></div>' + steps(CHROME_STEPS) + note('Only see “Create shortcut”, or no install option? Use Mizan for about 30 seconds, then try again — Chrome offers the full app after a short visit. Also check you’re not in Incognito.') };
      if (d.browser === 'samsung') return { title: 'Install Mizan', html: lead('Add Mizan to your home screen — it opens full screen and works offline.') + '<div class="install-now"></div>' + steps(['Tap ' + ic('menu', 'the menu') + ' at the bottom right.', 'Tap <strong>Add page to</strong>.', 'Tap <strong>Home screen</strong>, then <strong>Add</strong>.']) + note('You may also see an install icon ' + ic('download', 'Install') + ' in the address bar — tap it.') };
      if (d.browser === 'firefox') return { title: 'Install Mizan', html: lead('Add Mizan to your home screen.') + steps(['Tap ' + ic('kebab', 'the three-dot menu') + '.', 'Tap <strong>Install</strong> (or <strong>Add app to Home screen</strong>).', 'Tap <strong>Add</strong>.']) };
      if (d.browser === 'edge') return { title: 'Install Mizan', html: lead('Add Mizan to your home screen.') + '<div class="install-now"></div>' + steps(['Tap ' + ic('more', 'the menu') + ' at the bottom.', 'Tap <strong>Add to phone</strong>.', 'Tap <strong>Install</strong>.']) };
      if (d.browser === 'opera') return { title: 'Install Mizan', html: lead('Add Mizan to your home screen.') + steps(['Tap ' + ic('kebab', 'the menu') + '.', 'Tap <strong>Add to…</strong> → <strong>Home screen</strong>.', 'Tap <strong>Add</strong>.']) };
      return { title: 'Open Mizan in Chrome', html: lead('This browser can’t install web apps properly. Open Mizan in <strong>Chrome</strong> — then install it from there.') + openChrome() + steps(CHROME_STEPS) + copyRow() };
    }
    // computer
    if (d.browser === 'chrome' || d.browser === 'edge') return { title: 'Install Mizan', html: lead('Install Mizan on this computer — it opens in its own window and works offline.') + '<div class="install-now"></div>' + steps(['Click the install icon ' + ic('download', 'Install') + ' at the right end of the address bar.', 'Click <strong>Install</strong>.']) + note('No icon? Open the ' + ic('kebab', 'menu') + ' menu → <strong>Cast, save and share</strong> → <strong>Install page as app</strong> (in Edge: <strong>Apps → Install this site as an app</strong>).') };
    if (d.browser === 'safari') return { title: 'Add Mizan to the Dock', html: lead('On a Mac (macOS Sonoma or newer):') + steps(['In the menu bar, choose <strong>File → Add to Dock</strong>.', 'Click <strong>Add</strong>.']) };
    return { title: 'Install Mizan', html: lead('This browser can’t install web apps. Open Mizan in <strong>Chrome</strong> or <strong>Edge</strong> to install it — or just bookmark this page.') + copyRow() };
  }
  function showNowButton(dlg) {
    var slot = dlg && dlg.querySelector('.install-now');
    if (!slot || !deferredPrompt || slot.childNodes.length) return;
    slot.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-install-now>' + M.icon('download') + 'Install now</button><p class="install-or">or do it yourself:</p>';
  }
  function runPrompt() {
    var e = deferredPrompt;
    if (!e) return false;
    deferredPrompt = null;
    try {
      e.prompt();
      e.userChoice.then(function (c) { if (c && c.outcome === 'accepted') M.toast('Installing Mizan…'); }, function () {});
    } catch (err) { return false; }
    return true;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    M.$$('[data-action="install"]').forEach(function (b) { b.hidden = false; });
    if (installDlg && installDlg.open) showNowButton(installDlg);
  });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; if (installDlg && installDlg.open) installDlg.close(); M.toast('Mizan installed — find it on your home screen'); });
  M.install = function () {
    if (!M.installed() && runPrompt()) return;
    var c = installContent();
    installDlg = M.sheet({
      title: c.title, body: c.html,
      foot: '<button type="button" class="btn" data-close>Close</button>', noAutofocus: true,
      onOpen: function (dlg) {
        dlg.classList.add('install-sheet');
        showNowButton(dlg);
        dlg.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-install-now]')) { dlg.close(); runPrompt(); return; }
          if (ev.target.closest('[data-copy-link]')) {
            var inp = dlg.querySelector('.copy-row input');
            var done = function () { M.haptic('success'); M.toast('Link copied — paste it in Chrome or Safari'); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, function () { inp.select(); try { document.execCommand('copy'); done(); } catch (x) { /* ignore */ } });
            else { inp.select(); try { document.execCommand('copy'); done(); } catch (x) { /* ignore */ } }
          }
        });
      },
      onClose: function () { installDlg = null; }
    });
  };
  /* One friendly nudge on phones (never inside the installed app) */
  function nudge() {
    var st = M.state.settings;
    if (st.installNudged || !st.onboarded || M.installed() || !M.device().mobile || document.querySelector('dialog[open]')) return;
    st.installNudged = M.today();
    M.save();
    M.toast(deferredPrompt ? 'Install Mizan as an app on your phone' : 'Add Mizan to your home screen', { label: deferredPrompt ? 'Install' : 'How?', fn: function () { M.install(); } });
  }
  setTimeout(nudge, 15000);

  /* Opened from a notification button while Mizan was closed (./?n=water:drink) */
  (function () {
    var m = /[?&]n=([^&#]+)/.exec(location.search);
    if (!m) return;
    var p = decodeURIComponent(m[1]).split(':');
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
    if (p[0] === 'water' && M.waterReminder) setTimeout(function () { M.waterReminder.fromNotification(p[1]); }, 600);
  })();

  /* ---------- Older browsers without CSS :has() — mark checked choices with a class ---------- */
  (function () {
    var hasHas = false;
    try { hasHas = !!(window.CSS && CSS.supports && CSS.supports('selector(:has(*))')); } catch (e) { hasHas = false; }
    if (hasHas) return;
    document.documentElement.classList.add('no-has');
    var sync = function () {
      M.$$('label.choice, label.shape-opt, .grocery-group label').forEach(function (l) { var i = l.querySelector('input'); l.classList.toggle('is-checked', !!(i && i.checked)); });
    };
    var t = null, later = function () { clearTimeout(t); t = setTimeout(sync, 0); };
    document.addEventListener('change', later, true);
    document.addEventListener('click', later, true);
    if (window.MutationObserver) new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    sync();
  })();

  /* ---------- ☰ menu: every screen + Settings ---------- */
  function moreSheet() {
    var items = M.NAV.filter(function (n) { return n.id !== 'settings'; });
    M.sheet({
      title: 'Menu',
      body: '<a class="menu-settings" href="#/settings" data-close>' + M.icon('settings') + '<span class="li-main"><strong>Settings</strong><span>Change anything: look, tabs, dashboard, assistant, backup</span></span>' + M.icon('right') + '</a>' +
        '<div class="menu-grid">' + items.map(function (n) {
          return '<a class="menu-item" href="' + n.href + '" data-close' + (M.currentRoute && M.currentRoute.name === n.id ? ' aria-current="page"' : '') + '><span class="mi-ico">' + M.icon(n.icon) + '</span><span>' + M.esc(n.label) + '</span></a>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:14px">' + (M.installed() ? '' : '<button type="button" class="btn" data-install-inline>' + M.icon('download') + 'Install as an app</button>') + '<button type="button" class="btn" data-focus-inline>' + M.icon('timer') + 'Focus timer</button></div>' +
        '<p class="muted" style="font-size:var(--fs-xs);margin:14px 0 0"><a href="#/science" data-close>Science & sources</a> · <a href="#/about" data-close>About</a> · <a href="privacy.html">Privacy policy</a> · v' + M.VERSION + '</p>',
      noAutofocus: true,
      onOpen: function (dlg) {
        var ib = dlg.querySelector('[data-install-inline]');
        if (ib) ib.addEventListener('click', function () { dlg.close(); M.install(); });
        dlg.querySelector('[data-focus-inline]').addEventListener('click', function () { dlg.close(); M.ui.focusTimer(''); });
      }
    });
  }

  /* ---------- Global actions ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action]');
    if (!a) return;
    var act = a.getAttribute('data-action');
    if (act === 'edit-profile') { e.preventDefault(); M.go('settings/profile'); }
    else if (act === 'more') { e.preventDefault(); moreSheet(); }
    else if (act === 'install') { e.preventDefault(); M.install(); }
    else if (act === 'focus-global') { e.preventDefault(); M.ui.focusTimer(''); }
  });

  /* ---------- Haptics: a light tap for every control, stronger ones are fired by the actions themselves ---------- */
  var TAPPABLE = 'button, [role="tab"], a.btn, .tabbar a, .rail a, summary, .chip, .seg label, .choice, .chip-radio, .switch, .check-btn, .ds-seg, .qa, .menu-item, .swatch';
  document.addEventListener('click', function (e) {
    if (M.isHapticProxy(e.target)) return;
    var t = e.target.closest(TAPPABLE);
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    M.haptic(t.matches('input, .switch, .choice, .chip-radio, .seg label') ? 'select' : 'tap');
  }, true);

  window.addEventListener('hashchange', function () { M.render(); });
  window.addEventListener('storage', function (e) {
    if (e.key === 'mizan.v1' && !document.querySelector('dialog[open]')) { M.load(); M.applyTheme(); M.applyLook(); M.renderNav(); M.refresh(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && M.currentRoute && (M.currentRoute.name === 'today' || M.currentRoute.name === 'dashboard') && !document.querySelector('dialog[open]')) M.render(true);
  });

  /* ---------- Offline support ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then(function (reg) { try { reg.update(); } catch (e) { /* ignore */ } }).catch(function (err) { console.warn('Service worker not registered', err); });
      /* A new version took over: reload once so every file comes from the same version */
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloaded) return;
        reloaded = true;
        // never reload in the middle of something: an open sheet or a walk / run being tracked
        if (document.querySelector('dialog[open]') || (M.move && M.move.active())) { M.toast('Mizan was updated', { label: 'Reload', fn: function () { location.reload(); } }); return; }
        location.reload();
      });
    });
  }

  if (M.state.settings.onboarded) M.requestPersist();
  M.render();
})();
