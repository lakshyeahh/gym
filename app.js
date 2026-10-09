(function () {
'use strict';
var PLAN = window.PLAN || { days: [], exercises: {} };
var KEY = 'gymplan.v1';
function $(s, r) { return (r || document).querySelector(s); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* ---------- storage ---------- */
function load() {
  try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && typeof d === 'object') return { sessions: d.sessions || {}, lastKg: d.lastKg || {} }; } catch (e) {}
  return { sessions: {}, lastKg: {} };
}
var DB = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }

/* ---------- dates ---------- */
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function pd(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }
function today() { return ymd(new Date()); }
function fmtDate(s, o) { return pd(s).toLocaleDateString(undefined, o || { weekday: 'short', day: 'numeric', month: 'short' }); }
function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

var DAYS = (PLAN.days || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
function dayByDate(d) { for (var i = 0; i < DAYS.length; i++) if (DAYS[i].date === d) return DAYS[i]; return null; }
function pickIndex() {
  var t = today(), idx = 0;
  if (!DAYS.length) return -1;
  DAYS.forEach(function (d, j) { if (d.date <= t) idx = j; });
  return idx;
}

/* ---------- plan helpers ---------- */
function exOf(id) { var e = (PLAN.exercises || {})[id] || {}; return { name: e.name || id, equipment: e.equipment || '', target: e.target || '', cues: e.cues || [], backSafety: e.backSafety || '' }; }
function kindOf(reps) {
  var r = String(reps == null ? '' : reps).trim().toLowerCase(), m;
  if ((m = r.match(/^(\d+(?:\.\d+)?)\s*(min|mins|minutes?)\b/))) return { kind: 'timed', sec: Math.round(+m[1] * 60), sides: /side/.test(r) ? 2 : 1 };
  if ((m = r.match(/^(\d+(?:\.\d+)?)\s*(s|secs?|seconds?)\b/))) return { kind: 'timed', sec: Math.round(+m[1]), sides: /side/.test(r) ? 2 : 1 };
  if (/^\d+(\.\d+)?\s*(km|m|mi)\b/.test(r)) return { kind: 'distance' };
  if ((m = r.match(/^(\d+)/))) return { kind: 'reps', n: +m[1] };
  return { kind: 'other' };
}
function flatten(day) {
  var out = [];
  (day.blocks || []).forEach(function (b, bi) {
    (b.items || []).forEach(function (it, ii) {
      out.push({ key: bi + '-' + ii, bi: bi, block: b, item: it, sets: Math.max(1, parseInt(it.sets, 10) || 1), ex: exOf(it.id), k: kindOf(it.reps) });
    });
  });
  return out;
}
function doneOf(it, sess) { return Math.min(it.sets, ((sess && sess.sets && sess.sets[it.key]) || []).length); }
function counts(items, sess) { var d = 0, t = 0; items.forEach(function (it) { t += it.sets; d += doneOf(it, sess); }); return { done: d, total: t }; }
function repsLabel(it) { var r = String(it.item.reps == null ? '' : it.item.reps); return it.k.kind === 'reps' && /^\d+$/.test(r) ? r + ' reps' : r; }
function iconFor(it) {
  var s = (it.ex.name + ' ' + it.ex.equipment + ' ' + it.block.name).toLowerCase();
  if (/treadmill|walk|run|cardio|bike|cycle/.test(s)) return '🏃';
  if (/stretch|cool|pose|yoga|mobility|cat/.test(s)) return '🧘';
  if (/plank|bug|bird|core|crunch|bridge/.test(s)) return '🔥';
  if (/dumbbell|barbell|kettle|db|kb|machine|cable|press|row|squat|deadlift/.test(s)) return '🏋️';
  if (/band/.test(s)) return '🎗️';
  return '💪';
}
function volume(sess) {
  var v = 0; if (!sess) return 0;
  Object.keys(sess.sets || {}).forEach(function (k) { sess.sets[k].forEach(function (s) { var r = parseFloat(s.reps); if (s.kg > 0 && r > 0 && /^\d/.test(String(s.reps)) && !/[sm]/.test(String(s.reps))) v += r * s.kg; }); });
  return Math.round(v);
}
function setCount(sess) { var n = 0; Object.keys((sess && sess.sets) || {}).forEach(function (k) { n += sess.sets[k].length; }); return n; }

/* ---------- audio / vibrate / wake ---------- */
var actx = null;
function unlockAudio() { try { if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {} }
function beep() {
  if (!actx) return;
  try {
    var t0 = actx.currentTime;
    [0, 0.22].forEach(function (d, i) {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g); g.connect(actx.destination); o.start(t0 + d); o.stop(t0 + d + 0.2);
    });
  } catch (e) {}
}
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
var wl = null;
function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wl && document.visibilityState === 'visible') {
      navigator.wakeLock.request('screen').then(function (l) { wl = l; l.addEventListener('release', function () { wl = null; }); }).catch(function () {});
    } else if (!on && wl) { wl.release().catch(function () {}); wl = null; }
  } catch (e) {}
}
function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800); }

/* ---------- ring ---------- */
function ring(size, stroke) {
  var r = (size - stroke) / 2, c = (2 * Math.PI * r).toFixed(2), h = size / 2;
  return '<svg class="ring" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><circle class="ring-bg" cx="' + h + '" cy="' + h + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
    '<circle class="ring-fg" cx="' + h + '" cy="' + h + '" r="' + r + '" stroke-width="' + stroke + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" transform="rotate(-90 ' + h + ' ' + h + ')"/></svg>';
}
function setRing(el, pct) { var fg = el && el.querySelector('.ring-fg'); if (!fg) return; var c = +fg.getAttribute('stroke-dasharray'); fg.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, pct))); }

/* ---------- figures ---------- */
var figs = { home: null, work: null };
function unmount(slot) { if (figs[slot]) { try { figs[slot].destroy(); } catch (e) {} figs[slot] = null; } }
function mount(slot, el, id) {
  unmount(slot);
  if (!el || !window.Figures || typeof window.Figures.mount !== 'function') return;
  el.innerHTML = '';
  try { figs[slot] = window.Figures.mount(el, id) || null; } catch (e) { console.warn('Figure mount failed', id, e); }
}

/* ---------- state ---------- */
var S = { screen: 'home', view: pickIndex(), expanded: null, menu: false, date: null, items: [], pos: 0, reps: 0, kg: '', time: '', figKey: null, lastRing: 0 };
function sess() { return DB.sessions[S.date]; }

/* ---------- screens ---------- */
var ORDER = { home: 0, progress: 1, workout: 2, finish: 3 };
function show(name) {
  var prev = S.screen; if (prev === name) return;
  var dir = ORDER[name] >= ORDER[prev] ? 1 : -1;
  var from = document.getElementById(prev), to = document.getElementById(name);
  to.classList.add('noanim'); to.classList.toggle('left', dir < 0); to.classList.remove('active');
  void to.offsetWidth;
  to.classList.remove('noanim', 'left'); to.classList.add('active');
  from.classList.remove('active'); from.classList.toggle('left', dir > 0);
  S.screen = name;
  $('#tabbar').classList.toggle('hide', name === 'workout' || name === 'finish');
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
  if (prev === 'home') unmount('home');
  if (prev === 'workout') { unmount('work'); S.figKey = null; keepAwake(false); }
  if (name === 'workout') keepAwake(true);
}

/* ---------- HOME ---------- */
function renderHome() {
  unmount('home');
  var sc = $('#home-scroll'), day = DAYS[S.view], t = today();
  if (!day) { sc.innerHTML = '<div class="empty">No plan loaded.</div>'; return; }
  var items = flatten(day), se = DB.sessions[day.date], c = counts(items, se);
  var toTrip = PLAN.tripDate ? daysBetween(t, PLAN.tripDate) : null;
  var trip = toTrip == null ? '' : toTrip > 1 ? toTrip + ' days to Chandigarh ✈️' : toTrip === 1 ? '1 day to Chandigarh ✈️' : toTrip === 0 ? 'Chandigarh today ✈️' : 'Trip time ✈️';
  var ready = t > DAYS[DAYS.length - 1].date;
  var h = '<header class="h-top"><div class="grow"><div class="eyebrow">' + (day.date === t ? 'Today · ' : '') + esc(fmtDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</div>' +
    '<h1>Day ' + esc(day.dayNumber) + '</h1><div class="trip">' + trip + '</div></div>' +
    '<button class="icon-btn" data-act="menu" aria-label="More">⋯</button></header>';
  if (S.menu) h += '<div class="menu"><button data-act="reset">Reset this day</button></div>';
  h += '<div class="strip" id="strip">' + DAYS.map(function (d, i) {
    var s = DB.sessions[d.date], cls = 'chip' + (i === S.view ? ' sel' : '') + (d.date === t ? ' today' : '') + (s && s.finishedAt ? ' done' : '') + (d.type === 'recovery' ? ' rec' : '');
    return '<button class="' + cls + '" data-act="day" data-i="' + i + '"><b>Day ' + esc(d.dayNumber) + '</b><small>' + esc(fmtDate(d.date, { weekday: 'short', day: 'numeric' })) + '</small></button>';
  }).join('') + '</div>';
  var pct = c.total ? c.done / c.total : 0;
  h += '<div class="card hero"><div class="ring-box" id="home-ring">' + ring(104, 10) + '<div class="ring-num"><div>' + c.done + '/' + c.total + '<small>sets</small></div></div></div>' +
    '<div><span class="badge ' + (day.type === 'recovery' ? 'recovery' : '') + '">' + esc(day.type || 'workout') + '</span><h2>' + esc(day.title) + '</h2><p>' + esc(day.focus) + '</p></div></div>';
  if (ready) h += '<div class="card ready">You\'re ready ✨ Have a great trip!</div>';
  if (day.tip) h += '<div class="card tip"><span class="em">💡</span><div>' + esc(day.tip) + '</div></div>';
  (day.blocks || []).forEach(function (b, bi) {
    h += '<div class="block-h"><h3>' + esc(b.name) + '</h3>' + (b.durationMin ? '<span>' + esc(b.durationMin) + ' min</span>' : '') + '</div><ul class="ex-list">';
    items.filter(function (it) { return it.bi === bi; }).forEach(function (it) {
      var dn = doneOf(it, se), done = dn >= it.sets, open = S.expanded === it.key;
      h += '<li class="ex-card' + (done ? ' done' : '') + (open ? ' open' : '') + '"><button class="ex-row" data-act="toggle" data-key="' + it.key + '">' +
        '<div class="ex-icon">' + (done ? '✅' : iconFor(it)) + '</div><div class="ex-main"><div class="ex-name">' + esc(it.ex.name) + '</div>' +
        '<div class="ex-meta">' + it.sets + ' × ' + esc(it.item.reps) + (it.item.restSec ? ' · rest ' + esc(it.item.restSec) + 's' : '') + '</div></div>' +
        '<div class="ex-check">' + (done ? '✓' : dn + '/' + it.sets) + '</div></button>';
      if (open) {
        h += '<div class="ex-detail"><div class="ex-fig" id="home-fig"></div>' + (it.item.note ? '<div class="note">' + esc(it.item.note) + '</div>' : '') +
          (it.ex.cues.length ? '<ol>' + it.ex.cues.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol>' : '') +
          (it.ex.backSafety ? '<div class="safety"><b>🛡️ Protect your back</b>' + esc(it.ex.backSafety) + '</div>' : '') + '</div>';
      }
      h += '</li>';
    });
    h += '</ul>';
  });
  var label = !se || !se.startedAt ? 'Start Workout 💪' : se.finishedAt ? 'View summary 🎉' : 'Resume Workout ▶';
  if (items.length) h += '<div class="cta-wrap"><button class="primary" data-act="start">' + label + '</button></div>';
  sc.innerHTML = h;
  var rb = $('#home-ring'); setRing(rb, S.lastRing);
  requestAnimationFrame(function () { requestAnimationFrame(function () { setRing(rb, pct); S.lastRing = pct; }); });
  var sel = sc.querySelector('.chip.sel'); if (sel) { var st = $('#strip'); st.scrollLeft = sel.offsetLeft - st.clientWidth / 2 + sel.clientWidth / 2; }
  if (S.expanded) { var it = items.filter(function (x) { return x.key === S.expanded; })[0]; if (it) mount('home', $('#home-fig'), it.item.id); }
}

/* ---------- WORKOUT ---------- */
function startWorkout() {
  var day = DAYS[S.view]; if (!day) return;
  var se = DB.sessions[day.date];
  if (se && se.finishedAt) { S.date = day.date; renderFinish(false); show('finish'); return; }
  if (!se || !se.startedAt) { se = DB.sessions[day.date] = { startedAt: Date.now(), finishedAt: null, sets: {}, pos: 0 }; save(); }
  openWorkout(day.date);
}
function openWorkout(date) {
  S.date = date; S.items = flatten(dayByDate(date));
  var se = sess(); S.pos = Math.min(se.pos || 0, S.items.length - 1);
  if (se.pos == null) S.pos = firstIncomplete(0);
  prepItem(); renderWorkout(); show('workout'); tick();
  if (se.ov && se.ov.endsAt > Date.now()) renderOverlay(); else if (se.ov) { delete se.ov; save(); }
}
function cur() { return S.items[S.pos]; }
function firstIncomplete(from) {
  var se = sess(), n = S.items.length;
  for (var j = 0; j < n; j++) { var i = (from + j) % n; if (doneOf(S.items[i], se) < S.items[i].sets) return i; }
  return -1;
}
function prepItem() {
  var it = cur(); if (!it) return;
  var se = sess(), arr = se.sets[it.key] || [], last = arr[arr.length - 1];
  S.reps = it.k.kind === 'reps' ? it.k.n : 0;
  var kg = last && last.kg ? last.kg : DB.lastKg[it.item.id];
  S.kg = kg ? String(kg) : ''; S.time = '';
  se.pos = S.pos; save();
}
function go(i) {
  if (i < 0 || i >= S.items.length) return;
  S.pos = i; prepItem(); renderWorkout(); $('#w-scroll').scrollTop = 0;
}
function renderWorkout() {
  var it = cur(); if (!it) return;
  var se = sess(), arr = se.sets[it.key] || [], dn = Math.min(arr.length, it.sets), complete = dn >= it.sets;
  if (S.figKey !== it.key) { mount('work', $('#w-fig'), it.item.id); S.figKey = it.key; }
  $('#w-block').textContent = it.block.name + ' · ' + (S.pos + 1) + '/' + S.items.length;
  var setN = Math.min(dn + 1, it.sets), h = '';
  h += '<div class="w-name">' + esc(it.ex.name) + '</div><div class="w-sub">' + esc([it.ex.equipment, it.ex.target].filter(Boolean).join(' · ')) + '</div>';
  h += '<div class="w-setline">' + (complete ? 'All ' + it.sets + ' sets done ✓' : 'Set ' + setN + ' of ' + it.sets + ' · <b>' + esc(repsLabel(it)) + '</b>') + '</div>';
  h += '<div class="dots">';
  for (var i = 0; i < it.sets; i++) h += '<span class="dot' + (i < dn ? ' on' : '') + (i === dn && !complete ? ' cur' : '') + '"></span>';
  if (dn) h += '<button class="undo" data-act="undo">↩︎ Undo set</button>';
  h += '</div>';
  if (it.item.note) h += '<div class="note">📝 ' + esc(it.item.note) + '</div>';
  if (!complete) {
    if (it.k.kind === 'reps') {
      var lk = DB.lastKg[it.item.id];
      h += '<div class="ctl-row"><div class="ctl"><label>Reps done</label><div class="stepper"><button data-act="reps-" aria-label="Fewer reps">−</button><output id="reps-out">' + S.reps + '</output><button data-act="reps+" aria-label="More reps">+</button></div><small></small></div>' +
        '<div class="ctl"><label>Weight (kg) · optional</label><div class="stepper"><button data-act="kg-" aria-label="Less weight">−</button><input id="kg-in" inputmode="decimal" placeholder="–" value="' + esc(S.kg) + '"><button data-act="kg+" aria-label="More weight">+</button></div><small>' + (lk ? 'last time: ' + esc(lk) + ' kg' : '') + '</small></div></div>';
    } else if (it.k.kind === 'timed') {
      h += '<button class="timer-btn" data-act="work">▶ Start ' + esc(it.item.reps) + ' timer</button>';
    } else if (it.k.kind === 'distance') {
      h += '<div class="ctl-row"><div class="ctl"><label>Time taken (optional, mm:ss)</label><div class="stepper"><input id="time-in" inputmode="numeric" placeholder="e.g. 9:30" value="' + esc(S.time) + '"></div></div></div>';
    }
  }
  if (it.ex.cues.length) h += '<details class="howto"><summary>How to do it</summary><ol>' + it.ex.cues.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol></details>';
  if (it.ex.backSafety) h += '<div class="safety"><b>🛡️ Protect your back</b>' + esc(it.ex.backSafety) + '</div>';
  var nx = S.items[S.pos + 1];
  if (nx) h += '<div class="w-next muted">Up next: ' + esc(nx.ex.name) + ' · ' + nx.sets + ' × ' + esc(nx.item.reps) + '</div>';
  $('#w-body').innerHTML = h;
  var allDone = firstIncomplete(0) === -1;
  var main = allDone ? '<button class="primary big" data-act="finish">Finish 🎉</button>' :
    complete ? '<button class="primary big" data-act="next">Next exercise →</button>' :
    '<button class="primary big" data-act="set">✓ ' + (it.k.kind === 'distance' ? 'Done' : 'Set done') + '</button>';
  $('#w-actions').innerHTML = '<button class="nav-btn" data-act="prev" aria-label="Previous exercise"' + (S.pos === 0 ? ' disabled' : '') + '>‹</button>' + main +
    '<button class="nav-btn" data-act="next" aria-label="Next exercise"' + (S.pos >= S.items.length - 1 ? ' disabled' : '') + '>›</button>';
  updateTop();
}
function updateTop() {
  var se = sess(); if (!se) return;
  var el = Date.now() - se.startedAt, c = counts(S.items, se);
  $('#w-elapsed').textContent = mmss(el);
  $('#w-bar').style.width = Math.min(100, el / 36000) + '%';
  $('.w-top').classList.toggle('over', el >= 3600000);
  $('#w-pct').textContent = (c.total ? Math.round(c.done / c.total * 100) : 0) + '%';
}
function celebrate() {
  var b = $('#w-actions .primary'); if (b) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  buzz(30);
  if (RM.matches) return;
  var layer = $('#burst'), words = ['💪', '+1', '🔥', 'Nice!'];
  for (var i = 0; i < 3; i++) {
    var s = document.createElement('div'); s.className = 'burst'; s.textContent = words[(Math.random() * words.length) | 0];
    s.style.setProperty('--dx', ((i - 1) * 70) + 'px'); s.style.animationDelay = (i * 0.08) + 's';
    layer.appendChild(s); setTimeout(s.remove.bind(s), 1300);
  }
}
function recordSet(extra) {
  var it = cur(), se = sess(); if (!it || !se) return;
  var arr = se.sets[it.key] = se.sets[it.key] || [];
  if (arr.length >= it.sets) return;
  var kg = parseFloat(String(S.kg).replace(',', '.'));
  var rec = { reps: it.k.kind === 'reps' ? S.reps : String(it.item.reps), kg: kg > 0 ? kg : null, at: Date.now() };
  if (it.k.kind === 'distance' && S.time) rec.time = S.time;
  arr.push(rec);
  if (kg > 0) DB.lastKg[it.item.id] = kg;
  save(); celebrate();
  var nextIdx = firstIncomplete(S.pos);
  if (nextIdx === -1) { renderWorkout(); setTimeout(function () { finishWorkout(); }, 700); return; }
  var exDone = arr.length >= it.sets, rest = parseInt(it.item.restSec, 10) || 0;
  renderWorkout();
  if (rest > 0) startOverlay('rest', rest, exDone ? nextIdx : null);
  else if (exDone) setTimeout(function () { go(nextIdx); }, 450);
}
function undoSet() {
  var it = cur(), se = sess(), arr = se.sets[it.key];
  if (arr && arr.length) { arr.pop(); save(); renderWorkout(); toast('Last set removed'); }
}

/* overlay: rest + work timers (persisted in session.ov so a reload resumes them) */
function startOverlay(type, sec, advanceTo) {
  var se = sess(); se.ov = { type: type, total: sec * 1000, endsAt: Date.now() + sec * 1000, advanceTo: advanceTo == null ? null : advanceTo }; save();
  renderOverlay();
}
function renderOverlay() {
  var se = sess(), ov = se && se.ov, el = $('#overlay');
  if (!ov) { el.hidden = true; el.innerHTML = ''; return; }
  var it = cur(), nextTxt;
  if (ov.type === 'rest') {
    if (ov.advanceTo != null) { var n = S.items[ov.advanceTo]; nextTxt = 'Up next: ' + esc(n.ex.name) + ' · ' + n.sets + ' × ' + esc(n.item.reps); }
    else nextTxt = 'Up next: Set ' + (doneOf(it, se) + 1) + ' of ' + it.sets + ' · ' + esc(repsLabel(it));
  } else nextTxt = esc(it.ex.name) + ' · Set ' + (doneOf(it, se) + 1) + ' of ' + it.sets;
  el.className = 'overlay ' + ov.type; el.hidden = false;
  el.innerHTML = '<div class="ov-card"><div class="ov-label">' + (ov.type === 'rest' ? 'Rest · breathe' : ov.sides > 1 ? 'Side ' + (ov.side || 1) + ' of ' + ov.sides : 'Go! Hold strong') + '</div>' +
    '<div class="ring-box" id="ov-ring" style="display:inline-block">' + ring(240, 14) + '<div class="ring-num" id="ov-num">' + mmss(ov.endsAt - Date.now() + 999) + '</div></div>' +
    '<div class="ov-next">' + nextTxt + '</div><div class="ov-btns">' +
    (ov.type === 'rest' ? '<button class="ghost" data-act="ov-add">+15s</button><button class="primary" data-act="ov-skip">Skip</button>'
      : '<button class="ghost" data-act="ov-cancel">Cancel</button><button class="primary" data-act="ov-skip">Done ✓</button>') + '</div></div>';
  setRing($('#ov-ring'), 1); updateOverlay();
}
function updateOverlay() {
  var se = sess(), ov = se && se.ov; if (!ov) return;
  var left = ov.endsAt - Date.now();
  if (left <= 0) { endOverlay(true); return; }
  if (ov.type === 'work' && ov.sides > 1) {
    var side = Math.min(ov.sides, Math.floor((ov.total - left) / (ov.total / ov.sides)) + 1);
    if (side !== (ov.side || 1)) { ov.side = side; save(); beep(); buzz(150); var lb = $('#overlay .ov-label'); if (lb) lb.textContent = 'Switch! Side ' + side + ' of ' + ov.sides; }
  }
  var n = $('#ov-num'); if (n) n.textContent = mmss(left + 999);
  setRing($('#ov-ring'), left / ov.total);
}
function endOverlay(natural) {
  var se = sess(), ov = se && se.ov; if (!ov) return;
  delete se.ov; save(); $('#overlay').hidden = true; $('#overlay').innerHTML = '';
  if (natural) { beep(); buzz([200, 100, 200]); }
  if (ov.type === 'work') { recordSet(); return; }
  if (ov.advanceTo != null) go(ov.advanceTo);
}
function finishWorkout() {
  var se = sess(); if (!se) return;
  delete se.ov; $('#overlay').hidden = true;
  se.finishedAt = se.finishedAt || Date.now(); save();
  renderFinish(true); show('finish');
}

/* ---------- FINISH ---------- */
function renderFinish(party) {
  var se = sess(), day = dayByDate(S.date), last = DAYS.length && S.date === DAYS[DAYS.length - 1].date;
  var dur = se && se.finishedAt ? se.finishedAt - se.startedAt : 0, items = flatten(day), c = counts(items, se);
  $('#finish-scroll').innerHTML = '<div class="fin"><div class="big-em">🎉</div><h1>Day ' + esc(day.dayNumber) + ' done!</h1><p class="muted">' + esc(day.title) + '</p>' +
    '<div class="stats"><div class="stat"><b>' + Math.round(dur / 60000) + '</b><span>' + (Math.round(dur / 60000) === 1 ? 'minute' : 'minutes') + '</span></div><div class="stat"><b>' + c.done + '<small class="muted">/' + c.total + '</small></b><span>sets</span></div><div class="stat"><b>' + volume(se) + '</b><span>kg volume</span></div></div>' +
    '<div class="card tip"><span class="em">' + (last ? '✈️' : '🌙') + '</span><div>' + (last ? 'That\'s the plan done. Enjoy Chandigarh!' : 'Stretch, hydrate, sleep well. See you tomorrow!') + '</div></div>' +
    '<button class="primary" data-act="home" style="margin-top:12px">' + (last ? 'Done ✨' : 'See you tomorrow 👋') + '</button>' +
    '<button class="secondary" data-act="tab" data-tab="progress" style="margin-top:10px">View progress</button></div>';
  var cf = $('#confetti'); cf.innerHTML = '';
  if (!party || RM.matches) return;
  var cols = ['#7CFFB2', '#8AB4FF', '#FFB86B', '#ff8ad8', '#fff'];
  for (var i = 0; i < 70; i++) {
    var p = document.createElement('i');
    p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length];
    p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
    p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's'; p.style.animationDelay = (Math.random() * 0.6) + 's';
    cf.appendChild(p);
  }
  setTimeout(function () { cf.innerHTML = ''; }, 5000);
}

/* ---------- PROGRESS ---------- */
function streak() {
  var d = new Date(), n = 0, s = DB.sessions;
  if (!(s[ymd(d)] && s[ymd(d)].finishedAt)) d.setDate(d.getDate() - 1);
  while (s[ymd(d)] && s[ymd(d)].finishedAt) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function renderProgress() {
  var dates = Object.keys(DB.sessions).filter(function (k) { return DB.sessions[k].finishedAt; }).sort().reverse();
  var totalSets = 0, totalVol = 0; dates.forEach(function (k) { totalSets += setCount(DB.sessions[k]); totalVol += volume(DB.sessions[k]); });
  var h = '<h1>Progress</h1><div class="stats"><div class="stat"><b>' + streak() + '🔥</b><span>day streak</span></div><div class="stat"><b>' + dates.length + '<small class="muted">/' + DAYS.length + '</small></b><span>days done</span></div><div class="stat"><b>' + totalSets + '</b><span>sets</span></div></div>';
  if (!dates.length) h += '<div class="empty">No finished sessions yet.<br>Your first one is waiting 💪</div>';
  else h += '<ul class="hist">' + dates.map(function (k) {
    var se = DB.sessions[k], d = dayByDate(k);
    return '<li><div class="d">' + (d ? esc(d.dayNumber) : '·') + '</div><div class="m"><b>' + esc(d ? d.title : k) + '</b><span>' + esc(fmtDate(k)) + ' · ' + Math.round((se.finishedAt - se.startedAt) / 60000) + ' min · ' + setCount(se) + ' sets' + (volume(se) ? ' · ' + volume(se) + ' kg' : '') + '</span></div><span>✅</span></li>';
  }).join('') + '</ul>';
  if (totalVol) h += '<p class="muted" style="text-align:center">Total volume lifted: ' + totalVol + ' kg</p>';
  $('#progress-scroll').innerHTML = h;
}

/* ---------- events ---------- */
function act(a, el) {
  var it;
  switch (a) {
    case 'tab':
      if (el.dataset.tab === 'progress') { renderProgress(); show('progress'); } else { renderHome(); show('home'); }
      break;
    case 'home': S.view = pickIndex(); renderHome(); show('home'); break;
    case 'day': S.view = +el.dataset.i; S.expanded = null; S.menu = false; S.lastRing = 0; renderHome(); break;
    case 'toggle': S.expanded = S.expanded === el.dataset.key ? null : el.dataset.key; renderHome(); break;
    case 'menu': S.menu = !S.menu; renderHome(); break;
    case 'reset':
      S.menu = false;
      if (confirm('Reset all logged sets for Day ' + DAYS[S.view].dayNumber + '? This can\'t be undone.')) { delete DB.sessions[DAYS[S.view].date]; save(); toast('Day reset'); S.lastRing = 0; }
      renderHome(); break;
    case 'start': startWorkout(); break;
    case 'exit': renderHome(); show('home'); break;
    case 'prev': go(S.pos - 1); break;
    case 'next': go(S.pos + 1 < S.items.length ? S.pos + 1 : S.pos); break;
    case 'set': recordSet(); break;
    case 'undo': undoSet(); break;
    case 'reps-': S.reps = Math.max(0, S.reps - 1); $('#reps-out').textContent = S.reps; break;
    case 'reps+': S.reps = S.reps + 1; $('#reps-out').textContent = S.reps; break;
    case 'kg-': case 'kg+':
      var v = parseFloat(String(S.kg).replace(',', '.')) || 0, step = v < 10 ? 1 : 2.5;
      v = a === 'kg+' ? v + step : Math.max(0, v - step); S.kg = v ? String(Math.round(v * 10) / 10) : ''; $('#kg-in').value = S.kg; break;
    case 'work': it = cur(); startOverlay('work', it.k.sec * it.k.sides, null); sess().ov.sides = it.k.sides; sess().ov.side = 1; save(); renderOverlay(); break;
    case 'ov-add': var se = sess(); if (se.ov) { se.ov.endsAt += 15000; se.ov.total += 15000; save(); updateOverlay(); } break;
    case 'ov-skip': endOverlay(false); break;
    case 'ov-cancel': delete sess().ov; save(); renderOverlay(); break;
    case 'finish':
      var c = counts(S.items, sess());
      if (c.done < c.total && !confirm('Finish now? ' + c.done + ' of ' + c.total + ' sets done.')) break;
      finishWorkout(); break;
  }
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (S.menu && (!el || (el.dataset.act !== 'menu' && el.dataset.act !== 'reset'))) { S.menu = false; if (S.screen === 'home') renderHome(); }
  if (!el || el.disabled) return;
  act(el.dataset.act, el);
});
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('input', function (e) {
  if (e.target.id === 'kg-in') S.kg = e.target.value;
  if (e.target.id === 'time-in') S.time = e.target.value;
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && S.screen === 'workout') { keepAwake(true); tick(); }
});
function tick() { if (S.screen === 'workout' && sess()) { updateTop(); updateOverlay(); } }
setInterval(tick, 250);

/* ---------- boot ---------- */
renderHome();
(function resume() {
  var now = Date.now(), best = null;
  Object.keys(DB.sessions).forEach(function (k) {
    var s = DB.sessions[k];
    if (s.startedAt && !s.finishedAt && now - s.startedAt < 12 * 3600000 && dayByDate(k) && (!best || s.startedAt > DB.sessions[best].startedAt)) best = k;
  });
  if (best) { S.view = DAYS.indexOf(dayByDate(best)); renderHome(); openWorkout(best); }
})();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
