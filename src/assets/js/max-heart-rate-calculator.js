
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

/* Max heart rate calculator */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'm' };
  function update() {
    var a = TP.num($('tp-age')), err = $('tp-err');
    if (!(a >= 10 && a <= 100)) { err.hidden = false; err.textContent = 'Enter an age between 10 and 100.'; $('tp-out').classList.add('tp-dim'); return; }
    err.hidden = true; $('tp-out').classList.remove('tp-dim');
    var F = [['Tanaka (208 − 0.7 × age)', 208 - 0.7 * a], ['Fox (220 − age)', 220 - a], ['Gellish (207 − 0.7 × age)', 207 - 0.7 * a], ['Nes (211 − 0.64 × age)', 211 - 0.64 * a]];
    if (state.sex === 'f') F.push(['Gulati, women (206 − 0.88 × age)', 206 - 0.88 * a]);
    var best = state.sex === 'f' ? (F[0][1] + F[4][1]) / 2 : F[0][1];
    $('tp-big').textContent = Math.round(best) + ' bpm';
    var mx = Math.max.apply(null, F.map(function (f) { return f[1]; }));
    $('tp-rows').innerHTML = F.map(function (f) { return '<div class="tp-bar"><span>' + f[0] + '</span><i><em style="width:' + (f[1] / mx * 100) + '%"></em></i><b>' + Math.round(f[1]) + '</b></div>'; }).join('');
    $('tp-z').innerHTML = [[50, 60, 'Zone 1 · very light'], [60, 70, 'Zone 2 · light (fat-burning)'], [70, 80, 'Zone 3 · moderate'], [80, 90, 'Zone 4 · hard'], [90, 100, 'Zone 5 · maximum']].map(function (z) {
      return '<tr><th scope="row">' + z[2] + '</th><td>' + z[0] + '–' + z[1] + '%</td><td>' + Math.round(best * z[0] / 100) + '–' + Math.round(best * z[1] / 100) + ' bpm</td></tr>'; }).join('');
    $('tp-line').innerHTML = 'Your estimated maximum heart rate is about <b>' + Math.round(best) + ' beats per minute</b>' + (state.sex === 'f' ? ' (average of the Tanaka and Gulati formulas, which suit women better)' : ' (Tanaka formula, the most accurate general formula)') + '. Real maximums vary by about ±10 bpm from any formula. <a href="/heart-rate-zone-calculator/">Get personalized zones with your resting heart rate &rarr;</a>';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = 'Max HR <b>' + Math.round(best) + '</b> bpm';
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap')); $('tp-age').value = 35; update();
})();
