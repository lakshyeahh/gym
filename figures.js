/* figures.js — animated exercise figures (plain browser JS, offline, no deps).
 * API: window.Figures = { ids, mount(container, exerciseId) -> { destroy() } }
 *
 * Rig: side-view 2D skeleton. Every bone is placed by forward kinematics
 * (angle + fixed length) or two-bone IK (law of cosines), so bone lengths
 * never change. Coordinates: viewBox 0 0 320 240, y down, angles in degrees
 * (0 = right, 90 = down, -90 = up). Figures face right unless noted.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FL = 212; // floor line y

  var C = {
    body: '#E8EAED', bodyFar: '#A3A9B3', acc: '#7CFFB2', accFar: '#4DBF86',
    steel: '#5b6270', steel2: '#8a93a3', pad: '#363c48', padHi: '#444b59',
    dark: '#262b33', floor: '#2a2f38', eye: '#0f1115', mat: '#232a33'
  };
  var L = { torso: 52, neck: 18, head: 12, ua: 32, fa: 30, th: 44, sh: 42, ft: 15 };
  var W = { torso: 24, neck: 10, th: 15, sh: 12, ft: 8, ua: 12, fa: 10, hand: 5.5 };

  /* ---------------- math ---------------- */
  function rad(a) { return a * Math.PI / 180; }
  function dir(a) { a = rad(a); return [Math.cos(a), Math.sin(a)]; }
  function add(p, a, len) { var d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; }
  function ang(p, q) { return Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { return 0.5 - 0.5 * Math.cos(Math.PI * u); }
  function f(n) { return Math.round(n * 10) / 10; }

  // Two-bone IK. bend: -1 = knee-style (for a right-facing body), +1 = elbow-style.
  function ik(root, target, l1, l2, bend) {
    var dx = target[0] - root[0], dy = target[1] - root[1];
    var d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
    d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.01, d));
    var c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    c = Math.max(-1, Math.min(1, c));
    var m = a + bend * Math.acos(c);
    return [[root[0] + l1 * Math.cos(m), root[1] + l1 * Math.sin(m)],
            [root[0] + d * Math.cos(a), root[1] + d * Math.sin(a)]];
  }

  // Envelope 0..1: rise (eased), hold at 1, fall (eased), hold at 0. ws = weights.
  function env(ph, ws) {
    var s = ws[0] + ws[1] + ws[2] + ws[3], x = ph * s;
    if (x < ws[0]) return ease(x / ws[0]); x -= ws[0];
    if (x < ws[1]) return 1; x -= ws[1];
    if (x < ws[2]) return 1 - ease(x / ws[2]);
    return 0;
  }

  function lerpPose(a, b, u) {
    var o = {}, k;
    for (k in a) o[k] = (b[k] != null && typeof a[k] === 'number') ? lerp(a[k], b[k], u) : a[k];
    for (k in b) if (o[k] == null) o[k] = b[k];
    return o;
  }

  /* ---------------- svg primitives ---------------- */
  function ln(a, b, w, col, extra) {
    return '<line x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(b[0]) + '" y2="' + f(b[1]) +
      '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || '') + '/>';
  }
  function cir(p, r, fill, extra) {
    return '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function ring(p, r, col, w) { return cir(p, r, 'none', ' stroke="' + col + '" stroke-width="' + w + '"'); }
  function rect(x, y, w, h, rx, fill, extra) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + rx + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function steel(a, b, w) { return ln(a, b, w || 6, C.steel); }
  function steel2(a, b, w) { return ln(a, b, w || 4, C.steel2); }
  function pad(a, b, w) { w = w || 12; return ln(a, b, w, C.pad) + ln(a, b, Math.max(2, w - 7), C.padHi); }
  function cable(a, b) { return ln(a, b, 2, C.steel2, ' opacity="0.9"'); }
  function pulley(p) { return cir(p, 6, C.dark) + ring(p, 6, C.steel2, 2.5) + cir(p, 1.6, C.steel2); }
  function shadow(cx, rx) {
    return '<ellipse cx="' + cx + '" cy="' + (FL + 1) + '" rx="' + rx + '" ry="5" fill="#000" opacity="0.35"/>';
  }
  function mat(x1, x2) { return rect(x1, FL - 3, x2 - x1, 4, 2, C.mat) + ln([x1 + 2, FL - 3], [x2 - 2, FL - 3], 1, '#3a4452'); }

  // Pad parallel to the torso, offset to the back side.
  function backPad(J, off, below, above, w) {
    var t = J.P.t, b = t - 90;
    var a = add(add(J.H, t, -(below || 0)), b, off);
    var c = add(add(J.S, t, above || 0), b, off);
    return pad(a, c, w || 12);
  }
  // Weight stack tower; lift (px) raises the selected plates.
  function stack(x, y, w, lift) {
    var s = rect(x, y, w, FL - y, 4, 'none', ' stroke="' + C.steel + '" stroke-width="5"');
    s += steel2([x + 7, y + 6], [x + 7, FL - 4], 2) + steel2([x + w - 7, y + 6], [x + w - 7, FL - 4], 2);
    var i, py = FL - 8;
    for (i = 0; i < 3; i++) { s += rect(x + 4, py - 6, w - 8, 6, 1.5, C.steel); py -= 7; }
    lift = Math.max(0, lift || 0);
    for (i = 0; i < 4; i++) { s += rect(x + 4, py - 6 - lift, w - 8, 6, 1.5, i === 0 ? C.steel2 : C.steel); py -= 7; }
    s += steel2([x + w / 2, py - lift], [x + w / 2, y + 4], 2);
    return s;
  }

  /* ---------------- rig ---------------- */
  function limbPrefix(P, pre, near) {
    return (P[pre + 'T'] != null || P[pre + 'x'] != null || P[pre + 'U'] != null) ? pre : near;
  }

  function solve(P, fdx) {
    var H = [P.hx, P.hy], S = add(H, P.t, L.torso), Hd = add(S, P.n, L.neck);
    var J = { P: P, H: H, S: S, Hd: Hd };
    var us = P.us == null ? 1 : P.us, fs = P.fs == null ? 1 : P.fs;

    function leg(pre, dx) {
      var k = limbPrefix(P, pre, 'ln'), root = [H[0] + dx, H[1]], knee, an;
      if (P[k + 'T'] != null) { knee = add(root, P[k + 'T'], L.th); an = add(knee, P[k + 'S'], L.sh); }
      else {
        var r = ik(root, [P[k + 'x'] + dx, P[k + 'y']], L.th, L.sh, P[k + 'b'] == null ? -1 : P[k + 'b']);
        knee = r[0]; an = r[1];
      }
      var fa = P[k + 'f'] != null ? P[k + 'f'] : (P.lnf != null && k !== 'ln' ? P.lnf : ang(knee, an) - 90);
      return { r: root, k: knee, a: an, t: add(an, fa, L.ft) };
    }
    function arm(pre, dx) {
      var k = limbPrefix(P, pre, 'an'), root = [S[0] + dx, S[1]], el, wr;
      if (P[k + 'U'] != null) { el = add(root, P[k + 'U'], L.ua * us); wr = add(el, P[k + 'L'], L.fa * fs); }
      else {
        var r = ik(root, [P[k + 'x'] + dx, P[k + 'y']], L.ua * us, L.fa * fs, P[k + 'b'] == null ? 1 : P[k + 'b']);
        el = r[0]; wr = r[1];
      }
      return { r: root, e: el, w: wr };
    }
    J.lN = leg('ln', 0); J.lF = leg('lf', fdx);
    J.aN = arm('an', 0); J.aF = arm('af', fdx);
    return J;
  }

  var GROUPS = {
    legs: ['thighN', 'shinN', 'thighF', 'shinF'], thighs: ['thighN', 'thighF'], calves: ['shinN', 'shinF'],
    arms: ['uaN', 'faN', 'uaF', 'faF'], upperarms: ['uaN', 'uaF'], core: ['torso']
  };
  function hiSet(list) {
    var o = {};
    (list || []).forEach(function (n) { (GROUPS[n] || [n]).forEach(function (p) { o[p] = true; }); });
    return o;
  }

  function drawFig(J, hi, mid, pre) {
    function col(part, far) { return hi[part] ? (far ? C.accFar : C.acc) : (far ? C.bodyFar : C.body); }
    function seg(a, b, w, part, far) {
      return (hi[part] ? ln(a, b, w + 9, C.acc, ' opacity="0.14"') : '') + ln(a, b, w, col(part, far));
    }
    function leg(l, far, sfx) {
      return seg(l.r, l.k, W.th, 'thigh' + sfx, far) + seg(l.k, l.a, W.sh, 'shin' + sfx, far) +
        ln(l.a, l.t, W.ft, col('shin' + sfx, far));
    }
    function arm(a, far, sfx) {
      return seg(a.r, a.e, W.ua, 'ua' + sfx, far) + seg(a.e, a.w, W.fa, 'fa' + sfx, far) +
        cir(a.w, W.hand, col('fa' + sfx, far));
    }
    var P = J.P, s = '';
    s += arm(J.aF, 1, 'F') + leg(J.lF, 1, 'F');
    s += mid || '';
    // torso with optional spine curve (sb > 0 arches belly-side)
    var m = [(J.H[0] + J.S[0]) / 2, (J.H[1] + J.S[1]) / 2], cp = add(m, P.t + 90, P.sb || 0);
    var d = 'M' + f(J.H[0]) + ' ' + f(J.H[1]) + 'Q' + f(cp[0]) + ' ' + f(cp[1]) + ' ' + f(J.S[0]) + ' ' + f(J.S[1]);
    if (hi.torso) s += '<path d="' + d + '" fill="none" stroke="' + C.acc + '" stroke-width="' + (W.torso + 9) + '" stroke-linecap="round" opacity="0.14"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + col('torso') + '" stroke-width="' + W.torso + '" stroke-linecap="round"/>';
    // neck + head + eye
    s += ln(J.S, add(J.S, P.n, L.neck - 4), W.neck, C.body);
    s += cir(J.Hd, L.head, C.body);
    s += cir(add(add(J.Hd, P.n + 90, 6), P.n, 1.5), 1.8, C.eye);
    s += leg(J.lN, 0, 'N');
    s += pre || '';
    s += arm(J.aN, 0, 'N');
    return s;
  }

  /* ---------------- shared poses / gait ---------------- */
  function gait(ph, o) {
    var th = ph * 2 * Math.PI, cx = o.hx + 6;
    var P = { hx: o.hx, hy: o.hy - o.bob * Math.cos(2 * th), t: o.t, sb: 0, n: o.n || -86 };
    function foot(a) {
      var x = cx + o.A * Math.cos(a), s = Math.sin(a);
      return [x, o.ground(x) - (s < 0 ? o.lift * -s : 0)];
    }
    var a = foot(th), b = foot(th + Math.PI), c = Math.cos(th);
    P.lnx = a[0]; P.lny = a[1]; P.lfx = b[0]; P.lfy = b[1];
    P.anU = 90 + o.sw * c; P.anL = P.anU - o.fb;
    P.afU = 90 - o.sw * c; P.afL = P.afU - o.fb;
    return P;
  }

  /* ---------------- equipment ---------------- */
  function treadmill(t, incl, speed) {
    var cx = 160, by = 198, s = '';
    var tf = incl ? ' transform="rotate(' + (-incl) + ' ' + cx + ' ' + by + ')"' : '';
    var front = incl ? [cx + 104 * Math.cos(rad(incl)), by - 104 * Math.sin(rad(incl))] : [264, by];
    var off = ((speed * t) % 22).toFixed(1);
    if (incl) s += steel([front[0] - 4, front[1] + 8], [front[0] - 10, FL - 2], 7);
    else s += rect(66, by + 9, 14, 5, 2, C.steel) + rect(244, by + 9, 14, 5, 2, C.steel);
    s += '<g' + tf + '>' + rect(54, by, 214, 12, 6, C.steel) +
      ln([60, by + 1.5], [262, by + 1.5], 3, C.dark) +
      '<line x1="60" y1="' + (by + 1.5) + '" x2="262" y2="' + (by + 1.5) + '" stroke="' + C.steel2 +
      '" stroke-width="2" stroke-dasharray="9 13" stroke-dashoffset="' + off + '" opacity="0.7"/>' +
      cir([62, by + 6], 4, C.steel2) + cir([260, by + 6], 4, C.steel2) + '</g>';
    var top = [front[0] - 14, 104];
    s += steel([front[0] - 2, front[1]], top, 8);
    s += '<g transform="rotate(-20 ' + f(top[0]) + ' ' + f(top[1]) + ')">' + rect(top[0] - 16, top[1] - 8, 34, 12, 3, C.steel2) +
      rect(top[0] - 11, top[1] - 5, 20, 5, 1.5, '#1e2a26') + '</g>';
    s += steel2([top[0] - 4, 128], [196, 130], 5) + steel2([198, 130], [198, 140], 4);
    return s;
  }

  function bikeFrame(J, c) {
    var C0 = [168, 182], s = '';
    s += steel([100, FL - 4], [150, FL - 4], 7) + steel([186, FL - 4], [246, FL - 4], 7);
    s += steel([126, FL - 4], [148, 178], 7) + steel([148, 178], [140, 134], 7);
    s += steel([148, 178], C0, 7) + steel(C0, [214, 178], 6);
    s += steel([216, FL - 4], [202, 108], 8);
    s += cir([214, 178], 22, C.dark) + ring([214, 178], 22, C.steel2, 4) + cir([214, 178], 4, C.steel2);
    s += steel([202, 108], [212, 102], 6) + cir([212, 102], 4, C.steel2);
    s += pad([128, 133], [151, 133], 9);
    var pn = add(C0, c.ph * 360, 17);
    s += cir(C0, 7, C.steel) + steel2(C0, pn, 5) + ln([pn[0] - 6, pn[1]], [pn[0] + 6, pn[1]], 5, C.steel2);
    return s;
  }
  function bikeFarCrank(c) {
    var C0 = [168, 182], pf = add(C0, c.ph * 360 + 180, 17);
    return ln(C0, pf, 5, C.steel) + ln([pf[0] - 6, pf[1]], [pf[0] + 6, pf[1]], 5, C.steel);
  }

  function seatedBase(x1, x2, y, post) {
    return steel([post, y], [post, FL - 4], 7) + steel([post - 30, FL - 3], [post + 30, FL - 3], 6) + pad([x1, y], [x2, y], 11);
  }

  /* ---------------- exercises ---------------- */
  var EX = {};
  function def(id, o) { o.hi = hiSet(o.hi); EX[id] = o; }

  // all-fours base: knees under hips, hands under shoulders
  var QUAD = { hx: 112, hy: 161, t: -12, sb: 0, n: -5, lnT: 90, lnS: 180, lnf: 180, anx: 166, any: 207 };
  // lying on back, head left
  var SUPINE = { hx: 152, hy: 200, t: 180, sb: 0, n: 180 };
  // seated on a machine, thighs level, feet down
  function seated(hy, t, extra) {
    var o = { hx: 130, hy: hy, t: t, sb: 0, n: -88, lnT: 0, lnS: 90 };
    for (var k in extra) o[k] = extra[k];
    return o;
  }

  def('treadmill_1km', {
    dur: 0.8, hi: ['legs'], sh: [162, 110],
    pose: function (ph) {
      return gait(ph, { hx: 146, hy: 117, t: -80, A: 28, lift: 22, bob: 2.5, sw: 38, fb: 88, ground: function () { return 193; } });
    },
    under: function (J, c) { return treadmill(c.t, 0, 4 * 28 / 0.8); }
  });

  var INC = 7, TAN = Math.tan(rad(INC));
  def('incline_walk', {
    dur: 1.3, hi: ['legs'], sh: [162, 110],
    pose: function (ph) {
      return gait(ph, { hx: 146, hy: 114, t: -84, A: 24, lift: 9, bob: -1.5, sw: 22, fb: 18,
        ground: function (x) { return 193 - (x - 160) * TAN; } });
    },
    under: function (J, c) { return treadmill(c.t, INC, 4 * 24 / 1.3); }
  });

  def('stationary_bike', {
    dur: 1.3, hi: ['legs'], sh: [170, 85],
    pose: function (ph) {
      var C0 = [168, 182], pn = add(C0, ph * 360, 17), pf = add(C0, ph * 360 + 180, 17);
      return { hx: 140, hy: 124, t: -68, sb: 0, n: -76, lnx: pn[0] - 9, lny: pn[1] - 4, lnf: 15,
        lfx: pf[0] - 9, lfy: pf[1] - 4, lff: 15, anx: 210, any: 102 };
    },
    under: function (J, c) { return bikeFarCrank(c); },
    mid: bikeFrame
  });

  def('cat_cow', {
    dur: 7, hi: ['core'], fdx: 6, sh: [120, 80], mat: [40, 230],
    kf: [
      { p: QUAD, w: 1 },
      { p: { sb: 17, n: -42 }, w: 0.6 },
      { p: { sb: 17, n: -42 }, w: 1 },
      { p: { sb: 0, n: -5 }, w: 1 },
      { p: { sb: -24, n: 45 }, w: 0.6 },
      { p: { sb: -24, n: 45 }, w: 1 }
    ]
  });

  var BD0 = { anx: 166, any: 207, afx: 166, afy: 207, lnT: 90, lnS: 180, lfT: 90, lfS: 180 };
  def('bird_dog', {
    dur: 10, hi: ['core'], fdx: 6, sh: [120, 90], mat: [30, 260],
    kf: [
      { p: merge(QUAD, BD0), w: 1.3 },
      { p: { anx: 245, any: 140, lfT: 178, lfS: 178 }, w: 0.9 },
      { p: {}, w: 1.3 },
      { p: BD0, w: 1.3 },
      { p: { afx: 245, afy: 140, lnT: 178, lnS: 178 }, w: 0.9 },
      { p: {}, w: 1.3 }
    ]
  });

  var DB0 = { anx: 101, any: 120, afx: 101, afy: 120, lnx: 194, lny: 156, lfx: 194, lfy: 156 };
  def('dead_bug', {
    dur: 10, hi: ['core'], sh: [150, 100], mat: [50, 270],
    kf: [
      { p: merge(SUPINE, DB0), w: 1.4 },
      { p: { anx: 32, any: 188, lfx: 252, lfy: 186 }, w: 0.7 },
      { p: {}, w: 1.4 },
      { p: DB0, w: 1.4 },
      { p: { afx: 32, afy: 188, lnx: 252, lny: 186 }, w: 0.7 },
      { p: {}, w: 1.4 }
    ]
  });

  def('glute_bridge', {
    dur: 5, hi: ['thighs', 'core'], sh: [150, 90], mat: [60, 240],
    A: merge(SUPINE, { lnx: 198, lny: 207, anx: 168, any: 206 }),
    B: { hx: 145, hy: 174, t: 150 },
    ws: [1.6, 1, 1.8, 0.6]
  });

  def('mcgill_curl_up', {
    dur: 6, hi: ['core'], sh: [160, 100], mat: [50, 280],
    A: merge(SUPINE, { lnx: 196, lny: 207, lfx: 268, lfy: 207, anx: 160, any: 205, anb: -1 }),
    B: { t: 188, n: 186 },
    ws: [1.2, 2, 1.4, 1]
  });

  def('side_plank_knee', {
    dur: 5.5, hi: ['core'], sh: [150, 90], mat: [50, 260],
    A: { hx: 165, hy: 202, t: -30, sb: 0, n: -30, lnx: 84, lny: 185, lnf: -170, anx: 240, any: 207, afx: 214, afy: 96 },
    B: { hx: 160.7, hy: 192.4, t: -18.4, n: -18 },
    ws: [1.4, 2, 1.4, 0.8]
  });

  def('front_plank_knee', {
    dur: 4, hi: ['core'], fdx: 5, sh: [150, 90], mat: [50, 260],
    A: { hx: 150.7, hy: 192.4, t: -18.4, sb: 0, n: -16, lnx: 73.6, lny: 184, lnf: -165, anx: 230, any: 207 },
    B: { hy: 191, sb: 3, n: -14 },
    ws: [1.6, 0.3, 1.6, 0.5]
  });

  def('pallof_press', {
    dur: 6, hi: ['core'], fdx: 0, sh: [160, 90],
    A: { hx: 140, hy: 124, t: -90, sb: 0, n: -90, lnx: 147, lny: 207, lfx: 135, lfy: 207, anx: 160, any: 94 },
    B: { anx: 203, any: 91 },
    ws: [1.4, 1.6, 1.6, 0.6],
    under: function () {
      return '<g opacity="0.75">' + rect(176, 30, 16, FL - 32, 3, 'none', ' stroke="' + C.steel + '" stroke-width="4"') +
        steel2([184, 36], [184, FL - 6], 2) + rect(178, 170, 12, 38, 2, C.steel) + '</g>' + pulley([184, 92]);
    },
    pre: function (J) { return cable([184, 92], J.aN.w); },
    over: function (J) { return rect(J.aN.w[0] - 3, J.aN.w[1] - 8, 6, 16, 3, C.steel2); }
  });

  function lpAnkle(s) { var P0 = [154 + 0.707 * s, 126 - 0.707 * s]; return add(P0, 135, 6); }
  var LP0 = lpAnkle(8), LP1 = lpAnkle(34);
  def('leg_press', {
    dur: 5, hi: ['legs'], fdx: 4, sh: [170, 120],
    A: { hx: 118, hy: 162, t: -135, sb: 0, n: -118, lnx: LP0[0], lny: LP0[1], lnf: -135, anx: 130, any: 172 },
    B: { lnx: LP1[0], lny: LP1[1] },
    ws: [1.6, 0.5, 2, 0.5],
    under: function (J) {
      var s = '';
      s += steel([50, FL - 3], [292, FL - 3], 7);
      s += steel([104, 196], [276, 24], 7) + steel([250, 50], [250, FL - 4], 7) + steel([110, 178], [110, FL - 4], 7);
      s += backPad(J, 17, 8, 26, 13) + pad([98, 178], [132, 175], 11);
      var P = add(J.lN.a, -45, 6), cr = add(P, 45, 12);
      s += steel(add(cr, -45, -10), add(cr, -45, 14), 9);
      s += cir(add(cr, 45, 12), 13, C.steel) + ring(add(cr, 45, 12), 13, C.steel2, 2);
      s += ln(add(P, -135, 24), add(P, 45, 14), 7, C.steel2);
      return s;
    },
    pre: function () { return steel2([126, 168], [134, 178], 5); }
  });

  def('box_squat_db', {
    dur: 5.5, hi: ['legs'], sh: [140, 80],
    A: { hx: 142, hy: 124, t: -88, sb: 0, n: -88, lnx: 160, lny: 207, lfx: 155, lfy: 207, anx: 157, any: 95 },
    B: { hx: 116, hy: 160, t: -62, n: -72, anx: 151, any: 136 },
    ws: [2, 0.5, 1.6, 0.6],
    under: function () {
      return pad([80, 173], [124, 173], 10) + steel([86, 178], [86, FL - 2], 6) + steel([118, 178], [118, FL - 2], 6);
    },
    pre: function (J) {
      var w = J.aN.w, x = w[0] + 3;
      return steel2([x, w[1] - 6], [x, w[1] + 16], 4) + rect(x - 8, w[1] - 10, 16, 6, 2, C.steel) + rect(x - 8, w[1] + 14, 16, 6, 2, C.steel);
    }
  });

  function curlRig(J, front) {
    var knee = J.lN.k, a = J.lN.a, sa = ang(knee, a);
    var roll = add(add(a, sa, -5), sa + (front ? -90 : 90), 10);
    return steel(knee, roll, 6) + cir(knee, 5, C.steel2) + cir(roll, 7, C.pad) + ring(roll, 7, C.padHi, 2);
  }
  def('leg_curl_seated', {
    dur: 4.5, hi: ['legs'], fdx: 3, sh: [160, 90],
    A: seated(158, -100, { lnS: 14, anx: 134, any: 172 }),
    B: { lnS: 100 },
    ws: [1.4, 0.5, 2, 0.5],
    under: function (J) {
      return seatedBase(98, 162, 170, 128) + backPad(J, 17, 6, 20, 12) + steel([200, 120], [200, FL - 4], 7) + steel([170, FL - 3], [230, FL - 3], 6);
    },
    pre: function (J) { return curlRig(J, false); },
    over: function () { return steel2([178, 143], [200, 128], 5) + pad([146, 143], [176, 143], 10) + steel2([128, 165], [136, 176], 5); }
  });

  def('leg_extension', {
    dur: 4.5, hi: ['legs'], fdx: 3, sh: [160, 90],
    A: seated(158, -100, { lnS: 95, anx: 134, any: 172 }),
    B: { lnS: 8 },
    ws: [1.4, 0.6, 2, 0.5],
    under: function (J) {
      return seatedBase(98, 162, 170, 128) + backPad(J, 17, 6, 20, 12);
    },
    pre: function (J) { return curlRig(J, true); },
    over: function () { return steel2([128, 165], [136, 176], 5); }
  });

  def('hip_abduction', {
    dur: 4.5, sh: [160, 70],
    custom: function (ph) {
      var e = env(ph, [1.3, 0.6, 1.9, 0.5]), th = 6 + 27 * e, cx = 160, s = '';
      var hiCol = C.acc;
      // machine (front view)
      s += steel([104, FL - 3], [216, FL - 3], 7) + steel([cx, 172], [cx, FL - 4], 9);
      s += rect(128, 66, 64, 96, 12, C.pad) + rect(134, 72, 52, 84, 9, C.padHi);
      s += rect(114, 156, 92, 13, 6, C.pad);
      s += steel([118, 164], [118, 186], 5) + steel([202, 164], [202, 186], 5);
      // torso
      s += ln([cx, 112], [cx, 146], 34, C.body) + ln([143, 106], [177, 106], 16, C.body) + ln([149, 152], [171, 152], 20, C.body);
      s += ln([cx, 100], [cx, 90], 10, C.body) + cir([cx, 76], 13, C.body) + cir([155.5, 75], 1.8, C.eye) + cir([164.5, 75], 1.8, C.eye);
      [-1, 1].forEach(function (sg) {
        var hip = [cx + sg * 11, 154];
        var knee = [hip[0] + sg * (4 + L.th * Math.sin(rad(th))), 162];
        var an = [knee[0] - sg * 3, 162 + Math.sqrt(L.sh * L.sh - 9)];
        // arms down to side handles
        var sh = [cx + sg * 18, 106], el = [cx + sg * 26, 132], wr = [cx + sg * 30, 157];
        s += ln(sh, el, W.ua, C.body) + ln(el, wr, W.fa, C.body);
        s += ln([wr[0], wr[1] + 4], [wr[0] + sg * 6, wr[1] + 18], 5, C.steel2) + cir(wr, W.hand, C.body);
        // leg: thigh points at viewer (foreshortened by projection), shin hangs down
        s += ln(knee, an, W.sh, C.body) + '<ellipse cx="' + f(an[0]) + '" cy="' + (FL - 5) + '" rx="7" ry="4.5" fill="' + C.body + '"/>';
        s += ln(hip, knee, 27, hiCol, ' opacity="0.14"') + ln(hip, knee, 18, hiCol);
        // outer knee pad on lever
        var px = knee[0] + sg * 15;
        s += steel([px, 176], [cx + sg * 12, 194], 6) + pad([px, 148], [px, 176], 11);
      });
      return s;
    }
  });

  function calfPose(e) {
    var phi = lerp(-15, 40, e), toe = [172, 196], an = add(toe, phi, -L.ft);
    var hip = [an[0], an[1] - L.th - L.sh], S = [hip[0], hip[1] - L.torso];
    return { hx: hip[0], hy: hip[1], t: -90, sb: 0, n: -90, lnT: 90, lnS: 90, lnf: phi,
      anx: S[0] + 15, any: S[1] - 5 };
  }
  def('calf_raise_machine', {
    dur: 4, hi: ['calves'], fdx: -4, sh: [150, 80],
    pose: function (ph) { return calfPose(env(ph, [1.2, 0.6, 1.6, 0.5])); },
    under: function (J) {
      var S = J.S, s = '';
      s += stack(64, 30, 34, (S[1] < 60 ? 61.5 - S[1] : 0) * 1.4);
      s += steel([108, 22], [108, FL - 3], 8) + steel([92, FL - 3], [196, FL - 3], 6);
      s += rect(138, 200, 46, 12, 3, C.steel) + ln([140, 200], [182, 200], 2, C.steel2);
      s += steel([108, S[1] - 2], [S[0] - 8, S[1] - 2], 7);
      return s;
    },
    over: function (J) { var S = J.S; return pad([S[0] - 12, S[1] - 2], [S[0] + 7, S[1] - 2], 10); }
  });

  var SEAT_HY = 165;
  function seatedRig(J) { return seatedBase(106, 158, 177, 132) + backPad(J, 17, 8, 22, 12); }

  def('lat_pulldown', {
    dur: 5, hi: ['upperarms', 'core'], fdx: 3, sh: [180, 110],
    A: { hx: 138, hy: SEAT_HY, t: -100, sb: 0, n: -86, lnT: 0, lnS: 90, anx: 152, any: 38 },
    B: { t: -105, n: -84, anx: 147, any: 119 },
    ws: [1.5, 0.5, 2.2, 0.5],
    under: function (J) {
      var s = seatedBase(110, 160, 177, 136);
      s += stack(240, 40, 36, (J.aN.w[1] - 52) * 0.6);
      s += steel([258, 40], [258, 12], 7) + steel([258, 14], [150, 14], 7) + pulley([150, 20]);
      s += steel([240, 140], [196, 140], 6);
      return s;
    },
    over: function (J) {
      var w = J.aN.w, s = cable([150, 26], [w[0] + 2, w[1] - 4]);
      s += '<path d="M' + f(w[0] - 16) + ' ' + f(w[1] + 6) + 'Q' + f(w[0]) + ' ' + f(w[1] - 4) + ' ' + f(w[0] + 18) + ' ' + f(w[1] + 6) + '" fill="none" stroke="' + C.steel2 + '" stroke-width="5" stroke-linecap="round"/>';
      s += pad([174, 152], [194, 152], 10);
      return s;
    }
  });

  def('seated_cable_row', {
    dur: 5, hi: ['upperarms', 'core'], fdx: 3, sh: [160, 120],
    A: { hx: 108, hy: 186, t: -90, sb: 0, n: -90, lnx: 186, lny: 178, lnf: -72, anx: 172, any: 156 },
    B: { anx: 126, any: 158 },
    ws: [1.4, 0.6, 2.1, 0.6],
    under: function (J) {
      var s = '';
      s += pad([56, 199], [176, 199], 9) + steel([70, 204], [70, FL - 2], 6) + steel([160, 204], [160, FL - 2], 6);
      s += steel([176, 205], [236, 205], 6) + steel([194, 204], [206, 160], 7);
      s += stack(236, 40, 38, (176 - J.aN.w[0]) * 0.5);
      s += pulley([234, 158]);
      return s;
    },
    pre: function (J) { return cable([234, 158], J.aN.w); },
    over: function (J) {
      var w = J.aN.w;
      return '<path d="M' + f(w[0] + 4) + ' ' + f(w[1]) + 'L' + f(w[0] - 2) + ' ' + f(w[1] - 7) + 'L' + f(w[0] - 2) + ' ' + f(w[1] + 7) + 'Z" fill="none" stroke="' + C.steel2 + '" stroke-width="3.5" stroke-linejoin="round"/>';
    }
  });

  def('chest_press_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [170, 110],
    A: seated(SEAT_HY, -100, { anx: 140, any: 122 }),
    B: { anx: 181, any: 122 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      return seatedRig(J) + stack(244, 40, 36, (J.aN.w[0] - 140) * 0.5) + steel([244, 122], [228, 122], 8);
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([w[0] + 4, w[1]], [236, w[1]], 6) + rect(w[0] - 3.5, w[1] - 10, 7, 20, 3.5, C.steel2);
    }
  });

  def('shoulder_press_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [160, 100],
    A: seated(SEAT_HY, -95, { anx: 152, any: 110 }),
    B: { anx: 148, any: 54 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      var s = seatedRig(J) + backPad(J, 17, -48, 40, 12);
      s += steel([218, FL - 3], [218, 112], 8) + steel([196, FL - 3], [242, FL - 3], 6) + cir([216, 116], 6, C.steel2);
      return s;
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([216, 116], [w[0] + 4, w[1]], 6) + rect(w[0] - 3.5, w[1] - 10, 7, 20, 3.5, C.steel2);
    }
  });

  def('face_pull', {
    dur: 5, hi: ['upperarms'], sh: [170, 100],
    A: { hx: 130, hy: 124, t: -92, sb: 0, n: -90, lnx: 145, lny: 207, lfx: 116, lfy: 207, anU: -3, anL: -3, us: 1, fs: 1 },
    B: { anU: -125, anL: -22, us: 0.3, fs: 0.85 },
    ws: [1.4, 0.7, 2, 0.5],
    under: function () {
      return rect(228, 24, 16, FL - 26, 3, 'none', ' stroke="' + C.steel + '" stroke-width="5"') + steel([214, FL - 3], [258, FL - 3], 6) +
        rect(231, 160, 10, 46, 2, C.steel) + pulley([226, 64]);
    },
    over: function (J) {
      var w = J.aN.w;
      return ln([226, 64], [w[0] + 8, w[1] + 2], 3.5, C.steel2) + ln([w[0] + 8, w[1] + 2], [w[0], w[1] - 3], 3.5, C.steel2) +
        ln([w[0] + 8, w[1] + 2], [w[0], w[1] + 5], 3.5, C.steel2);
    }
  });

  def('db_curl_seated', {
    dur: 4.5, hi: ['arms'], fdx: 3, sh: [140, 80],
    A: seated(SEAT_HY, -95, { anU: 99, anL: 86 }),
    B: { anL: -52 },
    ws: [1.4, 0.4, 2.1, 0.6],
    under: function (J) { return seatedRig(J) + backPad(J, 17, -48, 20, 12); },
    over: function (J) {
      var w = J.aN.w, a = ang(J.aN.e, w) + 90, p1 = add(w, a, -9), p2 = add(w, a, 9);
      return ln(p1, p2, 3.5, C.steel2) + ln(add(p1, a, -2), add(p1, a, 2), 12, C.steel2) + ln(add(p2, a, -2), add(p2, a, 2), 12, C.steel2);
    }
  });

  def('tricep_pushdown', {
    dur: 4.5, hi: ['arms'], fdx: 0, sh: [170, 100],
    A: { hx: 130, hy: 124, t: -82, sb: 0, n: -86, lnx: 147, lny: 207, lfx: 124, lfy: 207, anU: 93, anL: -40 },
    B: { anL: 86 },
    ws: [1.3, 0.5, 2, 0.6],
    under: function () {
      return rect(232, 20, 16, FL - 22, 3, 'none', ' stroke="' + C.steel + '" stroke-width="5"') + steel([218, FL - 3], [262, FL - 3], 6) +
        steel([238, 16], [186, 16], 7) + rect(235, 160, 10, 46, 2, C.steel) + pulley([186, 22]);
    },
    over: function (J) {
      var w = J.aN.w, k = [w[0] + 2, w[1] - 10];
      return cable([186, 28], k) + ln(k, [w[0] - 3, w[1] + 4], 3.5, C.steel2) + ln(k, [w[0] + 5, w[1] + 4], 3.5, C.steel2);
    }
  });

  def('knee_to_chest_stretch', {
    dur: 7, hi: ['thighN'], sh: [160, 100], mat: [50, 280],
    pose: function (ph) {
      var e = env(ph, [2.5, 2, 2.5, 0.8]), T = lerp(-100, -124, e), Sx = lerp(40, 52, e);
      var knee = add([152, 200], T, L.th), hand = add(knee, Sx, 9);
      return merge(SUPINE, { lnT: T, lnS: Sx, lfx: 268, lfy: 207, anx: hand[0], any: hand[1], anb: -1 });
    }
  });

  def('hip_flexor_stretch', {
    dur: 7, hi: ['thighN'], sh: [140, 80], mat: [50, 240],
    pose: function (ph) {
      var e = env(ph, [2.5, 2, 2.5, 0.8]), knee = [120, 205], a = lerp(-80, -60, e), hip = add(knee, a, L.th);
      return { hx: hip[0], hy: hip[1], t: -90 - 2 * e, sb: -2 * e, n: -88, lnT: a + 180, lnS: 180, lnf: 180,
        lfx: 186, lfy: 207, lff: 0, anU: 112, anL: 18 };
    },
    under: function () { return rect(106, 206, 30, 6, 3, C.steel); }
  });

  def('child_pose', {
    dur: 9, hi: ['core'], sh: [150, 100], mat: [50, 260],
    pose: function (ph) {
      var e = env(ph, [3, 2.5, 2.5, 1]), knee = [140, 205], a = lerp(-90, -160, e), hip = add(knee, a, L.th);
      return { hx: hip[0], hy: hip[1], t: lerp(-6, 2, e), sb: lerp(0, -6, e), n: lerp(10, 30, e),
        lnT: a + 180, lnS: 180, lnf: 180, anx: 228, any: 207 };
    },
    fdx: 5
  });

  // fallback for unknown ids: gently breathing standing figure
  var IDLE = {
    dur: 4, hi: hiSet([]), sh: [150, 60],
    A: { hx: 150, hy: 124, t: -90, sb: 0, n: -90, lnx: 156, lny: 207, lfx: 145, lfy: 207, anU: 96, anL: 86 },
    B: { hy: 123, sb: 1.5, n: -92, anU: 98 },
    ws: [1.6, 0.4, 1.6, 0.4]
  };

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  // expand cascading keyframes once
  Object.keys(EX).forEach(function (id) {
    var ex = EX[id];
    if (ex.kf) {
      var prev = {}, wsum = 0;
      ex._kf = ex.kf.map(function (k) { prev = merge(prev, k.p); wsum += k.w; return { p: prev, w: k.w }; });
      ex._wsum = wsum;
    }
    if (ex.A && ex.B) ex.B = merge(ex.A, ex.B);
  });
  IDLE.B = merge(IDLE.A, IDLE.B);

  function poseAt(ex, ph) {
    if (ex.pose) return ex.pose(ph);
    if (ex._kf) {
      var k = ex._kf, n = k.length, x = ph * ex._wsum, i = 0;
      while (i < n - 1 && x >= k[i].w) { x -= k[i].w; i++; }
      return lerpPose(k[i].p, k[(i + 1) % n].p, ease(Math.min(1, x / k[i].w)));
    }
    return lerpPose(ex.A, ex.B, env(ph, ex.ws));
  }

  // phase for the reduced-motion still: halfway through the movement
  function midPhase(ex) {
    if (ex._kf) return (ex._kf[0].w * 0.5) / ex._wsum;
    if (ex.ws) { var s = ex.ws[0] + ex.ws[1] + ex.ws[2] + ex.ws[3]; return ex.ws[0] * 0.5 / s; }
    return 0.25;
  }

  function staticBg(ex) {
    var s = '';
    s += ln([12, FL + 1], [308, FL + 1], 2, C.floor);
    if (ex.sh) s += shadow(ex.sh[0], ex.sh[1]);
    if (ex.mat) s += mat(ex.mat[0], ex.mat[1]);
    return s;
  }

  function frameSvg(ex, ph, t) {
    if (ex.custom) return ex.custom(ph, t);
    var c = { ph: ph, t: t };
    var J = solve(poseAt(ex, ph), ex.fdx || 0);
    return (ex.under ? ex.under(J, c) : '') +
      drawFig(J, ex.hi, ex.mid ? ex.mid(J, c) : '', ex.pre ? ex.pre(J, c) : '') +
      (ex.over ? ex.over(J, c) : '');
  }

  function mount(container, exerciseId) {
    var ex = EX[exerciseId] || IDLE;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 240');
    svg.setAttribute('width', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Animated demonstration: ' + String(exerciseId || 'exercise').replace(/_/g, ' '));
    svg.style.display = 'block';
    svg.style.height = 'auto';
    svg.style.overflow = 'visible';
    svg.innerHTML = '<g>' + staticBg(ex) + '</g><g></g>';
    var g = svg.lastChild;
    container.appendChild(svg);

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var raf = 0, last = null, elapsed = 0, dead = false;

    function render(sec) {
      var ph = (sec / ex.dur) % 1;
      g.innerHTML = frameSvg(ex, ph, sec);
    }
    function frame(now) {
      if (dead) return;
      if (last != null) elapsed += Math.min(now - last, 100);
      last = now;
      render(elapsed / 1000);
      raf = requestAnimationFrame(frame);
    }
    function onVis() {
      if (dead || reduce) return;
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = null; raf = requestAnimationFrame(frame); }
    }

    if (reduce) render(midPhase(ex) * ex.dur);
    else {
      render(0);
      if (!document.hidden) raf = requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', onVis);
    }

    return {
      destroy: function () {
        if (dead) return;
        dead = true;
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        if (svg.parentNode) svg.parentNode.removeChild(svg);
      }
    };
  }

  window.Figures = { ids: Object.keys(EX), mount: mount,
    // test hook: static SVG markup of one exercise at phase 0..1
    _frame: function (id, ph) { var ex = EX[id] || IDLE; return staticBg(ex) + frameSvg(ex, ph, ph * ex.dur); } };
})();
