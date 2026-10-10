/* figures.js — animated exercise figures (plain browser JS, offline, no deps).
 * API: window.Figures = { ids, mount(container, exerciseId, opts?) -> { destroy() } }
 *   opts.shirt  t-shirt colour (default #D4FF3A)
 *   opts.accent equipment pad colour (default #D4FF3A)
 *   opts.stage  'purple' | 'dark' (default 'purple'); 'dark' adds a light rim so ink outlines read on black
 *
 * Rig: side-view 2D skeleton. Every bone is placed by forward kinematics
 * (angle + fixed length) or two-bone IK (law of cosines), so bone lengths
 * never change. Coordinates: viewBox 0 0 320 240, y down, angles in degrees
 * (0 = right, 90 = down, -90 = up). Figures face right unless noted.
 * Look: cartoon sticker — every body part and machine piece is a filled shape
 * drawn over a slightly wider ink stroke, which becomes its outline.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FL = 212; // floor line y
  var INK = '#0B0B0F', OW = 5; // outline colour; OW = extra stroke width (2.5 per side)

  var BASE = {
    skin: '#F4C7A1', skinFar: '#DDAA83', hair: '#2B1D18', blush: '#FF8C9A',
    shorts: '#24212C', shortsFar: '#18161E', shoe: '#FFFFFF', shoeFar: '#DAD7E4',
    frame: '#EDEBF5', frameDk: '#C9C5D8', white: '#FFFFFF', belt: '#2E2A3A',
    mat: '#2A2538', drop: '#8FD8FF', lines: '#FFFFFF'
  };
  var DEF = { shirt: '#D4FF3A', accent: '#D4FF3A', stage: 'purple' };
  var C = {}; // active palette; set synchronously before each render

  var L = { torso: 52, neck: 18, head: 13, ua: 32, fa: 30, th: 44, sh: 42, ft: 15 };
  var W = { torso: 27, neck: 9, th: 17, sh: 13, ua: 12, fa: 10.5, hand: 6 };

  /* ---------------- colour ---------------- */
  function hex(c) {
    c = String(c || '').trim().replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return /^[0-9a-fA-F]{6}$/.test(c) ? '#' + c.toUpperCase() : null;
  }
  function mix(a, b, u) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), o = '#', i, s, t;
    for (i = 16; i >= 0; i -= 8) {
      s = (x >> i) & 255; t = (y >> i) & 255;
      o += ('0' + Math.round(s + (t - s) * u).toString(16)).slice(-2);
    }
    return o;
  }
  function makeTheme(opts) {
    opts = opts || {};
    var t = merge(BASE, {});
    t.shirt = hex(opts.shirt) || DEF.shirt;
    t.acc = hex(opts.accent) || DEF.accent;
    t.dark = opts.stage === 'dark';
    t.shirtFar = mix(t.shirt, INK, 0.2);
    t.accDk = mix(t.acc, INK, 0.28);
    t.sole = t.shirt;
    t.glow = '#FFFFFF'; t.glowOp = t.dark ? 0.16 : 0.32;
    return t;
  }

  /* ---------------- math ---------------- */
  function rad(a) { return a * Math.PI / 180; }
  function dir(a) { a = rad(a); return [Math.cos(a), Math.sin(a)]; }
  function add(p, a, len) { var d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; }
  function ang(p, q) { return Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; }
  function dist(p, q) { var dx = q[0] - p[0], dy = q[1] - p[1]; return Math.sqrt(dx * dx + dy * dy); }
  function mid(p, q, u) { return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { return 0.5 - 0.5 * Math.cos(Math.PI * u); }
  function clamp01(u) { return Math.max(0, Math.min(1, u)); }
  function f(n) { return Math.round(n * 10) / 10; }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

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
    return '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(r) + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function rect(x, y, w, h, rx, fill, extra) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + rx + '" fill="' + fill + '"' + (extra || '') + '/>';
  }
  function inked(sw) { return ' stroke="' + INK + '" stroke-width="' + (sw || 2.5) + '" stroke-linejoin="round"'; }
  function box(x, y, w, h, rx, fill, sw) { return rect(x, y, w, h, rx, fill, inked(sw)); }
  function dot(p, r, fill, sw) { return cir(p, r, fill, inked(sw)); }
  // filled capsule with ink outline
  function tube(a, b, w, fill, ow) { return ln(a, b, w + (ow == null ? OW : ow), INK) + ln(a, b, w, fill); }
  function pathTube(d, w, fill, ow) {
    var s = '" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="';
    return '<path d="' + d + s + (w + (ow == null ? OW : ow)) + '" stroke="' + INK + '"/>' +
      '<path d="' + d + s + w + '" stroke="' + fill + '"/>';
  }
  function steel(a, b, w) { return tube(a, b, w || 6, C.frame); }
  function steel2(a, b, w) { return tube(a, b, Math.max(2, (w || 4) - 1), C.white, 3.5); }
  function pad(a, b, w) {
    w = w || 12;
    var d = ang(a, b), sh = Math.max(1.5, w * 0.22);
    var a2 = add(add(a, d - 90, w * 0.22), d, 3), b2 = add(add(b, d - 90, w * 0.22), d, -3);
    return tube(a, b, w, C.acc) + (dist(a, b) > 10 ? ln(a2, b2, sh, '#FFFFFF', ' opacity="0.55"') : '');
  }
  function cable(a, b) { return ln(a, b, 2, INK); }
  function rope(a, b) { return tube(a, b, 2.4, C.white, 3); }
  function pulley(p) { return dot(p, 6.5, C.white) + cir(p, 2, INK); }
  function shadow(cx, rx) {
    return '<ellipse cx="' + cx + '" cy="' + (FL + 1) + '" rx="' + rx + '" ry="6" fill="' +
      (C.dark ? '#FFFFFF' : INK) + '" opacity="' + (C.dark ? 0.07 : 0.22) + '"/>';
  }
  function mat(x1, x2) { return box(x1, FL - 4, x2 - x1, 7, 3.5, C.mat); }
  function dumbbell(p, a) {
    var p1 = add(p, a, -9), p2 = add(p, a, 9);
    return steel2(p1, p2, 4) + tube(add(p1, a, -2), add(p1, a, 2), 11, C.acc, 4) + tube(add(p2, a, -2), add(p2, a, 2), 11, C.acc, 4);
  }

  // Pad parallel to the torso, offset to the back side.
  function backPad(J, off, below, above, w) {
    var t = J.P.t, b = t - 90;
    var a = add(add(J.H, t, -(below || 0)), b, off);
    var c = add(add(J.S, t, above || 0), b, off);
    return pad(a, c, w || 12);
  }
  // Weight stack tower; lift (px) raises the selected plates.
  function stack(x, y, w, lift) {
    var s = box(x, y, w, FL - y, 4, C.white, 3);
    s += rect(x + 4, y + 4, w - 8, FL - y - 8, 2, C.frame);
    s += ln([x + 8, y + 6], [x + 8, FL - 5], 1.6, INK) + ln([x + w - 8, y + 6], [x + w - 8, FL - 5], 1.6, INK);
    var i, py = FL - 6;
    for (i = 0; i < 3; i++) { s += box(x + 5, py - 6, w - 10, 6, 1.5, C.frameDk, 1.8); py -= 7; }
    lift = Math.max(0, Math.min(lift || 0, FL - y - 70));
    for (i = 0; i < 4; i++) { s += box(x + 5, py - 6 - lift, w - 10, 6, 1.5, C.acc, 1.8); py -= 7; }
    s += ln([x + w / 2, py - lift], [x + w / 2, y + 5], 2.4, INK);
    return s;
  }

  /* ---------------- rig ---------------- */
  function limbPrefix(P, pre, near) {
    return (P[pre + 'T'] != null || P[pre + 'x'] != null || P[pre + 'U'] != null) ? pre : near;
  }

  function solve(P, fdx) {
    var H = [P.hx, P.hy], S = add(H, P.t, L.torso), Hd = add(S, P.n, L.neck);
    var J = { P: P, H: H, S: S, Hd: Hd };

    function leg(pre, dx) {
      var k = limbPrefix(P, pre, 'ln'), root = [H[0] + dx, H[1]], knee, an;
      if (P[k + 'T'] != null) { knee = add(root, P[k + 'T'], L.th); an = add(knee, P[k + 'S'], L.sh); }
      else {
        var r = ik(root, [P[k + 'x'] + dx, P[k + 'y']], L.th, L.sh, P[k + 'b'] == null ? -1 : P[k + 'b']);
        knee = r[0]; an = r[1];
      }
      var fa = P[pre + 'f'] != null ? P[pre + 'f'] : (P.lnf != null ? P.lnf : ang(knee, an) - 90);
      return { r: root, k: knee, a: an, t: add(an, fa, L.ft) };
    }
    function arm(pre, dx) {
      var k = limbPrefix(P, pre, 'an'), root = [S[0] + dx, S[1]], el, wr;
      var far = pre === 'af';
      var us = far && P.fus != null ? P.fus : (P.us == null ? 1 : P.us);
      var fs = far && P.ffs != null ? P.ffs : (P.fs == null ? 1 : P.fs);
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

  function glow() { return ''; } // highlight halo retired in the sticker look; hi lists kept for data

  function drawArm(a, far, hiU, hiF) {
    var skin = far ? C.skinFar : C.skin, shirt = far ? C.shirtFar : C.shirt, o = '';
    if (hiU) o += glow(a.r, a.e, W.ua);
    if (hiF) o += glow(a.e, a.w, W.fa);
    o += ln(a.r, a.e, W.ua + OW, INK) + ln(a.e, a.w, W.fa + OW, INK) + cir(a.w, W.hand + OW / 2, INK);
    o += ln(a.r, a.e, W.ua, skin) + ln(a.e, a.w, W.fa, skin) + cir(a.w, W.hand, skin);
    var d = dist(a.r, a.e), sl = d < 0.5 ? a.r : add(a.r, ang(a.r, a.e), Math.min(d * 0.5, 13));
    o += tube(a.r, sl, W.ua + 3.5, shirt);
    return o;
  }

  function drawLeg(l, far, hiT, hiS) {
    var skin = far ? C.skinFar : C.skin, shorts = far ? C.shortsFar : C.shorts, o = '';
    if (hiT) o += glow(l.r, l.k, W.th);
    if (hiS) o += glow(l.k, l.a, W.sh);
    o += ln(l.r, l.k, W.th + OW, INK) + ln(l.k, l.a, W.sh + OW, INK);
    o += ln(l.r, l.k, W.th, skin) + ln(l.k, l.a, W.sh, skin);
    var d = dist(l.r, l.k), sp = d < 0.5 ? l.r : add(l.r, ang(l.r, l.k), Math.min(d * 0.46, 21));
    o += tube(l.r, sp, W.th + 2, shorts);
    // shoe: white capsule with a coloured sole stripe on the side away from the knee
    var fa = ang(l.a, l.t), heel = add(l.a, fa, -3), toe = l.t, pp = fa + 90, sd = dir(pp);
    if (sd[0] * (l.k[0] - l.a[0]) + sd[1] * (l.k[1] - l.a[1]) > 0) pp = fa - 90;
    o += tube(heel, toe, 10, far ? C.shoeFar : C.shoe);
    o += ln(add(add(heel, pp, 3.3), fa, 1), add(add(toe, pp, 3.3), fa, -1), 3, C.sole);
    return o;
  }

  function drawHead(Hd, n) {
    return '<g transform="translate(' + f(Hd[0]) + ' ' + f(Hd[1]) + ') rotate(' + f(n + 90) + ')">' +
      '<circle r="' + L.head + '" fill="' + C.skin + '"' + inked(2.6) + '/>' +
      '<path d="M11 -7.6A13.4 13.4 0 1 0 -10.3 8.6Q-5 1.5 -1.5 -3Q3.5 -8.2 11 -7.6Z" fill="' + C.hair + '"' + inked(2.4) + '/>' +
      '<circle cx="-2.6" cy="2.4" r="3.3" fill="' + C.skin + '"' + inked(2) + '/>' +
      '<circle cx="4.4" cy="4" r="2.5" fill="' + C.blush + '" opacity="0.55"/>' +
      '<ellipse cx="6.7" cy="-0.4" rx="1.7" ry="2.3" fill="' + INK + '"/>' +
      '<path d="M3.4 -6.2L9.9 -4.1" stroke="' + INK + '" stroke-width="2.3" stroke-linecap="round"/>' +
      '<path d="M6.4 5.6Q9.2 7.6 11.5 4.6" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>' +
      '</g>';
  }

  function drawFig(J, hi, midL, pre) {
    var P = J.P, s = '';
    s += drawArm(J.aF, 1, hi.uaF, hi.faF) + drawLeg(J.lF, 1, hi.thighF, hi.shinF);
    s += midL || '';
    // neck under the torso so the shirt reads as a collar
    s += tube(J.S, add(J.S, P.n, L.neck - 3), W.neck, C.skin);
    // torso with optional spine curve (sb > 0 arches belly-side)
    var m = mid(J.H, J.S, 0.5), cp = add(m, P.t + 90, P.sb || 0);
    var d = 'M' + f(J.H[0]) + ' ' + f(J.H[1]) + 'Q' + f(cp[0]) + ' ' + f(cp[1]) + ' ' + f(J.S[0]) + ' ' + f(J.S[1]);
        s += pathTube(d, W.torso, C.shirt);
    // shorts: hip block up to a waistband
    var td = ang(J.H, cp), hb = add(J.H, td, 9), hw = W.torso / 2;
    s += cir(J.H, hw, C.shorts) + ln(J.H, hb, W.torso, C.shorts, ' stroke-linecap="butt"');
    s += ln(add(hb, td + 90, hw + 1), add(hb, td - 90, hw + 1), 2.4, INK, ' stroke-linecap="butt"');
    s += drawHead(J.Hd, P.n);
    s += drawLeg(J.lN, 0, hi.thighN, hi.shinN);
    s += pre || '';
    s += drawArm(J.aN, 0, hi.uaN, hi.faN);
    return s;
  }

  /* ---------- front-view character (hip abduction, Pallof press) ---------- */
  function drawHeadFront(p) {
    var k = ' stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"';
    return '<g transform="translate(' + f(p[0]) + ' ' + f(p[1]) + ')">' +
      '<circle cx="-12.6" cy="2" r="3.3" fill="' + C.skin + '"' + inked(2) + '/><circle cx="12.6" cy="2" r="3.3" fill="' + C.skin + '"' + inked(2) + '/>' +
      '<circle r="' + L.head + '" fill="' + C.skin + '"' + inked(2.6) + '/>' +
      '<path d="M-13.2 1A13.3 13.3 0 0 1 13.2 1Q11 -4.8 5 -5.8Q0 -3.2 -4 -6.6Q-10.5 -5.6 -13.2 1Z" fill="' + C.hair + '"' + inked(2.4) + '/>' +
      '<circle cx="-7.4" cy="5" r="2.4" fill="' + C.blush + '" opacity="0.55"/><circle cx="7.4" cy="5" r="2.4" fill="' + C.blush + '" opacity="0.55"/>' +
      '<ellipse cx="-4.6" cy="1.4" rx="1.7" ry="2.3" fill="' + INK + '"/><ellipse cx="4.6" cy="1.4" rx="1.7" ry="2.3" fill="' + INK + '"/>' +
      '<path d="M-8 -3.4L-2.4 -1.9"' + k + '/><path d="M8 -3.4L2.4 -1.9"' + k + '/>' +
      '<path d="M-3.6 6.4Q0 9 3.6 6.4" fill="none"' + k + '/>' +
      '</g>';
  }
  function drawHeadBack(p) {
    return '<g transform="translate(' + f(p[0]) + ' ' + f(p[1]) + ')">' +
      '<circle cx="-12.6" cy="2" r="3.3" fill="' + C.skin + '"' + inked(2) + '/><circle cx="12.6" cy="2" r="3.3" fill="' + C.skin + '"' + inked(2) + '/>' +
      '<circle r="' + L.head + '" fill="' + C.skin + '"' + inked(2.6) + '/>' +
      '<path d="M-13.2 4A13.3 13.3 0 1 1 13.2 4Q7 9.5 0 8Q-7 9.5 -13.2 4Z" fill="' + C.hair + '"' + inked(2.4) + '/>' +
      '</g>';
  }
  // o: { cx, sh (shoulder y), hip (hip y), legs: [[hip,knee,ankle] x2], arms: [[sh,el,wr,handR] x2], hiThighs, back (rear view) }
  function frontFig(o) {
    var s = '', cx = o.cx;
    o.legs.forEach(function (l) {
      if (o.hiThighs) s += glow(l[0], l[1], W.th);
      s += ln(l[0], l[1], W.th + OW, INK) + ln(l[1], l[2], W.sh + OW, INK);
      s += ln(l[0], l[1], W.th, C.skin) + ln(l[1], l[2], W.sh, C.skin);
      s += tube(l[0], mid(l[0], l[1], o.shortLen || 0.6), W.th + 3, C.shorts);
      var fx = l[2][0] + (l[2][0] > cx ? 2 : -2);
      s += '<ellipse cx="' + f(fx) + '" cy="' + (FL - 5) + '" rx="8.5" ry="5.5" fill="' + C.shoe + '"' + inked(2.5) + '/>';
      s += ln([fx - 6, FL - 1.8], [fx + 6, FL - 1.8], 2.6, C.sole);
    });
    s += box(cx - 17, o.hip - 10, 34, 16, 7, C.shorts);
    s += tube([cx, o.sh], [cx, o.sh - 14], W.neck, C.skin);
    s += '<path d="M' + (cx - 20) + ' ' + (o.sh + 4) + 'Q' + (cx - 20) + ' ' + (o.sh - 5) + ' ' + (cx - 10) + ' ' + (o.sh - 5) +
      'L' + (cx + 10) + ' ' + (o.sh - 5) + 'Q' + (cx + 20) + ' ' + (o.sh - 5) + ' ' + (cx + 20) + ' ' + (o.sh + 4) +
      'L' + (cx + 16) + ' ' + (o.hip - 4) + 'Q' + cx + ' ' + (o.hip) + ' ' + (cx - 16) + ' ' + (o.hip - 4) + 'Z" fill="' + C.shirt + '"' + inked(2.6) + '/>';
    s += '<path d="M' + (cx - 5) + ' ' + (o.sh - 5) + 'Q' + cx + ' ' + (o.sh + 1) + ' ' + (cx + 5) + ' ' + (o.sh - 5) + '" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>';
    s += (o.back ? drawHeadBack : drawHeadFront)([cx, o.sh - 22]);
    o.arms.forEach(function (a) {
      var hr = a[3] || W.hand;
      s += ln(a[0], a[1], W.ua + OW, INK) + ln(a[1], a[2], W.fa + OW, INK) + cir(a[2], hr + OW / 2, INK);
      s += ln(a[0], a[1], W.ua, C.skin) + ln(a[1], a[2], W.fa, C.skin) + cir(a[2], hr, C.skin);
      var d = dist(a[0], a[1]);
      s += tube(a[0], d < 0.5 ? a[0] : add(a[0], ang(a[0], a[1]), Math.min(d * 0.5, 12)), W.ua + 3.5, C.shirt);
    });
    return s;
  }

  function sweat(p, op) {
    if (op <= 0.01) return '';
    return '<g transform="translate(' + f(p[0]) + ' ' + f(p[1]) + ')" opacity="' + f(op) + '">' +
      '<path d="M0 -6C2.6 -2.6 4.2 0 4.2 1.9A4.2 4.2 0 0 1 -4.2 1.9C-4.2 0 -2.6 -2.6 0 -6Z" fill="' + C.drop + '"' + inked(2) + '/>' +
      '<circle cx="-1.4" cy="1.4" r="1.1" fill="#FFFFFF"/></g>';
  }
  // speed lines trailing behind a moving body
  function speedLines(x, y, t, n) {
    var s = '', i;
    for (i = 0; i < (n || 3); i++) {
      var u = ((t * 1.6 + i * 0.37) % 1), len = 16 - i * 3;
      s += ln([x - u * 14, y + i * 13], [x - u * 14 - len, y + i * 13], 3, C.lines, ' opacity="' + f(0.8 * (1 - u)) + '"');
    }
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
    else s += box(64, by + 9, 16, 6, 2, C.frameDk) + box(242, by + 9, 16, 6, 2, C.frameDk);
    var top = [front[0] - 14, 104];
    s += steel([front[0] - 2, front[1]], top, 8);
    s += '<g' + tf + '>' + box(52, by - 1, 218, 13, 6.5, C.frame, 2.8) +
      rect(58, by - 3, 206, 5, 2.5, C.belt, inked(2)) +
      '<line x1="62" y1="' + (by - 0.5) + '" x2="260" y2="' + (by - 0.5) + '" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="7 15" stroke-dashoffset="' + off + '" opacity="0.6"/>' +
      rect(56, by + 5, 210, 3, 1.5, C.acc) + '</g>';
    s += '<g transform="rotate(-20 ' + f(top[0]) + ' ' + f(top[1]) + ')">' + box(top[0] - 17, top[1] - 9, 36, 14, 4, C.white, 2.8) +
      rect(top[0] - 11, top[1] - 5, 22, 6, 2, C.acc, inked(1.8)) + '</g>';
    s += steel2([top[0] - 4, 128], [196, 130], 6) + steel2([198, 130], [198, 140], 5);
    return s;
  }

  var CR = [168, 182];
  function bikeFrame(J, c) {
    var s = '';
    s += steel([100, FL - 4], [150, FL - 4], 7) + steel([186, FL - 4], [246, FL - 4], 7);
    s += steel([126, FL - 4], [148, 178], 7) + steel([148, 178], [140, 136], 7);
    s += steel([148, 178], CR, 7) + steel(CR, [214, 178], 6);
    s += steel([216, FL - 4], [202, 108], 8);
    s += dot([214, 178], 22, C.white, 2.8) + '<circle cx="214" cy="178" r="15" fill="none" stroke="' + C.acc + '" stroke-width="6"/>' +
      '<circle cx="214" cy="178" r="15" fill="none"' + inked(1.6) + ' stroke-dasharray="4 8" transform="rotate(' + f(c.ph * 360) + ' 214 178)"/>' + dot([214, 178], 4, C.frameDk, 2);
    s += steel([202, 108], [214, 102], 6) + dot([214, 102], 4.5, C.white, 2.2);
    s += pad([126, 133], [152, 133], 10);
    var pn = add(CR, c.ph * 360, 17);
    s += dot(CR, 7.5, C.frameDk, 2.4) + steel2(CR, pn, 5) + steel2([pn[0] - 6, pn[1]], [pn[0] + 6, pn[1]], 5);
    return s;
  }
  function bikeFarCrank(c) {
    var pf = add(CR, c.ph * 360 + 180, 17);
    return tube(CR, pf, 4, C.frameDk, 4) + tube([pf[0] - 6, pf[1]], [pf[0] + 6, pf[1]], 4, C.frameDk, 4);
  }

  function seatedBase(x1, x2, y, post) {
    return steel([post - 30, FL - 3], [post + 30, FL - 3], 6) + steel([post, y], [post, FL - 4], 7) + pad([x1, y], [x2, y], 11);
  }
  function column(x, y, w) { // cable column frame, open (no stack)
    return box(x, y, w, FL - y, 3, C.white, 3) + rect(x + 4, y + 4, w - 8, FL - y - 8, 2, C.frame) + steel([x - 14, FL - 3], [x + w + 14, FL - 3], 6);
  }

  /* ---------------- exercises ---------------- */
  var EX = {};
  function def(id, o) { o.hi = hiSet(o.hi); EX[id] = o; }

  // all-fours base: knees under hips, hands under shoulders
  var QUAD = { hx: 112, hy: 161, t: -18, sb: 0, n: -8, lnT: 90, lnS: 180, lnf: 180, anx: 164, any: 207 };
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
      return gait(ph, { hx: 146, hy: 117, t: -78, A: 28, lift: 22, bob: 2.5, sw: 38, fb: 88, n: -84, ground: function () { return 193; } });
    },
    under: function (J, c) { return treadmill(c.t, 0, 4 * 28 / 0.8) + speedLines(100, 74, c.t); }
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
      var pn = add(CR, ph * 360, 17), pf = add(CR, ph * 360 + 180, 17);
      return { hx: 140, hy: 124, t: -68, sb: 0, n: -78, lnx: pn[0] - 9, lny: pn[1] - 4, lnf: 15,
        lfx: pf[0] - 9, lfy: pf[1] - 4, lff: 15, anx: 210, any: 102 };
    },
    under: function (J, c) { return bikeFarCrank(c) + speedLines(92, 82, c.t); },
    mid: bikeFrame
  });

  def('cat_cow', {
    dur: 7, hi: ['core'], fdx: 6, sh: [120, 80], mat: [40, 230],
    kf: [
      { p: QUAD, w: 1 },
      { p: { sb: 17, n: -50 }, w: 0.6 },
      { p: { sb: 17, n: -50 }, w: 1 },
      { p: { sb: 0, n: -8 }, w: 1 },
      { p: { sb: -22, n: 40 }, w: 0.6 },
      { p: { sb: -22, n: 40 }, w: 1 }
    ]
  });

  // Bird dog: FK limbs; each switch passes through a "tuck" so hand and knee lift clear of the floor.
  var BD0 = { anU: 87, anL: 87, afU: 87, afL: 87, lnT: 90, lnS: 180, lnf: 180, lfT: 90, lfS: 180, lff: 180 };
  var BD_T1 = { anU: 112, anL: 48, lfT: 122, lfS: 206, lff: 150 }, BD_X1 = { anU: -4, anL: -4, lfT: 178, lfS: 178, lff: 100 };
  var BD_T2 = { afU: 112, afL: 48, lnT: 122, lnS: 206, lnf: 150 }, BD_X2 = { afU: -4, afL: -4, lnT: 178, lnS: 178, lnf: 100 };
  def('bird_dog', {
    dur: 10.6, hi: ['core'], fdx: 6, sh: [120, 90], mat: [30, 260],
    kf: [
      { p: merge(QUAD, BD0), w: 0.8 }, { p: {}, w: 0.6 },
      { p: BD_T1, w: 0.9 }, { p: BD_X1, w: 1.3 }, { p: {}, w: 0.9 }, { p: BD_T1, w: 0.6 },
      { p: BD0, w: 0.8 }, { p: {}, w: 0.6 },
      { p: BD_T2, w: 0.9 }, { p: BD_X2, w: 1.3 }, { p: {}, w: 0.9 }, { p: BD_T2, w: 0.6 }
    ]
  });

  // Dead bug: FK so arms stay straight and legs keep a clean tabletop.
  var DB0 = { anU: -90, anL: -90, afU: -90, afL: -90, lnT: -90, lnS: 0, lfT: -90, lfS: 0 };
  def('dead_bug', {
    dur: 10, hi: ['core'], sh: [150, 100], mat: [40, 270],
    kf: [
      { p: merge(SUPINE, DB0), w: 1.4 },
      { p: { anU: -172, anL: -172, lfT: -14, lfS: -9 }, w: 0.7 },
      { p: {}, w: 1.4 },
      { p: DB0, w: 1.4 },
      { p: { afU: -172, afL: -172, lnT: -14, lnS: -9 }, w: 0.7 },
      { p: {}, w: 1.4 }
    ]
  });

  def('glute_bridge', {
    dur: 5, hi: ['thighs', 'core'], sh: [150, 90], mat: [50, 240],
    A: merge(SUPINE, { lnx: 198, lny: 204, anx: 168, any: 205 }),
    B: { hx: 145, hy: 174, t: 150 },
    ws: [1.6, 1, 1.8, 0.6]
  });

  def('mcgill_curl_up', {
    dur: 6, hi: ['core'], sh: [160, 100], mat: [40, 286],
    A: merge(SUPINE, { lnx: 196, lny: 204, lfx: 268, lfy: 204, lff: -10, anx: 160, any: 203, anb: -1 }),
    B: { t: 188, n: 186 },
    ws: [1.2, 2, 1.4, 1]
  });

  def('side_plank_knee', {
    dur: 5.5, hi: ['core'], sh: [150, 90], mat: [40, 262],
    A: { hx: 165, hy: 199, t: -30, sb: 0, n: -30, lnx: 84, lny: 183, lnf: -170, anx: 240, any: 204, afx: 214, afy: 96 },
    B: { hx: 160.7, hy: 189.4, t: -18.4, n: -18 },
    ws: [1.4, 2, 1.4, 0.8]
  });

  def('front_plank_knee', {
    dur: 4, hi: ['core'], fdx: 5, sh: [150, 90], mat: [40, 262],
    A: { hx: 150.7, hy: 190, t: -18.4, sb: 0, n: -16, lnx: 73.6, lny: 182, lnf: -165, anx: 230, any: 203 },
    B: { hy: 188.6, sb: 3, n: -14 },
    ws: [1.6, 0.3, 1.6, 0.5]
  });

  // Pallof press: front view so the cable column is visible beside him and the cable pulls sideways.
  def('pallof_press', {
    dur: 6, sh: [176, 70], ws: [1.4, 1.6, 1.6, 0.6],
    custom: function (ph, t) {
      var e = env(ph, [1.4, 1.6, 1.6, 0.6]), cx = 184, shY = 82, hipY = 132, s = '';
      var pul = [58, 104];
      s += stack(26, 24, 40, e * 10) + steel([20, FL - 3], [76, FL - 3], 6) + steel([66, 24], [66, 110], 6) + pulley(pul);
      // hands at the sternum, then pressed straight out toward the viewer (grow + elbows tuck)
      var hand = [lerp(cx - 2, cx - 1, e), lerp(shY + 20, shY + 22, e)], hr = lerp(6.5, 9.5, e);
      var elL = [lerp(cx - 24, cx - 11, e), lerp(shY + 30, shY + 20, e)], elR = [lerp(cx + 24, cx + 11, e), lerp(shY + 30, shY + 20, e)];
      var legs = [[[cx - 9, hipY], [cx - 13, 170], [cx - 14, 206]], [[cx + 9, hipY], [cx + 13, 170], [cx + 14, 206]]];
      var arms = [[[cx - 19, shY + 2], elL, [hand[0] - 3, hand[1]], hr], [[cx + 19, shY + 2], elR, [hand[0] + 3, hand[1] + 1], hr]];
      s += frontFig({ cx: cx, sh: shY, hip: hipY, legs: legs, arms: [arms[1]] });
      // cable runs in from the side to the handle; near (left) arm drawn over it
      var hdl = [hand[0] - 2, hand[1]];
      s += cable(add(pul, 0, 6), hdl) + steel2([hdl[0] - 5, hdl[1] - 6], [hdl[0] - 5, hdl[1] + 6], 4);
      var a = arms[0];
      s += ln(a[0], a[1], W.ua + OW, INK) + ln(a[1], a[2], W.fa + OW, INK) + cir(a[2], hr + OW / 2, INK) +
        ln(a[0], a[1], W.ua, C.skin) + ln(a[1], a[2], W.fa, C.skin) + tube(a[0], add(a[0], ang(a[0], a[1]), Math.min(dist(a[0], a[1]) * 0.5, 12)), W.ua + 3.5, C.shirt);
      s += cir(hand, hr + OW / 2, INK) + cir(hand, hr, C.skin) + cir([hand[0] + hr * 0.25, hand[1] + 1], hr * 0.95, C.skin);
      // brace cue: short "push" ticks around the hands at full press
      if (e > 0.6) {
        var op = f((e - 0.6) / 0.4 * 0.9);
        [150, 115, 65, 30].forEach(function (aa) { s += ln(add(hand, aa, hr + 7), add(hand, aa, hr + 13), 2.6, INK, ' opacity="' + op + '"'); });
      }
      s += sweat([cx + 18, shY - 40], (e - 0.85) / 0.15);
      return s;
    }
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
      s += backPad(J, 18, 8, 26, 13) + pad([98, 178], [132, 175], 11);
      var P = add(J.lN.a, -45, 7), cr = add(P, 45, 12);
      s += steel(add(cr, -45, -10), add(cr, -45, 14), 9);
      s += dot(add(cr, 45, 12), 13, C.white, 2.6) + dot(add(cr, 45, 12), 6, C.acc, 2);
      s += tube(add(P, -135, 24), add(P, 45, 14), 7, C.frameDk);
      return s;
    },
    pre: function () { return steel2([126, 168], [134, 178], 5); }
  });

  def('box_squat_db', {
    dur: 5.5, hi: ['legs'], sh: [140, 80],
    A: { hx: 142, hy: 120, t: -88, sb: 0, n: -88, lnx: 160, lny: 205, lfx: 155, lfy: 205, anx: 157, any: 95 },
    B: { hx: 116, hy: 160, t: -62, n: -74, anx: 151, any: 136 },
    ws: [2, 0.5, 1.6, 0.6],
    under: function () {
      return box(78, 170, 48, 42, 5, C.white, 2.8) + rect(82, 174, 40, 7, 3, C.acc);
    },
    pre: function (J) { return dumbbell([J.aN.w[0] + 3, J.aN.w[1] + 4], 90); }
  });

  function curlRig(J, front) {
    var knee = J.lN.k, a = J.lN.a, sa = ang(knee, a);
    var roll = add(add(a, sa, -5), sa + (front ? -90 : 90), 11);
    return steel(knee, roll, 6) + dot(knee, 5, C.frameDk, 2.2) + dot(roll, 8, C.acc, 2.6);
  }
  def('leg_curl_seated', {
    dur: 4.5, hi: ['legs'], fdx: 3, sh: [160, 90],
    A: seated(158, -100, { lnS: 14, anx: 134, any: 172 }),
    B: { lnS: 100 },
    ws: [1.4, 0.5, 2, 0.5],
    under: function (J) {
      return seatedBase(98, 162, 170, 128) + backPad(J, 18, 6, 20, 12) + steel([200, 120], [200, FL - 4], 7) + steel([170, FL - 3], [230, FL - 3], 6);
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
      return seatedBase(98, 162, 170, 128) + backPad(J, 18, 6, 20, 12);
    },
    pre: function (J) { return curlRig(J, true); },
    over: function () { return steel2([128, 165], [136, 176], 5); }
  });

  def('hip_abduction', {
    dur: 4.5, sh: [160, 70], ws: [1.3, 0.6, 1.9, 0.5],
    custom: function (ph) {
      var e = env(ph, [1.3, 0.6, 1.9, 0.5]), th = 6 + 27 * e, cx = 160, s = '';
      // machine (front view)
      s += steel([104, FL - 3], [216, FL - 3], 7) + steel([cx, 172], [cx, FL - 4], 9);
      s += box(126, 60, 68, 102, 14, C.frame, 2.8) + rect(133, 67, 54, 88, 10, C.acc, inked(2.2));
      s += box(110, 154, 100, 14, 7, C.acc, 2.8);
      var legs = [], arms = [], pads = '';
      [-1, 1].forEach(function (sg) {
        var hip = [cx + sg * 10, 156];
        var knee = [hip[0] + sg * (4 + L.th * Math.sin(rad(th))), 164];
        var an = [knee[0] - sg * 3, 164 + Math.sqrt(L.sh * L.sh - 9) - 2];
        legs.push([hip, knee, an]);
        arms.push([[cx + sg * 19, 106], [cx + sg * 27, 132], [cx + sg * 31, 156]]);
        var px = knee[0] + sg * 16;
        pads += steel([px, 178], [cx + sg * 12, 196], 6) + pad([px, 148], [px, 178], 12);
        s += steel2([cx + sg * 31, 160], [cx + sg * 37, 176], 5);
      });
      s += frontFig({ cx: cx, sh: 104, hip: 156, legs: legs, arms: arms, shortLen: 1, hiThighs: true });
      s += pads;
      s += sweat([cx + 17, 60], (e - 0.85) / 0.15);
      return s;
    }
  });

  function calfPose(e) {
    var phi = lerp(-15, 40, e), toe = [172, 194], an = add(toe, phi, -L.ft);
    var hip = [an[0], an[1] - L.th - L.sh], S = [hip[0], hip[1] - L.torso];
    return { hx: hip[0], hy: hip[1], t: -90, sb: 0, n: -90, lnT: 90, lnS: 90, lnf: phi,
      anx: S[0] + 15, any: S[1] - 5 };
  }
  def('calf_raise_machine', {
    dur: 4, hi: ['calves'], fdx: -4, sh: [150, 80], ws: [1.2, 0.6, 1.6, 0.5],
    pose: function (ph) { return calfPose(env(ph, [1.2, 0.6, 1.6, 0.5])); },
    under: function (J) {
      var S = J.S, s = '';
      s += stack(56, 30, 38, (S[1] < 60 ? 61.5 - S[1] : 0) * 1.4);
      s += steel([108, 22], [108, FL - 3], 8) + steel([92, FL - 3], [196, FL - 3], 6);
      s += box(138, 199, 46, 13, 3, C.frameDk, 2.6);
      s += steel([108, S[1] - 2], [S[0] - 8, S[1] - 2], 7);
      return s;
    },
    over: function (J) { var S = J.S; return pad([S[0] - 12, S[1] - 2], [S[0] + 7, S[1] - 2], 11); }
  });

  var SEAT_HY = 165;
  function seatedRig(J) { return seatedBase(106, 158, 177, 132) + backPad(J, 18, 8, 22, 12); }

  def('lat_pulldown', {
    dur: 5, hi: ['upperarms', 'core'], fdx: 3, sh: [180, 110],
    A: { hx: 138, hy: SEAT_HY, t: -100, sb: 0, n: -86, lnT: 0, lnS: 90, anx: 152, any: 38 },
    B: { t: -105, n: -80, anx: 147, any: 117 },
    ws: [1.5, 0.5, 2.2, 0.5],
    under: function (J) {
      var s = seatedBase(110, 160, 177, 136);
      s += steel([240, 140], [196, 140], 6) + steel([196, 140], [196, 152], 6);
      s += stack(240, 40, 38, (J.aN.w[1] - 52) * 0.6);
      s += steel([259, 40], [259, 12], 8) + steel([259, 14], [150, 14], 8) + pulley([150, 22]);
      return s;
    },
    over: function (J) {
      var w = J.aN.w, s = cable([150, 28], [w[0] + 2, w[1] - 4]);
      s += pathTube('M' + f(w[0] - 20) + ' ' + f(w[1] + 8) + 'Q' + f(w[0]) + ' ' + f(w[1] - 4) + ' ' + f(w[0] + 20) + ' ' + f(w[1] + 8), 4, C.white, 3.5);
      s += pad([176, 150], [196, 150], 11);
      return s;
    }
  });

  def('seated_cable_row', {
    dur: 5, hi: ['upperarms', 'core'], fdx: 3, sh: [160, 120],
    A: { hx: 108, hy: 184, t: -90, sb: 0, n: -88, lnx: 186, lny: 176, lnf: -72, anx: 172, any: 154 },
    B: { t: -92, anx: 126, any: 156 },
    ws: [1.4, 0.6, 2.1, 0.6],
    under: function (J) {
      var s = '';
      s += steel([70, 202], [70, FL - 2], 6) + steel([160, 202], [160, FL - 2], 6) + pad([54, 198], [178, 198], 10);
      s += steel([176, 205], [236, 205], 6) + steel([196, 204], [208, 160], 7) + steel([208, 160], [230, 160], 6);
      s += stack(236, 40, 40, (176 - J.aN.w[0]) * 0.5);
      s += pulley([232, 156]);
      return s;
    },
    pre: function (J) { return cable([232, 156], J.aN.w); },
    over: function (J) {
      var w = J.aN.w;
      return pathTube('M' + f(w[0] + 5) + ' ' + f(w[1]) + 'L' + f(w[0] - 2) + ' ' + f(w[1] - 8) + 'L' + f(w[0] - 2) + ' ' + f(w[1] + 8) + 'Z', 3, C.white, 3.5);
    }
  });

  def('chest_press_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [170, 110],
    A: seated(SEAT_HY, -100, { anx: 140, any: 122 }),
    B: { anx: 181, any: 122 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      return seatedRig(J) + stack(244, 40, 38, (J.aN.w[0] - 140) * 0.5) + steel([244, 122], [226, 122], 8);
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([w[0] + 4, w[1]], [228, w[1]], 6) + box(w[0] - 4, w[1] - 11, 8, 22, 4, C.white, 2.5);
    }
  });

  def('shoulder_press_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [160, 100],
    A: seated(SEAT_HY, -95, { anx: 152, any: 110 }),
    B: { anx: 148, any: 54 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      var s = seatedRig(J) + backPad(J, 18, -48, 40, 12);
      s += steel([196, FL - 3], [242, FL - 3], 6) + steel([218, FL - 3], [218, 112], 8) + dot([216, 116], 6, C.frameDk, 2.4);
      return s;
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([216, 116], [w[0] + 4, w[1]], 6) + box(w[0] - 4, w[1] - 11, 8, 22, 4, C.white, 2.5);
    }
  });

  // Face pull: the upper arm swings out to the side at shoulder height (seen end-on, so it shortens
  // through zero) while the forearm rotates up — finishing elbows high, hands beside the head.
  // Far shoulder offset (fdx) gives a slight 3/4 read so the far hand shows behind the head.
  var FP_P = [228, 60];
  function fpKnot(J) { var w = J.aN.w; return add(w, ang(w, FP_P), Math.min(16, dist(w, FP_P) * 0.3)); }
  def('face_pull', {
    dur: 5, hi: ['upperarms'], fdx: -9, sh: [170, 100],
    A: { hx: 130, hy: 120, t: -92, sb: 0, n: -88, lnx: 140, lny: 205, lfx: 122, lfy: 205,
      anU: -4, anL: -4, afU: -4, afL: -4, us: 1, fus: 1 },
    B: { t: -94, anU: -4, anL: -72, afU: -4, afL: -80, us: -0.48, fus: -0.68, fs: 0.68, ffs: 0.68 },
    ws: [1.4, 0.8, 2, 0.5],
    under: function () {
      return column(232, 22, 18) + rect(236, 150, 10, 56, 2, C.acc, inked(1.8)) + pulley(FP_P);
    },
    mid: function (J) { var k = fpKnot(J); return rope(k, J.aF.w); },
    over: function (J) { var k = fpKnot(J); return rope(FP_P, k) + rope(k, J.aN.w) + dot(k, 3.4, C.acc, 2); }
  });

  def('db_curl_seated', {
    dur: 4.5, hi: ['arms'], fdx: 3, sh: [140, 80],
    A: seated(SEAT_HY, -95, { anU: 99, anL: 86 }),
    B: { anL: -38 },
    ws: [1.4, 0.4, 2.1, 0.6],
    under: function (J) { return seatedRig(J) + backPad(J, 18, -48, 20, 12); },
    over: function (J) { var w = J.aN.w; return dumbbell(w, ang(J.aN.e, w) + 90); }
  });

  def('tricep_pushdown', {
    dur: 4.5, hi: ['arms'], fdx: 0, sh: [170, 100],
    A: { hx: 130, hy: 120, t: -82, sb: 0, n: -84, lnx: 142, lny: 205, lfx: 122, lfy: 205, anU: 93, anL: -40 },
    B: { anL: 86 },
    ws: [1.3, 0.5, 2, 0.6],
    under: function (J) {
      return stack(232, 26, 30, (J.aN.w[1] - 80) * 0.25) + steel([218, FL - 3], [276, FL - 3], 6) +
        steel([246, 26], [246, 14], 7) + steel([246, 16], [186, 16], 7) + pulley([186, 24]);
    },
    over: function (J) {
      var w = J.aN.w, k = [w[0] + 2, w[1] - 11];
      return cable([186, 30], k) + rope(k, [w[0] - 4, w[1] + 5]) + rope(k, [w[0] + 6, w[1] + 5]) + dot(k, 3.2, C.acc, 2);
    }
  });

  def('knee_to_chest_stretch', {
    dur: 7, hi: ['thighN'], sh: [160, 100], mat: [40, 286],
    pose: function (ph) {
      var e = env(ph, [2.5, 2, 2.5, 0.8]), T = lerp(-100, -124, e), Sx = lerp(40, 52, e);
      var knee = add([152, 200], T, L.th), hand = add(knee, Sx, 10);
      return merge(SUPINE, { lnT: T, lnS: Sx, lfx: 268, lfy: 204, lff: -10, anx: hand[0], any: hand[1], anb: -1 });
    }
  });

  def('hip_flexor_stretch', {
    dur: 7, hi: ['thighN'], sh: [140, 80], mat: [40, 240],
    pose: function (ph) {
      var e = env(ph, [2.5, 2, 2.5, 0.8]), knee = [120, 201], a = lerp(-80, -60, e), hip = add(knee, a, L.th);
      return { hx: hip[0], hy: hip[1], t: -90 - 2 * e, sb: -2 * e, n: -88, lnT: a + 180, lnS: 180, lnf: 180,
        lfx: 186, lfy: 204, lff: 0, anU: 112, anL: 18 };
    },
    under: function () { return box(104, 202, 34, 8, 4, C.acc, 2.4); }
  });

  def('child_pose', {
    dur: 9, hi: ['core'], sh: [150, 100], mat: [40, 262],
    pose: function (ph) {
      var e = env(ph, [3, 2.5, 2.5, 1]), knee = [140, 201], a = lerp(-90, -160, e), hip = add(knee, a, L.th);
      return { hx: hip[0], hy: hip[1], t: lerp(-6, 2, e), sb: lerp(0, -6, e), n: lerp(10, 30, e),
        lnT: a + 180, lnS: 180, lnf: 180, anx: 230, any: 203 };
    },
    fdx: 5
  });

  /* ---------- standing / upper-body additions ---------- */
  // Upright standing base: neutral spine, soft knees, feet under hips.
  function stand(extra) {
    return merge({ hx: 146, hy: 121, t: -90, sb: 0, n: -88, lnx: 156, lny: 205, lfx: 142, lfy: 205 }, extra || {});
  }

  // Shoulder pass-through, front 3/4 view. The dowel lies along the shoulder axis — the axis the
  // arc rotates about — so it keeps one screen direction (PT_AX, toward the far side) while the
  // straight arms sweep from the hips, over the head, to the lower back.
  var PT_AX = [0.94, -0.28];
  function ptOff(p, k) { return [p[0] + PT_AX[0] * k, p[1] + PT_AX[1] * k]; }
  def('bar_pass_through', {
    dur: 9, fdx: 7, sh: [150, 70],
    custom: function (ph) {
      var e = env(ph, [2.6, 0.7, 2.6, 0.8]), th = lerp(78, -246, e);
      var J = solve(stand({ hx: 140, lnx: 150, lfx: 136 }), 7), S = J.S, Mc = ptOff(S, 6), av = dir(th);
      av = [av[0] * 54, av[1] * 52];
      function at(k) { var p = ptOff(Mc, k); return [p[0] + av[0], p[1] + av[1]]; }
      var nh = at(-15), fh = at(15), fs = ptOff(S, 12);
      J.aN = { r: S, e: mid(S, nh, 0.5), w: nh };
      J.aF = { r: fs, e: mid(fs, fh, 0.5), w: fh };
      var rod = tube(at(-33), at(33), 3.2, C.white, 3.5) + tube(at(-33), at(-29), 3.2, C.acc, 3.5) + tube(at(29), at(33), 3.2, C.acc, 3.5);
      var front = Math.cos(rad(th)) > 0.05 || th > 0; // dowel in front of the body: draw over the torso
      var s = front ? '' : rod;
      s += drawFig(J, EX.bar_pass_through.hi, '', front ? rod : '');
      return s;
    }
  });

  // Light dumbbell front raise, alternating arms; straight-ish arms to shoulder height, ribs down.
  def('light_db_raise', {
    dur: 7, hi: ['upperarms'], fdx: 4, sh: [150, 70],
    pose: function (ph) {
      var a = env(ph, [1.3, 0.4, 1.5, 3.8]), b = env((ph + 0.5) % 1, [1.3, 0.4, 1.5, 3.8]);
      var ua = lerp(84, 2, a), fa = lerp(84, 2, b);
      return stand({ hy: 123, n: -88, anU: ua, anL: ua - 10 * a, afU: fa, afL: fa - 10 * b });
    },
    mid: function (J) { var w = J.aF.w; return dumbbell(w, ang(J.aF.e, w) + 90); },
    over: function (J) { var w = J.aN.w; return dumbbell(w, ang(J.aN.e, w) + 90); }
  });

  // Seated preacher curl machine: upper arms rest on an angled pad; handles ride a lever that
  // pivots at the elbow; a plate-loaded horn on the lever swings with it.
  def('preacher_curl_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [170, 110],
    A: { hx: 130, hy: SEAT_HY, t: -86, sb: 0, n: -84, lnx: 176, lny: 205, anU: 38, anL: 40 },
    B: { anL: -78 },
    ws: [1.4, 0.4, 2.3, 0.6],
    under: function (J) {
      var e = J.aN.e, w = J.aN.w, s = seatedBase(104, 154, 177, 128);
      var lift = Math.max(0, (e[1] - w[1]) + 20) * 0.45;
      s += stack(240, 40, 36, lift) + steel([226, FL - 3], [290, FL - 3], 6);
      s += steel([258, 40], [258, 28], 7) + steel([258, 30], [214, 30], 7) + pulley([214, 36]);
      return s;
    },
    pre: function (J) {
      // angled pad under the upper arm, on a frame that runs forward to the machine
      var r = J.aN.r, e = J.aN.e, a = ang(r, e), o = a + 90, s = '';
      var p1 = add(add(r, a, 2), o, 11), p2 = add(add(e, a, 8), o, 11);
      s += steel(add(p2, o, 3), [234, add(p2, o, 3)[1]], 7) + steel([234, add(p2, o, 3)[1]], [234, FL - 4], 7);
      // pad sits in front of the (accent-coloured) shirt, so it is white with an accent top face
      s += padW(p1, p2, 16);
      // lever rides just outside the forearm, from the pivot to the handle
      var e2 = J.aN.e, w2 = J.aN.w, la2 = ang(e2, w2);
      s += steel(add(e2, la2 - 90, 4), add(add(w2, la2, 3), la2 - 90, 4), 6);
      return s;
    },
    over: function (J) {
      var e = J.aN.e, w = J.aN.w, la = ang(e, w), s = '';
      var cam = 6.5;
      s += cable([214, 42], add(e, la + 90, cam));
      s += dot(e, cam, C.white, 2.4) + '<circle cx="' + f(e[0]) + '" cy="' + f(e[1]) + '" r="4.6" fill="none" stroke="' + C.acc + '" stroke-width="3"/>';
      s += dot(e, 2.4, C.frameDk, 1.6);
      s += steel2(add(w, la + 90, -7), add(w, la + 90, 7), 5);
      s += cir(w, W.hand + OW / 2, INK) + cir(w, W.hand, C.skin);
      return s;
    }
  });

  // Wrist roller on a wall bracket: arms forward at chest height, wrists alternately curl the
  // handle; each curl winds the rope and lifts the plate, then it unwinds slowly.
  var WR_R = [186, 90], WR_N = 8;
  function wrState(ph) {
    var up = 0.5, x, k, u, h, near;
    if (ph < up) { x = ph / up * WR_N; k = Math.floor(x); u = ease(x - k); h = (k + u) / WR_N; }
    else if (ph < up + 0.06) { k = WR_N; u = 0; h = 1; }
    else { x = clamp01((ph - up - 0.06) / (1 - up - 0.12)) * WR_N; k = Math.floor(x); u = ease(x - k); h = 1 - (k + u) / WR_N; k += WR_N; }
    near = (k % 2 === 0) ? lerp(-28, 34, u) : lerp(34, -28, u);
    if (h >= 1 && ph < up + 0.06) near = -28;
    if (h <= 0 && ph >= 1 - 0.06) near = -28;
    return { h: clamp01(h), nf: near, ff: 6 - near, rot: h * 540 };
  }
  function wrWrist(fl, dx) { return add([WR_R[0] + (dx || 0), WR_R[1]], 180 + fl, 8); }
  function wrFist(w, fl, dx) {
    var c = [WR_R[0] + (dx || 0), WR_R[1]], k = add(c, fl - 20, 4);
    return tube(w, k, 11, C.skin) + ln(add(k, fl + 60, 3), add(k, fl + 140, 3), 1.6, INK, ' opacity="0.5"');
  }
  def('wrist_roller', {
    dur: 12, hi: ['faN', 'faF'], fdx: -3, sh: [160, 90],
    pose: function (ph) {
      var st = wrState(ph), wn = wrWrist(st.nf), wf = wrWrist(st.ff, -3);
      return stand({ hx: 134, lnx: 144, lfx: 130, anx: wn[0], any: wn[1], afx: wf[0] + 3, afy: wf[1] });
    },
    under: function (J, c) {
      var st = wrState(c.ph), x = WR_R[0] + 9, py = lerp(194, 146, st.h), s = '';
      s += steel([226, FL - 3], [270, FL - 3], 6) + steel([248, FL - 4], [248, 58], 9) + steel([248, 64], [WR_R[0], 64], 7) + steel([WR_R[0], 64], WR_R, 6);
      s += rope([x, WR_R[1]], [x, py - 9]);
      s += dot([x, py], 12, C.white, 2.6) + '<circle cx="' + f(x) + '" cy="' + f(py) + '" r="7.5" fill="none" stroke="' + C.acc + '" stroke-width="3.5"/>' + dot([x, py - 8], 2.2, C.frameDk, 1.6);
      return s;
    },
    mid: function (J, c) {
      var st = wrState(c.ph), r = st.rot, s = wrFist(J.aF.w, st.ff, -3);
      s += dot(WR_R, 9.5, C.white, 2.6) + '<circle cx="' + WR_R[0] + '" cy="' + WR_R[1] + '" r="6.2" fill="none" stroke="' + C.acc + '" stroke-width="3"/>';
      s += ln(add(WR_R, r, 2), add(WR_R, r, 8), 2, INK) + ln(add(WR_R, r + 180, 2), add(WR_R, r + 180, 8), 2, INK);
      return s;
    },
    over: function (J, c) { var st = wrState(c.ph); return wrFist(J.aN.w, st.nf); }
  });

  /* ---------- push / pull machine additions ---------- */
  // Pad that sits in front of the accent-coloured shirt: white body, accent face on the 'top' side.
  function padW(a, b, w, top) {
    var d = ang(a, b), o = d + (top == null ? -90 : top), k = w * 0.28;
    return tube(a, b, w, C.white) + ln(add(add(a, o, k), d, 3), add(add(b, o, k), d, -3), Math.max(3, w * 0.26), C.acc);
  }
  function grip(w) { return box(w[0] - 4, w[1] - 10, 8, 20, 4, C.white, 2.5); }
  function handOver(w, r) { return cir(w, (r || W.hand) + OW / 2, INK) + cir(w, r || W.hand, C.skin); }

  // Chest-supported row: chest on a vertical pad, neutral handles pulled back, elbows close.
  def('machine_row', {
    dur: 5, hi: ['upperarms'], fdx: 3, sh: [170, 110],
    A: seated(SEAT_HY, -90, { anx: 190, any: 124 }),
    B: { anx: 146, any: 126 },
    ws: [1.4, 0.6, 2.1, 0.6],
    under: function (J) {
      var s = seatedBase(104, 154, 177, 128);
      s += stack(246, 40, 36, (190 - J.aN.w[0]) * 0.5) + steel([232, FL - 3], [290, FL - 3], 6);
      s += steel([264, 40], [264, 30], 7) + steel([264, 32], [210, 32], 7) + dot([210, 36], 5, C.frameDk, 2.2);
      s += steel([228, FL - 4], [228, 128], 7);
      return s;
    },
    pre: function (J) {
      var S = J.S, x = S[0] + 21;
      return steel([x + 4, S[1] + 30], [228, S[1] + 30], 7) + padW([x, S[1] + 10], [x, S[1] + 46], 14, 90);
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([210, 36], [w[0] + 3, w[1] - 8], 6) + grip(w) + handOver(w);
    }
  });

  // Straight-arm pulldown: fixed ~15° hip hinge, straight arms sweep from eye level to the thighs.
  def('straight_arm_pulldown', {
    dur: 5, hi: ['upperarms'], fdx: -4, sh: [160, 90],
    A: { hx: 132, hy: 124, t: -75, sb: 0, n: -78, lnx: 150, lny: 205, lfx: 136, lfy: 205, anU: -22, anL: -26 },
    B: { anU: 74, anL: 72 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      return stack(240, 26, 30, (J.aN.w[1] - 70) * 0.3) + steel([226, FL - 3], [284, FL - 3], 6) +
        steel([254, 26], [254, 14], 7) + steel([254, 16], [228, 16], 7) + pulley([228, 24]);
    },
    over: function (J) {
      var w = J.aN.w;
      return cable([228, 30], w) + steel2([w[0] - 2, w[1] - 7], [w[0] + 2, w[1] + 7], 5) + handOver(w);
    }
  });

  // Front-view seated helpers (pec deck, lateral raise, reverse fly).
  var FV = { cx: 160, sh: 104, hip: 150 };
  function fvLegs(cx) {
    return [[[cx - 10, 150], [cx - 14, 163], [cx - 17, 206]], [[cx + 10, 150], [cx + 14, 163], [cx + 17, 206]]];
  }
  function fvSeat(cx) {
    return steel([cx - 46, FL - 3], [cx + 46, FL - 3], 6) + steel([cx, 160], [cx, FL - 4], 9) + box(cx - 34, 150, 68, 14, 7, C.acc, 2.8);
  }
  function fvBack(cx, top) {
    return box(cx - 26, top, 52, 152 - top, 12, C.frame, 2.8) + rect(cx - 19, top + 7, 38, 152 - top - 14, 8, C.frameDk, inked(2.2));
  }
  function fvFrame(cx, half, top) {
    return steel([cx - half, FL - 3], [cx - half, top], 8) + steel([cx + half, FL - 3], [cx + half, top], 8) +
      steel([cx - half, top], [cx + half, top], 8) + steel([cx - half - 12, FL - 3], [cx - half + 12, FL - 3], 6) + steel([cx + half - 12, FL - 3], [cx + half + 12, FL - 3], 6);
  }

  // Pec deck: back on the pad, slightly bent arms sweep together in front of the chest.
  def('pec_deck', {
    dur: 5, sh: [160, 80], ws: [1.4, 0.6, 2.1, 0.6],
    custom: function (ph) {
      var e = env(ph, [1.4, 0.6, 2.1, 0.6]), cx = FV.cx, sh = FV.sh, s = '', arms = [], lev = '';
      s += fvFrame(cx, 78, 30) + fvBack(cx, 52) + fvSeat(cx);
      [-1, 1].forEach(function (sg) {
        var el = [cx + sg * lerp(48, 30, e), sh + lerp(4, 10, e)], hd = [cx + sg * lerp(66, 9, e), sh + lerp(-6, 4, e)], hr = lerp(6, 8, e);
        arms.push([[cx + sg * 19, sh + 2], el, hd, hr]);
        lev += steel([cx + sg * 44, 30], [hd[0], hd[1] - 12], 6) + steel2([hd[0], hd[1] - 12], [hd[0], hd[1] + 12], 5) + dot([cx + sg * 44, 30], 5, C.frameDk, 2.2);
      });
      s += frontFig({ cx: cx, sh: sh, hip: FV.hip, legs: fvLegs(cx), arms: [], shortLen: 1 });
      s += lev;
      arms.forEach(function (a) {
        s += ln(a[0], a[1], W.ua + OW, INK) + ln(a[1], a[2], W.fa + OW, INK) + ln(a[0], a[1], W.ua, C.skin) + ln(a[1], a[2], W.fa, C.skin) +
          tube(a[0], add(a[0], ang(a[0], a[1]), Math.min(dist(a[0], a[1]) * 0.5, 12)), W.ua + 3.5, C.shirt) + handOver(a[2], a[3]);
      });
      s += sweat([cx + 18, sh - 40], (e - 0.85) / 0.15);
      return s;
    }
  });

  // Seated incline press: reclined back pad, handles pressed up and forward.
  var IP_S = add([130, SEAT_HY], -112, L.torso);
  def('incline_chest_press_machine', {
    dur: 5, hi: ['arms'], fdx: 3, sh: [170, 110],
    A: seated(SEAT_HY, -112, { n: -96, anx: IP_S[0] + 22, any: IP_S[1] + 2 }),
    B: { anx: IP_S[0] + 46, any: IP_S[1] - 33 },
    ws: [1.4, 0.5, 2.2, 0.6],
    under: function (J) {
      var s = seatedBase(104, 154, 177, 128) + backPad(J, 18, 8, 30, 12);
      s += steel([128, FL - 4], add(J.H, J.P.t - 90, 20), 6);
      s += stack(246, 40, 36, (J.aN.w[0] - IP_S[0] - 22) * 0.8) + steel([232, FL - 3], [290, FL - 3], 6);
      s += steel([218, FL - 3], [218, 132], 8) + steel([218, 136], [246, 136], 6) + dot([218, 132], 6, C.frameDk, 2.4);
      return s;
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([218, 132], [w[0] + 4, w[1] + 2], 6) + grip([w[0] + 1, w[1]]) + handOver(w);
    }
  });

  // Lateral raise machine (front view): pads on the outer upper arms lift them to shoulder height.
  def('lateral_raise_machine', {
    dur: 5, sh: [160, 80], ws: [1.4, 0.6, 2.1, 0.6],
    custom: function (ph) {
      var e = env(ph, [1.4, 0.6, 2.1, 0.6]), cx = FV.cx, sh = FV.sh, s = '', arms = [], pads = '';
      var phi = lerp(10, 84, e);
      s += fvBack(cx, 52) + fvSeat(cx);
      s += steel([cx - 36, 150], [cx - 36, 60], 7) + steel([cx + 36, 150], [cx + 36, 60], 7);
      [-1, 1].forEach(function (sg) {
        var r = [cx + sg * 19, sh + 2], d = [sg * Math.sin(rad(phi)), Math.cos(rad(phi))], n = [sg * Math.cos(rad(phi)), -Math.sin(rad(phi))];
        var el = [r[0] + d[0] * 30, r[1] + d[1] * 30], hd = [el[0] - sg * 3, el[1] + 7];
        arms.push([r, el, hd, 7]);
        var a = [r[0] + d[0] * 9 + n[0] * 11, r[1] + d[1] * 9 + n[1] * 11], b = [r[0] + d[0] * 30 + n[0] * 11, r[1] + d[1] * 30 + n[1] * 11];
        var hub = [cx + sg * 36, sh - 2];
        pads += steel(hub, a, 6) + dot(hub, 6, C.frameDk, 2.4) + padW(a, b, 13, sg > 0 ? -90 : 90);
      });
      s += frontFig({ cx: cx, sh: sh, hip: FV.hip, legs: fvLegs(cx), arms: arms, shortLen: 1 });
      s += pads;
      s += sweat([cx + 18, sh - 40], (e - 0.85) / 0.15);
      return s;
    }
  });

  // Reverse pec deck (rear view): chest on the pad, straight-ish arms sweep back to shoulder line.
  def('reverse_pec_deck', {
    dur: 5, sh: [160, 80], ws: [1.4, 0.6, 2.1, 0.6],
    custom: function (ph) {
      var e = env(ph, [1.4, 0.6, 2.1, 0.6]), cx = FV.cx, sh = FV.sh, s = '';
      s += fvFrame(cx, 84, 30) + fvSeat(cx);
      // chest pad on the far side of him: only its rim shows around the torso
      s += box(cx - 24, 70, 48, 70, 12, C.frame, 2.8) + steel([cx, 140], [cx, 160], 7);
      [-1, 1].forEach(function (sg) {
        var r = [cx + sg * 19, sh + 2], el = [cx + sg * lerp(30, 48, e), sh + lerp(8, 2, e)], hd = [cx + sg * lerp(14, 76, e), sh + lerp(8, 0, e)];
        s += steel([cx + sg * 44, 30], [hd[0], hd[1] - 12], 6) + steel2([hd[0], hd[1] - 12], [hd[0], hd[1] + 12], 5) + dot([cx + sg * 44, 30], 5, C.frameDk, 2.2);
        s += ln(r, el, W.ua + OW, INK) + ln(el, hd, W.fa + OW, INK) + ln(r, el, W.ua, C.skin) + ln(el, hd, W.fa, C.skin) + handOver(hd, 6.5);
      });
      s += frontFig({ cx: cx, sh: sh, hip: FV.hip, legs: fvLegs(cx), arms: [], shortLen: 1, back: true });
      // sleeves over the shoulders, drawn after the torso so they cap the arms
      [-1, 1].forEach(function (sg) {
        var r = [cx + sg * 19, sh + 2], el = [cx + sg * lerp(30, 48, e), sh + lerp(8, 2, e)];
        s += tube(r, add(r, ang(r, el), Math.min(dist(r, el) * 0.5, 12)), W.ua + 3.5, C.shirt);
      });
      s += sweat([cx + 18, sh - 40], (e - 0.85) / 0.15);
      return s;
    }
  });

  // Standing cable curl: low pulley, straight bar, elbows pinned at the sides.
  def('cable_curl', {
    dur: 4.5, hi: ['arms'], fdx: -3, sh: [170, 100],
    A: stand({ hx: 134, lnx: 144, lfx: 128, anU: 96, anL: 78 }),
    B: { anL: -52 },
    ws: [1.3, 0.5, 2.1, 0.6],
    under: function (J) {
      return stack(244, 30, 30, (190 - J.aN.w[1]) * 0.3) + steel([230, FL - 3], [288, FL - 3], 6) + pulley([236, 202]);
    },
    over: function (J) {
      var w = J.aN.w;
      return cable([230, 202], w) + dot([w[0] + 1, w[1] + 1], 4.5, C.white, 2.4) + handOver(w);
    }
  });

  // Seated hammer curl, back supported: neutral grip (thumbs up), arms alternate.
  def('hammer_curl_seated', {
    dur: 7, hi: ['arms'], fdx: 3, sh: [140, 80],
    pose: function (ph) {
      var a = env(ph, [1.3, 0.4, 1.6, 3.7]), b = env((ph + 0.5) % 1, [1.3, 0.4, 1.6, 3.7]);
      return seated(SEAT_HY, -95, { anU: 99, anL: lerp(86, -38, a), afU: 99, afL: lerp(86, -38, b) });
    },
    under: function (J) { return seatedRig(J) + backPad(J, 18, -48, 20, 12); },
    mid: function (J) { var w = J.aF.w; return dumbbell(w, ang(J.aF.e, w) + 90); },
    over: function (J) {
      var w = J.aN.w, a = ang(J.aN.e, w);
      // thumb on top of the fist marks the neutral grip
      return dumbbell(w, a + 90) + handOver(w) + tube(add(w, a - 90, 5), add(add(w, a - 90, 7), a, 3), 4, C.skin, 3.5);
    }
  });

  // Seated dip machine: back on the pad, handles beside the hips pressed straight down.
  def('seated_dip_machine', {
    dur: 4.5, hi: ['arms'], fdx: 3, sh: [160, 100],
    A: seated(SEAT_HY, -95, { anx: 142, any: 128 }),
    B: { anx: 140, any: 160 },
    ws: [1.3, 0.5, 2.1, 0.6],
    under: function (J) {
      var s = seatedRig(J) + backPad(J, 18, -48, 20, 12);
      s += stack(244, 40, 36, (J.aN.w[1] - 128) * 0.9) + steel([230, FL - 3], [290, FL - 3], 6);
      s += steel([214, FL - 3], [214, 100], 8) + steel([214, 104], [244, 104], 6) + dot([214, 100], 6, C.frameDk, 2.4);
      return s;
    },
    over: function (J) {
      var w = J.aN.w;
      return steel([214, 100], [w[0] + 4, w[1]], 6) + box(w[0] - 6, w[1] - 4, 12, 8, 4, C.white, 2.4) + handOver(w);
    }
  });

  // fallback for unknown ids: gently breathing standing figure
  var IDLE = {
    dur: 4, hi: hiSet([]), sh: [150, 60],
    A: { hx: 150, hy: 120, t: -90, sb: 0, n: -90, lnx: 156, lny: 205, lfx: 145, lfy: 205, anU: 96, anL: 86 },
    B: { hy: 119, sb: 1.5, n: -92, anU: 98 },
    ws: [1.6, 0.4, 1.6, 0.4], calm: true
  };

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

  // phase for the reduced-motion still: the working position
  function midPhase(ex) {
    if (ex._kf) return (ex._kf[0].w + ex._kf[1].w + ex._kf[2].w + 0.3) / ex._wsum;
    if (ex.ws) { var s = ex.ws[0] + ex.ws[1] + ex.ws[2] + ex.ws[3]; return (ex.ws[0] + ex.ws[1] * 0.5) / s; }
    return 0.25;
  }

  function staticBg(ex) {
    var s = '';
    if (ex.sh) s += shadow(ex.sh[0], ex.sh[1]);
    return s;
  }
  function staticFg(ex) { return ex.mat ? mat(ex.mat[0], ex.mat[1]) : ''; }

  function frameSvg(ex, ph, t) {
    if (ex.custom) return ex.custom(ph, t);
    var c = { ph: ph, t: t };
    var J = solve(poseAt(ex, ph), ex.fdx || 0);
    var s = (ex.under ? ex.under(J, c) : '') +
      drawFig(J, ex.hi, ex.mid ? ex.mid(J, c) : '', ex.pre ? ex.pre(J, c) : '') +
      (ex.over ? ex.over(J, c) : '');
    if (ex.ws && !ex.calm) {
      var e = env(ph, ex.ws), n = J.P.n;
      s += sweat(add(add(J.Hd, n + 90, 13), n, 13), (e - 0.85) / 0.15);
    }
    return s;
  }

  var uid = 0;
  function rimDefs(id) {
    return '<defs><filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="d"/>' +
      '<feFlood flood-color="#FFFFFF" flood-opacity="0.85"/><feComposite in2="d" operator="in" result="r"/>' +
      '<feMerge><feMergeNode in="r"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }

  function mount(container, exerciseId, opts) {
    var ex = EX[exerciseId] || IDLE, th = makeTheme(opts);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 320 240');
    svg.setAttribute('width', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Animated demonstration: ' + String(exerciseId || 'exercise').replace(/_/g, ' '));
    svg.style.display = 'block';
    svg.style.height = 'auto';
    svg.style.overflow = 'visible';
    C = th;
    var fid = 'figrim' + (++uid), fattr = th.dark ? ' filter="url(#' + fid + ')"' : '';
    svg.innerHTML = (th.dark ? rimDefs(fid) : '') + '<g>' + staticBg(ex) + '</g><g' + fattr + '><g>' + staticFg(ex) + '</g><g></g></g>';
    var g = svg.lastChild.lastChild;
    container.appendChild(svg);

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var raf = 0, last = null, elapsed = 0, dead = false;

    function render(sec) {
      var ph = (sec / ex.dur) % 1;
      C = th;
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
    // test hook: static SVG markup of one exercise at phase 0..1 (opts as for mount; no dark rim)
    _frame: function (id, ph, opts) {
      var ex = EX[id] || IDLE; C = makeTheme(opts);
      return staticBg(ex) + staticFg(ex) + frameSvg(ex, ph, ph * ex.dur);
    } };
})();
