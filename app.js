/* My Gym Buddy — a no-tracking, tap-through exercise catalog.
 * Reads window.PLAN (plan.js) and window.Figures (figures.js). Remembers nothing. */
(function () {
'use strict';
var PLAN = window.PLAN || { days: [], exercises: {} };
var EXS = PLAN.exercises || {};
var DAYS = (PLAN.days || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
var NAME = 'Lakshya';
var COL = { p: '#A45CFF', k: '#0B0B0F', g: '#D4FF3A' };

function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

/* ---------- dates ---------- */
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function pd(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
function daysBetween(a, b) { return Math.round((pd(b) - pd(a)) / 86400000); }
function fmt(s, o) { return pd(s).toLocaleDateString('en-GB', o || { weekday: 'short', day: 'numeric', month: 'short' }); }
var TODAY = ymd(new Date());

/* Today's plan day: exact match, else the next one up (rest day), clamped to first/last. */
function pickToday() {
  if (!DAYS.length) return { i: -1, exact: false };
  for (var i = 0; i < DAYS.length; i++) {
    if (DAYS[i].date === TODAY) return { i: i, exact: true };
    if (DAYS[i].date > TODAY) return { i: i, exact: false };
  }
  return { i: DAYS.length - 1, exact: false };
}
var T = pickToday();

/* ---------- exercise helpers ---------- */
function exOf(id) {
  var e = EXS[id] || {};
  return { id: id, name: e.name || String(id).replace(/_/g, ' '), equipment: e.equipment || '', target: e.target || '', cues: e.cues || [], backSafety: e.backSafety || '' };
}
var GROUPS = [
  { key: 'Back', emoji: '🦅' }, { key: 'Chest', emoji: '🛡️' }, { key: 'Shoulders', emoji: '🏋️' },
  { key: 'Arms', emoji: '💪' }, { key: 'Core', emoji: '🔥' }, { key: 'Cardio', emoji: '🏃' },
  { key: 'Legs', emoji: '🦵' }, { key: 'Stretch', emoji: '🧘' }
];
var GEMOJI = {}; GROUPS.forEach(function (g) { GEMOJI[g.key] = g.emoji; });
function groupOf(id) {
  var e = exOf(id), s = String(id).toLowerCase(), t = e.target.toLowerCase();
  if (/treadmill|walk|bike|cycle|elliptical|rower|stair|cardio|jog/.test(s) || /cardio/.test(t)) return 'Cardio';
  if (/stretch|pose|cat_cow|mobility|foam|open_book|thread/.test(s) || /relaxation|mobility/.test(t)) return 'Stretch';
  if (/plank|dead_bug|bird_dog|pallof|curl_up|crunch|carry|hollow|ab_/.test(s) || /^(deep )?core|abs|oblique/.test(t)) return 'Core';
  if (/leg_|squat|calf|lunge|hip_abd|hip_add|glute|deadlift|step_up/.test(s) || /^(quads|hamstr|calves|glutes|side glutes)/.test(t)) return 'Legs';
  if (/reverse_pec|rear_delt/.test(s)) return 'Shoulders';
  if (/curl|tricep|bicep|pushdown|hammer|skull|kickback|dip|wrist/.test(s) || /^(biceps|triceps|forearm)/.test(t)) return 'Arms';
  if (/chest|fly|pec|push_?up|bench/.test(s) || /^chest/.test(t)) return 'Chest';
  if (/shoulder|lateral_raise|face_pull|rear_delt|front_raise|shrug|y_raise/.test(s) || /^(rear )?shoulder|delt/.test(t)) return 'Shoulders';
  if (/row|pulldown|pull|lat_|back_ext/.test(s) || /back|lats/.test(t)) return 'Back';
  return 'Core';
}
function emojiOf(id) { return GEMOJI[groupOf(id)] || '⚡'; }
function blockEmoji(name) {
  var n = String(name).toLowerCase();
  if (/tread|walk|cardio/.test(n)) return '🏃';
  if (/warm/.test(n)) return '🔥';
  if (/main|strength|build/.test(n)) return '💪';
  if (/finish/.test(n)) return '⚡';
  if (/cool|stretch|mobility/.test(n)) return '🧘';
  return '⭐';
}

/* "3 SETS × 12 REPS" pieces from plan sets/reps strings like "12", "6/side", "30s/side", "7 min", "1 km". */
function dose(item) {
  var sets = Math.max(1, parseInt(item.sets, 10) || 1);
  var raw = String(item.reps == null ? '' : item.reps).trim();
  var m = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/), amount, unit;
  if (m) {
    amount = m[1];
    var rest = m[2].toLowerCase(), side = /(\/|per|each)\s*(side|leg|arm)/.test(rest);
    var core = rest.replace(/\/?\s*(per|each)?\s*(side|leg|arm)s?/, '').trim();
    if (!core) unit = 'REPS';
    else if (/^(s|sec|secs|seconds?)$/.test(core)) unit = 'SEC';
    else if (/^(min|mins|minutes?)$/.test(core)) unit = 'MIN';
    else if (/^slow$/.test(core)) unit = 'SLOW REPS';
    else unit = core.toUpperCase();
    if (side) unit += ' / SIDE';
  } else { amount = raw.toUpperCase() || '—'; unit = ''; }
  return { sets: sets, amount: amount, unit: unit, short: (sets > 1 ? sets + ' × ' : '') + (raw || '—') };
}

/* Highlight one key word of a title with the green marker. */
function mk(text, which) {
  var t = String(text || ''), paren = '', m = t.match(/^(.*?)(\s*\(.*\))$/);
  if (m) { t = m[1]; paren = m[2]; }
  var words = t.split(' ');
  var i = which === 'first' ? 0 : words.length - 1;
  words[i] = '<span class="mk">' + esc(words[i]) + '</span>';
  return words.map(function (w, j) { return j === i ? w : esc(w); }).join(' ') + esc(paren);
}

function flatten(day) {
  var out = [];
  (day && day.blocks || []).forEach(function (b, bi) {
    (b.items || []).forEach(function (it) { out.push({ block: b, bi: bi, item: it, ex: exOf(it.id) }); });
  });
  return out;
}
function dayMinutes(day) {
  var m = (day.blocks || []).reduce(function (s, b) { return s + (+b.durationMin || 0); }, 0);
  return m > 0 ? m : 60;
}
function heroItem(day) {
  var bs = day.blocks || [];
  for (var i = 0; i < bs.length; i++) if (/main/i.test(bs[i].name) && bs[i].items && bs[i].items.length) return bs[i].items[0];
  var f = flatten(day); return f.length ? f[0].item : null;
}
function figOpts(i) {
  return i % 2 ? { stage: 'dark', shirt: COL.p, accent: COL.g } : { stage: 'purple', shirt: COL.g, accent: COL.k };
}

/* ---------- figures: every mount is tracked so nothing animates off-screen ---------- */
function mountFig(el, id, opts) {
  if (!window.Figures || !el) return null;
  try { return window.Figures.mount(el, id, opts || {}); } catch (e) { console.warn('figure', id, e); return null; }
}
function kill(h) { if (h) try { h.destroy(); } catch (e) {} }
var heroFig = null;

/* ---------- screens ---------- */
var current = 'home', saved = {};
function show(name) {
  if (current === name) return;
  var leaving = current;
  var sc = $('#' + leaving + ' .scroll'); if (sc) saved[leaving] = sc.scrollTop;
  if (leaving === 'home') { kill(heroFig); heroFig = null; }
  if (leaving === 'player') stopPlayer();
  if (leaving === 'library') stopLibrary();
  if (leaving === 'done') $('#confetti').innerHTML = '';
  $('#' + leaving).classList.remove('active');
  $('#' + name).classList.add('active');
  current = name;
}

/* ---------- HOME ---------- */
var sel = T.i;
function renderHome(keepScroll) {
  var root = $('#home-scroll');
  var top = root.scrollTop, stripLeft = $('.strip', root) ? $('.strip', root).scrollLeft : null;
  kill(heroFig); heroFig = null;
  if (!DAYS.length) { root.innerHTML = '<div class="hello"><div class="h1">No plan loaded</div></div>'; return; }
  var d = DAYS[sel], isToday = sel === T.i;
  var flat = flatten(d), trip = PLAN.tripDate ? daysBetween(TODAY, PLAN.tripDate) : null;
  var label = isToday ? (T.exact ? 'Today\'s <span class="mk">workout</span>' : 'Next <span class="mk">workout</span>')
                      : esc(fmt(d.date, { weekday: 'long' })) + ' <span class="mk">preview</span>';
  var h = '';
  h += '<div class="hello pop"><div class="h1">Let\'s go,<br><span class="mk">' + NAME + '</span> <span class="wiggle">💪</span></div></div>';
  h += '<div class="h-meta pop" style="--i:1"><span class="chip dark">DAY ' + esc(DAYS[T.i].dayNumber) + '</span>' +
       '<span class="chip">' + esc(fmt(TODAY, { weekday: 'short', day: 'numeric', month: 'short' })) + (T.exact ? '' : ' · rest day') + '</span>' +
       (trip != null ? '<span class="chip green">' + (trip > 0 ? '✈️ ' + trip + ' day' + (trip === 1 ? '' : 's') + ' to Chandigarh' : '✈️ Chandigarh time!') + '</span>' : '') + '</div>';
  var hi = heroItem(d);
  h += '<button class="hero pop" style="--i:2" data-act="list" data-day="' + sel + '">' +
       '<div class="h1 hero-label">' + label + '</div>' +
       '<div class="hero-stage"><div class="fig" id="hero-fig"></div>' +
       (hi ? '<span class="chip dark now">▶ ' + esc(exOf(hi.id).name) + '</span>' : '') + '</div>' +
       '<h2 class="h2">' + esc(d.title) + '</h2>' +
       '<p>' + esc(d.focus || '') + '</p>' +
       '<div class="hero-stats"><span class="chip">⏱ ' + dayMinutes(d) + ' min</span><span class="chip">' + flat.length + ' exercises</span><span class="chip">Day ' + esc(d.dayNumber) + '</span></div>' +
       '<div class="btn hero-go">Open workout ▶</div></button>';

  h += '<div class="sec-h pop" style="--i:3"><div class="h3">Coming <span class="mk">up</span></div><span class="eyebrow">tap to preview</span></div><div class="strip">';
  DAYS.forEach(function (x, i) {
    if (x.date < DAYS[T.i].date && i !== sel) return; // past days stay out of the way
    h += '<button class="daychip press' + (i === sel ? ' sel' : '') + '" data-act="day" data-i="' + i + '">' +
         '<div class="dc-wd">' + esc(fmt(x.date, { weekday: 'short' })) + ' · D' + esc(x.dayNumber) + '</div>' +
         '<div class="dc-num">' + pd(x.date).getDate() + '</div>' +
         '<div class="dc-t">' + esc(String(x.title || '').split(/\s[—–-]\s/)[0]) + '</div>' +
         (i === T.i ? '<span class="dc-today">' + (T.exact ? 'TODAY' : 'NEXT') + '</span>' : '') + '</button>';
  });
  h += '</div>';
  if (d.tip) h += '<div class="card tip pop" style="--i:4"><span class="sticker">💡 COACH TIP</span><p>' + esc(d.tip) + '</p></div>';
  h += '<button class="card dark lib-entry press pop" style="--i:5" data-act="library"><span class="tile">📚</span>' +
       '<span class="t"><span class="h3" style="color:#fff">Exercise <span class="mk">library</span></span><small>' + Object.keys(EXS).length + ' moves · perfect form for each</small></span><span class="arrow">›</span></button>';
  root.innerHTML = h;
  if (hi) heroFig = mountFig($('#hero-fig'), hi.id, figOpts(0));
  if (keepScroll) { root.scrollTop = top; if (stripLeft != null) $('.strip', root).scrollLeft = stripLeft; }
  else { centerChip(false); root.scrollTop = 0; }
}

function centerChip(smooth) {
  var st = $('#home .strip'), c = $('#home .daychip.sel'); if (!st || !c) return;
  var x = Math.max(0, c.offsetLeft - (st.clientWidth - c.offsetWidth) / 2);
  if (smooth && !RM.matches && st.scrollTo) st.scrollTo({ left: x, behavior: 'smooth' }); else st.scrollLeft = x;
}

/* ---------- LIST ---------- */
var listDay = null;
function renderList(dayIdx) {
  listDay = dayIdx;
  var d = DAYS[dayIdx], flat = flatten(d), root = $('#list-scroll'), h = '', n = 0;
  h += '<div class="topbar"><button class="back-btn press" data-act="home" aria-label="Back">‹</button><span class="eyebrow">Day ' + esc(d.dayNumber) + ' · ' + esc(fmt(d.date)) + '</span></div>';
  h += '<div class="list-head pop"><div class="h1">' + mk(d.title, 'first') + '</div><p>' + esc(d.focus || '') + '</p>' +
       '<div class="h-meta"><span class="chip dark">⏱ ' + dayMinutes(d) + ' min</span><span class="chip">' + flat.length + ' exercises</span></div></div>';
  (d.blocks || []).forEach(function (b, bi) {
    h += '<div class="block-h pop" style="--i:' + Math.min(n, 10) + '"><span class="bidx">' + (bi + 1) + '</span><span class="h2 bn">' + blockEmoji(b.name) + ' <span class="mk">' + esc(b.name) + '</span></span>' +
         (b.durationMin ? '<span class="chip dark bm">' + esc(b.durationMin) + ' min</span>' : '') + '</div>';
    (b.items || []).forEach(function (it) {
      var e = exOf(it.id), dz = dose(it), k = n++;
      h += '<button class="card ex-card press pop' + (bi % 2 ? ' dark' : '') + '" style="--i:' + Math.min(k + 1, 12) + '" data-act="play" data-k="' + k + '">' +
           '<span class="ex-tile">' + emojiOf(it.id) + '</span><span class="ex-mid"><div class="ex-name">' + esc(e.name) + '</div><div class="ex-eq">' + esc(e.equipment) + '</div></span>' +
           '<span class="ex-sr">' + esc(dz.short) + '</span></button>';
    });
  });
  root.innerHTML = h;
  root.scrollTop = 0;
  $('#list-dock').innerHTML = '<button class="btn press" data-act="start">Start workout ▶</button>';
}

/* ---------- PLAYER ---------- */
var P = { mode: 'workout', list: [], i: 0, off: 0, card: null, fig: null, dying: [] };
function stopPlayer() {
  kill(P.fig); P.fig = null;
  P.dying.forEach(function (x) { kill(x.fig); if (x.el.parentNode) x.el.parentNode.removeChild(x.el); clearTimeout(x.t); });
  P.dying = [];
  $('#p-viewport').innerHTML = ''; P.card = null;
}
function openPlayer(mode, list, i, colourOffset) {
  P.mode = mode; P.list = list; P.i = i; P.off = colourOffset || 0; // library cards keep their stage colour
  show('player'); stopPlayer();
  paintPlayer(0);
}
function cardHtml(entry, i) {
  var e = entry.ex, it = entry.item, o = figOpts(i + P.off), h = '';
  h += '<div class="stage ' + o.stage + '"><div class="fig"></div>' + '<span class="chip ' + (o.stage === 'dark' ? 'green' : 'dark') + ' tag">' + emojiOf(e.id) + ' ' + esc(groupOf(e.id)) + '</span></div>';
  h += '<h1 class="p-name">' + mk(e.name) + '</h1>';
  if (it) {
    var dz = dose(it);
    h += '<div class="badge"><span class="cell"><b>' + dz.sets + '</b><small>SET' + (dz.sets === 1 ? '' : 'S') + '</small></span><span class="x">×</span>' +
         '<span class="cell"><b>' + esc(dz.amount) + '</b><small>' + esc(dz.unit) + '</small></span></div>';
  }
  h += '<div class="p-chips">' + (e.equipment ? '<span class="chip dark">🏋️ ' + esc(e.equipment) + '</span>' : '') + (e.target ? '<span class="chip">🎯 ' + esc(e.target) + '</span>' : '') + '</div>';
  if (e.cues.length) h += '<section class="card dark cues"><div class="h3">Perfect <span class="mk">form</span></div><ol>' + e.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ol></section>';
  if (it && it.note) h += '<div class="note"><b>Today:</b> ' + esc(it.note) + '</div>';
  if (e.backSafety) h += '<div class="card backsafe"><div class="h3">🛡️ Protect your back</div><p>' + esc(e.backSafety) + '</p></div>';
  if (P.mode === 'workout' && i === 0) h += '<div class="swipe-hint">Swipe or tap NEXT when you\'re done ›</div>';
  return h;
}
function paintPlayer(dir) {
  var entry = P.list[P.i], vp = $('#p-viewport'), wk = P.mode === 'workout';
  // top bar
  var top = '<button class="back-btn press" data-act="close" aria-label="Close">✕</button>';
  if (wk) top += '<span class="p-count">' + (P.i + 1) + ' / ' + P.list.length + '</span><span class="chip dark p-block">' + blockEmoji(entry.block.name) + ' ' + esc(entry.block.name) + '</span>';
  else top += '<span class="p-count">Form guide</span>';
  $('#p-top').innerHTML = top;
  var bar = $('#p-bar');
  if (wk) {
    if (!bar) { bar = document.createElement('div'); bar.className = 'p-bar'; bar.id = 'p-bar'; $('#p-top').after(bar); }
    bar.innerHTML = P.list.map(function (_, j) { return '<i class="' + (j < P.i ? 'on' : j === P.i ? 'cur' : '') + '"></i>'; }).join('');
  } else if (bar) bar.remove();

  // card swap with slide; the outgoing card's figure is destroyed when it leaves
  var old = P.card, oldFig = P.fig;
  var el = document.createElement('div');
  el.className = 'p-card' + (dir > 0 ? ' in-r' : dir < 0 ? ' in-l' : '');
  el.innerHTML = cardHtml(entry, P.i);
  vp.appendChild(el);
  P.card = el;
  P.fig = mountFig($('.fig', el), entry.ex.id, figOpts(P.i + P.off));
  if (old) {
    if (RM.matches || !dir) { kill(oldFig); old.remove(); }
    else {
      old.classList.add(dir > 0 ? 'out-l' : 'out-r');
      var x = { el: old, fig: oldFig };
      x.t = setTimeout(function () { kill(x.fig); x.el.remove(); P.dying.splice(P.dying.indexOf(x), 1); }, 320);
      P.dying.push(x);
    }
  }
  // dock
  var last = P.i === P.list.length - 1;
  $('#p-dock').innerHTML = wk
    ? '<button class="btn ghost press prev" data-act="prev"' + (P.i === 0 ? ' disabled' : '') + '>◀ Prev</button>' +
      '<button class="btn press next" data-act="next">' + (last ? 'Finish 🎉' : 'Next ▶') + '</button>'
    : '<button class="btn press next" data-act="close">◀ Back to library</button>';
}
function go(delta) {
  if (current !== 'player' || P.mode !== 'workout') return;
  var n = P.i + delta;
  if (n < 0) return;
  if (n >= P.list.length) { renderDone(); return; }
  P.i = n; paintPlayer(delta);
}

/* swipe */
(function () {
  var sx = 0, sy = 0, on = false;
  var vp = $('#p-viewport');
  vp.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
  vp.addEventListener('touchend', function (e) {
    if (!on) return; on = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : (P.i > 0 ? -1 : 0));
  }, { passive: true });
})();

/* ---------- DONE ---------- */
function renderDone() {
  var d = DAYS[listDay], next = DAYS[listDay + 1], trip = PLAN.tripDate ? daysBetween(TODAY, PLAN.tripDate) : null;
  show('done');
  var h = '<div><span class="trophy">🏆</span></div>' +
    '<div class="h1 done-title pop">Workout <span class="mk">crushed!</span></div>' +
    '<p class="done-sub pop" style="--i:1">Day ' + esc(d.dayNumber) + ' done, ' + NAME + '. See you tomorrow 👊' + (trip > 0 ? '<br>' + trip + ' day' + (trip === 1 ? '' : 's') + ' to Chandigarh ✈️' : '') + '</p>';
  if (next) h += '<div class="card dark done-next pop" style="--i:2"><div class="eyebrow">Up next · ' + esc(fmt(next.date)) + '</div><div class="h3">' + esc(next.title) + '</div></div>';
  h += '<div class="done-btns pop" style="--i:3"><button class="btn press" data-act="home">Back home 🏠</button></div>';
  $('#done-scroll').innerHTML = h;
  $('#done-scroll').scrollTop = 0;
  if (!RM.matches) {
    var cf = '', cols = [COL.g, COL.k, '#fff', COL.g];
    for (var i = 0; i < 46; i++) {
      cf += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[i % cols.length] + ';animation-duration:' + (2.6 + Math.random() * 2.4).toFixed(2) + 's;animation-delay:-' + (Math.random() * 4).toFixed(2) + 's;transform:rotate(' + (Math.random() * 360 | 0) + 'deg)"></i>';
    }
    $('#confetti').innerHTML = cf;
  }
}

/* ---------- LIBRARY ---------- */
var libIO = null, libFigs = new Map(), libBuilt = false;
function libEntries() {
  var by = {};
  Object.keys(EXS).forEach(function (id) { var g = groupOf(id); (by[g] = by[g] || []).push(id); });
  return by;
}
function renderLibrary() {
  var root = $('#library-scroll'), by = libEntries(), h = '', n = 0;
  h += '<div class="topbar"><button class="back-btn press" data-act="home" aria-label="Back">‹</button><span class="eyebrow">' + Object.keys(EXS).length + ' moves</span></div>';
  h += '<div class="lib-head pop"><div class="h1">Exercise <span class="mk">library</span></div><p>Every move in your plan, with perfect form. Tap one to see it in action.</p></div>';
  GROUPS.forEach(function (g) {
    var ids = by[g.key]; if (!ids || !ids.length) return;
    h += '<div class="grp-h"><span class="h2">' + g.emoji + ' <span class="mk">' + g.key + '</span></span><span class="chip dark n">' + ids.length + '</span></div><div class="grid">';
    ids.forEach(function (id) {
      var e = exOf(id), o = figOpts(n), k = n++;
      h += '<button class="card lib-card press' + (o.stage === 'dark' ? ' dark' : '') + '" data-act="lib-ex" data-id="' + esc(id) + '" data-n="' + k + '">' +
           '<div class="stage ' + o.stage + '"><div class="fig" data-id="' + esc(id) + '" data-n="' + k + '"></div></div>' +
           '<div class="ln">' + esc(e.name) + '</div><div class="le">' + esc(e.equipment) + '</div></button>';
    });
    h += '</div>';
  });
  root.innerHTML = h;
  libBuilt = true;
}
function startLibrary() {
  if (!libBuilt) renderLibrary();
  var root = $('#library-scroll');
  if ('IntersectionObserver' in window) {
    libIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting && !libFigs.has(el)) libFigs.set(el, mountFig(el, el.dataset.id, figOpts(+el.dataset.n)));
        else if (!en.isIntersecting && libFigs.has(el)) { kill(libFigs.get(el)); libFigs.delete(el); }
      });
    }, { root: root, rootMargin: '120px 0px' });
    $$('.fig', root).forEach(function (el) { libIO.observe(el); });
  }
}
function stopLibrary() {
  if (libIO) libIO.disconnect(); libIO = null;
  libFigs.forEach(function (h) { kill(h); }); libFigs.clear();
}
function openLibrary() {
  show('library');
  var sc = $('#library-scroll');
  if (!libBuilt) { renderLibrary(); sc.scrollTop = 0; } else sc.scrollTop = saved.library || 0;
  startLibrary();
}

/* ---------- actions ---------- */
var fromLib = false;
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  var a = b.dataset.act;
  if (a === 'home') { show('home'); renderHome(false); }
  else if (a === 'day') { sel = +b.dataset.i; renderHome(true); centerChip(true); }
  else if (a === 'list') { renderList(+b.dataset.day); show('list'); }
  else if (a === 'start') { fromLib = false; openPlayer('workout', flatten(DAYS[listDay]), 0); }
  else if (a === 'play') { fromLib = false; openPlayer('workout', flatten(DAYS[listDay]), +b.dataset.k); }
  else if (a === 'next') go(1);
  else if (a === 'prev') go(-1);
  else if (a === 'close') {
    if (fromLib) openLibrary();
    else { show('list'); $('#list-scroll').scrollTop = saved.list || 0; }
  }
  else if (a === 'library') { saved.library = 0; openLibrary(); }
  else if (a === 'lib-ex') { fromLib = true; openPlayer('single', [{ block: null, item: null, ex: exOf(b.dataset.id) }], 0, +b.dataset.n); }
});
document.addEventListener('keydown', function (e) {
  if (current !== 'player') return;
  if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') $('[data-act=close]').click();
});

renderHome(false);
window.__app = { show: show, P: P, DAYS: DAYS, T: T, groupOf: groupOf };
})();
