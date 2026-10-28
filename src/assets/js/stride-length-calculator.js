
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

/* Stride length calculator: from height or measured steps */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'm', unit: 'us', m: 'height' };
  function readH() { return state.unit === 'us' ? (TP.num($('tp-ft')) * 12 + (TP.num($('tp-in')) || 0)) * 2.54 : TP.num($('tp-cm')); }
  function L(cm) { return state.unit === 'us' ? (cm / 2.54 >= 36 ? Math.floor(cm / 30.48) + ' ft ' + TP.r1(cm / 2.54 - Math.floor(cm / 30.48) * 12) + ' in' : TP.r1(cm / 2.54) + ' in') : TP.r1(cm) + ' cm'; }
  function update() {
    var walk, msg = '', h = readH();
    if (state.m === 'height') { if (!(h >= 100 && h <= 230)) msg = 'Enter your height.'; else walk = h * (state.sex === 'm' ? 0.415 : 0.413); }
    else { var d = TP.num($('tp-d')) * (state.unit === 'us' ? 30.48 : 100), n = TP.num($('tp-n')); if (!(d > 0 && n >= 4)) msg = 'Walk a measured distance, count your steps and enter both.'; else walk = d / n; }
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var run = walk * (state.m === 'height' ? 1.65 : 1.65);
    $('tp-big').textContent = L(walk);
    $('tp-c1').textContent = L(walk * 2); $('tp-c2').textContent = Math.round(160934.4 / walk).toLocaleString('en-US'); $('tp-c3').textContent = Math.round(100000 / walk).toLocaleString('en-US'); $('tp-c4').textContent = L(run);
    $('tp-line').innerHTML = 'Your walking <b>step length</b> is about <b>' + L(walk) + '</b> and your <b>stride</b> (two steps) about <b>' + L(walk * 2) + '</b>. That is roughly <b>' + Math.round(160934.4 / walk).toLocaleString('en-US') + ' steps per mile</b> (' + Math.round(100000 / walk).toLocaleString('en-US') + ' per km). ' + (state.m === 'height' ? 'Estimated from height; measuring gives a better number.' : 'Measured from your own steps.') + ' <a href="/steps-to-distance-calculator/">Convert steps to miles &rarr;</a>';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = 'Step <b>' + L(walk) + '</b>';
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  TP.seg(root, 'data-m', function (m) { state.m = m; TP.pressed(root.querySelectorAll('[data-m]'), 'data-m', m); $('tp-f-h').hidden = m !== 'height'; $('tp-f-m').hidden = m === 'height'; update(); });
  TP.seg(root, 'data-unit', function (u) { var h = readH(); state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-h-us').hidden = u !== 'us'; $('tp-h-m').hidden = u === 'us'; $('tp-du').textContent = u === 'us' ? 'ft' : 'm';
    if (isFinite(h)) { if (u === 'us') { var t = h / 2.54, f = Math.floor(t / 12); $('tp-ft').value = f; $('tp-in').value = Math.round(t - f * 12); } else $('tp-cm').value = Math.round(h); } update(); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap')); $('tp-ft').value = 5; $('tp-in').value = 9; $('tp-d').value = 100; $('tp-n').value = 44; update();
})();
