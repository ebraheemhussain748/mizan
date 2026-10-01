/* Mizan — backups.
   1. A backup file (optionally locked with a password) that people keep wherever they like.
   2. Google Drive: one file in Mizan's hidden app folder in the person's OWN Drive
      (scope drive.appdata — Mizan can't see any other Drive files). No Mizan server is involved. */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var FILE = 'mizan-backup.json';

  /* ------------------------------------------------------------------ */
  /* Packing and unpacking                                               */
  /* ------------------------------------------------------------------ */
  function pack() {
    return { app: 'mizan', v: 2, version: M.VERSION, at: new Date().toISOString(), data: M.state };
  }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(str) { var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function keyFrom(password, salt, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function encrypt(obj, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 200000;
    return keyFrom(password, salt, iter).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    }).then(function (ct) {
      return { app: 'mizan', v: 2, enc: 'aes-gcm', iter: iter, salt: b64(salt), iv: b64(iv), data: b64(ct), at: new Date().toISOString() };
    });
  }
  function decrypt(file, password) {
    return keyFrom(password, unb64(file.salt), file.iter || 200000).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, key, unb64(file.data));
    }).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  /* Accept v2 wrapped files and v1 plain exports */
  function unwrap(obj) {
    if (obj && obj.app === 'mizan' && obj.data && typeof obj.data === 'object') return obj.data;
    if (obj && obj.profile && obj.routines) return obj;
    return null;
  }
  function apply(data) {
    var base = M.defaultState();
    Object.keys(data).forEach(function (k) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) base[k] = Object.assign(base[k], data[k]);
      else base[k] = data[k];
    });
    base.settings.onboarded = true;
    M.state = M.upgrade(base);
    M.save(true);
    M.applyTheme(); if (M.applyLook) M.applyLook(); M.renderNav();
    M.go(M.state.settings.nav.start || 'dashboard');
    M.haptic('success');
    M.toast('Your data is back');
  }
  function hasData() {
    var s = M.state;
    return s.settings.onboarded && (s.weights.length || s.habits.length || Object.keys(s.checkins).length || s.setup || s.activities.length);
  }

  /* ------------------------------------------------------------------ */
  /* Backup file                                                         */
  /* ------------------------------------------------------------------ */
  function fileName() { return 'mizan-backup-' + M.today() + '.json'; }
  function makeBlob(password) {
    var p = pack();
    var ready = password ? encrypt(p, password) : Promise.resolve(p);
    return ready.then(function (obj) { return new Blob([JSON.stringify(obj)], { type: 'application/json' }); });
  }
  function markFile() { M.state.settings.backup.lastFileAt = Date.now(); M.save(); }

  function download(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function canShare() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; }
  }

  function saveSheet() {
    var share = canShare();
    M.sheet({
      title: 'Save a backup file',
      body: '<p class="soft">Keep the file somewhere safe that isn’t this phone — Google Drive, iCloud Drive, email or WhatsApp to yourself. You can restore it on any device.</p>' +
        '<label class="switch"><span class="sw-text"><strong>Lock with a password</strong><span>The file is encrypted on this device. Without the password nobody — including you — can open it.</span></span><input type="checkbox" name="lock"></label>' +
        '<div class="field pw-field" hidden><label for="bk-pw">Password</label><input class="input" id="bk-pw" type="password" autocomplete="new-password" minlength="6"><span class="hint">At least 6 characters. Write it down — it can’t be recovered.</span></div>' +
        '<p class="err hidden" id="bk-err" role="alert"></p>',
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button>' + (share ? '<button type="button" class="btn" data-go="share">' + M.icon('upload') + 'Share…</button>' : '') + '<button type="button" class="btn btn-primary" data-go="download">' + M.icon('download') + 'Save file</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        var lock = dlg.querySelector('[name=lock]'), pw = dlg.querySelector('#bk-pw'), err = dlg.querySelector('#bk-err');
        lock.addEventListener('change', function () { dlg.querySelector('.pw-field').hidden = !lock.checked; if (lock.checked) pw.focus(); });
        M.$$('[data-go]', dlg).forEach(function (b) {
          b.addEventListener('click', function () {
            if (lock.checked && pw.value.length < 6) { err.textContent = 'Use a password of at least 6 characters.'; err.classList.remove('hidden'); M.haptic('error'); return; }
            if (lock.checked && !(window.crypto && crypto.subtle)) { err.textContent = 'This browser can’t lock files. Save without a password instead.'; err.classList.remove('hidden'); return; }
            var how = b.getAttribute('data-go');
            makeBlob(lock.checked ? pw.value : null).then(function (blob) {
              if (how === 'share') {
                var file = new File([blob], fileName(), { type: 'application/json' });
                return navigator.share({ files: [file], title: 'Mizan backup' }).then(function () { markFile(); dlg.close(); M.haptic('success'); M.toast('Backup shared'); }, function () { /* cancelled */ });
              }
              download(blob); markFile(); dlg.close(); M.haptic('success'); M.toast('Backup file saved');
            }).catch(function () { err.textContent = 'Couldn’t create the backup.'; err.classList.remove('hidden'); });
          });
        });
      }
    });
  }

  function readFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var obj;
      try { obj = JSON.parse(rd.result); } catch (e) { M.toast('That file isn’t a Mizan backup.'); return; }
      if (obj && obj.enc === 'aes-gcm') return askPassword(obj);
      var data = unwrap(obj);
      if (!data) { M.toast('That file isn’t a Mizan backup.'); return; }
      confirmRestore(data, obj.at);
    };
    rd.readAsText(file);
  }
  function askPassword(obj) {
    M.sheet({
      title: 'Enter the backup password',
      body: '<div class="field"><label for="rs-pw">Password</label><input class="input" id="rs-pw" type="password" autocomplete="current-password"></div><p class="err hidden" id="rs-err" role="alert"></p>',
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-ok>Unlock</button>',
      onOpen: function (dlg) {
        var go = function () {
          decrypt(obj, dlg.querySelector('#rs-pw').value).then(function (inner) {
            var data = unwrap(inner);
            if (!data) throw new Error('bad');
            dlg.close(); confirmRestore(data, obj.at);
          }).catch(function () { var e = dlg.querySelector('#rs-err'); e.textContent = 'Wrong password, or the file is damaged.'; e.classList.remove('hidden'); M.haptic('error'); });
        };
        dlg.querySelector('[data-ok]').addEventListener('click', go);
        dlg.querySelector('#rs-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      }
    });
  }
  function confirmRestore(data, at) {
    var when = at ? ' from ' + new Date(at).toLocaleString() : '';
    if (!hasData()) { apply(data); return; }
    M.confirm('Restore this backup' + when + '?', 'It replaces everything currently in Mizan on this device.', 'Restore').then(function (ok) { if (ok) apply(data); });
  }
  function pickFile() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) readFile(inp.files[0]); });
    inp.click();
  }

  /* ------------------------------------------------------------------ */
  /* Google Drive (appDataFolder)                                         */
  /* ------------------------------------------------------------------ */
  var gisPromise = null, token = null, tokenExp = 0, tokenClient = null, pending = null;
  function cfg() { return M.CONFIG || {}; }
  function driveState() { return M.state.settings.backup.drive; }
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { gisPromise = null; reject(new Error('Couldn’t reach Google. Check your internet connection.')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }
  function tokenValid() { return token && Date.now() < tokenExp - 60000; }
  /* Must be called from a tap (Google opens a small window) */
  function getToken(interactive) {
    if (tokenValid()) return Promise.resolve(token);
    if (!cfg().googleClientId) return Promise.reject(new Error('Google Drive isn’t set up in this copy of Mizan.'));
    if (!window.google || !google.accounts || !google.accounts.oauth2) return Promise.reject(new Error('Google sign-in is still loading. Try again in a moment.'));
    return new Promise(function (resolve, reject) {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: cfg().googleClientId,
          scope: cfg().googleScope || 'https://www.googleapis.com/auth/drive.appdata',
          callback: function (resp) {
            var p = pending; pending = null;
            if (!p) return;
            if (resp && resp.access_token) { token = resp.access_token; tokenExp = Date.now() + (resp.expires_in || 3600) * 1000; p.resolve(token); }
            else p.reject(new Error(resp && resp.error === 'access_denied' ? 'Google access wasn’t allowed.' : 'Google sign-in didn’t finish.'));
          },
          error_callback: function (e) { var p = pending; pending = null; if (p) p.reject(new Error(e && e.type === 'popup_closed' ? 'The Google window was closed.' : 'Google sign-in didn’t finish.')); }
        });
      }
      pending = { resolve: resolve, reject: reject };
      try { tokenClient.requestAccessToken({ prompt: driveState().connected && !interactive ? '' : 'consent' }); }
      catch (e) { pending = null; reject(e); }
    });
  }
  function api(method, url, body, contentType) {
    return getToken().then(function (tk) {
      var headers = { Authorization: 'Bearer ' + tk };
      if (contentType) headers['Content-Type'] = contentType;
      return fetch(url, { method: method, headers: headers, body: body });
    }).then(function (res) {
      if (res.status === 401) { token = null; throw new Error('Your Google sign-in expired. Tap Back up now to sign in again.'); }
      if (!res.ok && res.status !== 204) throw new Error('Google Drive error (' + res.status + ').');
      return res.status === 204 ? null : (method === 'GET' && /alt=media/.test(url) ? res.text() : res.json());
    });
  }
  function findFile() {
    return api('GET', 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&q=' + encodeURIComponent("name='" + FILE + "'")).then(function (r) {
      var f = r && r.files && r.files[0];
      return f || null;
    });
  }
  function upload() {
    var body = JSON.stringify(pack());
    var d = driveState();
    var put = function (id) {
      return api('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media&fields=id,modifiedTime', body, 'application/json');
    };
    var create = function () {
      var bd = 'mizan' + Math.random().toString(36).slice(2);
      var multi = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) +
        '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + body + '\r\n--' + bd + '--';
      return api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', multi, 'multipart/related; boundary=' + bd);
    };
    var go = d.fileId ? put(d.fileId).catch(function (e) { if (/404/.test(e.message)) { d.fileId = null; return create(); } throw e; }) : findFile().then(function (f) { return f ? put(f.id) : create(); });
    return go.then(function (r) {
      d.fileId = r.id; d.lastAt = Date.now(); d.connected = true;
      M.save();
      return r;
    });
  }
  function driveDownload(id) { return api('GET', 'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media').then(function (t) { return JSON.parse(t); }); }

  var autoTimer = null, autoBusy = false;
  function scheduleAuto() {
    var d = driveState();
    if (!d.connected || d.auto === false || !tokenValid() || autoBusy) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (!tokenValid()) return;
      autoBusy = true;
      upload().then(function () { autoBusy = false; }, function () { autoBusy = false; });
    }, 45000);
  }

  var drive = {
    loadGis: loadGis,
    connected: function () { return !!driveState().connected; },
    tokenValid: tokenValid,
    /* from a tap: sign in, then either restore (fresh device) or back up */
    connect: function () {
      return getToken(true).then(function () { return findFile(); }).then(function (f) {
        driveState().connected = true;
        if (f) driveState().fileId = f.id;
        M.save();
        if (f && !hasData()) {
          return M.confirm('Restore from Google Drive?', 'A backup from ' + new Date(f.modifiedTime).toLocaleString() + ' was found. Restore it on this device?', 'Restore').then(function (ok) {
            if (ok) return driveDownload(f.id).then(function (obj) { var data = unwrap(obj); if (data) apply(data); });
            return upload().then(function () { M.toast('Connected — backed up'); });
          });
        }
        return upload().then(function () { M.haptic('success'); M.toast('Connected — backed up to Google Drive'); M.refresh(); });
      });
    },
    backupNow: function () { return upload().then(function () { M.haptic('success'); M.toast('Backed up to Google Drive'); M.refresh(); }); },
    restore: function () {
      return getToken(!driveState().connected).then(findFile).then(function (f) {
        if (!f) { M.toast('No Mizan backup found in this Google Drive.'); return; }
        driveState().connected = true; driveState().fileId = f.id; M.save();
        return driveDownload(f.id).then(function (obj) { var data = unwrap(obj); if (!data) throw new Error('The backup file is damaged.'); confirmRestore(data, obj.at); });
      });
    },
    remove: function () {
      var d = driveState();
      return (d.fileId ? Promise.resolve({ id: d.fileId }) : findFile()).then(function (f) {
        if (!f) return null;
        return api('DELETE', 'https://www.googleapis.com/drive/v3/files/' + f.id);
      }).then(function () { d.fileId = null; d.lastAt = null; M.save(); M.toast('Backup deleted from Google Drive'); M.refresh(); });
    },
    disconnect: function () {
      var d = driveState();
      try { if (token && window.google && google.accounts) google.accounts.oauth2.revoke(token, function () {}); } catch (e) { /* ignore */ }
      token = null; tokenExp = 0;
      d.connected = false; d.fileId = null;
      M.save(); M.toast('Google Drive disconnected'); M.refresh();
    }
  };

  function fail(e) { M.haptic('error'); M.toast(e && e.message ? e.message : 'Something went wrong.'); }

  /* ------------------------------------------------------------------ */
  M.backup = {
    saveSheet: saveSheet,
    pickFile: pickFile,
    readFile: readFile,
    drive: drive,
    fail: fail,
    encrypt: encrypt, decrypt: decrypt, unwrap: unwrap, pack: pack, _apply: apply,
    lastAt: function () {
      var b = M.state.settings.backup;
      return Math.max(b.lastFileAt || 0, (b.drive && b.drive.lastAt) || 0) || null;
    },
    /* A dashboard reminder when there's something worth keeping and no recent backup */
    reminder: function () {
      var b = M.state.settings.backup;
      if (!b.remindDays) return null;
      var last = M.backup.lastAt();
      var age = M.daysBetween(M.state.created || M.today(), M.today());
      if (!last && age < 2) return null;
      var days = last ? Math.floor((Date.now() - last) / 86400000) : null;
      if (last && days < b.remindDays) return null;
      return { level: 'info', icon: 'cloud', text: last ? 'Last backup was ' + days + ' days ago. Back up so a new phone won’t lose anything.' : 'Your data isn’t backed up yet. If this phone is lost or reset, it’s gone.', action: { label: 'Back up', act: 'backup-now' } };
    },
    /* one-tap backup from the dashboard */
    quick: function () {
      if (drive.connected()) drive.backupNow().catch(fail);
      else M.go('settings/data');
    },
    /* Welcome screen: "Restore my data" */
    restoreSheet: function () {
      loadGis().catch(function () {});
      M.sheet({
        title: 'Restore my data',
        body: '<p class="soft">Bring back everything from a backup you made on another phone or computer.</p><ul class="list">' +
          '<li><button type="button" class="row grow restore-opt" data-go="drive">' + M.icon('cloud') + '<span class="li-main"><strong>From Google Drive</strong><span>If you connected Google Drive in Mizan before</span></span></button></li>' +
          '<li><button type="button" class="row grow restore-opt" data-go="file">' + M.icon('upload') + '<span class="li-main"><strong>From a backup file</strong><span>A mizan-backup file you saved</span></span></button></li></ul>',
        foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button>',
        noAutofocus: true,
        onOpen: function (dlg) {
          dlg.querySelector('[data-go=drive]').addEventListener('click', function () { dlg.close(); drive.restore().catch(fail); });
          dlg.querySelector('[data-go=file]').addEventListener('click', function () { dlg.close(); pickFile(); });
        }
      });
    }
  };

  // back up to Drive a little while after changes (only while signed in this session)
  M.afterSave = M.afterSave || [];
  M.afterSave.push(scheduleAuto);
})();
