
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

/* Height Percentile Calculator — children 2-19 and adults (NHANES 2015-2018) with growth chart */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var D = JSON.parse($('tp-data').textContent), Z = [-1.6449, -0.6745, 0, 0.6745, 1.6449];
  var GROUPS = [[20, 29, '20-29'], [30, 39, '30-39'], [40, 49, '40-49'], [50, 59, '50-59'], [60, 69, '60-69'], [70, 79, '70-79'], [80, 200, '80+']];
  var state = { sex: 'm', unit: 'us' };
  var els = { age: $('tp-age'), ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'), err: $('tp-err'), out: $('tp-out'),
    pct: $('tp-pct'), cat: $('tp-cat'), marker: $('tp-marker'), med: $('tp-med'), of100: $('tp-of100'), grp: $('tp-grp'), line: $('tp-line'), cv: $('tp-canvas'), mobile: $('tp-mstrip') };
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function fmt(cm) { if (state.unit === 'us') { var t = cm / 2.54, f = Math.floor(t / 12), i = TP.r1(t - f * 12); if (i >= 12) { f++; i = 0; } return f + ' ft ' + i + ' in'; } return TP.r1(cm) + ' cm'; }
  function ptsAt(sex, age) {
    var d = D[sex];
    if (age >= 20) { for (var i = 0; i < GROUPS.length; i++) if (age <= GROUPS[i][1]) return [d[GROUPS[i][2]], 'aged ' + GROUPS[i][2].replace('-', '–')]; }
    var a0 = Math.max(2, Math.min(19, Math.floor(age))), a1 = Math.min(19, a0 + 1), t = Math.max(0, Math.min(1, age - a0));
    if (a0 === 19) return [d['19'], 'aged 19'];
    return [d[a0].map(function (v, k) { return v + (d[a1][k] - v) * t; }), 'aged ' + (Math.round(age * 10) / 10)];
  }
  function zOf(v, p) {
    if (v <= p[0]) return Z[0] + (v - p[0]) * (Z[1] - Z[0]) / (p[1] - p[0]);
    if (v >= p[4]) return Z[4] + (v - p[4]) * (Z[4] - Z[3]) / (p[4] - p[3]);
    for (var i = 0; i < 4; i++) if (v <= p[i + 1]) return Z[i] + (v - p[i]) * (Z[i + 1] - Z[i]) / (p[i + 1] - p[i]);
  }
  function chart(age, h) {
    var cv = els.cv, cssW = cv.clientWidth || 600, cssH = Math.round(Math.min(380, Math.max(260, cssW * 0.55)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    cv.width = W; cv.height = H; cv.style.height = cssH + 'px';
    var c = cv.getContext('2d'), d = D[state.sex], L = 40 * dpr, R = 12 * dpr, T = 12 * dpr, B = 28 * dpr;
    var ages = []; for (var a = 2; a <= 19; a++) ages.push([a, d[a]]);
    [[24.5, '20-29'], [34.5, '30-39'], [44.5, '40-49'], [54.5, '50-59'], [64.5, '60-69'], [74.5, '70-79'], [84, '80+']].forEach(function (g) { ages.push([g[0], d[g[1]]]); });
    var X = function (a) { return L + (Math.log(a) - Math.log(2)) / (Math.log(85) - Math.log(2)) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - 80) / (200 - 80)) * (H - T - B); };
    c.font = (10.5 * dpr) + 'px -apple-system,Segoe UI,Roboto,Arial,sans-serif'; c.fillStyle = '#7d7d7d'; c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = dpr;
    for (var v = 80; v <= 200; v += 20) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(W - R, Y(v)); c.stroke(); c.fillText(state.unit === 'us' ? Math.round(v / 2.54) + '"' : v, 4 * dpr, Y(v) + 4 * dpr); }
    [2, 5, 10, 15, 20, 30, 50, 80].forEach(function (a) { c.fillText(a, X(a) - 4 * dpr, H - 8 * dpr); });
    function band(k0, k1, col) { c.beginPath(); ages.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1][k1])); }); for (var i = ages.length - 1; i >= 0; i--) c.lineTo(X(ages[i][0]), Y(ages[i][1][k0])); c.closePath(); c.fillStyle = col; c.fill(); }
    band(0, 4, 'rgba(201,168,76,.10)'); band(1, 3, 'rgba(201,168,76,.18)');
    c.beginPath(); ages.forEach(function (p, i) { c[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1][2])); }); c.strokeStyle = 'rgba(232,201,122,.9)'; c.lineWidth = 2 * dpr; c.stroke();
    if (isFinite(age) && isFinite(h)) { var x = X(Math.max(2, Math.min(85, age))), y = Y(h); c.fillStyle = '#8fc4be'; c.beginPath(); c.arc(x, y, 6 * dpr, 0, 7); c.fill(); c.strokeStyle = '#0d0d0d'; c.lineWidth = 2 * dpr; c.stroke(); }
  }
  function update() {
    var age = TP.num(els.age), h = readH(), msg = '';
    if (!(age >= 2 && age <= 110)) msg = 'Enter an age from 2 years up.';
    else if (!(h >= 70 && h <= 240)) msg = 'Enter a height between 2 ft 4 in and 7 ft 10 in (70–240 cm).';
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    chart(age, h);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }
    var r = ptsAt(state.sex, age), pts = r[0], p = TP.Phi(zOf(h, pts));
    var lab = p < 0.05 ? ['Short for age', 'c1'] : p < 0.25 ? ['Below average', 'c1'] : p <= 0.75 ? ['Average', 'c3'] : p <= 0.95 ? ['Above average', 'c2'] : ['Tall for age', 'c4'];
    els.pct.textContent = TP.pctText(p); els.cat.textContent = lab[0]; els.cat.className = 'tp-pill tp-' + lab[1];
    els.marker.style.left = Math.min(99, Math.max(1, p * 100)) + '%';
    els.med.textContent = fmt(pts[2]); var n = Math.round(p * 100); els.of100.textContent = n + ' of 100';
    var who = (age < 20 ? (state.sex === 'm' ? 'boys' : 'girls') : (state.sex === 'm' ? 'men' : 'women')) + ' ' + r[1];
    els.grp.textContent = 'U.S. ' + who;
    els.line.innerHTML = 'At <b>' + fmt(h) + '</b> you are taller than about <b>' + n + '%</b> of U.S. ' + who + '. The median is ' + fmt(pts[2]) + ', and the middle half measure ' + fmt(pts[1]) + ' to ' + fmt(pts[3]) + '.' +
      (age < 18 ? ' Children often move between percentiles during growth spurts; a single reading is a snapshot. <a href="/height-calculator/">Predict adult height &rarr;</a>' : '');
    if (els.mobile) els.mobile.innerHTML = '<b>' + TP.pctText(p) + '</b> percentile · ' + lab[0];
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return; var h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us';
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = TP.r1(t - f * 12); } else els.cm.value = TP.r1(h); }
    update();
  });
  root.addEventListener('input', update);
  if (window.ResizeObserver) new ResizeObserver(update).observe(els.cv);
  TP.hdr(root.closest('.tp-wrap'));
  els.age.value = 30; els.ft.value = 5; els.inch.value = 10; update();
})();
