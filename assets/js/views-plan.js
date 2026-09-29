/* Mizan — Plan (routine editor) */
(function () {
  'use strict';
  var M = (window.M = window.M || {});
  var U = M.ui;
  var selected = null;

  function current() {
    var rs = M.state.routines;
    if (!rs.length) return null;
    var r = rs.filter(function (x) { return x.id === selected; })[0];
    if (!r) { r = M.calc.routineFor(M.today()) || rs[0]; selected = r.id; }
    return r;
  }

  function daysLabel(days) {
    if (!days.length) return 'Not used on any day yet';
    if (days.length === 7) return 'Every day';
    var order = [1, 2, 3, 4, 5, 6, 0];
    return order.filter(function (d) { return days.indexOf(d) >= 0; }).map(function (d) { return M.DAY_SHORT[d]; }).join(', ');
  }

  function routineSheet(r, isNew) {
    var others = M.state.routines.filter(function (x) { return x.id !== r.id; });
    var order = [1, 2, 3, 4, 5, 6, 0];
    var body = '<form class="stack" novalidate>' +
      '<div class="field"><label for="rt-name">Name</label><input class="input" id="rt-name" name="name" maxlength="40" value="' + M.esc(r.name) + '" autofocus></div>' +
      '<div class="field"><span class="label">Use this routine on</span><div class="choice-row">' +
      order.map(function (d) {
        var owner = others.filter(function (o) { return o.days.indexOf(d) >= 0; })[0];
        return '<label class="choice"><input type="checkbox" data-multi name="days" value="' + d + '"' + (r.days.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + M.DAY_SHORT[d] + '</span></label>';
      }).join('') + '</div><span class="hint">Each day of the week follows one routine. Picking a day here takes it from any other routine.</span></div>' +
      '</form>';
    var foot = (isNew || others.length === 0 ? '' : '<button type="button" class="btn btn-danger" data-del>' + M.icon('trash') + 'Delete</button>') +
      (isNew ? '' : '<button type="button" class="btn" data-dup>' + M.icon('copy') + 'Duplicate</button>') +
      '<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save</button>';
    M.sheet({
      title: isNew ? 'New routine' : 'Routine settings', body: body, foot: foot,
      onOpen: function (dlg) {
        dlg.querySelector('[data-save]').addEventListener('click', function () {
          var d = M.formData(dlg.querySelector('form'));
          r.name = (d.name || '').trim() || 'Routine';
          var days = (d.days || []).map(Number);
          r.days = days;
          others.forEach(function (o) { o.days = o.days.filter(function (x) { return days.indexOf(x) < 0; }); });
          if (isNew) M.state.routines.push(r);
          selected = r.id;
          M.save(); dlg.close('ok'); M.haptic('success'); M.flashAfterRender('.pg-head'); M.refresh();
        });
        var del = dlg.querySelector('[data-del]');
        if (del) del.addEventListener('click', function () {
          dlg.close();
          M.confirm('Delete “' + r.name + '”?', 'Its blocks will be removed. Days it covered will fall back to your first routine.', 'Delete', true).then(function (ok) {
            if (!ok) return;
            M.state.routines = M.state.routines.filter(function (x) { return x.id !== r.id; });
            selected = null; M.save(); M.refresh();
          });
        });
        var dup = dlg.querySelector('[data-dup]');
        if (dup) dup.addEventListener('click', function () {
          var c = M.deepClone(r);
          c.id = M.uid(); c.name = r.name + ' (copy)'; c.days = [];
          c.blocks.forEach(function (b) { b.id = M.uid(); });
          M.state.routines.push(c); selected = c.id; M.save(); dlg.close(); M.refresh();
          M.toast('Copied. Pick which days it’s for in Routine settings.');
        });
      }
    });
  }

  M.openTemplates = function () { templateSheet(); };
  function templateSheet() {
    var body = '<p class="soft">Pick a starting point. You can change every block afterwards.</p><div class="choice-grid" role="radiogroup">' +
      M.TEMPLATE_LIST.map(function (t, i) {
        return '<label class="choice block"><input type="radio" name="tpl" value="' + t.id + '"' + (i === 0 ? ' checked' : '') + '><span><strong>' + M.esc(t.name) + '</strong></span><small>' + M.esc(t.desc) + '</small></label>';
      }).join('') + '</div>' + U.note('warn', '<p>This replaces all your current routines and their blocks. Check-ins you already made stay in your history.</p>');
    M.sheet({
      title: 'Start from a template', body: '<form>' + body + '</form>', wide: true,
      foot: '<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-use>Use template</button>',
      noAutofocus: true,
      onOpen: function (dlg) {
        dlg.querySelector('[data-use]').addEventListener('click', function () {
          var id = M.formData(dlg.querySelector('form')).tpl;
          M.state.routines = M.templates.make(id);
          selected = null; M.save(); dlg.close(); M.haptic('success'); M.flashAfterRender('.pg-head'); M.refresh();
          M.toast('Template applied');
        });
      }
    });
  }

  M.views.plan = {
    head: function () { return { title: 'Plan', sub: 'A realistic day, with room to breathe' }; },
    render: function (el) {
      var r = current();
      if (!r) {
        el.innerHTML = '<div class="empty">' + M.icon('plan') + '<p><strong>No routines yet.</strong></p><div class="btn-row" style="justify-content:center"><button type="button" class="btn btn-primary" data-action="custom">' + M.icon('chat') + 'Build it step by step</button><button type="button" class="btn" data-action="templates">Start from a template</button></div></div>';
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-action="templates"]')) templateSheet();
          if (e.target.closest('[data-action="custom"]') && M.assistant) M.assistant.startBuilder();
        });
        return;
      }
      var k = M.today();
      var an = M.calc.analyzeRoutine(r, M.state.profile, k);
      var res = an.resolved;

      var tabs = '<div class="seg" role="tablist" aria-label="Routines">' + M.state.routines.map(function (x) {
        return '<button type="button" role="tab" aria-selected="' + (x.id === r.id) + '" data-action="pick" data-id="' + M.esc(x.id) + '">' + M.esc(x.name) + '</button>';
      }).join('') + '</div><button type="button" class="icon-btn" data-action="new-routine" aria-label="New routine" title="New routine">' + M.icon('plus') + '</button>';
      tabs = '<div class="row" style="gap:6px">' + tabs + '</div>';

      var isTodays = (M.calc.routineFor(k) || {}).id === r.id;
      var strip = U.dayStrip(res, { now: isTodays ? M.nowMin() : null, date: k });

      // category totals as the legend (sorted by time spent)
      var legend = '<div class="ds-legend">' + M.CATS.filter(function (c) { return an.totals[c.id]; }).sort(function (a, b) { return an.totals[b.id] - an.totals[a.id]; }).map(function (c) {
        return '<span style="--cat:' + M.catVar(c.id) + '"><i aria-hidden="true"></i>' + M.esc(c.label) + ' <em>' + M.fmtDurShort(an.totals[c.id]) + '</em></span>';
      }).join('') + '</div>';

      // block list: agenda rows, with gaps & overlaps between them
      var list = '<ul class="block-list">';
      res.forEach(function (x) {
        var c = M.cat(x.b.cat);
        list += '<li class="block-item" data-row="' + M.esc(x.b.id) + '" style="--cat:' + M.catVar(x.b.cat) + '">' +
          '<span class="b-time">' + M.fmtTime(x.start, false) + '<small>' + (M.state.settings.clock === '12' ? (x.start < 720 ? 'am' : 'pm') + ' · ' : '') + M.fmtDurShort(x.dur) + '</small></span>' +
          '<span class="b-bar" aria-hidden="true"></span>' +
          '<button type="button" class="b-main" data-action="edit" data-id="' + M.esc(x.b.id) + '" aria-label="Edit ' + M.esc(x.b.title) + ', ' + M.fmtTime(x.start) + ' to ' + M.fmtTime(x.end) + '"><strong>' + M.esc(x.b.title) + '</strong>' +
          '<span class="b-meta"><span class="row">' + M.icon(c.icon) + M.esc(c.label) + '</span><span class="num b-until">until ' + M.fmtTime(x.end) + '</span>' +
          (x.b.anchor ? '<span class="badge accent">' + M.icon('sun') + (x.anchored ? 'Follows ' : 'Set to follow ') + M.esc(M.sun.anchorLabel(x.b.anchor.to)) + (x.b.anchor.offset ? ' +' + x.b.anchor.offset + ' min' : '') + '</span>' : '') + '</span></button>' +
          '<span class="b-actions"><button type="button" class="icon-btn sm" data-action="edit" data-id="' + M.esc(x.b.id) + '" aria-label="Edit ' + M.esc(x.b.title) + '">' + M.icon('edit') + '</button></span></li>';
        var gap = an.gaps.filter(function (g) { return g.after === x; })[0];
        var ov = an.overlaps.filter(function (o) { return o.a === x; })[0];
        if (gap) list += '<li class="gap-row">' + M.icon('clock') + '<span class="grow">' + M.fmtDur(gap.min) + ' unplanned from ' + M.fmtTime(gap.at) + '</span><button type="button" class="btn btn-sm btn-ghost" data-action="fill" data-at="' + gap.at + '" data-min="' + gap.min + '">' + M.icon('plus') + 'Fill</button></li>';
        if (ov) list += '<li class="gap-row overlap" role="note">' + M.icon('alert') + '<span>“' + M.esc(ov.a.b.title) + '” and “' + M.esc(ov.b.b.title) + '” overlap by ' + M.fmtDur(ov.min) + '</span></li>';
      });
      list += '</ul>';

      var nBad = an.checks.filter(function (c) { return c.level === 'bad'; }).length;
      var nWarn = an.checks.filter(function (c) { return c.level === 'warn'; }).length;
      var nOk = an.checks.filter(function (c) { return c.level === 'ok'; }).length;
      var checks = '<ul class="checks">' + an.checks.map(function (c) {
        return '<li class="' + c.level + '">' + M.icon(c.level === 'ok' ? 'good' : 'alert') + '<span>' + M.esc(c.text) + '</span></li>';
      }).join('') + '</ul>';
      var checkSum = '<span class="check-sum">' + (nBad ? '<span class="badge bad">' + nBad + ' to fix</span>' : '') + (nWarn ? '<span class="badge warn">' + nWarn + ' ' + M.plural(nWarn, 'tip') + '</span>' : '') + (nOk ? '<span class="badge good">' + nOk + ' good</span>' : '') + '</span>';

      el.innerHTML =
        '<div class="row between wrap seg-wrap">' + tabs + '<div class="btn-row no-print"><button type="button" class="btn btn-sm" data-action="custom">' + M.icon('chat') + 'Build step by step</button><button type="button" class="btn btn-sm" data-action="templates">' + M.icon('copy') + 'Templates</button><button type="button" class="btn btn-sm" data-action="print">' + M.icon('print') + 'Print</button></div></div>' +
        '<div class="plan-grid">' +
        '<section class="panel pg-head" aria-labelledby="pg-title"><div class="panel-title"><div><h3 id="pg-title">' + M.esc(r.name) + '</h3><p class="ds-sub">' + daysLabel(r.days) + ' · tap a block to edit</p></div><button type="button" class="btn btn-sm" data-action="routine-settings">' + M.icon('settings') + 'Settings</button></div>' + strip + legend + '</section>' +
        '<details class="panel pg-checks"' + (nBad || nWarn ? ' open' : '') + '><summary><h3>Plan check</h3><span class="row" style="gap:8px">' + checkSum + M.icon('right', 'class="chev"') + '</span></summary>' + checks + '</details>' +
        '<section class="panel pg-blocks" aria-labelledby="pg-blocks-h"><div class="section-head" style="margin-top:0"><div><h2 id="pg-blocks-h">Blocks</h2><p>' + res.length + ' blocks · ' + M.fmtDur(an.total > 1440 ? 1440 : an.total) + ' planned</p></div><button type="button" class="btn btn-primary" data-action="add">' + M.icon('plus') + 'Add block</button></div>' +
        list + '</section>' +
        '</div>';
      U.fitStrip(el);

      /* After an edit: re-draw, then highlight the block in both the strip and the list so the change is obvious */
      var after = function (b, what) {
        if (b && what !== 'deleted') M.flashAfterRender('[data-seg="' + b.id + '"], [data-row="' + b.id + '"]');
        else M.flashAfterRender('.pg-head');
        M.refresh();
      };
      el.addEventListener('click', function (e) {
        var a = e.target.closest('[data-action]');
        if (!a) return;
        var act = a.getAttribute('data-action');
        if (act === 'pick') { selected = a.getAttribute('data-id'); M.render(true); }
        else if (act === 'add') U.editBlock(r, null, after);
        else if (act === 'edit') {
          var b = r.blocks.filter(function (x) { return x.id === a.getAttribute('data-id'); })[0];
          if (b) U.editBlock(r, b, after);
        } else if (act === 'fill') {
          var at = +a.getAttribute('data-at'), mins = +a.getAttribute('data-min');
          U.editBlock(r, null, after, { start: M.fromMin(at), end: M.fromMin(at + Math.min(mins, 60)) });
        } else if (act === 'templates') templateSheet();
        else if (act === 'custom') { if (M.assistant) M.assistant.startBuilder(); }
        else if (act === 'print') window.print();
        else if (act === 'routine-settings') routineSheet(r, false);
        else if (act === 'new-routine') {
          var nr = M.deepClone(r);
          nr.id = M.uid(); nr.name = 'New routine'; nr.days = [];
          nr.blocks.forEach(function (b2) { b2.id = M.uid(); });
          routineSheet(nr, true);
        }
      });
    }
  };
})();
