/* Mizan — app bootstrap */
(function () {
  'use strict';
  var M = window.M;

  M.load();
  M.applyTheme();
  M.applyLook();
  M.renderNav();
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (M.state.settings.theme === 'system') M.applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  } catch (e) { /* ignore */ }

  /* ---------- Install (PWA) ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    M.$$('[data-action="install"]').forEach(function (b) { b.hidden = false; });
  });
  window.addEventListener('appinstalled', function () { deferredPrompt = null; M.toast('Mizan installed'); });
  M.install = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; }, function () { deferredPrompt = null; });
      return;
    }
    M.sheet({
      title: 'Install Mizan',
      body: '<p class="soft">Mizan works like an app once it’s on your home screen — full screen, and offline.</p><ul class="list">' +
        '<li><div class="li-main"><strong>iPhone / iPad (Safari)</strong><span>Tap the Share button, then “Add to Home Screen”.</span></div></li>' +
        '<li><div class="li-main"><strong>Android (Chrome)</strong><span>Tap the ⋮ menu, then “Install app” or “Add to Home screen”.</span></div></li>' +
        '<li><div class="li-main"><strong>Computer (Chrome or Edge)</strong><span>Click the install icon at the right of the address bar.</span></div></li></ul>',
      foot: '<button type="button" class="btn btn-primary" data-close>OK</button>', noAutofocus: true
    });
  };

  /* ---------- ☰ menu: every screen + Settings ---------- */
  function moreSheet() {
    var items = M.NAV.filter(function (n) { return n.id !== 'settings'; });
    M.sheet({
      title: 'Menu',
      body: '<a class="menu-settings" href="#/settings" data-close>' + M.icon('settings') + '<span class="li-main"><strong>Settings</strong><span>Change anything: look, tabs, dashboard, assistant, backup</span></span>' + M.icon('right') + '</a>' +
        '<div class="menu-grid">' + items.map(function (n) {
          return '<a class="menu-item" href="' + n.href + '" data-close' + (M.currentRoute && M.currentRoute.name === n.id ? ' aria-current="page"' : '') + '><span class="mi-ico">' + M.icon(n.icon) + '</span><span>' + M.esc(n.label) + '</span></a>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:14px"><button type="button" class="btn" data-install-inline>' + M.icon('download') + 'Install as an app</button><button type="button" class="btn" data-focus-inline>' + M.icon('timer') + 'Focus timer</button></div>' +
        '<p class="muted" style="font-size:var(--fs-xs);margin:14px 0 0"><a href="#/science" data-close>Science & sources</a> · <a href="#/about" data-close>About</a> · <a href="privacy.html">Privacy policy</a> · v' + M.VERSION + '</p>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.querySelector('[data-install-inline]').addEventListener('click', function () { dlg.close(); M.install(); });
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
        if (document.querySelector('dialog[open]')) { M.toast('Mizan was updated', { label: 'Reload', fn: function () { location.reload(); } }); return; }
        location.reload();
      });
    });
  }

  if (M.state.settings.onboarded) M.requestPersist();
  M.render();
})();
