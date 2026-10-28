
var TP = (function () {
  'use strict';
  var IN = 2.54, LB = 0.45359237;
  function num(el) { if (!el) return NaN; var v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pctText(p) { p = Math.round(p * 100); if (p < 1) return 'below 1st'; if (p > 99) return 'above 99th'; return ord(p); }
  function pressed(list, attr, val) { Array.prototype.forEach.call(list, function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === val ? 'true' : 'false'); }); }
  function seg(root, attr, fn) { Array.prototype.forEach.call(root.querySelectorAll('[' + attr + ']'), function (b) { b.addEventListener('click', function () { fn(b.getAttribute(attr)); }); }); }
  function hdr(wrap) {
    var h = document.querySelector('.site-header');
    function set() { if (h && wrap) wrap.style.setProperty('--tp-hdr', Math.round(h.getBoundingClientRect().height) + 'px'); }
    set(); window.addEventListener('resize', set);
  }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  return { IN: IN, LB: LB, num: num, r1: r1, Phi: Phi, ord: ord, pctText: pctText, pressed: pressed, seg: seg, hdr: hdr, fmt: fmt };
})();

/* Face Symmetry Test + Golden Ratio Face Calculator
   Photo stays in the browser. Landmarks are placed by the user (drag), then measured. */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var MODE = root.getAttribute('data-mode'); // 'sym' | 'gold'
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('fc-canvas'), ctx = cv.getContext('2d');
  // Landmarks, normalized to a face box (x 0..1 left->right as seen in the photo, y 0..1 top->bottom)
  var P = [
    ['T', 'Top of forehead (hairline, centre)', 0.50, 0.06],
    ['G', 'Between the eyebrows', 0.50, 0.30],
    ['N', 'Tip of the nose', 0.50, 0.53],
    ['S', 'Base of the nose (centre)', 0.50, 0.60],
    ['M', 'Centre of the lips', 0.50, 0.71],
    ['C', 'Bottom of the chin', 0.50, 0.94],
    ['EoL', 'Outer corner, eye on the left', 0.24, 0.38], ['EiL', 'Inner corner, eye on the left', 0.40, 0.385],
    ['EiR', 'Inner corner, eye on the right', 0.60, 0.385], ['EoR', 'Outer corner, eye on the right', 0.76, 0.38],
    ['NL', 'Nose wing, left', 0.415, 0.575], ['NR', 'Nose wing, right', 0.585, 0.575],
    ['ML', 'Mouth corner, left', 0.355, 0.715], ['MR', 'Mouth corner, right', 0.645, 0.715],
    ['FL', 'Face edge at cheekbone, left', 0.08, 0.45], ['FR', 'Face edge at cheekbone, right', 0.92, 0.45],
    ['JL', 'Jaw angle, left', 0.16, 0.76], ['JR', 'Jaw angle, right', 0.84, 0.76]
  ];
  var IDX = {}; P.forEach(function (p, i) { IDX[p[0]] = i; });
  var PAIRS = [['EoL', 'EoR', 'Outer eye corners'], ['EiL', 'EiR', 'Inner eye corners'], ['NL', 'NR', 'Nose wings'], ['ML', 'MR', 'Mouth corners'], ['FL', 'FR', 'Cheekbones'], ['JL', 'JR', 'Jaw angles']];
  var MID = ['T', 'G', 'N', 'S', 'M', 'C'];
  var state = { img: null, pts: [], box: null, drag: -1, active: 0, view: 'pts', demo: true };

  /* ---------- demo face (drawn, symmetric-ish) ---------- */
  function demoImage() {
    var c = document.createElement('canvas'); c.width = 600; c.height = 760; var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 760); grd.addColorStop(0, '#26231e'); grd.addColorStop(1, '#141312'); g.fillStyle = grd; g.fillRect(0, 0, 600, 760);
    g.fillStyle = '#3a2f26'; g.beginPath(); g.ellipse(300, 260, 230, 220, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#d9b89a'; g.beginPath(); g.moveTo(300, 110); g.bezierCurveTo(470, 110, 505, 260, 495, 380); g.bezierCurveTo(488, 520, 430, 620, 300, 690); g.bezierCurveTo(170, 620, 112, 520, 105, 380); g.bezierCurveTo(95, 260, 130, 110, 300, 110); g.fill();
    g.fillStyle = '#c9a487'; g.beginPath(); g.ellipse(300, 470, 30, 55, 0, 0, 7); g.fill();
    function eye(x) { g.fillStyle = '#f3ece4'; g.beginPath(); g.ellipse(x, 360, 46, 17, 0, 0, 7); g.fill(); g.fillStyle = '#4c3626'; g.beginPath(); g.arc(x, 360, 13, 0, 7); g.fill(); g.strokeStyle = '#4a372a'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 50, 318); g.quadraticCurveTo(x, 300, x + 50, 318); g.stroke(); }
    eye(222); eye(378);
    g.fillStyle = '#b98f74'; g.beginPath(); g.ellipse(300, 532, 34, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#b5605e'; g.beginPath(); g.moveTo(213, 593); g.quadraticCurveTo(300, 560, 387, 593); g.quadraticCurveTo(300, 640, 213, 593); g.fill();
    return c;
  }
  var DEMO_BOX = { x: 100, y: 110 - 0.06 * 640 / 0.88, w: 400, h: 640 / 0.88 };
  var DEMO_PTS = { T: [300, 110], G: [300, 325], N: [300, 505], S: [300, 535], M: [300, 595], C: [300, 688], EoL: [178, 360], EiL: [262, 362], EiR: [338, 362], EoR: [422, 360],
    NL: [266, 528], NR: [334, 528], ML: [213, 593], MR: [387, 593], FL: [104, 400], FR: [496, 400], JL: [128, 545], JR: [472, 545] };

  /* ---------- layout ---------- */
  var view = { s: 1, ox: 0, oy: 0 };
  function fit() {
    var cssW = cv.clientWidth || 480, img = state.img, ar = img.height / img.width;
    var cssH = Math.min(Math.round(cssW * ar), Math.round(window.innerHeight * 0.75)), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.height = cssH + 'px';
    view.s = Math.min(cv.width / img.width, cv.height / img.height); view.ox = (cv.width - img.width * view.s) / 2; view.oy = (cv.height - img.height * view.s) / 2; view.dpr = dpr;
  }
  function toScr(p) { return [view.ox + p[0] * view.s, view.oy + p[1] * view.s]; }
  function toImg(x, y) { return [(x - view.ox) / view.s, (y - view.oy) / view.s]; }

  /* ---------- geometry ---------- */
  function d(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function pt(k) { return state.pts[IDX[k]]; }
  function midline() { // total least squares line through midline points: returns point c and unit direction u (pointing down)
    var ps = MID.map(pt), mx = 0, my = 0; ps.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= ps.length; my /= ps.length;
    var sxx = 0, syy = 0, sxy = 0; ps.forEach(function (p) { var dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    var th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)]; if (Math.abs(u[1]) < Math.abs(u[0])) u = [-u[1], u[0]]; if (u[1] < 0) u = [-u[0], -u[1]];
    return { c: [mx, my], u: u };
  }
  function reflect(p, L) { var v = [p[0] - L.c[0], p[1] - L.c[1]], t = v[0] * L.u[0] + v[1] * L.u[1], proj = [L.c[0] + L.u[0] * t, L.c[1] + L.u[1] * t]; return [2 * proj[0] - p[0], 2 * proj[1] - p[1]]; }
  function distLine(p, L) { var v = [p[0] - L.c[0], p[1] - L.c[1]]; return Math.abs(v[0] * L.u[1] - v[1] * L.u[0]); }

  function analyseSym() {
    var L = midline(), W = d(pt('FL'), pt('FR')), rows = [], tot = 0;
    PAIRS.forEach(function (pr) {
      var a = pt(pr[0]), b = pt(pr[1]), ra = reflect(a, L), e = d(ra, b) / W * 100;
      var da = distLine(a, L), db = distLine(b, L);
      var along = function (p) { return (p[0] - L.c[0]) * L.u[0] + (p[1] - L.c[1]) * L.u[1]; };
      var dh = (along(a) - along(b)) / W * 100;
      var note = Math.abs(da - db) / W * 100 > 1 ? (da > db ? 'left side wider' : 'right side wider') : 'even width';
      note += Math.abs(dh) > 1 ? (dh > 0 ? ', left lower' : ', right lower') : '';
      rows.push([pr[2], e, note]); tot += e;
    });
    var midDev = MID.reduce(function (s, k) { return s + distLine(pt(k), L); }, 0) / MID.length / W * 100;
    var mean = tot / PAIRS.length, score = Math.max(0, Math.min(100, 100 - mean * 6 - midDev * 3));
    var tilt = Math.atan2(L.u[0], L.u[1]) * 180 / Math.PI;
    return { score: score, rows: rows, mean: mean, mid: midDev, tilt: tilt, L: L };
  }
  var PHI = 1.618;
  function analyseGold() {
    var faceL = d(pt('T'), pt('C')), faceW = d(pt('FL'), pt('FR')), mouthW = d(pt('ML'), pt('MR')), noseW = d(pt('NL'), pt('NR'));
    var eyeL = d(pt('EoL'), pt('EiL')), eyeR = d(pt('EiR'), pt('EoR')), inter = d(pt('EiL'), pt('EiR')), eyeW = (eyeL + eyeR) / 2;
    var up = d(pt('T'), pt('G')), midT = d(pt('G'), pt('S')), low = d(pt('S'), pt('C')), lipChin = d(pt('M'), pt('C')), noseLip = d(pt('S'), pt('M'));
    var jaw = d(pt('JL'), pt('JR'));
    var R = [
      ['Face length ÷ face width', faceL / faceW, PHI],
      ['Mouth width ÷ nose width', mouthW / noseW, PHI],
      ['Lips-to-chin ÷ nose-to-lips', lipChin / noseLip, PHI],
      ['Face width ÷ jaw width', faceW / jaw, 1.25],
      ['Eye width ÷ gap between eyes', eyeW / inter, 1.0],
      ['Forehead ÷ middle third', up / midT, 1.0],
      ['Lower third ÷ middle third', low / midT, 1.0]
    ];
    var tot = 0; R.forEach(function (r) { r[3] = Math.max(0, 100 - Math.abs(r[1] / r[2] - 1) * 180); tot += r[3]; });
    return { score: tot / R.length, rows: R };
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!state.img) return;
    fit(); var dpr = view.dpr;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (state.view === 'pts' || MODE === 'gold') ctx.drawImage(state.img, view.ox, view.oy, state.img.width * view.s, state.img.height * view.s);
    else mirror(state.view);
    if (state.view !== 'pts' && MODE === 'sym') return;
    var L = midline();
    ctx.strokeStyle = 'rgba(232,201,122,.65)'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([6 * dpr, 5 * dpr]);
    var a = toScr([L.c[0] - L.u[0] * 2000, L.c[1] - L.u[1] * 2000]), b = toScr([L.c[0] + L.u[0] * 2000, L.c[1] + L.u[1] * 2000]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    if (MODE === 'sym') {
      ctx.strokeStyle = 'rgba(143,196,190,.8)'; ctx.lineWidth = 1.2 * dpr;
      PAIRS.forEach(function (pr) { var p1 = toScr(pt(pr[0])), p2 = toScr(pt(pr[1])), rf = toScr(reflect(pt(pr[0]), L)); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); ctx.fillStyle = 'rgba(143,196,190,.9)'; ctx.beginPath(); ctx.arc(rf[0], rf[1], 3 * dpr, 0, 7); ctx.fill(); });
    } else {
      ctx.strokeStyle = 'rgba(143,196,190,.7)'; ctx.lineWidth = 1.2 * dpr;
      [['T', 'C'], ['FL', 'FR'], ['ML', 'MR'], ['NL', 'NR'], ['JL', 'JR']].forEach(function (q) { var p1 = toScr(pt(q[0])), p2 = toScr(pt(q[1])); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke(); });
      ['G', 'S'].forEach(function (k) { var p = toScr(pt(k)), w = d(pt('FL'), pt('FR')) * view.s * 0.5; ctx.beginPath(); ctx.moveTo(p[0] - w, p[1]); ctx.lineTo(p[0] + w, p[1]); ctx.stroke(); });
    }
    state.pts.forEach(function (p, i) {
      var s = toScr(p), act = i === state.active;
      ctx.fillStyle = act ? '#e8c97a' : 'rgba(245,239,224,.95)'; ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(s[0], s[1], (act ? 7 : 5) * dpr, 0, 7); ctx.fill(); ctx.stroke();
    });
  }
  function mirror(which) { // composite: left-left or right-right, after rotating the midline vertical
    var L = midline(), ang = Math.atan2(L.u[0], L.u[1]), c = L.c, img = state.img;
    var off = document.createElement('canvas'); off.width = img.width; off.height = img.height; var o = off.getContext('2d');
    o.translate(c[0], c[1]); o.rotate(ang); o.translate(-c[0], -c[1]); o.drawImage(img, 0, 0);
    var res = document.createElement('canvas'); res.width = img.width; res.height = img.height; var r = res.getContext('2d');
    var cx = c[0];
    if (which === 'll') { r.drawImage(off, 0, 0, cx, img.height, 0, 0, cx, img.height); r.save(); r.translate(2 * cx, 0); r.scale(-1, 1); r.drawImage(off, 0, 0, cx, img.height, 0, 0, cx, img.height); r.restore(); }
    else { r.drawImage(off, cx, 0, img.width - cx, img.height, cx, 0, img.width - cx, img.height); r.save(); r.translate(2 * cx, 0); r.scale(-1, 1); r.drawImage(off, cx, 0, img.width - cx, img.height, cx, 0, img.width - cx, img.height); r.restore(); }
    ctx.drawImage(res, view.ox, view.oy, img.width * view.s, img.height * view.s);
  }

  /* ---------- results ---------- */
  function results() {
    if (!state.img) return;
    var out = $('fc-rows'), big = $('fc-score'), cat = $('fc-cat');
    if (MODE === 'sym') {
      var a = analyseSym(), s = a.score;
      big.textContent = Math.round(s) + '%';
      var lab = s >= 92 ? ['Highly symmetrical', 'c2'] : s >= 84 ? ['Symmetrical', 'c3'] : s >= 74 ? ['Typical', 'c4'] : ['Noticeably asymmetrical', 'c5'];
      cat.textContent = lab[0]; cat.className = 'tp-pill tp-' + lab[1];
      out.innerHTML = a.rows.map(function (r) { var w = Math.min(100, r[1] * 12); return '<div class="tp-bar"><span>' + r[0] + '</span><i><em style="width:' + w + '%"></em></i><b>' + r[1].toFixed(1) + '%</b></div><p class="fc-note">' + r[2] + '</p>'; }).join('');
      $('fc-line').innerHTML = 'Average mismatch between matching points: <b>' + a.mean.toFixed(1) + '%</b> of face width. Head tilt: <b>' + Math.abs(a.tilt).toFixed(1) + '°</b>' + (Math.abs(a.tilt) > 4 ? ' (try a straighter photo for a fairer result)' : '') + '. Most people score between 80% and 95%; perfect symmetry does not occur naturally.';
    } else {
      var g = analyseGold();
      big.textContent = Math.round(g.score) + '%';
      var lb = g.score >= 90 ? ['Very close to the ratios', 'c2'] : g.score >= 80 ? ['Close', 'c3'] : g.score >= 70 ? ['Moderate', 'c4'] : ['Far from the ratios', 'c5'];
      cat.textContent = lb[0]; cat.className = 'tp-pill tp-' + lb[1];
      out.innerHTML = g.rows.map(function (r) { return '<div class="tp-bar"><span>' + r[0] + '</span><i><em style="width:' + r[3] + '%"></em></i><b>' + r[1].toFixed(2) + '</b></div><p class="fc-note">ideal ' + r[2] + ' · match ' + Math.round(r[3]) + '%</p>'; }).join('');
      $('fc-line').innerHTML = 'Golden ratio = 1.618. Scores compare each of your proportions with the classic target. These ratios are an artistic ideal, not a measure of attractiveness; real faces rated as attractive vary widely.';
    }
    $('fc-active').textContent = (state.active + 1) + '. ' + P[state.active][1];
  }

  /* ---------- interaction ---------- */
  function setImage(img, demo) {
    state.img = img; state.demo = demo;
    if (demo) { state.pts = P.map(function (p) { return DEMO_PTS[p[0]].slice(); }); }
    else { // guess a centered face box
      var w = img.width, h = img.height, bw = Math.min(w * 0.62, h * 0.5), bh = bw * 1.38, bx = (w - bw) / 2, by = Math.max(0, (h - bh) / 2 - h * 0.03);
      state.pts = P.map(function (p) { return [bx + p[2] * bw, by + p[3] * bh]; });
    }
    state.active = 0; state.view = 'pts'; TP.pressed(root.querySelectorAll('[data-view]'), 'data-view', 'pts');
    $('fc-demo-note').hidden = !demo; draw(); results();
  }
  function hit(x, y) { var best = -1, bd = 22 * (view.dpr || 1); state.pts.forEach(function (p, i) { var s = toScr(p), dd = Math.hypot(s[0] - x, s[1] - y); if (dd < bd) { bd = dd; best = i; } }); return best; }
  function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
  cv.addEventListener('pointerdown', function (e) {
    if (state.view !== 'pts' && MODE === 'sym') return;
    var p = pos(e), h = hit(p[0], p[1]);
    if (h >= 0) { state.drag = h; state.active = h; cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    draw(); results();
  });
  cv.addEventListener('pointermove', function (e) { if (state.drag < 0) return; var p = pos(e); state.pts[state.drag] = toImg(p[0], p[1]); draw(); results(); e.preventDefault(); });
  cv.addEventListener('pointerup', function () { state.drag = -1; });
  cv.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (k) { var p = state.pts[state.active]; p[0] += k[0] * 2 / view.s; p[1] += k[1] * 2 / view.s; draw(); results(); e.preventDefault(); }
    if (e.key === 'Tab' && !e.shiftKey && state.active < P.length - 1) { state.active++; draw(); results(); e.preventDefault(); }
  });
  $('fc-prev').addEventListener('click', function () { state.active = (state.active + P.length - 1) % P.length; draw(); results(); });
  $('fc-next').addEventListener('click', function () { state.active = (state.active + 1) % P.length; draw(); results(); });
  $('fc-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () { var max = 1400, sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); setImage(c, false); };
    im.src = url;
  });
  $('fc-demo').addEventListener('click', function () { setImage(demoImage(), true); });
  TP.seg(root, 'data-view', function (v) { state.view = v; TP.pressed(root.querySelectorAll('[data-view]'), 'data-view', v); draw(); });
  if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(cv);
  TP.hdr(root.closest('.tp-wrap'));
  setImage(demoImage(), true);
})();
