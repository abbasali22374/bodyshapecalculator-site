
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

/* Steps to distance calculator */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'm', unit: 'us', pace: 'walk' };
  function readH() { return state.unit === 'us' ? (TP.num($('tp-ft')) * 12 + (TP.num($('tp-in')) || 0)) * 2.54 : TP.num($('tp-cm')); }
  function update() {
    var n = TP.num($('tp-steps')), h = readH(), w = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1), msg = '';
    if (!(n >= 1 && n <= 200000)) msg = 'Enter a number of steps.'; else if (!(h >= 100 && h <= 230)) msg = 'Enter your height for your step length.';
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var step = h * (state.sex === 'm' ? 0.415 : 0.413) * (state.pace === 'run' ? 1.65 : 1) / 100, km = n * step / 1000, mi = km / 1.609344;
    var mins = state.pace === 'run' ? n / 160 : n / 100, kg = isFinite(w) && w > 25 ? w : (state.sex === 'm' ? 90 : 77);
    var met = state.pace === 'run' ? 9.8 : 3.5, kcal = met * kg * mins / 60;
    $('tp-big').textContent = (state.unit === 'us' ? mi.toFixed(2) + ' mi' : km.toFixed(2) + ' km');
    $('tp-c1').textContent = mi.toFixed(2) + ' mi'; $('tp-c2').textContent = km.toFixed(2) + ' km'; $('tp-c3').textContent = Math.round(mins) + ' min'; $('tp-c4').textContent = Math.round(kcal) + ' kcal';
    $('tp-line').innerHTML = '<b>' + n.toLocaleString('en-US') + ' steps</b> is about <b>' + mi.toFixed(2) + ' miles (' + km.toFixed(2) + ' km)</b> at a ' + (state.pace === 'run' ? 'running' : 'walking') + ' step of ' + (step * 100).toFixed(0) + ' cm (' + (step / 0.0254).toFixed(1) + ' in). At a typical ' + (state.pace === 'run' ? 'running cadence of 160 steps per minute' : 'walking cadence of 100 steps per minute') + ' that takes about ' + Math.round(mins) + ' minutes and burns roughly ' + Math.round(kcal) + ' calories' + (isFinite(w) && w > 25 ? '' : ' (add your weight for a closer estimate)') + '.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + mi.toFixed(2) + ' mi</b> · ' + km.toFixed(2) + ' km';
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  TP.seg(root, 'data-pace', function (s) { state.pace = s; TP.pressed(root.querySelectorAll('[data-pace]'), 'data-pace', s); update(); });
  TP.seg(root, 'data-unit', function (u) { var h = readH(), w = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1); state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-h-us').hidden = u !== 'us'; $('tp-h-m').hidden = u === 'us'; $('tp-wtu').textContent = u === 'us' ? 'lb' : 'kg';
    if (isFinite(h)) { if (u === 'us') { var t = h / 2.54, f = Math.floor(t / 12); $('tp-ft').value = f; $('tp-in').value = Math.round(t - f * 12); } else $('tp-cm').value = Math.round(h); }
    if (isFinite(w)) $('tp-wt').value = u === 'us' ? Math.round(w / 0.45359237) : Math.round(w); update(); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-n]'), function (b) { b.addEventListener('click', function () { $('tp-steps').value = b.getAttribute('data-n'); update(); }); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap')); $('tp-steps').value = 10000; $('tp-ft').value = 5; $('tp-in').value = 9; update();
})();
